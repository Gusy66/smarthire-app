export type Stage = { id: string; name: string; order_index: number; threshold: number; stage_weight: number }

export type BoardLaneItem = {
  application_id: string
  application_stage_id: string
  candidate: { id: string; name?: string; email?: string; avatar_url?: string }
  stage_id: string
  score: number | null
  application_created_at?: string
  evaluation_count?: number
  run_status?: string | null
}

export type BoardResponse = {
  stages: Stage[]
  lanes: Record<string, BoardLaneItem[]>
  evaluation_counts_by_stage_id?: Record<string, number>
  latest_scores_by_application_id?: Record<string, number>
  stage_scores_by_stage_id?: Record<string, number[]>
}

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


