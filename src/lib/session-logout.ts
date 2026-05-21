import { useAuthStore } from '@/lib/auth-store'
import { clearSessionStorage } from '@/lib/session'

export type LogoutReason = 'idle' | 'unauthorized' | 'manual'

export function getLogoutMessage(reason: LogoutReason): string {
  switch (reason) {
    case 'idle':
      return 'You were signed out due to inactivity.'
    case 'unauthorized':
      return 'Your session is no longer valid. Please sign in again.'
    default:
      return 'You have been signed out.'
  }
}

export function performLogout(reason: LogoutReason = 'manual'): string {
  clearSessionStorage()
  useAuthStore.getState().logout()
  return getLogoutMessage(reason)
}
