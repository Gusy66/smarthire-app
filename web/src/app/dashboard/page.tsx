'use client'

import { useEffect, useMemo, useState } from 'react'

type Overview = {
  jobs_created_by_user: number
  candidates_created_by_user: number
  recent_jobs: { id: string; title: string; status: 'open' | 'closed'; created_at?: string }[]
}

function formatRelative(date?: string): string {
  if (!date) return '—'
  const d = new Date(date)
  const diff = Date.now() - d.getTime()
  const sec = Math.floor(diff / 1000)
  const min = Math.floor(sec / 60)
  const hr = Math.floor(min / 60)
  const day = Math.floor(hr / 24)
  if (day > 0) return `há ${day} dia${day > 1 ? 's' : ''}`
  if (hr > 0) return `há ${hr} hora${hr > 1 ? 's' : ''}`
  if (min > 0) return `há ${min} minuto${min > 1 ? 's' : ''}`
  return 'agora'
}

export default function DashboardPage() {
  const [userName, setUserName] = useState<string>('')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then((r) => r.ok ? r.json() : null)
      .then((j) => {
        const preferred = (typeof j?.name === 'string' && j.name.trim().length > 0) ? j.name.trim() : null
        setUserName(preferred || 'Usuário')
      })
      .catch(() => setUserName('Usuário'))
  }, [])

  async function loadOverview() {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/overview', { credentials: 'same-origin' })
      if (res.ok) {
        const json = await res.json()
        setOverview(json)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadOverview() }, [])

  return (
    <div className="space-y-8">
      {/* Boas-vindas */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/95 p-6 shadow-[0_24px_60px_-35px_rgba(15,23,42,0.45)] md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-[hsl(var(--foreground))]">
            Bem-vindo, {userName}!
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Aqui está um resumo das suas atividades de recrutamento
          </p>
        </div>
        <a href="/jobs" className="btn btn-primary whitespace-nowrap px-6 py-3">
          + Nova Vaga
        </a>
      </div>

      {/* Cards principais */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="card border border-[hsl(var(--border))] p-6 sm:p-7">
          <div className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
            Vagas criadas por você
          </div>
          <div className="mt-2 text-4xl font-semibold tracking-tight text-[hsl(var(--foreground))]">
            {overview?.jobs_created_by_user ?? (loading ? '…' : 0)}
          </div>
          <div className="mt-1 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            últimos 90 dias
          </div>
        </div>
        <div className="card border border-[hsl(var(--border))] p-6 sm:p-7">
          <div className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
            Candidatos cadastrados por você
          </div>
          <div className="mt-2 text-4xl font-semibold tracking-tight text-[hsl(var(--foreground))]">
            {overview?.candidates_created_by_user ?? (loading ? '…' : 0)}
          </div>
          <div className="mt-1 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            contagem total
          </div>
        </div>
      </div>

      {/* Vagas Recentes */}
      <div className="card overflow-hidden border border-[hsl(var(--border))] p-0">
        <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-5">
          <h2 className="text-lg font-semibold tracking-tight text-[hsl(var(--foreground))]">
            Vagas Recentes
          </h2>
          <div className="text-sm text-[hsl(var(--muted-foreground))]">Suas vagas mais ativas</div>
        </div>
        <div className="p-6 space-y-4">
          {(overview?.recent_jobs?.length ?? 0) === 0 ? (
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Nenhuma vaga recente</div>
          ) : (
            overview!.recent_jobs.map((j) => (
              <a
                key={j.id}
                href={`/jobs/${j.id}/stages`}
                className="block rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-5 py-4 transition hover:border-[hsl(var(--ring))] hover:bg-[hsl(var(--muted))]"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-[hsl(var(--foreground))]">{j.title}</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      Publicada {formatRelative(j.created_at)}
                    </div>
                  </div>
                  <span className={`badge ${j.status === 'open' ? 'badge-success' : 'badge-warning'}`}>
                    {j.status === 'open' ? 'Ativa' : 'Fechada'}
                  </span>
                </div>
              </a>
            ))
          )}
        </div>
      </div>

      {/* Ações Rápidas */}
      <div className="card border border-[hsl(var(--border))] p-6 sm:p-7">
        <h3 className="mb-4 text-xl font-semibold tracking-tight text-[hsl(var(--foreground))]">
          Ações Rápidas
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          <a
            href="/jobs"
            className="group flex items-center gap-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-6 transition hover:-translate-y-1 hover:border-[hsl(var(--ring))] hover:bg-[hsl(var(--muted))]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(16,185,129,0.14)] text-[hsl(var(--primary))] shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)]">
              +
            </div>
            <div>
              <div className="font-medium text-[hsl(var(--foreground))]">Nova Vaga</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">Crie uma nova posição</div>
            </div>
          </a>
          <a
            href="/candidates"
            className="group flex items-center gap-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-6 transition hover:-translate-y-1 hover:border-[hsl(var(--ring))] hover:bg-[hsl(var(--muted))]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(59,130,246,0.14)] text-[#2563eb] shadow-[inset_0_0_0_1px_rgba(59,130,246,0.22)]">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <div>
              <div className="font-medium text-[hsl(var(--foreground))]">Buscar Candidatos</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">Gerencie o pipeline</div>
            </div>
          </a>
          <a
            href="/reports"
            className="group flex items-center gap-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-6 transition hover:-translate-y-1 hover:border-[hsl(var(--ring))] hover:bg-[hsl(var(--muted))]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(236,72,153,0.16)] text-[#db2777] shadow-[inset_0_0_0_1px_rgba(236,72,153,0.24)]">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/></svg>
            </div>
            <div>
              <div className="font-medium text-[hsl(var(--foreground))]">Relatórios</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">Resumo de vagas e candidatos</div>
            </div>
          </a>
        </div>
      </div>
    </div>
  )
}


