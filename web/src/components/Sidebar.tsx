'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import AuthStatus from '@/components/AuthStatus'

export default function Sidebar() {
  const pathname = usePathname()
  
  // Não mostrar sidebar na página de criação de vaga
  if (pathname?.startsWith('/jobs/new')) {
    return null
  }

  const navItems = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: (
        <svg className="w-6 h-6 lg:w-7 lg:h-7" fill="currentColor" viewBox="0 0 24 24">
          <rect x="3" y="3" width="8" height="8" rx="2.5" fill="currentColor"/>
          <rect x="13" y="3" width="8" height="8" rx="2.5" fill="currentColor"/>
          <rect x="3" y="13" width="8" height="8" rx="2.5" fill="currentColor"/>
          <rect x="13" y="13" width="8" height="8" rx="2.5" fill="currentColor"/>
        </svg>
      ),
      isActive: pathname === '/dashboard',
    },
    {
      href: '/jobs',
      label: 'Vagas',
      icon: (
        <svg className="w-6 h-6 lg:w-7 lg:h-7" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20 6h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 0h-4V4h4v2zm4 14H6V10h12v10zm-3-6h-2v-2h-2v2H9v2h2v2h2v-2h2v-2z" fillRule="evenodd" clipRule="evenodd"/>
        </svg>
      ),
      isActive: pathname?.startsWith('/jobs') && pathname !== '/jobs/new',
    },
    {
      href: '/candidates',
      label: 'Candidatos',
      icon: (
        <svg className="w-6 h-6 lg:w-7 lg:h-7" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="9" cy="7" r="3.5" fill="currentColor"/>
          <path d="M9 13c-2.5 0-7 1.2-7 3.5V20h14v-3.5c0-2.3-4.5-3.5-7-3.5z" fillRule="evenodd" clipRule="evenodd"/>
          <circle cx="18" cy="7" r="2.5" fill="currentColor"/>
          <path d="M18 12c-1.5 0-4 .7-4 2v2h8v-2c0-1.3-2.5-2-4-2z" fillRule="evenodd" clipRule="evenodd"/>
        </svg>
      ),
      isActive: pathname?.startsWith('/candidates'),
    },
    {
      href: '/usuarios',
      label: 'Usuários',
      icon: (
        <svg className="w-6 h-6 lg:w-7 lg:h-7" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          <circle cx="18" cy="6" r="2" fill="currentColor"/>
          <path d="M18 9c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2z" opacity="0.5"/>
        </svg>
      ),
      isActive: pathname?.startsWith('/usuarios'),
    },
    {
      href: '/settings',
      label: 'Configurações',
      icon: (
        <svg className="w-6 h-6 lg:w-7 lg:h-7" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="2.5" fill="currentColor"/>
          <path d="M12 2l2.5 5.5L20 8.5l-4 4 1 6L12 17l-5 1.5 1-6-4-4 5.5-1L12 2z" fillRule="evenodd" clipRule="evenodd" opacity="0.4"/>
        </svg>
      ),
      isActive: pathname?.startsWith('/settings') && !pathname?.includes('/settings/prompts'),
    },
    {
      href: '/settings/prompts',
      label: 'Templates',
      icon: (
        <svg className="w-6 h-6 lg:w-7 lg:h-7" fill="currentColor" viewBox="0 0 24 24">
          <rect x="5" y="4" width="14" height="16" rx="2.5" fill="currentColor"/>
          <rect x="7" y="7" width="10" height="1.5" rx="0.75" fill="white"/>
          <rect x="7" y="10" width="8" height="1.5" rx="0.75" fill="white"/>
          <rect x="7" y="13" width="6" height="1.5" rx="0.75" fill="white"/>
          <path d="M12 16l3-2v4l-3-2z" fill="white"/>
        </svg>
      ),
      isActive: pathname?.startsWith('/settings/prompts'),
    },
  ]

  return (
    <aside 
      className="hidden lg:flex lg:flex-col w-64 bg-white border-r border-gray-200 h-screen fixed left-0 top-0 z-40" 
      style={{ fontFamily: 'Arial, sans-serif' }}
    >
      {/* Header com Logo */}
      <div className="h-16 lg:h-20 flex items-center px-4 lg:px-6 border-b border-gray-200 flex-shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2 lg:gap-3">
          {/* Monitor verde-água com cérebro rosa */}
          <div className="relative flex-shrink-0">
            <svg className="w-10 h-10 lg:w-12 lg:h-12" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Monitor verde-água (teal) */}
              <rect x="6" y="8" width="36" height="28" rx="3" fill="#14B8A6" />
              <rect x="8" y="10" width="32" height="24" rx="2" fill="#0D9488" />
              {/* Base do monitor */}
              <rect x="20" y="36" width="8" height="4" rx="1" fill="#14B8A6" />
              <rect x="18" y="40" width="12" height="2" rx="1" fill="#14B8A6" />
              {/* Cérebro rosa no centro da tela */}
              <circle cx="24" cy="22" r="6" fill="#EC4899" />
              <circle cx="21" cy="20" r="2.5" fill="#F472B6" />
              <circle cx="27" cy="20" r="2.5" fill="#F472B6" />
              <path d="M20 24C20 25.5 21.5 27 24 27C26.5 27 28 25.5 28 24" stroke="#F472B6" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <span className="font-bold text-lg lg:text-xl text-gray-800" style={{ fontFamily: 'Arial, sans-serif' }}>SmartHire</span>
        </Link>
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-3 lg:px-4 py-4 lg:py-6 space-y-1 lg:space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-2.5 lg:py-3 rounded-lg transition-colors ${
              item.isActive
                ? 'bg-emerald-50 text-emerald-700 font-medium'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
            style={{ fontFamily: 'Arial, sans-serif', fontSize: '15px' }}
          >
            <span className={`flex-shrink-0 ${item.isActive ? 'text-emerald-600' : 'text-gray-500'}`}>
              {item.icon}
            </span>
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Footer com botão de sair */}
      <div className="p-3 lg:p-4 border-t border-gray-200 flex-shrink-0">
        <AuthStatus />
      </div>
    </aside>
  )
}
