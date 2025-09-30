'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useToast } from '@/components/ToastProvider'

type AnalysisResult = {
  score: number
  analysis: string
  matched_requirements: string[]
  missing_requirements: string[]
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
  stage_id: string
  application_id: string
}

type RunStatus = {
  id: string
  type: string
  status: string
  progress: number | null
  error: string | null
  result: AnalysisResult | null
}

export default function AnalysisPage() {
  const params = useParams()
  const { notify } = useToast()
  const [runStatus, setRunStatus] = useState<RunStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const runId = params.runId as string

  useEffect(() => {
    if (runId) {
      fetchRunStatus()
    }
  }, [runId])

  async function fetchRunStatus() {
    try {
      const res = await fetch(`/api/ai/runs/${runId}`)
      const data = await res.json()
      setRunStatus(data)
      
      // Se ainda está processando, aguardar e tentar novamente
      if (data.status === 'running') {
        setTimeout(fetchRunStatus, 2000)
      }
    } catch (error) {
      console.error('Erro ao buscar status:', error)
      notify.notify({
        title: 'Erro',
        description: 'Erro ao buscar análise',
        variant: 'error'
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="card p-8 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Carregando análise...</p>
        </div>
      </div>
    )
  }

  if (!runStatus) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="card p-8 text-center">
          <h1 className="text-xl font-semibold mb-4">Análise não encontrada</h1>
          <p className="text-gray-600 mb-4">A análise solicitada não foi encontrada.</p>
          <a href="/jobs" className="btn btn-primary">Voltar para Vagas</a>
        </div>
      </div>
    )
  }

  if (runStatus.status === 'failed') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="card p-8 text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold mb-4">Erro na Análise</h1>
          <p className="text-gray-600 mb-4">{runStatus.error || 'Erro desconhecido'}</p>
          <a href="/jobs" className="btn btn-primary">Voltar para Vagas</a>
        </div>
      </div>
    )
  }

  if (runStatus.status === 'running') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="card p-8 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <h1 className="text-xl font-semibold mb-4">Processando Análise</h1>
          <p className="text-gray-600 mb-4">A IA está analisando o candidato...</p>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${runStatus.progress || 0}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-500">{runStatus.progress || 0}% concluído</p>
        </div>
      </div>
    )
  }

  const result = runStatus.result!
  const scoreColor = result.score >= 8 ? 'text-green-600' : result.score >= 6 ? 'text-yellow-600' : 'text-red-600'
  const scoreBg = result.score >= 8 ? 'bg-green-50 border-green-200' : result.score >= 6 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Análise do Candidato</h1>
          <p className="text-gray-600">Análise detalhada realizada pela IA</p>
        </div>
        <a href="/jobs" className="btn btn-outline">← Voltar</a>
      </div>

      {/* Pontuação Principal */}
      <div className={`card p-6 ${scoreBg} border-2`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium mb-2">Pontuação Final</h2>
            <p className="text-sm text-gray-600">Baseada nos requisitos da etapa</p>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold ${scoreColor}`}>
              {result.score}/10
            </div>
            <div className="text-sm text-gray-500">
              {result.score >= 8 ? 'Excelente' : result.score >= 6 ? 'Bom' : 'Precisa melhorar'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pontos Fortes */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-medium">✓</div>
            <h3 className="text-lg font-medium">Pontos Fortes</h3>
          </div>
          {result.strengths && result.strengths.length > 0 ? (
            <ul className="space-y-2">
              {result.strengths.map((strength, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></span>
                  <span className="text-sm">{strength}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">Nenhum ponto forte identificado</p>
          )}
        </div>

        {/* Áreas de Melhoria */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center text-sm font-medium">⚠</div>
            <h3 className="text-lg font-medium">Áreas de Melhoria</h3>
          </div>
          {result.weaknesses && result.weaknesses.length > 0 ? (
            <ul className="space-y-2">
              {result.weaknesses.map((weakness, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></span>
                  <span className="text-sm">{weakness}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">Nenhuma área de melhoria identificada</p>
          )}
        </div>
      </div>

      {/* Requisitos Atendidos */}
      <div className="card p-6">
        <h3 className="text-lg font-medium mb-4">Requisitos da Etapa</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-green-700 mb-2">✓ Atendidos ({result.matched_requirements.length})</h4>
            {result.matched_requirements.length > 0 ? (
              <ul className="space-y-1">
                {result.matched_requirements.map((req, index) => (
                  <li key={index} className="text-sm text-green-600">• {req}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">Nenhum requisito atendido</p>
            )}
          </div>
          <div>
            <h4 className="font-medium text-red-700 mb-2">✗ Não Atendidos ({result.missing_requirements.length})</h4>
            {result.missing_requirements.length > 0 ? (
              <ul className="space-y-1">
                {result.missing_requirements.map((req, index) => (
                  <li key={index} className="text-sm text-red-600">• {req}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">Todos os requisitos atendidos</p>
            )}
          </div>
        </div>
      </div>

      {/* Recomendações */}
      {result.recommendations && result.recommendations.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">💡</div>
            <h3 className="text-lg font-medium">Recomendações</h3>
          </div>
          <ul className="space-y-2">
            {result.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                <span className="text-sm">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Análise Detalhada */}
      <div className="card p-6">
        <h3 className="text-lg font-medium mb-4">Análise Detalhada</h3>
        <div className="prose max-w-none">
          <p className="text-sm text-gray-700 whitespace-pre-line">{result.analysis}</p>
        </div>
      </div>

      {/* Ações */}
      <div className="flex gap-3 justify-end">
        <button 
          onClick={() => window.print()}
          className="btn btn-outline"
        >
          📄 Imprimir Análise
        </button>
        <button 
          onClick={() => {
            // TODO: Implementar exportação
            notify.notify({
              title: 'Em breve',
              description: 'Funcionalidade de exportação será implementada',
              variant: 'info'
            })
          }}
          className="btn btn-outline"
        >
          📊 Exportar
        </button>
        <a href="/jobs" className="btn btn-primary">
          ✅ Concluir
        </a>
      </div>
    </div>
  )
}
