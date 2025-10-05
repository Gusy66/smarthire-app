'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabaseBrowser'
import { useRouter } from 'next/navigation'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const supabase = getSupabaseBrowser()
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let cancelled = false
    let timer: any
    async function check() {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      if (data.session) { setChecked(true); return }
      // aguarda eventos de auth por alguns instantes (caso de primeiro login)
      timer = setTimeout(() => {
        if (!cancelled) {
          supabase.auth.signOut().catch(() => {})
          try { window.location.replace('/login') } catch { router.replace('/login') }
        }
      }, 1200)
    }
    const { data: sub } = supabase.auth.onAuthStateChange((evt, sess) => {
      if (cancelled) return
      if (sess) { setChecked(true); if (timer) clearTimeout(timer) }
    })
    check()
    return () => { cancelled = true; if (timer) clearTimeout(timer); sub.subscription.unsubscribe() }
  }, [router, supabase])

  if (!checked) {
    return (
      <div className="text-sm opacity-70">
        Carregando... <a className="underline" href="/login">Ir para login</a>
      </div>
    )
  }
  return <>{children}</>
}


