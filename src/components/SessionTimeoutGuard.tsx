'use client'

import { useSessionTimeout } from '@/hooks/use-session-timeout'

export function SessionTimeoutGuard({ children }: { children: React.ReactNode }) {
  useSessionTimeout()
  return <>{children}</>
}
