import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin'
import { getUserIdFromCookie } from '../_lib/auth'

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const userId = await getUserIdFromCookie()
  if (!userId) {
    return Response.json({ error: { code: 'unauthorized', message: 'Usuário não autenticado' } }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const search = (searchParams.get('search') || '').trim()
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '20', 10)))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase.from('jobs').select('*', { count: 'exact' })
    .eq('created_by', userId)
  if (search) {
    const term = `%${search}%`
    query = query.or(
      `title.ilike.${term},description.ilike.${term},location.ilike.${term}`
    )
  }
  query = query.order('created_at', { ascending: false }).range(from, to)

  const { data, error, count } = await query
  if (error) return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  return Response.json({ items: data ?? [], page, page_size: pageSize, total: count ?? data?.length ?? 0 })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { title, description, location, status } = body || {}
  if (!title) return Response.json({ error: { code: 'validation_error', message: 'title is required' } }, { status: 400 })
  // For MVP, attach to a default company. In production, derive from auth/session.
  const supabase = getSupabaseAdmin()
  const createdBy = await getUserIdFromCookie()
  if (!createdBy) {
    return Response.json({ error: { code: 'unauthorized', message: 'Usuário não autenticado' } }, { status: 401 })
  }
  // Get or create default company "Dev Co"
  let companyId: string | null = null
  {
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('name', 'Dev Co')
      .maybeSingle()
    if (company?.id) companyId = company.id
    else {
      const { data: inserted, error: insertError } = await supabase
        .from('companies')
        .insert({ name: 'Dev Co' })
        .select('id')
        .single()
      if (insertError) return Response.json({ error: { code: 'db_error', message: insertError.message } }, { status: 500 })
      companyId = inserted.id
    }
  }

  const { data, error } = await supabase
    .from('jobs')
    .insert({ title, description, location, status, company_id: companyId, created_by: createdBy })
    .select('id')
    .single()
  if (error) return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  return Response.json({ id: data.id })
}


