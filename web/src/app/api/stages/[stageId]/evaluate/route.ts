import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../_lib/supabaseAdmin'

type Params = { params: Promise<{ stageId: string }> }

// Dispara IA para avaliar candidato numa etapa
export async function POST(req: NextRequest, { params }: Params) {
  const { stageId } = await params
  const body = await req.json()
  const { application_id, resume_path, audio_path, transcript_path } = body || {}
  if (!application_id) return Response.json({ error: { code: 'validation_error', message: 'application_id é obrigatório' } }, { status: 400 })

  const supabase = getSupabaseAdmin()
  
  // Garante application_stage
  const { data: stage } = await supabase.from('job_stages').select('id').eq('id', stageId).single()
  const { data: appStageExisting } = await supabase
    .from('application_stages')
    .select('id, status')
    .eq('application_id', application_id)
    .eq('stage_id', stageId)
    .maybeSingle()
  const applicationStageId = appStageExisting?.id
    ? appStageExisting.id
    : (await supabase
        .from('application_stages')
        .insert({ application_id, stage_id: stageId, status: 'running' })
        .select('id')
        .single()).data!.id

  // Dispara avaliação completa na IA
  const aiRes = await fetch(`${process.env.NEXT_PUBLIC_AI_BASE_URL || 'http://localhost:8000'}/v1/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      stage_id: stageId,
      application_id, 
      resume_path, 
      audio_path, 
      transcript_path 
    }),
  })
  
  if (!aiRes.ok) {
    console.error('AI service error:', await aiRes.text())
    return Response.json({ error: { code: 'ai_error', message: 'Erro ao conectar com serviço de IA' } }, { status: 500 })
  }
  
  const aiJson = await aiRes.json()
  const runId = aiJson?.id || 'evaluate-run'

  // Registra o run na base
  await supabase
    .from('stage_ai_runs')
    .insert({ 
      application_stage_id: applicationStageId, 
      type: 'evaluate', 
      status: 'running',
      run_id: runId
    })

  return Response.json({ 
    application_stage_id: applicationStageId, 
    run_id: runId, 
    status: 'running' 
  })
}


