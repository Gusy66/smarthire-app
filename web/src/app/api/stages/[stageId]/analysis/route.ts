import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/app/api/_lib/supabaseAdmin'
import { requireUser } from '@/app/api/_lib/auth'

type Params = { params: Promise<{ stageId: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { stageId } = await params
  const { searchParams } = new URL(req.url)
  const applicationId = searchParams.get('application_id')
  
  if (!applicationId) {
    return Response.json({ error: { code: 'missing_param', message: 'application_id é obrigatório' } }, { status: 400 })
  }

  // Verificar se o usuário está autenticado
  let user
  try {
    user = await requireUser()
  } catch (error) {
    console.log(`[DEBUG API] Erro de autenticação:`, error)
    return Response.json({ error: { code: 'unauthorized', message: 'Usuário não autenticado' } }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  
  try {
    console.log(`[DEBUG API] Buscando análise para stageId: ${stageId}, applicationId: ${applicationId}`)
    
    // Primeiro, verificar se existe application_stage para esta combinação
    const { data: appStage, error: appStageError } = await supabase
      .from('application_stages')
      .select('id')
      .eq('application_id', applicationId)
      .eq('stage_id', stageId)
      .maybeSingle()
    
    console.log(`[DEBUG API] Application stage encontrado:`, { appStage, appStageError })
    
    if (!appStage) {
      console.log(`[DEBUG API] Nenhum application_stage encontrado para applicationId: ${applicationId}, stageId: ${stageId}`)
      return Response.json({ item: null })
    }
    
    // Buscar a análise mais recente para esta etapa e candidato
    const { data: analysis, error } = await supabase
      .from('stage_ai_runs')
      .select(`
        id,
        run_id,
        result,
        status,
        finished_at,
        created_at
      `)
      .eq('application_stage_id', appStage.id)
      .eq('type', 'evaluate')
      .eq('status', 'succeeded')
      .not('result', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Erro ao buscar análise:', error)
      return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
    }

    console.log(`[DEBUG API] Resultado da consulta:`, { analysis, error })

    if (!analysis) {
      console.log(`[DEBUG API] Nenhuma análise encontrada para stageId: ${stageId}, applicationId: ${applicationId}`)
      return Response.json({ item: null })
    }

    // Retornar a análise formatada
    const result = {
      id: analysis.id,
      run_id: analysis.run_id,
      application_stage_id: appStage.id,
      stage_id: stageId,
      application_id: applicationId,
      result: analysis.result,
      created_at: analysis.finished_at || analysis.created_at,
    }

    return Response.json({ item: result })
  } catch (error) {
    console.error('Erro inesperado:', error)
    return Response.json({ error: { code: 'internal_error', message: 'Erro interno do servidor' } }, { status: 500 })
  }
}