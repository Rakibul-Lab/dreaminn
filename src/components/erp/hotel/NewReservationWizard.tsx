'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { IdDocumentScanner } from './IdDocumentScanner'
import { GuestSearchField, type GuestSearchResult } from './GuestSearchField'
import { ReservationDocumentView } from './ReservationDocumentView'
import type { IdDocumentType } from '@/lib/id-ocr'
import type { IdDocumentItem, IdScanResult } from './IdDocumentScanner'
import { Switch } from '@/components/ui/switch'
import { CheckCircle2, LogIn, Plus } from 'lucide-react'
import {
  computeRoomBookingTotals,
  DEFAULT_VAT_PERCENT,
  VAT_PERCENT_INPUT_STEP,
} from '@/lib/booking-totals'
import { formatPaymentMethod, PAYMENT_METHOD_OPTIONS } from '@/lib/payment-method'
import { DEFAULT_GUEST_COMPANY, formatGuestCompany } from '@/lib/reservation-terms'
import { useHotelTimes } from '@/hooks/use-hotel-times'
import {
  applyHotelTimeToBookingInput,
  countHotelStayNights,
  describeStayPeriod,
  formatTime12h,
  isStayDatePickerRangeValid,
  minCheckoutDatePickerValue,
} from '@/lib/hotel-times'

interface Room {
  id: string
  roomNumber: string
  status: string
  type: { name: string; basePrice: number }
}

const STEP_LABELS = ['Guest', 'Stay', 'Payment', 'Confirm', 'Document']

function defaultStayDates() {
  const checkIn = new Date()
  const checkOut = new Date()
  checkOut.setDate(checkOut.getDate() + 1)
  return {
    checkIn: format(checkIn, 'yyyy-MM-dd'),
    checkOut: format(checkOut, 'yyyy-MM-dd'),
  }
}

function stayDatesValid(checkIn: string, checkOut: string) {
  return isStayDatePickerRangeValid(checkIn, checkOut)
}

type GuestMode = 'new' | 'existing'

type GuestDraft = {
  selectedCustomerId: string
  guestName: string
  guestCompany: string
  guestPhone: string
  guestEmail: string
  guestAddress: string
  idType: IdDocumentType
  idNumber: string
  idDocuments: IdDocumentItem[]
  existingDocsStatus: 'idle' | 'loading' | 'none' | 'found'
}

type StayDraft = {
  selectedRoomId: string
  checkInDate: string
  checkOutDate: string
  adults: string
  children: string
}

type PaymentDraft = {
  advancePayment: string
  advancePaymentMethod: string
  reservationNotes: string
  vatEditEnabled: boolean
  vatPercent: string
}

type ReservationWizardDraft = {
  step: number
  guest: GuestDraft
  stay: StayDraft
  payment: PaymentDraft
}

function emptyGuestDraft(): GuestDraft {
  return {
    selectedCustomerId: '',
    guestName: '',
    guestCompany: DEFAULT_GUEST_COMPANY,
    guestPhone: '',
    guestEmail: '',
    guestAddress: '',
    idType: 'national_id',
    idNumber: '',
    idDocuments: [],
    existingDocsStatus: 'idle',
  }
}

function emptyReservationDraft(vatPercent = String(DEFAULT_VAT_PERCENT)): ReservationWizardDraft {
  const dates = defaultStayDates()
  return {
    step: 1,
    guest: emptyGuestDraft(),
    stay: {
      selectedRoomId: '',
      checkInDate: dates.checkIn,
      checkOutDate: dates.checkOut,
      adults: '1',
      children: '0',
    },
    payment: {
      advancePayment: '0',
      advancePaymentMethod: 'NONE',
      reservationNotes: '',
      vatEditEnabled: false,
      vatPercent,
    },
  }
}

export function NewReservationWizard() {
  const queryClient = useQueryClient()
  const [completedReservationId, setCompletedReservationId] = useState<string | null>(null)
  const [checkedInOnConfirm, setCheckedInOnConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [guestMode, setGuestMode] = useState<GuestMode>('new')
  const [defaultVatPercent, setDefaultVatPercent] = useState(DEFAULT_VAT_PERCENT)
  const [drafts, setDrafts] = useState<Record<GuestMode, ReservationWizardDraft>>({
    new: emptyReservationDraft(),
    existing: emptyReservationDraft(),
  })
  const { times, formatCheckIn, formatCheckOut } = useHotelTimes()

  const activeDraft = drafts[guestMode]
  const step = activeDraft.step
  const { guest, stay, payment } = activeDraft
  const {
    selectedCustomerId,
    guestName,
    guestCompany,
    guestPhone,
    guestEmail,
    guestAddress,
    idType,
    idNumber,
    idDocuments,
    existingDocsStatus,
  } = guest
  const { selectedRoomId, checkInDate, checkOutDate, adults, children } = stay
  const {
    advancePayment,
    advancePaymentMethod,
    reservationNotes,
    vatEditEnabled,
    vatPercent,
  } = payment

  type DraftPatch = {
    step?: number
    guest?: Partial<GuestDraft>
    stay?: Partial<StayDraft>
    payment?: Partial<PaymentDraft>
  }

  const patchDraft = (patch: DraftPatch) => {
    setDrafts((prev) => {
      const cur = prev[guestMode]
      return {
        ...prev,
        [guestMode]: {
          ...cur,
          ...(patch.step !== undefined ? { step: patch.step } : {}),
          guest: patch.guest ? { ...cur.guest, ...patch.guest } : cur.guest,
          stay: patch.stay ? { ...cur.stay, ...patch.stay } : cur.stay,
          payment: patch.payment ? { ...cur.payment, ...patch.payment } : cur.payment,
        },
      }
    })
  }

  const patchDraftFor = (mode: GuestMode, patch: DraftPatch) => {
    setDrafts((prev) => {
      const cur = prev[mode]
      return {
        ...prev,
        [mode]: {
          ...cur,
          ...(patch.step !== undefined ? { step: patch.step } : {}),
          guest: patch.guest ? { ...cur.guest, ...patch.guest } : cur.guest,
          stay: patch.stay ? { ...cur.stay, ...patch.stay } : cur.stay,
          payment: patch.payment ? { ...cur.payment, ...patch.payment } : cur.payment,
        },
      }
    })
  }

  const patchGuest = (patch: Partial<GuestDraft>) => patchDraft({ guest: patch })
  const patchStay = (patch: Partial<StayDraft>) => patchDraft({ stay: patch })
  const patchPayment = (patch: Partial<PaymentDraft>) => patchDraft({ payment: patch })
  const setStep = (nextStep: number) => patchDraft({ step: nextStep })

  const datesValid = stayDatesValid(checkInDate, checkOutDate)

  const { data: roomsData, isLoading: roomsLoading } = useQuery({
    queryKey: ['available-rooms', checkInDate, checkOutDate],
    queryFn: () =>
      api.get<{ success: boolean; data: Room[] }>(
        `/rooms?forBooking=true&checkIn=${encodeURIComponent(checkInDate)}&checkOut=${encodeURIComponent(checkOutDate)}&limit=200`
      ),
    enabled: datesValid,
  })

  const { data: billingSettingsData } = useQuery({
    queryKey: ['billing-settings'],
    queryFn: () =>
      api.get<{ success: boolean; data: { vatPercent: number; vatAppliedByDefault: boolean } }>(
        '/settings/billing'
      ),
  })

  useEffect(() => {
    const settings = (billingSettingsData as { data?: { vatPercent: number } })?.data
    if (settings?.vatPercent == null) return
    const rate = String(settings.vatPercent)
    setDefaultVatPercent(settings.vatPercent)
    setDrafts((prev) => ({
      new: {
        ...prev.new,
        payment: {
          ...prev.new.payment,
          vatPercent: prev.new.payment.vatEditEnabled ? prev.new.payment.vatPercent : rate,
        },
      },
      existing: {
        ...prev.existing,
        payment: {
          ...prev.existing.payment,
          vatPercent: prev.existing.payment.vatEditEnabled
            ? prev.existing.payment.vatPercent
            : rate,
        },
      },
    }))
  }, [billingSettingsData])

  const availableRooms = (
    ((roomsData as { data?: Room[] })?.data || []) as Room[]
  ).filter((r) => r.status === 'AVAILABLE')

  useEffect(() => {
    if (selectedRoomId && !availableRooms.some((r) => r.id === selectedRoomId)) {
      patchStay({ selectedRoomId: '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only clear stale room when availability changes
  }, [availableRooms, selectedRoomId, guestMode])

  const resetForm = () => {
    setCompletedReservationId(null)
    setCheckedInOnConfirm(false)
    setGuestMode('new')
    setDrafts({
      new: emptyReservationDraft(String(defaultVatPercent)),
      existing: emptyReservationDraft(String(defaultVatPercent)),
    })
  }

  const handleScanComplete = (result: IdScanResult) => {
    if (guestMode !== 'new') return
    const patch: Partial<GuestDraft> = {}
    if (result.name) patch.guestName = result.name.trim()
    if (result.idNumber) patch.idNumber = result.idNumber.replace(/\D/g, '')
    if (result.idType) patch.idType = result.idType
    if (Object.keys(patch).length > 0) patchDraftFor('new', { guest: patch })
  }

  const loadGuestIdDocuments = async (customerId: string) => {
    patchDraftFor('existing', { guest: { existingDocsStatus: 'loading' } })
    try {
      const res = (await api.get<{ success: boolean; data: { paths: string[] } }>(
        `/customers/${customerId}/id-documents`
      )) as { success?: boolean; data?: { paths: string[] } }
      const paths = res.data?.paths ?? []
      patchDraftFor('existing', {
        guest: {
          idDocuments: paths.map((path) => ({ path, previewUrl: path })),
          existingDocsStatus: paths.length > 0 ? 'found' : 'none',
        },
      })
    } catch {
      patchDraftFor('existing', {
        guest: { idDocuments: [], existingDocsStatus: 'none' },
      })
    }
  }

  const applyExistingGuest = (selected: GuestSearchResult) => {
    const idTypeValue =
      selected.idType === 'national_id' ||
      selected.idType === 'passport' ||
      selected.idType === 'driving_license'
        ? selected.idType
        : drafts.existing.guest.idType

    patchDraftFor('existing', {
      guest: {
        selectedCustomerId: selected.id,
        guestName: selected.name,
        guestCompany: formatGuestCompany(selected.company),
        guestPhone: selected.phone,
        guestEmail: selected.email || '',
        guestAddress: selected.address || '',
        idNumber: selected.idNumber || '',
        idType: idTypeValue,
      },
    })
    void loadGuestIdDocuments(selected.id)
  }

  const clearExistingGuest = () => {
    patchDraftFor('existing', { guest: emptyGuestDraft() })
  }

  const estimatedRoomCharge = () => {
    if (!checkInDate || !checkOutDate || !selectedRoomId) return 0
    const room = availableRooms.find((r) => r.id === selectedRoomId)
    if (!room) return 0
    try {
      const ci = applyHotelTimeToBookingInput(checkInDate, times.checkInTime)
      const co = applyHotelTimeToBookingInput(checkOutDate, times.checkOutTime)
      const nights = countHotelStayNights(ci, co)
      return nights * room.type.basePrice
    } catch {
      return 0
    }
  }

  const parsedVatPercent = () => {
    const n = parseFloat(vatPercent)
    return Number.isNaN(n) || n < 0 ? defaultVatPercent : n
  }

  /** VAT rate used for totals — settings default unless edit mode is on. */
  const effectiveVatPercent = () =>
    vatEditEnabled ? parsedVatPercent() : defaultVatPercent

  const vatOptions = () => ({
    vatApplied: true,
    vatPercent: effectiveVatPercent(),
  })

  const estimatedTotals = () => {
    const roomCharge = estimatedRoomCharge()
    const advance = parseFloat(advancePayment) || 0
    return computeRoomBookingTotals(roomCharge, advance, vatOptions())
  }

  const createCustomerMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/customers', data),
  })

  const createReservationMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/bookings', data),
  })

  const resolveCustomerId = async (): Promise<string | null> => {
    if (idDocuments.length === 0) {
      toast.error('Upload or scan at least one ID image before continuing')
      return null
    }

    if (guestMode === 'existing') {
      if (!selectedCustomerId) {
        toast.error('Please select a guest')
        return null
      }
      if (!guestName.trim() || !guestPhone.trim()) {
        toast.error('Guest name and phone are required')
        return null
      }

      const updateRes = (await api.put(`/customers/${selectedCustomerId}`, {
        name: guestName.trim(),
        company: formatGuestCompany(guestCompany),
        phone: guestPhone.trim(),
        email: guestEmail.trim() || null,
        address: guestAddress.trim() || null,
        idType,
        idNumber: idNumber.trim() || null,
        idDocPath: idDocuments[0]?.path || null,
      })) as { success?: boolean; error?: string }

      if (!updateRes?.success) {
        toast.error(updateRes?.error || 'Failed to update guest profile')
        return null
      }

      return selectedCustomerId
    }

    if (!guestName.trim() || !guestPhone.trim()) {
      toast.error('Guest name and phone are required')
      return null
    }

    const res = (await createCustomerMutation.mutateAsync({
      name: guestName.trim(),
      company: formatGuestCompany(guestCompany),
      phone: guestPhone.trim(),
      email: guestEmail.trim() || undefined,
      address: guestAddress.trim() || undefined,
      idType,
      idNumber: idNumber.trim() || undefined,
      idDocPath: idDocuments[0]?.path || undefined,
    })) as { success?: boolean; data?: { id: string }; error?: string; message?: string }

    if (!res?.success || !res.data?.id) {
      toast.error(res?.error || res?.message || 'Failed to create guest profile')
      return null
    }

    if (res.message?.includes('already exists')) {
      toast.info('Guest profile found for this phone — continuing with existing record.')
    }

    return res.data.id
  }

  const finishReservation = (bookingId: string, withCheckIn: boolean) => {
    setCheckedInOnConfirm(withCheckIn)
    setCompletedReservationId(bookingId)
    patchDraft({ step: 5 })
    queryClient.invalidateQueries({ queryKey: ['bookings'] })
    queryClient.invalidateQueries({ queryKey: ['customers-list'] })
    queryClient.invalidateQueries({ queryKey: ['customers'] })
    queryClient.invalidateQueries({ queryKey: ['available-rooms'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['rooms'] })
    toast.success(
      withCheckIn
        ? 'Reservation confirmed and guest checked in'
        : 'Reservation created — print or download your document below'
    )
  }

  const submitReservation = async (withCheckIn: boolean) => {
    const customerId = await resolveCustomerId()
    if (!customerId || !selectedRoomId || !checkInDate || !checkOutDate) return

    setIsSubmitting(true)
    try {
      const res = (await createReservationMutation.mutateAsync({
        customerId,
        company: formatGuestCompany(guestCompany),
        roomId: selectedRoomId,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        adults: parseInt(adults, 10),
        children: parseInt(children, 10),
        advancePayment: parseFloat(advancePayment) || 0,
        paymentMethod: advancePaymentMethod,
        notes: reservationNotes.trim() || undefined,
        idDocumentPaths:
          idDocuments.length > 0 ? idDocuments.map((d) => d.path) : undefined,
        vatApplied: true,
        vatPercent: effectiveVatPercent(),
        checkInNow: withCheckIn,
      })) as {
        success?: boolean
        data?: { id: string; status?: string }
        error?: string
        message?: string
      }

      if (!res?.success || !res.data?.id) {
        toast.error(res?.error || res?.message || 'Failed to create reservation')
        return
      }

      const bookingId = res.data.id
      let didCheckIn = withCheckIn && res.data.status === 'CHECKED_IN'

      if (withCheckIn && !didCheckIn) {
        const checkInRes = (await api.post(`/bookings/check-in/${bookingId}`, {
          initialPayment: 0,
          paymentMethod: 'CASH',
        })) as { success?: boolean; error?: string; message?: string }

        if (!checkInRes?.success) {
          toast.error(checkInRes?.error || checkInRes?.message || 'Reservation saved but check-in failed')
          finishReservation(bookingId, false)
          return
        }
        didCheckIn = true
      }

      finishReservation(bookingId, didCheckIn)
    } catch {
      toast.error('Failed to create reservation')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirm = () => void submitReservation(false)
  const handleConfirmWithCheckIn = () => void submitReservation(true)

  const hasRequiredIdDocs = idDocuments.length > 0
  const guestDetailsReady =
    guestMode === 'existing'
      ? !!selectedCustomerId && !!guestName.trim() && !!guestPhone.trim()
      : !!guestName.trim() && !!guestPhone.trim()
  const canGoStep2 = guestDetailsReady && hasRequiredIdDocs
  const showGuestDetails = guestMode === 'new' || !!selectedCustomerId

  const displayStep = completedReservationId ? 5 : step

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {STEP_LABELS.map((label, i) => {
          const s = i + 1
          return (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${
                  displayStep >= s ? 'bg-amber-100 text-amber-800' : 'bg-muted text-muted-foreground'
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                    displayStep >= s ? 'bg-amber-600 text-white' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {displayStep > s ? '✓' : s}
                </span>
                {label}
              </div>
              {s < STEP_LABELS.length && (
                <div className={`hidden sm:block w-6 h-0.5 ${displayStep > s ? 'bg-amber-500' : 'bg-border'}`} />
              )}
            </div>
          )
        })}
      </div>

      {displayStep === 5 && completedReservationId ? (
        <div className="space-y-6">
          <Card className="border-emerald-200 bg-emerald-50 print:hidden">
            <CardContent className="p-4 flex items-start gap-3">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 shrink-0" />
              <div>
                <h2 className="font-semibold text-emerald-900">
                  {checkedInOnConfirm ? 'Reservation confirmed & checked in' : 'Reservation confirmed'}
                </h2>
                <p className="text-sm text-emerald-800 mt-1">
                  {checkedInOnConfirm
                    ? 'Guest is checked in and the room is marked occupied. Print or download the document below.'
                    : 'Your reservation is saved. Print or download the document below, then close this tab or create another reservation.'}
                </p>
              </div>
            </CardContent>
          </Card>

          <ReservationDocumentView
            reservationId={completedReservationId}
            showToolbar
            onClose={() => window.close()}
          />

          <div className="flex flex-wrap gap-3 print:hidden">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                resetForm()
              }}
            >
              <Plus className="h-4 w-4" />
              Create another reservation
            </Button>
            <Button variant="ghost" onClick={() => window.close()}>
              Close tab
            </Button>
          </div>
        </div>
      ) : (
        <>
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={guestMode === 'new' ? 'default' : 'outline'}
                  size="sm"
                  className={guestMode === 'new' ? 'bg-amber-600 hover:bg-amber-700' : ''}
                  onClick={() => setGuestMode('new')}
                >
                  New guest
                </Button>
                <Button
                  type="button"
                  variant={guestMode === 'existing' ? 'default' : 'outline'}
                  size="sm"
                  className={guestMode === 'existing' ? 'bg-amber-600 hover:bg-amber-700' : ''}
                  onClick={() => setGuestMode('existing')}
                >
                  Existing guest
                </Button>
              </div>

              {guestMode === 'existing' && (
                <>
                  <GuestSearchField
                    selectedId={selectedCustomerId}
                    selectedLabel={
                      selectedCustomerId
                        ? `${guestName || 'Guest'}${guestPhone ? ` — ${guestPhone}` : ''}`
                        : undefined
                    }
                    onSelect={applyExistingGuest}
                    onClear={clearExistingGuest}
                  />
                  {!selectedCustomerId && (
                    <p className="text-sm text-muted-foreground">
                      Search and select a guest to load their profile and ID documents.
                    </p>
                  )}
                </>
              )}

              {showGuestDetails && (
                <>
                  {existingDocsStatus === 'loading' && (
                    <p className="text-sm text-muted-foreground">Loading previous ID files…</p>
                  )}
                  {guestMode === 'existing' &&
                    existingDocsStatus === 'none' &&
                    idDocuments.length === 0 && (
                      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        No previous ID files found for this guest. Please upload or scan ID
                        documents to continue — reservation cannot proceed without at least one
                        image.
                      </div>
                    )}
                  {guestMode === 'new' && idDocuments.length === 0 && (
                    <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      Upload or scan at least one ID image to continue — reservation cannot proceed
                      without ID documents.
                    </div>
                  )}

                  <IdDocumentScanner
                idType={idType}
                onIdTypeChange={(type) => patchGuest({ idType: type })}
                documents={idDocuments}
                onDocumentsChange={(docs) => {
                  patchGuest({
                    idDocuments: docs,
                    ...(docs.length > 0 && guestMode === 'existing'
                      ? { existingDocsStatus: 'found' as const }
                      : {}),
                  })
                }}
                onScanComplete={handleScanComplete}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Full name *</Label>
                      <Input
                        value={guestName}
                        onChange={(e) => patchGuest({ guestName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Company</Label>
                      <Input
                        value={guestCompany}
                        onChange={(e) => patchGuest({ guestCompany: e.target.value })}
                        placeholder={DEFAULT_GUEST_COMPANY}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>NID / Passport number</Label>
                      <Input
                        value={idNumber}
                        onChange={(e) => patchGuest({ idNumber: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Phone *</Label>
                      <Input
                        id={guestMode === 'new' ? 'guest-phone' : undefined}
                        value={guestPhone}
                        onChange={(e) => patchGuest({ guestPhone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Email</Label>
                      <Input
                        value={guestEmail}
                        onChange={(e) => patchGuest({ guestEmail: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Address</Label>
                      <Input
                        value={guestAddress}
                        onChange={(e) => patchGuest({ guestAddress: e.target.value })}
                      />
                    </div>
                {idDocuments.length > 0 ? (
                  <p className="text-xs text-emerald-600 sm:col-span-2">
                    {idDocuments.length} ID image(s) attached — included on confirmation page 2
                  </p>
                ) : (
                  <p className="text-xs text-amber-700 sm:col-span-2">
                    At least one ID image is required to go to the next step.
                  </p>
                )}
              </div>
                </>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground rounded-md bg-muted/50 p-2">
                {describeStayPeriod(times)}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Arrival date *</Label>
                  <Input
                    type="date"
                    value={checkInDate}
                    onChange={(e) => {
                      const nextIn = e.target.value
                      const patch: Partial<StayDraft> = { checkInDate: nextIn }
                      const minOut = minCheckoutDatePickerValue(nextIn)
                      if (minOut && checkOutDate && checkOutDate <= nextIn) {
                        patch.checkOutDate = minOut
                      }
                      patchStay(patch)
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Check-in from {formatTime12h(times.checkInTime)}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Departure date *</Label>
                  <Input
                    type="date"
                    min={minCheckoutDatePickerValue(checkInDate)}
                    value={checkOutDate}
                    onChange={(e) => patchStay({ checkOutDate: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Check-out by {formatTime12h(times.checkOutTime)} on this day
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Room *</Label>
                <Select
                  value={selectedRoomId}
                  onValueChange={(value) => patchStay({ selectedRoomId: value })}
                  disabled={!datesValid || roomsLoading}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !datesValid
                          ? 'Select valid check-in and check-out dates'
                          : roomsLoading
                            ? 'Loading available rooms...'
                            : availableRooms.length === 0
                              ? 'No rooms available for these dates'
                              : 'Choose room'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRooms.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        Room {r.roomNumber} — {r.type.name} (৳{r.type.basePrice}/night)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {datesValid && !roomsLoading && (
                  <p className="text-xs text-muted-foreground">
                    {availableRooms.length} room{availableRooms.length === 1 ? '' : 's'} available for this stay
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Adults</Label>
                  <Input
                    type="number"
                    min={1}
                    value={adults}
                    onChange={(e) => patchStay({ adults: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Children</Label>
                  <Input
                    type="number"
                    min={0}
                    value={children}
                    onChange={(e) => patchStay({ children: e.target.value })}
                  />
                </div>
              </div>
              {estimatedRoomCharge() > 0 && (
                <Card className="bg-amber-50 border-amber-200">
                  <CardContent className="p-3 text-sm font-medium text-amber-800">
                    Estimated total: ৳{estimatedTotals().totalWithVat.toLocaleString()}
                    {` (incl. VAT ${effectiveVatPercent()}%)`}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <Card className="border-amber-200 bg-amber-50/40">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-amber-900">VAT</p>
                      <p className="text-xs text-muted-foreground">
                        Applied at {effectiveVatPercent()}%
                        {!vatEditEnabled ? ' (from settings)' : ' (custom rate)'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Edit</span>
                      <span className="text-xs font-medium text-amber-900 min-w-[22px]">
                        {vatEditEnabled ? 'On' : 'Off'}
                      </span>
                      <Switch
                        checked={vatEditEnabled}
                        onCheckedChange={(on) => {
                          patchPayment({
                            vatEditEnabled: on,
                            ...(on && (!vatPercent || vatPercent === '0')
                              ? { vatPercent: String(defaultVatPercent) }
                              : {}),
                          })
                        }}
                      />
                    </div>
                  </div>
                  {vatEditEnabled ? (
                    <div className="space-y-1">
                      <Label className="text-xs">VAT rate (%)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={VAT_PERCENT_INPUT_STEP}
                        value={vatPercent}
                        onChange={(e) => patchPayment({ vatPercent: e.target.value })}
                        className="h-9 bg-card"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Override the default rate for this reservation only.
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      Turn <strong>Edit</strong> on to change the VAT rate for this booking.
                    </p>
                  )}
                </CardContent>
              </Card>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Advance payment (BDT)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={advancePayment}
                    onChange={(e) => patchPayment({ advancePayment: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Form of payment</Label>
                  <Select
                    value={advancePaymentMethod}
                    onValueChange={(value) => patchPayment({ advancePaymentMethod: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHOD_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Shown on the reservation confirmation (print/PDF).
                  </p>
                </div>
              </div>
              <Card className="bg-muted/50">
                <CardContent className="p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Room charge</span>
                    <span>৳{estimatedRoomCharge().toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>VAT ({effectiveVatPercent()}%)</span>
                    <span>৳{estimatedTotals().vatAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total (incl. VAT)</span>
                    <span>৳{estimatedTotals().totalWithVat.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Advance paid</span>
                    <span>৳{(parseFloat(advancePayment) || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Form of payment</span>
                    <span>
                      {(parseFloat(advancePayment) || 0) > 0 && advancePaymentMethod !== 'NONE'
                        ? formatPaymentMethod(advancePaymentMethod)
                        : 'Not paid at booking'}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-2">
                    <span>Due (incl. VAT)</span>
                    <span className="text-red-600">
                      ৳{estimatedTotals().dueAmount.toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={reservationNotes}
                  onChange={(e) => patchPayment({ reservationNotes: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <Card>
              <CardContent className="p-4 space-y-2 text-sm">
                <h3 className="font-semibold">Reservation summary</h3>
                <div className="grid grid-cols-2 gap-2">
                  <span className="text-muted-foreground">Guest</span>
                  <span className="font-medium">
                    {guestName || '—'}
                  </span>
                  <span className="text-muted-foreground">Company</span>
                  <span>{formatGuestCompany(guestCompany)}</span>
                  <span className="text-muted-foreground">Room</span>
                  <span>{availableRooms.find((r) => r.id === selectedRoomId)?.roomNumber}</span>
                  <span className="text-muted-foreground">Check-in</span>
                  <span>{checkInDate ? formatCheckIn(checkInDate) : '—'}</span>
                  <span className="text-muted-foreground">Check-out</span>
                  <span>{checkOutDate ? formatCheckOut(checkOutDate) : '—'}</span>
                  <span className="text-muted-foreground">
                    Total (incl. VAT)
                  </span>
                  <span>৳{estimatedTotals().totalWithVat.toLocaleString()}</span>
                  <span className="text-muted-foreground">
                    Due (incl. VAT)
                  </span>
                  <span className="text-red-600 font-medium">
                    ৳{estimatedTotals().dueAmount.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground">Advance paid</span>
                  <span>৳{(parseFloat(advancePayment) || 0).toLocaleString()}</span>
                  <span className="text-muted-foreground">Form of payment</span>
                  <span>
                    {(parseFloat(advancePayment) || 0) > 0
                      ? formatPaymentMethod(advancePaymentMethod)
                      : 'Not paid at booking'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground pt-2">
                  Use <strong>Confirm reservation</strong> to save as reserved only, or{' '}
                  <strong>Confirm reservation with check-in</strong> to check the guest in immediately
                  (room marked occupied). The confirmation document appears on the next step for print
                  and PDF download.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(Math.max(1, step - 1))}>
                Back
              </Button>
            )}
            {step < 4 ? (
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white ml-auto"
                disabled={step === 1 && !canGoStep2}
                onClick={() => setStep(Math.min(4, step + 1))}
              >
                Next
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="ml-auto"
                  disabled={isSubmitting || createCustomerMutation.isPending}
                  onClick={handleConfirm}
                >
                  {isSubmitting ? 'Please wait...' : 'Confirm reservation'}
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={isSubmitting || createCustomerMutation.isPending}
                  onClick={handleConfirmWithCheckIn}
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Processing...' : 'Confirm reservation with check-in'}
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}


