import { format } from 'date-fns'
import { jsPDF } from 'jspdf'
import { HOTEL_NAME } from './reservation-terms'
import { getLogoDataUrl } from './reservation-document-html'
import { formatBdtForPdf } from './currency'
import {
  formatBookingDateFilterLabel,
  type BookingDatePreset,
} from './booking-date-filter'
import { formatSettlementStage } from './cloudview-ledger'

const PDF_LINE_HEIGHT = 3.6
const PDF_CELL_PAD = 1.5

type PdfColumn = {
  header: string
  baseWidth: number
  width: number
  value: (r: Record<string, string>) => string
  align?: 'right'
}

export type CloudViewLedgerBillExportRecord = {
  guestName: string
  roomNumber?: string | null
  orderNumber?: string | null
  totalAmount: number
  paidAmount: number
  dueAmount: number
  settlementStage: string
  billedAt: string
  hotelClearer?: { name: string } | null
  restaurantOrder?: { orderNumber: string } | null
}

export type CloudViewLedgerExportMeta = {
  exportedAt?: Date
  generatedBy?: { name: string; email?: string; role?: string }
  ledgerName?: string
  totalBilled?: number
  totalPaid?: number
  dueAmount?: number
  datePreset?: BookingDatePreset
  customDateFrom?: string
  customDateTo?: string
  stage?: string
  sort?: string
  search?: string
}

const STAGE_FILTER_LABELS: Record<string, string> = {
  all: 'All stages',
  OPEN: 'Awaiting hotel',
  HOTEL_CLEARED: 'Hotel cleared',
  PAID: 'Paid',
}

const SORT_LABELS: Record<string, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  amount_desc: 'Due: high to low',
  amount_asc: 'Due: low to high',
}

function formatGeneratedBy(user?: CloudViewLedgerExportMeta['generatedBy']): string {
  if (!user?.name) return '—'
  if (user.email) return `${user.name} (${user.email})`
  return user.name
}

function mapBillRow(bill: CloudViewLedgerBillExportRecord): Record<string, string> {
  const orderNo =
    bill.orderNumber ?? bill.restaurantOrder?.orderNumber ?? '—'
  return {
    Date: format(new Date(bill.billedAt), 'dd MMM yyyy'),
    Order: orderNo,
    Guest: bill.guestName,
    Room: bill.roomNumber ? `Room ${bill.roomNumber}` : '—',
    Stage: formatSettlementStage(bill.settlementStage),
    Total: formatBdtForPdf(bill.totalAmount),
    Paid: formatBdtForPdf(bill.paidAmount),
    Due: formatBdtForPdf(bill.dueAmount),
    'Cleared by': bill.hotelClearer?.name ?? '—',
  }
}

export function cloudViewLedgerExportFileName(): string {
  return `cloudview-restaurant-ledger-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`
}

export function buildCloudViewLedgerExportQuery(filters: {
  stage?: string
  sort?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}): string {
  const params = new URLSearchParams()
  if (filters.stage && filters.stage !== 'all') params.set('stage', filters.stage)
  if (filters.sort) params.set('sort', filters.sort)
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  if (filters.search?.trim()) params.set('search', filters.search.trim())
  return `/company-ledger/cloudview?${params.toString()}`
}

async function loadExportLogo(): Promise<{ dataUrl: string } | null> {
  try {
    const dataUrl = await getLogoDataUrl()
    return { dataUrl }
  } catch {
    return null
  }
}

export async function downloadCloudViewLedgerPdf(
  bills: CloudViewLedgerBillExportRecord[],
  meta: CloudViewLedgerExportMeta = {}
): Promise<void> {
  if (!bills.length) {
    throw new Error('No ledger bills to export')
  }

  const logo = await loadExportLogo()
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape', compress: true })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const marginX = 10
  const marginTop = 10
  const marginBottom = 10
  let y = marginTop

  const exportedAt = meta.exportedAt ?? new Date()
  const ledgerTitle = meta.ledgerName?.trim() || 'CloudView Restaurant'
  const dateLabel = formatBookingDateFilterLabel(
    meta.datePreset ?? 'all',
    meta.customDateFrom,
    meta.customDateTo
  )
  const stageLabel = STAGE_FILTER_LABELS[meta.stage ?? 'all'] ?? meta.stage ?? 'All stages'
  const sortLabel = SORT_LABELS[meta.sort ?? 'newest'] ?? meta.sort ?? 'Newest first'
  const searchLabel = meta.search?.trim() ? meta.search.trim() : '—'

  const logoSize = 12
  const headerY = marginTop
  const headerGap = 4
  const reportTitle = `${ledgerTitle} — Ledger Report`

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(16)
  const nameWidth = pdf.getTextWidth(HOTEL_NAME)
  pdf.setFontSize(11)
  const subtitleWidth = pdf.getTextWidth(reportTitle)
  const textWidth = Math.max(nameWidth, subtitleWidth)
  const blockWidth = (logo ? logoSize + headerGap : 0) + textWidth
  const blockStartX = (pageWidth - blockWidth) / 2

  if (logo) {
    pdf.addImage(logo.dataUrl, 'PNG', blockStartX, headerY, logoSize, logoSize)
  }

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(16)
  if (logo) {
    pdf.text(HOTEL_NAME, blockStartX + logoSize + headerGap, headerY + 5)
    pdf.setFontSize(11)
    pdf.text(reportTitle, blockStartX + logoSize + headerGap, headerY + 10)
  } else {
    pdf.text(HOTEL_NAME, pageWidth / 2, headerY + 7, { align: 'center' })
    pdf.setFontSize(11)
    pdf.text(reportTitle, pageWidth / 2, headerY + 14, { align: 'center' })
  }

  y = headerY + (logo ? logoSize : 14) + 4

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.text(`Exported: ${format(exportedAt, 'dd MMM yyyy, HH:mm')}`, marginX, y)
  y += 4
  pdf.text(`Generated by: ${formatGeneratedBy(meta.generatedBy)}`, marginX, y)
  y += 4
  pdf.text(`Date range: ${dateLabel}`, marginX, y)
  y += 4
  pdf.text(`Stage: ${stageLabel}  |  Sort: ${sortLabel}  |  Search: ${searchLabel}`, marginX, y)
  y += 4
  if (meta.totalBilled != null) {
    pdf.text(
      `Ledger totals — Billed: ${formatBdtForPdf(meta.totalBilled)}  |  Paid: ${formatBdtForPdf(meta.totalPaid ?? 0)}  |  Due: ${formatBdtForPdf(meta.dueAmount ?? 0)}`,
      marginX,
      y
    )
    y += 4
  }
  pdf.text(`Records in report: ${bills.length}`, marginX, y)
  y += 6

  const tableWidth = pageWidth - marginX * 2
  const columnDefs: Omit<PdfColumn, 'width'>[] = [
    { header: 'Date', baseWidth: 22, value: (r) => r.Date },
    { header: 'Order', baseWidth: 28, value: (r) => r.Order },
    { header: 'Guest', baseWidth: 32, value: (r) => r.Guest },
    { header: 'Room', baseWidth: 20, value: (r) => r.Room },
    { header: 'Stage', baseWidth: 28, value: (r) => r.Stage },
    { header: 'Total', baseWidth: 22, value: (r) => r.Total, align: 'right' },
    { header: 'Paid', baseWidth: 22, value: (r) => r.Paid, align: 'right' },
    { header: 'Due', baseWidth: 22, value: (r) => r.Due, align: 'right' },
    { header: 'Cleared by', baseWidth: 24, value: (r) => r['Cleared by'] },
  ]
  const baseWidthSum = columnDefs.reduce((sum, col) => sum + col.baseWidth, 0)
  const columns: PdfColumn[] = columnDefs.map((col) => ({
    ...col,
    width: (col.baseWidth / baseWidthSum) * tableWidth,
  }))

  const rows = bills.map(mapBillRow)
  const totalBilled = bills.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0)
  const totalPaid = bills.reduce((sum, b) => sum + (Number(b.paidAmount) || 0), 0)
  const totalDue = bills.reduce((sum, b) => sum + (Number(b.dueAmount) || 0), 0)

  const columnLeftX = (index: number) => {
    let x = marginX
    for (let i = 0; i < index; i++) x += columns[i].width
    return x
  }

  const columnRightX = (index: number) => columnLeftX(index) + columns[index].width - PDF_CELL_PAD

  const drawRightAlignedInColumn = (text: string, colIndex: number, baselineY: number) => {
    const rightX = columnRightX(colIndex)
    const textWidth = pdf.getTextWidth(text)
    pdf.text(text, rightX - textWidth, baselineY)
  }

  const totalColIndex = columns.findIndex((col) => col.header === 'Total')
  const paidColIndex = columns.findIndex((col) => col.header === 'Paid')
  const dueColIndex = columns.findIndex((col) => col.header === 'Due')

  const drawHeader = () => {
    pdf.setFillColor(245, 245, 245)
    pdf.rect(marginX, y - 4.5, tableWidth, 7, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7)
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i]
      if (col.align === 'right') {
        drawRightAlignedInColumn(col.header, i, y)
      } else {
        pdf.text(col.header, columnLeftX(i) + PDF_CELL_PAD, y)
      }
    }
    y += 7
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(6.5)
  }

  drawHeader()

  for (const row of rows) {
    const lines = columns.map((col, index) => {
      const value = col.value(row)
      if (col.align === 'right') return [value]
      return pdf.splitTextToSize(
        value,
        Math.max(columns[index].width - PDF_CELL_PAD * 2, 8)
      )
    })
    const maxLines = Math.max(...lines.map((l) => l.length), 1)
    const rowHeight = maxLines * PDF_LINE_HEIGHT + 1.5

    if (y + rowHeight > pageHeight - marginBottom - 10) {
      pdf.addPage()
      y = marginTop
      drawHeader()
    }

    for (let i = 0; i < columns.length; i++) {
      const col = columns[i]
      if (col.align === 'right') {
        drawRightAlignedInColumn(lines[i][0] ?? '', i, y)
      } else {
        pdf.text(lines[i], columnLeftX(i) + PDF_CELL_PAD, y)
      }
    }
    y += rowHeight
  }

  const totalsRowHeight = PDF_LINE_HEIGHT + 3
  if (y + totalsRowHeight > pageHeight - marginBottom) {
    pdf.addPage()
    y = marginTop
    drawHeader()
  }

  y += 2
  pdf.setFillColor(236, 253, 245)
  pdf.rect(marginX, y - 4, tableWidth, totalsRowHeight + 1, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(6.5)
  pdf.text('Filtered totals', columnLeftX(0) + PDF_CELL_PAD, y)
  drawRightAlignedInColumn(formatBdtForPdf(totalBilled), totalColIndex, y)
  drawRightAlignedInColumn(formatBdtForPdf(totalPaid), paidColIndex, y)
  drawRightAlignedInColumn(formatBdtForPdf(totalDue), dueColIndex, y)
  pdf.setFont('helvetica', 'normal')

  pdf.save(cloudViewLedgerExportFileName())
}
