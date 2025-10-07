import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin'
import { requireUser } from '../_lib/auth'

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  let user
  try {
    user = await requireUser()
  } catch (err) {
    return Response.json({ error: { code: 'unauthorized', message: 'Sessão inválida' } }, { status: 401 })
  }
  const { searchParams } = new URL(req.url)
  const search = (searchParams.get('search') || '').trim()
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '20', 10)))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('candidates')
    .select('id, name, email, phone, created_at, company_id, created_by', { count: 'exact' })
    .eq('company_id', user.company_id)
  if (search) {
    const term = `%${search}%`
    query = query.or(
      `name.ilike.${term},email.ilike.${term},phone.ilike.${term}`
    )
  }
  query = query.order('created_at', { ascending: false }).range(from, to)
  const { data, error, count } = await query
  if (error) return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  const sanitized = (data ?? []).filter((c) => (c.created_by ?? user.id) === user.id)
  return Response.json({ items: sanitized, page, page_size: pageSize, total: sanitized.length })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, email, phone } = body || {}
  if (!name) return Response.json({ error: { code: 'validation_error', message: 'name is required' } }, { status: 400 })
  const supabase = getSupabaseAdmin()
  let user
  try {
    user = await requireUser()
  } catch (err) {
    return Response.json({ error: { code: 'unauthorized', message: 'Sessão inválida' } }, { status: 401 })
  }

  const { data: candidate, error } = await supabase
    .from('candidates')
    .insert({
      name,
      email,
      phone,
      company_id: user.company_id,
      created_by: user.id,
    })
    .select('id')
    .single()
  if (error) {
    return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  }
  return Response.json({ id: candidate.id })
}


