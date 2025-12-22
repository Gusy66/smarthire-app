'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import AuthStatus from '@/components/AuthStatus'

const links = [
  { 
    href: '/dashboard', 
    label: 'Dashboard',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor"/>
        <rect x="13" y="3" width="8" height="8" rx="2" fill="currentColor"/>
        <rect x="3" y="13" width="8" height="8" rx="2" fill="currentColor"/>
        <rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor"/>
      </svg>
    )
  },
  { 
    href: '/jobs', 
    label: 'Vagas',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20 6h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 0h-4V4h4v2z"/>
      </svg>
    )
  },
  { 
    href: '/candidates', 
    label: 'Candidatos',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="9" cy="7" r="3" fill="currentColor"/>
        <path d="M9 12c-2.5 0-7 1.2-7 3.5V18h14v-2.5c0-2.3-4.5-3.5-7-3.5z"/>
        <circle cx="17" cy="7" r="2" fill="currentColor"/>
        <path d="M17 11c-1.5 0-4 .7-4 2v2h8v-2c0-1.3-2.5-2-4-2z"/>
      </svg>
    )
  },
  { 
    href: '/settings', 
    label: 'Configurações',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    )
  },
  { 
    href: '/settings/prompts', 
    label: 'Templates',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <rect x="5" y="4" width="14" height="16" rx="2" fill="currentColor"/>
        <rect x="7" y="7" width="10" height="1.5" rx="0.5" fill="white"/>
        <rect x="7" y="10" width="8" height="1.5" rx="0.5" fill="white"/>
        <rect x="7" y="13" width="6" height="1.5" rx="0.5" fill="white"/>
      </svg>
    )
  },
]

export default function NavBar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Fechar menu ao redimensionar para desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Prevenir scroll quando menu está aberto
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    if (href === '/settings/prompts') return pathname?.startsWith('/settings/prompts')
    if (href === '/settings') return pathname?.startsWith('/settings') && !pathname?.includes('/settings/prompts')
    return pathname?.startsWith(href)
  }

  return (
    <>
      {/* Header fixo */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-sm shadow-sm">
        <div className="flex h-14 sm:h-16 items-center justify-between px-4 sm:px-6">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2">
            <svg className="w-8 h-8 sm:w-10 sm:h-10" viewBox="0 0 48 48" fill="none">
              <rect x="6" y="8" width="36" height="28" rx="3" fill="#14B8A6" />
              <rect x="8" y="10" width="32" height="24" rx="2" fill="#0D9488" />
              <rect x="20" y="36" width="8" height="4" rx="1" fill="#14B8A6" />
              <rect x="18" y="40" width="12" height="2" rx="1" fill="#14B8A6" />
              <circle cx="24" cy="22" r="6" fill="#EC4899" />
              <circle cx="21" cy="20" r="2.5" fill="#F472B6" />
              <circle cx="27" cy="20" r="2.5" fill="#F472B6" />
            </svg>
            <span className="text-lg sm:text-xl font-bold text-gray-800">SmartHire</span>
          </Link>

          {/* Botão do menu hamburguer */}
          <button
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 active:bg-gray-100"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Overlay escuro */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Menu deslizante */}
      <div 
        className={`fixed top-14 sm:top-16 right-0 bottom-0 z-50 w-full max-w-xs bg-white shadow-xl transform transition-transform duration-300 ease-in-out lg:hidden ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <nav className="flex flex-col h-full">
          {/* Links de navegação */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
            {links.map((link) => {
              const active = isActive(link.href)
              return (
                <Link
                key={link.href}
                href={link.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    active
                      ? 'bg-emerald-50 text-emerald-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 active:bg-gray-100'
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className={active ? 'text-emerald-600' : 'text-gray-400'}>
                    {link.icon}
                  </span>
                  <span className="text-base">{link.label}</span>
                </Link>
              )
            })}
          </div>

          {/* Footer com logout */}
          <div className="border-t border-gray-200 p-4">
              <AuthStatus variant="mobile" />
          </div>
        </nav>
        </div>
    </>
  )
}



