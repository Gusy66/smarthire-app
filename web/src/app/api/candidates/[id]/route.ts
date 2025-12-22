import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin'
import { requireUser } from '../../_lib/auth'

type Params = { params: Promise<{ id: string }> }

// GET - Retorna dados completos do candidato incluindo aplicações, histórico, documentos e análises IA
export async function GET(_req: NextRequest, { params }: Params) {
  const { id: candidateId } = await params
  const supabase = getSupabaseAdmin()

  let user
  try {
    user = await requireUser()
  } catch {
    return Response.json({ error: { code: 'unauthorized', message: 'Não autenticado' } }, { status: 401 })
  }

  // Buscar dados básicos do candidato
  const { data: candidate, error: candidateError } = await supabase
    .from('candidates')
    .select('id, name, email, phone, city, state, address, gender, education, languages, children, resume_path, resume_bucket, created_at, company_id')
    .eq('id', candidateId)
    .single()

  if (candidateError) {
    return Response.json({ error: { code: 'db_error', message: candidateError.message } }, { status: 500 })
  }

  if (!candidate) {
    return Response.json({ error: { code: 'not_found', message: 'Candidato não encontrado' } }, { status: 404 })
  }

  if (candidate.company_id !== user.company_id) {
    return Response.json({ error: { code: 'forbidden', message: 'Acesso negado' } }, { status: 403 })
  }

  // Buscar aplicações do candidato com dados da vaga
  const { data: applications } = await supabase
    .from('applications')
    .select(`
      id, 
      job_id, 
      created_at,
      jobs(id, title, status)
    `)
    .eq('candidate_id', candidateId)
    .order('created_at', { ascending: false })

  // Para cada aplicação, buscar as etapas e status
  const applicationsWithStages = await Promise.all(
    (applications || []).map(async (app) => {
      // Buscar todas as etapas da vaga
      const { data: allStages } = await supabase
        .from('job_stages')
        .select('id, name, order_index, description')
        .eq('job_id', app.job_id)
        .order('order_index', { ascending: true })

      // Buscar status de cada etapa para esta aplicação
      const { data: appStages } = await supabase
        .from('application_stages')
        .select('id, stage_id, status, decided_at, created_at')
        .eq('application_id', app.id)

      // Mapear etapas com status
      const stagesWithStatus = (allStages || []).map((stage) => {
        const appStage = (appStages || []).find((as) => as.stage_id === stage.id)
        return {
          id: stage.id,
          name: stage.name,
          order_index: stage.order_index,
          description: stage.description,
          status: appStage?.status || 'not_started',
          application_stage_id: appStage?.id || null,
          decided_at: appStage?.decided_at || null,
        }
      })

      // Determinar etapa atual (primeira pendente ou running, ou última)
      const currentStage = stagesWithStatus.find((s) => s.status === 'running' || s.status === 'pending') 
        || stagesWithStatus[stagesWithStatus.length - 1]
        || null

      // Determinar status final
      const hasSucceeded = stagesWithStatus.some((s) => s.status === 'succeeded')
      const hasFailed = stagesWithStatus.some((s) => s.status === 'failed')
      const allSucceeded = stagesWithStatus.length > 0 && stagesWithStatus.every((s) => s.status === 'succeeded')
      
      let finalStatus: 'pending' | 'approved' | 'rejected' = 'pending'
      if (allSucceeded) finalStatus = 'approved'
      else if (hasFailed) finalStatus = 'rejected'

      return {
        id: app.id,
        job_id: app.job_id,
        job_title: (app.jobs as any)?.title || 'Vaga não encontrada',
        job_status: (app.jobs as any)?.status || 'closed',
        created_at: app.created_at,
        current_stage: currentStage,
        all_stages: stagesWithStatus,
        final_status: finalStatus,
      }
    })
  )

  // Buscar análises de IA para cada etapa
  const aiAnalyses: any[] = []
  for (const app of applicationsWithStages) {
    for (const stage of app.all_stages) {
      if (!stage.application_stage_id) continue

      const { data: aiRuns } = await supabase
        .from('stage_ai_runs')
        .select('id, type, status, result, finished_at, started_at')
        .eq('application_stage_id', stage.application_stage_id)
        .eq('type', 'evaluate')
        .eq('status', 'succeeded')
        .order('finished_at', { ascending: false })
        .limit(1)

      if (aiRuns && aiRuns.length > 0) {
        const run = aiRuns[0]
        const result = run.result as any
        
        aiAnalyses.push({
          job_title: app.job_title,
          stage_name: stage.name,
          stage_order: stage.order_index,
          score: result?.score ?? result?.overall_score ?? null,
          comment: result?.summary ?? result?.comment ?? result?.analysis ?? null,
          analyzed_at: run.finished_at,
          requirements_scores: result?.requirement_scores || result?.requirements || [],
          raw_result: result,
        })
      }
    }
  }

  // Buscar documentos do candidato
  const { data: documents } = await supabase
    .from('documents')
    .select('id, type, storage_path, created_at')
    .eq('owner_type', 'candidate')
    .eq('owner_id', candidateId)
    .order('created_at', { ascending: false })

  // Buscar histórico de ações (audit_logs)
  const { data: auditLogs } = await supabase
    .from('audit_logs')
    .select('id, action, entity, metadata, created_at, user_id')
    .eq('entity', 'candidate')
    .eq('entity_id', candidateId)
    .order('created_at', { ascending: false })
    .limit(50)

  // Construir histórico combinado (audit_logs + mudanças de etapa)
  const history: any[] = []

  // Adicionar logs de auditoria
  for (const log of auditLogs || []) {
    history.push({
      date: log.created_at,
      action: log.action,
      description: formatAuditAction(log.action, log.metadata),
      type: 'audit',
    })
  }

  // Adicionar mudanças de etapa como histórico
  for (const app of applicationsWithStages) {
    for (const stage of app.all_stages) {
      if (stage.status !== 'not_started' && stage.decided_at) {
        history.push({
          date: stage.decided_at,
          action: stage.status === 'succeeded' ? 'stage_approved' : stage.status === 'failed' ? 'stage_rejected' : 'stage_updated',
          description: `Etapa "${stage.name}" - ${formatStageStatus(stage.status)}`,
          type: 'stage',
          job_title: app.job_title,
        })
      }
    }
  }

  // Ordenar histórico por data
  history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // Normalizar resume_path
  const normalizedCandidate = {
    ...candidate,
    resume_path: normalizeStoragePath(candidate.resume_path, candidate.resume_bucket),
  }

  return Response.json({
    candidate: normalizedCandidate,
    applications: applicationsWithStages,
    history,
    documents: documents || [],
    ai_analyses: aiAnalyses,
  })
}

function formatAuditAction(action: string, metadata: any): string {
  switch (action) {
    case 'create': return 'Candidato criado'
    case 'update': return 'Candidato atualizado'
    case 'delete': return 'Candidato removido'
    case 'application_created': return `Aplicação criada para vaga "${metadata?.job_title || 'N/A'}"`
    case 'stage_changed': return `Etapa alterada: ${metadata?.stage_name || 'N/A'}`
    default: return action
  }
}

function formatStageStatus(status: string): string {
  switch (status) {
    case 'pending': return 'Pendente'
    case 'running': return 'Em análise'
    case 'succeeded': return 'Aprovado'
    case 'failed': return 'Reprovado'
    default: return status
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: candidateId } = await params
  const supabase = getSupabaseAdmin()

  let user
  try {
    user = await requireUser()
  } catch {
    return Response.json({ error: { code: 'unauthorized', message: 'Não autenticado' } }, { status: 401 })
  }

  const body = await req.json()
  const { resume_path, resume_bucket } = body || {}

  if (!resume_path || !resume_bucket) {
    return Response.json({
      error: { code: 'validation_error', message: 'resume_path e resume_bucket são obrigatórios' },
    }, { status: 400 })
  }

  const { data: candidate, error: fetchError } = await supabase
    .from('candidates')
    .select('id, company_id')
    .eq('id', candidateId)
    .single()

  if (fetchError) {
    return Response.json({ error: { code: 'db_error', message: fetchError.message } }, { status: 500 })
  }

  if (!candidate) {
    return Response.json({ error: { code: 'not_found', message: 'Candidato não encontrado' } }, { status: 404 })
  }

  if (candidate.company_id !== user.company_id) {
    return Response.json({ error: { code: 'forbidden', message: 'Acesso negado' } }, { status: 403 })
  }

  const normalizedPath = normalizeStoragePath(resume_path, resume_bucket)
  if (!normalizedPath) {
    return Response.json({ error: { code: 'validation_error', message: 'resume_path inválido' } }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from('candidates')
    .update({
      resume_path: normalizedPath,
      resume_bucket,
    })
    .eq('id', candidateId)

  if (updateError) {
    return Response.json({ error: { code: 'db_error', message: updateError.message } }, { status: 500 })
  }

  return Response.json({ ok: true })
}

function normalizeStoragePath(path: string | null, bucket: string | null) {
  if (!path) return null
  if (!bucket) return path.replace(/^\/+/, '')
  const prefix = `${bucket}/`
  const cleaned = path.startsWith(prefix) ? path.slice(prefix.length) : path
  return cleaned.replace(/^\/+/, '')
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id: candidateId } = await params
  const supabase = getSupabaseAdmin()

  try {
    await requireUser()
  } catch (error) {
    return Response.json({ error: { code: 'unauthorized', message: 'Não autenticado' } }, { status: 401 })
  }

  try {
    // Deletar todas as aplicações e seus registros associados
    const { data: applications, error: appsError } = await supabase
      .from('applications')
      .select('id')
      .eq('candidate_id', candidateId)

    if (appsError) {
      return Response.json({ error: { code: 'db_error', message: appsError.message } }, { status: 500 })
    }

    // Deletar application_stages para cada application
    if (applications && applications.length > 0) {
      const appIds = applications.map(a => a.id)
      const { error: stagesError } = await supabase
        .from('application_stages')
        .delete()
        .in('application_id', appIds)

      if (stagesError) {
        return Response.json({ error: { code: 'db_error', message: stagesError.message } }, { status: 500 })
      }

      // Deletar applications
      const { error: deleteAppsError } = await supabase
        .from('applications')
        .delete()
        .in('id', appIds)

      if (deleteAppsError) {
        return Response.json({ error: { code: 'db_error', message: deleteAppsError.message } }, { status: 500 })
      }
    }

    // Deletar o candidato
    const { error: deleteCandidateError } = await supabase
      .from('candidates')
      .delete()
      .eq('id', candidateId)

    if (deleteCandidateError) {
      return Response.json({ error: { code: 'db_error', message: deleteCandidateError.message } }, { status: 500 })
    }

    return Response.json({ ok: true })
  } catch (error) {
    console.error('Erro ao deletar candidato:', error)
    return Response.json({ error: { code: 'error', message: error instanceof Error ? error.message : 'Erro ao deletar candidato' } }, { status: 500 })
  }
}
