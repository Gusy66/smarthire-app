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

export type PlatformAdmin = {
  id: string
  email: string
  name: string | null
  is_active: boolean
}

/**
 * Verifica se o usuário autenticado é um Platform Admin (Super Admin)
 * Retorna os dados do Platform Admin ou lança erro se não autorizado
 */
export async function requirePlatformAdmin(): Promise<PlatformAdmin> {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('sb-platform-token')?.value
  
  if (!accessToken) {
    throw new Error('platform_unauthorized')
  }

  const payload = decodeJwt(accessToken)
  if (!payload?.sub) {
    throw new Error('platform_unauthorized')
  }
  
  if (payload.exp && Date.now() >= payload.exp * 1000) {
    throw new Error('platform_token_expired')
  }

  // Validar token com Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, anonKey)

  const { data, error } = await supabase.auth.getUser(accessToken)
  if (error || !data.user) {
    throw new Error('platform_unauthorized')
  }

  const userId = data.user.id

  // Verificar se é Platform Admin usando service_role (RLS exige isso)
  const admin = getSupabaseAdmin()
  const { data: platformAdmin, error: platformError } = await admin
    .from('platform_admins')
    .select('id, email, name, is_active')
    .eq('id', userId)
    .maybeSingle()

  if (platformError || !platformAdmin) {
    throw new Error('platform_not_admin')
  }

  if (!platformAdmin.is_active) {
    throw new Error('platform_admin_inactive')
  }

  return {
    id: platformAdmin.id,
    email: platformAdmin.email,
    name: platformAdmin.name,
    is_active: platformAdmin.is_active
  }
}

/**
 * Verifica se um usuário específico é Platform Admin
 * Útil para validações sem cookie (ex: após login)
 */
export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('platform_admins')
    .select('id, is_active')
    .eq('id', userId)
    .eq('is_active', true)
    .maybeSingle()

  return !error && !!data
}

/**
 * Cria um novo Platform Admin
 * Apenas Platform Admins existentes podem criar novos
 */
export async function createPlatformAdmin(
  email: string,
  password: string,
  name: string,
  createdBy: string
): Promise<{ id: string; email: string }> {
  const admin = getSupabaseAdmin()

  // Criar usuário no Supabase Auth
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, is_platform_admin: true }
  })

  if (authError || !authData.user) {
    throw new Error(`Falha ao criar usuário: ${authError?.message || 'Erro desconhecido'}`)
  }

  // Inserir na tabela platform_admins
  const { error: insertError } = await admin
    .from('platform_admins')
    .insert({
      id: authData.user.id,
      email,
      name,
      is_active: true,
      created_by: createdBy
    })

  if (insertError) {
    // Rollback: deletar usuário do Auth
    await admin.auth.admin.deleteUser(authData.user.id)
    throw new Error(`Falha ao registrar platform admin: ${insertError.message}`)
  }

  return { id: authData.user.id, email }
}

