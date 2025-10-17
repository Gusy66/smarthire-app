'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/components/ToastProvider'

type Candidate = { 
  id: string; 
  name: string; 
  email?: string; 
  phone?: string;
  created_at?: string;
  latest_job_title?: string | null;
  latest_activity_at?: string | null;
  avg_score?: number | null;
}

export default function CandidatesPage() {
  const { notify } = useToast()
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20
  const [selected, setSelected] = useState<Candidate | null>(null)

  async function load() {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    if (search) params.set('search', search)
    const res = await fetch(`/api/candidates?${params}`, {
      credentials: 'same-origin',
    })
    const json = await res.json()
    setCandidates(json.items || [])
    setTotal(json.total || 0)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const text = await res.text()
        let message = res.statusText || 'Erro ao criar candidato'
        try {
          const payload = text ? JSON.parse(text) : null
          message = payload?.error?.message || message
        } catch {}
        notify({ title: 'Erro ao criar candidato', description: message, variant: 'error' })
        return
      }
      setForm({ name: '', email: '', phone: '' })
      await load()
      notify({ title: 'Candidato criado', variant: 'success' })
    } finally {
      setLoading(false)
    }
  }

  const avgScoreToPct = (v?: number | null) => v == null ? null : Math.round((Number(v) || 0) * 100) / 100

  return (
    <div className="space-y-6">
      {/* Header e ações */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Gerenciar Candidatos</h1>
          <p className="text-gray-600 text-sm">Acompanhe todos os candidatos em seu pipeline</p>
        </div>
        <a href="/jobs" className="btn btn-outline">Voltar às Vagas</a>
      </div>

      {/* Cards de métricas (placeholders simples) */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="text-sm text-gray-600">Total de Candidatos</div>
          <div className="text-3xl font-semibold mt-1">{total}</div>
          <div className="text-xs text-gray-500 mt-1">+12 esta semana</div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-gray-600">Novos Candidatos</div>
          <div className="text-3xl font-semibold mt-1">—</div>
          <div className="text-xs text-gray-500 mt-1">Aguardando triagem</div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-gray-600">Em Processo</div>
          <div className="text-3xl font-semibold mt-1">—</div>
          <div className="text-xs text-gray-500 mt-1">Em diferentes etapas</div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-gray-600">Contratados</div>
          <div className="text-3xl font-semibold mt-1">—</div>
          <div className="text-xs text-gray-500 mt-1">Este mês</div>
        </div>
      </div>

      {/* Form rápido para novo candidato */}
      <form onSubmit={onSubmit} className="card p-4 grid gap-3 max-w-3xl">
        <div className="grid md:grid-cols-3 gap-3">
          <input value={form.name} onChange={(e)=>setForm((f)=>({ ...f, name: e.target.value }))} placeholder="Nome" className="border rounded px-3 py-2" required />
          <input value={form.email} onChange={(e)=>setForm((f)=>({ ...f, email: e.target.value }))} type="email" placeholder="E-mail" className="border rounded px-3 py-2" />
          <input value={form.phone} onChange={(e)=>setForm((f)=>({ ...f, phone: e.target.value }))} placeholder="Telefone" className="border rounded px-3 py-2" />
        </div>
        <div>
          <button disabled={loading} className="btn btn-primary">{loading ? 'Adicionando...' : 'Adicionar candidato'}</button>
        </div>
      </form>

      {/* Filtros */}
      <div className="card p-5">
        <div className="flex items-center gap-3">
          <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar candidatos..." className="border rounded px-3 py-2 w-full max-w-xl" />
          <button onClick={()=>{ setPage(1); load() }} className="btn btn-outline">Buscar</button>
        </div>
      </div>

      {/* Tabela de candidatos */}
      <div className="card p-0 overflow-x-auto">
        <div className="px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">Lista de Candidatos</h2>
          <div className="text-xs text-gray-500 mt-1">{candidates.length} candidato(s) encontrado(s)</div>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-gray-600">
            <tr className="border-b">
              <th className="py-3 px-5">Candidato</th>
              <th className="py-3 px-5">Vaga</th>
              <th className="py-3 px-5">Status</th>
              <th className="py-3 px-5">Score IA</th>
              <th className="py-3 px-5">Aplicado em</th>
              <th className="py-3 px-5">Última Atividade</th>
              <th className="py-3 px-5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c)=>{
              const score = avgScoreToPct(c.avg_score)
              const appliedAt = c.created_at ? new Date(c.created_at) : null
              const lastAct = c.latest_activity_at ? new Date(c.latest_activity_at) : null
              return (
                <tr key={c.id} className="border-b hover:bg-gray-50/50">
                  <td className="py-4 px-5">
                    <div className="font-medium text-gray-900">{c.name}</div>
                    <div className="text-xs text-gray-600">{c.email} {c.phone ? `• ${c.phone}` : ''}</div>
                  </td>
                  <td className="py-4 px-5">{c.latest_job_title ?? '—'}</td>
                  <td className="py-4 px-5"><span className="badge badge-info">—</span></td>
                  <td className="py-4 px-5">
                    {score == null ? (
                      <span className="text-gray-500">—</span>
                    ) : (
                      <div className="flex items-center gap-3 w-40">
                        <span className="font-medium">{Math.round(score)}%</span>
                        <div className="progress-bar flex-1">
                          <div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, Math.round(score)))}%` }} />
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-5">{appliedAt ? appliedAt.toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="py-4 px-5">{lastAct ? lastAct.toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        className="p-2 rounded-full border border-gray-200 hover:bg-gray-100 transition-colors"
                        title="Visualizar"
                        onClick={()=>setSelected(c)}
                        aria-label="Visualizar candidato"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-gray-700">
                          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      <div className="flex items-center gap-3 pt-4">
        <button disabled={page<=1} onClick={()=>setPage((p)=>Math.max(1, p-1))} className="btn btn-outline">Anterior</button>
        <span className="text-sm">Página {page} de {Math.max(1, Math.ceil(total / pageSize))}</span>
        <button disabled={page>=Math.ceil(total / pageSize)} onClick={()=>setPage((p)=>p+1)} className="btn btn-outline">Próxima</button>
      </div>

      {/* Modal de detalhes */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-2xl relative">
            <button className="absolute right-4 top-4" onClick={()=>setSelected(null)}>✕</button>
            <h3 className="text-xl font-semibold mb-4">Detalhes do Candidato</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <div className="text-lg font-semibold">{selected.name}</div>
                <div className="text-sm text-gray-600">{selected.email} {selected.phone ? `• ${selected.phone}` : ''}</div>
                <div className="mt-4">
                  <div className="text-sm text-gray-600 mb-1">Score IA</div>
                  {selected.avg_score == null ? (
                    <div className="text-gray-500">—</div>
                  ) : (
                    <div className="flex items-center gap-3 w-56">
                      <span className="text-2xl font-bold">{Math.round(avgScoreToPct(selected.avg_score) || 0)}%</span>
                      <div className="progress-bar flex-1 h-3">
                        <div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, Math.round(avgScoreToPct(selected.avg_score) || 0)))}%` }} />
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mt-1">Compatibilidade com a vaga</div>
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Informações de Contato</div>
                <div className="text-sm">{selected.email || '—'}</div>
                <div className="text-sm">{selected.phone || '—'}</div>
              </div>
            </div>
            <div className="mt-6 flex items-center gap-3">
              <button className="btn btn-outline">Enviar Mensagem</button>
              <button className="btn btn-primary">Agendar Entrevista</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


