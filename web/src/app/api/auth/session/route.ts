import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  try {
    const { event, session } = await req.json()

    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
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

    return Response.json({ ok: true })
  } catch (error) {
    console.error('Erro ao sincronizar sessão', error)
    return Response.json({ error: { code: 'internal_error', message: 'Falha ao sincronizar sessão' } }, { status: 500 })
  }
}


