import { format } from 'date-fns'
import { jsPDF } from 'jspdf'
import { HOTEL_NAME } from './reservation-terms'
import { getLogoDataUrl } from './reservation-document-html'
import { formatBdtForPdf } from './currency'
import {
  BOOKING_DATE_PRESET_OPTIONS,
  formatBookingDateFilterLabel,
  type BookingDatePreset,
} from './booking-date-filter'

export const REPORT_DATE_PRESET_OPTIONS = BOOKING_DATE_PRESET_OPTIONS.map((opt) =>
  opt.value === 'all' ? { ...opt, label: 'All time' } : opt
)

export function formatReportDateFilterLabel(
  preset: BookingDatePreset,
  customFrom?: string,
  customTo?: string
): string {
  if (preset === 'all') return 'All time'
  return formatBookingDateFilterLabel(preset, customFrom, customTo)
}

export type ReportsExportTab = 'restaurant' | 'hotel' | 'combined'

export type ReportsExportMeta = {
  tab: ReportsExportTab
  datePreset?: BookingDatePreset
  customDateFrom?: string
  customDateTo?: string
  exportedAt?: Date
  generatedBy?: { name: string; email?: string; role?: string }
}

export type ReportsExportPayload = {
  restaurant?: {
    totalSales?: number
    totalOrders?: number
    averageOrderValue?: number
    dailyBreakdown?: Record<string, { orders: number; sales: number }>
    statusDistribution?: Record<string, { count: number; totalAmount: number }>
    topSellingItems?: Array<{ name: string; quantity: number; revenue: number }>
  }
  hotel?: {
    totalRevenue?: number
    totalBookings?: number
    averageRate?: number
    occupancyRate?: number
    revenueByType?: Record<string, { bookings: number; revenue: number }>
    occupancy?: {
      totalRooms?: number
      availableRooms?: number
      occupiedRooms?: number
      cleaningRooms?: number
      maintenanceRooms?: number
      todayCheckins?: number
      todayCheckouts?: number
    }
    foodCharges?: Array<{ roomNumber: string; totalOrders: number; totalCharges: number }>
    foodGrandTotal?: number
  }
  combined?: {
    totalRevenue?: number
    hotelRevenue?: number
    restaurantRevenue?: number
    extraRevenue?: number
    profitSummary?: {
      totalPaymentsReceived?: number
      outstandingDues?: number
      netPosition?: number
    }
    topCustomers?: Array<{ name: string; totalSpent: number; bookingCount: number }>
  }
}

const TAB_TITLES: Record<ReportsExportTab, string> = {
  restaurant: 'Restaurant Analytics',
  hotel: 'Hotel Analytics',
  combined: 'Combined Analytics',
}

function formatGeneratedBy(user?: ReportsExportMeta['generatedBy']): string {
  if (!user?.name) return '—'
  if (user.email) return `${user.name} (${user.email})`
  return user.name
}

async function loadExportLogo(): Promise<{ dataUrl: string } | null> {
  try {
    const dataUrl = await getLogoDataUrl()
    return { dataUrl }
  } catch {
    return null
  }
}

function ensureSpace(pdf: jsPDF, y: number, needed: number, marginTop: number): number {
  const pageHeight = pdf.internal.pageSize.getHeight()
  if (y + needed > pageHeight - 10) {
    pdf.addPage()
    return marginTop
  }
  return y
}

function drawSectionTitle(pdf: jsPDF, title: string, y: number, marginX: number): number {
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text(title, marginX, y)
  return y + 5
}

function drawKeyValueLines(
  pdf: jsPDF,
  lines: Array<{ label: string; value: string }>,
  y: number,
  marginX: number,
  marginTop: number
): number {
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  for (const line of lines) {
    y = ensureSpace(pdf, y, 5, marginTop)
    pdf.text(`${line.label}: ${line.value}`, marginX, y)
    y += 4
  }
  return y + 2
}

function drawTable(
  pdf: jsPDF,
  headers: string[],
  rows: string[][],
  y: number,
  marginX: number,
  marginTop: number,
  colWidths: number[]
): number {
  const lineHeight = 4
  const pad = 1.5
  const tableWidth = colWidths.reduce((a, b) => a + b, 0)

  const drawHeader = (startY: number) => {
    pdf.setFillColor(245, 245, 245)
    pdf.rect(marginX, startY - 3.5, tableWidth, lineHeight + pad, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    let x = marginX
    headers.forEach((h, i) => {
      pdf.text(h, x + 1, startY)
      x += colWidths[i]!
    })
    return startY + lineHeight + pad
  }

  y = ensureSpace(pdf, y, lineHeight + pad + 2, marginTop)
  y = drawHeader(y)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  for (const row of rows) {
    y = ensureSpace(pdf, y, lineHeight + pad, marginTop)
    if (y === marginTop) y = drawHeader(y)
    let x = marginX
    row.forEach((cell, i) => {
      const text = pdf.splitTextToSize(cell, colWidths[i]! - 2)[0] ?? cell
      pdf.text(text, x + 1, y)
      x += colWidths[i]!
    })
    y += lineHeight + pad
  }

  return y + 3
}

export function reportsExportFileName(tab: ReportsExportTab): string {
  return `reports-${tab}-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`
}

export async function downloadReportsPdf(
  payload: ReportsExportPayload,
  meta: ReportsExportMeta
): Promise<void> {
  const logo = await loadExportLogo()
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const marginX = 14
  const marginTop = 14
  let y = marginTop

  const exportedAt = meta.exportedAt ?? new Date()
  const dateLabel = formatReportDateFilterLabel(
    meta.datePreset ?? 'all',
    meta.customDateFrom,
    meta.customDateTo
  )
  const tabTitle = TAB_TITLES[meta.tab]

  const logoSize = 12
  const headerGap = 4
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(16)
  const nameWidth = pdf.getTextWidth(HOTEL_NAME)
  pdf.setFontSize(11)
  const subtitleWidth = pdf.getTextWidth('Reports & Analytics')
  const textWidth = Math.max(nameWidth, subtitleWidth)
  const blockWidth = (logo ? logoSize + headerGap : 0) + textWidth
  const blockStartX = (pageWidth - blockWidth) / 2

  if (logo) {
    pdf.addImage(logo.dataUrl, 'PNG', blockStartX, y, logoSize, logoSize)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(16)
    pdf.text(HOTEL_NAME, blockStartX + logoSize + headerGap, y + 5)
    pdf.setFontSize(11)
    pdf.text('Reports & Analytics', blockStartX + logoSize + headerGap, y + 10)
  } else {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(16)
    pdf.text(HOTEL_NAME, pageWidth / 2, y + 5, { align: 'center' })
    pdf.setFontSize(11)
    pdf.text('Reports & Analytics', pageWidth / 2, y + 11, { align: 'center' })
  }

  y += logo ? logoSize + 4 : 16

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.text(`Section: ${tabTitle}`, marginX, y)
  y += 4
  pdf.text(`Period: ${dateLabel}`, marginX, y)
  y += 4
  pdf.text(`Exported: ${format(exportedAt, 'dd MMM yyyy, HH:mm')}`, marginX, y)
  y += 4
  pdf.text(`Generated by: ${formatGeneratedBy(meta.generatedBy)}`, marginX, y)
  y += 8

  if (meta.tab === 'restaurant' && payload.restaurant) {
    const r = payload.restaurant
    y = drawSectionTitle(pdf, 'Summary', y, marginX)
    y = drawKeyValueLines(
      pdf,
      [
        { label: 'Total sales', value: formatBdtForPdf(r.totalSales ?? 0) },
        { label: 'Total orders', value: String(r.totalOrders ?? 0) },
        { label: 'Average order value', value: formatBdtForPdf(r.averageOrderValue ?? 0) },
      ],
      y,
      marginX,
      marginTop
    )

    if (r.dailyBreakdown && Object.keys(r.dailyBreakdown).length > 0) {
      y = drawSectionTitle(pdf, 'Daily breakdown', y, marginX)
      const rows = Object.entries(r.dailyBreakdown)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, val]) => [
          format(new Date(date), 'dd MMM yyyy'),
          String(val.orders),
          formatBdtForPdf(val.sales),
        ])
      y = drawTable(pdf, ['Date', 'Orders', 'Sales'], rows, y, marginX, marginTop, [40, 30, 40])
    }

    if (r.statusDistribution && Object.keys(r.statusDistribution).length > 0) {
      y = drawSectionTitle(pdf, 'Order status', y, marginX)
      const rows = Object.entries(r.statusDistribution).map(([status, val]) => [
        status.replace(/_/g, ' '),
        String(val.count),
        formatBdtForPdf(val.totalAmount),
      ])
      y = drawTable(pdf, ['Status', 'Count', 'Amount'], rows, y, marginX, marginTop, [50, 30, 40])
    }

    if (r.topSellingItems?.length) {
      y = drawSectionTitle(pdf, 'Top selling items', y, marginX)
      const rows = r.topSellingItems.map((item) => [
        item.name,
        String(item.quantity),
        formatBdtForPdf(item.revenue),
      ])
      y = drawTable(pdf, ['Item', 'Qty', 'Revenue'], rows, y, marginX, marginTop, [70, 25, 35])
    }
  }

  if (meta.tab === 'hotel' && payload.hotel) {
    const h = payload.hotel
    y = drawSectionTitle(pdf, 'Summary', y, marginX)
    y = drawKeyValueLines(
      pdf,
      [
        { label: 'Total revenue', value: formatBdtForPdf(h.totalRevenue ?? 0) },
        { label: 'Total bookings', value: String(h.totalBookings ?? 0) },
        { label: 'Average daily rate', value: formatBdtForPdf(h.averageRate ?? 0) },
        { label: 'Occupancy rate', value: `${(h.occupancyRate ?? 0).toFixed(1)}%` },
      ],
      y,
      marginX,
      marginTop
    )

    if (h.revenueByType && Object.keys(h.revenueByType).length > 0) {
      y = drawSectionTitle(pdf, 'Revenue by room type', y, marginX)
      const rows = Object.entries(h.revenueByType).map(([type, val]) => [
        type,
        String(val.bookings),
        formatBdtForPdf(val.revenue),
      ])
      y = drawTable(pdf, ['Room type', 'Bookings', 'Revenue'], rows, y, marginX, marginTop, [55, 35, 40])
    }

    if (h.occupancy) {
      y = drawSectionTitle(pdf, 'Room status overview', y, marginX)
      y = drawKeyValueLines(
        pdf,
        [
          { label: 'Total rooms', value: String(h.occupancy.totalRooms ?? 0) },
          { label: 'Available', value: String(h.occupancy.availableRooms ?? 0) },
          { label: 'Occupied', value: String(h.occupancy.occupiedRooms ?? 0) },
          { label: 'Cleaning', value: String(h.occupancy.cleaningRooms ?? 0) },
          { label: 'Maintenance', value: String(h.occupancy.maintenanceRooms ?? 0) },
          { label: 'Today check-ins', value: String(h.occupancy.todayCheckins ?? 0) },
          { label: 'Today check-outs', value: String(h.occupancy.todayCheckouts ?? 0) },
        ],
        y,
        marginX,
        marginTop
      )
    }

    if (h.foodCharges?.length) {
      y = drawSectionTitle(pdf, 'Food charges by room', y, marginX)
      const rows = h.foodCharges.map((room) => [
        room.roomNumber,
        String(room.totalOrders),
        formatBdtForPdf(room.totalCharges),
      ])
      y = drawTable(pdf, ['Room', 'Orders', 'Charges'], rows, y, marginX, marginTop, [40, 35, 45])
      if (h.foodGrandTotal != null) {
        y = drawKeyValueLines(
          pdf,
          [{ label: 'Grand total', value: formatBdtForPdf(h.foodGrandTotal) }],
          y,
          marginX,
          marginTop
        )
      }
    }
  }

  if (meta.tab === 'combined' && payload.combined) {
    const c = payload.combined
    y = drawSectionTitle(pdf, 'Revenue summary', y, marginX)
    y = drawKeyValueLines(
      pdf,
      [
        { label: 'Total revenue', value: formatBdtForPdf(c.totalRevenue ?? 0) },
        { label: 'Hotel revenue', value: formatBdtForPdf(c.hotelRevenue ?? 0) },
        { label: 'Restaurant revenue', value: formatBdtForPdf(c.restaurantRevenue ?? 0) },
        { label: 'Extra charges', value: formatBdtForPdf(c.extraRevenue ?? 0) },
      ],
      y,
      marginX,
      marginTop
    )

    if (c.profitSummary) {
      y = drawSectionTitle(pdf, 'Profit summary', y, marginX)
      y = drawKeyValueLines(
        pdf,
        [
          {
            label: 'Payments received',
            value: formatBdtForPdf(c.profitSummary.totalPaymentsReceived ?? 0),
          },
          {
            label: 'Outstanding dues',
            value: formatBdtForPdf(c.profitSummary.outstandingDues ?? 0),
          },
          {
            label: 'Net position',
            value: formatBdtForPdf(c.profitSummary.netPosition ?? 0),
          },
        ],
        y,
        marginX,
        marginTop
      )
    }

    if (c.topCustomers?.length) {
      y = drawSectionTitle(pdf, 'Top customers', y, marginX)
      const rows = c.topCustomers.map((cust) => [
        cust.name,
        String(cust.bookingCount),
        formatBdtForPdf(cust.totalSpent),
      ])
      drawTable(pdf, ['Customer', 'Bookings', 'Total spent'], rows, y, marginX, marginTop, [65, 30, 35])
    }
  }

  pdf.save(reportsExportFileName(meta.tab))
}
