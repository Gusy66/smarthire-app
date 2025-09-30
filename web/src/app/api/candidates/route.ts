import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin'

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const { searchParams } = new URL(req.url)
  const search = (searchParams.get('search') || '').trim()
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '20', 10)))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase.from('candidates').select('id, name, email, phone, created_at', { count: 'exact' })
  if (search) {
    const term = `%${search}%`
    query = query.or(
      `name.ilike.${term},email.ilike.${term},phone.ilike.${term}`
    )
  }
  query = query.order('created_at', { ascending: false }).range(from, to)
  const { data, error, count } = await query
  if (error) return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  return Response.json({ items: data ?? [], page, page_size: pageSize, total: count ?? data?.length ?? 0 })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, email, phone } = body || {}
  if (!name) return Response.json({ error: { code: 'validation_error', message: 'name is required' } }, { status: 400 })
  const supabase = getSupabaseAdmin()
  // attach to default company for MVP
  let companyId: string | null = null
  {
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('name', 'Dev Co')
      .maybeSingle()
    if (company?.id) companyId = company.id
    else {
      const { data: inserted } = await supabase
        .from('companies')
        .insert({ name: 'Dev Co' })
        .select('id')
        .single()
      companyId = inserted?.id ?? null
    }
  }

  const { data, error } = await supabase
    .from('candidates')
    .insert({ name, email, phone, company_id: companyId })
    .select('id')
    .single()
  if (error) return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  return Response.json({ id: data.id })
}


