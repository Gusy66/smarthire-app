'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useToast } from '@/components/ToastProvider'

type Job = {
  id: string
  title: string
  description?: string
  location?: string
  status: 'open' | 'closed'
  created_at?: string
  applications_count?: number
  department?: string
}

type JobStats = { total_jobs: number; active_jobs: number; total_candidates: number }

export default function JobsPage() {
  const { notify } = useToast()
  const [jobs, setJobs] = useState<Job[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'open' | 'closed' | ''>('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<JobStats | null>(null)

  useEffect(() => {
    fetchStats()
  }, [])

  useEffect(() => {
    fetchJobs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

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

  const applyFilters = () => {
    setPage(1)
    fetchJobs()
  }

  return (
    <div className="min-h-screen bg-gradient py-8">
      <div className="container-page space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Gerenciar Vagas</h1>
            <p className="text-gray-600 mt-3">Gerencie todas as suas vagas em um só lugar</p>
          </div>
          <div className="flex items-center gap-3">
            <a href="/candidates" className="btn btn-outline">👥 Candidatos</a>
            <Link href="/jobs/new" className="btn btn-primary">+ Nova Vaga</Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="card p-7">
            <div className="text-sm text-gray-600">Total de Vagas</div>
            <div className="text-4xl font-semibold mt-2">{stats?.total_jobs ?? '—'}</div>
            <div className="text-xs text-gray-500 mt-1">+2 esta semana</div>
          </div>
          <div className="card p-7">
            <div className="text-sm text-gray-600">Vagas Ativas</div>
            <div className="text-4xl font-semibold mt-2">{stats?.active_jobs ?? '—'}</div>
            <div className="text-xs text-green-600 mt-1">Recebendo candidatos</div>
          </div>
          <div className="card p-7">
            <div className="text-sm text-gray-600">Total de Candidatos</div>
            <div className="text-4xl font-semibold mt-2">{stats?.total_candidates ?? '—'}</div>
            <div className="text-xs text-gray-500 mt-1">Across all jobs</div>
          </div>
        </div>

        <div className="card p-7">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar vagas..."
              className="w-full md:flex-1"
            />
            <select
              className="w-full md:w-56"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'open' | 'closed' | '')
                setPage(1)
              }}
            >
              <option value="">Todos os Status</option>
              <option value="open">Ativa</option>
              <option value="closed">Fechada</option>
            </select>
            <button className="btn btn-outline" onClick={applyFilters}>Aplicar</button>
          </div>
        </div>

        <div className="card p-0 overflow-x-auto">
          <div className="px-8 py-6 border-b">
            <h2 className="text-2xl font-semibold">Lista de Vagas</h2>
            <div className="text-xs text-gray-500 mt-1">{total} vaga(s) encontrada(s)</div>
          </div>
          {(error || jobs.length === 0) ? (
            <div className="p-10 text-center text-gray-600">
              {error ? error : 'Nenhuma vaga encontrada'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-gray-600">
                <tr className="border-b">
                  <th className="py-3 px-5">Vaga</th>
                  <th className="py-3 px-5">Departamento</th>
                  <th className="py-3 px-5">Localização</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Candidatos</th>
                  <th className="py-3 px-5">Publicada</th>
                  <th className="py-3 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const createdAt = job.created_at ? new Date(job.created_at) : null
                  return (
                    <tr key={job.id} className="border-b hover:bg-gray-50/50">
                      <td className="py-4 px-5 align-top">
                        <div className="font-medium text-gray-900">{job.title}</div>
                        {job.description && (
                          <div className="text-gray-600 text-xs mt-1 line-clamp-1">{job.description}</div>
                        )}
                      </td>
                      <td className="py-4 px-5 align-top">{job.department || '—'}</td>
                      <td className="py-4 px-5 align-top">{job.location || '—'}</td>
                      <td className="py-4 px-5 align-top">
                        <span className={`badge ${job.status === 'open' ? 'badge-success' : 'badge-warning'}`}>
                          {job.status === 'open' ? 'Ativa' : 'Fechada'}
                        </span>
                      </td>
                      <td className="py-4 px-5 align-top">{job.applications_count ?? 0}</td>
                      <td className="py-4 px-5 align-top">{createdAt ? createdAt.toLocaleDateString('pt-BR') : '—'}</td>
                      <td className="py-4 px-5 align-top">
                        <div className="flex items-center gap-2 justify-end">
                          <a
                            href={`/jobs/${job.id}/stages`}
                            className="p-2 rounded-full border border-gray-200 hover:bg-gray-100 transition-colors"
                            title="Visualizar"
                            aria-label="Visualizar vaga"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="w-5 h-5 text-gray-700"
                            >
                              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </a>
                          <button
                            className="btn btn-danger btn-xs"
                            title="Excluir"
                            onClick={() => handleDelete(job.id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {total > pageSize && (
          <div className="flex items-center justify-center gap-4 pt-4">
            <button
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="btn btn-outline disabled:opacity-50"
            >
              ← Anterior
            </button>
            <span className="text-sm text-gray-600 px-4">
              Página {page} de {Math.max(1, Math.ceil(total / pageSize))}
            </span>
            <button
              disabled={page >= Math.ceil(total / pageSize)}
              onClick={() => setPage((prev) => prev + 1)}
              className="btn btn-outline disabled:opacity-50"
            >
              Próxima →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}


