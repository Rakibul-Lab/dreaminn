'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { invoicePdfFileName, downloadInvoicePdfFromElement } from '@/lib/invoice-pdf'
import { toast } from 'sonner'
import { useHotelTimes } from '@/hooks/use-hotel-times'
import { AppDevelopedByFooter } from '@/components/AppDevelopedByFooter'

export interface InvoicePrintData {
  id: string
  invoiceNumber: string
  roomCharges: number
  foodCharges: number
  extraCharges: number
  subtotal: number
  discount: number
  vatAmount: number
  totalAmount: number
  paidAmount: number
  dueAmount: number
  declaredVatPercent?: number
  createdAt: string
  booking: {
    id: string
    checkIn: string
    checkOut: string
    customer: { name: string; phone: string; email?: string | null; address?: string | null }
    room: { roomNumber: string; type: { name: string } }
    restaurantOrders?: Array<{
      id: string
      orderNumber: string
      subtotal: number
      discount: number
      vatPercent: number
      vatAmount: number
      totalAmount: number
      createdAt: string
    }>
  }
  items: Array<{
    id: string
    description: string
    quantity: number
    unitPrice: number
    total: number
  }>
}

interface InvoicePrintViewProps {
  invoiceId: string
  showToolbar?: boolean
  title?: string
  successBanner?: string
  onClose?: () => void
}

export function InvoicePrintView({
  invoiceId,
  showToolbar = true,
  title = 'Guest Invoice',
  successBanner,
  onClose,
}: InvoicePrintViewProps) {
  const documentRef = useRef<HTMLElement>(null)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const { formatCheckIn, formatCheckOut } = useHotelTimes()

  const { data, isLoading } = useQuery({
    queryKey: ['print-invoice', invoiceId],
    queryFn: () => api.get<{ success: boolean; data: InvoicePrintData }>(`/invoices/${invoiceId}`),
    enabled: !!invoiceId,
  })

  const invoice = data?.data
  const roomBill = invoice?.roomCharges || 0
  const restaurantOrders = invoice?.booking?.restaurantOrders || []
  const restaurantSubtotal = restaurantOrders.reduce((sum, o) => sum + o.subtotal, 0)
  const restaurantDiscount = restaurantOrders.reduce((sum, o) => sum + o.discount, 0)
  const restaurantBill = Math.max(0, restaurantSubtotal - restaurantDiscount)
  const extraBill = invoice?.extraCharges || 0
  const restaurantVat = restaurantOrders.reduce((sum, o) => sum + o.vatAmount, 0)
  const roomVat = Math.max(0, (invoice?.vatAmount || 0) - restaurantVat)
  const hotelVatPercent = invoice?.declaredVatPercent ?? 15
  const vatRates = Array.from(new Set(restaurantOrders.map((o) => Number(o.vatPercent || 0))))
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b)
  const restaurantVatLabel = vatRates.length ? vatRates.map((r) => `${r}%`).join(', ') : '-'
  const hotelPartTotal = roomBill + roomVat + extraBill
  const restaurantPartTotal = restaurantBill + restaurantVat

  const lineItems = invoice?.items ?? []
  const displayItems =
    lineItems.length > 0
      ? lineItems
      : [
          ...(roomBill > 0
            ? [
                {
                  id: 'fb-room',
                  description: `Room charges (Room ${invoice?.booking.room.roomNumber})`,
                  quantity: 1,
                  unitPrice: roomBill,
                  total: roomBill,
                  itemType: 'room_charge',
                },
              ]
            : []),
          ...(extraBill > 0
            ? [
                {
                  id: 'fb-extra',
                  description: 'Extra charges',
                  quantity: 1,
                  unitPrice: extraBill,
                  total: extraBill,
                  itemType: 'extra_service',
                },
              ]
            : []),
          ...(restaurantBill > 0
            ? [
                {
                  id: 'fb-food',
                  description: 'Restaurant charges',
                  quantity: 1,
                  unitPrice: restaurantBill,
                  total: restaurantBill,
                  itemType: 'food_order',
                },
              ]
            : []),
        ]

  const lineItemCategory = (type: string) => {
    switch (type) {
      case 'room_charge':
        return 'Room'
      case 'extra_service':
        return 'Extra'
      case 'food_order':
        return 'F&B'
      case 'discount':
        return 'Discount'
      case 'vat_hotel':
        return 'Hotel VAT'
      case 'vat_restaurant':
        return 'Restaurant VAT'
      default:
        return type
    }
  }

  const handleDownloadPdf = async () => {
    if (!invoice || !documentRef.current) return
    setDownloadingPdf(true)
    const toastId = toast.loading('Generating PDF…')
    try {
      await downloadInvoicePdfFromElement(
        documentRef.current,
        invoicePdfFileName(invoice.invoiceNumber)
      )
      toast.success('PDF downloaded', { id: toastId })
    } catch (err) {
      console.error('Invoice PDF failed:', err)
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast.error(`Failed to generate PDF: ${msg}`, { id: toastId })
    } finally {
      setDownloadingPdf(false)
    }
  }

  if (isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading invoice...</div>
  }

  if (!invoice) {
    return <div className="p-8 text-sm text-red-600">Invoice not found.</div>
  }

  return (
    <div className="min-h-screen flex flex-col bg-background print:block">
      <div className="flex-1 p-6 print:p-0 print:bg-white">
      {showToolbar && (
        <div className="mx-auto mb-4 flex max-w-4xl flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
            {successBanner && (
              <p className="mt-1 text-sm text-emerald-700">{successBanner}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              Print
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => void handleDownloadPdf()}
              disabled={downloadingPdf}
            >
              {downloadingPdf ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating…
                </>
              ) : (
                'Download PDF'
              )}
            </Button>
            {onClose && (
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </div>
      )}

      <main
        ref={documentRef}
        className="print-container invoice-print-page mx-auto max-w-4xl rounded-xl border border-border bg-card p-6 text-card-foreground print:border-0 print:bg-white print:p-0"
      >
        <div className="print:border-0 print:p-0">
          <div className="mb-6 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-lg border border-border bg-background print:bg-white">
                <Image
                  src="/brand-logo.png"
                  alt="RRP Dream Inn logo"
                  width={48}
                  height={48}
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">RRP Dream Inn</p>
                <p className="text-xs text-muted-foreground">Professional Guest Invoice</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Invoice No</p>
              <p className="font-mono text-base font-semibold text-amber-700">{invoice.invoiceNumber}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(invoice.createdAt), 'MMM dd, yyyy')}
              </p>
            </div>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Guest</p>
              <p className="font-semibold">{invoice.booking.customer.name}</p>
              <p>{invoice.booking.customer.phone}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Room</p>
              <p className="font-semibold">Room {invoice.booking.room.roomNumber}</p>
              <p>{invoice.booking.room.type.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCheckIn(invoice.booking.checkIn)} – {formatCheckOut(invoice.booking.checkOut)}
              </p>
            </div>
          </div>

          <table className="mb-5 w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">Category</th>
                <th className="py-2">Description</th>
                <th className="py-2 text-center">Qty</th>
                <th className="py-2 text-right">Rate</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item) => (
                <tr key={item.id} className="border-b border-border">
                  <td className="py-2 text-xs text-muted-foreground">
                    {lineItemCategory((item as { itemType?: string }).itemType || 'room_charge')}
                  </td>
                  <td className="py-2">{item.description}</td>
                  <td className="py-2 text-center">{item.quantity}</td>
                  <td className="py-2 text-right">৳{item.unitPrice.toLocaleString()}</td>
                  <td
                    className={`py-2 text-right font-medium ${item.total < 0 ? 'text-emerald-700' : ''}`}
                  >
                    {item.total < 0 ? '-' : ''}৳{Math.abs(item.total).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ml-auto max-w-xs space-y-1 text-sm">
            <div className="rounded border border-border p-2.5 space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Hotel Part
              </p>
              <div className="flex justify-between">
                <span>Room Bill</span>
                <span>৳{roomBill.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Room VAT</span>
                <span>৳{roomVat.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>VAT Rate</span>
                <span>{hotelVatPercent}%</span>
              </div>
              {extraBill > 0 && (
                <div className="flex justify-between">
                  <span>Extra Charges</span>
                  <span>৳{extraBill.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-1 font-semibold">
                <span>Hotel Total</span>
                <span>৳{hotelPartTotal.toLocaleString()}</span>
              </div>
            </div>
            <div className="rounded border border-border p-2.5 space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Restaurant Part
              </p>
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>৳{restaurantSubtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Discount</span>
                <span>-৳{restaurantDiscount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>VAT ({restaurantVatLabel})</span>
                <span>৳{restaurantVat.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t pt-1 font-semibold">
                <span>Total</span>
                <span>৳{restaurantPartTotal.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex justify-between">
              <span>Combined Total</span>
              <span>৳{(hotelPartTotal + restaurantPartTotal).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Discount</span>
              <span>৳{invoice.discount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Subtotal</span>
              <span>৳{invoice.totalAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>Paid</span>
              <span>৳{invoice.paidAmount.toLocaleString()}</span>
            </div>
            <div
              className={`flex justify-between font-bold ${invoice.dueAmount > 0 ? 'text-red-600' : 'text-emerald-700'}`}
            >
              <span>Due</span>
              <span>৳{invoice.dueAmount.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </main>
      </div>
      <AppDevelopedByFooter printHidden />
    </div>
  )
}
