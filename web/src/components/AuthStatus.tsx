'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabaseBrowser'

export default function AuthStatus() {
  const supabase = getSupabaseBrowser()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      const { data } = await supabase.auth.getUser()
      setEmail(data.user?.email ?? null)
    })
    return () => { sub.subscription.unsubscribe() }
  }, [supabase])

  if (!email) return <a href="/login" className="btn btn-outline text-sm">Entrar</a>
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="opacity-80">{email}</span>
      <a href="/logout" className="btn btn-outline">Sair</a>
    </div>
  )
}


