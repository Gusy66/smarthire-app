import { NextRequest } from 'next/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Buscar status do run no serviço de IA
    const aiServiceUrl = process.env.NEXT_PUBLIC_AI_BASE_URL || 'http://localhost:8000'
    const response = await fetch(`${aiServiceUrl}/v1/runs/${id}`)
    
    if (!response.ok) {
      if (response.status === 404) {
        return Response.json({ error: { code: 'not_found', message: 'Run não encontrado' } }, { status: 404 })
      }
      return Response.json({ error: { code: 'ai_service_error', message: 'Erro no serviço de IA' } }, { status: 500 })
    }
    
    const data = await response.json()
    return Response.json(data)
  } catch (error) {
    console.error('Erro ao buscar run:', error)
    return Response.json({ error: { code: 'internal_error', message: 'Erro interno do servidor' } }, { status: 500 })
  }
}