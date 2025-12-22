'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

type Overview = {
  active_jobs: number
  total_candidates: number
  avg_time_days: number
  success_rate: number
  jobs_this_week: number
  candidates_today: number
  recent_jobs: { 
    id: string
    title: string
    status: 'open' | 'closed'
    created_at?: string
    candidate_count: number
  }[]
}

function formatRelative(date?: string): string {
  if (!date) return '—'
  const d = new Date(date)
  const diff = Date.now() - d.getTime()
  const sec = Math.floor(diff / 1000)
  const min = Math.floor(sec / 60)
  const hr = Math.floor(min / 60)
  const day = Math.floor(hr / 24)
  const week = Math.floor(day / 7)
  
  if (week > 0) return `Publicada há ${week} semana${week > 1 ? 's' : ''}`
  if (day > 0) return `Publicada há ${day} dia${day > 1 ? 's' : ''}`
  if (hr > 0) return `Publicada há ${hr} hora${hr > 1 ? 's' : ''}`
  if (min > 0) return `Publicada há ${min} minuto${min > 1 ? 's' : ''}`
  return 'Publicada agora'
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export default function DashboardPage() {
  const [userName, setUserName] = useState<string>('')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)

  const loadUserData = useCallback(async (attempt = 0): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' })
      if (res.status === 401) {
        if (attempt < 3) {
          await delay(500 * (attempt + 1))
          return loadUserData(attempt + 1)
        }
        window.location.href = '/login'
        return false
      }
      if (res.ok) {
        const j = await res.json()
        // Garantir que usamos apenas o nome, nunca o email
        let displayName: string | null = null
        
        // Se temos um nome válido e ele não é igual ao email
        if (typeof j?.name === 'string' && j.name.trim().length > 0) {
          const trimmedName = j.name.trim()
          // Verificar se o nome não é o mesmo que o email
          if (j?.email && trimmedName.toLowerCase() === j.email.toLowerCase()) {
            // Se o nome é igual ao email, não usar
            displayName = null
          } else {
            displayName = trimmedName
          }
        }
        
        setUserName(displayName || 'Usuário')
        return true
      }
      return false
    } catch {
      if (attempt < 3) {
        await delay(500 * (attempt + 1))
        return loadUserData(attempt + 1)
      }
      return false
    }
  }, [])

  const loadOverview = useCallback(async (attempt = 0) => {
    try {
      const res = await fetch('/api/dashboard/overview', { credentials: 'same-origin' })
      if (res.status === 401) {
        if (attempt < 3) {
          await delay(500 * (attempt + 1))
          return loadOverview(attempt + 1)
        }
        return
      }
      if (res.ok) {
        const json = await res.json()
        setOverview(json)
      }
    } catch {
      if (attempt < 3) {
        await delay(500 * (attempt + 1))
        return loadOverview(attempt + 1)
      }
    }
  }, [])

  useEffect(() => {
    let mounted = true
    
    async function init() {
      setLoading(true)
      const success = await loadUserData()
      if (mounted && success) {
        await loadOverview()
      }
      if (mounted) {
        setLoading(false)
      }
    }
    
    init()
    
    return () => { mounted = false }
  }, [loadUserData, loadOverview])

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header com saudação */}
      <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
            Bem-vindo, {userName || 'Usuário'}!
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Aqui está um resumo das suas atividades de recrutamento
          </p>
        </div>
        <Link 
          href="/jobs/new" 
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 sm:px-5 py-2 sm:py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-600 w-full sm:w-auto"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nova Vaga
        </Link>
      </div>

      {/* 4 Cards de métricas */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Vagas Ativas */}
        <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-medium text-gray-500">Vagas Ativas</span>
            <svg className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="mt-1.5 sm:mt-2 text-2xl sm:text-3xl font-bold text-gray-900">
            {loading ? '...' : overview?.active_jobs ?? 0}
          </div>
          <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-gray-500">
            +{overview?.jobs_this_week ?? 0} esta semana
          </div>
        </div>

        {/* Total de Candidatos */}
        <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-medium text-gray-500 truncate">Candidatos</span>
            <svg className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div className="mt-1.5 sm:mt-2 text-2xl sm:text-3xl font-bold text-gray-900">
            {loading ? '...' : overview?.total_candidates ?? 0}
          </div>
          <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-gray-500">
            +{overview?.candidates_today ?? 0} hoje
          </div>
        </div>

        {/* Tempo Médio */}
        <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-medium text-gray-500 truncate">Tempo Médio</span>
            <svg className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="mt-1.5 sm:mt-2 text-2xl sm:text-3xl font-bold text-gray-900">
            {loading ? '...' : `${overview?.avg_time_days ?? 0}d`}
          </div>
          <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-emerald-600">
            Contratação
          </div>
        </div>

        {/* Taxa de Sucesso */}
        <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-medium text-gray-500 truncate">Sucesso</span>
            <svg className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="mt-1.5 sm:mt-2 text-2xl sm:text-3xl font-bold text-gray-900">
            {loading ? '...' : `${overview?.success_rate ?? 0}%`}
          </div>
          <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-emerald-600">
            Preenchidas
          </div>
        </div>
      </div>

      {/* Duas colunas: Vagas Recentes e Análise de Performance */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Vagas Recentes */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 px-4 sm:px-6 py-3 sm:py-4">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Vagas Recentes</h2>
            <p className="text-xs sm:text-sm text-gray-500">Suas vagas mais ativas</p>
          </div>
          <div className="divide-y divide-gray-100">
            {loading ? (
              <div className="px-4 sm:px-6 py-6 sm:py-8 text-center text-sm text-gray-500">Carregando...</div>
            ) : (overview?.recent_jobs?.length ?? 0) === 0 ? (
              <div className="px-4 sm:px-6 py-6 sm:py-8 text-center text-sm text-gray-500">
                Nenhuma vaga cadastrada ainda
              </div>
            ) : (
              overview!.recent_jobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}/stages`}
                  className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 transition-colors hover:bg-gray-50 gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 text-sm sm:text-base truncate">{job.title}</div>
                    <div className="text-xs sm:text-sm text-gray-500 truncate">
                      {job.candidate_count} candidato{job.candidate_count !== 1 ? 's' : ''} • {formatRelative(job.created_at)}
                    </div>
                  </div>
                  <span className={`flex-shrink-0 inline-flex items-center rounded-full px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium ${
                    job.status === 'open' 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {job.status === 'open' ? 'Ativa' : 'Em Análise'}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Análise de Performance */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 px-4 sm:px-6 py-3 sm:py-4">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Análise de Performance</h2>
            <p className="text-xs sm:text-sm text-gray-500">Métricas dos últimos 30 dias</p>
          </div>
          <div className="space-y-4 sm:space-y-5 p-4 sm:p-6">
            {/* Tempo de Triagem */}
            <div>
              <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                <span className="text-xs sm:text-sm text-gray-700">Tempo de Triagem</span>
                <span className="text-xs sm:text-sm font-medium text-emerald-600">-65%</span>
              </div>
              <div className="h-1.5 sm:h-2 w-full rounded-full bg-gray-100">
                <div className="h-1.5 sm:h-2 rounded-full bg-gray-800" style={{ width: '75%' }}></div>
              </div>
            </div>

            {/* Qualidade das Contratações */}
            <div>
              <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                <span className="text-xs sm:text-sm text-gray-700">Qualidade das Contratações</span>
                <span className="text-xs sm:text-sm font-medium text-emerald-600">+42%</span>
              </div>
              <div className="h-1.5 sm:h-2 w-full rounded-full bg-gray-100">
                <div className="h-1.5 sm:h-2 rounded-full bg-emerald-500" style={{ width: '85%' }}></div>
              </div>
            </div>

            {/* Satisfação dos Candidatos */}
            <div>
              <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                <span className="text-xs sm:text-sm text-gray-700">Satisfação dos Candidatos</span>
                <span className="text-xs sm:text-sm font-medium text-gray-600">4.8/5</span>
              </div>
              <div className="h-1.5 sm:h-2 w-full rounded-full bg-gray-100">
                <div className="h-1.5 sm:h-2 rounded-full bg-emerald-500" style={{ width: '96%' }}></div>
              </div>
            </div>

            {/* ROI do Processo */}
            <div>
              <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                <span className="text-xs sm:text-sm text-gray-700">ROI do Processo</span>
                <span className="text-xs sm:text-sm font-medium text-emerald-600">+285%</span>
              </div>
              <div className="h-1.5 sm:h-2 w-full rounded-full bg-gray-100">
                <div className="h-1.5 sm:h-2 rounded-full bg-gray-800" style={{ width: '100%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ações Rápidas */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
        <div className="mb-3 sm:mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Ações Rápidas</h2>
          <p className="text-xs sm:text-sm text-gray-500">Acesse rapidamente as funcionalidades mais usadas</p>
        </div>
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Link
            href="/jobs/new"
            className="flex flex-col items-center justify-center gap-1.5 sm:gap-2 rounded-lg border border-gray-200 bg-white p-4 sm:p-6 text-center transition-colors hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100"
          >
            <svg className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            <span className="font-medium text-gray-700 text-xs sm:text-sm">Nova Vaga</span>
          </Link>

          <Link
            href="/candidates"
            className="flex flex-col items-center justify-center gap-1.5 sm:gap-2 rounded-lg border border-gray-200 bg-white p-4 sm:p-6 text-center transition-colors hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100"
          >
            <svg className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="font-medium text-gray-700 text-xs sm:text-sm">Candidatos</span>
          </Link>

          <Link
            href="/reports"
            className="flex flex-col items-center justify-center gap-1.5 sm:gap-2 rounded-lg border border-gray-200 bg-white p-4 sm:p-6 text-center transition-colors hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100"
          >
            <svg className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="font-medium text-gray-700 text-xs sm:text-sm">Relatórios</span>
          </Link>

          <button
            onClick={() => {
              alert('Funcionalidade em desenvolvimento')
            }}
            className="flex flex-col items-center justify-center gap-1.5 sm:gap-2 rounded-lg border border-gray-200 bg-white p-4 sm:p-6 text-center transition-colors hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100"
          >
            <svg className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="font-medium text-gray-700 text-xs sm:text-sm">Exportar</span>
          </button>
        </div>
      </div>
    </div>
  )
}
