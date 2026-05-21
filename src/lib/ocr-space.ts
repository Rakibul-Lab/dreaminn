import sharp from 'sharp'

const OCR_SPACE_URL = 'https://api.ocr.space/parse/image'
const FREE_TIER_MAX_BYTES = 1024 * 1024

interface OcrSpaceParsedResult {
  ParsedText?: string | null
  ErrorMessage?: string | null
  FileParseExitCode?: number | string
}

interface OcrSpaceResponse {
  OCRExitCode?: number | string
  IsErroredOnProcessing?: boolean
  ErrorMessage?: string | null
  ErrorDetails?: string | null
  ParsedResults?: OcrSpaceParsedResult[]
}

function getApiKey(): string | undefined {
  return process.env.OCR_SPACE_API_KEY?.trim() || undefined
}

/** Compress image to stay under OCR.space free tier 1 MB limit. */
export async function compressForOcrSpace(input: Buffer): Promise<Buffer> {
  const meta = await sharp(input).rotate().metadata()
  let width = Math.min(meta.width ?? 2000, 2000)
  let quality = 85

  for (let attempt = 0; attempt < 8; attempt++) {
    const out = await sharp(input)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer()

    if (out.length <= FREE_TIER_MAX_BYTES - 32_768) return out

    if (quality > 45) {
      quality -= 12
    } else {
      width = Math.floor(width * 0.82)
      quality = 78
    }
  }

  return sharp(input).rotate().resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 40 }).toBuffer()
}

function parseOcrSpaceResponse(json: OcrSpaceResponse): string {
  if (json.IsErroredOnProcessing) {
    throw new Error(json.ErrorMessage || json.ErrorDetails || 'OCR.space processing error')
  }

  const exitCode = Number(json.OCRExitCode)
  if (exitCode === 3 || exitCode === 4) {
    throw new Error(json.ErrorMessage || 'OCR.space could not read this image')
  }

  const parts =
    json.ParsedResults?.map((r) => r.ParsedText?.trim()).filter((t): t is string => Boolean(t)) ?? []

  if (parts.length === 0) {
    const pageError = json.ParsedResults?.find((r) => r.ErrorMessage)?.ErrorMessage
    if (pageError) throw new Error(pageError)
    return ''
  }

  return parts.join('\n')
}

export async function recognizeWithOcrSpace(
  imageBuffer: Buffer,
  options?: { language?: string; engine?: 1 | 2 | 3 }
): Promise<string> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('OCR_SPACE_API_KEY is not configured')
  }

  const jpeg = await compressForOcrSpace(imageBuffer)
  const form = new FormData()
  form.append('file', new Blob([jpeg], { type: 'image/jpeg' }), 'id-scan.jpg')
  form.append('language', options?.language ?? 'eng')
  form.append('detectOrientation', 'true')
  form.append('scale', 'true')
  form.append('isOverlayRequired', 'false')
  form.append('OCREngine', String(options?.engine ?? 2))
  form.append('filetype', 'JPG')

  const res = await fetch(OCR_SPACE_URL, {
    method: 'POST',
    headers: { apikey: apiKey },
    body: form,
  })

  if (!res.ok) {
    throw new Error(`OCR.space HTTP ${res.status}`)
  }

  const json = (await res.json()) as OcrSpaceResponse
  return parseOcrSpaceResponse(json)
}

export function isOcrSpaceConfigured(): boolean {
  return Boolean(getApiKey())
}
