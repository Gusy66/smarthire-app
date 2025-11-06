import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin'
import { requireUser } from '../../_lib/auth'

type Params = { params: Promise<{ id: string }> }

const editableFields = [
  'title',
  'description',
  'location',
  'salary',
  'work_model',
  'contract_type',
  'requirements',
  'skills',
  'benefits',
  'department',
  'job_description',
  'responsibilities',
  'requirements_and_skills',
  'work_schedule',
  'travel_availability',
  'observations',
  'status',
] as const

type EditableField = (typeof editableFields)[number]

function sanitizeUpdate(payload: Record<string, any>) {
  const updates: Record<string, any> = {}
  editableFields.forEach((field) => {
    if (payload[field] !== undefined) updates[field] = payload[field]
  })
  if (updates.requirements && !Array.isArray(updates.requirements)) updates.requirements = []
  if (updates.skills && !Array.isArray(updates.skills)) updates.skills = []
  if (updates.benefits && !Array.isArray(updates.benefits)) updates.benefits = []
  if (updates.status && !['open', 'paused', 'closed'].includes(updates.status)) delete updates.status
  return updates
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id: jobId } = await params
  const supabase = getSupabaseAdmin()
  let user
  try {
    user = await requireUser()
  } catch (error) {
    return Response.json({ error: { code: 'unauthorized', message: 'Usuário não autenticado' } }, { status: 401 })
  }

  const { data: job, error } = await supabase
    .from('jobs')
    .select(
      `id, title, description, location, salary, work_model, contract_type, requirements, skills, benefits, department, job_description, responsibilities, requirements_and_skills, work_schedule, travel_availability, observations, status, created_by, company_id`
    )
    .eq('id', jobId)
    .maybeSingle()

  if (error || !job) {
    return Response.json({ error: { code: 'not_found', message: 'Vaga não encontrada' } }, { status: 404 })
  }

  if (job.company_id && job.company_id !== user.company_id) {
    return Response.json({ error: { code: 'forbidden', message: 'Sem acesso à vaga' } }, { status: 403 })
  }

  return Response.json({ item: job })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id: jobId } = await params
  const body = await req.json().catch(() => ({}))
  const updates = sanitizeUpdate(body ?? {})
  if (Object.keys(updates).length === 0) {
    return Response.json({ error: { code: 'validation_error', message: 'Nenhuma alteração válida fornecida' } }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  let user
  try {
    user = await requireUser()
  } catch (error) {
    return Response.json({ error: { code: 'unauthorized', message: 'Usuário não autenticado' } }, { status: 401 })
  }

  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .select('id, company_id, created_by')
    .eq('id', jobId)
    .maybeSingle()

  if (jobErr || !job) {
    return Response.json({ error: { code: 'not_found', message: 'Vaga não encontrada' } }, { status: 404 })
  }

  if (job.company_id !== user.company_id || job.created_by !== user.id) {
    return Response.json({ error: { code: 'forbidden', message: 'Sem acesso à vaga' } }, { status: 403 })
  }

  const { error: updateErr } = await supabase.from('jobs').update(updates).eq('id', jobId)
  if (updateErr) {
    return Response.json({ error: { code: 'db_error', message: updateErr.message } }, { status: 500 })
  }
  return Response.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
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
    return Response.json({ error: { code: 'forbidden', message: 'Sem acesso à vaga' } }, { status: 403 })
  }

  await supabase.from('job_stages').delete().eq('job_id', jobId)
  await supabase.from('applications').delete().eq('job_id', jobId)

  const { error: delError } = await supabase.from('jobs').delete().eq('id', jobId)
  if (delError) {
    return Response.json({ error: { code: 'db_error', message: delError.message } }, { status: 500 })
  }
  return Response.json({ ok: true })
}

