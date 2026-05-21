'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/auth-store'

/** True once persisted auth state has been read from localStorage (client only). */
export function useAuthHydration(): boolean {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const persist = useAuthStore.persist

    const finish = () => setHydrated(true)

    if (persist.hasHydrated()) {
      finish()
      return
    }

    const unsub = persist.onFinishHydration(finish)
    const fallback = window.setTimeout(finish, 300)

    return () => {
      unsub()
      window.clearTimeout(fallback)
    }
  }, [])

  return hydrated
}
