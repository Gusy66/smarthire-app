'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/components/ToastProvider'

type Candidate = { id: string; name: string; email?: string; phone?: string }

export default function CandidatesPage() {
  const { notify } = useToast()
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Candidatos</h1>
        <a href="/jobs" className="btn btn-outline">Vagas</a>
      </div>

      <form onSubmit={onSubmit} className="card p-4 grid gap-3 max-w-2xl">
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Nome"
          className="border rounded px-3 py-2"
          required
        />
        <input
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          type="email"
          placeholder="E-mail"
          className="border rounded px-3 py-2"
        />
        <input
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          placeholder="Telefone"
          className="border rounded px-3 py-2"
        />
        <button disabled={loading} className="btn btn-primary">
          {loading ? 'Adicionando...' : 'Adicionar candidato'}
        </button>
      </form>

      <div className="flex items-center gap-2">
        <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar candidatos" className="border rounded px-3 py-2 w-full max-w-md" />
        <button onClick={()=>{ setPage(1); load() }} className="btn btn-outline">Buscar</button>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {candidates.map((c) => (
          <div key={c.id} className="card p-4">
            <div className="font-medium text-lg">{c.name}</div>
            <div className="text-sm text-gray-600">{c.email} {c.phone ? `• ${c.phone}` : ''}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-4">
        <button disabled={page<=1} onClick={()=>setPage((p)=>Math.max(1, p-1))} className="btn btn-outline">Anterior</button>
        <span className="text-sm">Página {page} de {Math.max(1, Math.ceil(total / pageSize))}</span>
        <button disabled={page>=Math.ceil(total / pageSize)} onClick={()=>setPage((p)=>p+1)} className="btn btn-outline">Próxima</button>
      </div>
    </div>
  )
}


