import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin'
import { requireUser } from '../../_lib/auth'

type Params = { params: Promise<{ stageId: string }> }

export async function PUT(req: NextRequest, { params }: Params) {
  const { stageId } = await params
  const body = await req.json()
  const { name, order_index, threshold, stage_weight, description } = body || {}
  const supabase = getSupabaseAdmin()
  const user = await requireUser()

  const { data: stage, error: stageError } = await supabase
    .from('job_stages')
    .select('id, job_id, jobs(company_id)')
    .eq('id', stageId)
    .maybeSingle()

  if (stageError || !stage || stage.jobs?.company_id !== user.company_id) {
    return Response.json({ error: { code: 'forbidden', message: 'Etapa não encontrada' } }, { status: 404 })
  }

  const { error } = await supabase
    .from('job_stages')
    .update({ name, order_index, threshold, stage_weight, description })
    .eq('id', stageId)
  if (error) return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { stageId } = await params
  const supabase = getSupabaseAdmin()
  const user = await requireUser()

  const { data: stage, error: stageError } = await supabase
    .from('job_stages')
    .select('id, jobs(company_id)')
    .eq('id', stageId)
    .maybeSingle()

  if (stageError || !stage || stage.jobs?.company_id !== user.company_id) {
    return Response.json({ error: { code: 'forbidden', message: 'Etapa não encontrada' } }, { status: 404 })
  }

  const { error } = await supabase
    .from('job_stages')
    .delete()
    .eq('id', stageId)
  if (error) return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  return Response.json({ ok: true })
}


