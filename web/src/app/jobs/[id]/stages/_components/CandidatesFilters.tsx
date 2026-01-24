'use client'

import { useEffect, useMemo, useState } from 'react'

export type CandidateFilters = {
  query: string
  status?: string
}

export default function CandidatesFilters({
  value,
  onChange,
}: {
  value: CandidateFilters
  onChange: (next: CandidateFilters) => void
}) {
  const [q, setQ] = useState(value.query || '')

  useEffect(() => { setQ(value.query || '') }, [value.query])

  // debounce 300ms
  useEffect(() => {
    const t = setTimeout(() => onChange({ ...value, query: q }), 300)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div className="card p-4">
      <div className="grid md:grid-cols-2 gap-3 items-center">
        <input
          placeholder="Buscar candidatos nesta etapa..."
          className="w-full"
          value={q}
          onChange={(e)=>setQ(e.target.value)}
        />
        <select
          value={value.status || ''}
          onChange={(e)=>onChange({ ...value, status: e.target.value || undefined })}
        >
          <option value="">Status (todos)</option>
          <option value="unseen">Não visualizado</option>
          <option value="in_review">Em triagem</option>
          <option value="approved">Aprovado</option>
          <option value="rejected">Reprovado</option>
        </select>
      </div>
    </div>
  )
}


