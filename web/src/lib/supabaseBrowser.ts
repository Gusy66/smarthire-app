import { createClient } from '@supabase/supabase-js'

let browserClient: ReturnType<typeof createClient> | null = null

export function getSupabaseBrowser() {
  if (browserClient) return browserClient
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  console.log('[DEBUG] Supabase Browser Config:', {
    supabaseUrl: supabaseUrl ? 'SET' : 'NOT SET',
    anonKey: anonKey ? 'SET' : 'NOT SET',
    urlLength: supabaseUrl?.length || 0,
    keyLength: anonKey?.length || 0
  })
  
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined')
  }
  
  if (!anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined')
  }
  
  browserClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
  return browserClient
}


