'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ToastProvider'

type Job = {
  id: string
  title: string
  description?: string
  department?: string
  location?: string
  status: 'open' | 'paused' | 'closed'
  applications_count?: number
  created_at?: string
  salary?: string
}

type JobStats = { total_jobs: number; active_jobs: number; total_candidates: number }

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

type EditJobModalProps = {
  jobId: string | null
  onClose: () => void
  onSaved: () => void
}

const statusLabels: Record<Job['status'], string> = {
  open: 'Ativa',
  paused: 'Pausada',
  closed: 'Encerrada',
}

const statusBadgeClasses: Record<Job['status'], string> = {
  open: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  closed: 'bg-gray-100 text-gray-600',
}

function formatDate(date?: string) {
  if (!date) return '—'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
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
            status: (item.status as Job['status']) || 'open',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Editar Vaga</h2>
            <p className="text-sm text-gray-500">Atualize as informações da vaga e salve as alterações</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800" aria-label="Fechar">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto px-6 py-6 space-y-6">
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
                  <label className="text-sm font-medium text-gray-700">Localização</label>
                  <input
                    value={form.location}
                    onChange={(e) => setForm((prev) => (prev ? { ...prev, location: e.target.value } : prev))}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900/40 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                    placeholder="Ex: São Paulo - SP"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((prev) => (prev ? { ...prev, status: e.target.value as Job['status'] } : prev))}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-gray-900/40 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                  >
                    <option value="open">Ativa</option>
                    <option value="paused">Pausada</option>
                    <option value="closed">Encerrada</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">Faixa Salarial</label>
                  <input
                    value={form.salary}
                    onChange={(e) => setForm((prev) => (prev ? { ...prev, salary: e.target.value } : prev))}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900/40 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                    placeholder="Ex: R$ 8.000 - R$ 12.000"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">Modelo de Trabalho</label>
                  <input
                    value={form.work_model}
                    onChange={(e) => setForm((prev) => (prev ? { ...prev, work_model: e.target.value } : prev))}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900/40 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                    placeholder="Ex: Home Office"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">Tipo de Contrato</label>
                  <input
                    value={form.contract_type}
                    onChange={(e) => setForm((prev) => (prev ? { ...prev, contract_type: e.target.value } : prev))}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900/40 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                    placeholder="Ex: CLT"
                  />
                </div>
                <div className="md:col-span-2 flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">Descrição Geral</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm h-24 resize-none focus:border-gray-900/40 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                  />
                </div>
              </section>

              <section className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700">Descrição do Cargo</label>
                    <textarea
                      value={form.job_description}
                      onChange={(e) => setForm((prev) => (prev ? { ...prev, job_description: e.target.value } : prev))}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700">Responsabilidades e Atribuições</label>
                    <textarea
                      value={form.responsibilities}
                      onChange={(e) => setForm((prev) => (prev ? { ...prev, responsibilities: e.target.value } : prev))}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40"
                    />
                  </div>
                  <div className="lg:col-span-2 flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700">Requisitos e Habilidades</label>
                    <textarea
                      value={form.requirements_and_skills}
                      onChange={(e) => setForm((prev) => (prev ? { ...prev, requirements_and_skills: e.target.value } : prev))}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40"
                    />
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Requisitos (lista)</label>
                    <div className="flex items-center gap-2">
                      <input
                        value={reqInput}
                        onChange={(e) => setReqInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addChip('requirements', reqInput)
                            setReqInput('')
                          }
                        }}
                        placeholder="Digite e pressione Enter"
                        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40"
                      />
                      <button type="button" onClick={() => { addChip('requirements', reqInput); setReqInput('') }} className="px-3 py-2 text-xs font-semibold text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
                        Adicionar
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {form.requirements.map((req, idx) => (
                        <span key={idx} className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                          {req}
                          <button type="button" onClick={() => removeChip('requirements', idx)} className="text-gray-500 hover:text-gray-700">×</button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Habilidades</label>
                    <div className="flex items-center gap-2">
                      <input
                        value={skillInput}
                        onChange={(e) => setSkillInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addChip('skills', skillInput)
                            setSkillInput('')
                          }
                        }}
                        placeholder="Digite e pressione Enter"
                        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40"
                      />
                      <button type="button" onClick={() => { addChip('skills', skillInput); setSkillInput('') }} className="px-3 py-2 text-xs font-semibold text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
                        Adicionar
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {form.skills.map((skill, idx) => (
                        <span key={idx} className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700">
                          {skill}
                          <button type="button" onClick={() => removeChip('skills', idx)} className="text-blue-600 hover:text-blue-800">×</button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Benefícios</label>
                    <div className="flex items-center gap-2">
                      <input
                        value={benefitInput}
                        onChange={(e) => setBenefitInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addChip('benefits', benefitInput)
                            setBenefitInput('')
                          }
                        }}
                        placeholder="Digite e pressione Enter"
                        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40"
                      />
                      <button type="button" onClick={() => { addChip('benefits', benefitInput); setBenefitInput('') }} className="px-3 py-2 text-xs font-semibold text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
                        Adicionar
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {form.benefits.map((benefit, idx) => (
                        <span key={idx} className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1 text-xs text-purple-700">
                          {benefit}
                          <button type="button" onClick={() => removeChip('benefits', idx)} className="text-purple-600 hover:text-purple-800">×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700">Horário</label>
                    <input
                      value={form.work_schedule}
                      onChange={(e) => setForm((prev) => (prev ? { ...prev, work_schedule: e.target.value } : prev))}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40"
                      placeholder="Ex: 09h às 18h"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700">Disponibilidade para viajar</label>
                    <input
                      value={form.travel_availability}
                      onChange={(e) => setForm((prev) => (prev ? { ...prev, travel_availability: e.target.value } : prev))}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40"
                      placeholder="Ex: Ocasional"
                    />
                  </div>
                  <div className="flex flex-col gap-2 lg:col-span-1">
                    <label className="text-sm font-medium text-gray-700">Observações</label>
                    <textarea
                      value={form.observations}
                      onChange={(e) => setForm((prev) => (prev ? { ...prev, observations: e.target.value } : prev))}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40"
                    />
                  </div>
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
  const [jobs, setJobs] = useState<Job[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'open' | 'paused' | 'closed' | ''>('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<JobStats | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [editingJobId, setEditingJobId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    fetchStats()
  }, [])

  useEffect(() => {
    fetchJobs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const filteredJobs = useMemo(() => jobs, [jobs])

  async function fetchJobs() {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    if (search) params.set('search', search)
    if (statusFilter) params.set('status', statusFilter)
    const res = await fetch(`/api/jobs?${params}`)
    if (res.status === 401) {
      setError('Faça login para visualizar suas vagas')
      setJobs([])
      setTotal(0)
      return
    }
    const json = await res.json()
    setError(null)
    setJobs(json.items || [])
    setTotal(json.total || 0)
  }

  async function fetchStats() {
    const res = await fetch('/api/jobs/stats')
    if (res.ok) {
      const json = await res.json()
      setStats(json)
    }
  }

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
    await Promise.all([fetchJobs(), fetchStats()])
    notify({ title: 'Vaga excluída', variant: 'success' })
  }

  async function handleDuplicate(id: string) {
    const res = await fetch(`/api/jobs/${id}`)
    const json = await res.json()
    if (!res.ok || !json?.item) {
      notify({ title: 'Erro', description: 'Não foi possível duplicar esta vaga.', variant: 'error' })
      return
    }
    const item = json.item as JobDetail
    const payload = {
      title: `${item.title} (cópia)`,
      description: item.description,
      location: item.location,
      salary: item.salary,
      work_model: item.work_model,
      contract_type: item.contract_type,
      requirements: item.requirements,
      skills: item.skills,
      benefits: item.benefits,
      department: item.department,
      job_description: item.job_description,
      responsibilities: item.responsibilities,
      requirements_and_skills: item.requirements_and_skills,
      work_schedule: item.work_schedule,
      travel_availability: item.travel_availability,
      observations: item.observations,
      status: 'open',
    }
    const createRes = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!createRes.ok) {
      notify({ title: 'Erro', description: 'Falha ao criar a cópia da vaga.', variant: 'error' })
      return
    }
    notify({ title: 'Vaga duplicada', variant: 'success' })
    await fetchJobs()
    fetchStats()
  }

  async function handleTogglePause(job: Job) {
    const nextStatus: Job['status'] = job.status === 'paused' ? 'open' : 'paused'
    const res = await fetch(`/api/jobs/${job.id}`, {
      method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })
    if (!res.ok) {
      notify({ title: 'Erro', description: 'Não foi possível atualizar o status da vaga.', variant: 'error' })
      return
    }
    notify({ title: nextStatus === 'paused' ? 'Vaga pausada' : 'Vaga reativada', variant: 'success' })
    await fetchJobs()
    fetchStats()
  }

  const applyFilters = () => {
    setPage(1)
    fetchJobs()
  }

  const renderActions = (job: Job) => (
    <div className="relative inline-block text-left" ref={openMenuId === job.id ? menuRef : null}>
      <button
        onClick={() => setOpenMenuId((prev) => (prev === job.id ? null : job.id))}
        className="rounded-full border border-gray-300 p-2 text-gray-600 transition hover:bg-gray-100"
        aria-label="Abrir ações"
      >
        ⋯
      </button>
      {openMenuId === job.id && (
        <div className="absolute right-0 z-30 mt-2 w-48 origin-top-right rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="py-1 text-sm text-gray-700">
            <button
              onClick={() => {
                router.push(`/jobs/${job.id}/stages`)
                setOpenMenuId(null)
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-gray-50"
            >
              <span role="img" aria-label="candidatos">👥</span>
              Ver Candidatos
            </button>
            <button
              onClick={() => {
                setEditingJobId(job.id)
                setOpenMenuId(null)
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-gray-50"
            >
              <span role="img" aria-label="editar">✏️</span>
              Editar
            </button>
            <button
              onClick={() => {
                handleDuplicate(job.id)
                setOpenMenuId(null)
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-gray-50"
            >
              <span role="img" aria-label="duplicar">📄</span>
              Duplicar
            </button>
            <button
              onClick={() => {
                handleTogglePause(job)
                setOpenMenuId(null)
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-gray-50"
            >
              <span role="img" aria-label="pausar">⏸️</span>
              {job.status === 'paused' ? 'Reativar' : 'Pausar'}
            </button>
            <div className="my-1 h-px bg-gray-200" />
            <button
              onClick={() => {
                handleDelete(job.id)
                setOpenMenuId(null)
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-red-600 hover:bg-red-50"
            >
              <span role="img" aria-label="excluir">🗑️</span>
              Excluir
            </button>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f7f7f7] pb-12">
      <div className="bg-white border-b border-gray-200 shadow-sm -mx-4 md:-mx-8 px-4 md:px-8 mb-8">
        <div className="flex w-full flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm text-gray-500">Dashboard / Vagas</div>
            <h1 className="mt-2 text-2xl font-semibold text-gray-900">Gerenciar Vagas</h1>
            <p className="text-sm text-gray-600">Gerencie todas as vagas em um só lugar</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Exportar
            </button>
            <Link href="/jobs/new" className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-700">
              Nova Vaga
            </Link>
          </div>
          </div>
        </div>

      <div className="space-y-8">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="text-sm text-gray-500">Total de Vagas</div>
            <div className="mt-2 text-3xl font-semibold text-gray-900">{stats?.total_jobs ?? '—'}</div>
            <div className="text-xs text-gray-400 mt-1">+2 esta semana</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="text-sm text-gray-500">Vagas Ativas</div>
            <div className="mt-2 text-3xl font-semibold text-gray-900">{stats?.active_jobs ?? '—'}</div>
            <div className="text-xs text-green-600 mt-1">Recebendo candidatos</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="text-sm text-gray-500">Candidatos</div>
            <div className="mt-2 text-3xl font-semibold text-gray-900">{stats?.total_candidates ?? '—'}</div>
            <div className="text-xs text-gray-400 mt-1">Total de aplicações</div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <button
                className={`rounded-lg px-4 py-2 text-sm font-medium ${viewMode === 'table' ? 'bg-gray-900 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                onClick={() => setViewMode('table')}
              >
                Tabela
              </button>
              <button
                className={`rounded-lg px-4 py-2 text-sm font-medium ${viewMode === 'cards' ? 'bg-gray-900 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                onClick={() => setViewMode('cards')}
              >
                Cards
              </button>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar vagas..."
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-gray-900/40 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              />
              <select
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 focus:border-gray-900/40 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as 'open' | 'paused' | 'closed' | '')
                  setPage(1)
                }}
              >
                <option value="">Todos os status</option>
                <option value="open">Ativa</option>
                <option value="paused">Pausada</option>
                <option value="closed">Encerrada</option>
                    </select>
              <button onClick={applyFilters} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Aplicar
              </button>
                  </div>
                  </div>

          {viewMode === 'cards' ? (
            error ? (
              <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">{error}</div>
            ) : filteredJobs.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">Nenhuma vaga encontrada.</div>
            ) : (
              <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {filteredJobs.map((job) => (
                  <div key={job.id} className="flex h-full flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="text-sm font-semibold uppercase tracking-wide text-gray-400">{job.department || 'Sem departamento'}</div>
                        <div className="text-lg font-semibold text-gray-900">{job.title}</div>
                        {job.salary && <div className="text-sm text-gray-600">{job.salary}</div>}
                        {job.description && <p className="text-sm text-gray-500 line-clamp-3">{job.description}</p>}
                  </div>
                      <div className="-mr-2">{renderActions(job)}</div>
                  </div>
                    <div className="mt-6 grid grid-cols-2 gap-4 text-sm text-gray-600">
                  <div>
                        <div className="text-xs uppercase tracking-wide text-gray-400">Status</div>
                        <span className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClasses[job.status]}`}>
                          {statusLabels[job.status]}
                        </span>
                  </div>
                  <div>
                        <div className="text-xs uppercase tracking-wide text-gray-400">Candidatos</div>
                        <div className="mt-1 text-base font-semibold text-gray-900">{job.applications_count ?? 0}</div>
                  </div>
                  <div>
                        <div className="text-xs uppercase tracking-wide text-gray-400">Localização</div>
                        <div className="mt-1 text-sm text-gray-600">{job.location || '—'}</div>
                  </div>
                  <div>
                        <div className="text-xs uppercase tracking-wide text-gray-400">Publicada</div>
                        <div className="mt-1 text-sm text-gray-600">{formatDate(job.created_at)}</div>
                    </div>
                  </div>
                      </div>
                    ))}
                          </div>
                        )
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full table-auto text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                  <th className="py-3 px-5">Vaga</th>
                    <th className="hidden py-3 px-5 lg:table-cell">Departamento</th>
                    <th className="hidden py-3 px-5 xl:table-cell">Localização</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Candidatos</th>
                  <th className="py-3 px-5">Publicada</th>
                    <th className="py-3 px-5 text-right whitespace-nowrap">Ações</th>
                </tr>
              </thead>
                <tbody className="bg-white">
                  {error ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-sm text-gray-500">{error}</td>
                    </tr>
                  ) : filteredJobs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-sm text-gray-500">Nenhuma vaga encontrada.</td>
                    </tr>
                  ) : (
                    filteredJobs.map((job) => (
                      <tr key={job.id} className="border-b border-gray-100 hover:bg-gray-50/60">
                      <td className="py-4 px-5 align-top">
                          <div className="font-medium text-gray-900">{job.title}</div>
                          {job.salary && <div className="text-xs text-gray-500 mt-1">{job.salary}</div>}
                          {job.description && <div className="text-xs text-gray-500 mt-1 line-clamp-1">{job.description}</div>}
                      </td>
                        <td className="hidden py-4 px-5 align-top lg:table-cell">{job.department || '—'}</td>
                        <td className="hidden py-4 px-5 align-top xl:table-cell">{job.location || '—'}</td>
                      <td className="py-4 px-5 align-top">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClasses[job.status]}`}>
                            {statusLabels[job.status]}
                          </span>
                      </td>
                      <td className="py-4 px-5 align-top">
                          <div className="text-sm font-medium text-gray-900">{job.applications_count ?? 0}</div>
                          <div className="text-xs text-gray-500">candidato(s)</div>
                        </td>
                        <td className="py-4 px-5 align-top">{formatDate(job.created_at)}</td>
                        <td className="py-4 px-5 align-top text-right whitespace-nowrap">
                          {renderActions(job)}
                      </td>
                    </tr>
                    ))
                  )}
              </tbody>
            </table>
            </div>
          )}
        </div>

        {total > pageSize && (
          <div className="flex items-center justify-center gap-4 pt-4">
            <button
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              ← Anterior
            </button>
            <span className="text-sm text-gray-600">
              Página {page} de {Math.max(1, Math.ceil(total / pageSize))}
            </span>
            <button
              disabled={page >= Math.ceil(total / pageSize)}
              onClick={() => setPage((prev) => prev + 1)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Próxima →
            </button>
          </div>
        )}
      </div>

      {editingJobId && (
        <EditJobModal
          jobId={editingJobId}
          onClose={() => setEditingJobId(null)}
          onSaved={() => {
            fetchJobs()
            fetchStats()
          }}
        />
      )}
    </div>
  )
}


