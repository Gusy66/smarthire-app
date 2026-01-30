'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabaseBrowser'

type AuthStatusProps = {
  variant?: 'default' | 'mobile'
}

export default function AuthStatus({ variant = 'default' }: AuthStatusProps) {
  const supabase = getSupabaseBrowser()
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const isMobile = variant === 'mobile'
  const initialLoadDone = useRef(false)

  const loadAuthStatus = async () => {
    try {
      const authPromise = supabase.auth.getUser()
      const timeoutPromise = new Promise<{ data: { user?: { email?: string | null } } }>((resolve) =>
        setTimeout(() => resolve({ data: { user: { email: null } } }), 3000)
      )
      const { data } = await Promise.race([authPromise, timeoutPromise])
      if (data.user?.email) {
        setEmail(data.user.email)
        return
      }
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' })
      if (res.ok) {
        const json = await res.json().catch(() => null)
        setEmail(json?.email ?? null)
        return
      }
      setEmail(null)
    } catch {
      setEmail(null)
    }
  }

  useEffect(() => {
    let active = true
    if (!initialLoadDone.current) {
      setChecking(true)
      loadAuthStatus().finally(() => {
        if (active) {
          setChecking(false)
          initialLoadDone.current = true
        }
      })
    }
    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      if (!active) return
      await loadAuthStatus()
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

  if (checking) return <span className="text-sm text-gray-500">Verificando...</span>
  if (!email) return <a href="/login" className={linkClasses}>Entrar</a>
  return (
    <div className={isMobile ? 'flex w-full flex-col gap-3 text-sm' : 'flex items-center gap-2 text-sm'}>
      <span className={isMobile ? 'text-sm text-gray-700 break-words' : 'max-w-[200px] truncate text-gray-700'} title={email}>
        {email}
      </span>
      <span className="text-xs text-emerald-600">Logado</span>
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


