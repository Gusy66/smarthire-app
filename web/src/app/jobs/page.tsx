'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ToastProvider'
import EditJobModal from '@/components/EditJobModal'

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

type JobsListItem = {
  id: string
  title: string
  status: 'open' | 'paused' | 'closed'
  created_at?: string
  applications_count?: number
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
export default function JobsPage() {
  const router = useRouter()
  const { notify } = useToast()
  const [overview, setOverview] = useState<Overview | null>(null)
  const [jobs, setJobs] = useState<JobsListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [editingJobId, setEditingJobId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list')

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

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true)
    const pageSize = 100
    let page = 1
    let allItems: JobsListItem[] = []
    try {
      while (true) {
        const res = await fetch(`/api/jobs?page=${page}&page_size=${pageSize}`, { credentials: 'same-origin' })
        if (!res.ok) break
        const json = await res.json()
        const items = Array.isArray(json?.items) ? json.items : []
        allItems = allItems.concat(items)
        if (items.length < pageSize) break
        page += 1
      }
      setJobs(allItems)
    } catch {
      setJobs([])
    } finally {
      setLoadingJobs(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    
    async function init() {
      setLoading(true)
      await Promise.all([loadOverview(), loadJobs()])
      if (mounted) {
        setLoading(false)
      }
    }
    
    init()
    
    return () => { mounted = false }
  }, [loadOverview, loadJobs])

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta vaga? Essa ação não pode ser desfeita.')) return
    const res = await fetch(`/api/jobs/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const text = await res.text()
      let message = 'Falha ao excluir a vaga'
      try {
        const payload = text ? JSON.parse(text) : null
        message = payload?.error?.message || message
      } catch {}
      notify({ title: 'Erro', description: message, variant: 'error' })
      return
    }
    notify({ title: 'Vaga excluída', variant: 'success' })
    await loadOverview()
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Vagas</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Gerencie todas as vagas em um só lugar</p>
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

      {/* Cards de métricas */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
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

        {/* Total de Vagas */}
        <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-medium text-gray-500 truncate">Total de Vagas</span>
            <svg className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </div>
          <div className="mt-1.5 sm:mt-2 text-2xl sm:text-3xl font-bold text-gray-900">
            {loading || loadingJobs ? '...' : jobs.length}
          </div>
          <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-gray-500">
            Todas as vagas cadastradas
          </div>
        </div>

        {/* Total de Candidatos */}
        <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-medium text-gray-500 truncate">Total de Candidatos</span>
            <svg className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div className="mt-1.5 sm:mt-2 text-2xl sm:text-3xl font-bold text-gray-900">
            {loading ? '...' : overview?.total_candidates ?? 0}
          </div>
          <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-emerald-600">
            +{overview?.candidates_today ?? 0} hoje
          </div>
        </div>
      </div>

      {/* Vagas Recentes (todas as vagas) */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 px-4 sm:px-6 py-3 sm:py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Vagas Recentes</h2>
            <p className="text-xs sm:text-sm text-gray-500">Todas as vagas cadastradas</p>
          </div>
          <div className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 p-1 text-xs sm:text-sm">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-2.5 sm:px-3 py-1 rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Lista
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-2.5 sm:px-3 py-1 rounded-md transition-colors ${
                viewMode === 'cards' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Cards
            </button>
          </div>
        </div>
        {loading || loadingJobs ? (
          <div className="px-4 sm:px-6 py-6 sm:py-8 text-center text-sm text-gray-500">Carregando...</div>
        ) : jobs.length === 0 ? (
          <div className="px-4 sm:px-6 py-6 sm:py-8 text-center text-sm text-gray-500">
            Nenhuma vaga cadastrada ainda
          </div>
        ) : viewMode === 'list' ? (
          <div className="divide-y divide-gray-100">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 transition-colors hover:bg-gray-50 gap-2 sm:gap-4"
              >
                <Link href={`/jobs/${job.id}/stages`} className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm sm:text-base truncate">{job.title}</div>
                  <div className="text-xs sm:text-sm text-gray-500 truncate">
                    {job.applications_count ?? 0} candidato{(job.applications_count ?? 0) !== 1 ? 's' : ''} • {formatRelative(job.created_at)}
                  </div>
                </Link>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                  <span className={`hidden sm:inline-flex items-center rounded-full px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium ${
                    job.status === 'open' 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : job.status === 'closed'
                        ? 'bg-gray-200 text-gray-700'
                        : 'bg-amber-100 text-amber-700'
                  }`}>
                    {job.status === 'open' ? 'Ativa' : job.status === 'closed' ? 'Encerrada' : 'Em Análise'}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingJobId(job.id)
                    }}
                    className="text-gray-400 hover:text-gray-600 p-1"
                    title="Editar"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(job.id)
                    }}
                    className="text-gray-400 hover:text-red-600 p-1"
                    title="Excluir"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 p-4 sm:p-6 sm:grid-cols-2 xl:grid-cols-3">
            {jobs.map((job) => (
              <div key={job.id} className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5 shadow-sm flex flex-col gap-3">
                <Link href={`/jobs/${job.id}/stages`} className="space-y-1 min-w-0">
                  <div className="font-semibold text-gray-900 text-sm sm:text-base truncate">{job.title}</div>
                  <div className="text-xs sm:text-sm text-gray-500 truncate">
                    {job.applications_count ?? 0} candidato{(job.applications_count ?? 0) !== 1 ? 's' : ''} • {formatRelative(job.created_at)}
                  </div>
                </Link>
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] sm:text-xs font-medium ${
                    job.status === 'open' 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : job.status === 'closed'
                        ? 'bg-gray-200 text-gray-700'
                        : 'bg-amber-100 text-amber-700'
                  }`}>
                    {job.status === 'open' ? 'Ativa' : job.status === 'closed' ? 'Encerrada' : 'Em Análise'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingJobId(job.id)}
                      className="text-gray-400 hover:text-gray-600 p-1"
                      title="Editar"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(job.id)}
                      className="text-gray-400 hover:text-red-600 p-1"
                      title="Excluir"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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

      {editingJobId && (
        <EditJobModal
          jobId={editingJobId}
          onClose={() => setEditingJobId(null)}
          onSaved={() => {
            loadOverview()
          }}
        />
      )}
    </div>
  )
}
