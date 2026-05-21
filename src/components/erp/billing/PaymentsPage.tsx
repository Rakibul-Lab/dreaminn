'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAuthStore, canAccessHotel, canAccessRestaurant, canAccessAdmin } from '@/lib/auth-store'
import { useToast } from '@/hooks/use-toast'
import { format, startOfDay, startOfWeek, startOfMonth, isToday } from 'date-fns'
import {
  CreditCard, Plus, Search, Filter, RefreshCw, Wallet, TrendingUp, Calendar
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'

interface Payment {
  id: string
  amount: number
  method: string
  paymentType: string
  bookingId: string | null
  orderId: string | null
  reference: string | null
  notes: string | null
  createdAt: string
  booking: {
    id: string
    customer: { id: string; name: string }
    room: { id: string; roomNumber: string }
  } | null
  order: {
    id: string
    orderNumber: string
    orderType: string
  } | null
  receiver: { id: string; name: string }
}

interface Booking {
  id: string
  checkIn: string
  checkOut: string
  customer: { id: string; name: string }
  room: { id: string; roomNumber: string; type: { name: string } }
}

interface RestaurantOrder {
  id: string
  orderNumber: string
  orderType: string
  totalAmount: number
}

const paymentTypeColors: Record<string, string> = {
  ADVANCE: 'bg-amber-50 text-amber-700 border-amber-200',
  INITIAL: 'bg-sky-50 text-sky-700 border-sky-200',
  FINAL: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PARTIAL: 'bg-orange-50 text-orange-700 border-orange-200',
  RESTAURANT: 'bg-purple-50 text-purple-700 border-purple-200',
  REFUND: 'bg-red-50 text-red-700 border-red-200',
}

export default function PaymentsPage() {
  const { user } = useAuthStore()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>('all')
  const [methodFilter, setMethodFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [showNewPaymentDialog, setShowNewPaymentDialog] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    paymentType: 'PARTIAL',
    bookingId: '',
    orderId: '',
    amount: '',
    method: 'CASH',
    reference: '',
    notes: '',
  })

  // Determine payment types available based on role
  const isHotel = canAccessHotel(user?.role) && !canAccessRestaurant(user?.role)
  const isRestaurant = canAccessRestaurant(user?.role) && !canAccessHotel(user?.role)
  const isAdmin = canAccessAdmin(user?.role)

  // Fetch payments
  const { data: paymentsData, isLoading } = useQuery({
    queryKey: ['payments', paymentTypeFilter, methodFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '20')
      if (paymentTypeFilter !== 'all') params.set('paymentType', paymentTypeFilter)
      if (methodFilter !== 'all') params.set('method', methodFilter)
      const res = await api.get<{ success: boolean; data: Payment[]; meta?: { total: number; totalPages: number } }>(`/payments?${params.toString()}`)
      return res
    },
    enabled: !!user,
  })

  // Fetch bookings for payment dialog
  const { data: bookingsData } = useQuery({
    queryKey: ['bookings-for-payment'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Booking[] }>('/bookings?limit=50&status=CHECKED_IN')
      return res
    },
    enabled: showNewPaymentDialog && (isHotel || isAdmin),
  })

  // Fetch restaurant orders for payment dialog
  const { data: ordersData } = useQuery({
    queryKey: ['orders-for-payment'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: RestaurantOrder[] }>('/restaurant-orders?limit=50&status=DELIVERED')
      return res
    },
    enabled: showNewPaymentDialog && (isRestaurant || isAdmin),
  })

  // Create payment mutation
  const createPaymentMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        amount: parseFloat(paymentForm.amount),
        method: paymentForm.method,
        paymentType: paymentForm.paymentType,
        reference: paymentForm.reference || null,
        notes: paymentForm.notes || null,
      }
      if (paymentForm.bookingId) payload.bookingId = paymentForm.bookingId
      if (paymentForm.orderId) payload.orderId = paymentForm.orderId
      return api.post('/payments', payload)
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      toast({ title: 'Payment Recorded', description: res.message || 'Payment recorded successfully' })
      setShowNewPaymentDialog(false)
      setPaymentForm({ paymentType: 'PARTIAL', bookingId: '', orderId: '', amount: '', method: 'CASH', reference: '', notes: '' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to record payment', variant: 'destructive' })
    },
  })

  const payments = paymentsData?.data || []
  const totalPages = paymentsData?.meta?.totalPages || 1

  // Calculate summary
  const todayPayments = payments.filter((p) => isToday(new Date(p.createdAt)))
  const todayTotal = todayPayments.reduce((sum, p) => sum + p.amount, 0)

  const weekStart = startOfWeek(new Date())
  const monthStart = startOfMonth(new Date())
  const weekPayments = payments.filter((p) => new Date(p.createdAt) >= weekStart)
  const monthPayments = payments.filter((p) => new Date(p.createdAt) >= monthStart)
  const weekTotal = weekPayments.reduce((sum, p) => sum + p.amount, 0)
  const monthTotal = monthPayments.reduce((sum, p) => sum + p.amount, 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-amber-600" />
            Payments
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {isHotel ? 'Hotel payments' : isRestaurant ? 'Restaurant payments' : 'All payment records'}
          </p>
        </div>
        <Button
          onClick={() => setShowNewPaymentDialog(true)}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Record Payment
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-emerald-50">
              <Wallet className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Today</p>
              <p className="text-xl font-bold text-foreground">৳{todayTotal.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-amber-50">
              <Calendar className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">This Week</p>
              <p className="text-xl font-bold text-foreground">৳{weekTotal.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-sky-50">
              <TrendingUp className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">This Month</p>
              <p className="text-xl font-bold text-foreground">৳{monthTotal.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={paymentTypeFilter} onValueChange={setPaymentTypeFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Payment type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="ADVANCE">Advance</SelectItem>
                <SelectItem value="INITIAL">Initial</SelectItem>
                <SelectItem value="FINAL">Final</SelectItem>
                <SelectItem value="PARTIAL">Partial</SelectItem>
                {(isRestaurant || isAdmin) && <SelectItem value="RESTAURANT">Restaurant</SelectItem>}
              </SelectContent>
            </Select>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="CARD">Card</SelectItem>
                <SelectItem value="MOBILE_BANKING">Mobile Banking</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['payments'] })}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead>Received By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No payments found
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((payment) => (
                    <TableRow key={payment.id} className="hover:bg-muted">
                      <TableCell className="text-sm">
                        {format(new Date(payment.createdAt), 'MMM dd, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={paymentTypeColors[payment.paymentType] || ''}>
                          {payment.paymentType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{payment.method.replace('_', ' ')}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">
                        ৳{payment.amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{payment.reference || '-'}</TableCell>
                      <TableCell className="text-sm">
                        {payment.booking ? (
                          <span>Room {payment.booking.room?.roomNumber} - {payment.booking.customer?.name}</span>
                        ) : payment.order ? (
                          <span>{payment.order.orderNumber} ({payment.order.orderType})</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{payment.receiver?.name || 'N/A'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            Previous
          </Button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            Next
          </Button>
        </div>
      )}

      {/* New Payment Dialog */}
      <Dialog open={showNewPaymentDialog} onOpenChange={setShowNewPaymentDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record New Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Payment Type</Label>
              <Select value={paymentForm.paymentType} onValueChange={(v) => setPaymentForm((f) => ({ ...f, paymentType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(isHotel || isAdmin) && (
                    <>
                      <SelectItem value="ADVANCE">Advance</SelectItem>
                      <SelectItem value="INITIAL">Initial</SelectItem>
                      <SelectItem value="FINAL">Final</SelectItem>
                      <SelectItem value="PARTIAL">Partial</SelectItem>
                    </>
                  )}
                  {(isRestaurant || isAdmin) && <SelectItem value="RESTAURANT">Restaurant</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            {/* Show booking selector for hotel payments */}
            {(isHotel || isAdmin) && !['RESTAURANT'].includes(paymentForm.paymentType) && (
              <div>
                <Label>Select Booking (Hotel)</Label>
                <Select value={paymentForm.bookingId} onValueChange={(v) => setPaymentForm((f) => ({ ...f, bookingId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Choose a booking" /></SelectTrigger>
                  <SelectContent>
                    {bookingsData?.data?.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.customer?.name} - Room {b.room?.roomNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Show order selector for restaurant payments */}
            {(isRestaurant || isAdmin) && paymentForm.paymentType === 'RESTAURANT' && (
              <div>
                <Label>Select Order (Restaurant)</Label>
                <Select value={paymentForm.orderId} onValueChange={(v) => setPaymentForm((f) => ({ ...f, orderId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Choose an order" /></SelectTrigger>
                  <SelectContent>
                    {ordersData?.data?.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.orderNumber} - ৳{o.totalAmount.toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Amount (৳)</Label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>

            <div>
              <Label>Payment Method</Label>
              <Select value={paymentForm.method} onValueChange={(v) => setPaymentForm((f) => ({ ...f, method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="CARD">Card</SelectItem>
                  <SelectItem value="MOBILE_BANKING">Mobile Banking</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Reference (optional)</Label>
              <Input
                placeholder="Transaction reference"
                value={paymentForm.reference}
                onChange={(e) => setPaymentForm((f) => ({ ...f, reference: e.target.value }))}
              />
            </div>

            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Payment notes"
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewPaymentDialog(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={!paymentForm.amount || parseFloat(paymentForm.amount) <= 0 || createPaymentMutation.isPending}
              onClick={() => createPaymentMutation.mutate()}
            >
              {createPaymentMutation.isPending ? 'Recording...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
