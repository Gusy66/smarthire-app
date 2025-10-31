'use client'

import type { BoardLaneItem } from '../_lib/types'

export default function CandidateListItem({
  item,
  checked,
  onCheck,
  onView,
}: {
  item: BoardLaneItem
  checked: boolean
  onCheck: (v: boolean) => void
  onView: () => void
}) {
  const createdAt = item.application_created_at ? new Date(item.application_created_at) : null
  return (
    <div className="border rounded-xl p-4 bg-white">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <input type="checkbox" checked={checked} onChange={(e)=>onCheck(e.target.checked)} className="mt-1" />
          <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold">
            {(item.candidate.name || item.candidate.id).slice(0,2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 truncate">{item.candidate.name || item.candidate.id}</div>
            <div className="text-sm text-gray-600 truncate">{item.candidate.email || '—'}</div>
            {/* chips/skills opcionais futuramente */}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold">Aprovado</span>
          <button
            className="p-2 rounded-full border border-gray-200 hover:bg-gray-100"
            title="Ver análise completa"
            onClick={onView}
            aria-label="Ver análise"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-gray-700"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-gray-50 border border-gray-200 p-3">
        <div className="text-xs text-gray-600 uppercase tracking-wide mb-1">Avaliação nesta etapa</div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-yellow-600 font-semibold">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 .587l3.668 7.431 8.2 1.193-5.934 5.787 1.401 8.168L12 18.896l-7.335 3.87 1.401-8.168L.132 9.211l8.2-1.193L12 .587z"/></svg>
              <span>{typeof item.score === 'number' ? item.score.toFixed(1) : '—'}</span>
            </div>
            <span className="text-xs text-gray-500">Sistema IA</span>
            <span className="text-xs text-gray-500">{createdAt ? createdAt.toLocaleDateString('pt-BR') : ''}</span>
          </div>
          <div className="text-xs text-gray-500">{createdAt ? `Candidatou-se em ${createdAt.toLocaleDateString('pt-BR')}` : ''}</div>
        </div>
        {/* Resumo curto opcional no futuro */}
      </div>
    </div>
  )
}


