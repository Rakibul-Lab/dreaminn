/** Placeholder shown on reservation documents when a required field is missing (initial reservations). */
export const RESERVATION_REQUIRED_PLACEHOLDER = '[Required — not provided]'

export function reservationDocValue(
  value: string | null | undefined,
  required = false
): string {
  const trimmed = value?.trim()
  if (trimmed) return trimmed
  return required ? RESERVATION_REQUIRED_PLACEHOLDER : '—'
}

export function reservationIdLabel(
  idType: string | null | undefined,
  idNumber: string | null | undefined,
  options?: {
    requiredWhenMissing?: boolean
    visaExpiryDate?: string | null
  }
): string {
  const typeLabel =
    idType === 'passport'
      ? 'Passport'
      : idType === 'driving_license'
        ? 'Driving License'
        : idType === 'national_id'
          ? 'National ID (NID)'
          : idType || null

  const number = idNumber?.trim()
  let base: string
  if (typeLabel && number) base = `${typeLabel} — ${number}`
  else if (number) base = number
  else if (typeLabel && options?.requiredWhenMissing) {
    base = `${typeLabel} — ${RESERVATION_REQUIRED_PLACEHOLDER}`
  } else if (options?.requiredWhenMissing) base = RESERVATION_REQUIRED_PLACEHOLDER
  else base = '—'

  if (idType === 'passport') {
    const visaFormatted = formatVisaExpiryForDocument(options?.visaExpiryDate)
    if (visaFormatted) {
      base = base === '—' ? `Visa expires: ${visaFormatted}` : `${base}; Visa expires: ${visaFormatted}`
    } else if (options?.requiredWhenMissing) {
      const visaMissing = `Visa expires: ${RESERVATION_REQUIRED_PLACEHOLDER}`
      base = base === '—' ? visaMissing : `${base}; ${visaMissing}`
    }
  }

  return base
}

export function reservationVisaExpiryLabel(
  idType: string | null | undefined,
  visaExpiryDate: string | null | undefined,
  requiredWhenMissing = false
): string | null {
  if (idType !== 'passport') return null
  const formatted = formatVisaExpiryForDocument(visaExpiryDate)
  if (formatted) return formatted
  return requiredWhenMissing ? RESERVATION_REQUIRED_PLACEHOLDER : '—'
}

export function formatVisaExpiryForDocument(value: string | null | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed) return ''
  const parsed = new Date(`${trimmed}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return trimmed
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
