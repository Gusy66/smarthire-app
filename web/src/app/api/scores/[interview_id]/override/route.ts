import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../_lib/supabaseAdmin'

type Params = { params: Promise<{ interview_id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { interview_id } = await params
  const body = await req.json()
  const { question_id, value, reason } = body || {}
  if (!question_id || typeof value !== 'number') {
    return Response.json({ error: { code: 'validation_error', message: 'question_id e value são obrigatórios' } }, { status: 400 })
  }
  const supabase = getSupabaseAdmin()
  const { data: score, error } = await supabase
    .from('scores')
    .insert({ interview_id, question_id, source: 'manual', value })
    .select('id')
    .single()
  if (error) return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  if (reason) {
    await supabase.from('score_overrides').insert({ score_id: score.id, value, reason })
  }
  return Response.json({ id: score.id, source: 'manual', value })
}


