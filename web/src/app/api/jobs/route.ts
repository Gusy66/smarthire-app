import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin'
import { requireUser } from '../_lib/auth'

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  let user
  try {
    user = await requireUser()
  } catch (error) {
    return Response.json({ error: { code: 'unauthorized', message: 'Usuário não autenticado' } }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const search = (searchParams.get('search') || '').trim()
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '20', 10)))
  const status = (searchParams.get('status') || '').trim()
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // inclui contagem de candidaturas por vaga via sub-seleção
  let query = supabase
    .from('jobs')
    .select('id, company_id, title, description, location, status, created_at, applications:applications(count)', { count: 'exact' })
    .eq('company_id', user.company_id)
  if (status && ['open', 'closed'].includes(status)) {
    query = query.eq('status', status as 'open' | 'closed')
  }
  if (search) {
    const term = `%${search}%`
    query = query.or(
      `title.ilike.${term},description.ilike.${term},location.ilike.${term}`
    )
  }
  query = query.order('created_at', { ascending: false }).range(from, to)

  const { data, error, count } = await query
  if (error) return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  // normaliza applications_count para o frontend
  const items = (data ?? []).map((row: any) => ({
    ...row,
    applications_count: Array.isArray(row.applications) && row.applications[0] && typeof row.applications[0].count === 'number' ? row.applications[0].count : 0,
  }))
  return Response.json({ items, page, page_size: pageSize, total: count ?? items.length })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { title, description, location, status } = body || {}
  if (!title) return Response.json({ error: { code: 'validation_error', message: 'title is required' } }, { status: 400 })
  // For MVP, attach to a default company. In production, derive from auth/session.
  const supabase = getSupabaseAdmin()
  let user
  try {
    user = await requireUser()
  } catch (error) {
    return Response.json({ error: { code: 'unauthorized', message: 'Usuário não autenticado' } }, { status: 401 })
  }
  // Get or create default company "Dev Co"
  const companyId = user.company_id

  const { data, error } = await supabase
    .from('jobs')
    .insert({ title, description, location, status, company_id: companyId, created_by: user.id })
    .select('id')
    .single()
  if (error) return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  return Response.json({ id: data.id })
}


