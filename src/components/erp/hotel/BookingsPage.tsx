'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { StatusBadge } from '../shared/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Plus, Search, LogIn, LogOut, XCircle, Receipt, FileText, CalendarRange } from 'lucide-react';
import { AdjustStayDialog } from './AdjustStayDialog';
import { openNewReservationTab } from '@/lib/reservation-navigation';
import { openCheckoutTab } from '@/lib/checkout-navigation';
import { formatBdt } from '@/lib/currency';
import { getPaginationPages } from '@/lib/pagination-pages';
import { cn } from '@/lib/utils';
import { PAYMENT_METHOD_OPTIONS_WITH_PAYMENT } from '@/lib/payment-method';
import { computeRefundFromInput } from '@/lib/booking-totals';
import { Switch } from '@/components/ui/switch';
import { useHotelTimes } from '@/hooks/use-hotel-times';

interface Booking {
  id: string;
  customerId: string;
  roomId: string;
  status: 'RESERVED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';
  checkIn: string;
  checkOut: string;
  actualCheckIn?: string | null;
  actualCheckOut?: string | null;
  adults: number;
  children: number;
  totalRoomCharge: number;
  advancePayment: number;
  initialPayment?: number;
  dueAmount: number;
  vatPercent?: number;
  vatAmount?: number;
  totalWithVat?: number;
  notes?: string | null;
  customer: { id: string; name: string; phone: string; email?: string };
  room: { id: string; roomNumber: string; type: { name: string; basePrice: number } };
}

interface CancelPreview {
  bookingId: string;
  customerName: string;
  roomNumber: string;
  status: string;
  checkIn?: string;
  checkOut?: string;
  bookedNights?: number;
  maxRefundable: number;
  totalWithVat: number;
  dueAmount: number;
}

export function BookingsPage() {
  const queryClient = useQueryClient();
  const { formatCheckIn, formatCheckOut } = useHotelTimes();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // Check-in dialog state
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false);
  const [checkInBookingId, setCheckInBookingId] = useState<string | null>(null);
  const [checkInPayment, setCheckInPayment] = useState('0');
  const [checkInPaymentMethod, setCheckInPaymentMethod] = useState('CASH');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);
  const [refundEnabled, setRefundEnabled] = useState(false);
  const [refundMode, setRefundMode] = useState<'percent' | 'amount'>('percent');
  const [refundPercent, setRefundPercent] = useState('100');
  const [refundAmount, setRefundAmount] = useState('0');
  const [refundMethod, setRefundMethod] = useState('CASH');
  const [cancelReason, setCancelReason] = useState('');
  const [adjustStayDialogOpen, setAdjustStayDialogOpen] = useState(false);
  const [adjustStayBookingId, setAdjustStayBookingId] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const buildQuery = () => {
    const params: string[] = [`page=${page}`, `limit=${pageSize}`];
    if (statusFilter !== 'all') params.push(`status=${statusFilter}`);
    if (searchQuery) params.push(`search=${encodeURIComponent(searchQuery)}`);
    return `/bookings?${params.join('&')}`;
  };

  const { data: bookingsData, isLoading } = useQuery({
    queryKey: ['bookings', statusFilter, page, pageSize, searchQuery],
    queryFn: () => api.get<{ success: boolean; data: Booking[]; meta: { total: number; page: number; totalPages: number } }>(buildQuery()),
  });

  const { data: cancelPreviewData, isLoading: cancelPreviewLoading } = useQuery({
    queryKey: ['cancel-preview', cancelBookingId],
    queryFn: () =>
      api.get<{ success: boolean; data: CancelPreview }>(`/bookings/cancel/${cancelBookingId}`),
    enabled: !!cancelBookingId && cancelDialogOpen,
  });

  const bookings = ((bookingsData as any)?.data || []) as Booking[];
  const totalBookings = (bookingsData as any)?.meta?.total || 0;
  const totalPages = Math.max((bookingsData as any)?.meta?.totalPages || 1, 1);
  const rangeStart = totalBookings === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalBookings);
  const pageNumbers = getPaginationPages(page, totalPages);

  const checkInMutation = useMutation({
    mutationFn: ({ id, initialPayment, paymentMethod }: { id: string; initialPayment: number; paymentMethod: string }) =>
      api.post(`/bookings/check-in/${id}`, { initialPayment, paymentMethod }),
    onSuccess: (res: any) => {
      if (!res?.success) {
        toast.error(res?.error || res?.message || 'Failed to check in');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['available-rooms'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast.success('Guest checked in successfully');
      setCheckInDialogOpen(false);
      setCheckInBookingId(null);
      setCheckInPayment('0');
      setCheckInPaymentMethod('CASH');
    },
    onError: () => toast.error('Failed to check in'),
  });

  const cancelMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      refundEnabled: boolean;
      refundMode: 'percent' | 'amount';
      refundPercent: number;
      refundAmount: number;
      refundMethod: string;
      reason?: string;
    }) =>
      api.post(`/bookings/cancel/${payload.id}`, {
        refundEnabled: payload.refundEnabled,
        refundMode: payload.refundMode,
        refundPercent: payload.refundPercent,
        refundAmount: payload.refundAmount,
        refundMethod: payload.refundMethod,
        reason: payload.reason,
      }),
    onSuccess: (res: any) => {
      if (!res?.success) {
        toast.error(res?.error || res?.message || 'Failed to cancel reservation');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['available-rooms'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success(res.message || 'Reservation cancelled');
      setCancelDialogOpen(false);
      setCancelBookingId(null);
      setRefundEnabled(false);
      setRefundMode('percent');
      setRefundPercent('100');
      setRefundAmount('0');
      setRefundMethod('CASH');
      setCancelReason('');
    },
    onError: () => toast.error('Failed to cancel reservation'),
  });

  const generateInvoiceMutation = useMutation({
    mutationFn: (bookingId: string) => api.post('/invoices', { bookingId }),
    onSuccess: (res: any) => {
      if (!res?.success) {
        toast.error(res?.error || res?.message || 'Failed to generate invoice');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      const invoiceId = res?.data?.id;
      if (invoiceId) {
        window.open(`/invoice/${invoiceId}`, '_blank', 'noopener,noreferrer');
      }
      toast.success('Invoice generated successfully');
    },
    onError: () => toast.error('Failed to generate invoice'),
  });

  const cancelPreview = (cancelPreviewData as any)?.data as CancelPreview | undefined;
  const maxRefundable = cancelPreview?.maxRefundable ?? 0;
  const computedRefundTotal = useMemo(() => {
    if (!refundEnabled || maxRefundable <= 0) return 0;
    return computeRefundFromInput(
      maxRefundable,
      refundMode,
      parseFloat(refundPercent) || 0,
      parseFloat(refundAmount) || 0
    );
  }, [refundEnabled, maxRefundable, refundMode, refundPercent, refundAmount]);

  const openCancelDialog = (bookingId: string) => {
    setCancelBookingId(bookingId);
    setRefundEnabled(false);
    setRefundMode('percent');
    setRefundPercent('100');
    setRefundAmount('0');
    setRefundMethod('CASH');
    setCancelReason('');
    setCancelDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Reservations</h2>
          <p className="text-sm text-muted-foreground">{totalBookings} total reservations</p>
        </div>
        <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={openNewReservationTab}>
          <Plus className="w-4 h-4 mr-2" />
          New Reservation
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search guest, phone, or room..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="RESERVED">Reserved</SelectItem>
            <SelectItem value="CHECKED_IN">Checked In</SelectItem>
            <SelectItem value="CHECKED_OUT">Checked Out</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bookings Table */}
      {isLoading ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            {Array.from({ length: pageSize }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
            <table className="bookings-sticky-table w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-3 text-left font-medium">Guest</th>
                  <th className="p-3 text-left font-medium">Room</th>
                  <th className="p-3 text-left font-medium">Check-in</th>
                  <th className="p-3 text-left font-medium">Check-out</th>
                  <th className="p-3 text-left font-medium">Status</th>
                  <th className="p-3 text-right font-medium">Total (incl. VAT)</th>
                  <th className="p-3 text-right font-medium">Due (incl. VAT)</th>
                  <th className="p-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-background">
              {bookings.map((booking) => (
                <tr key={booking.id} className="border-b border-border/60 hover:bg-muted/40">
                  <td className="p-3">
                    <div>
                      <p className="font-medium">{booking.customer?.name}</p>
                      <p className="text-xs text-muted-foreground">{booking.customer?.phone}</p>
                    </div>
                  </td>
                  <td className="p-3">
                    <div>
                      <p className="font-medium">{booking.room?.roomNumber}</p>
                      <p className="text-xs text-muted-foreground">{booking.room?.type?.name}</p>
                    </div>
                  </td>
                  <td className="p-3 text-xs">{formatCheckIn(booking.checkIn)}</td>
                  <td className="p-3 text-xs">{formatCheckOut(booking.checkOut)}</td>
                  <td className="p-3"><StatusBadge status={booking.status} /></td>
                  <td className="p-3 text-right">
                    <p className="font-medium">
                      {formatBdt(booking.totalWithVat ?? booking.totalRoomCharge)}
                    </p>
                    {booking.vatAmount != null && booking.vatPercent != null && (
                      <p className="text-[10px] text-muted-foreground">
                        VAT {booking.vatPercent}%: {formatBdt(booking.vatAmount)}
                      </p>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <span className={booking.dueAmount > 0 ? 'text-red-600 font-medium' : 'text-emerald-600'}>
                      {formatBdt(booking.dueAmount)}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      {booking.status === 'RESERVED' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => {
                            setCheckInBookingId(booking.id);
                            setCheckInPayment('0');
                            setCheckInPaymentMethod('CASH');
                            setCheckInDialogOpen(true);
                          }}
                          disabled={checkInMutation.isPending}
                        >
                          <LogIn className="w-3 h-3 mr-1" />
                          Check-in
                        </Button>
                      )}
                      {booking.status === 'CHECKED_IN' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs border-border text-muted-foreground hover:bg-muted"
                            onClick={() => openCheckoutTab(booking.id)}
                          >
                            <LogOut className="w-3 h-3 mr-1" />
                            Check-out
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs border-amber-500 text-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                            onClick={() => {
                              setAdjustStayBookingId(booking.id);
                              setAdjustStayDialogOpen(true);
                            }}
                            title="Adjust nights, early checkout fee, and room due"
                          >
                            <CalendarRange className="w-3 h-3 mr-1" />
                            Adjust stay
                          </Button>
                        </>
                      )}
                      {booking.status === 'RESERVED' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-red-500 hover:text-red-600"
                          onClick={() => openCancelDialog(booking.id)}
                          disabled={cancelMutation.isPending}
                          title="Cancel reservation"
                        >
                          <XCircle className="w-3 h-3" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs border-sky-500 text-sky-700 hover:bg-sky-50"
                        onClick={() => window.open(`/reservation/${booking.id}`, '_blank', 'noopener,noreferrer')}
                        title="Print / download reservation PDF"
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        Reservation
                      </Button>
                      {(booking.status === 'CHECKED_OUT' || booking.status === 'CHECKED_IN') && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs border-amber-500 text-amber-700 hover:bg-amber-50"
                          onClick={() => generateInvoiceMutation.mutate(booking.id)}
                          disabled={generateInvoiceMutation.isPending}
                        >
                          <Receipt className="w-3 h-3 mr-1" />
                          Invoice
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">No reservations found</td>
                </tr>
              )}
              </tbody>
            </table>
          <div className="flex flex-col gap-3 border-t bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {totalBookings === 0
                ? 'No results'
                : `Showing ${rangeStart}â€“${rangeEnd} of ${totalBookings}`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 / page</SelectItem>
                  <SelectItem value="20">20 / page</SelectItem>
                  <SelectItem value="50">50 / page</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <div className="flex flex-wrap items-center gap-1">
                {pageNumbers.map((item, index) =>
                  item === 'ellipsis' ? (
                    <span
                      key={`ellipsis-${index}`}
                      className="flex h-8 min-w-8 items-center justify-center px-1 text-sm text-muted-foreground"
                    >
                      â€¦
                    </span>
                  ) : (
                    <Button
                      key={item}
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(
                        'h-8 min-w-8 px-2',
                        item === page &&
                          'border-amber-600 bg-amber-600 text-white hover:bg-amber-700 hover:text-white'
                      )}
                      onClick={() => setPage(item)}
                      aria-current={item === page ? 'page' : undefined}
                    >
                      {item}
                    </Button>
                  )
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Check-in Payment Dialog */}
      <Dialog open={checkInDialogOpen} onOpenChange={setCheckInDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogIn className="h-5 w-5 text-emerald-600" />
              Check-in Guest
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Card className="bg-muted/50">
              <CardContent className="p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Room charge</span>
                  <span className="font-medium">{formatBdt((() => {
                    const b = bookings.find(bk => bk.id === checkInBookingId);
                    return b ? b.totalRoomCharge : 0;
                  })())}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    VAT ({(() => {
                      const b = bookings.find(bk => bk.id === checkInBookingId);
                      return b?.vatPercent ?? 15;
                    })()}%)
                  </span>
                  <span className="font-medium">{formatBdt((() => {
                    const b = bookings.find(bk => bk.id === checkInBookingId);
                    return b?.vatAmount ?? 0;
                  })())}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total (incl. VAT)</span>
                  <span className="font-medium">{formatBdt((() => {
                    const b = bookings.find(bk => bk.id === checkInBookingId);
                    return b?.totalWithVat ?? b?.totalRoomCharge ?? 0;
                  })())}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Advance paid</span>
                  <span className="font-medium">{formatBdt((() => {
                    const b = bookings.find(bk => bk.id === checkInBookingId);
                    return b ? b.advancePayment : 0;
                  })())}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t pt-1">
                  <span>Current due (incl. VAT)</span>
                  <span className="text-red-600">{formatBdt((() => {
                    const b = bookings.find(bk => bk.id === checkInBookingId);
                    return b ? b.dueAmount : 0;
                  })())}</span>
                </div>
              </CardContent>
            </Card>
            <div className="space-y-2">
              <Label>Initial Payment at Check-in (BDT)</Label>
              <Input
                type="number"
                value={checkInPayment}
                onChange={(e) => setCheckInPayment(e.target.value)}
                placeholder="0"
                min="0"
              />
              <p className="text-xs text-muted-foreground">
                Remaining due after payment: {formatBdt((() => {
                  const b = bookings.find(bk => bk.id === checkInBookingId);
                  const due = b ? b.dueAmount - (parseFloat(checkInPayment) || 0) : 0;
                  return Math.max(due, 0);
                })())}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={checkInPaymentMethod} onValueChange={setCheckInPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckInDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={checkInMutation.isPending}
              onClick={() => {
                if (!checkInBookingId) return;
                checkInMutation.mutate({
                  id: checkInBookingId,
                  initialPayment: parseFloat(checkInPayment) || 0,
                  paymentMethod: checkInPaymentMethod,
                });
              }}
            >
              {checkInMutation.isPending ? 'Checking in...' : 'Confirm Check-in'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdjustStayDialog
        bookingId={adjustStayBookingId}
        open={adjustStayDialogOpen}
        onOpenChange={(open) => {
          setAdjustStayDialogOpen(open);
          if (!open) setAdjustStayBookingId(null);
        }}
      />

      {/* Cancel reservation */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Cancel reservation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {cancelPreviewLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : cancelPreview ? (
              <Card className="bg-muted/50 border-border">
                <CardContent className="p-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Guest</span>
                    <span className="font-medium">{cancelPreview.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Room</span>
                    <span className="font-medium">{cancelPreview.roomNumber}</span>
                  </div>
                  {cancelPreview.bookedNights != null && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Reserved nights</span>
                        <span className="font-medium">{cancelPreview.bookedNights} night(s)</span>
                      </div>
                      {cancelPreview.checkIn && cancelPreview.checkOut && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Reservation dates</span>
                          <span className="font-medium text-right text-xs">
                            {formatCheckIn(cancelPreview.checkIn)} â†’{' '}
                            {formatCheckOut(cancelPreview.checkOut)}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Paid (refundable)</span>
                    <span className="font-medium text-emerald-700">
                      {formatBdt(cancelPreview.maxRefundable)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="cancel-reason">Reason (optional)</Label>
              <Textarea
                id="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Why is this reservation being cancelled?"
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Issue refund</p>
                <p className="text-xs text-muted-foreground">
                  Off by default â€” no refund unless you turn this on
                </p>
              </div>
              <Switch
                checked={refundEnabled}
                onCheckedChange={(checked) => {
                  setRefundEnabled(checked);
                  if (checked && maxRefundable > 0) {
                    setRefundAmount(String(maxRefundable));
                  }
                }}
                disabled={maxRefundable <= 0}
              />
            </div>

            {refundEnabled && maxRefundable > 0 && (
              <div className="space-y-3 rounded-lg border border-amber-200/60 bg-amber-50/40 dark:bg-amber-950/20 p-3">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={refundMode === 'percent' ? 'default' : 'outline'}
                    className={refundMode === 'percent' ? 'bg-amber-600 hover:bg-amber-700' : ''}
                    onClick={() => setRefundMode('percent')}
                  >
                    By %
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={refundMode === 'amount' ? 'default' : 'outline'}
                    className={refundMode === 'amount' ? 'bg-amber-600 hover:bg-amber-700' : ''}
                    onClick={() => setRefundMode('amount')}
                  >
                    By amount
                  </Button>
                </div>

                {refundMode === 'percent' ? (
                  <div className="space-y-2">
                    <Label htmlFor="refund-percent">Refund percentage</Label>
                    <Input
                      id="refund-percent"
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={refundPercent}
                      onChange={(e) => setRefundPercent(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="refund-amount">Refund amount (BDT)</Label>
                    <Input
                      id="refund-amount"
                      type="number"
                      min={0}
                      max={maxRefundable}
                      step={0.01}
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum: {formatBdt(maxRefundable)}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Refund method</Label>
                  <Select value={refundMethod} onValueChange={setRefundMethod}>
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

                <p className="text-sm font-semibold text-foreground border-t border-border pt-2">
                  Refund total:{' '}
                  <span className="text-amber-700">{formatBdt(computedRefundTotal)}</span>
                </p>
              </div>
            )}

            {refundEnabled && maxRefundable <= 0 && (
              <p className="text-xs text-muted-foreground">
                No payments on this reservation â€” refund is not available.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Keep reservation
            </Button>
            <Button
              variant="destructive"
              disabled={cancelMutation.isPending || !cancelBookingId}
              onClick={() => {
                if (!cancelBookingId) return;
                if (refundEnabled && computedRefundTotal <= 0) {
                  toast.error('Enter a valid refund amount or turn off refund.');
                  return;
                }
                cancelMutation.mutate({
                  id: cancelBookingId,
                  refundEnabled,
                  refundMode,
                  refundPercent: parseFloat(refundPercent) || 0,
                  refundAmount: parseFloat(refundAmount) || 0,
                  refundMethod,
                  reason: cancelReason.trim() || undefined,
                });
              }}
            >
              {cancelMutation.isPending ? 'Cancellingâ€¦' : 'Confirm cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
