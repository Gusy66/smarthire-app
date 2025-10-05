'use client'

import { useEffect } from 'react'
import { getSupabaseBrowser } from '@/lib/supabaseBrowser'

async function syncSession(event: string, session: any) {
  if (!session?.access_token && event !== 'SIGNED_OUT') {
    return
  }
  try {
    await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ event, session }),
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
      if (!cancelled) {
        syncSession(event, session)
      }
    })

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [supabase])

  return null
}


