'use client'

import Image from 'next/image'
import { usePathname } from 'next/navigation'
import AuthStatus from '@/components/AuthStatus'

export default function Sidebar() {
  const pathname = usePathname()
  if (pathname?.startsWith('/jobs/new')) {
    return null
  }
  return (
    <aside className="hidden md:flex md:flex-col w-64 border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-background))]/95 text-[hsl(var(--sidebar-foreground))] backdrop-blur-md min-h-screen sticky top-0 shadow-[18px_0_45px_-40px_rgba(15,23,42,0.3)]">
      <div className="h-16 flex items-center px-5 border-b border-[hsl(var(--sidebar-border))]">
        <a href="/" className="font-semibold text-xl tracking-tight text-gradient flex items-center gap-2">
          <span>SmartHire</span>
          <Image src="/cerebro.png" alt="Ícone" width={24} height={24} />
        </a>
      </div>
      <nav className="flex-1 px-4 py-6 space-y-1 text-sm">
        <a
          href="/dashboard"
          className={`nav-link block ${pathname === '/dashboard' ? 'bg-[hsl(var(--sidebar-primary)_/_0.15)] text-[hsl(var(--sidebar-primary))]' : ''}`}
        >
          Dashboard
        </a>
        <a
          href="/jobs"
          className={`nav-link block ${pathname?.startsWith('/jobs') ? 'bg-[hsl(var(--sidebar-primary)_/_0.15)] text-[hsl(var(--sidebar-primary))]' : ''}`}
        >
          Vagas
        </a>
        <a
          href="/candidates"
          className={`nav-link block ${pathname?.startsWith('/candidates') ? 'bg-[hsl(var(--sidebar-primary)_/_0.15)] text-[hsl(var(--sidebar-primary))]' : ''}`}
        >
          Candidatos
        </a>
        <a
          href="/settings"
          className={`nav-link block ${pathname?.startsWith('/settings') && !pathname?.includes('/settings/prompts') ? 'bg-[hsl(var(--sidebar-primary)_/_0.15)] text-[hsl(var(--sidebar-primary))]' : ''}`}
        >
          Configurações
        </a>
        <a
          href="/settings/prompts"
          className={`nav-link block ${pathname?.startsWith('/settings/prompts') ? 'bg-[hsl(var(--sidebar-primary)_/_0.15)] text-[hsl(var(--sidebar-primary))]' : ''}`}
        >
          Templates
        </a>
      </nav>
      <div className="p-4 border-t border-[hsl(var(--sidebar-border))]">
        <AuthStatus />
      </div>
    </aside>
  )
}


