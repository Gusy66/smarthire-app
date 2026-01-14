import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin'
import { requirePlatformAdmin } from '../../_lib/platformAuth'

/**
 * POST /api/platform/auth
 * Login para Platform Admins (Super Admins)
 * 
 * Body: { email: string, password: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: 'Email e senha são obrigatórios' } },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, anonKey)

    // Tentar login no Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !authData.user || !authData.session) {
      // Não mascarar totalmente o motivo: ajuda muito no diagnóstico (ex: email não confirmado).
      // Ainda retornamos 401 para não vazar detalhes excessivos, mas preservamos a mensagem do Supabase.
      const msg = authError?.message || 'Credenciais inválidas'
      const lower = msg.toLowerCase()
      const friendly =
        lower.includes('email not confirmed')
          ? 'E-mail não confirmado. Confirme o e-mail no Supabase Auth (ou marque como confirmado) e tente novamente.'
          : lower.includes('invalid login credentials')
            ? 'Credenciais inválidas.'
            : msg

      return NextResponse.json(
        {
          error: {
            code: 'auth_error',
            message: friendly,
            details: process.env.NODE_ENV === 'production' ? undefined : { raw: msg },
          },
        },
        { status: 401 }
      )
    }

    // Verificar se é Platform Admin usando service_role
    const admin = getSupabaseAdmin()
    const { data: platformAdmin, error: platformError } = await admin
      .from('platform_admins')
      .select('id, email, name, is_active')
      .eq('id', authData.user.id)
      .maybeSingle()

    if (platformError || !platformAdmin) {
      return NextResponse.json(
        { error: { code: 'forbidden', message: 'Acesso negado. Você não é um administrador da plataforma.' } },
        { status: 403 }
      )
    }

    if (!platformAdmin.is_active) {
      return NextResponse.json(
        { error: { code: 'inactive', message: 'Sua conta de administrador está inativa.' } },
        { status: 403 }
      )
    }

    // Definir cookie específico para Platform Admin
    const cookieStore = await cookies()
    cookieStore.set('sb-platform-token', authData.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: authData.session.expires_in ?? 60 * 60 * 8 // 8 horas padrão
    })

    return NextResponse.json({
      success: true,
      user: {
        id: platformAdmin.id,
        email: platformAdmin.email,
        name: platformAdmin.name
      }
    })

  } catch (error) {
    console.error('[Platform Auth] Erro no login:', error)
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Erro interno do servidor' } },
      { status: 500 }
    )
  }
}

/**
 * GET /api/platform/auth
 * Verifica se o usuário atual é um Platform Admin autenticado
 */
export async function GET() {
  try {
    const platformAdmin = await requirePlatformAdmin()
    
    return NextResponse.json({
      authenticated: true,
      user: {
        id: platformAdmin.id,
        email: platformAdmin.email,
        name: platformAdmin.name
      }
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'unauthorized'
    
    if (message.includes('platform_')) {
      return NextResponse.json(
        { authenticated: false, error: message },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { authenticated: false, error: 'unauthorized' },
      { status: 401 }
    )
  }
}

/**
 * DELETE /api/platform/auth
 * Logout do Platform Admin
 */
export async function DELETE() {
  try {
    const cookieStore = await cookies()
    cookieStore.delete('sb-platform-token')

    return NextResponse.json({ success: true, message: 'Logout realizado com sucesso' })
  } catch (error) {
    console.error('[Platform Auth] Erro no logout:', error)
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Erro ao fazer logout' } },
      { status: 500 }
    )
  }
}

