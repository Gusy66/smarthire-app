import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../_lib/supabaseAdmin'
import { requirePlatformAdmin } from '../../../_lib/platformAuth'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * GET /api/platform/companies/[id]
 * Retorna detalhes de uma empresa específica
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await requirePlatformAdmin()

    const { id } = await params
    const admin = getSupabaseAdmin()

    // Buscar empresa
    const { data: company, error: companyError } = await admin
      .from('companies')
      .select('id, name, created_at')
      .eq('id', id)
      .maybeSingle()

    if (companyError || !company) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Empresa não encontrada' } },
        { status: 404 }
      )
    }

    // Buscar usuários da empresa
    const { data: users, error: usersError } = await admin
      .from('users')
      .select('id, email, name, role, created_at')
      .eq('company_id', id)
      .order('created_at', { ascending: false })

    // Buscar estatísticas
    const { count: jobCount } = await admin
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', id)

    const { count: candidateCount } = await admin
      .from('candidates')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', id)

    return NextResponse.json({
      company: {
        ...company,
        users: users || [],
        stats: {
          user_count: users?.length || 0,
          job_count: jobCount || 0,
          candidate_count: candidateCount || 0
        }
      }
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    
    if (message.includes('platform_')) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Acesso negado' } },
        { status: 401 }
      )
    }

    console.error('[Platform Company] Erro:', error)
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Erro interno do servidor' } },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/platform/companies/[id]
 * Atualiza dados de uma empresa
 * 
 * Body: { name?: string }
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    await requirePlatformAdmin()

    const { id } = await params
    const body = await req.json()
    const { name } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: 'Nome da empresa é obrigatório' } },
        { status: 400 }
      )
    }

    const admin = getSupabaseAdmin()

    // Verificar se empresa existe
    const { data: existing } = await admin
      .from('companies')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Empresa não encontrada' } },
        { status: 404 }
      )
    }

    // Atualizar empresa
    const { data: company, error: updateError } = await admin
      .from('companies')
      .update({ name: name.trim() })
      .eq('id', id)
      .select('id, name, created_at')
      .single()

    if (updateError) {
      console.error('[Platform Company] Erro ao atualizar:', updateError)
      return NextResponse.json(
        { error: { code: 'db_error', message: 'Erro ao atualizar empresa' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, company })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    
    if (message.includes('platform_')) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Acesso negado' } },
        { status: 401 }
      )
    }

    console.error('[Platform Company] Erro:', error)
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Erro interno do servidor' } },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/platform/companies/[id]
 * Exclui uma empresa (cuidado: cascata)
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    await requirePlatformAdmin()

    const { id } = await params
    const admin = getSupabaseAdmin()

    // Verificar se empresa existe
    const { data: existing } = await admin
      .from('companies')
      .select('id, name')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Empresa não encontrada' } },
        { status: 404 }
      )
    }

    // Verificar se há dados associados
    const { count: userCount } = await admin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', id)

    if (userCount && userCount > 0) {
      return NextResponse.json(
        { 
          error: { 
            code: 'has_dependencies', 
            message: `Não é possível excluir. A empresa possui ${userCount} usuário(s) associado(s).` 
          } 
        },
        { status: 400 }
      )
    }

    // Deletar empresa
    const { error: deleteError } = await admin
      .from('companies')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[Platform Company] Erro ao excluir:', deleteError)
      return NextResponse.json(
        { error: { code: 'db_error', message: 'Erro ao excluir empresa' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: 'Empresa excluída com sucesso' })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    
    if (message.includes('platform_')) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Acesso negado' } },
        { status: 401 }
      )
    }

    console.error('[Platform Company] Erro:', error)
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Erro interno do servidor' } },
      { status: 500 }
    )
  }
}

