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
    
    // Timeout para garantir redirecionamento mesmo se algo travar
    const redirectTimeout = setTimeout(() => {
      console.log('Timeout atingido, forçando redirecionamento...')
      window.location.href = '/login'
    }, 3000)
    
    try {
      // Primeiro: Limpar cookie no servidor (mais importante)
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ event: 'SIGNED_OUT', session: null }),
      }).catch(() => {})

      // Depois: Tentar fazer logout no Supabase (com timeout curto)
      const signOutPromise = supabase.auth.signOut()
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 1500)
      )
      
      await Promise.race([signOutPromise, timeoutPromise]).catch((err) => {
        console.warn('SignOut demorou ou falhou:', err)
      })

      clearTimeout(redirectTimeout)
      window.location.href = '/login'
    } catch (error) {
      console.error('Erro no logout:', error)
      clearTimeout(redirectTimeout)
      window.location.href = '/login'
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


