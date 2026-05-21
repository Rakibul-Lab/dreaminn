import { jsPDF } from 'jspdf'
import { domToPng } from 'modern-screenshot'

const CAPTURE_WIDTH_PX = 794
const CAPTURE_SCALE = 2
const JPEG_QUALITY = 0.92

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

async function toJpegDataUrl(pngDataUrl: string): Promise<string> {
  const img = await loadImage(pngDataUrl)
  const maxWidth = 2000
  let w = img.naturalWidth || img.width
  let h = img.naturalHeight || img.height
  if (w > maxWidth) {
    h = Math.round((h * maxWidth) / w)
    w = maxWidth
  }
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return pngDataUrl
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

export function invoicePdfFileName(invoiceNumber: string): string {
  const safe = invoiceNumber.replace(/[^\w-]+/g, '_')
  return `invoice-${safe}.pdf`
}

export async function downloadInvoicePdfFromElement(
  element: HTMLElement,
  fileName: string
): Promise<void> {
  const prevWidth = element.style.width
  const prevMaxWidth = element.style.maxWidth
  element.style.width = `${CAPTURE_WIDTH_PX}px`
  element.style.maxWidth = `${CAPTURE_WIDTH_PX}px`

  try {
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    const pngDataUrl = await domToPng(element, {
      scale: CAPTURE_SCALE,
      backgroundColor: '#ffffff',
      width: CAPTURE_WIDTH_PX,
      height: element.scrollHeight,
      timeout: 60_000,
    })
    const jpegDataUrl = await toJpegDataUrl(pngDataUrl)
    const img = await loadImage(jpegDataUrl)

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 8
    const maxW = pageWidth - margin * 2
    const maxH = pageHeight - margin * 2

    let imgW = maxW
    let imgH = (img.height * imgW) / img.width
    if (imgH > maxH) {
      imgH = maxH
      imgW = (img.width * imgH) / img.height
    }
    const x = (pageWidth - imgW) / 2
    const y = margin
    pdf.addImage(jpegDataUrl, 'JPEG', x, y, imgW, imgH)
    pdf.save(fileName)
  } finally {
    element.style.width = prevWidth
    element.style.maxWidth = prevMaxWidth
  }
}
