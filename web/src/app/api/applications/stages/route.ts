import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin'
import { requireUser } from '../../_lib/auth'

// PATCH - Atualizar status de uma etapa (aprovar/reprovar candidato)
export async function PATCH(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  let user
  try {
    user = await requireUser()
  } catch {
    return Response.json({ error: { code: 'unauthorized', message: 'Usuário não autenticado' } }, { status: 401 })
  }

  const body = await req.json()
  const { application_id, stage_id, status } = body || {}

  if (!application_id || !stage_id) {
    return Response.json({ error: { code: 'validation_error', message: 'application_id e stage_id são obrigatórios' } }, { status: 400 })
  }

  if (!status || !['pending', 'running', 'succeeded', 'failed'].includes(status)) {
    return Response.json({ error: { code: 'validation_error', message: 'status inválido (deve ser: pending, running, succeeded ou failed)' } }, { status: 400 })
  }

  // Verificar se a application_stage existe
  const { data: existing, error: fetchError } = await supabase
    .from('application_stages')
    .select('id')
    .eq('application_id', application_id)
    .eq('stage_id', stage_id)
    .maybeSingle()

  if (fetchError) {
    return Response.json({ error: { code: 'db_error', message: fetchError.message } }, { status: 500 })
  }

  if (!existing) {
    // Se não existe, criar primeiro
    const { data: newStage, error: createError } = await supabase
      .from('application_stages')
      .insert({ 
        application_id, 
        stage_id, 
        status,
        decided_at: (status === 'succeeded' || status === 'failed') ? new Date().toISOString() : null
      })
      .select('id')
      .single()

    if (createError) {
      return Response.json({ error: { code: 'db_error', message: createError.message } }, { status: 500 })
    }

    // Registrar no audit_log
    await logAuditAction(supabase, user, application_id, stage_id, status)

    return Response.json({ id: newStage.id, status, created: true })
  }

  // Atualizar status existente
  const { error: updateError } = await supabase
    .from('application_stages')
    .update({ 
      status,
      decided_at: (status === 'succeeded' || status === 'failed') ? new Date().toISOString() : null
    })
    .eq('id', existing.id)

  if (updateError) {
    return Response.json({ error: { code: 'db_error', message: updateError.message } }, { status: 500 })
  }

  // Registrar no audit_log
  await logAuditAction(supabase, user, application_id, stage_id, status)

  return Response.json({ id: existing.id, status, updated: true })
}

async function logAuditAction(supabase: any, user: any, applicationId: string, stageId: string, status: string) {
  try {
    // Buscar informações da aplicação e candidato
    const { data: app } = await supabase
      .from('applications')
      .select('candidate_id, jobs(title)')
      .eq('id', applicationId)
      .single()

    // Buscar nome da etapa
    const { data: stage } = await supabase
      .from('job_stages')
      .select('name')
      .eq('id', stageId)
      .single()

    if (app?.candidate_id) {
      await supabase.from('audit_logs').insert({
        company_id: user.company_id,
        user_id: user.id,
        action: status === 'succeeded' ? 'stage_approved' : status === 'failed' ? 'stage_rejected' : 'stage_changed',
        entity: 'candidate',
        entity_id: app.candidate_id,
        metadata: {
          application_id: applicationId,
          stage_id: stageId,
          stage_name: stage?.name || 'N/A',
          job_title: (app.jobs as any)?.title || 'N/A',
          new_status: status,
        },
      })
    }
  } catch (err) {
    console.error('Erro ao registrar audit log:', err)
  }
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  let user
  try {
    user = await requireUser()
  } catch {
    return Response.json({ error: { code: 'unauthorized', message: 'Usuário não autenticado' } }, { status: 401 })
  }
  const body = await req.json()
  const { application_id, stage_id } = body || {}
  if (!application_id || !stage_id) {
    return Response.json({ error: { code: 'validation_error', message: 'application_id e stage_id são obrigatórios' } }, { status: 400 })
  }

  // verifica se já existe (idempotente)
  const { data: existing } = await supabase
    .from('application_stages')
    .select('id, decided_at')
    .eq('application_id', application_id)
    .eq('stage_id', stage_id)
    .maybeSingle()

  if (existing) {
    // se existe mas está fechada, reabre
    if (existing.decided_at) {
      await supabase
        .from('application_stages')
        .update({ decided_at: null })
        .eq('id', existing.id)
    }
    return Response.json({ id: existing.id })
  }

  // cria nova linha
  const { data, error } = await supabase
    .from('application_stages')
    .insert({ application_id, stage_id, status: 'pending' })
    .select('id')
    .single()
  if (error) return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  return Response.json({ id: data.id })
}

