'use client'

import AuthStatus from '@/components/AuthStatus'

export default function Sidebar() {
  return (
    <aside className="hidden md:flex md:flex-col w-64 border-r border-gray-200 bg-white/95 backdrop-blur min-h-screen sticky top-0">
      <div className="h-16 flex items-center px-5 border-b">
        <a href="/" className="font-bold text-2xl text-gradient">SmartHire</a>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        <a href="/dashboard" className="nav-link block">Dashboard</a>
        <a href="/jobs" className="nav-link block">Vagas</a>
        <a href="/candidates" className="nav-link block">Candidatos</a>
        <a href="/settings" className="nav-link block">Configurações</a>
        <a href="/settings/prompts" className="nav-link block">Templates</a>
      </nav>
      <div className="p-4 border-t">
        <AuthStatus />
      </div>
    </aside>
  )
}


