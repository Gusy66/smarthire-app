'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ToastProvider'

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

type RankingItem = {
  candidate: { id: string; name: string; email?: string }
  job: { id: string; title: string }
  currentStage: string
  averageScore: number
}

type JobDetail = {
  id: string
  title: string
  department: string
  location: string
  salary: string
  work_model: string
  contract_type: string
  description: string
  job_description: string
  responsibilities: string
  requirements_and_skills: string
  work_schedule: string
  travel_availability: string
  observations: string
  requirements: string[]
  skills: string[]
  benefits: string[]
  status: 'open' | 'paused' | 'closed'
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

type EditJobModalProps = {
  jobId: string | null
  onClose: () => void
  onSaved: () => void
}

function EditJobModal({ jobId, onClose, onSaved }: EditJobModalProps) {
  const { notify } = useToast()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<JobDetail | null>(null)
  const [reqInput, setReqInput] = useState('')
  const [skillInput, setSkillInput] = useState('')
  const [benefitInput, setBenefitInput] = useState('')

  useEffect(() => {
    if (!jobId) return
    setLoading(true)
    fetch(`/api/jobs/${jobId}`)
      .then((res) => res.json())
      .then((json) => {
        if (json?.item) {
          const item = json.item as Partial<JobDetail>
          setForm({
            id: jobId,
            title: item.title || '',
            department: item.department || '',
            location: item.location || '',
            salary: item.salary || '',
            work_model: item.work_model || '',
            contract_type: item.contract_type || '',
            description: item.description || '',
            job_description: item.job_description || '',
            responsibilities: item.responsibilities || '',
            requirements_and_skills: item.requirements_and_skills || '',
            work_schedule: item.work_schedule || '',
            travel_availability: item.travel_availability || '',
            observations: item.observations || '',
            requirements: Array.isArray(item.requirements) ? item.requirements : [],
            skills: Array.isArray(item.skills) ? item.skills : [],
            benefits: Array.isArray(item.benefits) ? item.benefits : [],
            status: (item.status as JobDetail['status']) || 'open',
          })
        }
      })
      .catch(() => {
        notify({ title: 'Erro', description: 'Não foi possível carregar os dados da vaga.', variant: 'error' })
        onClose()
      })
      .finally(() => setLoading(false))
  }, [jobId, notify, onClose])

  if (!jobId || !form) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const payload = {
      title: form.title,
      department: form.department,
      location: form.location,
      salary: form.salary,
      work_model: form.work_model,
      contract_type: form.contract_type,
      description: form.description,
      job_description: form.job_description,
      responsibilities: form.responsibilities,
      requirements_and_skills: form.requirements_and_skills,
      work_schedule: form.work_schedule,
      travel_availability: form.travel_availability,
      observations: form.observations,
      requirements: form.requirements,
      skills: form.skills,
      benefits: form.benefits,
      status: form.status,
    }
    const res = await fetch(`/api/jobs/${jobId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSubmitting(false)
    if (!res.ok) {
      const text = await res.text()
      let message = 'Falha ao atualizar a vaga'
      try {
        const payloadErr = text ? JSON.parse(text) : null
        message = payloadErr?.error?.message || message
      } catch {}
      notify({ title: 'Erro', description: message, variant: 'error' })
      return
    }
    notify({ title: 'Vaga atualizada', variant: 'success' })
    onSaved()
    onClose()
  }

  const addChip = (type: 'requirements' | 'skills' | 'benefits', value: string) => {
    if (!value.trim()) return
    setForm((prev) => (prev ? { ...prev, [type]: [...prev[type], value.trim()] } : prev))
  }

  const removeChip = (type: 'requirements' | 'skills' | 'benefits', index: number) => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            [type]: prev[type].filter((_, idx) => idx !== index),
          }
        : prev
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-2 sm:px-4">
      <div className="relative w-full max-w-4xl rounded-xl sm:rounded-2xl bg-white shadow-xl max-h-[95vh] sm:max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Editar Vaga</h2>
            <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Atualize as informações da vaga e salve as alterações</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 p-1" aria-label="Fechar">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
          {loading ? (
            <div className="py-20 text-center text-sm text-gray-500">Carregando detalhes da vaga...</div>
          ) : (
            <>
              <section className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2 flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">Título da Vaga *</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900/40 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">Departamento *</label>
                  <input
                    value={form.department}
                    onChange={(e) => setForm((prev) => (prev ? { ...prev, department: e.target.value } : prev))}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900/40 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((prev) => (prev ? { ...prev, status: e.target.value as JobDetail['status'] } : prev))}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-gray-900/40 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                  >
                    <option value="open">Ativa</option>
                    <option value="paused">Pausada</option>
                    <option value="closed">Encerrada</option>
                  </select>
                </div>
              </section>
              <div className="flex items-center justify-end gap-2 pt-4">
                <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-60"
                >
                  {submitting ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  )
}

export default function JobsPage() {
  const router = useRouter()
  const { notify } = useToast()
  const [overview, setOverview] = useState<Overview | null>(null)
  const [ranking, setRanking] = useState<RankingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingRanking, setLoadingRanking] = useState(true)
  const [editingJobId, setEditingJobId] = useState<string | null>(null)

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

  const loadRanking = useCallback(async () => {
    setLoadingRanking(true)
    try {
      const res = await fetch('/api/dashboard/ranking', { credentials: 'same-origin' })
      if (res.ok) {
        const json = await res.json()
        setRanking(json.items || [])
      }
    } catch {
      setRanking([])
    } finally {
      setLoadingRanking(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    
    async function init() {
      setLoading(true)
      await Promise.all([loadOverview(), loadRanking()])
      if (mounted) {
        setLoading(false)
      }
    }
    
    init()
    
    return () => { mounted = false }
  }, [loadOverview, loadRanking])

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
                <div
                  key={job.id}
                  className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 transition-colors hover:bg-gray-50 gap-2 sm:gap-4"
                >
                  <Link href={`/jobs/${job.id}/stages`} className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm sm:text-base truncate">{job.title}</div>
                    <div className="text-xs sm:text-sm text-gray-500 truncate">
                      {job.candidate_count} candidato{job.candidate_count !== 1 ? 's' : ''} • {formatRelative(job.created_at)}
                    </div>
                  </Link>
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                    <span className={`hidden sm:inline-flex items-center rounded-full px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium ${
                      job.status === 'open' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {job.status === 'open' ? 'Ativa' : 'Em Análise'}
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

      {/* Ranking de Candidatos */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 px-4 sm:px-6 py-3 sm:py-4">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Ranking de Candidatos</h2>
          <p className="text-xs sm:text-sm text-gray-500">Top candidatos ordenados por pontuação</p>
        </div>
        <div className="p-4 sm:p-6">
          {loadingRanking ? (
            <div className="text-center py-6 sm:py-8 text-sm text-gray-500">Carregando ranking...</div>
          ) : ranking.length === 0 ? (
            <div className="text-center py-6 sm:py-8 text-gray-500">
              <p className="text-sm">Nenhum candidato com pontuação ainda.</p>
              <p className="text-xs sm:text-sm mt-1">Analise candidatos com IA para ver o ranking aqui.</p>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {ranking.map((item, index) => {
                const position = index + 1
                const scorePercent = Math.min((item.averageScore / 10) * 100, 100)
                
                const getBadgeStyle = (pos: number) => {
                  if (pos === 1) return 'bg-yellow-400 text-yellow-900'
                  if (pos === 2) return 'bg-gray-300 text-gray-800'
                  if (pos === 3) return 'bg-orange-300 text-orange-900'
                  return 'bg-gray-100 text-gray-600'
                }
                
                return (
                  <Link
                    key={`${item.candidate.id}-${item.job.id}`}
                    href={`/jobs/${item.job.id}/stages`}
                    className="flex items-center gap-2 sm:gap-4 rounded-lg border border-gray-100 bg-white p-3 sm:p-4 transition hover:border-gray-300 hover:shadow-sm active:bg-gray-50"
                  >
                    <div className={`flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full text-xs sm:text-sm font-bold flex-shrink-0 ${getBadgeStyle(position)}`}>
                      {position}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm sm:text-base truncate">{item.candidate.name}</div>
                      <div className="text-xs sm:text-sm text-gray-500 truncate">
                        {item.job.title} • {item.currentStage}
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-0.5 sm:gap-1 w-14 sm:w-20 flex-shrink-0">
                      <span className="text-lg sm:text-xl font-bold text-blue-600">
                        {item.averageScore.toFixed(1)}
                      </span>
                      <div className="w-full h-1 sm:h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-600 rounded-full"
                          style={{ width: `${scorePercent}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
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
