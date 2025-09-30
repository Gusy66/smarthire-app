'use client'

import AuthStatus from '@/components/AuthStatus'

export default function NavBar() {
  return (
    <header className="border-b border-gray-200 sticky top-0 z-30 bg-white/95 backdrop-blur shadow-sm">
      <nav className="container-page h-16 flex items-center justify-between">
        <a href="/" className="font-bold text-2xl text-gradient">
          SmartHire
        </a>
        <div className="flex items-center gap-6">
          <a href="/jobs" className="nav-link">Vagas</a>
          <a href="/candidates" className="nav-link">Candidatos</a>
          <a href="/settings" className="nav-link">Configurações</a>
          <AuthStatus />
        </div>
      </nav>
    </header>
  )
}



