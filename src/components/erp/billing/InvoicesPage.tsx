'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAuthStore, canAccessHotel } from '@/lib/auth-store'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import {
  FileText, Plus, Search, Filter, Printer, Eye, RefreshCw, X
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import InvoiceDetail from './InvoiceDetail'
import { useHotelTimes } from '@/hooks/use-hotel-times'

interface InvoiceItem {
  id: string
  itemType: string
  description: string
  quantity: number
  unitPrice: number
  total: number
}

interface Invoice {
  id: string
  invoiceNumber: string
  bookingId: string
  roomCharges: number
  foodCharges: number
  extraCharges: number
  subtotal: number
  discount: number
  vatAmount: number
  totalAmount: number
  paidAmount: number
  dueAmount: number
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'PARTIALLY_PAID' | 'CANCELLED'
  issuedAt: string | null
  paidAt: string | null
  createdAt: string
  booking: {
    id: string
    checkIn: string
    checkOut: string
    status: string
    customer: { id: string; name: string; phone: string; email: string | null }
    room: { id: string; roomNumber: string; type: { name: string } }
  }
  items: InvoiceItem[]
}

interface Booking {
  id: string
  checkIn: string
  checkOut: string
  status: string
  totalRoomCharge: number
  customer: { id: string; name: string }
  room: { id: string; roomNumber: string; type: { name: string; basePrice: number } }
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-muted text-foreground border-border',
  ISSUED: 'bg-sky-50 text-sky-700 border-sky-200',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PARTIALLY_PAID: 'bg-amber-50 text-amber-700 border-amber-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
}

export default function InvoicesPage() {
  const { user } = useAuthStore()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { formatCheckIn, formatCheckOut } = useHotelTimes()

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [selectedBookingId, setSelectedBookingId] = useState<string>('')
  const [showPreview, setShowPreview] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  // Fetch invoices
  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['invoices', statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '20')
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await api.get<{ success: boolean; data: Invoice[]; meta?: { total: number; totalPages: number } }>(`/invoices?${params.toString()}`)
      return res
    },
    enabled: !!user && canAccessHotel(user?.role),
  })

  // Fetch bookings for invoice generation
  const { data: bookingsData } = useQuery({
    queryKey: ['bookings-for-invoice'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Booking[] }>(`/bookings?limit=50&status=CHECKED_IN`)
      return res
    },
    enabled: showGenerateDialog,
  })

  // Also get checked-out bookings
  const { data: checkedOutData } = useQuery({
    queryKey: ['bookings-checked-out'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Booking[] }>(`/bookings?limit=50&status=CHECKED_OUT`)
      return res
    },
    enabled: showGenerateDialog,
  })

  // Generate invoice mutation
  const generateMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      return api.post<{ success: boolean; data: Invoice; message?: string }>('/invoices', { bookingId })
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast({ title: 'Invoice Generated', description: res.message || 'Invoice created successfully' })
      setShowGenerateDialog(false)
      setShowPreview(false)
      setSelectedBookingId('')
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to generate invoice', variant: 'destructive' })
    },
  })

  // Access check
  if (!user || !canAccessHotel(user.role)) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-6 text-center">
          <p className="text-amber-700 font-medium">Access Denied</p>
          <p className="text-amber-600 text-sm mt-1">Only hotel team members and admins can access invoices.</p>
        </CardContent>
      </Card>
    )
  }

  const invoices = invoicesData?.data || []
  const totalPages = invoicesData?.meta?.totalPages || 1
  const allBookings = [
    ...(bookingsData?.data || []),
    ...(checkedOutData?.data || []),
  ]

  const filteredInvoices = invoices.filter((inv) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.booking?.customer?.name?.toLowerCase().includes(q) ||
      inv.booking?.room?.roomNumber?.toLowerCase().includes(q)
    )
  })

  const selectedBooking = allBookings.find((b) => b.id === selectedBookingId)

  const handlePrint = (invoice: Invoice) => {
    window.open(`/invoice/${invoice.id}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-amber-600" />
            Invoices
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Manage hotel billing and invoices</p>
        </div>
        <Button
          onClick={() => setShowGenerateDialog(true)}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Generate Invoice
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by invoice #, guest name, room..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="ISSUED">Issued</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['invoices'] })}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead className="text-right">Room Charges</TableHead>
                  <TableHead className="text-right">Food Charges</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 10 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      No invoices found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id} className="hover:bg-muted">
                      <TableCell className="font-mono text-sm font-medium">
                        {invoice.invoiceNumber}
                      </TableCell>
                      <TableCell>{invoice.booking?.customer?.name || 'N/A'}</TableCell>
                      <TableCell className="font-mono">{invoice.booking?.room?.roomNumber || 'N/A'}</TableCell>
                      <TableCell className="text-right">
                        ৳{invoice.roomCharges.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        ৳{invoice.foodCharges.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ৳{invoice.totalAmount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-emerald-600">
                        ৳{invoice.paidAmount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={invoice.dueAmount > 0 ? 'text-red-600 font-semibold' : 'text-emerald-600'}>
                          ৳{invoice.dueAmount.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColors[invoice.status] || ''}>
                          {invoice.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedInvoice(invoice)}
                            title="View Detail"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handlePrint(invoice)}
                            title="Print"
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Generate Invoice Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {showPreview ? 'Invoice Preview' : 'Generate Invoice'}
            </DialogTitle>
          </DialogHeader>

          {!showPreview ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Select Booking
                </label>
                <Select value={selectedBookingId} onValueChange={setSelectedBookingId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a checked-in or checked-out booking" />
                  </SelectTrigger>
                  <SelectContent>
                    {allBookings.map((booking) => (
                      <SelectItem key={booking.id} value={booking.id}>
                        {booking.customer?.name} - Room {booking.room?.roomNumber} ({booking.status}) -
                        ৳{booking.totalRoomCharge.toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedBooking && (
                <Card className="bg-muted">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Guest:</span>
                      <span className="font-medium">{selectedBooking.customer?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Room:</span>
                      <span className="font-medium">{selectedBooking.room?.roomNumber} - {selectedBooking.room?.type?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Check-in:</span>
                      <span className="font-medium">{formatCheckIn(selectedBooking.checkIn)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Check-out:</span>
                      <span className="font-medium">{formatCheckOut(selectedBooking.checkOut)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Room Charges:</span>
                      <span className="font-semibold">৳{selectedBooking.totalRoomCharge.toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      * Food charges and extra services will be auto-calculated from linked orders and room charges.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Review the invoice before generating:</p>
              {selectedBooking && (
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-amber-800 mb-2">Invoice Preview</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Guest:</span>
                        <span className="font-medium">{selectedBooking.customer?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Room:</span>
                        <span className="font-medium">{selectedBooking.room?.roomNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Room Charges:</span>
                        <span>৳{selectedBooking.totalRoomCharge.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Food & Extra Charges:</span>
                        <span className="text-muted-foreground">Auto-calculated</span>
                      </div>
                      <hr className="my-2 border-amber-200" />
                      <p className="text-xs text-amber-600">
                        VAT (15%) and discounts will be applied automatically based on system settings.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <DialogFooter>
            {!showPreview ? (
              <>
                <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
                  <X className="h-4 w-4 mr-2" /> Cancel
                </Button>
                <Button
                  onClick={() => setShowPreview(true)}
                  disabled={!selectedBookingId}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  Preview Invoice
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowPreview(false)}>
                  Back
                </Button>
                <Button
                  onClick={() => generateMutation.mutate(selectedBookingId)}
                  disabled={generateMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {generateMutation.isPending ? 'Generating...' : 'Generate Invoice'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Detail Dialog */}
      <Dialog open={!!selectedInvoice && !showGenerateDialog} onOpenChange={(open) => { if (!open) setSelectedInvoice(null) }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">
              {selectedInvoice
                ? `Invoice ${selectedInvoice.invoiceNumber}`
                : 'Invoice details'}
            </DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <InvoiceDetail
              invoiceId={selectedInvoice.id}
              onClose={() => setSelectedInvoice(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
