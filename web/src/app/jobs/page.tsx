'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/components/ToastProvider'

type Job = {
  id: string
  title: string
  description?: string
  location?: string
  status: 'open' | 'closed'
}

export default function JobsPage() {
  const { notify } = useToast()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', location: '' })
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20
  const [error, setError] = useState<string | null>(null)

  async function fetchJobs() {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    if (search) params.set('search', search)
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

  useEffect(() => {
    fetchJobs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

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
      await fetchJobs()
      notify({ title: 'Vaga criada com sucesso', variant: 'success' })
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
            <h1 className="text-3xl font-bold text-gray-900">Vagas</h1>
            <p className="text-gray-600 mt-2">Gerencie suas vagas e processos seletivos</p>
          </div>
          <a href="/candidates" className="btn btn-outline">
            👥 Candidatos
          </a>
        </div>

        {/* Create Job Form */}
        <div className="card p-8 max-w-4xl">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Criar Nova Vaga</h2>
          <form onSubmit={onCreateJob} className="grid md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Título da Vaga *
              </label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ex: Desenvolvedor Full Stack"
                className="w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Local
              </label>
              <input
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="Ex: São Paulo, SP"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select className="w-full" value="open" disabled>
                <option value="open">Aberta</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descrição
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Descreva as responsabilidades e requisitos da vaga..."
                className="w-full h-24 resize-none"
              />
            </div>
            <div className="md:col-span-2">
              <button disabled={loading} className="btn btn-primary">
                {loading ? (
                  <>
                    <div className="spinner w-4 h-4 mr-2"></div>
                    Criando...
                  </>
                ) : (
                  '✨ Criar Vaga'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Search and Filters */}
        <div className="card p-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1">
              <input 
                value={search} 
                onChange={(e)=>setSearch(e.target.value)} 
                placeholder="🔍 Buscar vagas por título, descrição ou local..." 
                className="w-full" 
              />
            </div>
        <button 
          onClick={()=>{ setPage(1); fetchJobs() }} 
          className="btn btn-outline"
        >
          Buscar
        </button>
          </div>
        </div>

        {/* Jobs Grid */}
        {(error || jobs.length === 0) ? (
          <div className="card p-12 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">{error ? 'Acesso restrito' : 'Nenhuma vaga encontrada'}</h3>
            <p className="text-gray-600 mb-6">
              {error ? error : (search ? 'Tente ajustar os filtros de busca' : 'Crie sua primeira vaga para começar')}
            </p>
            {!error && !search && (
              <button 
                onClick={() => document.querySelector('form')?.scrollIntoView({ behavior: 'smooth' })}
                className="btn btn-primary"
              >
                Criar Primeira Vaga
              </button>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobs.map((j) => (
              <div key={j.id} className="card p-6 hover:shadow-lg transition-all duration-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-900 mb-1">{j.title}</h3>
                    <p className="text-gray-600 text-sm flex items-center gap-1">
                      📍 {j.location || 'Local não informado'}
                    </p>
                  </div>
                  <span className={`badge ${j.status === 'open' ? 'badge-success' : 'badge-warning'}`}>
                    {j.status === 'open' ? 'Aberta' : 'Fechada'}
                  </span>
                </div>
                
                {j.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                    {j.description}
                  </p>
                )}
                
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500">
                    Criada em {new Date().toLocaleDateString('pt-BR')}
                  </span>
                  <div className="flex items-center gap-2">
                    <a 
                      href={`/jobs/${j.id}/stages`} 
                      className="btn btn-outline text-sm"
                    >
                      ⚙️ Etapas
                    </a>
                    <button
                      className="btn btn-danger text-sm"
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
                        await fetchJobs()
                        notify({ title: 'Vaga excluída', variant: 'success' })
                      }}
                    >
                      🗑️ Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > pageSize && (
          <div className="flex items-center justify-center gap-4 pt-8">
            <button 
              disabled={page <= 1} 
              onClick={()=>setPage((p)=>Math.max(1, p-1))} 
              className="btn btn-outline disabled:opacity-50"
            >
              ← Anterior
            </button>
            <span className="text-sm text-gray-600 px-4">
              Página {page} de {Math.max(1, Math.ceil(total / pageSize))}
            </span>
            <button 
              disabled={page >= Math.ceil(total / pageSize)} 
              onClick={()=>setPage((p)=>p+1)} 
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


