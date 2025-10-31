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
  const [drawer, setDrawer] = useState<{ open: boolean; item: BoardLaneItem | null }>({ open: false, item: null })

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

  return (
    <div className="card p-0">
      <div className="px-6 py-4 border-b flex items-center gap-3">
        <input className="w-full" placeholder="Buscar candidatos nesta etapa..." value={query} onChange={(e)=>setQuery(e.target.value)} />
        <span className="text-xs text-gray-500">{filtered.length} de {items.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-600">
            <tr className="border-b">
              <th className="py-3 px-5"><input type="checkbox" checked={allChecked} onChange={(e)=>toggleAll(e.target.checked)} /></th>
              <th className="py-3 px-5">Candidato</th>
              <th className="py-3 px-5">Nota IA</th>
              <th className="py-3 px-5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((it) => {
              const checked = !!selectedMap[it.application_stage_id]
              return (
                <tr key={it.application_stage_id} className="border-b hover:bg-gray-50/50">
                  <td className="py-3 px-5"><input type="checkbox" checked={checked} onChange={(e)=>setSelectedMap({ ...selectedMap, [it.application_stage_id]: e.target.checked })} /></td>
                  <td className="py-3 px-5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold">
                        {(it.candidate.name || it.candidate.id).slice(0,2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{it.candidate.name || it.candidate.id}</div>
                        {it.candidate.email && <div className="text-xs text-gray-600">{it.candidate.email}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-5">
                    {typeof it.score === 'number' ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold">{it.score.toFixed(1)}</span>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="py-3 px-5">
                    <div className="flex items-center gap-2 justify-end">
                      <button className="p-2 rounded-full border border-gray-200 hover:bg-gray-100" title="Visualizar" onClick={()=>{ onSelect?.(it); setDrawer({ open: true, item: it }) }}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-gray-700"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {drawer.open && drawer.item && (
        <CandidateDrawer
          open={drawer.open}
          onClose={()=>setDrawer({ open: false, item: null })}
          stageId={stage.id}
          applicationId={drawer.item.application_id}
          applicationStageId={drawer.item.application_stage_id}
          candidate={{ id: drawer.item.candidate.id, name: drawer.item.candidate.name, email: drawer.item.candidate.email }}
        />
      )}
    </div>
  )
}


