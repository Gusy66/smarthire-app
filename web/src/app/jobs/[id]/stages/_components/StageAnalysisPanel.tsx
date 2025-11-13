/**
 * Panel simplificado para exibir análises da IA por etapa.
 */
'use client'

import { useEffect, useState } from 'react'

type AnalysisResult = {
  id: string
  run_id?: string
  created_at: string
  status?: 'running' | 'succeeded' | 'failed' | string
  result?: {
    score?: number
    analysis?: string
    matched_requirements?: string[]
    missing_requirements?: string[]
    strengths?: string[]
    weaknesses?: string[]
    recommendations?: string[]
    extraction_warnings?: string[]
  } | null
}

type Props = {
  analysis: AnalysisResult | null
  candidateName: string | null
  loading: boolean
  expanded: boolean
  onToggle: () => void
  onRefresh: () => void
}

export default function StageAnalysisPanel({ analysis, candidateName, loading, expanded, onToggle, onRefresh }: Props) {
  const [visible, setVisible] = useState(expanded)

  useEffect(() => {
    setVisible(expanded)
  }, [expanded])

  useEffect(() => {
    console.log('[DEBUG] StageAnalysisPanel recebeu análise:', analysis)
    if (analysis?.result) {
      console.log('[DEBUG] Resultado da análise:', analysis.result)
      console.log('[DEBUG] Score:', analysis.result.score)
      console.log('[DEBUG] Analysis:', analysis.result.analysis)
      console.log('[DEBUG] Strengths:', analysis.result.strengths)
      console.log('[DEBUG] Weaknesses:', analysis.result.weaknesses)
    }
  }, [analysis])

  if (!candidateName) {
    return (
      <aside className="card p-4 text-sm text-gray-600">
        <div className="flex items-center justify-between gap-2">
          <span>Selecione um candidato para visualizar a análise.</span>
          <button className="btn btn-outline btn-xs" onClick={onRefresh}>Atualizar</button>
        </div>
      </aside>
    )
  }

  const renderList = (title: string, items?: string[], emptyMessage?: string, variant: 'positive' | 'negative' | 'neutral' = 'neutral') => {
    if (!items || !items.length) {
      return (
        <div className="border rounded p-3 bg-gray-50 text-sm text-gray-600">
          <strong className="block text-gray-700 mb-1">{title}</strong>
          {emptyMessage || 'Nenhum item identificado.'}
        </div>
      )
    }

    const color = variant === 'positive' ? 'text-green-600' : variant === 'negative' ? 'text-red-600' : 'text-gray-700'

    return (
      <div className="border rounded p-3 bg-white shadow-sm">
        <strong className={`block text-sm mb-2 ${color}`}>{title}</strong>
        <ul className="list-disc pl-4 space-y-1 text-sm text-gray-700">
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>{item}</li>
          ))}
        </ul>
      </div>
    )
  }

  if (loading) {
    return <div className="card p-4 text-sm text-gray-600">Carregando análise...</div>
  }

  if (!analysis) {
    return (
      <div className="card p-4 text-sm text-gray-600 flex items-center justify-between">
        <span>Nenhuma análise disponível para {candidateName || 'o candidato'}.</span>
        <button className="btn btn-outline btn-sm" onClick={onRefresh}>Atualizar</button>
      </div>
    )
  }

  const status = analysis.status ?? 'succeeded'
  const score = analysis.result?.score ?? null
  const strengths = analysis.result?.strengths ?? []
  const weaknesses = analysis.result?.weaknesses ?? []
  const warnings = analysis.result?.extraction_warnings ?? []

  return (
    <aside className="card p-4 space-y-4 lg:sticky lg:top-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-gray-900">Análise da IA</h4>
          <p className="text-sm text-gray-700">{candidateName}</p>
          <p className="text-xs text-gray-500">ID: {analysis.run_id || analysis.id}</p>
          <p className="text-xs text-gray-500">Atualizado em {new Date(analysis.created_at).toLocaleString('pt-BR')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-outline btn-xs" onClick={onRefresh}>Recarregar</button>
          <button className="btn btn-ghost btn-xs" onClick={() => { setVisible((prev) => !prev); onToggle() }}>
            {visible ? 'Recolher' : 'Expandir'}
          </button>
        </div>
      </header>

      {status === 'running' && (
        <div className="border border-emerald-200 bg-emerald-50 rounded p-3 text-sm text-emerald-800">
          <p className="font-semibold">Análise em andamento...</p>
          <p>A IA está avaliando o candidato. Recarregue em alguns instantes para ver o resultado.</p>
        </div>
      )}

      {score !== null && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <p className="text-sm text-blue-900 font-semibold">Pontuação Geral</p>
          <p className="text-2xl font-bold text-blue-700">{score.toFixed(1)} <span className="text-base text-blue-500">/ 10</span></p>
        </div>
      )}

      {visible && (
        <div className="space-y-4">
          {analysis.result?.analysis && (
            <div className="border rounded p-3 bg-white shadow-sm">
              <strong className="block text-sm text-gray-900 mb-2">Resumo da IA</strong>
              <p className="text-sm text-gray-700 whitespace-pre-line">{analysis.result.analysis}</p>
            </div>
          )}

          <div className="grid gap-3">
            {renderList('Pontos fortes', strengths, 'Nenhum ponto forte identificado.', 'positive')}
            {renderList('Requisitos não atendidos', weaknesses, 'Nenhum requisito faltante identificado.', 'negative')}
          </div>

          {warnings.length > 0 && (
            <div className="border border-yellow-300 bg-yellow-50 rounded p-3 text-sm text-yellow-800">
              <strong className="block mb-1">Avisos de extração</strong>
              <ul className="list-disc pl-4 space-y-1">
                {warnings.map((warning, index) => (
                  <li key={`warning-${index}`}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
