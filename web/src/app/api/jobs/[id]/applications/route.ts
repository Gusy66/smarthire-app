import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../_lib/supabaseAdmin'
import { requireUser } from '../../../_lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Params) {
  const { id: jobId } = await params
  const supabase = getSupabaseAdmin()
  const user = await requireUser()

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, company_id')
    .eq('id', jobId)
    .maybeSingle()

  if (jobError || !job || job.company_id !== user.company_id) {
    return Response.json({ error: { code: 'forbidden', message: 'Vaga não encontrada' } }, { status: 404 })
  }

  const { data: apps, error } = await supabase
    .from('applications')
    .select('id, candidate_id, created_at')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
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

export async function POST(req: NextRequest, { params }: Params) {
  const { id: jobId } = await params
  const body = await req.json()
  const { candidate_id } = body || {}
  if (!candidate_id) {
    return Response.json({ error: { code: 'validation_error', message: 'candidate_id é obrigatório' } }, { status: 400 })
  }
  const supabase = getSupabaseAdmin()
  const user = await requireUser()

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('company_id')
    .eq('id', jobId)
    .maybeSingle()

  if (jobError || !job || job.company_id !== user.company_id) {
    return Response.json({ error: { code: 'forbidden', message: 'Vaga não encontrada' } }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('applications')
    .insert({ candidate_id, job_id: jobId })
    .select('id')
    .single()
  if (error) return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  return Response.json({ id: data.id })
}


