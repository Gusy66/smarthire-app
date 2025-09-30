import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from './supabaseAdmin'

export async function getUserIdFromCookie(): Promise<string | null> {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('sb-access-token')?.value
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  if (!accessToken) return null
  const supabase = createClient(supabaseUrl, anonKey)
  try {
    const { data } = await supabase.auth.getUser(accessToken)
    return data.user?.id ?? null
  } catch {
    return null
  }
}

export type AuthedUser = { id: string; company_id: string }

export async function requireUser(): Promise<AuthedUser> {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('sb-access-token')?.value
  if (!accessToken) throw new Error('unauthorized')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, anonKey)

  const { data, error } = await supabase.auth.getUser(accessToken)
  if (error || !data.user) throw new Error('unauthorized')
  const userId = data.user.id

  const admin = getSupabaseAdmin()
  const { data: profile, error: profileError } = await admin
    .from('users')
    .select('company_id')
    .eq('id', userId)
    .single()

  if (profileError || !profile?.company_id) {
    throw new Error('missing_company')
  }

  return { id: userId, company_id: profile.company_id }
}


