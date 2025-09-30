import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get('job_id')
  const supabase = getSupabaseAdmin()

  let query = supabase.from('applications').select('id, candidate_id, job_id, created_at')
  if (jobId) query = query.eq('job_id', jobId)
  const { data: apps, error } = await query.order('created_at', { ascending: false })
  if (error) return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })

  if (!apps || apps.length === 0) return Response.json({ items: [] })

  const candidateIds = [...new Set(apps.map((a) => a.candidate_id))]
  const { data: candidates, error: candErr } = await supabase
    .from('candidates')
    .select('id, name, email, phone')
    .in('id', candidateIds)
  if (candErr) return Response.json({ error: { code: 'db_error', message: candErr.message } }, { status: 500 })

  const candidateById = new Map((candidates ?? []).map((c) => [c.id, c]))
  const items = apps.map((a) => ({ ...a, candidate: candidateById.get(a.candidate_id) || null }))
  return Response.json({ items })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { candidate_id, job_id } = body || {}
  if (!candidate_id || !job_id) {
    return Response.json({ error: { code: 'validation_error', message: 'candidate_id e job_id são obrigatórios' } }, { status: 400 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('applications')
    .insert({ candidate_id, job_id })
    .select('id')
    .single()
  if (error) return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })

  return Response.json({ id: data.id })
}


