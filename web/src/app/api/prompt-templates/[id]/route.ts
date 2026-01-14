import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin'
import { requireUser } from '../../_lib/auth'
import { requirePermission } from '../../_lib/permissions'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin()
    const user = await requireUser()
    const { id } = await params

    const { data, error } = await supabase
      .from('prompt_templates')
      .select('id, name, description, content, is_default, created_at, updated_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      return Response.json({ error: { code: 'not_found', message: 'Template não encontrado' } }, { status: 404 })
    }

    return Response.json({ item: data })
  } catch (error: any) {
    if (error?.message === 'unauthorized') {
      return Response.json({ error: { code: 'unauthorized', message: 'Usuário não autenticado' } }, { status: 401 })
    }
    return Response.json({ error: { code: 'internal_error', message: 'Erro interno do servidor' } }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar permissão para editar prompts
    const user = await requirePermission('criar_prompts')
    const supabase = getSupabaseAdmin()
    const { id } = await params

    const body = await req.json()
    const { name, description, content, is_default } = body || {}

    if (!name || !content) {
      return Response.json({ error: { code: 'validation_error', message: 'Nome e conteúdo são obrigatórios' } }, { status: 400 })
    }

    if (typeof content !== 'string' || content.trim().length < 20) {
      return Response.json({ error: { code: 'validation_error', message: 'Conteúdo do template deve ter pelo menos 20 caracteres' } }, { status: 400 })
    }

    if (is_default) {
      await supabase
        .from('prompt_templates')
        .update({ is_default: false })
        .eq('user_id', user.id)
    }

    const { data, error } = await supabase
      .from('prompt_templates')
      .update({
        name,
        description: description || null,
        content,
        is_default: Boolean(is_default),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, name, description, content, is_default, created_at, updated_at')
      .single()

    if (error) {
      return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
    }

    return Response.json({ item: data })
  } catch (error: any) {
    if (error?.message === 'unauthorized') {
      return Response.json({ error: { code: 'unauthorized', message: 'Usuário não autenticado' } }, { status: 401 })
    }
    if (error?.message?.startsWith('permission_denied')) {
      return Response.json({ error: { code: 'forbidden', message: 'Você não tem permissão para editar prompts' } }, { status: 403 })
    }
    return Response.json({ error: { code: 'internal_error', message: 'Erro interno do servidor' } }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar permissão para deletar prompts
    const user = await requirePermission('criar_prompts')
    const supabase = getSupabaseAdmin()
    const { id } = await params

    const { error } = await supabase
      .from('prompt_templates')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (error: any) {
    if (error?.message === 'unauthorized') {
      return Response.json({ error: { code: 'unauthorized', message: 'Usuário não autenticado' } }, { status: 401 })
    }
    if (error?.message?.startsWith('permission_denied')) {
      return Response.json({ error: { code: 'forbidden', message: 'Você não tem permissão para excluir prompts' } }, { status: 403 })
    }
    return Response.json({ error: { code: 'internal_error', message: 'Erro interno do servidor' } }, { status: 500 })
  }
}
