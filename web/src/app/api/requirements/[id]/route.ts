import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin'

type Params = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json()
  const { label, weight, description } = body || {}
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('stage_requirements')
    .update({ label, weight, description })
    .eq('id', id)
  if (error) return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('stage_requirements')
    .delete()
    .eq('id', id)
  if (error) return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  return Response.json({ ok: true })
}


