'use client'

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
}

type JobStats = { total_jobs: number; active_jobs: number; total_candidates: number }

export default function JobsPage() {
  const { notify } = useToast()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', location: '' })
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'open' | 'closed' | ''>('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<JobStats | null>(null)
  const [showCreate, setShowCreate] = useState(false)

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

  useEffect(() => {
    fetchJobs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  useEffect(() => {
    fetchStats()
  }, [])

  async function onCreateJob(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, status: 'open' }),
      })
      if (!res.ok) { const err = await res.json(); notify({ title: 'Erro ao criar vaga', description: err.error?.message, variant: 'error' }); return }
      setForm({ title: '', description: '', location: '' })
      await Promise.all([fetchJobs(), fetchStats()])
      notify({ title: 'Vaga criada com sucesso', variant: 'success' })
      setShowCreate(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient py-8">
      <div className="container-page space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Gerenciar Vagas</h1>
            <p className="text-gray-600 mt-3">Gerencie todas as suas vagas em um só lugar</p>
          </div>
          <div className="flex items-center gap-3">
            <a href="/candidates" className="btn btn-outline">👥 Candidatos</a>
            <button className="btn btn-primary" onClick={()=>setShowCreate((v)=>!v)}>+ Nova Vaga</button>
          </div>
        </div>

        {/* Cards de métricas */}
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

        {/* Formulário de nova vaga (colapsável) */}
        {showCreate && (
          <div className="card p-6 max-w-4xl">
            <h2 className="text-lg font-semibold mb-4">Criar Nova Vaga</h2>
            <form onSubmit={onCreateJob} className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Título da Vaga *</label>
                <input value={form.title} onChange={(e)=>setForm((f)=>({ ...f, title: e.target.value }))} className="w-full" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Local</label>
                <input value={form.location} onChange={(e)=>setForm((f)=>({ ...f, location: e.target.value }))} className="w-full" placeholder="Ex: São Paulo - SP" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
                <textarea value={form.description} onChange={(e)=>setForm((f)=>({ ...f, description: e.target.value }))} className="w-full h-24 resize-none" />
              </div>
              <div className="md:col-span-2 flex items-center gap-3">
                <button disabled={loading} className="btn btn-primary">{loading ? 'Criando...' : 'Salvar Vaga'}</button>
                <button type="button" className="btn btn-outline" onClick={()=>setShowCreate(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        )}

        {/* Filtros */}
          <div className="card p-7">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <input 
              value={search}
              onChange={(e)=>setSearch(e.target.value)}
              placeholder="Buscar vagas..."
              className="w-full md:flex-1"
            />
            <select className="w-full md:w-56" value={statusFilter} onChange={(e)=>{ setStatusFilter(e.target.value as any); setPage(1) }}>
              <option value="">Todos os Status</option>
              <option value="open">Ativa</option>
              <option value="closed">Fechada</option>
            </select>
            <button className="btn btn-outline" onClick={()=>{ setPage(1); fetchJobs() }}>Aplicar</button>
          </div>
        </div>

        {/* Lista de Vagas */}
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
                {jobs.map((j)=>{
                  const createdAt = j.created_at ? new Date(j.created_at) : null
                  return (
                    <tr key={j.id} className="border-b hover:bg-gray-50/50">
                      <td className="py-4 px-5 align-top">
                        <div className="font-medium text-gray-900">{j.title}</div>
                        {j.description && (
                          <div className="text-gray-600 text-xs mt-1 line-clamp-1">{j.description}</div>
                        )}
                      </td>
                      <td className="py-4 px-5 align-top">—</td>
                      <td className="py-4 px-5 align-top">{j.location || '—'}</td>
                      <td className="py-4 px-5 align-top">
                        <span className={`badge ${j.status === 'open' ? 'badge-success' : 'badge-warning'}`}>{j.status === 'open' ? 'Ativa' : 'Fechada'}</span>
                      </td>
                      <td className="py-4 px-5 align-top">{j.applications_count ?? 0}</td>
                      <td className="py-4 px-5 align-top">{createdAt ? createdAt.toLocaleDateString('pt-BR') : '—'}</td>
                      <td className="py-4 px-5 align-top">
                        <div className="flex items-center gap-2 justify-end">
                          <a
                            href={`/jobs/${j.id}/stages`}
                            className="p-2 rounded-full border border-gray-200 hover:bg-gray-100 transition-colors"
                            title="Visualizar"
                            aria-label="Visualizar vaga"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-gray-700">
                              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </a>
                          <button
                            className="btn btn-danger btn-xs"
                            title="Excluir"
                            onClick={async ()=>{
                              if(!confirm('Excluir esta vaga? Essa ação não pode ser desfeita.')) return
                              const res = await fetch(`/api/jobs/${j.id}`, { method: 'DELETE' })
                              if(!res.ok){
                                const t = await res.text();
                                let msg = 'Falha ao excluir a vaga'
                                try{ const j = t ? JSON.parse(t) : null; msg = j?.error?.message || msg }catch{}
                                notify({ title: 'Erro', description: msg, variant: 'error' })
                                return
                              }
                              await Promise.all([fetchJobs(), fetchStats()])
                              notify({ title: 'Vaga excluída', variant: 'success' })
                            }}
                          >🗑️</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Paginação */}
        {total > pageSize && (
          <div className="flex items-center justify-center gap-4 pt-4">
            <button disabled={page <= 1} onClick={()=>setPage((p)=>Math.max(1, p-1))} className="btn btn-outline disabled:opacity-50">← Anterior</button>
            <span className="text-sm text-gray-600 px-4">Página {page} de {Math.max(1, Math.ceil(total / pageSize))}</span>
            <button disabled={page >= Math.ceil(total / pageSize)} onClick={()=>setPage((p)=>p+1)} className="btn btn-outline disabled:opacity-50">Próxima →</button>
          </div>
        )}
      </div>
    </div>
  )
}


