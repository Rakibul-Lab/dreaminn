'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Image from 'next/image'
import { format } from 'date-fns'
import { LogOut } from 'lucide-react'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge } from '../shared/StatusBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { formatBdt } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { PAYMENT_METHOD_OPTIONS_WITH_PAYMENT } from '@/lib/payment-method'
import { Switch } from '@/components/ui/switch'
import { useHotelTimes } from '@/hooks/use-hotel-times'

export interface CheckoutPreview {
  bookingId: string
  customerName: string
  roomNumber: string
  roomTypeName?: string
  checkIn?: string
  checkOut?: string
  bookedNights: number
  actualStayNights: number
  chargeableNights: number
  stayAdjustmentMode?: 'shrink' | 'extend' | null
  nightlyRate: number
  bookedRoomCharge: number
  extraChargesIfIncluded?: number
  roomCharges: number
  foodCharges: number
  extraCharges: number
  subtotal: number
  discount: number
  vatApplied?: boolean
  vatPercent: number
  vatAmount: number
  totalAmount: number
  totalPaid: number
  dueBeforeSettlement: number
  creditAmount?: number
}

interface CheckoutPageViewProps {
  bookingId: string
}

export function CheckoutPageView({ bookingId }: CheckoutPageViewProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { formatCheckIn, formatCheckOut } = useHotelTimes()
  const [checkOutPayment, setCheckOutPayment] = useState('0')
  const [checkOutPaymentMethod, setCheckOutPaymentMethod] = useState('CASH')
  const [checkOutPaymentReference, setCheckOutPaymentReference] = useState('')
  const [checkOutPaymentNotes, setCheckOutPaymentNotes] = useState('')
  const [extraChargesEnabled, setExtraChargesEnabled] = useState(true)

  const { data: checkoutPreviewData, isFetching: checkoutPreviewFetching } = useQuery({
      queryKey: ['checkout-preview', bookingId, extraChargesEnabled],
      queryFn: () => {
        const params = new URLSearchParams()
        params.set('includeExtraCharges', extraChargesEnabled ? 'true' : 'false')
        const qs = params.toString()
        return api.get<{ success: boolean; data: CheckoutPreview; error?: string }>(
          `/bookings/check-out/${bookingId}${qs ? `?${qs}` : ''}`
        )
      },
      enabled: !!bookingId,
      retry: false,
    })

  const previewRes = checkoutPreviewData as
    | { success?: boolean; data?: CheckoutPreview; error?: string; message?: string }
    | undefined
  const checkoutPreview = previewRes?.success !== false ? previewRes?.data : undefined
  const previewApiError =
    previewRes?.success === false ? previewRes.error || previewRes.message : undefined

  const checkOutDue = checkoutPreview?.dueBeforeSettlement ?? 0
  const checkOutCredit = checkoutPreview?.creditAmount ?? 0
  const checkOutPaymentAmount = parseFloat(checkOutPayment) || 0
  const checkOutRemaining = Math.max(checkOutDue - checkOutPaymentAmount, 0)

  useEffect(() => {
    setCheckOutPayment(String(checkOutDue || 0))
  }, [checkOutDue])

  const checkOutMutation = useMutation({
    mutationFn: () =>
      api.post(`/bookings/check-out/${bookingId}`, {
        finalPayment: checkOutDue > 0 ? checkOutPaymentAmount : 0,
        paymentMethod: checkOutPaymentMethod,
        paymentReference: checkOutPaymentReference || undefined,
        paymentNotes: checkOutPaymentNotes || undefined,
        includeExtraCharges: extraChargesEnabled,
      }),
    onSuccess: (res: { success?: boolean; data?: { invoiceId?: string; creditAmount?: number }; message?: string; error?: string }) => {
      if (!res?.success) {
        toast.error(res?.error || res?.message || 'Failed to check out')
        return
      }
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['rooms'] })

      const invoiceId = res?.data?.invoiceId
      const credit = res?.data?.creditAmount
      if (invoiceId) {
        const msg = credit && credit > 0
          ? `Check-out complete. Overpaid by ${formatBdt(credit)} — refund may apply.`
          : 'Check-out complete. Print or download the invoice below.'
        router.replace(`/invoice/${invoiceId}?from=checkout&msg=${encodeURIComponent(msg)}`)
        return
      }
      toast.success(res.message || 'Guest checked out successfully')
    },
    onError: () => toast.error('Failed to check out'),
  })

  if (previewApiError && !checkoutPreviewFetching) {
    const message =
      typeof previewApiError === 'string'
        ? previewApiError
        : (previewApiError as Error)?.message || 'Unable to load check-out'
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
        {message}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-8">
      <Card className="border-amber-200/60 bg-muted/60">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 overflow-hidden rounded-lg border bg-card">
                <Image
                  src="/brand-logo.png"
                  alt="RRP Dream Inn logo"
                  width={40}
                  height={40}
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">RRP Dream Inn</p>
                <p className="text-xs text-muted-foreground">Final Check-out & Invoice Settlement</p>
              </div>
            </div>
            <StatusBadge status="CHECKED_IN" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Stay & reservation</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3 text-sm">
          {checkoutPreviewFetching && !checkoutPreview ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-3">
                <p className="text-muted-foreground">Guest</p>
                <p className="font-semibold text-right">{checkoutPreview?.customerName ?? '—'}</p>
                <p className="text-muted-foreground">Room</p>
                <p className="font-medium text-right">
                  {checkoutPreview?.roomNumber ?? '—'}
                  {checkoutPreview?.roomTypeName ? ` · ${checkoutPreview.roomTypeName}` : ''}
                </p>
                <p className="text-muted-foreground">Reserved nights</p>
                <p className="font-semibold text-right">{checkoutPreview?.bookedNights ?? '—'} night(s)</p>
                <p className="text-muted-foreground">Reservation period</p>
                <p className="font-medium text-right text-xs">
                  {checkoutPreview?.checkIn
                    ? `${formatCheckIn(checkoutPreview.checkIn)} → ${formatCheckOut(checkoutPreview.checkOut!)}`
                    : '—'}
                </p>
                <p className="text-muted-foreground">Actual stay (today)</p>
                <p className="font-semibold text-right text-amber-700">
                  {checkoutPreview?.actualStayNights ?? '—'} night(s)
                </p>
                <p className="text-muted-foreground">Rate per night</p>
                <p className="font-medium text-right">{formatBdt(checkoutPreview?.nightlyRate ?? 0)}</p>
                <p className="text-muted-foreground">Current room charge</p>
                <p className="font-medium text-right">{formatBdt(checkoutPreview?.roomCharges ?? 0)}</p>
                {checkoutPreview?.chargeableNights != null &&
                  checkoutPreview.chargeableNights !== checkoutPreview.bookedNights && (
                    <>
                      <p className="text-muted-foreground col-span-2 text-xs text-amber-700">
                        Stay adjusted: {checkoutPreview.chargeableNights} of {checkoutPreview.bookedNights}{' '}
                        reserved night(s) charged
                      </p>
                    </>
                  )}
              </div>

              <p className="text-xs text-muted-foreground px-1">
                To change nights or add an early checkout fee, use <strong>Adjust stay</strong> on the
                bookings list before checking out.
              </p>

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Include extra charges</p>
                  <p className="text-xs text-muted-foreground">Late checkout and other room extras</p>
                </div>
                <Switch checked={extraChargesEnabled} onCheckedChange={setExtraChargesEnabled} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Invoice details</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-2 text-sm">
          {checkoutPreviewFetching && !checkoutPreview ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <p className="text-muted-foreground">Room charges</p>
              <p className="font-medium text-right">{formatBdt(checkoutPreview?.roomCharges ?? 0)}</p>
              <p className="text-muted-foreground">Restaurant</p>
              <p className="font-medium text-right">{formatBdt(checkoutPreview?.foodCharges ?? 0)}</p>
              <p className="text-muted-foreground">Extra charges</p>
              <p
                className={cn(
                  'font-medium text-right',
                  !extraChargesEnabled && 'text-muted-foreground line-through'
                )}
              >
                {formatBdt(checkoutPreview?.extraCharges ?? 0)}
              </p>
              <p className="text-muted-foreground">Discount</p>
              <p className="font-medium text-right text-emerald-700">
                {formatBdt(checkoutPreview?.discount ?? 0)}
              </p>
              <p className="text-muted-foreground">
                VAT (
                {checkoutPreview?.vatApplied === false ? 'none' : `${checkoutPreview?.vatPercent ?? 0}%`} ·
                reservation)
              </p>
              <p className="font-medium text-right">{formatBdt(checkoutPreview?.vatAmount ?? 0)}</p>
              <p className="text-muted-foreground font-semibold">Invoice total</p>
              <p className="font-semibold text-right">{formatBdt(checkoutPreview?.totalAmount ?? 0)}</p>
              <p className="text-muted-foreground">Paid</p>
              <p className="font-medium text-right text-emerald-700">
                {formatBdt(checkoutPreview?.totalPaid ?? 0)}
              </p>
              <p className="text-muted-foreground">Current due</p>
              <p className="font-semibold text-right text-red-600">{formatBdt(checkOutDue)}</p>
              {checkOutCredit > 0 && (
                <>
                  <p className="text-muted-foreground">Overpaid</p>
                  <p className="font-semibold text-right text-emerald-700">{formatBdt(checkOutCredit)}</p>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Final payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Amount (BDT)</Label>
              <Input
                type="number"
                min="0"
                value={checkOutPayment}
                onChange={(e) => setCheckOutPayment(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Remaining:{' '}
                <span
                  className={
                    checkOutRemaining > 0 ? 'text-red-600 font-semibold' : 'text-emerald-600 font-semibold'
                  }
                >
                  {formatBdt(checkOutRemaining)}
                </span>
              </p>
            </div>
            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select value={checkOutPaymentMethod} onValueChange={setCheckOutPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHOD_OPTIONS_WITH_PAYMENT.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Reference (optional)</Label>
              <Input
                value={checkOutPaymentReference}
                onChange={(e) => setCheckOutPaymentReference(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input value={checkOutPaymentNotes} onChange={(e) => setCheckOutPaymentNotes(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
        <Button variant="outline" onClick={() => window.close()}>
          Cancel
        </Button>
        <Button
          className="bg-slate-800 hover:bg-slate-900 text-white"
          disabled={
            checkOutMutation.isPending ||
            !bookingId ||
            checkoutPreviewFetching ||
            (checkOutDue > 0 && (checkOutPaymentAmount <= 0 || checkOutPaymentAmount < checkOutDue))
          }
          onClick={() => {
            if (checkOutDue > 0 && checkOutPaymentAmount < checkOutDue) {
              toast.error('Please clear full due amount before checkout.')
              return
            }
            checkOutMutation.mutate()
          }}
        >
          <LogOut className="h-4 w-4 mr-2" />
          {checkOutMutation.isPending ? 'Processing…' : 'Settle & check out'}
        </Button>
      </div>
    </div>
  )
}
