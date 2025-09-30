export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
}

export const ENV = {
  SUPABASE_URL: () => requireEnv('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: () => requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  NEXT_PUBLIC_SUPABASE_URL: () => requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: () => requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  NEXT_PUBLIC_AI_BASE_URL: () => requireEnv('NEXT_PUBLIC_AI_BASE_URL'),
}


