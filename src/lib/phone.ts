/** Strip to digits and normalize common Bangladesh mobile formats to 01XXXXXXXXX. */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''

  if (digits.startsWith('880') && digits.length >= 13) {
    return `0${digits.slice(3, 13)}`
  }

  if (digits.length === 10 && digits[0] !== '0') {
    return `0${digits}`
  }

  if (digits.length === 11 && digits.startsWith('0')) {
    return digits
  }

  if (digits.length > 11 && digits.startsWith('0')) {
    return digits.slice(0, 11)
  }

  return digits
}

export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone)
  return normalized.length >= 10 && normalized.length <= 11
}

/** True when both numbers refer to the same mobile (ignores +880, spaces, dashes). */
export function phonesMatch(a: string, b: string): boolean {
  const na = normalizePhone(a)
  const nb = normalizePhone(b)
  if (!na || !nb) return false
  if (na === nb) return true
  if (na.length >= 10 && nb.length >= 10) {
    return na.slice(-10) === nb.slice(-10)
  }
  return false
}
