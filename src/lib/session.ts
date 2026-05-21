import { SESSION_IDLE_TIMEOUT_MS } from '@/lib/session-config'

export function isIdleSessionExpired(lastActivityAt: number | null | undefined): boolean {
  if (!lastActivityAt) return false
  return Date.now() - lastActivityAt > SESSION_IDLE_TIMEOUT_MS
}

export function isSessionExpired(lastActivityAt: number | null | undefined): boolean {
  return isIdleSessionExpired(lastActivityAt)
}

export const CURRENT_PAGE_STORAGE_KEY = 'erp-current-page'

export function clearSessionStorage(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(CURRENT_PAGE_STORAGE_KEY)
}
