'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabaseBrowser'

export default function AuthStatus() {
  const supabase = getSupabaseBrowser()
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      const { data } = await supabase.auth.getUser()
      setEmail(data.user?.email ?? null)
    })
    return () => { sub.subscription.unsubscribe() }
  }, [supabase])

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Erro ao sair:', error)
      }
      try {
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ event: 'SIGNED_OUT', session: null }),
        })
      } catch (syncError) {
        console.error('Falha ao sincronizar logout', syncError)
      }
      router.replace('/login')
      router.refresh()
    } finally {
      setLoggingOut(false)
    }
  }

  if (!email) return <a href="/login" className="btn btn-outline text-sm">Entrar</a>
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="opacity-80">{email}</span>
      <button onClick={handleLogout} disabled={loggingOut} className="btn btn-outline disabled:opacity-60">
        {loggingOut ? 'Saindo...' : 'Sair'}
      </button>
    </div>
  )
}


