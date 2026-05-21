import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import {
  sanitizeEnglishName,
  sanitizeNidNumber,
  type ExtractedIdFields,
} from './id-ocr'

/** Parse Bangladesh NID smart-card PDF417 / encoded payload (back of card). */
export function parseBangladeshNidBarcode(raw: string): Partial<ExtractedIdFields> | null {
  const text = raw.trim()
  if (!text) return null

  const fields: Partial<ExtractedIdFields> = {}

  const tag = (keys: string[]) => {
    for (const key of keys) {
      const re = new RegExp(`(?:<${key}>|${key}\\s*[:=]\\s*)([^<\\n\\r]+)`, 'i')
      const m = text.match(re)
      if (m?.[1]?.trim()) return m[1].trim()
    }
    return undefined
  }

  const name = tag(['NM', 'NAME', 'name'])
  const smartNid = tag(['NW', 'NID', 'nid', 'pin'])
  const oldNid = tag(['OL', 'OLD_NID', 'old_nid'])
  const birth = tag(['BR', 'DOB', 'birth', 'birthDate'])

  if (name) fields.name = sanitizeEnglishName(name.replace(/\s+/g, ' '))
  if (smartNid) fields.idNumber = sanitizeNidNumber(smartNid, { preferTenDigit: true })
  else if (oldNid) fields.idNumber = sanitizeNidNumber(oldNid, { preferTenDigit: false })

  if (birth) {
    const d = birth.replace(/\D/g, '')
    if (d.length === 8) {
      fields.dateOfBirth = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
    }
  }

  if (fields.name || fields.idNumber) {
    return { ...fields, idType: 'national_id' }
  }

  const ten = text.match(/\b(\d{10})\b/)
  const seventeen = text.match(/\b(\d{17})\b/)
  if (ten) fields.idNumber = sanitizeNidNumber(ten[1], { preferTenDigit: true })
  else if (seventeen) fields.idNumber = sanitizeNidNumber(seventeen[1], { preferTenDigit: false })

  return fields.name || fields.idNumber ? fields : null
}

export async function tryDecodeNidBarcode(file: File | Blob): Promise<Partial<ExtractedIdFields> | null> {
  try {
    const { BrowserPDF417Reader, BrowserMultiFormatReader } = await import('@zxing/browser')
    const { fileToImageElement } = await import('./id-image-preprocess')
    const img = await fileToImageElement(file)

    const hints = new Map<DecodeHintType, unknown>()
    hints.set(DecodeHintType.TRY_HARDER, true)

    const readers = [
      new BrowserPDF417Reader(hints),
      (() => {
        const multiHints = new Map(hints)
        multiHints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.PDF_417,
          BarcodeFormat.QR_CODE,
          BarcodeFormat.DATA_MATRIX,
        ])
        return new BrowserMultiFormatReader(multiHints)
      })(),
    ]

    for (const reader of readers) {
      try {
        const result = await reader.decodeFromImageElement(img)
        const parsed = parseBangladeshNidBarcode(result.getText())
        if (parsed) return parsed
      } catch {
        // try next reader
      }
    }

    return null
  } catch {
    return null
  }
}
