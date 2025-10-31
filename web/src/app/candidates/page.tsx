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
  latest_stage_id?: string | null;
  latest_stage_name?: string | null;
}

export default function CandidatesPage() {
  const { notify } = useToast()
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ 
    name: '', 
    email: '', 
    phone: '', 
    job_id: '', 
    stage_id: '', 
    city: '', 
    state: '', 
    address: '', 
    children: '', 
    gender: '', 
    languages: [] as string[], 
    education: '',
    resumeFile: null as File | null
  })
  const [languageInput, setLanguageInput] = useState('')
  const [uploadingResume, setUploadingResume] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20
  const [selected, setSelected] = useState<Candidate | null>(null)
  const [availableJobs, setAvailableJobs] = useState<{id: string; title: string}[]>([])
  const [availableStages, setAvailableStages] = useState<{id: string; name: string}[]>([])

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

  useEffect(() => {
    fetch('/api/jobs?page=1&page_size=100', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((j) => setAvailableJobs(j.items || []))
      .catch(() => setAvailableJobs([]))
  }, [])

  useEffect(() => {
    if (!form.job_id) { setAvailableStages([]); setForm((f)=>({ ...f, stage_id: '' })); return }
    fetch(`/api/jobs/${form.job_id}/stages`, { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((j) => setAvailableStages(j.items || []))
      .catch(() => setAvailableStages([]))
  }, [form.job_id])

  async function uploadResume(file: File): Promise<{ path: string; bucket: string } | null> {
    setUploadingResume(true)
    try {
      // Validação de tamanho (camada de segurança adicional)
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        notify({ title: 'Arquivo muito grande', description: `O arquivo deve ter no máximo 10MB. Tamanho atual: ${(file.size / 1024 / 1024).toFixed(2)}MB`, variant: 'error' })
        return null
      }
      
      const contentType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 
        file.name.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
        file.name.endsWith('.doc') ? 'application/msword' : 'application/pdf')
      
      const uploadRes = await fetch('/api/uploads/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ filename: file.name, content_type: contentType }),
      })
      
      if (!uploadRes.ok) {
        throw new Error('Erro ao obter URL de upload')
      }
      
      const { upload_url, path, bucket } = await uploadRes.json()
      
      // Fazer upload do arquivo
      const fileRes = await fetch(upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file,
      })
      
      if (!fileRes.ok) {
        throw new Error('Erro ao fazer upload do arquivo')
      }
      
      // Extrair apenas o nome do arquivo do path
      const pathParts = path.split('/')
      const fileName = pathParts[pathParts.length - 1]
      
      return { path: fileName, bucket }
    } catch (error) {
      console.error('Erro no upload:', error)
      notify({ title: 'Erro ao fazer upload do CV', description: error instanceof Error ? error.message : 'Erro desconhecido', variant: 'error' })
      return null
    } finally {
      setUploadingResume(false)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      // Validar campos obrigatórios
      if (!form.name || !form.email || !form.phone || !form.job_id || !form.stage_id) {
        notify({ title: 'Campos obrigatórios', description: 'Preencha todos os campos obrigatórios (Nome, E-mail, Telefone, Vaga e Etapa)', variant: 'error' })
        setLoading(false)
        return
      }
      
      if (!form.resumeFile) {
        notify({ title: 'CV obrigatório', description: 'É necessário anexar um currículo', variant: 'error' })
        setLoading(false)
        return
      }
      
      // Fazer upload do CV primeiro
      const resumeData = await uploadResume(form.resumeFile)
      if (!resumeData) {
        setLoading(false)
        return
      }
      
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        city: form.city || null,
        state: form.state || null,
        address: form.address || null,
        children: form.children ? parseInt(form.children) : null,
        gender: form.gender || null,
        languages: form.languages,
        education: form.education || null,
        resume_path: resumeData.path,
        resume_bucket: resumeData.bucket,
        job_id: form.job_id,
        stage_id: form.stage_id,
      }
      
      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
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
      
      const candidateId = (await res.json()).id
      setForm({ name: '', email: '', phone: '', job_id: '', stage_id: '', city: '', state: '', address: '', children: '', gender: '', languages: [], education: '', resumeFile: null })
      setLanguageInput('')
      await load()
      notify({ title: 'Candidato criado e atribuído', variant: 'success' })
    } finally {
      setLoading(false)
    }
  }

  const avgScoreToPct = (v?: number | null) => v == null ? null : Math.round((Number(v) || 0) * 100) / 100

  return (
    <div className="space-y-6">
      {/* Header e ações */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-semibold">Gerenciar Candidatos</h1>
          <p className="text-gray-600 text-base">Acompanhe todos os candidatos em seu pipeline</p>
        </div>
        <a href="/jobs" className="btn btn-outline">Voltar às Vagas</a>
      </div>

      {/* Cards de métricas (placeholders simples) */}
      <div className="grid md:grid-cols-4 gap-6">
        <div className="card p-7">
          <div className="text-sm text-gray-600">Total de Candidatos</div>
          <div className="text-4xl font-semibold mt-2">{total}</div>
          <div className="text-xs text-gray-500 mt-1">+12 esta semana</div>
        </div>
        <div className="card p-7">
          <div className="text-sm text-gray-600">Novos Candidatos</div>
          <div className="text-4xl font-semibold mt-2">—</div>
          <div className="text-xs text-gray-500 mt-1">Aguardando triagem</div>
        </div>
        <div className="card p-7">
          <div className="text-sm text-gray-600">Em Processo</div>
          <div className="text-4xl font-semibold mt-2">—</div>
          <div className="text-xs text-gray-500 mt-1">Em diferentes etapas</div>
        </div>
        <div className="card p-7">
          <div className="text-sm text-gray-600">Contratados</div>
          <div className="text-4xl font-semibold mt-2">—</div>
          <div className="text-xs text-gray-500 mt-1">Este mês</div>
        </div>
      </div>

      {/* Form completo para novo candidato */}
      <form onSubmit={onSubmit} className="card p-7 grid gap-4 max-w-4xl">
        <h2 className="text-xl font-semibold mb-2">Cadastrar Novo Candidato</h2>
        
        {/* Campos obrigatórios */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Informações Obrigatórias</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nome *</label>
              <input value={form.name} onChange={(e)=>setForm((f)=>({ ...f, name: e.target.value }))} placeholder="Nome completo" className="border rounded px-3 py-2 w-full" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">E-mail *</label>
              <input value={form.email} onChange={(e)=>setForm((f)=>({ ...f, email: e.target.value }))} type="email" placeholder="email@exemplo.com" className="border rounded px-3 py-2 w-full" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Telefone *</label>
              <input value={form.phone} onChange={(e)=>setForm((f)=>({ ...f, phone: e.target.value }))} placeholder="(00) 00000-0000" className="border rounded px-3 py-2 w-full" required />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Vaga *</label>
              <select value={form.job_id} onChange={(e)=>setForm((f)=>({ ...f, job_id: e.target.value, stage_id: '' }))} className="w-full border rounded px-3 py-2" required>
                <option value="">Selecione a vaga</option>
                {availableJobs.map((j)=> <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            </div>
            {form.job_id && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Etapa *</label>
                <select value={form.stage_id} onChange={(e)=>setForm((f)=>({ ...f, stage_id: e.target.value }))} className="w-full border rounded px-3 py-2" required>
                  <option value="">Selecione a etapa</option>
                  {availableStages.map((s)=> <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">CV (Anexo) *</label>
            <input 
              type="file" 
              accept=".pdf,.doc,.docx"
              onChange={(e)=>{
                const file = e.target.files?.[0] || null
                if (file) {
                  const maxSize = 10 * 1024 * 1024 // 10MB
                  if (file.size > maxSize) {
                    notify({ title: 'Arquivo muito grande', description: `O arquivo deve ter no máximo 10MB. Tamanho atual: ${(file.size / 1024 / 1024).toFixed(2)}MB`, variant: 'error' })
                    e.target.value = ''
                    return
                  }
                }
                setForm((f)=>({ ...f, resumeFile: file }))
              }} 
              className="border rounded px-3 py-2 w-full" 
              required 
            />
            {form.resumeFile && (
              <p className="text-sm text-gray-600 mt-1">
                Arquivo: {form.resumeFile.name} ({(form.resumeFile.size / 1024 / 1024).toFixed(2)}MB)
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">Tamanho máximo: 10MB</p>
          </div>
        </div>

        {/* Campos opcionais */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Informações Opcionais</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cidade</label>
              <input value={form.city} onChange={(e)=>setForm((f)=>({ ...f, city: e.target.value }))} placeholder="Cidade" className="border rounded px-3 py-2 w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
              <input value={form.state} onChange={(e)=>setForm((f)=>({ ...f, state: e.target.value }))} placeholder="Estado" className="border rounded px-3 py-2 w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filhos</label>
              <input type="number" min="0" value={form.children} onChange={(e)=>setForm((f)=>({ ...f, children: e.target.value }))} placeholder="Número de filhos" className="border rounded px-3 py-2 w-full" />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Endereço</label>
              <input value={form.address} onChange={(e)=>setForm((f)=>({ ...f, address: e.target.value }))} placeholder="Endereço completo" className="border rounded px-3 py-2 w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sexo</label>
              <select value={form.gender} onChange={(e)=>setForm((f)=>({ ...f, gender: e.target.value }))} className="w-full border rounded px-3 py-2">
                <option value="">Selecione</option>
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Idiomas</label>
            <input 
              value={languageInput} 
              onChange={(e)=>setLanguageInput(e.target.value)} 
              onKeyDown={(e)=>{
                if(e.key==='Enter'){
                  e.preventDefault()
                  const v = languageInput.trim()
                  if(v) setForm((f)=>({ ...f, languages: [...f.languages, v] }))
                  setLanguageInput('')
                }
              }}
              placeholder="Digite um idioma e pressione Enter" 
              className="border rounded px-3 py-2 w-full" 
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {form.languages.map((lang, i)=>(
                <span key={i} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                  {lang}
                  <button type="button" onClick={()=>setForm((f)=>({ ...f, languages: f.languages.filter((_,idx)=>idx!==i) }))} className="text-blue-600 hover:text-blue-800">×</button>
                </span>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Formação</label>
            <textarea value={form.education} onChange={(e)=>setForm((f)=>({ ...f, education: e.target.value }))} placeholder="Descreva a formação do candidato" className="border rounded px-3 py-2 w-full h-24 resize-none" />
          </div>
        </div>

        <div className="border-t pt-4">
          <button disabled={loading || uploadingResume} className="btn btn-primary">
            {loading || uploadingResume ? 'Salvando...' : 'Cadastrar Candidato'}
          </button>
        </div>
      </form>

      {/* Filtros */}
      <div className="card p-7">
        <div className="flex items-center gap-4">
          <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar candidatos..." className="border rounded px-3 py-2 w-full max-w-2xl" />
          <button onClick={()=>{ setPage(1); load() }} className="btn btn-outline">Buscar</button>
        </div>
      </div>

      {/* Tabela de candidatos */}
      <div className="card p-0 overflow-x-auto">
        <div className="px-8 py-6 border-b">
          <h2 className="text-2xl font-semibold">Lista de Candidatos</h2>
          <div className="text-xs text-gray-500 mt-1">{candidates.length} candidato(s) encontrado(s)</div>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-gray-600">
            <tr className="border-b">
              <th className="py-3 px-5">Candidato</th>
              <th className="py-3 px-5">Vaga</th>
              <th className="py-3 px-5">Etapa</th>
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
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold">{(c.name||c.id).slice(0,2).toUpperCase()}</div>
                      <div>
                        <div className="font-medium text-gray-900">{c.name}</div>
                        <div className="text-xs text-gray-600">{c.email} {c.phone ? `• ${c.phone}` : ''}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-5">{c.latest_job_title ?? '—'}</td>
                  <td className="py-4 px-5">{c.latest_stage_name ?? '—'}</td>
                  <td className="py-4 px-5"><span className="badge badge-info">—</span></td>
                  <td className="py-4 px-5">{score == null ? '—' : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold">{Math.round(score)}%</span>
                  )}</td>
                  <td className="py-4 px-5">{appliedAt ? appliedAt.toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="py-4 px-5">{lastAct ? lastAct.toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-2 justify-end">
                      <button className="p-2 rounded-full border border-gray-200 hover:bg-gray-100 transition-colors" title="Visualizar" onClick={()=>setSelected(c)}>
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


