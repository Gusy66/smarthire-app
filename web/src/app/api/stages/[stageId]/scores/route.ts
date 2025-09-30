import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../_lib/supabaseAdmin'

type Params = { params: Promise<{ stageId: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { stageId } = await params
  const { searchParams } = new URL(req.url)
  const applicationStageId = searchParams.get('application_stage_id')
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from('stage_scores')
    .select('id, application_stage_id, requirement_id, source, value, created_at')
  if (applicationStageId) query = query.eq('application_stage_id', applicationStageId)
  const { data, error } = await query
  if (error) return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  return Response.json({ items: data ?? [] })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { stageId } = await params
  const body = await req.json()
  const { application_stage_id, requirement_id, value } = body || {}
  if (!application_stage_id || !requirement_id || typeof value !== 'number') {
    return Response.json({ error: { code: 'validation_error', message: 'application_stage_id, requirement_id e value são obrigatórios' } }, { status: 400 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('stage_scores')
    .insert({ application_stage_id, requirement_id, value, source: 'manual' })
    .select('id')
    .single()
  if (error) return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  return Response.json({ id: data.id })
}


