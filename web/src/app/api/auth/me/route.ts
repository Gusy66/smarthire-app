import { getSupabaseAdmin } from "../../_lib/supabaseAdmin"
import { requireUser } from "../../_lib/auth"

export async function GET() {
  try {
    const admin = getSupabaseAdmin()
    const user = await requireUser()
    const { data, error } = await admin
      .from('users')
      .select('id, name, email')
      .eq('id', user.id)
      .maybeSingle()
    if (error) return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })

    // Tenta obter nome do Auth quando não existir na tabela users
    let authName: string | null = null
    let authEmail: string | null = null
    try {
      const { data: authUser } = await admin.auth.admin.getUserById(user.id)
      const meta = (authUser?.user as any)?.user_metadata || {}
      const full = typeof meta.full_name === 'string' ? meta.full_name.trim() : ''
      const simple = typeof meta.name === 'string' ? meta.name.trim() : ''
      authName = full || simple || null
      authEmail = authUser?.user?.email ?? null
    } catch {}

    const tableName = (typeof data?.name === 'string' && data.name.trim().length > 0) ? data.name.trim() : null
    const finalName = tableName || authName || null
    const finalEmail = data?.email || authEmail || null

    // Garantir que nunca retornamos o email como nome (comparação case-insensitive)
    let safeName: string | null = null
    if (finalName && finalEmail) {
      // Se o nome é diferente do email (ignorando case), usar o nome
      if (finalName.toLowerCase() !== finalEmail.toLowerCase()) {
        safeName = finalName
      }
    } else if (finalName) {
      // Se temos nome mas não temos email, usar o nome
      safeName = finalName
    }

    return Response.json({ id: user.id, name: safeName, email: finalEmail })
  } catch (error: any) {
    if (error?.message === 'unauthorized') {
      return Response.json({ error: { code: 'unauthorized', message: 'Usuário não autenticado' } }, { status: 401 })
    }
    return Response.json({ error: { code: 'internal_error', message: error?.message || 'Erro interno' } }, { status: 500 })
  }
}


