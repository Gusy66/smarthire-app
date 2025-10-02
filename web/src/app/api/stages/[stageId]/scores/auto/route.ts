import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../../_lib/supabaseAdmin'

type Params = { params: Promise<{ stageId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { stageId } = await params
  const body = await req.json()
  const { application_stage_id, run_id } = body || {}
  if (!application_stage_id) {
    return Response.json({ error: { code: 'validation_error', message: 'application_stage_id é obrigatório' } }, { status: 400 })
  }
  const supabase = getSupabaseAdmin()

  // Busca o run da IA para obter os resultados
  const { data: aiRun, error: runErr } = await supabase
    .from('stage_ai_runs')
    .select('run_id, status, result')
    .eq('application_stage_id', application_stage_id)
    .eq('type', 'evaluate')
    .eq('stage_id', stageId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (runErr || !aiRun?.run_id) {
    return Response.json({ error: { code: 'no_ai_run', message: 'Nenhum run de IA encontrado' } }, { status: 400 })
  }

  if (run_id && aiRun.run_id !== run_id) {
    return Response.json({ error: { code: 'run_mismatch', message: 'Run informado difere do run mais recente' } }, { status: 409 })
  }

  // Busca resultado da IA
  const aiRes = await fetch(`${process.env.NEXT_PUBLIC_AI_BASE_URL || 'http://localhost:8000'}/v1/runs/${aiRun.run_id}`)
  if (!aiRes.ok) {
    return Response.json({ error: { code: 'ai_error', message: 'Erro ao buscar resultado da IA' } }, { status: 500 })
  }

  const aiResult = await aiRes.json()
  if (aiResult.status !== 'succeeded' || !aiResult.result) {
    return Response.json({ error: { code: 'ai_not_ready', message: 'IA ainda não finalizou ou falhou' } }, { status: 400 })
  }

  // Persiste resultado completo na tabela stage_ai_runs
  await supabase
    .from('stage_ai_runs')
    .update({ result: aiResult.result })
    .eq('application_stage_id', application_stage_id)
    .eq('run_id', aiRun.run_id)

  // Busca requisitos da etapa
  const { data: reqs, error: reqErr } = await supabase
    .from('stage_requirements')
    .select('id, weight, label')
    .eq('stage_id', stageId)
    .order('created_at', { ascending: true })
  if (reqErr) return Response.json({ error: { code: 'db_error', message: reqErr.message } }, { status: 500 })

  // Usa resultado da IA para gerar scores
  const aiScore = aiResult.result.score || 0
  const matchedReqs = aiResult.result.matched_requirements || []
  const missingReqs = aiResult.result.missing_requirements || []

  const scoresPayload = (reqs ?? []).map((req) => {
    // Se o requisito foi identificado pela IA, usa score alto
    // Se não foi identificado, usa score baixo
    const isMatched = matchedReqs.some(matched => 
      matched.toLowerCase().includes(req.label.toLowerCase()) ||
      req.label.toLowerCase().includes(matched.toLowerCase())
    )
    
    const baseScore = isMatched ? aiScore * 0.8 : aiScore * 0.3
    const weightedScore = Math.min(10, baseScore * (req.weight || 1))
    
    return {
      application_stage_id,
      requirement_id: req.id,
      source: 'ai' as const,
      value: Number(weightedScore.toFixed(2)),
    }
  })

  if (scoresPayload.length === 0) return Response.json({ inserted: 0 })

  const { error: insErr } = await supabase.from('stage_scores').insert(scoresPayload)
  if (insErr) return Response.json({ error: { code: 'db_error', message: insErr.message } }, { status: 500 })

  // Atualiza status da application_stage para succeeded
  await supabase
    .from('application_stages')
    .update({ status: 'succeeded', decided_at: new Date().toISOString() })
    .eq('id', application_stage_id)

  // Atualiza status do run da IA
  await supabase
    .from('stage_ai_runs')
    .update({ status: 'succeeded' })
    .eq('application_stage_id', application_stage_id)
    .eq('type', 'evaluate')

  return Response.json({ 
    inserted: scoresPayload.length,
    ai_score: aiScore,
    analysis: aiResult.result.analysis
  })
}


