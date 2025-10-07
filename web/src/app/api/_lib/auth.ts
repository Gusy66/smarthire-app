import { cookies } from 'next/headers'
import { getSupabaseAdmin } from './supabaseAdmin'
import { createClient } from '@supabase/supabase-js'

function decodeJwt(token: string): any | null {
  try {
    const [, payload] = token.split('.')
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=')
    const json = Buffer.from(normalized, 'base64').toString('utf-8')
    return JSON.parse(json)
  } catch (error) {
    console.error('Falha ao decodificar token JWT', error)
    return null
  }
}

export async function getUserIdFromCookie(): Promise<string | null> {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('sb-access-token')?.value
  if (!accessToken) return null

  const payload = decodeJwt(accessToken)
  if (!payload?.sub) return null
  if (payload.exp && Date.now() >= payload.exp * 1000) {
    return null
  }
  return String(payload.sub)
}

export type AuthedUser = { id: string; company_id: string }

export async function requireUser(): Promise<AuthedUser> {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('sb-access-token')?.value
  if (!accessToken) throw new Error('unauthorized')

  const payload = decodeJwt(accessToken)
  if (!payload?.sub) throw new Error('unauthorized')
  if (payload.exp && Date.now() >= payload.exp * 1000) {
    throw new Error('unauthorized')
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, anonKey)

  const { data, error } = await supabase.auth.getUser(accessToken)
  if (error || !data.user) {
    throw new Error('unauthorized')
  }
  const userId = data.user.id
  const userEmail = data.user.email ?? ''
  const metadata = data.user.user_metadata ?? {}

  const admin = getSupabaseAdmin()
  const { data: profile, error: profileError } = await admin
    .from('users')
    .select('company_id')
    .eq('id', userId)
    .maybeSingle()

  if (profile?.company_id && !profileError) {
    return { id: userId, company_id: profile.company_id }
  }

  // Auto provision company and user entry when missing
  const rawCompany = typeof metadata.company === 'string' ? metadata.company.trim() : ''
  const fallbackCompany = userEmail ? `Empresa ${userEmail.split('@')[0]}` : 'Minha Empresa'
  const companyName = rawCompany || fallbackCompany

  // Garante empresa
  let companyId: string | null = null
  const { data: existingCompany, error: existingCompanyError } = await admin
    .from('companies')
    .select('id')
    .eq('name', companyName)
    .maybeSingle()

  if (!existingCompanyError && existingCompany?.id) {
    companyId = existingCompany.id
  } else {
    const { data: insertedCompany, error: insertCompanyError } = await admin
      .from('companies')
      .insert({ name: companyName })
      .select('id')
      .single()

    if (insertCompanyError) {
      console.error('Falha ao criar empresa automática:', insertCompanyError)
      throw new Error('missing_company')
    }
    companyId = insertedCompany.id
  }

  if (!companyId) throw new Error('missing_company')

  const userName = typeof metadata.name === 'string' && metadata.name.trim().length > 0 ? metadata.name.trim() : (userEmail || 'Usuário')
  const userRole = typeof metadata.role === 'string' && metadata.role.trim().length > 0 ? metadata.role.trim() : 'admin'

  const { error: upsertError } = await admin
    .from('users')
    .upsert({
      id: userId,
      company_id: companyId,
      email: userEmail,
      name: userName,
      role: (userRole as 'admin' | 'recruiter' | 'interviewer'),
    })

  if (upsertError) {
    console.error('Falha ao provisionar usuário automaticamente:', upsertError)
    throw new Error('missing_company')
  }

  return { id: userId, company_id: companyId }
}


