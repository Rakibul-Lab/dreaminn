import { parse as parseMrz } from 'mrz'

export type IdDocumentType = 'national_id' | 'passport' | 'driving_license'

export interface ExtractedIdFields {
  name?: string
  idNumber?: string
  address?: string
  dateOfBirth?: string
  gender?: string
  fatherName?: string
  idType?: IdDocumentType
  rawText: string
}

const BENGALI_CHARS = /[\u0980-\u09FF\u09E6-\u09EF]+/g
const NON_LATIN_PRINTABLE = /[^\x20-\x7E]/g
const LATIN_NAME_LINE = /^[A-Za-z][A-Za-z\s.'-]{1,}$/

/** Strip Bengali and non-English characters; keep Latin letters for form fields. */
export function toEnglishOnly(value: string): string {
  return value
    .replace(BENGALI_CHARS, ' ')
    .replace(NON_LATIN_PRINTABLE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Title-case English name (hotel form standard). */
function titleCaseName(name: string): string {
  return name
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** English name only — rejects Bengali or garbage OCR. */
export function sanitizeEnglishName(raw?: string): string | undefined {
  if (!raw) return undefined
  let cleaned = toEnglishOnly(raw)
    .replace(/^(NAME|FULL\s*NAME|ENGLISH\s*NAME|NID|ID\s*NO?\.?|NUMBER)\s*[:.\-]?\s*/i, '')
    .trim()

  if (!cleaned || cleaned.length < 3) return undefined
  if (!/[A-Za-z]{2,}/.test(cleaned)) return undefined
  if (/^\d+$/.test(cleaned.replace(/\s/g, ''))) return undefined
  if (/^(BANGLADESH|GOVERNMENT|REPUBLIC|NATIONAL|IDENTITY|CARD|DATE|BIRTH)$/i.test(cleaned)) {
    return undefined
  }

  cleaned = cleaned.replace(/[^A-Za-z\s.'-]/g, ' ').replace(/\s+/g, ' ').trim()
  const words = cleaned.split(/\s+/).filter((w) => /^[A-Za-z.]{2,}$/.test(w) || /^[A-Za-z]\.$/.test(w))
  if (words.length < 2 && (words[0]?.length ?? 0) < 5) return undefined
  if (!LATIN_NAME_LINE.test(cleaned)) return undefined

  return titleCaseName(words.join(' '))
}

/** Loose name extraction when strict rules fail (noisy OCR). */
export function extractNameLoose(text: string): string | undefined {
  const lines = normalizeOcrText(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const skip =
    /REPUBLIC|PASSPORT|NATIONAL|IDENTITY|CARD|DATE|BIRTH|GOVT|GOVERNMENT|BANGLADESH|FATHER|MOTHER|NID|ID\s*NO|PIN|SEX|GENDER|ADDRESS|HOLDER|AUTHORITY/i

  let best = ''
  let bestScore = 0

  for (const line of lines) {
    const latin = toEnglishOnly(line)
      .replace(/^(NAME|নাম)\s*[:.\-]?\s*/i, '')
      .trim()
    if (latin.length < 5 || skip.test(latin)) continue

    const words = latin.split(/\s+/).filter((w) => /^[A-Za-z.]{1,}$/.test(w) && w.length >= 2)
    if (words.length < 2) continue

    const score = words.length * 10 + latin.length
    if (score > bestScore) {
      bestScore = score
      best = words.join(' ')
    }
  }

  return best ? titleCaseName(best) : undefined
}

/** Find NID number in noisy OCR text. */
export function extractNidLoose(text: string): string | undefined {
  const normalized = normalizeOcrText(text)
  const joined = normalized.replace(/\s+/g, ' ')

  const patterns = [
    /\b(\d{4}[\s.\-]?\d{4}[\s.\-]?\d{2,4})\b/g,
    /\b(\d{10})\b/g,
    /\b(\d{17})\b/g,
    /\b(\d{13})\b/g,
  ]

  const found: { value: string; score: number }[] = []

  for (const re of patterns) {
    let m: RegExpExecArray | null
    const r = new RegExp(re.source, re.flags)
    while ((m = r.exec(joined)) !== null) {
      const value = m[1].replace(/\D/g, '')
      if (value.length < 10) continue
      if (looksLikeDateNumber(value)) continue

      let score = value.length === 10 ? 50 : 30
      const ctx = joined.slice(Math.max(0, (m.index ?? 0) - 30), (m.index ?? 0) + 30)
      if (/NID|ID|NO|PIN|NUMBER/i.test(ctx)) score += 40
      if (/BIRTH|DOB|DATE/i.test(ctx)) score -= 30
      found.push({ value, score })
    }
  }

  found.sort((a, b) => b.score - a.score)
  const best = found[0]?.value
  return best ? sanitizeNidNumber(best, { preferTenDigit: true }) : undefined
}

/** Last-resort parse from raw OCR blob. */
export function parseIdLoose(text: string, idType: IdDocumentType = 'national_id'): ExtractedIdFields {
  return {
    name: extractNameLoose(text),
    idNumber: extractNidLoose(text),
    idType,
    rawText: text,
  }
}

/** Exact NID: digits only; prefer 10-digit smart card number when possible. */
export function sanitizeNidNumber(
  raw?: string,
  options?: { preferTenDigit?: boolean }
): string | undefined {
  if (!raw) return undefined
  const preferTen = options?.preferTenDigit !== false
  const digits = raw.replace(/\D/g, '')
  if (!digits) return undefined

  if (digits.length === 10) return digits

  if (digits.length === 17) {
    if (preferTen) {
      const withoutYear = digits.slice(4)
      if (withoutYear.length === 13) return withoutYear.slice(-10)
    }
    return digits
  }

  if (digits.length === 13) {
    if (preferTen && digits.startsWith('19')) return digits.slice(-10)
    return preferTen ? digits.slice(-10) : digits
  }

  if (digits.length > 17) return undefined

  return digits.length >= 10 ? digits.slice(0, preferTen ? 10 : 17) : undefined
}

/** Fix common OCR mistakes in digit-heavy regions. */
export function normalizeOcrText(text: string): string {
  return text
    .replace(/[|Il](?=\d)/g, '1')
    .replace(/[Oo](?=\d)/g, '0')
    .replace(/(?<=\d)[Oo]/g, '0')
    .replace(/[Ss](?=\d)/g, '5')
    .replace(/[Bb](?=\d)/g, '8')
    .replace(/[Zz](?=\d)/g, '2')
}

function normalizeDateToInput(value: string): string | undefined {
  const cleaned = value.replace(/\s/g, '').trim()
  const dmy = cleaned.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$/)
  if (dmy) {
    let [, d, m, y] = dmy
    if (y.length === 2) y = parseInt(y, 10) > 30 ? `19${y}` : `20${y}`
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const ymd = cleaned.match(/^(\d{4})[./\-](\d{1,2})[./\-](\d{1,2})$/)
  if (ymd) {
    const [, y, m, d] = ymd
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const compact = cleaned.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (compact) {
    const [, y, m, d] = compact
    return `${y}-${m}-${d}`
  }
  return undefined
}

function extractLabeledValue(lines: string[], labelPatterns: RegExp[]): string | undefined {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const pattern of labelPatterns) {
      const inline = line.match(new RegExp(`${pattern.source}\\s*[:\\-]?\\s*(.+)$`, 'i'))
      if (inline?.[1]?.trim()) return inline[1].trim()
      if (pattern.test(line) && lines[i + 1] && lines[i + 1].length < 80) {
        return lines[i + 1].trim()
      }
    }
  }
  return undefined
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '')
}

function looksLikeDateNumber(n: string): boolean {
  if (n.length !== 8) return false
  const y = parseInt(n.slice(0, 4), 10)
  const m = parseInt(n.slice(4, 6), 10)
  const d = parseInt(n.slice(6, 8), 10)
  return y >= 1920 && y <= 2015 && m >= 1 && m <= 12 && d >= 1 && d <= 31
}

function scoreEnglishNameLine(line: string): number {
  const latin = toEnglishOnly(line)
  if (!latin || latin.length < 4) return 0
  const words = latin.split(/\s+/).filter((w) => /^[A-Za-z.'-]+$/.test(w) && w.length > 1)
  if (words.length === 0) return 0

  let score = words.length * 15 + latin.length
  if (words.length >= 2) score += 25
  if (/^(NAME|NID|BANGLADESH|GOVT|GOVERNMENT|FATHER|MOTHER|DATE|BIRTH|ADDRESS)$/i.test(latin)) {
    score -= 80
  }
  if (/\d/.test(latin)) score -= 40
  return score
}

/** Pick best English (Latin) name line — skips Bengali lines on NID. */
function extractEnglishName(lines: string[]): string | undefined {
  const skip =
    /REPUBLIC|PASSPORT|NATIONAL|IDENTITY|CARD|DATE|BIRTH|GOVT|GOVERNMENT|BANGLADESH|FATHER|MOTHER|NID|ID\s*NO|PIN|SEX|GENDER|ADDRESS/i

  const candidates: { text: string; score: number }[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (/^(NAME|নাম)\b/i.test(line)) {
      const inline = line.match(/(?:NAME|নাম)\s*[:.\-]?\s*(.+)$/i)
      if (inline?.[1]) {
        const latin = toEnglishOnly(inline[1])
        if (latin) candidates.push({ text: latin, score: scoreEnglishNameLine(latin) + 40 })
      }
      for (let j = i + 1; j <= Math.min(i + 4, lines.length - 1); j++) {
        const latin = toEnglishOnly(lines[j])
        if (latin && latin.length >= 4 && !skip.test(latin)) {
          candidates.push({ text: latin, score: scoreEnglishNameLine(latin) + 30 - (j - i) * 5 })
        }
      }
    }

    const latinOnly = toEnglishOnly(line)
    if (latinOnly && latinOnly.length >= 4 && !skip.test(latinOnly) && !BENGALI_CHARS.test(line)) {
      candidates.push({ text: latinOnly, score: scoreEnglishNameLine(latinOnly) })
    }
  }

  candidates.sort((a, b) => b.score - a.score)
  for (const c of candidates) {
    const name = sanitizeEnglishName(c.text)
    if (name) return name
  }
  return undefined
}

/** Bangladesh NID: 10-digit smart card, 13/17-digit legacy formats. */
function extractBangladeshNidNumber(text: string, lines: string[]): string | undefined {
  const nidLabelPatterns = [
    /NID\s*(?:NO|NUMBER)?/i,
    /NATIONAL\s*ID/i,
    /ID\s*NO/i,
    /PIN/i,
  ]

  const found: { value: string; score: number }[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const isLabel = nidLabelPatterns.some((p) => p.test(line))
    if (!isLabel) continue

    const inline = line.match(/(?:NID|ID|NO|NUMBER|PIN)[:\s]*([\d\s.\-]{10,24})/i)
    if (inline) {
      const n = digitsOnly(inline[1])
      if (n.length === 10) found.push({ value: n, score: 100 })
      else if (n.length === 17) found.push({ value: n, score: 70 })
      else if (n.length === 13) found.push({ value: n, score: 60 })
    }
    for (let j = i; j <= Math.min(i + 2, lines.length - 1); j++) {
      const n = digitsOnly(lines[j])
      if (n.length === 10) found.push({ value: n, score: 90 - (j - i) * 5 })
      else if (n.length === 17) found.push({ value: n, score: 65 })
    }
  }

  const joined = text.replace(/\s+/g, ' ')
  const patterns = [/\b(\d{10})\b/g, /\b(\d{17})\b/g, /\b(\d{4})[\s\-]?(\d{4})[\s\-]?(\d{2,5})\b/g]

  for (const re of patterns) {
    let m: RegExpExecArray | null
    const r = new RegExp(re.source, re.flags)
    while ((m = r.exec(joined)) !== null) {
      const value = m[1] && m[2] !== undefined ? digitsOnly(m[0]) : digitsOnly(m[1] || m[0])
      if (!value || value.length < 10) continue
      if (looksLikeDateNumber(value)) continue

      let score = value.length === 10 ? 50 : value.length === 17 ? 35 : 25
      const contextStart = Math.max(0, (m.index || 0) - 40)
      const context = joined.slice(contextStart, (m.index || 0) + 40).toUpperCase()
      if (/NID|NATIONAL|IDENTITY|ID\s*NO|PIN/i.test(context)) score += 45
      if (/BIRTH|DOB|DATE/i.test(context)) score -= 35
      found.push({ value, score })
    }
  }

  found.sort((a, b) => b.score - a.score)
  const best = found[0]?.value
  return best ? sanitizeNidNumber(best, { preferTenDigit: true }) : undefined
}

function parseMrzFromText(text: string): Partial<ExtractedIdFields> | null {
  const candidates = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s/g, '').toUpperCase())
    .filter((l) => l.length >= 28 && /^[A-Z0-9<]+$/.test(l))

  if (candidates.length < 2) return null

  try {
    const result = parseMrz(candidates.slice(0, 3))
    if (!result.valid) return null

    const names = [result.fields.firstName, result.fields.lastName].filter(Boolean).join(' ').trim()
    const dob = result.fields.birthDate
      ? (() => {
          const raw = result.fields.birthDate.replace(/\D/g, '')
          if (raw.length !== 6) return undefined
          const yy = parseInt(raw.slice(0, 2), 10)
          const mm = raw.slice(2, 4)
          const dd = raw.slice(4, 6)
          const year = yy > 30 ? 1900 + yy : 2000 + yy
          return `${year}-${mm}-${dd}`
        })()
      : undefined

    return {
      name: sanitizeEnglishName(names),
      idNumber: sanitizeNidNumber(
        result.fields.documentNumber ?? result.fields.personalNumber ?? undefined,
        {
        preferTenDigit: false,
      }),
      dateOfBirth: dob,
      gender: result.fields.sex === 'M' ? 'Male' : result.fields.sex === 'F' ? 'Female' : undefined,
      idType: 'passport',
    }
  } catch {
    return null
  }
}

function parseBangladeshNidText(text: string): ExtractedIdFields {
  const normalized = normalizeOcrText(text)
  const lines = normalized
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const joined = lines.join(' ')

  const idNumber = extractBangladeshNidNumber(normalized, lines)
  const name = extractEnglishName(lines)
  const fatherName = sanitizeEnglishName(
    extractLabeledValue(lines, [/FATHER/i, /FATHER'?S\s*NAME/i])
  )
  const gender = extractLabeledValue(lines, [/GENDER|SEX/i])

  const dateOfBirth =
    extractLabeledValue(lines, [/DATE\s*OF\s*BIRTH/i, /D\.?O\.?B/i, /DOB/i]) ||
    (() => {
      const m = joined.match(
        /(?:DOB|DATE\s*OF\s*BIRTH|BIRTH)[:\s]*(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})/i
      )
      return m ? normalizeDateToInput(m[1]) : undefined
    })() ||
    (() => {
      for (const line of lines) {
        if (/NID|ID\s*NO|NAME/i.test(line)) continue
        const d = normalizeDateToInput(toEnglishOnly(line))
        if (d) return d
      }
      return undefined
    })()

  let address: string | undefined
  const addrIdx = lines.findIndex((l) => /ADDRESS|ADDR|VILL|ROAD|THANA|DISTRICT/i.test(l))
  if (addrIdx >= 0) {
    const parts = lines
      .slice(addrIdx, addrIdx + 4)
      .map((l) => toEnglishOnly(l.replace(/^(ADDRESS|ADDR)\s*[:\\-]?\s*/i, '')))
      .filter((l) => l.length > 2)
    address = parts.join(', ')
  }

  return finalizeExtractedFields({
    name,
    idNumber,
    address,
    dateOfBirth: dateOfBirth ? normalizeDateToInput(dateOfBirth) || dateOfBirth : undefined,
    gender,
    fatherName,
    idType: 'national_id',
    rawText: text,
  })
}

/** Enforce English name + clean NID digits; loose fallback from raw OCR text. */
export function finalizeExtractedFields(fields: ExtractedIdFields): ExtractedIdFields {
  const loose = fields.rawText ? parseIdLoose(fields.rawText, fields.idType || 'national_id') : null

  const name =
    sanitizeEnglishName(fields.name) ||
    extractNameLoose(fields.name || '') ||
    loose?.name

  const idNumber =
    sanitizeNidNumber(fields.idNumber, { preferTenDigit: true }) ||
    extractNidLoose(fields.rawText || fields.idNumber || '') ||
    loose?.idNumber

  return {
    ...fields,
    name,
    idNumber,
    fatherName: sanitizeEnglishName(fields.fatherName),
    address: fields.address ? toEnglishOnly(fields.address) : undefined,
    dateOfBirth: fields.dateOfBirth,
  }
}

/** Merge barcode/OCR partial results; barcode NID wins, best English name wins. */
export function mergeIdFields(
  ...parts: Array<Partial<ExtractedIdFields> | null | undefined>
): ExtractedIdFields {
  const merged: ExtractedIdFields = { rawText: '' }
  let bestNameScore = 0

  for (const p of parts) {
    if (!p) continue
    if (p.rawText) merged.rawText = [merged.rawText, p.rawText].filter(Boolean).join('\n---\n')

    if (p.idNumber) {
      const clean = sanitizeNidNumber(p.idNumber, { preferTenDigit: true })
      if (clean) merged.idNumber = clean
    }

    if (p.name) {
      const english =
        sanitizeEnglishName(p.name) || extractNameLoose(p.name) || sanitizeEnglishName(p.rawText)
      const score = english ? scoreEnglishNameLine(english) : 0
      if (english && score >= bestNameScore) {
        merged.name = english
        bestNameScore = score
      }
    }

    if (p.rawText && !merged.name) {
      const fromText = extractNameLoose(p.rawText)
      if (fromText) merged.name = fromText
    }
    if (p.rawText && !merged.idNumber) {
      const nid = extractNidLoose(p.rawText)
      if (nid) merged.idNumber = nid
    }

    if (p.address) merged.address = toEnglishOnly(p.address)
    if (p.dateOfBirth) merged.dateOfBirth = p.dateOfBirth
    if (p.gender) merged.gender = p.gender
    if (p.fatherName) merged.fatherName = sanitizeEnglishName(p.fatherName)
    if (p.idType) merged.idType = p.idType
  }

  return finalizeExtractedFields(merged)
}

/** Parse OCR text from NID / passport (Tesseract) with label heuristics + MRZ. */
export function parseIdFromOcrText(text: string, preferredType?: IdDocumentType): ExtractedIdFields {
  const mrz = parseMrzFromText(text)
  if (mrz?.name || mrz?.idNumber) {
    return finalizeExtractedFields({ ...mrz, rawText: text, idType: mrz.idType || preferredType || 'passport' })
  }

  if (preferredType === 'national_id' || preferredType === undefined) {
    const bd = parseBangladeshNidText(text)
    const loose = parseIdLoose(text, 'national_id')
    return finalizeExtractedFields(mergeIdFields(bd, loose))
  }

  const lines = normalizeOcrText(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const joined = lines.join(' ')
  const upper = joined.toUpperCase()

  let idType: IdDocumentType = preferredType || 'national_id'
  if (/PASSPORT|P</i.test(upper) || /REPUBLIC|NATIONALITY|MRZ/i.test(upper)) {
    idType = 'passport'
  }

  let idNumber: string | undefined
  const passportMatch = joined.match(/\b[A-Z]{1,2}\d{6,9}\b/)

  if (idType === 'passport' && passportMatch) {
    idNumber = passportMatch[0].replace(/\s/g, '')
  } else {
    idNumber = extractBangladeshNidNumber(joined, lines)
  }

  const name = extractEnglishName(lines)
  const dateOfBirth =
    extractLabeledValue(lines, [/DATE\s*OF\s*BIRTH/i, /D\.?O\.?B/i, /DOB/i]) ||
    (() => {
      for (const line of lines) {
        const d = normalizeDateToInput(toEnglishOnly(line))
        if (d) return d
      }
      return undefined
    })()

  return finalizeExtractedFields({
    name,
    idNumber,
    address: undefined,
    dateOfBirth: dateOfBirth ? normalizeDateToInput(dateOfBirth) || dateOfBirth : undefined,
    idType,
    rawText: text,
  })
}

export function hasMinimumScanData(fields: ExtractedIdFields): boolean {
  return Boolean(fields.name?.trim() && fields.idNumber?.trim())
}
