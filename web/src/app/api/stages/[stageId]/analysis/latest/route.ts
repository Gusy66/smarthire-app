import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/app/api/_lib/supabaseAdmin'
import { requireUser } from '@/app/api/_lib/auth'

type Params = { params: Promise<{ stageId: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { stageId } = await params

  // Verificar se o usuário está autenticado
  let user
  try {
    user = await requireUser()
  } catch (error) {
    console.log(`[DEBUG API] Erro de autenticação:`, error)
    return Response.json({ error: { code: 'unauthorized', message: 'Usuário não autenticado' } }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  
  console.log(`[DEBUG API] Usuário autenticado: ${user.id}`)
  
  try {
    console.log(`[DEBUG API] Buscando análise mais recente para stageId: ${stageId}`)
    
    // Primeiro, buscar application_stages para esta etapa
    const { data: appStages, error: appStagesError } = await supabase
      .from('application_stages')
      .select('id, application_id')
      .eq('stage_id', stageId)
    
    if (appStagesError) {
      console.error('Erro ao buscar application_stages:', appStagesError)
      return Response.json({ error: { code: 'db_error', message: appStagesError.message } }, { status: 500 })
    }
    
    if (!appStages || appStages.length === 0) {
      console.log(`[DEBUG API] Nenhum application_stage encontrado para stageId: ${stageId}`)
      return Response.json({ error: { code: 'not_found', message: 'Nenhuma análise encontrada para esta etapa' } }, { status: 404 })
    }
    
    // Buscar a análise mais recente para qualquer application_stage desta etapa
    const { data: analysis, error } = await supabase
      .from('stage_ai_runs')
      .select(`
        id,
        run_id,
        result,
        status,
        finished_at,
        created_at,
        application_stage_id
      `)
      .in('application_stage_id', appStages.map(app => app.id))
      .eq('type', 'evaluate')
      .eq('status', 'succeeded')
      .not('result', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Erro ao buscar análise mais recente:', error)
      return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
    }

    console.log(`[DEBUG API] Resultado da consulta de análise mais recente:`, { analysis, error })

    if (!analysis) {
      console.log(`[DEBUG API] Nenhuma análise encontrada para stageId: ${stageId}`)
      return Response.json({ error: { code: 'not_found', message: 'Nenhuma análise encontrada para esta etapa' } }, { status: 404 })
    }

    // Buscar dados do application_stage e candidato
    const appStage = appStages.find(app => app.id === analysis.application_stage_id)
    if (!appStage) {
      console.error('Application stage não encontrado para a análise')
      return Response.json({ error: { code: 'db_error', message: 'Dados inconsistentes' } }, { status: 500 })
    }

    // Buscar dados do candidato
    const { data: candidateData, error: candidateError } = await supabase
      .from('applications')
      .select(`
        id,
        candidate_id,
        candidates!inner(
          id,
          name,
          email
        )
      `)
      .eq('id', appStage.application_id)
      .single()

    if (candidateError || !candidateData) {
      console.error('Erro ao buscar dados do candidato:', candidateError)
      return Response.json({ error: { code: 'db_error', message: 'Erro ao buscar dados do candidato' } }, { status: 500 })
    }

    // Retornar a análise formatada
    const result = {
      id: analysis.id,
      run_id: analysis.run_id,
      application_stage_id: analysis.application_stage_id,
      stage_id: stageId,
      application_id: appStage.application_id,
      candidate_id: candidateData.candidate_id,
      candidate_name: candidateData.candidates.name,
      candidate_email: candidateData.candidates.email,
      result: analysis.result,
      created_at: analysis.finished_at || analysis.created_at,
    }

    return Response.json({ item: result })
  } catch (error) {
    console.error('Erro inesperado:', error)
    return Response.json({ error: { code: 'internal_error', message: 'Erro interno do servidor' } }, { status: 500 })
  }
}
