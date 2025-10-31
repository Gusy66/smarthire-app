'use client'

import { useState } from 'react'
import { moveBulk } from '../_lib/api'
import type { Stage } from '../_lib/types'
import { useToast } from '@/components/ToastProvider'

export default function BulkActions({
  jobId,
  stages,
  activeStageId,
  selectedIds,
  onMoved,
}: {
  jobId: string
  stages: Stage[]
  activeStageId: string | null
  selectedIds: string[]
  onMoved: () => void
}) {
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [moving, setMoving] = useState(false)
  const canMove = selectedIds.length > 0

  async function handleMove(toStageId: string) {
    if (!canMove || !jobId) return
    setMoving(true)
    try {
      await moveBulk(jobId, selectedIds, toStageId)
      notify({ title: 'Candidatos movidos', variant: 'success' })
      onMoved()
    } catch (e: any) {
      notify({ title: 'Falha ao mover', description: e?.message, variant: 'error' })
    } finally {
      setMoving(false)
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <button className="btn btn-outline" onClick={()=>setOpen((v)=>!v)} disabled={!canMove} aria-haspopup="menu" aria-expanded={open}>
        Mover para etapa
      </button>
      {open && (
        <div className="absolute z-20 mt-2 w-64 bg-white border rounded-xl shadow-md p-2">
          <div className="px-2 py-1 text-xs text-gray-500">Selecionar etapa de destino</div>
          <div className="max-h-56 overflow-auto">
            {stages.map((s)=> (
              <button
                key={s.id}
                className={`w-full text-left px-3 py-2 rounded hover:bg-gray-50 ${s.id===activeStageId ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={s.id===activeStageId || moving}
                onClick={()=>handleMove(s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


