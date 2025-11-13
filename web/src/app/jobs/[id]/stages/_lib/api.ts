import type { BoardResponse, LatestAnalysis } from './types'

export async function getBoard(jobId: string): Promise<BoardResponse> {
  const res = await fetch(`/api/jobs/${jobId}/board`, { credentials: 'same-origin' })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error?.message || 'Falha ao carregar board')
  return json as BoardResponse
}

export async function moveBulk(jobId: string, applicationStageIds: string[], toStageId: string): Promise<void> {
  const res = await fetch(`/api/jobs/${jobId}/stages/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ application_stage_ids: applicationStageIds, to_stage_id: toStageId })
  })
  if (!res.ok) {
    const json = await res.json().catch(()=>null)
    throw new Error(json?.error?.message || 'Falha ao mover candidatos')
  }
}

export async function getLatestAnalysis(
  stageId: string,
  params?: { applicationStageId?: string; applicationId?: string },
): Promise<LatestAnalysis | null> {
  const search = new URLSearchParams()
  if (params?.applicationStageId) search.set('application_stage_id', params.applicationStageId)
  if (params?.applicationId) search.set('application_id', params.applicationId)
  const query = search.toString()
  const url = `/api/stages/${stageId}/analysis/latest${query ? `?${query}` : ''}`
  const res = await fetch(url, { credentials: 'same-origin' })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    if (json?.error?.code === 'not_found') return null
    throw new Error(json?.error?.message || 'Falha ao carregar análise')
  }
  return json?.item || null
}

export async function evaluate(stageId: string, payload: { application_id: string; application_stage_id: string; candidate_id: string }): Promise<{ run_id?: string }> {
  const res = await fetch(`/api/stages/${stageId}/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload)
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error?.message || 'Falha ao iniciar avaliação')
  return json
}


