'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '@/components/ToastProvider'
import StageAnalysisPanel from './_components/StageAnalysisPanel'

type Stage = { id: string; name: string; description: string | null; order_index: number; threshold: number; stage_weight: number }
type Candidate = { id: string; name: string; email?: string }
type PromptTemplate = { id: string; name: string; is_default: boolean }
type StageAnalysisResult = {
  run_id: string
  status: 'pending' | 'running' | 'succeeded' | 'failed'
  result?: {
    score?: number
    analysis?: string
    matched_requirements?: string[]
    missing_requirements?: string[]
    strengths?: string[]
    weaknesses?: string[]
    recommendations?: string[]
  }
  application_stage_id?: string
  stage_id?: string | null
  application_id?: string | null
  created_at?: string
}

function StagePromptSelector({
  stageId,
  templates,
  selected,
  loading,
  onChange,
}: {
  stageId: string
  templates: PromptTemplate[]
  selected: string | null
  loading: boolean
  onChange: (stageId: string, templateId: string | null) => Promise<void>
}) {
  const defaultTemplate = templates.find((t) => t.is_default) || null

  return (
    <div className="border-t pt-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="font-medium">Prompt desta etapa</h4>
          <p className="text-sm text-gray-600">
            Escolha o template que instruirá a IA para analisar currículos nesta etapa.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selected ?? ''}
            onChange={(e) => onChange(stageId, e.target.value || null)}
            className="border rounded px-3 py-2 min-w-[220px]"
            disabled={loading}
          >
            <option value="">
              {defaultTemplate ? `Usar padrão (${defaultTemplate.name})` : 'Selecione um template'}
            </option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
                {template.is_default ? ' (padrão)' : ''}
              </option>
            ))}
          </select>
          <a href="/settings/prompts" className="text-sm text-blue-600 underline">
            Gerenciar templates
          </a>
        </div>
      </div>
    </div>
  )
}

async function fetchPromptTemplates(): Promise<PromptTemplate[]> {
  const res = await fetch('/api/prompt-templates')
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error?.message || 'Erro ao carregar templates')
  return json.items || []
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'same-origin',
    ...(init || {}),
  })
  const text = await res.text()
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch (error) {
    if (!res.ok) {
      const message = text || res.statusText || 'Erro de API'
      throw new Error(message)
    }
    throw error
  }
  if (!res.ok) {
    const message = json?.error?.message || text || res.statusText || 'Erro de API'
    throw new Error(message)
  }
  return (json ?? {}) as T
}

export default function JobStagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { notify } = useToast()
  const [jobId, setJobId] = useState<string | null>(null)
  const [stages, setStages] = useState<Stage[]>([])
  const [creating, setCreating] = useState(false)
  const [stageForm, setStageForm] = useState({ name: '', description: '', threshold: 0, stage_weight: 1 })
  const [editingStageId, setEditingStageId] = useState<string | null>(null)
  const [editingStageForm, setEditingStageForm] = useState<{ name: string; description: string; threshold: number; stage_weight: number }>({ name: '', description: '', threshold: 0, stage_weight: 1 })

  // Candidates assigned to the job (simplificado: todos candidatos do tenant)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const [applications, setApplications] = useState<any[]>([])
  
  // Candidato selecionado para cada etapa
  const [stageSelectedCandidates, setStageSelectedCandidates] = useState<Record<string, string | null>>({})
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([])
  const [stagePromptMap, setStagePromptMap] = useState<Record<string, string | null>>({})
  const [promptLoadingStage, setPromptLoadingStage] = useState<string | null>(null)
  const [analysisByStage, setAnalysisByStage] = useState<Record<string, StageAnalysisResult | null>>({})
  const [analysisLoading, setAnalysisLoading] = useState<Record<string, boolean>>({})
  const [analysisExpanded, setAnalysisExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    ;(async () => {
      const { id } = await params
      setJobId(id)
      const job = await api<{ item?: { id: string; title: string } }>(`/api/jobs/${id}`)
      if (!job?.item) {
        notify({ title: 'Vaga não encontrada', variant: 'error' })
        return
      }

      const { items } = await api<{ items: Stage[] }>(`/api/jobs/${id}/stages`)
      setStages(items)
      setAnalysisByStage((prev) => {
        const next: Record<string, StageAnalysisResult | null> = {}
        items.forEach((stage) => { next[stage.id] = prev[stage.id] ?? null })
        return next
      })
      setAnalysisLoading((prev) => {
        const next: Record<string, boolean> = {}
        items.forEach((stage) => { next[stage.id] = prev[stage.id] ?? false })
        return next
      })
      setAnalysisExpanded((prev) => {
        const next: Record<string, boolean> = {}
        items.forEach((stage) => { next[stage.id] = prev[stage.id] ?? false })
        return next
      })
      // carregar candidatos (somente do usuário)
      const cand = await api<{ items: Candidate[] }>('/api/candidates').catch(() => ({ items: [] }))
      setCandidates(cand.items || [])
      const apps = await api<{ items: any[] }>(`/api/jobs/${id}/applications`).catch(() => ({ items: [] }))
      setApplications(apps.items || [])
      try {
        const pts = await fetchPromptTemplates()
        setPromptTemplates(pts)
      } catch (error: any) {
        notify({ title: 'Erro ao carregar templates', description: error?.message, variant: 'error' })
      }
    })()
  }, [params])


  useEffect(() => {
    stages.forEach((s) => {
      if (!stagePromptMap.hasOwnProperty(s.id)) loadPromptForStage(s.id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages])

  async function loadPromptForStage(stageId: string) {
    setPromptLoadingStage(stageId)
    try {
      const res = await fetch(`/api/stages/${stageId}/prompt-template`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error?.message || 'Erro ao buscar template da etapa')
      setStagePromptMap((prev) => ({ ...prev, [stageId]: json.item?.prompt_template_id ?? null }))
    } catch (error: any) {
      notify({ title: 'Erro ao carregar template da etapa', description: error?.message, variant: 'error' })
    } finally {
      setPromptLoadingStage(null)
    }
  }

  async function handleStagePromptChange(stageId: string, templateId: string | null) {
    setPromptLoadingStage(stageId)
    try {
      const res = await fetch(`/api/stages/${stageId}/prompt-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt_template_id: templateId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error?.message || 'Erro ao definir template da etapa')
      setStagePromptMap((prev) => ({ ...prev, [stageId]: templateId }))
      notify({ title: 'Template da etapa atualizado', variant: 'success' })
    } catch (error: any) {
      notify({ title: 'Erro ao salvar template', description: error?.message, variant: 'error' })
    } finally {
      setPromptLoadingStage(null)
    }
  }

  async function createStage(e: React.FormEvent) {
    e.preventDefault()
    if (!jobId) return
    setCreating(true)
    try {
      const res = await api<{ id: string }>(`/api/jobs/${jobId}/stages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stageForm),
      })
      const { items } = await api<{ items: Stage[] }>(`/api/jobs/${jobId}/stages`)
      setStages(items)
      setStageForm({ name: '', description: '', threshold: 0, stage_weight: 1 })
      notify({ title: 'Etapa criada', variant: 'success' })
    } finally {
      setCreating(false)
    }
  }

  const selectedCandidate = useMemo(() => candidates.find((c) => c.id === selectedCandidateId) || null, [candidates, selectedCandidateId])
  const selectedApplicationId = useMemo(() => {
    if (!selectedCandidateId) return null
    const app = applications.find((a) => a.candidate_id === selectedCandidateId)
    return app?.id || null
  }, [applications, selectedCandidateId])

  // Função para obter application_id de um candidato específico
  const getApplicationId = useCallback((candidateId: string | null) => {
    if (!candidateId) return null
    const app = applications.find((a) => a.candidate_id === candidateId)
    return app?.id || null
  }, [applications])

  const loadAnalysisForStage = useCallback(async (stageId: string, candidateId: string | null) => {
    if (!candidateId) {
      console.log(`[DEBUG] loadAnalysisForStage: candidato não selecionado para etapa ${stageId}`)
      setAnalysisByStage((prev) => ({ ...prev, [stageId]: null }))
      return
    }
    const applicationId = getApplicationId(candidateId)
    if (!applicationId) {
      console.log(`[DEBUG] loadAnalysisForStage: applicationId não encontrado para candidato ${candidateId}`)
      setAnalysisByStage((prev) => ({ ...prev, [stageId]: null }))
      return
    }
    console.log(`[DEBUG] Carregando análise para etapa ${stageId}, candidato ${candidateId}, applicationId ${applicationId}`)
    setAnalysisLoading((prev) => ({ ...prev, [stageId]: true }))
    try {
      const res = await fetch(`/api/stages/${stageId}/analysis?application_id=${encodeURIComponent(applicationId)}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error?.message || 'Erro ao buscar análise da IA')
      }
      const json = await res.json()
      console.log(`[DEBUG] Análise carregada para etapa ${stageId}:`, json.item)
      setAnalysisByStage((prev) => ({ ...prev, [stageId]: json.item || null }))
    } catch (error: any) {
      console.error('Erro ao carregar análise da etapa', error)
      notify({ title: 'Erro ao carregar análise', description: error?.message || 'Não foi possível carregar o relatório da IA.', variant: 'error' })
      setAnalysisByStage((prev) => ({ ...prev, [stageId]: null }))
    } finally {
      setAnalysisLoading((prev) => ({ ...prev, [stageId]: false }))
    }
  }, [getApplicationId, notify])

  // Função para carregar automaticamente a análise mais recente de cada etapa
  const loadLatestAnalysisForStage = useCallback(async (stageId: string) => {
    console.log(`[DEBUG] Carregando análise mais recente para etapa ${stageId}`)
    setAnalysisLoading((prev) => ({ ...prev, [stageId]: true }))
    try {
      const res = await fetch(`/api/stages/${stageId}/analysis/latest`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (err?.error?.code === 'not_found') {
          console.log(`[DEBUG] Nenhuma análise encontrada para etapa ${stageId}`)
          setAnalysisByStage((prev) => ({ ...prev, [stageId]: null }))
          return
        }
        throw new Error(err?.error?.message || 'Erro ao buscar análise da IA')
      }
      const json = await res.json()
      console.log(`[DEBUG] Análise mais recente carregada para etapa ${stageId}:`, json.item)
      if (json.item) {
        setAnalysisByStage((prev) => ({ ...prev, [stageId]: json.item }))
        setAnalysisExpanded((prev) => ({ ...prev, [stageId]: true }))
        // Selecionar automaticamente o candidato da análise
        if (json.item.application_id) {
          const candidate = applications.find(app => app.id === json.item.application_id)?.candidate_id
          if (candidate) {
            setStageSelectedCandidates((prev) => ({ ...prev, [stageId]: candidate }))
          }
        }
      } else {
        setAnalysisByStage((prev) => ({ ...prev, [stageId]: null }))
      }
    } catch (error: any) {
      console.error('Erro ao carregar análise mais recente da etapa', error)
      setAnalysisByStage((prev) => ({ ...prev, [stageId]: null }))
    } finally {
      setAnalysisLoading((prev) => ({ ...prev, [stageId]: false }))
    }
  }, [applications])

  // Carregar automaticamente a análise mais recente para cada etapa
  useEffect(() => {
    console.log(`[DEBUG] useEffect auto-load: stages=${stages.length}, applications=${applications.length}`)
    if (stages.length > 0 && applications.length > 0) {
      console.log(`[DEBUG] Carregando análises automáticas para ${stages.length} etapas`)
      stages.forEach((stage) => {
        console.log(`[DEBUG] Carregando análise para etapa: ${stage.id} - ${stage.name}`)
        loadLatestAnalysisForStage(stage.id)
      })
    }
  }, [stages, applications, loadLatestAnalysisForStage])

  const handleStageCandidateSelection = useCallback((stageId: string, candidateId: string | null) => {
    setStageSelectedCandidates((prev) => ({ ...prev, [stageId]: candidateId }))
    if (!candidateId) {
      setAnalysisByStage((prev) => ({ ...prev, [stageId]: null }))
      setAnalysisExpanded((prev) => ({ ...prev, [stageId]: false }))
      return
    }
    setAnalysisExpanded((prev) => ({ ...prev, [stageId]: prev[stageId] ?? true }))
    loadAnalysisForStage(stageId, candidateId)
  }, [loadAnalysisForStage])

  async function assignCandidate() {
    if (!jobId || !selectedCandidateId) return
    await api(`/api/jobs/${jobId}/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidate_id: selectedCandidateId }),
    })
    const apps = await fetch(`/api/jobs/${jobId}/applications`).then((r) => r.json())
    setApplications(apps.items || [])
    notify({ title: 'Candidato atribuído', variant: 'success' })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Etapas da Vaga</h1>

      <section className="card p-4 space-y-3 max-w-2xl">
        <h2 className="font-medium">Criar etapa</h2>
        <form onSubmit={createStage} className="grid gap-3">
          <input
            value={stageForm.name}
            onChange={(e) => setStageForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Nome da etapa"
            className="border rounded px-3 py-2"
            required
          />
          <textarea
            value={stageForm.description}
            onChange={(e) => setStageForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Descrição detalhada da etapa"
            className="border rounded px-3 py-2"
            rows={3}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              step="0.01"
              value={stageForm.threshold}
              onChange={(e) => setStageForm((f) => ({ ...f, threshold: Number(e.target.value) }))}
              placeholder="Threshold (mínimo para aprovar)"
              className="border rounded px-3 py-2"
            />
            <input
              type="number"
              step="0.01"
              value={stageForm.stage_weight}
              onChange={(e) => setStageForm((f) => ({ ...f, stage_weight: Number(e.target.value) }))}
              placeholder="Peso da etapa"
              className="border rounded px-3 py-2"
            />
          </div>
          <button disabled={creating} className="btn btn-primary">
            {creating ? 'Criando...' : 'Adicionar etapa'}
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="font-medium">Selecionar candidato para avaliação</h2>
        <select
          className="border rounded px-3 py-2"
          value={selectedCandidateId ?? ''}
          onChange={(e) => setSelectedCandidateId(e.target.value || null)}
        >
          <option value="">Selecione um candidato</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.email ? `(${c.email})` : ''}
            </option>
          ))}
        </select>
        <button onClick={assignCandidate} disabled={!selectedCandidateId} className="ml-2 btn btn-primary">
          Atribuir à vaga
        </button>
        <div className="text-sm text-gray-700">
          Atribuídos:
          <ul className="list-disc pl-5">
            {applications.map((a) => {
              const c = candidates.find((x) => x.id === a.candidate_id)
              return (
                <li key={a.id}>
                  {c?.name || a.candidate_id}
                  <button className="ml-2 text-red-600 underline" onClick={async()=>{ if(!confirm('Remover candidato desta vaga?')) return; await fetch(`/api/applications/${a.id}`, { method: 'DELETE' }); const apps = await fetch(`/api/jobs/${jobId}/applications`).then((r)=>r.json()); setApplications(apps.items || []) }}>Remover</button>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      {/* Header simples */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Etapas da Vaga</h1>
        <p className="text-gray-600">Gerencie as etapas do processo seletivo e analise candidatos</p>
      </div>

      {/* Layout principal com etapas à esquerda e análise à direita */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Etapas à esquerda */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Etapas Configuradas</h2>
          {stages.map((s) => (
            <div key={s.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {/* Header da etapa */}
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-4">
                    {editingStageId === s.id ? (
                      <div className="grid gap-3">
                        <input
                          value={editingStageForm.name}
                          onChange={(e) => setEditingStageForm((f) => ({ ...f, name: e.target.value }))}
                          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Nome da etapa"
                        />
                        <textarea
                          value={editingStageForm.description}
                          onChange={(e) => setEditingStageForm((f) => ({ ...f, description: e.target.value }))}
                          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          rows={3}
                          placeholder="Descrição detalhada da etapa"
                        />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Threshold</label>
                            <input
                              type="number"
                              step="0.01"
                              value={editingStageForm.threshold}
                              onChange={(e) => setEditingStageForm((f) => ({ ...f, threshold: Number(e.target.value) }))}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Peso</label>
                            <input
                              type="number"
                              step="0.01"
                              value={editingStageForm.stage_weight}
                              onChange={(e) => setEditingStageForm((f) => ({ ...f, stage_weight: Number(e.target.value) }))}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-gray-900">{s.name}</h3>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                              Threshold: {s.threshold}
                            </span>
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                              Peso: {s.stage_weight}
                            </span>
                          </div>
                        </div>
                        {s.description && (
                          <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{s.description}</p>
                        )}
                      </>
                    )}
                  </div>
                  {editingStageId === s.id ? (
                    <div className="flex gap-2">
                      <button 
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200" 
                        onClick={async()=>{
                          await fetch(`/api/stages/${s.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingStageForm) })
                          const { items } = await api<{ items: Stage[] }>(`/api/jobs/${jobId}/stages`)
                          setStages(items); setEditingStageId(null)
                          notify({ title: 'Etapa atualizada', variant: 'success' })
                        }}
                      >
                        Salvar
                      </button>
                      <button 
                        className="border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200" 
                        onClick={()=>setEditingStageId(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button 
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors duration-200" 
                        onClick={()=>{ setEditingStageId(s.id); setEditingStageForm({ name: s.name, description: s.description || '', threshold: s.threshold, stage_weight: s.stage_weight }) }}
                      >
                        Editar
                      </button>
                      <button 
                        className="text-red-600 hover:text-red-700 text-sm font-medium transition-colors duration-200" 
                        onClick={async()=>{ if(!confirm('Remover etapa?')) return; await fetch(`/api/stages/${s.id}`, { method: 'DELETE' }); const { items } = await api<{ items: Stage[] }>(`/api/jobs/${jobId}/stages`); setStages(items); notify({ title: 'Etapa removida', variant: 'success' }) }}
                      >
                        Remover
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Conteúdo da etapa */}
              <div className="p-6 space-y-6">
                <StagePromptSelector
                  stageId={s.id}
                  templates={promptTemplates}
                  selected={stagePromptMap[s.id] ?? null}
                  loading={promptLoadingStage === s.id}
                  onChange={handleStagePromptChange}
                />
                
                {/* Seção de análise de candidato */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Análise de Candidato
                  </h4>
                  
                  {/* Seletor de candidato */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Candidato para avaliação:</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={stageSelectedCandidates[s.id] ?? ''}
                        onChange={(e) => {
                          console.log('[DEBUG] Candidato selecionado para etapa', s.id, ':', e.target.value)
                          handleStageCandidateSelection(s.id, e.target.value || null)
                        }}
                      >
                        <option value="">Selecione um candidato</option>
                        {applications.map((app) => {
                          const candidate = candidates.find(c => c.id === app.candidate_id)
                          return (
                            <option key={app.id} value={app.candidate_id}>
                              {candidate?.name || app.candidate_id} {candidate?.email ? `(${candidate.email})` : ''}
                            </option>
                          )
                        })}
                      </select>
                      {stageSelectedCandidates[s.id] && (
                        <span className="text-sm text-green-600 font-medium flex items-center px-2 py-1 bg-green-50 rounded-md">
                          ✓ {candidates.find(c => c.id === stageSelectedCandidates[s.id])?.name}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Componente de upload e análise */}
                  <UploadAndEvaluate 
                    stageId={s.id} 
                    applicationId={getApplicationId(stageSelectedCandidates[s.id])}
                    candidateName={candidates.find(c => c.id === stageSelectedCandidates[s.id])?.name}
                    onRunFinished={(stageId, runId, applicationStageId) => {
                      console.log(`[DEBUG] onRunFinished chamado para stageId: ${stageId}, runId: ${runId}`)
                      const currentCandidate = stageSelectedCandidates[stageId] ?? null
                      console.log(`[DEBUG] Candidato atual para etapa ${stageId}: ${currentCandidate}`)
                      if (currentCandidate) {
                        console.log(`[DEBUG] Recarregando análise para etapa ${stageId}`)
                        loadAnalysisForStage(stageId, currentCandidate)
                        setAnalysisExpanded((prev) => ({ ...prev, [stageId]: true }))
                      } else {
                        console.log(`[DEBUG] Nenhum candidato selecionado para etapa ${stageId}`)
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Painel de análise à direita */}
        <div className="lg:col-span-1">
          <div className="sticky top-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Análises de Candidatos</h2>
            <div className="space-y-4">
              {stages.map((s) => (
                <StageAnalysisPanel
                  key={s.id}
                  candidateName={stageSelectedCandidates[s.id] ? (candidates.find((c) => c.id === stageSelectedCandidates[s.id])?.name || null) : null}
                  analysis={stageSelectedCandidates[s.id] ? (analysisByStage[s.id] || null) : null}
                  loading={Boolean(analysisLoading[s.id])}
                  expanded={analysisExpanded[s.id] ?? false}
                  onToggle={() => setAnalysisExpanded((prev) => ({ ...prev, [s.id]: !(prev[s.id] ?? false) }))}
                  onRefresh={() => {
                    const candidateId = stageSelectedCandidates[s.id] ?? null
                    if (candidateId) loadAnalysisForStage(s.id, candidateId)
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <section>
        <h2 className="font-medium">Painel de candidatos (MVP)</h2>
        <Panel jobId={jobId} />
      </section>
    </div>
  )
}

function UploadAndEvaluate({ stageId, applicationId, candidateName, onRunFinished }: { stageId: string; applicationId: string | null; candidateName?: string; onRunFinished?: (stageId: string, runId: string, applicationStageId: string) => void }) {
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [runId, setRunId] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)
  const [appStageIdForPoller, setAppStageIdForPoller] = useState<string | null>(null)

  async function uploadToSignedUrl(uploadUrl: string, file: File, contentType: string) {
    const r = await fetch(uploadUrl, { 
      method: 'PUT', 
      headers: { 
        'Content-Type': contentType,
        'Cache-Control': 'max-age=3600'
      }, 
      body: file 
    })
    if (!r.ok) {
      const errorText = await r.text()
      console.error('Upload error:', r.status, errorText)
      throw new Error(`Falha no upload: ${r.status} - ${errorText}`)
    }
  }

  async function handleSubmit() {
    console.log('[DEBUG] handleSubmit chamado')
    console.log('[DEBUG] applicationId:', applicationId)
    console.log('[DEBUG] stageId:', stageId)
    setSubmitting(true)
    try {
      if (!applicationId) {
        console.log('[DEBUG] applicationId é null - exibindo erro')
        try { const { useToast } = require('@/components/ToastProvider'); const { notify } = useToast(); notify({ title: 'Selecione um candidato', description: 'Atribua um candidato à vaga antes de avaliar a etapa.', variant: 'error' }) } catch {}
        return
      }
      setPolling(true)
      let resumePath: string | undefined
      let resumeBucket: string | undefined
      let resumeSignedUrl: string | undefined
      if (resumeFile) {
        const r = await fetch('/api/uploads/resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: resumeFile.name, content_type: resumeFile.type || 'application/pdf' }),
        })
        const j = await r.json()
        await uploadToSignedUrl(j.upload_url, resumeFile, resumeFile.type || 'application/pdf')
        resumePath = j.path
        resumeBucket = j.bucket
        resumeSignedUrl = j.view_url || undefined
      }
      let audioPath: string | undefined
      let audioBucket: string | undefined
      let audioSignedUrl: string | undefined
      if (audioFile) {
        const r = await fetch('/api/uploads/audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: audioFile.name, content_type: audioFile.type || 'audio/wav' }),
        })
        const j = await r.json()
        await uploadToSignedUrl(j.upload_url, audioFile, audioFile.type || 'audio/wav')
        audioPath = j.path
        audioBucket = j.bucket
        audioSignedUrl = j.view_url || undefined
      }

      let transcriptPath: string | undefined
      let transcriptBucket: string | undefined
      let transcriptSignedUrl: string | undefined
      if (transcriptFile) {
        const r = await fetch('/api/uploads/transcript', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: transcriptFile.name, content_type: transcriptFile.type || 'application/json' }),
        })
        const j = await r.json()
        await uploadToSignedUrl(j.upload_url, transcriptFile, transcriptFile.type || 'application/json')
        transcriptPath = j.path
        transcriptBucket = j.bucket
        transcriptSignedUrl = j.view_url || undefined
      }

      const payload: any = {
        application_id: applicationId,
        resume_path: resumePath,
        resume_bucket: resumeBucket,
        resume_signed_url: resumeSignedUrl,
        audio_path: audioPath,
        audio_bucket: audioBucket,
        audio_signed_url: audioSignedUrl,
        transcript_path: transcriptPath,
        transcript_bucket: transcriptBucket,
        transcript_signed_url: transcriptSignedUrl,
      }

      console.log('[DEBUG] Enviando payload para avaliação:', payload)
      const evalRes = await fetch(`/api/stages/${stageId}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      console.log('[DEBUG] Resposta da avaliação:', evalRes.status)
      const evalJson = await evalRes.json()
      console.log('[DEBUG] JSON da resposta:', evalJson)
      setRunId(evalJson.run_id || null)
      if (evalJson.application_stage_id) setAppStageIdForPoller(evalJson.application_stage_id)
    } catch (e: any) {
      try { const { useToast } = require('@/components/ToastProvider'); const { notify } = useToast(); notify({ title: 'Erro ao avaliar', description: e?.message, variant: 'error' }) } catch {}
    } finally {
      setSubmitting(false)
      if (!runId) setPolling(false)
    }
  }

  return (
    <div className="space-y-4">
      {candidateName && (
        <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2 text-sm">
          <strong>Avaliando:</strong> {candidateName}
        </div>
      )}
      
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Currículo (PDF)</label>
          <input 
            type="file" 
            accept="application/pdf" 
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
            onChange={(e) => setResumeFile(e.target.files?.[0] || null)} 
          />
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Áudio</label>
          <input 
            type="file" 
            accept="audio/*" 
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
            onChange={(e) => setAudioFile(e.target.files?.[0] || null)} 
          />
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Transcrição (JSON)</label>
          <input 
            type="file" 
            accept="application/json" 
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
            onChange={(e) => setTranscriptFile(e.target.files?.[0] || null)} 
          />
        </div>
      </div>
      
      <button 
        disabled={submitting || !applicationId} 
        onClick={() => {
          console.log('[DEBUG] Botão Enviar para IA clicado')
          handleSubmit()
        }} 
        className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200" 
        title={applicationId ? undefined : 'Selecione um candidato na etapa para habilitar'}
      >
        {submitting ? 'Enviando...' : 'Enviar para IA (transcrever e avaliar)'}
      </button>
      {runId && appStageIdForPoller && (
        <RunPoller
          runId={runId}
          stageId={stageId}
          applicationStageId={appStageIdForPoller}
          onFinished={(completedRunId) => {
            if (onRunFinished) {
              onRunFinished(stageId, completedRunId, appStageIdForPoller)
            }
            setRunId(null)
            setAppStageIdForPoller(null)
            setPolling(false)
          }}
        />
      )}
    </div>
  )
}


function RunPoller({ runId, stageId, applicationStageId, onFinished }: { runId: string; stageId: string; applicationStageId: string; onFinished: (runId: string) => void }) {
  const [status, setStatus] = useState<'pending'|'running'|'succeeded'|'failed'>('running')
  const [lastScore, setLastScore] = useState<number | null>(null)
  useEffect(() => {
    let timer: any
    async function tick() {
      try {
        console.log(`[DEBUG] RunPoller fazendo polling para runId: ${runId}`)
        const r = await fetch(`/api/ai/runs/${runId}`)
        const j = await r.json()
        console.log(`[DEBUG] RunPoller resposta:`, j)
        if (j.status === 'succeeded') {
          console.log(`[DEBUG] RunPoller análise concluída, chamando onFinished`)
          setStatus('succeeded')
          const scoreValue = typeof j.result?.score === 'number' ? Number(j.result.score) : null
          setLastScore(scoreValue)
          await fetch(`/api/stages/${stageId}/scores/auto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ application_stage_id: applicationStageId, run_id: runId }),
          })
          onFinished(runId)
          return
        }
        if (j.status === 'failed') { 
          console.log(`[DEBUG] RunPoller análise falhou`)
          setStatus('failed'); 
          return 
        }
      } catch (error) {
        console.error(`[DEBUG] RunPoller erro:`, error)
      }
      timer = setTimeout(tick, 2000)
    }
    tick()
    return () => timer && clearTimeout(timer)
  }, [runId, stageId, applicationStageId, onFinished])
  return (
    <div className="text-sm text-gray-600 flex items-center gap-2">
      <span>Status da IA: {status}</span>
      {lastScore !== null && <span className="text-gray-500">| Score: {lastScore.toFixed(1)}</span>}
    </div>
  )
}


function Panel({ jobId }: { jobId: string | null }) {
  const [data, setData] = useState<any | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const refreshData = async () => {
    if (!jobId) return
    setRefreshing(true)
    try {
      const response = await fetch(`/api/jobs/${jobId}/panel`)
      if (!response.ok) {
        const result = await response.json().catch(() => null)
        setError(result?.error?.message || 'Erro ao carregar painel')
        setData(null)
        return
      }
      const result = await response.json()
      setData(result || { stages: [], items: [] })
      setError(null)
    } catch (error) {
      console.error('Erro ao carregar painel:', error)
      setError('Falha ao carregar painel de candidatos')
      setData(null)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    refreshData()
  }, [jobId])

  if (!jobId) return null
  if (!data) {
    if (error) {
      return (
        <div className="card p-6 text-sm text-red-600">
          {error}
        </div>
      )
    }
    return <div className="text-sm text-gray-600">Carregando...</div>
  }
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium">Pontuações dos Candidatos</h3>
        <button 
          onClick={refreshData} 
          disabled={refreshing}
          className="btn btn-outline btn-sm"
        >
          {refreshing ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border border-gray-200 rounded-lg">
          <thead className="bg-gray-50">
            <tr>
              <th className="border border-gray-200 px-4 py-3 text-left font-medium text-gray-900">Candidato</th>
              {data.stages.map((s: any) => (
                <th key={s.id} className="border border-gray-200 px-4 py-3 text-left font-medium text-gray-900">
                  <div className="flex flex-col">
                    <span>{s.name}</span>
                    <span className="text-xs text-gray-500 font-normal">Min: {s.threshold}</span>
                  </div>
                </th>
              ))}
              <th className="border border-gray-200 px-4 py-3 text-left font-medium text-gray-900">Status Geral</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.items.map((row: any) => {
              const totalScore = data.stages.reduce((sum: number, stage: any) => {
                const stageData = row.stages.find((x: any) => x.stage_id === stage.id)
                return sum + (stageData?.score || 0) * stage.stage_weight
              }, 0)
              const totalWeight = data.stages.reduce((sum: number, stage: any) => sum + stage.stage_weight, 0)
              const averageScore = totalWeight > 0 ? totalScore / totalWeight : 0
              
              return (
                <tr key={row.candidate.id} className="hover:bg-gray-50">
                  <td className="border border-gray-200 px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900">{row.candidate.name}</span>
                      {row.candidate.email && (
                        <span className="text-xs text-gray-500">{row.candidate.email}</span>
                      )}
                    </div>
                  </td>
                  {data.stages.map((s: any) => {
                    const stage = row.stages.find((x: any) => x.stage_id === s.id)
                    const score = stage?.score ?? 0
                    const passed = score >= s.threshold
                    return (
                      <td key={s.id} className="border border-gray-200 px-4 py-3">
                        <div className="flex flex-col items-center">
                          <span className={`font-medium ${passed ? 'text-green-600' : 'text-red-600'}`}>
                            {score.toFixed(1)}
                          </span>
                          <span className={`text-xs ${passed ? 'text-green-600' : 'text-red-600'}`}>
                            {passed ? '✓ Aprovado' : '✗ Reprovado'}
                          </span>
                        </div>
                      </td>
                    )
                  })}
                  <td className="border border-gray-200 px-4 py-3">
                    <div className="flex flex-col items-center">
                      <span className="font-medium text-gray-900">
                        {averageScore.toFixed(1)}
                      </span>
                      <span className="text-xs text-gray-500">Média Ponderada</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      
      {data.items.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>Nenhum candidato atribuído à vaga ainda.</p>
          <p className="text-sm">Atribua candidatos na seção acima para ver as pontuações aqui.</p>
        </div>
      )}
    </div>
  )
}




