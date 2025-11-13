'use client'

import { useMemo, useState } from 'react'
import type { BoardLaneItem, Stage } from '../_lib/types'
import CandidateDrawer from './CandidateDrawer'

export default function CandidatesTable({
  stage,
  items,
  selectedMap,
  setSelectedMap,
  onSelect,
  filters,
}: {
  stage: Stage
  items: BoardLaneItem[]
  selectedMap: Record<string, boolean>
  setSelectedMap: (next: Record<string, boolean>) => void
  onSelect?: (item: BoardLaneItem) => void
  filters?: { query?: string; status?: string; source?: string }
}) {
  const [query, setQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const base = items
    const qCombined = (filters?.query ?? query).trim().toLowerCase()
    let list = base
    if (qCombined) {
      list = list.filter((it) => (it.candidate.name || it.candidate.id).toLowerCase().includes(qCombined) || (it.candidate.email || '').toLowerCase().includes(qCombined))
    }
    // placeholders para status/origem – integrar quando dados existirem
    if (filters?.status) list = list.filter(() => true)
    if (filters?.source) list = list.filter(() => true)
    return list
  }, [items, query, filters?.query, filters?.status, filters?.source])

  const allChecked = filtered.length > 0 && filtered.every((it) => selectedMap[it.application_stage_id])

  function toggleAll(v: boolean) {
    const next = { ...selectedMap }
    filtered.forEach((it) => { next[it.application_stage_id] = v })
    setSelectedMap(next)
  }

  function toggleExpanded(item: BoardLaneItem) {
    setExpandedId((prev) => {
      const next = prev === item.application_stage_id ? null : item.application_stage_id
      if (next) onSelect?.(item)
      return next
    })
  }

  return (
    <div className="card p-0">
      <div className="px-6 py-4 border-b flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex w-full items-center gap-3">
          <input
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            placeholder="Buscar candidatos nesta etapa..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
            {filtered.length} de {items.length}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={(e) => toggleAll(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
          />
          Selecionar todos
        </div>
      </div>

      <div className="space-y-4 px-4 py-6">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
            <p className="text-sm text-gray-600">Nenhum candidato encontrado com os filtros atuais.</p>
          </div>
        ) : (
          filtered.map((it) => {
            const checked = !!selectedMap[it.application_stage_id]
            const expanded = expandedId === it.application_stage_id
            const initials = (it.candidate.name || it.candidate.id).slice(0, 2).toUpperCase()

            return (
              <div key={it.application_stage_id} className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-1 items-start gap-4">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setSelectedMap({ ...selectedMap, [it.application_stage_id]: e.target.checked })
                      }
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                    />
                    <div className="flex items-center gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-base font-semibold text-emerald-700">
                        {initials}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {it.candidate.name || it.candidate.id}
                        </div>
                        {it.candidate.email && (
                          <div className="text-xs text-gray-500">{it.candidate.email}</div>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-600">
                            {stage.name}
                          </span>
                          {typeof it.score === 'number' ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-700">
                              {it.score.toFixed(1)} pts
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-gray-500">
                              Sem nota
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(it)}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
                    >
                      {expanded ? 'Ocultar análise' : 'Ver análise'}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
                    <CandidateDrawer
                      open={expanded}
                      onClose={() => setExpandedId(null)}
                      stageId={stage.id}
                      applicationId={it.application_id}
                      applicationStageId={it.application_stage_id}
                      candidate={{
                        id: it.candidate.id,
                        name: it.candidate.name,
                        email: it.candidate.email,
                      }}
                    />
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
