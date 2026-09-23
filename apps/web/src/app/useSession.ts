import { useSyncExternalStore } from 'react'
import { api } from '@/api/RepriseApi'
import type { Session } from '@/api/types'

/** A sessão atual, reativa — muda no login, no logout e quando outra aba renova. */
export function useSession(): Session | null {
  return useSyncExternalStore(api.sessions.subscribe, api.sessions.getSnapshot)
}

/** "Gabriel Silveira" → "GS". */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? '?'
  const last = parts.length > 1 ? parts[parts.length - 1]![0] : ''
  return (first + last).toUpperCase()
}
