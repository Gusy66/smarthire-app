import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin'
import { requirePlatformAdmin } from '../../_lib/platformAuth'

/**
 * GET /api/platform/companies
 * Lista todas as empresas (apenas para Platform Admins)
 */
export async function GET(req: NextRequest) {
  try {
    await requirePlatformAdmin()

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = (page - 1) * limit

    const admin = getSupabaseAdmin()

    // Query base
    let query = admin
      .from('companies')
      .select('id, name, created_at', { count: 'exact' })

    // Filtro de busca
    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    // Ordenação e paginação
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: companies, error, count } = await query

    if (error) {
      console.error('[Platform Companies] Erro ao listar empresas:', error)
      return NextResponse.json(
        { error: { code: 'db_error', message: 'Erro ao listar empresas' } },
        { status: 500 }
      )
    }

    // Buscar contagem de usuários por empresa
    const companiesWithStats = await Promise.all(
      (companies || []).map(async (company) => {
        const { count: userCount } = await admin
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', company.id)

        const { count: jobCount } = await admin
          .from('jobs')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', company.id)

        return {
          ...company,
          user_count: userCount || 0,
          job_count: jobCount || 0
        }
      })
    )

    return NextResponse.json({
      companies: companiesWithStats,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
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

    console.error('[Platform Companies] Erro:', error)
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Erro interno do servidor' } },
      { status: 500 }
    )
  }
}

/**
 * POST /api/platform/companies
 * Cria uma nova empresa (apenas para Platform Admins)
 * 
 * Body: { name: string }
 */
export async function POST(req: NextRequest) {
  try {
    await requirePlatformAdmin()

    const body = await req.json()
    const { name } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: 'Nome da empresa é obrigatório' } },
        { status: 400 }
      )
    }

    const admin = getSupabaseAdmin()

    // Verificar se já existe empresa com esse nome
    const { data: existing } = await admin
      .from('companies')
      .select('id')
      .eq('name', name.trim())
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: { code: 'duplicate', message: 'Já existe uma empresa com esse nome' } },
        { status: 409 }
      )
    }

    // Criar empresa
    const { data: company, error: insertError } = await admin
      .from('companies')
      .insert({ name: name.trim() })
      .select('id, name, created_at')
      .single()

    if (insertError) {
      console.error('[Platform Companies] Erro ao criar empresa:', insertError)
      return NextResponse.json(
        { error: { code: 'db_error', message: 'Erro ao criar empresa' } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      company
    }, { status: 201 })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    
    if (message.includes('platform_')) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Acesso negado' } },
        { status: 401 }
      )
    }

    console.error('[Platform Companies] Erro:', error)
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Erro interno do servidor' } },
      { status: 500 }
    )
  }
}

