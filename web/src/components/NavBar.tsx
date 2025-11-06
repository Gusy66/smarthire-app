'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import AuthStatus from '@/components/AuthStatus'

const links = [
  { href: '/jobs', label: 'Vagas' },
  { href: '/candidates', label: 'Candidatos' },
  { href: '/settings', label: 'Configurações' },
  { href: '/settings/prompts', label: 'Templates' },
]

export default function NavBar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <>
      <header className="full-bleed border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[120rem] items-center justify-between px-6 md:px-12 lg:px-20">
          <a href="/" className="text-2xl font-bold text-gradient">
            SmartHire
          </a>
          <div className="hidden items-center gap-6 md:flex">
            {links.map((link) => (
              <a key={link.href} href={link.href} className="nav-link">
                {link.label}
              </a>
            ))}
            <AuthStatus />
          </div>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-50 md:hidden"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Abrir menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </header>
      {mobileOpen && (
        <div className="full-bleed border-b border-gray-200 bg-white shadow-sm md:hidden">
          <div className="mx-auto flex w-full max-w-[120rem] flex-col gap-4 px-6 py-4">
            {links.map((link) => (
              <a key={link.href} href={link.href} className="text-sm font-medium text-gray-700 transition hover:text-gray-900">
                {link.label}
              </a>
            ))}
            <div className="border-t border-gray-200 pt-4">
              <AuthStatus variant="mobile" />
            </div>
          </div>
        </div>
      )}
    </>
  )
}



