'use client'

import type { Stage, BoardResponse } from '../_lib/types'

export default function JobStageHeader({
  stages,
  lanes,
  activeStageId,
  onChange,
}: {
  stages: Stage[]
  lanes: BoardResponse['lanes']
  activeStageId: string | null
  onChange: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {stages.map((s)=>{
        const count = (lanes?.[s.id] || []).length
        const active = activeStageId === s.id
        return (
          <button
            key={s.id}
            onClick={()=>onChange(s.id)}
            className={`px-4 py-2 rounded-full border ${active ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
          >
            <span className="font-medium">{s.name}</span>
            <span className={`ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${active ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}>{count}</span>
          </button>
        )
      })}
    </div>
  )
}


