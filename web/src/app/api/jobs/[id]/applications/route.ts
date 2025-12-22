import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../_lib/supabaseAdmin'
import { requireUser } from '../../../_lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Params) {
  const { id: jobId } = await params
  const supabase = getSupabaseAdmin()
  let user
  try {
    user = await requireUser()
  } catch (error) {
    return Response.json({ error: { code: 'unauthorized', message: 'Usuário não autenticado' } }, { status: 401 })
  }

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, company_id, created_by')
    .eq('id', jobId)
    .maybeSingle()

  if (jobError || !job) {
    return Response.json({ error: { code: 'not_found', message: 'Vaga não encontrada' } }, { status: 404 })
  }

  if (job.company_id !== user.company_id || job.created_by !== user.id) {
    return Response.json({ error: { code: 'forbidden', message: 'Sem acesso à vaga solicitada' } }, { status: 403 })
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
    .select('id, name, email, phone, company_id, created_by')
    .in('id', candidateIds)
  if (candErr) return Response.json({ error: { code: 'db_error', message: candErr.message } }, { status: 500 })

  const candidateById = new Map(
    (candidates ?? [])
      .filter((c) => c.created_by === user.id && c.company_id === user.company_id)
      .map((c) => [c.id, c])
  )
  const items = apps
    .filter((a) => candidateById.has(a.candidate_id))
    .map((a) => ({ ...a, candidate: candidateById.get(a.candidate_id) || null }))
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
  let user
  try {
    user = await requireUser()
  } catch (error) {
    return Response.json({ error: { code: 'unauthorized', message: 'Usuário não autenticado' } }, { status: 401 })
  }

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('company_id, created_by')
    .eq('id', jobId)
    .maybeSingle()

  if (jobError || !job) {
    return Response.json({ error: { code: 'not_found', message: 'Vaga não encontrada' } }, { status: 404 })
  }

  if (job.company_id !== user.company_id || job.created_by !== user.id) {
    return Response.json({ error: { code: 'forbidden', message: 'Sem acesso à vaga solicitada' } }, { status: 403 })
  }

  // Criar a application
  const { data, error } = await supabase
    .from('applications')
    .insert({ candidate_id, job_id: jobId })
    .select('id')
    .single()
  if (error) return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })

  // Buscar a primeira etapa da vaga (menor order_index)
  const { data: firstStage } = await supabase
    .from('job_stages')
    .select('id')
    .eq('job_id', jobId)
    .order('order_index', { ascending: true })
    .limit(1)
    .maybeSingle()

  // Se houver etapas, criar automaticamente o application_stage para a primeira etapa
  if (firstStage) {
    await supabase
      .from('application_stages')
      .insert({
        application_id: data.id,
        stage_id: firstStage.id,
        status: 'pending',
      })
      .select('id')
      .single()
  }

  return Response.json({ id: data.id })
}


