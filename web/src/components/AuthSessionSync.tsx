'use client'

import { useEffect } from 'react'
import { getSupabaseBrowser } from '@/lib/supabaseBrowser'

async function syncSession(event: string, session: any) {
  if (event === 'SIGNED_OUT') {
    try {
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ event, session: null }),
      })
    } catch (error) {
      console.error('Falha ao sincronizar sessão (signed out)', error)
    }
    return
  }

  const accessToken = session?.access_token
  if (!accessToken) {
    return
  }

  try {
    await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ event, session: { access_token: accessToken, expires_in: session?.expires_in, refresh_token: session?.refresh_token } }),
    })
  } catch (error) {
    console.error('Falha ao sincronizar sessão', error)
  }
}

export default function AuthSessionSync() {
  const supabase = getSupabaseBrowser()

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        syncSession('INITIAL_SESSION', data.session)
      }
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'REFRESH_TOKEN_UPDATED' || event === 'PASSWORD_RECOVERY') {
        syncSession('SIGNED_IN', session)
      }

      if (event === 'SIGNED_OUT') {
        syncSession('SIGNED_OUT', null)
      }
    })

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [supabase])

  return null
}


