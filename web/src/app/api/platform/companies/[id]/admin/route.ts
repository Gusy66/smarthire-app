import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../_lib/supabaseAdmin'
import { requirePlatformAdmin } from '../../../../_lib/platformAuth'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * POST /api/platform/companies/[id]/admin
 * Cria o administrador de uma empresa
 * 
 * Body: { email: string, password: string, name: string }
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    await requirePlatformAdmin()

    const { id: companyId } = await params
    const body = await req.json()
    const { email, password, name } = body

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

    // Verificar se empresa existe
    const { data: company, error: companyError } = await admin
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .maybeSingle()

    if (companyError || !company) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Empresa não encontrada' } },
        { status: 404 }
      )
    }

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
        name: name.trim(),
        company: company.name,
        role: 'admin'
      }
    })

    if (authError || !authData.user) {
      console.error('[Platform Admin Create] Erro no Auth:', authError)
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
        company_id: companyId,
        email: email.toLowerCase(),
        name: name.trim(),
        role: 'admin'
      })
      .select('id, email, name, role, created_at')
      .single()

    if (userError) {
      // Rollback: deletar usuário do Auth
      await admin.auth.admin.deleteUser(authData.user.id)
      
      console.error('[Platform Admin Create] Erro ao criar user:', userError)
      return NextResponse.json(
        { error: { code: 'db_error', message: 'Erro ao criar usuário na empresa' } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Administrador criado com sucesso para ${company.name}`,
      user: newUser
    }, { status: 201 })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    
    if (message.includes('platform_')) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Acesso negado' } },
        { status: 401 }
      )
    }

    console.error('[Platform Admin Create] Erro:', error)
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Erro interno do servidor' } },
      { status: 500 }
    )
  }
}

/**
 * GET /api/platform/companies/[id]/admin
 * Lista os administradores de uma empresa
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await requirePlatformAdmin()

    const { id: companyId } = await params
    const admin = getSupabaseAdmin()

    // Verificar se empresa existe
    const { data: company } = await admin
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .maybeSingle()

    if (!company) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Empresa não encontrada' } },
        { status: 404 }
      )
    }

    // Buscar admins da empresa
    const { data: admins, error: adminsError } = await admin
      .from('users')
      .select('id, email, name, role, created_at')
      .eq('company_id', companyId)
      .eq('role', 'admin')
      .order('created_at', { ascending: true })

    if (adminsError) {
      console.error('[Platform Admin List] Erro:', adminsError)
      return NextResponse.json(
        { error: { code: 'db_error', message: 'Erro ao listar administradores' } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      company: { id: company.id, name: company.name },
      admins: admins || []
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    
    if (message.includes('platform_')) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Acesso negado' } },
        { status: 401 }
      )
    }

    console.error('[Platform Admin List] Erro:', error)
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Erro interno do servidor' } },
      { status: 500 }
    )
  }
}

