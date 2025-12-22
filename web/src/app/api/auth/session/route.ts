import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  let payload: any = {}
  try {
    // Tentar parsear o body, se estiver vazio ou inválido, usar objeto vazio
    const text = await req.text()
    if (text && text.trim()) {
      try {
        payload = JSON.parse(text)
      } catch {
        payload = {}
      }
    }
    
    const { event, session } = payload || {}

    const shouldSetToken = ['SIGNED_IN', 'INITIAL_SESSION', 'TOKEN_REFRESHED', 'REFRESH_TOKEN_UPDATED', 'RECOVERED', 'PASSWORD_RECOVERY'].includes(event)
    if (shouldSetToken) {
      const accessToken = session?.access_token
      if (!accessToken) {
        return Response.json({ error: { code: 'invalid_session', message: 'Sessão inválida' } }, { status: 400 })
      }
      cookieStore.set('sb-access-token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: session?.expires_in ?? 60 * 60 * 8,
      })
    }

    if (event === 'SIGNED_OUT') {
      cookieStore.delete('sb-access-token')
    }

    // Propaga a expiração para o navegador: evita loading infinito em alguns ambientes
    const response = Response.json({ ok: true })
    if (payload?.session?.expires_at) {
      response.headers.set('X-Session-Expires-At', String(payload.session.expires_at))
    }
    return response
  } catch (error) {
    console.error('Erro ao sincronizar sessão', error, 'payload:', payload)
    // Mesmo com erro, tentar deletar o cookie para garantir logout
    try {
      cookieStore.delete('sb-access-token')
    } catch {}
    return Response.json({ ok: true })
  }
}


