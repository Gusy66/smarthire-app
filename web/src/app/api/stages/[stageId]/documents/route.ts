import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../_lib/supabaseAdmin'

type Params = { params: Promise<{ stageId: string }> }

export async function GET(_: NextRequest, { params }: Params) {
  const { stageId } = await params
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('stage_documents')
    .select('id, type, storage_path, created_at')
    .eq('stage_id', stageId)
  if (error) return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  return Response.json({ items: data ?? [] })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { stageId } = await params
  const body = await req.json()
  const { type, storage_path } = body || {}
  if (!type || !storage_path) return Response.json({ error: { code: 'validation_error', message: 'type e storage_path são obrigatórios' } }, { status: 400 })
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('stage_documents')
    .insert({ stage_id: stageId, type, storage_path })
    .select('id')
    .single()
  if (error) return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  return Response.json({ id: data.id })
}


