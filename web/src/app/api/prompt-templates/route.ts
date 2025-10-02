import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin'
import { requireUser } from '../_lib/auth'

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    const user = await requireUser()

    const { data, error } = await supabase
      .from('prompt_templates')
      .select('id, name, description, content, is_default, created_at, updated_at')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
    }

    return Response.json({ items: data ?? [] })
  } catch (error: any) {
    if (error?.message === 'unauthorized') {
      return Response.json({ error: { code: 'unauthorized', message: 'Usuário não autenticado' } }, { status: 401 })
    }
    console.error('prompt-templates POST error:', error)
    return Response.json({ error: { code: 'internal_error', message: error?.message || 'Erro interno do servidor' } }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const user = await requireUser()

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
      .insert({
        user_id: user.id,
        company_id: user.company_id,
        name,
        description: description || null,
        content,
        is_default: Boolean(is_default),
      })
      .select('id, name, description, content, is_default, created_at, updated_at')
      .single()

    if (error) {
      return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
    }

    return Response.json({ item: data }, { status: 201 })
  } catch (error: any) {
    if (error?.message === 'unauthorized') {
      return Response.json({ error: { code: 'unauthorized', message: 'Usuário não autenticado' } }, { status: 401 })
    }
    return Response.json({ error: { code: 'internal_error', message: 'Erro interno do servidor' } }, { status: 500 })
  }
}
