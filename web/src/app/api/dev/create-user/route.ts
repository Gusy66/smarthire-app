import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin'

function empty(val: any) {
  if (val == null) return true
  if (typeof val === 'string') return val.trim().length === 0
  if (typeof val === 'object') return Object.keys(val).length === 0
  return false
}

async function parseBodyFlexible(req: NextRequest): Promise<Record<string, any>> {
  const contentType = req.headers.get('content-type') || ''
  // Prefer reading as text once, then parse if JSON
  try {
    if (contentType.includes('application/json')) {
      const text = await req.text()
      if (text && text.trim().length > 0) {
        try { const obj = JSON.parse(text); if (!empty(obj)) return obj } catch {}
      }
    }
  } catch {}
  // Fallback: form-data
  try {
    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const obj: Record<string, any> = {}
      form.forEach((v, k) => { obj[k] = v })
      if (!empty(obj)) return obj
    }
  } catch {}
  // Fallback: query string
  try {
    const url = new URL(req.url)
    const obj: Record<string, any> = {}
    url.searchParams.forEach((v, k) => { obj[k] = v })
    if (!empty(obj)) return obj
  } catch {}
  return {}
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: { code: 'forbidden', message: 'Unavailable in production' } }, { status: 403 })
  }
  const body = await parseBodyFlexible(req)
  const { email, password, company_name = 'Dev Co', role = 'admin', name } = body || {}
  if (!email || !password) {
    return Response.json({ error: { code: 'validation_error', message: 'email e password são obrigatórios' } }, { status: 400 })
  }

  const client = getSupabaseAdmin()

  // 1) Cria usuário no Supabase Auth (confirmado)
  const created = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: name ? { name } : undefined,
  })
  if (created.error) {
    return Response.json({ error: { code: 'auth_error', message: created.error.message } }, { status: 400 })
  }
  const authUser = created.data.user
  if (!authUser) {
    return Response.json({ error: { code: 'auth_error', message: 'Falha ao criar usuário' } }, { status: 400 })
  }

  // 2) Garante empresa
  let companyId: string | null = null
  {
    const { data: company } = await client.from('companies').select('id').eq('name', company_name).maybeSingle()
    if (company?.id) companyId = company.id
    else {
      const { data: inserted, error: insertError } = await client.from('companies').insert({ name: company_name }).select('id').single()
      if (insertError) return Response.json({ error: { code: 'db_error', message: insertError.message } }, { status: 500 })
      companyId = inserted.id
    }
  }

  // 3) Cria linha em users com o mesmo id do Auth
  const { error: userInsertError } = await client.from('users').upsert({
    id: authUser.id,
    company_id: companyId,
    email,
    name: name || authUser.user_metadata?.name || null,
    role,
  })
  if (userInsertError) {
    return Response.json({ error: { code: 'db_error', message: userInsertError.message } }, { status: 500 })
  }

  return Response.json({ id: authUser.id, email, company_id: companyId, role })
}


