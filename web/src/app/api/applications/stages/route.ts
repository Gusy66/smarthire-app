import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin'
import { requireUser } from '../../_lib/auth'

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

