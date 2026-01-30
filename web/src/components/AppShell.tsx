'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import NavBar from './NavBar'
import { getSupabaseBrowser } from '@/lib/supabaseBrowser'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [authStatus, setAuthStatus] = useState<'loading' | 'authed' | 'guest'>('loading')
  const supabase = getSupabaseBrowser()
  
  // Rotas que não devem mostrar o layout principal (Sidebar/NavBar)
  const isExcludedRoute = pathname?.startsWith('/platform')
  const isAuthRoute = pathname === '/login' || pathname === '/signup'
  const isProtectedRoute = pathname ? ['/dashboard', '/jobs', '/candidates', '/settings'].some((path) => pathname === path || pathname.startsWith(`${path}/`)) : false

  const checkBackendAuth = async (attempt = 0): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' })
      if (res.status === 401 && attempt < 1) {
        await new Promise((resolve) => setTimeout(resolve, 300))
        return checkBackendAuth(attempt + 1)
      }
      return res.ok
    } catch {
      return false
    }
  }

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      if (data.session) {
        setAuthStatus('authed')
        return
      }
      const backendOk = await checkBackendAuth()
      if (!active) return
      if (backendOk) {
        setAuthStatus('authed')
        return
      }
      try {
        const { data: refreshed } = await supabase.auth.refreshSession()
        if (!active) return
        if (refreshed.session) {
          setAuthStatus('authed')
          return
        }
      } catch {}
      if (!active) return
      setAuthStatus('guest')
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      if (_event === 'SIGNED_OUT') {
        setAuthStatus('guest')
        return
      }
      if (session) {
        setAuthStatus('authed')
      }
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [supabase])
  
  if (isExcludedRoute || isAuthRoute) {
    // Renderizar apenas o conteúdo sem Sidebar/NavBar
    return <>{children}</>
  }
  if (authStatus === 'guest') {
    return <>{children}</>
  }
  if (authStatus === 'loading' && !isProtectedRoute) {
    return <>{children}</>
  }

  // Layout padrão com Sidebar e NavBar
  return (
    <>
      {/* NavBar para mobile e tablet */}
      <div className="lg:hidden">
        <NavBar />
      </div>
      
      {/* Layout com Sidebar (desktop) + Main */}
      <div className="flex min-h-screen bg-[hsl(var(--background))]">
        <Sidebar />
        <main className="flex-1 w-full min-w-0 px-4 py-6 pt-20 sm:px-6 lg:ml-64 lg:px-8 lg:py-8 lg:pt-8 xl:px-12 bg-transparent">
          <div className="mx-auto max-w-7xl space-y-6 lg:space-y-8">
            {children}
          </div>
        </main>
      </div>
    </>
  )
}

