'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/components/ToastProvider'

const REQUIRED_IMPORT_HEADERS = [
  'nome',
  'email',
  'telefone',
  'vaga_titulo',
  'etapa_nome',
]

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
  resume_path?: string | null;
  resume_bucket?: string | null;
}

function parseCsv(text: string) {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let insideQuotes = false

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i]

    if (char === '"') {
      const nextChar = normalized[i + 1]
      if (insideQuotes && nextChar === '"') {
        currentField += '"'
        i++
      } else {
        insideQuotes = !insideQuotes
      }
      continue
    }

    if (char === ',' && !insideQuotes) {
      currentRow.push(currentField)
      currentField = ''
      continue
    }

    if (char === '\n' && !insideQuotes) {
      currentRow.push(currentField)
      rows.push(currentRow)
      currentRow = []
      currentField = ''
      continue
    }

    currentField += char
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField)
    rows.push(currentRow)
  }

  return rows
    .map((row) => row.map((cell) => cell.trim()))
    .filter((row) => row.some((cell) => cell !== ''))
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
  const [isCreateCandidateModalOpen, setIsCreateCandidateModalOpen] = useState(false)
  const [isDeleteCandidateModalOpen, setIsDeleteCandidateModalOpen] = useState(false)
  const [isImportCandidatesModalOpen, setIsImportCandidatesModalOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importProgress, setImportProgress] = useState<{ status: string; message: string } | null>(null)
  const [isUploadResumeModalOpen, setIsUploadResumeModalOpen] = useState(false)

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

  async function uploadResume(
    file: File,
    options?: { manageState?: boolean }
  ): Promise<{ path: string; bucket: string } | null> {
    const manageState = options?.manageState ?? true
    if (manageState) {
      setUploadingResume(true)
    }
    try {
      const maxSize = 10 * 1024 * 1024
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
      
      const fileRes = await fetch(upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file,
      })
      
      if (!fileRes.ok) {
        throw new Error('Erro ao fazer upload do arquivo')
      }
      
      return { path, bucket }
    } catch (error) {
      console.error('Erro no upload:', error)
      notify({ title: 'Erro ao fazer upload do CV', description: error instanceof Error ? error.message : 'Erro desconhecido', variant: 'error' })
      return null
    } finally {
      if (manageState) {
        setUploadingResume(false)
      }
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
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
      setIsCreateCandidateModalOpen(false)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteCandidate(candidateId: string) {
    try {
      const res = await fetch(`/api/candidates/${candidateId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })

      if (!res.ok) {
        const text = await res.text()
        let message = res.statusText || 'Erro ao deletar candidato'
        try {
          const data = text ? JSON.parse(text) : null
          message = data?.error?.message || message
        } catch {}
        notify({ title: 'Erro ao deletar', description: message, variant: 'error' })
        return
      }

      setSelected(null)
      setIsDeleteCandidateModalOpen(false)
      await load()
      notify({ title: 'Candidato deletado com sucesso', variant: 'success' })
    } catch (error) {
      notify({ title: 'Erro ao deletar candidato', description: error instanceof Error ? error.message : 'Erro desconhecido', variant: 'error' })
    }
  }

  async function handleImportCandidates() {
    if (!importFile) {
      notify({ title: 'Erro', description: 'Selecione um arquivo CSV', variant: 'error' })
      return
    }

    setImportLoading(true)
    setImportProgress({ status: 'processing', message: 'Processando arquivo...' })

    try {
      const text = await importFile.text()
      const rows = parseCsv(text)

      if (rows.length < 2) {
        notify({ title: 'Erro', description: 'O arquivo CSV deve ter pelo menos um candidato', variant: 'error' })
        setImportLoading(false)
        return
      }

      const headers = rows[0].map((h) => h.trim().toLowerCase())

      const missingHeaders = REQUIRED_IMPORT_HEADERS.filter((header) => !headers.includes(header))

      if (missingHeaders.length > 0) {
        notify({ title: 'Erro', description: `Cabeçalhos obrigatórios faltando: ${missingHeaders.join(', ')}`, variant: 'error' })
        setImportLoading(false)
        return
      }

      const candidates = []

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        if (row.length === 0 || row.every((cell) => cell === '')) {
          continue
        }

        const candidate: Record<string, string | null> = {}

        headers.forEach((header, idx) => {
          const value = row[idx] ?? ''
          const cleanedValue = value.replace(/^"|"$/g, '').trim()
          candidate[header] = cleanedValue === '' ? null : cleanedValue
        })

        candidates.push(candidate)
      }

      setImportProgress({ status: 'uploading', message: `Importando ${candidates.length} candidatos...` })

      // Enviar para o backend
      const res = await fetch('/api/candidates/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ candidates }),
      })

      if (!res.ok) {
        const text = await res.text()
        let message = res.statusText || 'Erro ao importar candidatos'
        try {
          const data = text ? JSON.parse(text) : null
          message = data?.error?.message || message
        } catch {}
        notify({ title: 'Erro na importação', description: message, variant: 'error' })
        setImportLoading(false)
        setImportProgress(null)
        return
      }

      const result = await res.json()
      
      setImportProgress(null)
      setImportFile(null)
      setIsImportCandidatesModalOpen(false)
      await load()
      
      notify({ 
        title: 'Importação concluída!', 
        description: `${result.imported || 0} candidatos importados com sucesso${result.errors?.length ? `, ${result.errors.length} erros` : ''}`,
        variant: 'success' 
      })
    } catch (error) {
      notify({ title: 'Erro ao processar arquivo', description: error instanceof Error ? error.message : 'Erro desconhecido', variant: 'error' })
    } finally {
      setImportLoading(false)
      setImportProgress(null)
    }
  }

  async function handleUploadResumeForCandidate(candidateId: string, resumeFile: File) {
    try {
      const resumeData = await uploadResume(resumeFile, { manageState: false })
      if (!resumeData) {
        return
      }

      setUploadingResume(true)

      // Atualizar candidato com resume_path e resume_bucket
      const updateRes = await fetch(`/api/candidates/${candidateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          resume_path: resumeData.path,
          resume_bucket: resumeData.bucket,
        }),
      })

      if (!updateRes.ok) {
        notify({ title: 'Erro', description: 'Erro ao associar currículo ao candidato', variant: 'error' })
        return
      }

      setIsUploadResumeModalOpen(false)
      setSelected(null)
      await load()
      notify({ title: 'Currículo anexado com sucesso!', variant: 'success' })
    } catch (error) {
      notify({ title: 'Erro ao fazer upload', description: error instanceof Error ? error.message : 'Erro desconhecido', variant: 'error' })
    } finally {
      setUploadingResume(false)
    }
  }

  const avgScoreToPct = (v?: number | null) => v == null ? null : Math.round((Number(v) || 0) * 100) / 100

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm -mx-4 md:-mx-8 px-4 md:px-8 mb-8">
        <div className="flex w-full flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm text-gray-500">Dashboard / Candidatos</div>
            <h1 className="mt-2 text-2xl font-semibold text-gray-900">Gerenciar Candidatos</h1>
            <p className="text-sm text-gray-600">Acompanhe e gerencie todos os candidatos em seu pipeline</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsImportCandidatesModalOpen(true)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              📥 Importar Candidatos
            </button>
            <button className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Exportar
            </button>
            <button onClick={() => setIsCreateCandidateModalOpen(true)} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-700">
              + Criar Candidato
            </button>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="text-sm text-gray-600">Total</div>
            <div className="mt-2 text-3xl font-semibold text-gray-900">{total}</div>
            <div className="mt-1 text-xs text-gray-500">candidatos</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="text-sm text-gray-600">Novos</div>
            <div className="mt-2 text-3xl font-semibold text-gray-900">—</div>
            <div className="mt-1 text-xs text-gray-500">aguardando triagem</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="text-sm text-gray-600">Em Processo</div>
            <div className="mt-2 text-3xl font-semibold text-gray-900">—</div>
            <div className="mt-1 text-xs text-gray-500">em diferentes etapas</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="text-sm text-gray-600">Score Médio</div>
            <div className="mt-2 text-3xl font-semibold text-gray-900">—</div>
            <div className="mt-1 text-xs text-gray-500">compatibilidade IA</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-4">
          <input 
            value={search} 
            onChange={(e)=>setSearch(e.target.value)} 
            placeholder="Buscar candidatos..." 
            className="border rounded px-3 py-2 w-full max-w-2xl" 
          />
          <button onClick={()=>{ setPage(1); load() }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Buscar
          </button>
        </div>

        {/* Tabela */}
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="px-8 py-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Lista de Candidatos</h2>
            <div className="text-xs text-gray-500 mt-1">{candidates.length} candidato(s) encontrado(s)</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-600 bg-gray-50 border-b">
                <tr>
                  <th className="py-3 px-5 font-medium">Candidato</th>
                  <th className="py-3 px-5 font-medium">Vaga</th>
                  <th className="py-3 px-5 font-medium">Etapa</th>
                  <th className="py-3 px-5 font-medium">Status</th>
                  <th className="py-3 px-5 font-medium">Score IA</th>
                  <th className="py-3 px-5 font-medium">Aplicado em</th>
                  <th className="py-3 px-5 font-medium">Currículo</th>
                  <th className="py-3 px-5 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c)=>{
                  const score = avgScoreToPct(c.avg_score)
                  const appliedAt = c.created_at ? new Date(c.created_at) : null
                  return (
                    <tr key={c.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-sm">
                            {(c.name||c.id).slice(0,2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{c.name}</div>
                            <div className="text-xs text-gray-600">{c.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-gray-700">{c.latest_job_title ?? '—'}</td>
                      <td className="py-4 px-5 text-gray-700">{c.latest_stage_name ?? '—'}</td>
                      <td className="py-4 px-5">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          —
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        {score == null ? '—' : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                            {Math.round(score)}%
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-gray-700">{appliedAt ? appliedAt.toLocaleDateString('pt-BR') : '—'}</td>
                      <td className="py-4 px-5 text-gray-700">
                        <div className="flex items-center gap-3">
                          {c.resume_path ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                              Sim
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                              Não
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSelected(c)
                              setIsUploadResumeModalOpen(true)
                            }}
                            disabled={uploadingResume}
                            className="rounded-md border border-blue-200 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                          >
                            {c.resume_path ? 'Atualizar PDF' : 'Anexar PDF'}
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-right">
                        <button 
                          onClick={()=>setSelected(c)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          title="Visualizar"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                        <button
                          onClick={() => { setSelected(c); setIsDeleteCandidateModalOpen(true) }}
                          className="ml-2 text-red-400 hover:text-red-600 transition-colors"
                          title="Deletar"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Paginação */}
        <div className="flex items-center gap-3">
          <button disabled={page<=1} onClick={()=>setPage((p)=>Math.max(1, p-1))} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Anterior
          </button>
          <span className="text-sm text-gray-700">Página {page} de {Math.max(1, Math.ceil(total / pageSize))}</span>
          <button disabled={page>=Math.ceil(total / pageSize)} onClick={()=>setPage((p)=>p+1)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Próxima
          </button>
        </div>
      </div>

      {/* Modal de Importação */}
      {isImportCandidatesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Importar Candidatos</h2>
              <button onClick={() => setIsImportCandidatesModalOpen(false)} className="text-gray-500 hover:text-gray-800" aria-label="Fechar">
                ✕
              </button>
            </div>
            <div className="px-6 py-6 space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">📄 Baixar Template</h3>
                <p className="text-xs text-gray-600 mb-3">Clique no botão abaixo para baixar a planilha template com as colunas corretas:</p>
                <button
                  onClick={() => {
                    const link = document.createElement('a')
                    link.href = '/candidatos_template.csv'
                    link.download = 'candidatos_template.csv'
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                  }}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Baixar candidatos_template.csv
                </button>
              </div>
              
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">🧪 Arquivo de Teste</h3>
                <p className="text-xs text-gray-600 mb-3">Ou use este arquivo com 14 candidatos pré-preenchidos para testar:</p>
                <button
                  onClick={() => {
                    const link = document.createElement('a')
                    link.href = '/candidatos_teste.csv'
                    link.download = 'candidatos_teste.csv'
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                  }}
                  className="w-full rounded-lg border border-green-300 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
                >
                  Baixar candidatos_teste.csv
                </button>
              </div>

              <div className="border-t pt-4">
                <p className="text-xs text-gray-600 mb-2">
                  <strong>📝 Próximos passos:</strong>
                </p>
                <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
                  <li>Preencha o template com seus dados</li>
                  <li>Clique em "Importar Candidatos" novamente</li>
                  <li>Selecione seu arquivo CSV</li>
                  <li>Revise e confirme a importação</li>
                </ol>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">📤 Fazer Upload do Arquivo</h3>
                <div className="space-y-3">
                  <div className="rounded-lg border-2 border-dashed border-gray-300 p-4 text-center">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                      disabled={importLoading}
                      className="hidden"
                      id="import-file-input"
                    />
                    <label htmlFor="import-file-input" className="cursor-pointer">
                      <div className="text-sm text-gray-600">
                        {importFile ? (
                          <div>
                            <div className="font-medium text-green-600">✓ {importFile.name}</div>
                            <div className="text-xs text-gray-500 mt-1">Clique para trocar o arquivo</div>
                          </div>
                        ) : (
                          <div>
                            <div className="font-medium text-gray-900">Clique ou arraste um arquivo CSV</div>
                            <div className="text-xs text-gray-500 mt-1">Máximo de 50 MB</div>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                  
                  {importProgress && (
                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                      <div className="text-sm font-medium text-blue-900">{importProgress.message}</div>
                      <div className="mt-2 h-1 bg-blue-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 animate-pulse" style={{width: '100%'}}></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => {
                  setIsImportCandidatesModalOpen(false)
                  setImportFile(null)
                  setImportProgress(null)
                }}
                disabled={importLoading}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Fechar
              </button>
              <button
                onClick={handleImportCandidates}
                disabled={!importFile || importLoading}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importLoading ? '⏳ Importando...' : '📤 Importar Candidatos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Upload Currículo */}
      {isUploadResumeModalOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Anexar Currículo</h2>
              <button 
                onClick={() => { 
                  setIsUploadResumeModalOpen(false)
                  setSelected(null)
                }} 
                className="text-gray-500 hover:text-gray-800" 
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-6 space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  Anexar currículo para <strong>{selected.name}</strong>
                </p>
                <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        handleUploadResumeForCandidate(selected.id, file)
                      }
                    }}
                    disabled={uploadingResume}
                    className="hidden"
                    id="resume-file-input"
                  />
                  <label htmlFor="resume-file-input" className="cursor-pointer block">
                    <div className="text-3xl mb-2">📄</div>
                    <div className="text-sm font-medium text-gray-900">Clique para selecionar arquivo</div>
                    <div className="text-xs text-gray-500 mt-1">Apenas PDF (máx. 10 MB)</div>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => {
                  setIsUploadResumeModalOpen(false)
                  setSelected(null)
                }}
                disabled={uploadingResume}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalhes */}
      {selected && !isUploadResumeModalOpen && !isDeleteCandidateModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">{selected.name}</h2>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-800" aria-label="Fechar">
                ✕
              </button>
            </div>
            <div className="px-6 py-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-700">Email</div>
                  <div className="text-sm text-gray-900 mt-1">{selected.email || '—'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700">Telefone</div>
                  <div className="text-sm text-gray-900 mt-1">{selected.phone || '—'}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-700">Vaga</div>
                  <div className="text-sm text-gray-900 mt-1">{selected.latest_job_title || '—'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700">Etapa</div>
                  <div className="text-sm text-gray-900 mt-1">{selected.latest_stage_name || '—'}</div>
                </div>
              </div>
              {selected.avg_score !== null && (
                <div>
                  <div className="text-sm font-medium text-gray-700">Score IA</div>
                  <div className="text-sm text-gray-900 mt-1">{Math.round((selected.avg_score || 0) * 100) / 100}%</div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 border-t border-gray-200 px-6 py-4">
              <button onClick={() => setSelected(null)} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    
      {/* Modal de Confirmação de Exclusão */}
      {isDeleteCandidateModalOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Deletar Candidato</h2>
              <button onClick={() => setIsDeleteCandidateModalOpen(false)} className="text-gray-500 hover:text-gray-800" aria-label="Fechar">
                ✕
              </button>
            </div>
            <div className="px-6 py-6 space-y-4">
              <p className="text-sm text-gray-700">
                Tem certeza de que deseja deletar o candidato <strong>{selected.name}</strong>?
              </p>
              <p className="text-sm text-gray-600">
                Esta ação é irreversível e removerá todas as suas informações e aplicações do sistema.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setIsDeleteCandidateModalOpen(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteCandidate(selected.id)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Deletar
              </button>
            </div>
          </div>
        </div>
      )}
    
      {/* Modal de Criar Candidato */}
      {isCreateCandidateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 sticky top-0 bg-white">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Cadastrar Novo Candidato</h2>
                <p className="text-sm text-gray-500">Preencha os dados do candidato para adicionar à plataforma</p>
              </div>
              <button onClick={() => setIsCreateCandidateModalOpen(false)} className="text-gray-500 hover:text-gray-800" aria-label="Fechar">
                ✕
              </button>
            </div>
            
            <form onSubmit={(e) => { onSubmit(e); }} className="p-6 grid gap-4">
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
                        const maxSize = 10 * 1024 * 1024
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

              <div className="border-t pt-4 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setIsCreateCandidateModalOpen(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancelar
                </button>
                <button disabled={loading || uploadingResume} className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60">
                  {loading || uploadingResume ? 'Salvando...' : 'Cadastrar Candidato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}


