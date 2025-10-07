import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../_lib/supabaseAdmin'
import { requireUser } from '../../../_lib/auth'

type Params = { params: Promise<{ id: string }> }

function mapAuthError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'unauthorized') {
      return { status: 401, body: { error: { code: 'unauthorized', message: 'Usuário não autenticado' } } }
    }
    if (error.message === 'missing_company') {
      return { status: 500, body: { error: { code: 'missing_company', message: 'Não foi possível vincular o usuário a uma empresa.' } } }
    }
  }
  return { status: 500, body: { error: { code: 'internal_error', message: 'Falha ao recuperar usuário' } } }
}

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = getSupabaseAdmin()
  let user
  try {
    user = await requireUser()
  } catch (error) {
    const mapped = mapAuthError(error)
    return Response.json(mapped.body, { status: mapped.status })
  }

  const { data, error } = await supabase
    .from('job_stages')
    .select('id, name, description, order_index, threshold, stage_weight, created_at, jobs!inner(company_id)')
    .eq('job_id', id)
    .eq('jobs.company_id', user.company_id)
    .order('order_index', { ascending: true })
  if (error) {
    console.error('Erro ao buscar etapas', error)
    return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  }
  return Response.json({ items: (data ?? []).map(({ jobs, ...rest }) => rest) })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json()
  const { name, description = null, order_index = 0, threshold = 0, stage_weight = 1 } = body || {}
  if (!name) return Response.json({ error: { code: 'validation_error', message: 'name is required' } }, { status: 400 })
  const supabase = getSupabaseAdmin()
  let user
  try {
    user = await requireUser()
  } catch (error) {
    const mapped = mapAuthError(error)
    return Response.json(mapped.body, { status: mapped.status })
  }

  const { data: jobRow, error: jobError } = await supabase
    .from('jobs')
    .select('id, company_id, created_by')
    .eq('id', id)
    .maybeSingle()

  if (jobError || !jobRow) {
    return Response.json({ error: { code: 'forbidden', message: 'Vaga não encontrada' } }, { status: 404 })
  }

  if (jobRow.company_id !== user.company_id || jobRow.created_by !== user.id) {
    return Response.json({ error: { code: 'forbidden', message: 'Sem acesso à vaga' } }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('job_stages')
    .insert({ job_id: id, name, description, order_index, threshold, stage_weight })
    .select('id')
    .single()
  if (error) {
    console.error('Erro ao criar etapa', error)
    return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  }
  return Response.json({ id: data.id })
}


