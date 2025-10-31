'use client'

import { useEffect, useRef } from 'react'
import type { Stage, BoardResponse } from '../_lib/types'

export default function StageTabs({
  stages,
  lanes,
  activeStageId,
  onChange,
}: {
  stages: Stage[]
  lanes: BoardResponse['lanes']
  activeStageId: string | null
  onChange: (stageId: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  // teclado: setas esquerda/direita
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: KeyboardEvent) => {
      const idx = stages.findIndex((s) => s.id === activeStageId)
      if (idx < 0) return
      if (e.key === 'ArrowRight') {
        const next = stages[(idx + 1) % stages.length]
        if (next) onChange(next.id)
      } else if (e.key === 'ArrowLeft') {
        const prev = stages[(idx - 1 + stages.length) % stages.length]
        if (prev) onChange(prev.id)
      }
    }
    el.addEventListener('keydown', handler)
    return () => el.removeEventListener('keydown', handler)
  }, [stages, activeStageId, onChange])

  return (
    <div ref={containerRef} className="flex gap-3 border-b" role="tablist" aria-label="Etapas do processo">
      {stages.map((s) => {
        const count = (lanes?.[s.id] || []).length
        const selected = activeStageId === s.id
        return (
          <button
            key={s.id}
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(s.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 rounded-t ${selected ? 'border-green-600 text-green-700 bg-white' : 'border-transparent text-gray-600 hover:text-gray-800'}`}
          >
            <span>{s.name}</span>
            <span className="ml-2 inline-flex items-center justify-center min-w-6 h-6 px-2 text-xs rounded-full bg-gray-100 text-gray-700">
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}


