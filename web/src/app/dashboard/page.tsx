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
    <div className="space-y-6">
      {/* Boas-vindas */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Bem-vindo, {userName}!</h1>
          <p className="text-gray-600">Aqui está um resumo das suas atividades de recrutamento</p>
        </div>
        <a href="/jobs" className="btn btn-primary">+ Nova Vaga</a>
      </div>

      {/* Cards principais */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-8">
          <div className="text-sm text-gray-600">Vagas criadas por você</div>
          <div className="text-4xl font-semibold mt-2">{overview?.jobs_created_by_user ?? (loading ? '…' : 0)}</div>
          <div className="text-xs text-gray-500 mt-1">últimos 90 dias</div>
        </div>
        <div className="card p-8">
          <div className="text-sm text-gray-600">Candidatos cadastrados por você</div>
          <div className="text-4xl font-semibold mt-2">{overview?.candidates_created_by_user ?? (loading ? '…' : 0)}</div>
          <div className="text-xs text-gray-500 mt-1">contagem total</div>
        </div>
      </div>

      {/* Vagas Recentes */}
      <div className="card p-0">
        <div className="px-6 py-5 border-b">
          <h2 className="text-lg font-semibold">Vagas Recentes</h2>
          <div className="text-xs text-gray-500">Suas vagas mais ativas</div>
        </div>
        <div className="p-6 space-y-4">
          {(overview?.recent_jobs?.length ?? 0) === 0 ? (
            <div className="text-gray-600 text-sm">Nenhuma vaga recente</div>
          ) : (
            overview!.recent_jobs.map((j) => (
              <a key={j.id} href={`/jobs/${j.id}/stages`} className="block border rounded-xl px-5 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{j.title}</div>
                    <div className="text-xs text-gray-600">Publicada {formatRelative(j.created_at)}</div>
                  </div>
                  <span className={`badge ${j.status === 'open' ? 'badge-success' : 'badge-warning'}`}>{j.status === 'open' ? 'Ativa' : 'Fechada'}</span>
                </div>
              </a>
            ))
          )}
        </div>
      </div>

      {/* Ações Rápidas */}
      <div className="card p-8">
        <h3 className="text-xl font-semibold mb-5">Ações Rápidas</h3>
        <div className="grid md:grid-cols-3 gap-5">
          <a href="/jobs" className="border rounded-xl p-7 hover:bg-gray-50 transition-colors flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center">+
            </div>
            <div>
              <div className="font-medium">Nova Vaga</div>
              <div className="text-xs text-gray-600">Crie uma nova posição</div>
            </div>
          </a>
          <a href="/candidates" className="border rounded-xl p-7 hover:bg-gray-50 transition-colors flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <div>
              <div className="font-medium">Buscar Candidatos</div>
              <div className="text-xs text-gray-600">Gerencie o pipeline</div>
            </div>
          </a>
          <a href="/reports" className="border rounded-xl p-7 hover:bg-gray-50 transition-colors flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/></svg>
            </div>
            <div>
              <div className="font-medium">Relatórios</div>
              <div className="text-xs text-gray-600">Resumo de vagas e candidatos</div>
            </div>
          </a>
        </div>
      </div>
    </div>
  )
}


