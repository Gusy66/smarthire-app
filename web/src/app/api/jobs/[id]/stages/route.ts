import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../_lib/supabaseAdmin'
import { requireUser } from '../../../_lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = getSupabaseAdmin()
  const user = await requireUser()

  const { data, error } = await supabase
    .from('job_stages')
    .select('id, name, description, order_index, threshold, stage_weight, created_at, jobs!inner(company_id)')
    .eq('job_id', id)
    .eq('jobs.company_id', user.company_id)
    .order('order_index', { ascending: true })
  if (error) return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  return Response.json({ items: (data ?? []).map(({ jobs, ...rest }) => rest) })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json()
  const { name, description = null, order_index = 0, threshold = 0, stage_weight = 1 } = body || {}
  if (!name) return Response.json({ error: { code: 'validation_error', message: 'name is required' } }, { status: 400 })
  const supabase = getSupabaseAdmin()
  const user = await requireUser()

  const { data: jobRow, error: jobError } = await supabase
    .from('jobs')
    .select('id, company_id')
    .eq('id', id)
    .maybeSingle()

  if (jobError || !jobRow || jobRow.company_id !== user.company_id) {
    return Response.json({ error: { code: 'forbidden', message: 'Vaga não encontrada' } }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('job_stages')
    .insert({ job_id: id, name, description, order_index, threshold, stage_weight })
    .select('id')
    .single()
  if (error) return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  return Response.json({ id: data.id })
}


