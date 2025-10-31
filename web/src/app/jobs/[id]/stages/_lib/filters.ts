import type { BoardLaneItem } from './types'

export type CandidateFilters = {
  query?: string
  status?: string
  source?: string
}

export function applyFilters(items: BoardLaneItem[], filters: CandidateFilters): BoardLaneItem[] {
  let list = items
  const q = (filters.query || '').trim().toLowerCase()
  if (q) {
    list = list.filter((it) =>
      (it.candidate.name || it.candidate.id).toLowerCase().includes(q) ||
      (it.candidate.email || '').toLowerCase().includes(q)
    )
  }
  // placeholders para status/origem (adaptar quando dados existirem)
  if (filters.status) {
    list = list.filter(() => true)
  }
  if (filters.source) {
    list = list.filter(() => true)
  }
  return list
}


