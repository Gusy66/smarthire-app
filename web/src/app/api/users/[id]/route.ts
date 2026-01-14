import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin'
import { requireUser } from '../../_lib/auth'
import { isUserAdmin, getUserPermissions } from '../../_lib/permissions'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * GET /api/users/[id]
 * Retorna detalhes de um usuário específico
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireUser()
    const isAdmin = await isUserAdmin(user.id)
    const { id: targetUserId } = await params

    // Usuário pode ver seus próprios dados, admins podem ver qualquer um da empresa
    if (!isAdmin && user.id !== targetUserId) {
      return NextResponse.json(
        { error: { code: 'forbidden', message: 'Acesso negado' } },
        { status: 403 }
      )
    }

    const admin = getSupabaseAdmin()

    const { data: targetUser, error } = await admin
      .from('users')
      .select('id, email, name, role, is_admin, company_id, created_at')
      .eq('id', targetUserId)
      .maybeSingle()

    if (error || !targetUser) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Usuário não encontrado' } },
        { status: 404 }
      )
    }

    // Verificar se é da mesma empresa
    if (targetUser.company_id !== user.company_id) {
      return NextResponse.json(
        { error: { code: 'forbidden', message: 'Acesso negado' } },
        { status: 403 }
      )
    }

    const permissions = await getUserPermissions(targetUserId)

    return NextResponse.json({
      user: { ...targetUser, permissions }
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    
    if (message === 'unauthorized') {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Não autenticado' } },
        { status: 401 }
      )
    }

    console.error('[User API] Erro:', error)
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Erro interno do servidor' } },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/users/[id]
 * Atualiza um usuário (nome, permissões, is_admin)
 * Apenas admins podem editar outros usuários
 * 
 * Body: { name?: string, is_admin?: boolean, permissions?: object }
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireUser()
    const isAdmin = await isUserAdmin(user.id)
    const { id: targetUserId } = await params

    if (!isAdmin) {
      return NextResponse.json(
        { error: { code: 'forbidden', message: 'Apenas administradores podem editar usuários' } },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { name, is_admin, permissions } = body

    const admin = getSupabaseAdmin()

    // Verificar se usuário existe e é da mesma empresa
    const { data: targetUser, error: findError } = await admin
      .from('users')
      .select('id, company_id')
      .eq('id', targetUserId)
      .maybeSingle()

    if (findError || !targetUser) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Usuário não encontrado' } },
        { status: 404 }
      )
    }

    if (targetUser.company_id !== user.company_id) {
      return NextResponse.json(
        { error: { code: 'forbidden', message: 'Você só pode editar usuários da sua empresa' } },
        { status: 403 }
      )
    }

    // Não permitir que admin remova o próprio status de admin
    if (targetUserId === user.id && is_admin === false) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: 'Você não pode remover seu próprio status de administrador' } },
        { status: 400 }
      )
    }

    // Atualizar dados do usuário
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (is_admin !== undefined) updateData.is_admin = is_admin

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await admin
        .from('users')
        .update(updateData)
        .eq('id', targetUserId)

      if (updateError) {
        console.error('[User API] Erro ao atualizar:', updateError)
        return NextResponse.json(
          { error: { code: 'db_error', message: 'Erro ao atualizar usuário' } },
          { status: 500 }
        )
      }
    }

    // Atualizar permissões se fornecidas
    if (permissions && typeof permissions === 'object') {
      const { error: permError } = await admin
        .from('user_permissions')
        .upsert({
          user_id: targetUserId,
          criar_prompts: permissions.criar_prompts ?? false,
          cadastrar_candidatos: permissions.cadastrar_candidatos ?? false,
          criar_editar_vagas: permissions.criar_editar_vagas ?? false
        }, {
          onConflict: 'user_id'
        })

      if (permError) {
        console.error('[User API] Erro ao atualizar permissões:', permError)
      }
    }

    // Buscar usuário atualizado
    const { data: updatedUser } = await admin
      .from('users')
      .select('id, email, name, role, is_admin, created_at')
      .eq('id', targetUserId)
      .single()

    const updatedPermissions = await getUserPermissions(targetUserId)

    return NextResponse.json({
      success: true,
      user: { ...updatedUser, permissions: updatedPermissions }
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    
    if (message === 'unauthorized') {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Não autenticado' } },
        { status: 401 }
      )
    }

    console.error('[User API] Erro:', error)
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Erro interno do servidor' } },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/users/[id]
 * Remove um usuário da empresa
 * Apenas admins podem remover usuários
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireUser()
    const isAdmin = await isUserAdmin(user.id)
    const { id: targetUserId } = await params

    if (!isAdmin) {
      return NextResponse.json(
        { error: { code: 'forbidden', message: 'Apenas administradores podem remover usuários' } },
        { status: 403 }
      )
    }

    // Não permitir auto-exclusão
    if (targetUserId === user.id) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: 'Você não pode remover a si mesmo' } },
        { status: 400 }
      )
    }

    const admin = getSupabaseAdmin()

    // Verificar se usuário existe e é da mesma empresa
    const { data: targetUser, error: findError } = await admin
      .from('users')
      .select('id, email, company_id')
      .eq('id', targetUserId)
      .maybeSingle()

    if (findError || !targetUser) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Usuário não encontrado' } },
        { status: 404 }
      )
    }

    if (targetUser.company_id !== user.company_id) {
      return NextResponse.json(
        { error: { code: 'forbidden', message: 'Você só pode remover usuários da sua empresa' } },
        { status: 403 }
      )
    }

    // Deletar permissões primeiro (cascade deveria fazer isso, mas por segurança)
    await admin
      .from('user_permissions')
      .delete()
      .eq('user_id', targetUserId)

    // Deletar da tabela users
    const { error: deleteUserError } = await admin
      .from('users')
      .delete()
      .eq('id', targetUserId)

    if (deleteUserError) {
      console.error('[User API] Erro ao deletar user:', deleteUserError)
      return NextResponse.json(
        { error: { code: 'db_error', message: 'Erro ao remover usuário' } },
        { status: 500 }
      )
    }

    // Deletar do Supabase Auth
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(targetUserId)
    
    if (authDeleteError) {
      console.error('[User API] Erro ao deletar do Auth:', authDeleteError)
      // Não retorna erro, usuário já foi removido da tabela
    }

    return NextResponse.json({
      success: true,
      message: 'Usuário removido com sucesso'
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    
    if (message === 'unauthorized') {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Não autenticado' } },
        { status: 401 }
      )
    }

    console.error('[User API] Erro:', error)
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Erro interno do servidor' } },
      { status: 500 }
    )
  }
}




