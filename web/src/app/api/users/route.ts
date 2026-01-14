import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin'
import { requireUser } from '../_lib/auth'
import { isUserAdmin, getUserPermissions } from '../_lib/permissions'

/**
 * GET /api/users
 * Lista todos os usuários da empresa do usuário autenticado
 * Apenas admins podem ver a lista completa
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser()
    console.log('[Users API GET] Verificando admin para usuário:', user.id, user.email)
    const isAdmin = await isUserAdmin(user.id)
    console.log('[Users API GET] É admin?', isAdmin)

    if (!isAdmin) {
      console.log('[Users API GET] Acesso negado - não é admin')
      return NextResponse.json(
        { error: { code: 'forbidden', message: 'Apenas administradores podem listar usuários' } },
        { status: 403 }
      )
    }

    const admin = getSupabaseAdmin()

    // Buscar usuários da empresa
    const { data: users, error } = await admin
      .from('users')
      .select('id, email, name, role, is_admin, created_at')
      .eq('company_id', user.company_id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Users API] Erro ao listar:', error)
      return NextResponse.json(
        { error: { code: 'db_error', message: 'Erro ao listar usuários' } },
        { status: 500 }
      )
    }

    // Buscar permissões de cada usuário
    const usersWithPermissions = await Promise.all(
      (users || []).map(async (u) => {
        const permissions = await getUserPermissions(u.id)
        return { ...u, permissions }
      })
    )

    return NextResponse.json({ users: usersWithPermissions })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    
    if (message === 'unauthorized') {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Não autenticado' } },
        { status: 401 }
      )
    }

    console.error('[Users API] Erro:', error)
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Erro interno do servidor' } },
      { status: 500 }
    )
  }
}

/**
 * POST /api/users
 * Cria um novo usuário na empresa
 * Apenas admins podem criar usuários
 * 
 * Body: { email: string, password: string, name: string, permissions: object }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const isAdmin = await isUserAdmin(user.id)

    if (!isAdmin) {
      return NextResponse.json(
        { error: { code: 'forbidden', message: 'Apenas administradores podem criar usuários' } },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { email, password, name, permissions } = body

    // Validações
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: { code: 'validation_error', message: 'Email é obrigatório' } },
        { status: 400 }
      )
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: 'Senha deve ter pelo menos 6 caracteres' } },
        { status: 400 }
      )
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: 'Nome é obrigatório' } },
        { status: 400 }
      )
    }

    const admin = getSupabaseAdmin()

    // Verificar se já existe usuário com esse email
    const { data: existingUser } = await admin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle()

    if (existingUser) {
      return NextResponse.json(
        { error: { code: 'duplicate', message: 'Já existe um usuário com esse email' } },
        { status: 409 }
      )
    }

    // Criar usuário no Supabase Auth
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        name: name.trim()
      }
    })

    if (authError || !authData.user) {
      console.error('[Users API] Erro no Auth:', authError)
      return NextResponse.json(
        { error: { code: 'auth_error', message: authError?.message || 'Erro ao criar usuário' } },
        { status: 500 }
      )
    }

    // Criar entrada na tabela users
    const { data: newUser, error: userError } = await admin
      .from('users')
      .insert({
        id: authData.user.id,
        company_id: user.company_id,
        email: email.toLowerCase(),
        name: name.trim(),
        role: 'recruiter', // Novos usuários são recrutadores por padrão
        is_admin: false
      })
      .select('id, email, name, role, is_admin, created_at')
      .single()

    if (userError) {
      // Rollback: deletar usuário do Auth
      await admin.auth.admin.deleteUser(authData.user.id)
      
      console.error('[Users API] Erro ao criar user:', userError)
      return NextResponse.json(
        { error: { code: 'db_error', message: 'Erro ao criar usuário' } },
        { status: 500 }
      )
    }

    // Criar permissões se fornecidas
    if (permissions && typeof permissions === 'object') {
      await admin
        .from('user_permissions')
        .upsert({
          user_id: newUser.id,
          criar_prompts: permissions.criar_prompts ?? false,
          cadastrar_candidatos: permissions.cadastrar_candidatos ?? false,
          criar_editar_vagas: permissions.criar_editar_vagas ?? false
        }, {
          onConflict: 'user_id'
        })
    }

    // Buscar permissões atualizadas
    const userPermissions = await getUserPermissions(newUser.id)

    return NextResponse.json({
      success: true,
      user: { ...newUser, permissions: userPermissions }
    }, { status: 201 })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    
    if (message === 'unauthorized') {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Não autenticado' } },
        { status: 401 }
      )
    }

    console.error('[Users API] Erro:', error)
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Erro interno do servidor' } },
      { status: 500 }
    )
  }
}

