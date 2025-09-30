import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../_lib/supabaseAdmin'
import { requireUser } from '../../../_lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ stageId: string }> }
) {
  try {
    const supabase = getSupabaseAdmin()
    const user = await requireUser()
    const { stageId } = await params

    const { data, error } = await supabase
      .from('stage_prompt_templates')
      .select('prompt_template_id, prompt_templates(id, name, description, content, is_default)')
      .eq('stage_id', stageId)
      .maybeSingle()

    if (error) {
      return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
    }

    if (!data?.prompt_template_id) {
      const { data: defaults } = await supabase
        .from('prompt_templates')
        .select('id, name, description, content, is_default')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .maybeSingle()

      return Response.json({ item: defaults ? { prompt_template_id: defaults.id, template: defaults } : null })
    }

    return Response.json({ item: { prompt_template_id: data.prompt_template_id, template: data.prompt_templates } })
  } catch (error: any) {
    if (error?.message === 'unauthorized') {
      return Response.json({ error: { code: 'unauthorized', message: 'Usuário não autenticado' } }, { status: 401 })
    }
    return Response.json({ error: { code: 'internal_error', message: 'Erro interno do servidor' } }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ stageId: string }> }
) {
  try {
    const supabase = getSupabaseAdmin()
    const user = await requireUser()
    const { stageId } = await params
    const body = await req.json()
    const { prompt_template_id } = body || {}

    if (!prompt_template_id) {
      const { error } = await supabase
        .from('stage_prompt_templates')
        .delete()
        .eq('stage_id', stageId)

      if (error) {
        return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
      }

      return Response.json({ success: true })
    }

    const { count, error: templateError } = await supabase
      .from('prompt_templates')
      .select('*', { count: 'exact', head: true })
      .eq('id', prompt_template_id)
      .eq('user_id', user.id)

    if (templateError || (count ?? 0) === 0) {
      return Response.json({ error: { code: 'not_found', message: 'Template inválido' } }, { status: 404 })
    }

    const { error } = await supabase
      .from('stage_prompt_templates')
      .upsert({ stage_id: stageId, prompt_template_id })

    if (error) {
      return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (error: any) {
    if (error?.message === 'unauthorized') {
      return Response.json({ error: { code: 'unauthorized', message: 'Usuário não autenticado' } }, { status: 401 })
    }
    return Response.json({ error: { code: 'internal_error', message: 'Erro interno do servidor' } }, { status: 500 })
  }
}
