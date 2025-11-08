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
      <header className="full-bleed border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/85 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.55)] backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 md:px-8 lg:px-12">
          <a href="/" className="text-2xl font-semibold tracking-tight text-gradient">
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
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--muted))] md:hidden"
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
        <div className="full-bleed border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-[0_20px_50px_-35px_rgba(15,23,42,0.5)] md:hidden">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-[hsl(var(--muted-foreground))] transition hover:text-[hsl(var(--foreground))]"
              >
                {link.label}
              </a>
            ))}
            <div className="border-t border-[hsl(var(--border))] pt-4">
              <AuthStatus variant="mobile" />
            </div>
          </div>
        </div>
      )}
    </>
  )
}



