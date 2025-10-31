import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../../_lib/supabaseAdmin'
import { requireUser } from '../../../../_lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { id: jobId } = await params
  const supabase = getSupabaseAdmin()
  let user
  try {
    user = await requireUser()
  } catch {
    return Response.json({ error: { code: 'unauthorized', message: 'Usuário não autenticado' } }, { status: 401 })
  }
  const body = await req.json()
  const { application_stage_ids, to_stage_id } = body || {}
  if (!Array.isArray(application_stage_ids) || !application_stage_ids.length || !to_stage_id) {
    return Response.json({ error: { code: 'validation_error', message: 'Dados inválidos' } }, { status: 400 })
  }

  // valida acesso à vaga e etapa destino
  const { data: job, error: jobErr } = await supabase.from('jobs').select('id, company_id, created_by').eq('id', jobId).maybeSingle()
  if (jobErr || !job) return Response.json({ error: { code: 'not_found', message: 'Vaga não encontrada' } }, { status: 404 })
  if (job.company_id !== user.company_id || job.created_by !== user.id) return Response.json({ error: { code: 'forbidden', message: 'Sem acesso à vaga' } }, { status: 403 })

  const { data: destStage, error: destErr } = await supabase.from('job_stages').select('id, job_id').eq('id', to_stage_id).maybeSingle()
  if (destErr || !destStage || destStage.job_id !== jobId) return Response.json({ error: { code: 'not_found', message: 'Etapa de destino inválida' } }, { status: 404 })

  // Estratégia: fechar (decided_at=now) as linhas atuais e criar novas linhas para a etapa destino,
  // preservando histórico e evitando violar a unique(application_id, stage_id)
  const { data: currentRows, error: fetchErr } = await supabase
    .from('application_stages')
    .select('id, application_id, stage_id, decided_at')
    .in('id', application_stage_ids)
  if (fetchErr) return Response.json({ error: { code: 'db_error', message: fetchErr.message } }, { status: 500 })

  // fecha as atuais
  const { error: closeErr } = await supabase
    .from('application_stages')
    .update({ decided_at: new Date().toISOString() })
    .in('id', application_stage_ids)
  if (closeErr) return Response.json({ error: { code: 'db_error', message: closeErr.message } }, { status: 500 })

  // cria novas para destino, tomando cuidado com duplicatas já existentes (idempotência)
  const uniqueApps = Array.from(new Set((currentRows ?? []).map((r) => r.application_id)))
  if (uniqueApps.length) {
    // checa se já existe linha (ativa ou fechada) para (application_id, to_stage_id)
    const { data: existing, error: existErr } = await supabase
      .from('application_stages')
      .select('id, application_id, stage_id, decided_at')
      .in('application_id', uniqueApps)
      .eq('stage_id', to_stage_id)
    if (existErr) return Response.json({ error: { code: 'db_error', message: existErr.message } }, { status: 500 })

    const byApp = new Map<string, { id: string; decided_at: string | null }>()
    ;(existing ?? []).forEach((e) => byApp.set(e.application_id, { id: e.id, decided_at: e.decided_at }))

    const toReopen: string[] = []
    const toInsert: string[] = []
    for (const appId of uniqueApps) {
      const row = byApp.get(appId)
      if (!row) {
        toInsert.push(appId)
      } else if (row.decided_at) {
        toReopen.push(row.id)
      } // se já existe ativa, não faz nada (idempotente)
    }

    if (toReopen.length) {
      const { error: reopenErr } = await supabase
        .from('application_stages')
        .update({ decided_at: null })
        .in('id', toReopen)
      if (reopenErr) return Response.json({ error: { code: 'db_error', message: reopenErr.message } }, { status: 500 })
    }

    if (toInsert.length) {
      const rows = toInsert.map((appId) => ({ application_id: appId, stage_id: to_stage_id }))
      const { error: insertErr } = await supabase.from('application_stages').insert(rows)
      if (insertErr) return Response.json({ error: { code: 'db_error', message: insertErr.message } }, { status: 500 })
    }
  }

  return Response.json({ ok: true })
}


