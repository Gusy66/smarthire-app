import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../_lib/supabaseAdmin'

type Params = { params: Promise<{ stageId: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { stageId } = await params
  const { searchParams } = new URL(req.url)
  const applicationStageId = searchParams.get('application_stage_id')
  const applicationId = searchParams.get('application_id')

  if (!applicationStageId && !applicationId) {
    return Response.json({ error: { code: 'validation_error', message: 'Informe application_stage_id ou application_id' } }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from('stage_ai_runs')
    .select('run_id, status, result, application_stage_id, created_at, application_stages!inner(stage_id, application_id)')
    .eq('type', 'evaluate')
    .eq('application_stages.stage_id', stageId)
    .eq(applicationStageId ? 'application_stage_id' : 'application_stages.application_id', applicationStageId || applicationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  }

  if (!data) {
    return Response.json({ item: null })
  }

  const item = {
    run_id: data.run_id,
    status: data.status,
    result: data.result,
    application_stage_id: data.application_stage_id,
    created_at: data.created_at,
    stage_id: data.application_stages?.stage_id ?? null,
    application_id: data.application_stages?.application_id ?? null,
  }

  return Response.json({ item })
}

