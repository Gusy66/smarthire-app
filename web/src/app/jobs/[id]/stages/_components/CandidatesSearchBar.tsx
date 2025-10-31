'use client'

export default function CandidatesSearchBar({
  total,
  filtered,
  allChecked,
  onToggleAll,
  onQuery,
}: {
  total: number
  filtered: number
  allChecked: boolean
  onToggleAll: (v: boolean) => void
  onQuery: (q: string) => void
}) {
  return (
    <div className="mt-4 mb-2 flex items-center gap-3">
      <input className="w-full" placeholder="Buscar candidatos..." onChange={(e)=>onQuery(e.target.value)} />
      <span className="text-xs text-gray-500 whitespace-nowrap">{filtered} de {total}</span>
      <button className="btn btn-outline" onClick={()=>onToggleAll(!allChecked)}>
        {allChecked ? 'Desmarcar todos' : 'Selecionar todos'}
      </button>
    </div>
  )
}


