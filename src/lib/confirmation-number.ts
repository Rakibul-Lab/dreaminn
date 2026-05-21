import { db } from '@/lib/db'

export const CONFIRMATION_PREFIX = 'RRP-DI-'

/** Display confirmation number (stored value or legacy fallback from id). */
export function formatConfirmationNumber(booking: {
  id: string
  confirmationNumber?: string | null
}): string {
  if (booking.confirmationNumber) return booking.confirmationNumber
  return legacyConfirmationFromId(booking.id)
}

function sanitizeFileNamePart(value: string): string {
  return value
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '')
    .replace(/\s+/g, '-')
}

/** PDF download name: reservation-rakibul-hassan-RRP-DI-000001.pdf */
export function reservationPdfFileName(booking: {
  id: string
  confirmationNumber?: string | null
  customer: { name: string }
}): string {
  const guest = sanitizeFileNamePart(booking.customer.name).toLowerCase()
  const confirmation = formatConfirmationNumber(booking)
  return `reservation-${guest}-${confirmation}.pdf`
}

function legacyConfirmationFromId(id: string): string {
  const n =
    [...id].reduce((acc, c) => (Math.imul(acc, 31) + c.charCodeAt(0)) | 0, 0) % 1_000_000
  return `${CONFIRMATION_PREFIX}${String(Math.abs(n)).padStart(6, '0')}`
}

/** Next sequential RRP-DI-###### (retries on unique collision). */
export async function generateConfirmationNumber(): Promise<string> {
  const existing = await db.booking.findMany({
    where: { confirmationNumber: { not: null } },
    select: { confirmationNumber: true },
  })

  let max = 0
  for (const row of existing) {
    const match = row.confirmationNumber?.match(/^RRP-DI-(\d{6})$/)
    if (match) max = Math.max(max, parseInt(match[1], 10))
  }

  for (let attempt = 0; attempt < 20; attempt++) {
    const next = max + 1 + attempt
    if (next > 999_999) throw new Error('Confirmation number limit reached')
    const candidate = `${CONFIRMATION_PREFIX}${String(next).padStart(6, '0')}`
    const taken = await db.booking.findFirst({
      where: { confirmationNumber: candidate },
      select: { id: true },
    })
    if (!taken) return candidate
  }

  throw new Error('Could not allocate confirmation number')
}

/** Persist confirmation number when missing (existing bookings). */
export async function ensureConfirmationNumber(bookingId: string): Promise<string> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, confirmationNumber: true },
  })
  if (!booking) throw new Error('Booking not found')
  if (booking.confirmationNumber) return booking.confirmationNumber

  const confirmationNumber = await generateConfirmationNumber()
  const updated = await db.booking.update({
    where: { id: bookingId },
    data: { confirmationNumber },
    select: { confirmationNumber: true },
  })
  return updated.confirmationNumber!
}
