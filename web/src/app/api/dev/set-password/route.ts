import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin'

type AdminUser = {
  id: string
  email?: string
}

async function findUserIdByEmail(client: ReturnType<typeof getSupabaseAdmin>, email: string): Promise<string | null> {
  // Try through our app users table first (fast path)
  const { data: usr } = await client.from('users').select('id').eq('email', email).maybeSingle()
  if (usr?.id) return usr.id

  // Fallback: scan auth users in pages (dev helper; acceptable for small sets)
  const perPage = 100
  for (let page = 1; page <= 10; page++) {
    // @ts-ignore supabase-js typing accepts page, perPage in admin.listUsers
    const { data, error } = await client.auth.admin.listUsers({ page, perPage })
    if (error) break
    const hit = (data?.users as AdminUser[] | undefined)?.find((u) => (u.email || '').toLowerCase() === email.toLowerCase())
    if (hit?.id) return hit.id
    if (!data || data.users.length < perPage) break
  }
  return null
}

async function handleSetPassword(req: NextRequest, params?: { email?: string | null; password?: string | null }) {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: { code: 'forbidden', message: 'Unavailable in production' } }, { status: 403 })
  }
  const client = getSupabaseAdmin()
  const contentType = req.headers.get('content-type') || ''
  let body: any = {}
  try {
    if (contentType.includes('application/json')) body = JSON.parse(await req.text())
  } catch {}
  if (!body.email || !body.password) {
    const url = new URL(req.url)
    body = { email: params?.email ?? url.searchParams.get('email'), password: params?.password ?? url.searchParams.get('password') }
  }

  const { email, password } = body || {}
  if (!email || !password) {
    return Response.json({ error: { code: 'validation_error', message: 'email e password são obrigatórios' } }, { status: 400 })
  }

  const userId = await findUserIdByEmail(client, email)
  if (!userId) {
    return Response.json({ error: { code: 'not_found', message: 'Usuário não encontrado' } }, { status: 404 })
  }

  const upd = await client.auth.admin.updateUserById(userId, { password, email_confirm: true })
  if (upd.error) {
    return Response.json({ error: { code: 'auth_error', message: upd.error.message } }, { status: 400 })
  }
  return Response.json({ id: userId, email })
}

export async function POST(req: NextRequest) {
  return handleSetPassword(req)
}

export async function GET(req: NextRequest) {
  // Suporte a GET para facilitar testes via URL no navegador
  return handleSetPassword(req)
}


