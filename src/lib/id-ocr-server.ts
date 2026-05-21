import sharp from 'sharp'
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from '@zxing/library'
import { parseBangladeshNidBarcode } from './id-barcode'
import {
  mergeIdFields,
  parseIdFromOcrText,
  parseIdLoose,
  type ExtractedIdFields,
  type IdDocumentType,
} from './id-ocr'
import { recognizeWithOcrSpace } from './ocr-space'

const MAX_WIDTH = 1200

async function prepareJpeg(input: Buffer, crop?: { left: number; top: number; width: number; height: number }) {
  let pipeline = sharp(input).rotate()
  if (crop) {
    pipeline = pipeline.extract(crop)
  }
  return pipeline
    .resize({ width: MAX_WIDTH, withoutEnlargement: false })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer()
}

function clampCrop(
  w: number,
  h: number,
  region: { left: number; top: number; width: number; height: number }
) {
  const left = Math.min(Math.max(0, region.left), w - 1)
  const top = Math.min(Math.max(0, region.top), h - 1)
  const width = Math.min(Math.max(1, region.width), w - left)
  const height = Math.min(Math.max(1, region.height), h - top)
  return { left, top, width, height }
}

async function getCropRegions(input: Buffer) {
  const meta = await sharp(input).rotate().metadata()
  const w = meta.width ?? 1200
  const h = meta.height ?? 800
  const isLandscape = w >= h * 1.1

  if (isLandscape) {
    return {
      textPanel: clampCrop(w, h, {
        left: Math.floor(w * 0.28),
        top: 0,
        width: Math.floor(w * 0.72),
        height: h,
      }),
      nidZone: clampCrop(w, h, {
        left: Math.floor(w * 0.12),
        top: Math.floor(h * 0.25),
        width: Math.floor(w * 0.88),
        height: Math.floor(h * 0.45),
      }),
    }
  }

  return {
    textPanel: clampCrop(w, h, {
      left: 0,
      top: 0,
      width: w,
      height: Math.floor(h * 0.55),
    }),
    nidZone: clampCrop(w, h, {
      left: 0,
      top: Math.floor(h * 0.32),
      width: w,
      height: Math.floor(h * 0.38),
    }),
  }
}

async function decodeBarcodeFromBuffer(buffer: Buffer) {
  try {
    const { data, info } = await sharp(buffer)
      .rotate()
      .resize({ width: 1200, withoutEnlargement: false })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const luminance = new RGBLuminanceSource(
      Uint8ClampedArray.from(data),
      info.width,
      info.height
    )
    const bitmap = new BinaryBitmap(new HybridBinarizer(luminance))
    const hints = new Map<DecodeHintType, unknown>()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417, BarcodeFormat.QR_CODE])
    hints.set(DecodeHintType.TRY_HARDER, true)

    const reader = new MultiFormatReader()
    reader.setHints(hints)
    const result = reader.decode(bitmap)
    return parseBangladeshNidBarcode(result.getText())
  } catch {
    return null
  }
}

function hasNameAndNid(fields: ExtractedIdFields): boolean {
  return Boolean(fields.name?.trim() && fields.idNumber?.trim())
}

function applyOcrText(
  ocrTexts: string[],
  parsedChunks: Partial<ExtractedIdFields>[],
  text: string,
  idType: IdDocumentType
): ExtractedIdFields {
  if (!text) return mergeIdFields(...parsedChunks)
  ocrTexts.push(text)
  parsedChunks.push(parseIdFromOcrText(text, idType))
  return mergeIdFields(...parsedChunks, parseIdLoose(text, idType))
}

/** Barcode + OCR.space API (with optional NID-zone second pass). */
export async function runServerIdOcr(
  imageBuffer: Buffer,
  idType: IdDocumentType = 'national_id'
): Promise<ExtractedIdFields> {
  const ocrTexts: string[] = []
  const parsedChunks: Partial<ExtractedIdFields>[] = []

  const [barcodeFields, crops] = await Promise.all([
    decodeBarcodeFromBuffer(imageBuffer),
    getCropRegions(imageBuffer),
  ])
  if (barcodeFields) {
    parsedChunks.push({ ...barcodeFields, idType: barcodeFields.idType || idType })
  }

  let best = mergeIdFields(...parsedChunks)
  if (hasNameAndNid(best)) {
    return { ...best, rawText: best.rawText || '' }
  }

  const fullJpeg = await prepareJpeg(imageBuffer)
  const fullText = await recognizeWithOcrSpace(fullJpeg, { language: 'eng', engine: 2 })
  best = applyOcrText(ocrTexts, parsedChunks, fullText, idType)
  if (hasNameAndNid(best)) {
    return { ...best, rawText: ocrTexts.join('\n---\n') }
  }

  if (!best.name || !best.idNumber) {
    const panelJpeg = await prepareJpeg(imageBuffer, crops.textPanel)
    const panelText = await recognizeWithOcrSpace(panelJpeg, { language: 'eng', engine: 2 })
    best = applyOcrText(ocrTexts, parsedChunks, panelText, idType)
    if (hasNameAndNid(best)) {
      return { ...best, rawText: ocrTexts.join('\n---\n') }
    }
  }

  if (!best.idNumber) {
    const nidJpeg = await prepareJpeg(imageBuffer, crops.nidZone)
    const nidText = await recognizeWithOcrSpace(nidJpeg, { language: 'eng', engine: 2 })
    best = applyOcrText(ocrTexts, parsedChunks, nidText, idType)
  }

  const combined = ocrTexts.join('\n')
  if (combined) {
    best = mergeIdFields(best, parseIdLoose(combined, idType))
  }

  if (!best.name && !best.idNumber && combined.length > 0) {
    console.warn('[id-ocr] OCR ran but no fields matched. Sample:', combined.slice(0, 200))
  }

  return {
    ...best,
    idType: best.idType || idType,
    rawText: combined || best.rawText || '',
  }
}
