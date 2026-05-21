'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { CalendarRange } from 'lucide-react'
import { api } from '@/lib/api-client'
import { formatBdt } from '@/lib/currency'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useHotelTimes } from '@/hooks/use-hotel-times'

type AdjustStayApiResponse = {
  success: boolean
  data?: AdjustStayPreview
  error?: string
  message?: string
}

export interface AdjustStayPreview {
  stayMode?: 'shrink' | 'extend'
  bookedNights: number
  actualStayNights: number
  chargeableNights: number
  waivedNights: number
  chargeableUntilDate: string
  scheduledCheckIn: string
  scheduledCheckOut: string
  canEarlyDeparture: boolean
  earlyDepartureDisabledReason: string | null
  canExtend: boolean
  extendDisabledReason: string | null
  minDepartureDate: string
  maxDepartureDate: string
  minExtendDate: string
  nightlyRate: number
  bookedRoomCharge: number
  roomCharge: number
  earlyCheckoutFee: number
  roomSubtotal: number
  vatPercent: number
  vatApplied: boolean
  vatAmount: number
  totalWithVat: number
  totalPaid: number
  dueAmount: number
  isEarlyDeparture: boolean
  defaultEarlyCheckoutPercent: number
  defaultEarlyCheckoutAmount: number
  adjustmentUnavailable?: boolean
  customerName?: string
  roomNumber?: string
}

interface AdjustStayDialogProps {
  bookingId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AdjustStayDialog({ bookingId, open, onOpenChange }: AdjustStayDialogProps) {
  const queryClient = useQueryClient()
  const { formatCheckIn, formatCheckOut } = useHotelTimes()
  const hydratedRef = useRef(false)

  const [stayMode, setStayMode] = useState<'shrink' | 'extend'>('shrink')
  const [chargeableUntilDate, setChargeableUntilDate] = useState('')
  const [earlyCheckoutEnabled, setEarlyCheckoutEnabled] = useState(false)
  const [earlyCheckoutMode, setEarlyCheckoutMode] = useState<'percent' | 'amount'>('percent')
  const [earlyCheckoutPercent, setEarlyCheckoutPercent] = useState('50')
  const [earlyCheckoutAmount, setEarlyCheckoutAmount] = useState('500')
  const [formReady, setFormReady] = useState(false)

  useEffect(() => {
    if (!open) {
      hydratedRef.current = false
      setFormReady(false)
      setChargeableUntilDate('')
      setStayMode('shrink')
      setEarlyCheckoutEnabled(false)
      setEarlyCheckoutMode('percent')
    }
  }, [open, bookingId])

  const buildQuery = () => {
    const params = new URLSearchParams()
    params.set('stayMode', stayMode)
    if (chargeableUntilDate) params.set('chargeableUntilDate', chargeableUntilDate)
    params.set('earlyCheckoutEnabled', earlyCheckoutEnabled ? 'true' : 'false')
    params.set('earlyCheckoutMode', earlyCheckoutMode)
    params.set('earlyCheckoutPercent', earlyCheckoutPercent || '0')
    params.set('earlyCheckoutAmount', earlyCheckoutAmount || '0')
    return params.toString()
  }

  const {
    data: previewRes,
    isLoading,
    isFetching,
    isError,
    error: queryError,
  } = useQuery({
    queryKey: formReady
      ? [
          'adjust-stay-preview',
          bookingId,
          stayMode,
          chargeableUntilDate,
          earlyCheckoutEnabled,
          earlyCheckoutMode,
          earlyCheckoutPercent,
          earlyCheckoutAmount,
        ]
      : ['adjust-stay-preview', bookingId, 'bootstrap'],
    queryFn: () =>
      api.get<AdjustStayApiResponse>(
        `/bookings/adjust-stay/${bookingId}${formReady ? `?${buildQuery()}` : ''}`
      ),
    enabled: !!bookingId && open,
    placeholderData: (previous) => previous,
    retry: 1,
  })

  const preview = previewRes?.success ? previewRes.data : undefined
  const loadError =
    previewRes && !previewRes.success
      ? previewRes.error || previewRes.message
      : isError
        ? queryError instanceof Error
          ? queryError.message
          : 'Failed to load preview'
        : undefined

  useEffect(() => {
    if (!open || !preview || hydratedRef.current) return

    hydratedRef.current = true

    if (preview.adjustmentUnavailable) return

    setEarlyCheckoutPercent(String(preview.defaultEarlyCheckoutPercent))
    setEarlyCheckoutAmount(String(preview.defaultEarlyCheckoutAmount))
    if (preview.chargeableUntilDate) setChargeableUntilDate(preview.chargeableUntilDate)
    if (preview.canEarlyDeparture) setStayMode('shrink')
    else if (preview.canExtend) setStayMode('extend')
    setEarlyCheckoutEnabled(false)
    setFormReady(true)
  }, [open, preview])

  const selectMode = (mode: 'shrink' | 'extend') => {
    if (!preview) return
    if (mode === 'shrink' && !preview.canEarlyDeparture) return
    if (mode === 'extend' && !preview.canExtend) return
    setStayMode(mode)
    setEarlyCheckoutEnabled(false)
    if (mode === 'shrink') {
      setChargeableUntilDate(preview.maxDepartureDate)
    } else {
      setChargeableUntilDate(preview.minExtendDate)
    }
  }

  const applyMutation = useMutation({
    mutationFn: () =>
      api.post<AdjustStayApiResponse>(`/bookings/adjust-stay/${bookingId}`, {
        stayMode,
        chargeableUntilDate,
        earlyCheckoutEnabled,
        earlyCheckoutMode,
        earlyCheckoutPercent: parseFloat(earlyCheckoutPercent) || 0,
        earlyCheckoutAmount: parseFloat(earlyCheckoutAmount) || 0,
      }),
    onSuccess: (res) => {
      if (!res?.success) {
        toast.error(res?.error || res?.message || 'Failed to update stay')
        return
      }
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['checkout-preview'] })
      toast.success(res.message || 'Stay and charges updated')
      onOpenChange(false)
    },
    onError: () => toast.error('Failed to update stay'),
  })

  const activeMode: 'shrink' | 'extend' = formReady
    ? stayMode
    : preview?.stayMode ?? (preview?.canEarlyDeparture ? 'shrink' : 'extend')

  const showEarlyCheckout =
    activeMode === 'shrink' && (preview?.waivedNights ?? 0) > 0 && preview?.canEarlyDeparture

  const dateLabel = activeMode === 'shrink' ? 'Departure date' : 'Extended checkout date'
  const dateMin = activeMode === 'shrink' ? preview?.minDepartureDate : preview?.minExtendDate
  const dateMax = activeMode === 'shrink' ? preview?.maxDepartureDate : undefined

  const showContent = !!preview && !loadError
  const showInitialLoad = isLoading && !preview

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarRange className="h-5 w-5 text-amber-600" />
            Adjust stay & charges
          </DialogTitle>
        </DialogHeader>

        {showInitialLoad ? (
          <Skeleton className="h-48 w-full" />
        ) : loadError ? (
          <p className="text-sm text-red-600 rounded-md bg-red-50 dark:bg-red-950/30 p-3">{loadError}</p>
        ) : showContent ? (
          <div className="space-y-4 text-sm">
            {isFetching && formReady && (
              <p className="text-xs text-muted-foreground animate-pulse">Updating preview…</p>
            )}

            {preview.adjustmentUnavailable && (
              <p className="text-sm text-amber-800 rounded-md bg-amber-50 dark:bg-amber-950/30 p-3">
                {preview.extendDisabledReason ||
                  preview.earlyDepartureDisabledReason ||
                  'Stay adjustment is not available for this reservation.'}
              </p>
            )}

            <div className="rounded-lg bg-muted/50 p-3 space-y-1">
              <p>
                <span className="text-muted-foreground">Guest:</span>{' '}
                <span className="font-medium">{preview.customerName}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Room:</span> {preview.roomNumber}
              </p>
              <p>
                <span className="text-muted-foreground">Reserved:</span>{' '}
                {formatCheckIn(preview.scheduledCheckIn)} → {formatCheckOut(preview.scheduledCheckOut)} (
                {preview.bookedNights} night(s))
              </p>
              <p>
                <span className="text-muted-foreground">Stay so far:</span>{' '}
                <span className="font-semibold text-amber-700">
                  {preview.actualStayNights} night(s)
                </span>
              </p>
            </div>

            {!preview.adjustmentUnavailable && (
            <>
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Adjustment type</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={stayMode === 'shrink' ? 'default' : 'outline'}
                  className={stayMode === 'shrink' ? 'bg-amber-600 hover:bg-amber-700' : ''}
                  disabled={!preview.canEarlyDeparture}
                  onClick={() => selectMode('shrink')}
                >
                  Early departure
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={activeMode === 'extend' ? 'default' : 'outline'}
                  className={activeMode === 'extend' ? 'bg-amber-600 hover:bg-amber-700' : ''}
                  disabled={!preview.canExtend}
                  onClick={() => selectMode('extend')}
                >
                  Extend stay
                </Button>
              </div>
              {!preview.canEarlyDeparture && preview.earlyDepartureDisabledReason && (
                <p className="text-xs text-amber-800 mt-2 rounded-md bg-amber-50 dark:bg-amber-950/30 p-2">
                  {preview.earlyDepartureDisabledReason}
                </p>
              )}
              {!preview.canExtend && preview.extendDisabledReason && (
                <p className="text-xs text-amber-800 mt-2 rounded-md bg-amber-50 dark:bg-amber-950/30 p-2">
                  {preview.extendDisabledReason}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="adj-until-date">{dateLabel}</Label>
              <Input
                id="adj-until-date"
                type="date"
                min={dateMin}
                max={dateMax}
                value={chargeableUntilDate || preview.chargeableUntilDate}
                onChange={(e) => setChargeableUntilDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {activeMode === 'shrink' ? (
                  <>
                    Guest leaves on this date (before reserved{' '}
                    {formatCheckOut(preview.scheduledCheckOut)}). Charging{' '}
                    <span className="font-semibold">{preview.chargeableNights}</span> night(s) · Room{' '}
                    {formatBdt(preview.roomCharge)}
                    {preview.waivedNights > 0 && (
                      <span> · {preview.waivedNights} night(s) waived</span>
                    )}
                  </>
                ) : (
                  <>
                    New checkout after reserved end. Charging{' '}
                    <span className="font-semibold">{preview.chargeableNights}</span> night(s) · Room{' '}
                    {formatBdt(preview.roomCharge)}
                  </>
                )}
              </p>
            </div>

            {showEarlyCheckout && (
              <div className="space-y-3 rounded-lg border border-amber-200/60 bg-amber-50/40 dark:bg-amber-950/20 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Early checkout charge</p>
                    <p className="text-xs text-muted-foreground">
                      Fee for unused reserved nights (defaults from settings)
                    </p>
                  </div>
                  <Switch checked={earlyCheckoutEnabled} onCheckedChange={setEarlyCheckoutEnabled} />
                </div>
                {earlyCheckoutEnabled && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={earlyCheckoutMode === 'percent' ? 'default' : 'outline'}
                        onClick={() => setEarlyCheckoutMode('percent')}
                      >
                        Percentage
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={earlyCheckoutMode === 'amount' ? 'default' : 'outline'}
                        onClick={() => setEarlyCheckoutMode('amount')}
                      >
                        Fixed amount
                      </Button>
                    </div>
                    {earlyCheckoutMode === 'percent' ? (
                      <div className="space-y-1">
                        <Label>Fee (% of waived nights)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={earlyCheckoutPercent}
                          onChange={(e) => setEarlyCheckoutPercent(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Default: {preview.defaultEarlyCheckoutPercent}%
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Label>Fee amount (BDT)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={earlyCheckoutAmount}
                          onChange={(e) => setEarlyCheckoutAmount(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Default: {formatBdt(preview.defaultEarlyCheckoutAmount)}
                        </p>
                      </div>
                    )}
                    <p className="text-sm font-medium text-amber-800">
                      Early checkout fee: {formatBdt(preview.earlyCheckoutFee)}
                    </p>
                  </>
                )}
              </div>
            )}

            <div className="rounded-md border p-3 space-y-1.5 bg-card">
              <p className="font-semibold text-foreground">Updated room settlement</p>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Room + fees</span>
                <span>{formatBdt(preview.roomSubtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  VAT ({preview.vatApplied ? `${preview.vatPercent}%` : 'none'})
                </span>
                <span>{formatBdt(preview.vatAmount)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-1">
                <span>Room total (incl. VAT)</span>
                <span>{formatBdt(preview.totalWithVat)}</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Paid</span>
                <span>{formatBdt(preview.totalPaid)}</span>
              </div>
              <div className="flex justify-between font-bold text-red-600">
                <span>Room due (updated)</span>
                <span>{formatBdt(preview.dueAmount)}</span>
              </div>
            </div>
            </>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Unable to load preview.</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-amber-600 hover:bg-amber-700 text-white"
            disabled={
              !bookingId ||
              !showContent ||
              !!loadError ||
              applyMutation.isPending ||
              !!preview?.adjustmentUnavailable ||
              (!chargeableUntilDate && !preview?.chargeableUntilDate) ||
              (!preview?.canEarlyDeparture && !preview?.canExtend)
            }
            onClick={() => applyMutation.mutate()}
          >
            {applyMutation.isPending ? 'Saving…' : 'Apply & update due'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
