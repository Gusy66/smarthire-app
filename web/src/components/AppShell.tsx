'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import NavBar from './NavBar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  
  // Rotas que não devem mostrar o layout principal (Sidebar/NavBar)
  const isExcludedRoute = pathname?.startsWith('/platform')

  useEffect(() => {
    let active = true
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'same-origin' })
        if (!active) return
        setIsAuthenticated(res.ok)
      } catch {
        if (!active) return
        setIsAuthenticated(false)
      }
    }
    checkSession()
    return () => {
      active = false
    }
  }, [])
  
  if (isExcludedRoute || isAuthenticated !== true) {
    // Renderizar apenas o conteúdo sem Sidebar/NavBar
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

