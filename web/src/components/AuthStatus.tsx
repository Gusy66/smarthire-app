'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabaseBrowser'

type AuthStatusProps = {
  variant?: 'default' | 'mobile'
}

export default function AuthStatus({ variant = 'default' }: AuthStatusProps) {
  const supabase = getSupabaseBrowser()
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const isMobile = variant === 'mobile'

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

  const linkClasses = isMobile
    ? 'btn btn-outline text-sm w-full justify-center'
    : 'btn btn-outline text-sm'

  if (!email) return <a href="/login" className={linkClasses}>Entrar</a>
  return (
    <div className={isMobile ? 'flex w-full flex-col gap-3 text-sm' : 'flex items-center gap-2 text-sm'}>
      <span className={isMobile ? 'text-sm text-gray-700 break-words' : 'max-w-[200px] truncate text-gray-700'} title={email}>
        {email}
      </span>
      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className={isMobile ? 'btn btn-outline disabled:opacity-60 w-full justify-center' : 'btn btn-outline disabled:opacity-60'}
      >
        {loggingOut ? 'Saindo...' : 'Sair'}
      </button>
    </div>
  )
}


