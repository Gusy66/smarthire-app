import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../_lib/supabaseAdmin'
import { requireUser } from '../../../_lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { id: candidateId } = await params
  const supabase = getSupabaseAdmin()

  let user
  try {
    user = await requireUser()
  } catch {
    return Response.json({ error: { code: 'unauthorized', message: 'Não autenticado' } }, { status: 401 })
  }

  const { data: candidate, error: candidateError } = await supabase
    .from('candidates')
    .select('id, company_id')
    .eq('id', candidateId)
    .single()

  if (candidateError) {
    return Response.json({ error: { code: 'db_error', message: candidateError.message } }, { status: 500 })
  }
  if (!candidate) {
    return Response.json({ error: { code: 'not_found', message: 'Candidato não encontrado' } }, { status: 404 })
  }
  if (candidate.company_id !== user.company_id) {
    return Response.json({ error: { code: 'forbidden', message: 'Acesso negado' } }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const jobId = (searchParams.get('job_id') || '').trim()

  let query = supabase
    .from('candidate_notes')
    .select('id, note, created_at, job_id, user_id, users(name, email)')
    .eq('candidate_id', candidateId)
    .eq('company_id', user.company_id)
    .order('created_at', { ascending: false })

  if (jobId) {
    query = query.eq('job_id', jobId)
  }

  const { data, error } = await query
  if (error) {
    return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  }

  const items = (data || []).map((row: any) => ({
    id: row.id,
    note: row.note,
    created_at: row.created_at,
    job_id: row.job_id,
    author_name: row.users?.name || row.users?.email || 'Usuário',
  }))

  return Response.json({ items })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id: candidateId } = await params
  const supabase = getSupabaseAdmin()

  let user
  try {
    user = await requireUser()
  } catch {
    return Response.json({ error: { code: 'unauthorized', message: 'Não autenticado' } }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const note = typeof body?.note === 'string' ? body.note.trim() : ''
  const jobId = typeof body?.job_id === 'string' && body.job_id.trim() ? body.job_id.trim() : null

  if (!note) {
    return Response.json({ error: { code: 'validation_error', message: 'Observação é obrigatória' } }, { status: 400 })
  }

  const { data: candidate, error: candidateError } = await supabase
    .from('candidates')
    .select('id, company_id')
    .eq('id', candidateId)
    .single()

  if (candidateError) {
    return Response.json({ error: { code: 'db_error', message: candidateError.message } }, { status: 500 })
  }
  if (!candidate) {
    return Response.json({ error: { code: 'not_found', message: 'Candidato não encontrado' } }, { status: 404 })
  }
  if (candidate.company_id !== user.company_id) {
    return Response.json({ error: { code: 'forbidden', message: 'Acesso negado' } }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('candidate_notes')
    .insert({
      candidate_id: candidateId,
      company_id: user.company_id,
      job_id: jobId,
      user_id: user.id,
      note,
    })
    .select('id, note, created_at, job_id')
    .single()

  if (error) {
    return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  }

  return Response.json({ item: data })
}
