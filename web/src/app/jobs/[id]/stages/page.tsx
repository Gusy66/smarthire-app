'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '@/components/ToastProvider'
import StageAnalysisPanel from './_components/StageAnalysisPanel'
import JobStageHeader from './_components/JobStageHeader'
import CandidatesTable from './_components/CandidatesTable'
import BulkActions from './_components/BulkActions'
import CandidatesFilters, { CandidateFilters as CF } from './_components/CandidatesFilters'

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
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [board, setBoard] = useState<{ lanes: Record<string, { application_id: string; application_stage_id: string; candidate: any; score: number | null }[]>, stages: Stage[] } | null>(null)
  const [selectedForBulk, setSelectedForBulk] = useState<Record<string, boolean>>({})
  const [filters, setFilters] = useState<CF>({ query: '' })
  const [currentItem, setCurrentItem] = useState<{ application_id: string; application_stage_id: string; candidate: { id: string; name?: string } } | null>(null)
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
      setActiveTab(items[0]?.id || null)
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
      // carregar board inicial
      try {
        const b = await api<{ lanes: any; stages: Stage[] }>(`/api/jobs/${id}/board`)
        setBoard(b as any)
      } catch {}
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
      console.log(`[DEBUG] Fazendo requisição para: /api/stages/${stageId}/analysis/latest`)
      const res = await fetch(`/api/stages/${stageId}/analysis/latest`)
      console.log(`[DEBUG] Resposta recebida:`, { status: res.status, ok: res.ok })
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.log(`[DEBUG] Erro na resposta:`, err)
        if (err?.error?.code === 'not_found') {
          console.log(`[DEBUG] Nenhuma análise encontrada para etapa ${stageId}`)
          setAnalysisByStage((prev) => ({ ...prev, [stageId]: null }))
          return
        }
        throw new Error(err?.error?.message || 'Erro ao buscar análise da IA')
      }
      const json = await res.json()
      console.log(`[DEBUG] Análise mais recente carregada para etapa ${stageId}:`, json.item)
      console.log(`[DEBUG] Dados da análise:`, {
        id: json.item?.id,
        run_id: json.item?.run_id,
        result: json.item?.result,
        score: json.item?.result?.score,
        strengths: json.item?.result?.strengths,
        weaknesses: json.item?.result?.weaknesses,
        matched_requirements: json.item?.result?.matched_requirements,
        missing_requirements: json.item?.result?.missing_requirements
      })
      
      if (json.item) {
        setAnalysisByStage((prev) => ({ ...prev, [stageId]: json.item }))
        setAnalysisExpanded((prev) => ({ ...prev, [stageId]: true }))
        // Selecionar automaticamente o candidato da análise
        if (json.item.application_id) {
          const candidate = applications.find(app => app.id === json.item.application_id)?.candidate_id
          if (candidate) {
            console.log(`[DEBUG] Selecionando candidato automaticamente: ${candidate}`)
            setStageSelectedCandidates((prev) => ({ ...prev, [stageId]: candidate }))
          }
        }
      } else {
        console.log(`[DEBUG] Nenhum item retornado para etapa ${stageId}`)
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
    // Criar application
    const appData = await api<{ id: string }>(`/api/jobs/${jobId}/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidate_id: selectedCandidateId }),
    })
    const appId = appData?.id
    
    // Adicionar candidato à primeira etapa automaticamente
    if (appId && stages.length > 0) {
      const firstStageId = stages[0].id
      try {
        await fetch('/api/applications/stages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ application_id: appId, stage_id: firstStageId }),
        })
      } catch (error) {
        console.error('Erro ao adicionar candidato à primeira etapa:', error)
      }
    }
    
    const apps = await fetch(`/api/jobs/${jobId}/applications`).then((r) => r.json())
    setApplications(apps.items || [])
    
    // Recarregar board para exibir candidato na primeira etapa
    const b = await api<{ lanes: any; stages: Stage[] }>(`/api/jobs/${jobId}/board`).catch(() => null)
    if (b) { setBoard(b as any) }
    
    notify({ title: 'Candidato atribuído', variant: 'success' })
    setSelectedCandidateId(null)
  }

  return (
    <div className="min-h-screen bg-[#f7f7f7] pb-12">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm -mx-4 md:-mx-8 px-4 md:px-8 mb-8">
        <div className="flex w-full flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm text-gray-500">Vagas / Etapas</div>
            <h1 className="mt-2 text-2xl font-semibold text-gray-900">Gerenciar Etapas</h1>
            <p className="text-sm text-gray-600">Gerencie as etapas do processo seletivo e analise candidatos</p>
          </div>
          {jobId && (
            <button
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 whitespace-nowrap"
              onClick={async()=>{
                if(!confirm('Excluir esta vaga e todas as etapas/candidaturas relacionadas?')) return
                const res = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' })
                if(!res.ok){
                  const t = await res.text();
                  let msg = 'Falha ao excluir a vaga'
                  try{ const j = t ? JSON.parse(t) : null; msg = j?.error?.message || msg }catch{}
                  notify({ title: 'Erro', description: msg, variant: 'error' })
                  return
                }
                notify({ title: 'Vaga excluída', variant: 'success' })
                window.location.href = '/jobs'
              }}
            >
              🗑️ Excluir vaga
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-8">
        {/* Métricas */}
        {board && (
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="text-sm text-gray-500">Total de Candidatos</div>
              <div className="mt-2 text-3xl font-semibold text-gray-900">{applications.length}</div>
              <div className="text-xs text-gray-400 mt-1">Atribuídos à vaga</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="text-sm text-gray-500">Etapas</div>
              <div className="mt-2 text-3xl font-semibold text-gray-900">{stages.length}</div>
              <div className="text-xs text-gray-400 mt-1">No processo seletivo</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="text-sm text-gray-500">Análises Concluídas</div>
              <div className="mt-2 text-3xl font-semibold text-green-600">{Object.values(analysisByStage).filter(a => a?.status === 'succeeded').length}</div>
              <div className="text-xs text-green-600 mt-1">Candidatos avaliados</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="text-sm text-gray-500">Próximas Ações</div>
              <div className="mt-2 text-3xl font-semibold text-gray-900">{stages.filter(s => !stagePromptMap[s.id]).length}</div>
              <div className="text-xs text-yellow-600 mt-1">Sem prompt definido</div>
            </div>
          </div>
        )}

        {/* Candidatos */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Gerenciamento de Candidatos</h2>
              <p className="text-sm text-gray-600">Atribua candidatos à vaga e visualize o progresso</p>
            </div>
          </div>
          
          <div className="space-y-6">
            {/* Atribuir Candidato */}
            <div className="border-b border-gray-200 pb-6">
              <label className="block text-sm font-medium text-gray-900 mb-3">Atribuir candidato à vaga</label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <select
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-gray-900/40 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                    value={selectedCandidateId ?? ''}
                    onChange={(e) => setSelectedCandidateId(e.target.value || null)}
                  >
                    <option value="">Selecione um candidato</option>
                    {candidates
                      .filter(c => !applications.some(app => app.candidate_id === c.id))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.email ? `(${c.email})` : ''}
                        </option>
                      ))}
                  </select>
                </div>
                <button 
                  onClick={assignCandidate} 
                  disabled={!selectedCandidateId}
                  className="rounded-lg bg-green-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Atribuir à vaga
                </button>
              </div>
            </div>

            {/* Candidatos Atribuídos */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Candidatos Atribuídos ({applications.length})</h3>
              </div>
              {applications.length > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {applications.map((a) => {
                    const c = candidates.find((x) => x.id === a.candidate_id)
                    return (
                      <div key={a.id} className="border border-gray-200 rounded-xl p-4 bg-white hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                              {(c?.name || a.candidate_id).slice(0,2).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-gray-900 truncate">{c?.name || a.candidate_id}</div>
                              {c?.email && <div className="text-xs text-gray-600 truncate">{c.email}</div>}
                            </div>
                          </div>
                          <button 
                            className="text-red-600 hover:text-red-700 text-xs bg-red-50 hover:bg-red-100 rounded px-2 py-1 flex-shrink-0 whitespace-nowrap"
                            onClick={async()=>{ 
                              if(!confirm('Remover candidato desta vaga?')) return; 
                              await fetch(`/api/applications/${a.id}`, { method: 'DELETE' }); 
                              const apps = await fetch(`/api/jobs/${jobId}/applications`).then((r)=>r.json()); 
                              setApplications(apps.items || []) 
                            }}
                            title="Remover candidato"
                          >
                            ✕ Remover
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                  <p className="text-sm text-gray-600">Nenhum candidato atribuído à vaga ainda.</p>
                  <p className="text-xs text-gray-500 mt-1">Selecione um candidato acima para começar.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Etapas */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Etapas do Processo</h2>
            <p className="text-sm text-gray-600">Gerencie as etapas e analise candidatos</p>
          </div>

          {stages.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
              <p className="text-sm text-gray-600">Nenhuma etapa cadastrada.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <JobStageHeader
                stages={stages}
                lanes={board?.lanes || {}}
                activeStageId={activeTab}
                onChange={(id)=>{
                  setActiveTab(id)
                  const url = new URL(window.location.href)
                  url.searchParams.set('stageId', id)
                  window.history.replaceState({}, '', url.toString())
                }}
              />
              
              {activeTab && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="text-sm flex-1">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Etapa Ativa</div>
                        <div className="font-semibold text-gray-900 mt-1">{stages.find(s=>s.id===activeTab)?.name}</div>
                        {stages.find(s=>s.id===activeTab)?.description && (
                          <p className="text-xs text-gray-600 mt-2 whitespace-pre-wrap">{stages.find(s=>s.id===activeTab)?.description}</p>
                        )}
                      </div>
                    </div>
                    <BulkActions
                      jobId={jobId!}
                      stages={stages}
                      activeStageId={activeTab}
                      selectedIds={Object.entries(selectedForBulk).filter(([_,v])=>v).map(([k])=>k)}
                      onMoved={async()=>{
                        const b = await api<{ lanes: any; stages: Stage[] }>(`/api/jobs/${jobId}/board`).catch(()=>null)
                        if(b){ setBoard(b as any); setSelectedForBulk({}) }
                      }}
                    />
                  </div>

                  <CandidatesFilters value={filters} onChange={setFilters} />
                  
                  <div>
                    <CandidatesTable
                      stage={stages.find(s=>s.id===activeTab)!}
                      items={(board?.lanes?.[activeTab] || []) as any}
                      selectedMap={selectedForBulk}
                      setSelectedMap={setSelectedForBulk}
                      onSelect={(it)=>{
                        setCurrentItem({ application_id: it.application_id, application_stage_id: it.application_stage_id, candidate: { id: it.candidate.id, name: it.candidate.name }})
                        const url = new URL(window.location.href)
                        url.searchParams.set('candidateId', it.candidate.id)
                        window.history.replaceState({}, '', url.toString())
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Painel de candidatos */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Painel de Candidatos (MVP)</h2>
          <Panel jobId={jobId} />
        </section>

        {/* Análises de Candidatos - SEMPRE VISÍVEIS */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Análises de Candidatos</h2>
          <div className="space-y-6">
            {stages.map((s) => (
              <div key={s.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {/* Header da etapa */}
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{s.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                          Threshold: {s.threshold}
                        </span>
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                          Peso: {s.stage_weight}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Análise sempre visível - expandida */}
                <div className="p-6">
                  {(() => {
                    const candidateName = stageSelectedCandidates[s.id] ? (candidates.find((c) => c.id === stageSelectedCandidates[s.id])?.name || null) : null
                    const analysis = analysisByStage[s.id] || null
                    const loading = Boolean(analysisLoading[s.id])
                    
                    console.log(`[DEBUG] Renderizando análise para etapa ${s.id}:`, {
                      candidateName,
                      analysis,
                      loading,
                      analysisResult: analysis?.result
                    })
                    
                    return (
                      <StageAnalysisPanel
                        candidateName={candidateName}
                        analysis={analysis}
                        loading={loading}
                        expanded={true} // Sempre expandido
                        onToggle={() => {}} // Não permite colapsar
                        onRefresh={() => {
                          const candidateId = stageSelectedCandidates[s.id] ?? null
                          if (candidateId) loadAnalysisForStage(s.id, candidateId)
                        }}
                      />
                    )
                  })()}
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}

function UploadAndEvaluate({ stageId, applicationId, candidateName, onRunFinished }: { stageId: string; applicationId: string | null; candidateName?: string; onRunFinished?: (stageId: string, runId: string, applicationStageId: string) => void }) {
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null)
  const [stageDocumentFile, setStageDocumentFile] = useState<File | null>(null)
  const [selectedResume, setSelectedResume] = useState<{ resume_path: string; resume_bucket: string } | null>(null)
  const [availableResumes, setAvailableResumes] = useState<any[]>([])
  const [loadingResumes, setLoadingResumes] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [runId, setRunId] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)
  const [appStageIdForPoller, setAppStageIdForPoller] = useState<string | null>(null)

  // Carregar currículos do candidato quando applicationId mudar
  useEffect(() => {
    if (applicationId) {
      setLoadingResumes(true)
      fetch(`/api/applications/${applicationId}/resumes`)
        .then(r => r.json())
        .then(j => {
          setAvailableResumes(j.items || [])
          if (j.items && j.items.length > 0) {
            // Selecionar o primeiro currículo automaticamente
            setSelectedResume({
              resume_path: j.items[0].resume_path,
              resume_bucket: j.items[0].resume_bucket,
            })
          }
        })
        .catch(err => {
          console.error('Erro ao carregar currículos:', err)
          setAvailableResumes([])
        })
        .finally(() => setLoadingResumes(false))
    } else {
      setAvailableResumes([])
      setSelectedResume(null)
    }
  }, [applicationId])

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

      // Upload de documento de etapa se fornecido
      let documentPath: string | undefined
      let documentBucket: string | undefined
      let documentSignedUrl: string | undefined
      let documentType: string | undefined
      
      if (stageDocumentFile) {
        const contentType = stageDocumentFile.type || 
          (stageDocumentFile.name.endsWith('.pdf') ? 'application/pdf' :
          stageDocumentFile.name.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
          stageDocumentFile.name.endsWith('.doc') ? 'application/msword' :
          stageDocumentFile.name.endsWith('.json') ? 'application/json' : 'application/pdf')
        
        const docType = contentType.includes('pdf') ? 'pdf' :
          contentType.includes('docx') ? 'docx' :
          contentType.includes('msword') ? 'doc' :
          contentType.includes('json') ? 'json' : 'pdf'
        
        const r = await fetch('/api/uploads/resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: stageDocumentFile.name, content_type: contentType, for_stage: true }),
        })
        const j = await r.json()
        await uploadToSignedUrl(j.upload_url, stageDocumentFile, contentType)
        
        const bucketMatch = j.path.match(/^([^/]+)\/(.+)$/)
        if (bucketMatch) {
          documentBucket = bucketMatch[1]
          documentPath = bucketMatch[2]
          
          // Registrar documento na etapa
          await fetch(`/api/stages/${stageId}/documents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: docType, storage_path: j.path }),
          })
          
          documentSignedUrl = j.view_url || undefined
          documentType = docType
        }
      }
      
      // Usar currículo selecionado se não houver upload novo
      const finalResumePath = resumePath || selectedResume?.resume_path
      const finalResumeBucket = resumeBucket || selectedResume?.resume_bucket
      const finalResumeSignedUrl = resumeSignedUrl || undefined

      const payload: any = {
        application_id: applicationId,
        resume_path: finalResumePath,
        resume_bucket: finalResumeBucket,
        resume_signed_url: finalResumeSignedUrl,
        audio_path: audioPath,
        audio_bucket: audioBucket,
        audio_signed_url: audioSignedUrl,
        transcript_path: transcriptPath,
        transcript_bucket: transcriptBucket,
        transcript_signed_url: transcriptSignedUrl,
        document_path: documentPath,
        document_bucket: documentBucket,
        document_signed_url: documentSignedUrl,
        document_type: documentType,
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
      
      {/* Seleção de currículo já anexado */}
      {applicationId && (
        <div className="bg-gray-50 rounded-md p-4 border border-gray-200">
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Currículo do candidato (já anexado)
          </label>
          {loadingResumes ? (
            <div className="text-sm text-gray-500">Carregando currículos...</div>
          ) : availableResumes.length > 0 ? (
            <select
              value={selectedResume ? `${selectedResume.resume_path}:${selectedResume.resume_bucket}` : ''}
              onChange={(e) => {
                const value = e.target.value
                if (value) {
                  const [path, bucket] = value.split(':')
                  setSelectedResume({ resume_path: path, resume_bucket: bucket })
                  // Limpar upload novo se selecionar um currículo existente
                  setResumeFile(null)
                } else {
                  setSelectedResume(null)
                }
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Selecione um currículo anexado</option>
              {availableResumes.map((resume, idx) => {
                // Extrair nome do arquivo do resume_path (ex: "resumes/1234567-filename.pdf" -> "1234567-filename.pdf")
                const pathParts = resume.resume_path.split('/')
                const filename = pathParts[pathParts.length - 1]
                // Remover timestamp do início (ex: "1234567-" -> "")
                const displayName = filename.replace(/^\d+-/, '')
                
                return (
                  <option key={idx} value={`${resume.resume_path}:${resume.resume_bucket}`}>
                    {displayName || `Currículo ${idx + 1}`} {resume.created_at ? `(${new Date(resume.created_at).toLocaleDateString('pt-BR')})` : ''}
                  </option>
                )
              })}
            </select>
          ) : (
            <div className="text-sm text-gray-500">Nenhum currículo anexado ao candidato. Faça upload de um novo abaixo.</div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Novo Currículo (PDF, DOCX, DOC) {selectedResume ? '(opcional - sobrescreve seleção acima)' : '(opcional)'}
          </label>
          <input 
            type="file" 
            accept=".pdf,.doc,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword" 
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
            onChange={(e) => {
              const file = e.target.files?.[0] || null
              if (file) {
                const maxSize = 10 * 1024 * 1024 // 10MB
                if (file.size > maxSize) {
                  try { 
                    const { useToast } = require('@/components/ToastProvider')
                    const { notify } = useToast()
                    notify({ title: 'Arquivo muito grande', description: `O arquivo deve ter no máximo 10MB. Tamanho atual: ${(file.size / 1024 / 1024).toFixed(2)}MB`, variant: 'error' })
                  } catch {}
                  e.target.value = ''
                  return
                }
                setSelectedResume(null)
              }
              setResumeFile(file)
            }} 
          />
          <p className="text-xs text-gray-500 mt-1">Tamanho máximo: 10MB</p>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Áudio</label>
          <input 
            type="file" 
            accept="audio/*" 
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
            onChange={(e) => {
              const file = e.target.files?.[0] || null
              if (file) {
                const maxSize = 50 * 1024 * 1024 // 50MB para áudio
                if (file.size > maxSize) {
                  try { 
                    const { useToast } = require('@/components/ToastProvider')
                    const { notify } = useToast()
                    notify({ title: 'Arquivo muito grande', description: `O arquivo de áudio deve ter no máximo 50MB. Tamanho atual: ${(file.size / 1024 / 1024).toFixed(2)}MB`, variant: 'error' })
                  } catch {}
                  e.target.value = ''
                  return
                }
              }
              setAudioFile(file)
            }} 
          />
          <p className="text-xs text-gray-500 mt-1">Tamanho máximo: 50MB</p>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Transcrição (JSON)</label>
          <input 
            type="file" 
            accept="application/json,.json" 
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
            onChange={(e) => {
              const file = e.target.files?.[0] || null
              if (file) {
                const maxSize = 5 * 1024 * 1024 // 5MB para JSON
                if (file.size > maxSize) {
                  try { 
                    const { useToast } = require('@/components/ToastProvider')
                    const { notify } = useToast()
                    notify({ title: 'Arquivo muito grande', description: `O arquivo JSON deve ter no máximo 5MB. Tamanho atual: ${(file.size / 1024 / 1024).toFixed(2)}MB`, variant: 'error' })
                  } catch {}
                  e.target.value = ''
                  return
                }
              }
              setTranscriptFile(file)
            }} 
          />
          <p className="text-xs text-gray-500 mt-1">Tamanho máximo: 5MB</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Documento para análise na etapa (PDF, DOCX, DOC, JSON)
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Anexe um documento que a IA deve usar para analisar o diálogo de transcrição e formular uma nota
          </p>
          <input 
            type="file" 
            accept=".pdf,.docx,.doc,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/json" 
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
            onChange={(e) => {
              const file = e.target.files?.[0] || null
              if (file) {
                const maxSize = 10 * 1024 * 1024 // 10MB para documentos
                if (file.size > maxSize) {
                  try { 
                    const { useToast } = require('@/components/ToastProvider')
                    const { notify } = useToast()
                    notify({ title: 'Arquivo muito grande', description: `O documento deve ter no máximo 10MB. Tamanho atual: ${(file.size / 1024 / 1024).toFixed(2)}MB`, variant: 'error' })
                  } catch {}
                  e.target.value = ''
                  return
                }
              }
              setStageDocumentFile(file)
            }} 
          />
          {stageDocumentFile && (
            <p className="text-xs text-gray-600 mt-1">
              Arquivo selecionado: {stageDocumentFile.name} ({(stageDocumentFile.size / 1024 / 1024).toFixed(2)}MB)
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">Tamanho máximo: 10MB</p>
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




