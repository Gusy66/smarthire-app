export type Stage = { id: string; name: string; order_index: number; threshold: number; stage_weight: number }

export type BoardLaneItem = {
  application_id: string
  application_stage_id: string
  candidate: { id: string; name?: string; email?: string; avatar_url?: string }
  stage_id: string
  score: number | null
  application_created_at?: string
}

export type BoardResponse = { stages: Stage[]; lanes: Record<string, BoardLaneItem[]> }

export type LatestAnalysis = {
  run_id?: string
  status?: 'running' | 'succeeded' | 'failed' | string
  result?: {
    score?: number
    analysis?: string
    strengths?: string[]
    weaknesses?: string[]
    matched_requirements?: string[]
    missing_requirements?: string[]
  } | null
  created_at?: string
}


