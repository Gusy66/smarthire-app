import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../_lib/supabaseAdmin'

type Params = { params: Promise<{ stageId: string }> }

export async function GET(_: NextRequest, { params }: Params) {
  const { stageId } = await params
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('stage_requirements')
    .select('id, label, weight, description, created_at')
    .eq('stage_id', stageId)
    .order('created_at', { ascending: true })
  if (error) return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  return Response.json({ items: data ?? [] })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { stageId } = await params
  const body = await req.json()
  const { label, weight = 1, description } = body || {}
  if (!label) return Response.json({ error: { code: 'validation_error', message: 'label is required' } }, { status: 400 })
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('stage_requirements')
    .insert({ stage_id: stageId, label, weight, description })
    .select('id')
    .single()
  if (error) return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  return Response.json({ id: data.id })
}


