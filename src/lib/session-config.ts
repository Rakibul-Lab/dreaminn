/** Idle timeout: log out after this many minutes without user activity */
const idleMinutes = Number(process.env.NEXT_PUBLIC_SESSION_IDLE_MINUTES ?? '30')

export const SESSION_IDLE_TIMEOUT_MS = Math.max(1, idleMinutes) * 60 * 1000

export function getSessionIdleMinutes(): number {
  return idleMinutes
}
