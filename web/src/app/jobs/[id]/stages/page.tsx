'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '@/components/ToastProvider'

type Stage = { id: string; name: string; description: string | null; order_index: number; threshold: number; stage_weight: number }
type Requirement = { id: string; label: string; weight: number; description?: string }
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
  const res = await fetch(url, init)
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error?.message || 'Erro de API')
  return json
}

export default function JobStagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { notify } = useToast()
  const [jobId, setJobId] = useState<string | null>(null)
  const [stages, setStages] = useState<Stage[]>([])
  const [reqs, setReqs] = useState<Record<string, Requirement[]>>({})
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
      // carregar candidatos (MVP: todos)
      const cand = await fetch('/api/candidates').then((r) => r.json()).catch(() => ({ items: [] }))
      setCandidates(cand.items || [])
      const apps = await fetch(`/api/jobs/${id}/applications`).then((r) => r.json()).catch(() => ({ items: [] }))
      setApplications(apps.items || [])
      try {
        const pts = await fetchPromptTemplates()
        setPromptTemplates(pts)
      } catch (error: any) {
        notify({ title: 'Erro ao carregar templates', description: error?.message, variant: 'error' })
      }
    })()
  }, [params])

  async function loadRequirements(stageId: string) {
    const { items } = await api<{ items: Requirement[] }>(`/api/stages/${stageId}/requirements`)
    setReqs((r) => ({ ...r, [stageId]: items }))
  }

  useEffect(() => {
    stages.forEach((s) => {
      if (!reqs[s.id]) loadRequirements(s.id)
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
      setAnalysisByStage((prev) => ({ ...prev, [stageId]: null }))
      return
    }
    const applicationId = getApplicationId(candidateId)
    if (!applicationId) {
      setAnalysisByStage((prev) => ({ ...prev, [stageId]: null }))
      return
    }
    setAnalysisLoading((prev) => ({ ...prev, [stageId]: true }))
    try {
      const res = await fetch(`/api/stages/${stageId}/analysis?application_id=${encodeURIComponent(applicationId)}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error?.message || 'Erro ao buscar análise da IA')
      }
      const json = await res.json()
      setAnalysisByStage((prev) => ({ ...prev, [stageId]: json.item || null }))
    } catch (error: any) {
      console.error('Erro ao carregar análise da etapa', error)
      notify({ title: 'Erro ao carregar análise', description: error?.message || 'Não foi possível carregar o relatório da IA.', variant: 'error' })
      setAnalysisByStage((prev) => ({ ...prev, [stageId]: null }))
    } finally {
      setAnalysisLoading((prev) => ({ ...prev, [stageId]: false }))
    }
  }, [getApplicationId, notify])

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

      <section className="space-y-6">
        <h2 className="font-medium">Etapas da vaga</h2>
        {stages.map((s) => (
          <div key={s.id} className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex-1 pr-4">
                {editingStageId === s.id ? (
                  <div className="grid gap-2">
                    <input
                      value={editingStageForm.name}
                      onChange={(e) => setEditingStageForm((f) => ({ ...f, name: e.target.value }))}
                      className="border rounded px-2 py-1"
                    />
                    <textarea
                      value={editingStageForm.description}
                      onChange={(e) => setEditingStageForm((f) => ({ ...f, description: e.target.value }))}
                      className="border rounded px-2 py-1"
                      rows={3}
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        type="number"
                        step="0.01"
                        value={editingStageForm.threshold}
                        onChange={(e) => setEditingStageForm((f) => ({ ...f, threshold: Number(e.target.value) }))}
                        className="border rounded px-2 py-1"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={editingStageForm.stage_weight}
                        onChange={(e) => setEditingStageForm((f) => ({ ...f, stage_weight: Number(e.target.value) }))}
                        className="border rounded px-2 py-1"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="font-medium">{s.name}</div>
                    {s.description && <p className="text-sm text-gray-600 whitespace-pre-wrap">{s.description}</p>}
                    <div className="text-sm text-gray-600">Threshold: {s.threshold} • Peso: {s.stage_weight}</div>
                  </>
                )}
              </div>
              {editingStageId === s.id ? (
                <div className="flex gap-2">
                  <button className="bg-black text-white rounded px-3 py-1" onClick={async()=>{
        await fetch(`/api/stages/${s.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingStageForm) })
                    const { items } = await api<{ items: Stage[] }>(`/api/jobs/${jobId}/stages`)
        setStages(items); setEditingStageId(null)
                    notify({ title: 'Etapa atualizada', variant: 'success' })
                  }}>Salvar</button>
                  <button className="border rounded px-3 py-1" onClick={()=>setEditingStageId(null)}>Cancelar</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button className="text-blue-600 underline" onClick={()=>{ setEditingStageId(s.id); setEditingStageForm({ name: s.name, description: s.description || '', threshold: s.threshold, stage_weight: s.stage_weight }) }}>Editar</button>
                  <button className="text-red-600 underline" onClick={async()=>{ if(!confirm('Remover etapa?')) return; await fetch(`/api/stages/${s.id}`, { method: 'DELETE' }); const { items } = await api<{ items: Stage[] }>(`/api/jobs/${jobId}/stages`); setStages(items); notify({ title: 'Etapa removida', variant: 'success' }) }}>Remover</button>
                </div>
              )}
            </div>

            <StagePromptSelector
              stageId={s.id}
              templates={promptTemplates}
              selected={stagePromptMap[s.id] ?? null}
              loading={promptLoadingStage === s.id}
              onChange={handleStagePromptChange}
            />
            
            {/* Seletor de candidato para esta etapa específica */}
            <div className="border-t pt-3">
              <h4 className="font-medium mb-2">Candidato para avaliação nesta etapa:</h4>
              <div className="flex gap-2 items-center">
                <select
                  className="border rounded px-3 py-2 flex-1"
                  value={stageSelectedCandidates[s.id] ?? ''}
                  onChange={(e) => handleStageCandidateSelection(s.id, e.target.value || null)}
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
                  <span className="text-sm text-green-600">
                    ✓ {candidates.find(c => c.id === stageSelectedCandidates[s.id])?.name}
                  </span>
                )}
              </div>
            </div>

            <div className="grid gap-3">
              <UploadAndEvaluate 
                stageId={s.id} 
                applicationId={getApplicationId(stageSelectedCandidates[s.id])}
                candidateName={candidates.find(c => c.id === stageSelectedCandidates[s.id])?.name}
                onRunFinished={(stageId, runId, applicationStageId) => {
                  const currentCandidate = stageSelectedCandidates[stageId] ?? null
                  if (currentCandidate) {
                    loadAnalysisForStage(stageId, currentCandidate)
                    setAnalysisExpanded((prev) => ({ ...prev, [stageId]: true }))
                  }
                }}
              />
            </div>
            <StageAnalysisPanel
              stageId={s.id}
              candidateId={stageSelectedCandidates[s.id] ?? null}
              candidateName={candidates.find((c) => c.id === stageSelectedCandidates[s.id])?.name || null}
              analysis={analysisByStage[s.id] || null}
              loading={Boolean(analysisLoading[s.id])}
              expanded={analysisExpanded[s.id] ?? false}
              onToggle={() => setAnalysisExpanded((prev) => ({ ...prev, [s.id]: !(prev[s.id] ?? false) }))}
              onRefresh={() => loadAnalysisForStage(s.id, stageSelectedCandidates[s.id] ?? null)}
            />
            <div className="pt-2">
              <h3 className="font-medium mb-2">Requisitos</h3>
              <RequirementsCrud
                stageId={s.id}
                requirements={reqs[s.id] || []}
                onChanged={() => loadRequirements(s.id)}
              />
            </div>
          </div>
        ))}
      </section>

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
    setSubmitting(true)
    try {
      if (!applicationId) {
        try { const { useToast } = require('@/components/ToastProvider'); const { notify } = useToast(); notify({ title: 'Selecione um candidato', description: 'Atribua um candidato à vaga antes de avaliar a etapa.', variant: 'error' }) } catch {}
        return
      }
      let resumePath: string | undefined
      if (resumeFile) {
        const r = await fetch('/api/uploads/resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: resumeFile.name, content_type: resumeFile.type || 'application/pdf' }),
        })
        const j = await r.json()
        await uploadToSignedUrl(j.upload_url, resumeFile, resumeFile.type || 'application/pdf')
        resumePath = j.path
      }
      let audioPath: string | undefined
      if (audioFile) {
        const r = await fetch('/api/uploads/audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: audioFile.name, content_type: audioFile.type || 'audio/wav' }),
        })
        const j = await r.json()
        await uploadToSignedUrl(j.upload_url, audioFile, audioFile.type || 'audio/wav')
        audioPath = j.path
      }

      let transcriptPath: string | undefined
      if (transcriptFile) {
        const r = await fetch('/api/uploads/transcript', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: transcriptFile.name, content_type: transcriptFile.type || 'application/json' }),
        })
        const j = await r.json()
        await uploadToSignedUrl(j.upload_url, transcriptFile, transcriptFile.type || 'application/json')
        transcriptPath = j.path
      }

      const evalRes = await fetch(`/api/stages/${stageId}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: applicationId, resume_path: resumePath, audio_path: audioPath, transcript_path: transcriptPath }),
      })
      const evalJson = await evalRes.json()
      setRunId(evalJson.run_id || null)
      if (evalJson.application_stage_id) setAppStageIdForPoller(evalJson.application_stage_id)
      // toast via global provider
      try { const { useToast } = require('@/components/ToastProvider'); const { notify } = useToast(); notify({ title: 'Avaliação iniciada', variant: 'success' }) } catch {}
    } catch (e: any) {
      try { const { useToast } = require('@/components/ToastProvider'); const { notify } = useToast(); notify({ title: 'Erro ao avaliar', description: e?.message, variant: 'error' }) } catch {}
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid gap-3">
      {candidateName && (
        <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2 text-sm">
          <strong>Avaliando:</strong> {candidateName}
        </div>
      )}
      <input type="file" accept="application/pdf" className="border rounded px-3 py-2" onChange={(e) => setResumeFile(e.target.files?.[0] || null)} />
      <input type="file" accept="audio/*" className="border rounded px-3 py-2" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
      <input type="file" accept="application/json" className="border rounded px-3 py-2" onChange={(e) => setTranscriptFile(e.target.files?.[0] || null)} />
      <button disabled={submitting || !applicationId} onClick={handleSubmit} className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50" title={applicationId ? undefined : 'Selecione um candidato na etapa para habilitar'}>
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
          }}
        />
      )}
    </div>
  )
}

function RequirementsCrud({ stageId, requirements, onChanged }: { stageId: string; requirements: Requirement[]; onChanged: () => void }) {
  const [label, setLabel] = useState('')
  const [weight, setWeight] = useState<number>(1)
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ label: string; weight: number; description?: string }>({ label: '', weight: 1, description: '' })

  async function addRequirement(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/stages/${stageId}/requirements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, weight, description }),
      })
      if (!res.ok) {
        const j = await res.json(); alert(j?.error?.message || 'Erro ao adicionar requisito'); return
      }
      setLabel(''); setWeight(1); setDescription(''); onChanged()
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={addRequirement} className="grid gap-2 sm:grid-cols-3">
        <input value={label} onChange={(e)=>setLabel(e.target.value)} placeholder="Rótulo" className="border rounded px-3 py-2" required />
        <input type="number" step="0.01" value={weight} onChange={(e)=>setWeight(Number(e.target.value))} placeholder="Peso" className="border rounded px-3 py-2" />
        <input value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="Descrição" className="border rounded px-3 py-2 sm:col-span-2" />
        <button disabled={saving} className="bg-black text-white rounded px-3 py-2 sm:col-span-1">{saving? 'Salvando...' : 'Adicionar'}</button>
      </form>
      <ul className="list-disc pl-5 text-sm">
        {requirements.map((r) => (
          <li key={r.id} className="mb-2">
            {editing === r.id ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input value={editForm.label} onChange={(e)=>setEditForm((f)=>({ ...f, label: e.target.value }))} className="border rounded px-2 py-1" />
                <input type="number" step="0.01" value={editForm.weight} onChange={(e)=>setEditForm((f)=>({ ...f, weight: Number(e.target.value) }))} className="border rounded px-2 py-1 w-24" />
                <input value={editForm.description || ''} onChange={(e)=>setEditForm((f)=>({ ...f, description: e.target.value }))} className="border rounded px-2 py-1 flex-1" />
                <button className="bg-black text-white rounded px-2 py-1" onClick={async()=>{
                  const res = await fetch(`/api/requirements/${r.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm) })
                  if (!res.ok) { const j = await res.json(); alert(j?.error?.message || 'Erro ao salvar'); return }
                  setEditing(null); onChanged()
                }}>Salvar</button>
                <button className="border rounded px-2 py-1" onClick={()=> setEditing(null)}>Cancelar</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span>{r.label} — peso {r.weight}</span>
                <button className="text-blue-600 underline" onClick={()=>{ setEditing(r.id); setEditForm({ label: r.label, weight: r.weight, description: r.description }) }}>Editar</button>
                <button className="text-red-600 underline" onClick={async()=>{ if(!confirm('Remover requisito?')) return; const res = await fetch(`/api/requirements/${r.id}`, { method: 'DELETE' }); if (!res.ok) { const j = await res.json(); alert(j?.error?.message || 'Erro ao remover'); return } onChanged() }}>Remover</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function RunPoller({ runId, stageId, applicationStageId, onFinished }: { runId: string; stageId: string; applicationStageId: string; onFinished: (runId: string) => void }) {
  const [status, setStatus] = useState<'pending'|'running'|'succeeded'|'failed'>('running')
  useEffect(() => {
    let timer: any
    async function tick() {
      try {
        const r = await fetch(`/api/ai/runs/${runId}`)
        const j = await r.json()
        if (j.status === 'succeeded') {
          setStatus('succeeded')
          await fetch(`/api/stages/${stageId}/scores/auto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ application_stage_id: applicationStageId, run_id: runId }),
          })
          onFinished(runId)
          return
        }
        if (j.status === 'failed') { setStatus('failed'); return }
      } catch {}
      timer = setTimeout(tick, 2000)
    }
    tick()
    return () => timer && clearTimeout(timer)
  }, [runId, stageId, applicationStageId, onFinished])
  return <div className="text-sm text-gray-600">Status da IA: {status}</div>
}


function Panel({ jobId }: { jobId: string | null }) {
  const [data, setData] = useState<any | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  
  const refreshData = async () => {
    if (!jobId) return
    setRefreshing(true)
    try {
      const response = await fetch(`/api/jobs/${jobId}/panel`)
      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('Erro ao carregar painel:', error)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    refreshData()
  }, [jobId])

  if (!jobId) return null
  if (!data) return <div className="text-sm text-gray-600">Carregando...</div>
  
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




