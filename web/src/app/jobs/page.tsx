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
    <div
      className="relative inline-block text-left"
      ref={openMenuId === job.id ? menuRef : null}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        onClick={(event) => {
          event.stopPropagation()
          setOpenMenuId((prev) => (prev === job.id ? null : job.id))
        }}
        className="rounded-full border border-gray-300 p-2 text-gray-600 transition hover:bg-gray-100"
        aria-label="Abrir ações"
      >
        ⋯
      </button>
      {openMenuId === job.id && (
        <div className="absolute right-0 z-40 mt-2 w-48 origin-top-right rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="py-1 text-sm text-gray-700">
            <button
              onClick={(event) => {
                event.stopPropagation()
                router.push(`/jobs/${job.id}/stages`)
                setOpenMenuId(null)
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-gray-50"
            >
              <span role="img" aria-label="candidatos">👥</span>
              Ver Candidatos
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation()
                setEditingJobId(job.id)
                setOpenMenuId(null)
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-gray-50"
            >
              <span role="img" aria-label="editar">✏️</span>
              Editar
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation()
                handleDuplicate(job.id)
                setOpenMenuId(null)
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-gray-50"
            >
              <span role="img" aria-label="duplicar">📄</span>
              Duplicar
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation()
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
              onClick={(event) => {
                event.stopPropagation()
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
    <div className="min-h-screen space-y-12 bg-[hsl(var(--background))] pb-12">
      <section className="w-full rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/95 px-6 py-8 shadow-[0_26px_55px_-40px_rgba(15,23,42,0.5)] sm:px-8 lg:px-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <span className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Dashboard / Vagas</span>
            <h1 className="text-3xl font-semibold tracking-tight text-[hsl(var(--foreground))] sm:text-4xl">Gerenciar Vagas</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Gerencie todas as vagas em um só lugar</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-outline px-6 py-3 text-sm sm:text-base">
              Exportar
            </button>
            <Link href="/jobs/new" className="btn btn-primary px-6 py-3 text-sm sm:text-base">
              Nova Vaga
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-10">
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/95 p-6 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.45)]">
            <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Total de Vagas</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-[hsl(var(--foreground))] sm:text-4xl">{stats?.total_jobs ?? '—'}</p>
            <p className="mt-2 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">+2 esta semana</p>
          </div>
          <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/95 p-6 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.45)]">
            <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Vagas Ativas</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-[hsl(var(--foreground))] sm:text-4xl">{stats?.active_jobs ?? '—'}</p>
            <p className="mt-2 text-xs uppercase tracking-wide text-[hsl(var(--primary))]">Recebendo candidatos</p>
          </div>
          <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/95 p-6 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.45)]">
            <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Candidatos</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-[hsl(var(--foreground))] sm:text-4xl">{stats?.total_candidates ?? '—'}</p>
            <p className="mt-2 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Total de aplicações</p>
          </div>
        </div>

        <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/95 p-6 shadow-[0_26px_55px_-40px_rgba(15,23,42,0.5)] sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <button
              className={`btn px-4 py-2 text-sm sm:text-base ${viewMode === 'table' ? 'bg-[hsl(var(--foreground))] text-[hsl(var(--background))]' : 'btn-outline'}`}
              onClick={() => setViewMode('table')}
              aria-label="Exibir em tabela"
            >
              <span aria-hidden className="text-lg leading-none">≣</span>
            </button>
              <button
                className={`btn px-5 py-2.5 text-sm sm:text-base ${viewMode === 'cards' ? 'bg-[hsl(var(--foreground))] text-[hsl(var(--background))]' : 'btn-outline'}`}
                onClick={() => setViewMode('cards')}
              >
                Cards
              </button>
            </div>
            <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:items-center lg:gap-4">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar vagas..."
                className="w-full rounded-2xl border border-[hsl(var(--border))] px-4 py-2.5 text-sm text-[hsl(var(--foreground))] focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/30 lg:w-80 xl:w-[26rem]"
              />
              <select
                className="w-full rounded-2xl border border-[hsl(var(--border))] px-4 py-2.5 text-sm text-[hsl(var(--foreground))] focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/30 lg:w-64"
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
              <button onClick={applyFilters} className="btn btn-outline px-6 py-2.5 text-sm sm:text-base">
                Aplicar
              </button>
            </div>
          </div>

          {viewMode === 'cards' ? (
            error ? (
              <div className="mt-6 w-full rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-10 text-center text-sm text-[hsl(var(--muted-foreground))]">{error}</div>
            ) : filteredJobs.length === 0 ? (
              <div className="mt-6 w-full rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-10 text-center text-sm text-[hsl(var(--muted-foreground))]">Nenhuma vaga encontrada.</div>
            ) : (
              <div className="mt-8 grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
                {filteredJobs.map((job) => {
                  const jobHref = `/jobs/${job.id}`
                  return (
                    <div key={job.id} className="relative">
                      <Link
                        href={jobHref}
                        className="group block h-full rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/95 p-6 shadow-[0_24px_45px_-32px_rgba(15,23,42,0.45)] transition hover:-translate-y-1 hover:shadow-[0_28px_55px_-34px_rgba(15,23,42,0.55)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                      >
                        <div className="space-y-2 pr-8">
                          <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{job.department || 'Sem departamento'}</p>
                          <p className="text-xl font-semibold tracking-tight text-[hsl(var(--foreground))] group-hover:text-[hsl(var(--foreground))]/90">{job.title}</p>
                          {job.salary && <p className="text-sm text-[hsl(var(--muted-foreground))]">{job.salary}</p>}
                          {job.description && <p className="text-sm text-[hsl(var(--muted-foreground))] line-clamp-3">{job.description}</p>}
                        </div>
                        <div className="mt-6 grid grid-cols-2 gap-4 text-sm text-[hsl(var(--muted-foreground))]">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Status</p>
                            <span className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClasses[job.status]}`}>
                              {statusLabels[job.status]}
                            </span>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Candidatos</p>
                            <p className="mt-1 text-base font-semibold text-[hsl(var(--foreground))]">{job.applications_count ?? 0}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Localização</p>
                            <p className="mt-1 text-sm text-[hsl(var(--foreground))]">{job.location || '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Publicada</p>
                            <p className="mt-1 text-sm text-[hsl(var(--foreground))]">{formatDate(job.created_at)}</p>
                          </div>
                        </div>
                      </Link>
                      <div className="absolute right-4 top-4">{renderActions(job)}</div>
                    </div>
                  )
                })}
              </div>
            )
          ) : (
            <div className="mt-8 w-full overflow-x-auto">
              <table className="min-w-full table-auto text-sm sm:text-base">
                <thead className="bg-[hsl(var(--muted))] text-left text-[hsl(var(--muted-foreground))]">
                  <tr>
                    <th className="py-3 px-5 sm:py-4 sm:px-6">Vaga</th>
                    <th className="hidden py-3 px-5 sm:py-4 sm:px-6 lg:table-cell">Departamento</th>
                    <th className="hidden py-3 px-5 sm:py-4 sm:px-6 xl:table-cell">Localização</th>
                    <th className="py-3 px-5 sm:py-4 sm:px-6">Status</th>
                    <th className="py-3 px-5 sm:py-4 sm:px-6">Candidatos</th>
                    <th className="py-3 px-5 sm:py-4 sm:px-6">Publicada</th>
                    <th className="whitespace-nowrap py-3 px-5 sm:py-4 sm:px-6 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-[hsl(var(--card))]">
                  {error ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">{error}</td>
                    </tr>
                  ) : filteredJobs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">Nenhuma vaga encontrada.</td>
                    </tr>
                  ) : (
                    filteredJobs.map((job) => (
                      <tr key={job.id} className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/60">
                        <td className="py-4 px-5 sm:py-5 sm:px-6 align-top">
                          <Link
                            href={`/jobs/${job.id}`}
                            className="font-medium text-[hsl(var(--foreground))] hover:text-[hsl(var(--foreground))]/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                          >
                            {job.title}
                          </Link>
                          {job.salary && <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{job.salary}</p>}
                          {job.description && <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))] line-clamp-1">{job.description}</p>}
                        </td>
                        <td className="hidden py-4 px-5 sm:py-5 sm:px-6 align-top lg:table-cell">{job.department || '—'}</td>
                        <td className="hidden py-4 px-5 sm:py-5 sm:px-6 align-top xl:table-cell">{job.location || '—'}</td>
                        <td className="py-4 px-5 sm:py-5 sm:px-6 align-top">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClasses[job.status]}`}>
                            {statusLabels[job.status]}
                          </span>
                        </td>
                        <td className="py-4 px-5 sm:py-5 sm:px-6 align-top">
                          <p className="text-sm font-medium text-[hsl(var(--foreground))]">{job.applications_count ?? 0}</p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">candidato(s)</p>
                        </td>
                        <td className="py-4 px-5 sm:py-5 sm:px-6 align-top">{formatDate(job.created_at)}</td>
                        <td className="py-4 px-5 sm:py-5 sm:px-6 align-top text-right">
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
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4 sm:gap-6 sm:pt-6">
            <button
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="btn btn-outline px-5 py-2.5 text-sm sm:px-6 sm:py-3 sm:text-base disabled:opacity-50"
            >
              ← Anterior
            </button>
            <span className="text-sm text-[hsl(var(--muted-foreground))] sm:text-base">
              Página {page} de {Math.max(1, Math.ceil(total / pageSize))}
            </span>
            <button
              disabled={page >= Math.ceil(total / pageSize)}
              onClick={() => setPage((prev) => prev + 1)}
              className="btn btn-outline px-5 py-2.5 text-sm sm:px-6 sm:py-3 sm:text-base disabled:opacity-50"
            >
              Próxima →
            </button>
          </div>
        )}
      </section>

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


