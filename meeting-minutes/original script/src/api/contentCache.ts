// Shared in-memory cache of full meeting records, mirroring S.contentCache in
// JavaScript.html. Warmed by prefetchLatest() and reused by the detail view and
// the project-tab summary so they paint without a second round-trip.

import type { MeetingFull, MeetingListItem, Project } from '../types'
import { api, getToken } from './client'

const cache = new Map<string, MeetingFull>()

export function getCached(id: string): MeetingFull | undefined { return cache.get(id) }
export function setCached(id: string, full: MeetingFull): void { cache.set(id, full) }

export async function fetchMeeting(id: string): Promise<MeetingFull | null> {
  const hit = cache.get(id)
  if (hit) return hit
  const full = await api.getMeeting(id, getToken())
  if (full) cache.set(id, full)
  return full
}

// Warm the latest meeting per project so project tabs open instantly.
// Mirrors prefetchLatest(). onWarm lets a mounted view refresh when its data lands.
export function prefetchLatest(
  projects: Project[],
  meetings: MeetingListItem[],
  onWarm?: (id: string) => void
): void {
  projects.forEach(p => {
    const latest = meetings
      .filter(m => m.projectId === p.id && m.kind !== 'overview')
      .slice()
      .sort((a, b) => {
        if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1
        return (b.date || '0000-00-00').localeCompare(a.date || '0000-00-00')
      })
    const first = latest[0]
    if (!first || cache.has(first.id)) return
    api.getMeeting(first.id, getToken()).then(full => {
      if (full) { cache.set(first.id, full); onWarm?.(first.id) }
    }).catch(() => { /* silent */ })
  })
}
