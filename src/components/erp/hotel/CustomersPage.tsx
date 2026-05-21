'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, Search, Phone, Mail, MapPin } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '../shared/StatusBadge';
import { getPaginationPages } from '@/lib/pagination-pages';
import { cn } from '@/lib/utils';
import { useHotelTimes } from '@/hooks/use-hotel-times';

interface Customer {
  id: string;
  name: string;
  email?: string | null;
  phone: string;
  address?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  notes?: string | null;
  createdAt: string;
}

export function CustomersPage() {
  const { formatCheckIn, formatCheckOut } = useHotelTimes();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formIdType, setFormIdType] = useState('');
  const [formIdNumber, setFormIdNumber] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const buildQuery = () => {
    const params: string[] = [`page=${page}`, `limit=${pageSize}`];
    if (searchQuery) params.push(`search=${encodeURIComponent(searchQuery)}`);
    return `/customers?${params.join('&')}`;
  };

  const { data, isLoading } = useQuery({
    queryKey: ['customers', searchQuery, page, pageSize],
    queryFn: () => api.get<{ success: boolean; data: Customer[]; meta: { total: number; page: number; totalPages: number } }>(buildQuery()),
  });

  const customers = ((data as any)?.data || []) as Customer[];
  const total = (data as any)?.meta?.total || 0;
  const totalPages = Math.max((data as any)?.meta?.totalPages || 1, 1);
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const pageNumbers = getPaginationPages(page, totalPages);

  const { data: customerBookings } = useQuery({
    queryKey: ['customer-bookings', detailCustomer?.id],
    queryFn: () => api.get(`/bookings?customerId=${detailCustomer?.id}&limit=50`),
    enabled: !!detailCustomer?.id,
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/customers', body),
    onSuccess: (res: any) => {
      if (!res?.success) {
        toast.error(res?.error || res?.message || 'Failed to create customer');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      if (res?.message?.includes('already exists')) {
        toast.info(res.message);
      } else {
        toast.success('Customer created successfully');
      }
      closeDialog();
    },
    onError: () => toast.error('Failed to create customer'),
  });

  const updateMutation = useMutation({
    mutationFn: (body: any) => api.put(`/customers/${body.id}`, body),
    onSuccess: (res: any) => {
      if (!res?.success) {
        toast.error(res?.error || res?.message || 'Failed to update customer');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer updated successfully');
      closeDialog();
    },
    onError: () => toast.error('Failed to update customer'),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditCustomer(null);
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setFormIdType('');
    setFormIdNumber('');
    setFormNotes('');
  };

  const openEditDialog = (customer: Customer) => {
    setEditCustomer(customer);
    setFormName(customer.name);
    setFormPhone(customer.phone);
    setFormEmail(customer.email || '');
    setFormAddress(customer.address || '');
    setFormIdType(customer.idType || '');
    setFormIdNumber(customer.idNumber || '');
    setFormNotes(customer.notes || '');
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formName || !formPhone) {
      toast.error('Name and phone are required');
      return;
    }

    const payload = {
      name: formName,
      phone: formPhone,
      email: formEmail || null,
      address: formAddress || null,
      idType: formIdType || null,
      idNumber: formIdNumber || null,
      notes: formNotes || null,
    };

    if (editCustomer) {
      updateMutation.mutate({ id: editCustomer.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Customers</h2>
          <p className="text-sm text-muted-foreground">{total} total customers</p>
        </div>
        <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, or email..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Guests table */}
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
          <div className="max-h-[min(70vh,720px)] overflow-auto custom-scrollbar">
            <table className="bookings-sticky-table w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-3 text-left font-medium">Name</th>
                  <th className="p-3 text-left font-medium">Phone</th>
                  <th className="p-3 text-left font-medium">Address</th>
                  <th className="p-3 text-left font-medium">Added</th>
                  <th className="p-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-background">
                {customers.map((customer) => (
                  <tr key={customer.id} className="border-b border-border/60 hover:bg-muted/40">
                    <td className="p-3">
                      <p className="font-medium">{customer.name}</p>
                      {customer.email && (
                        <p className="text-xs text-muted-foreground">{customer.email}</p>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-muted-foreground shrink-0" />
                        {customer.phone}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground text-xs max-w-[200px] truncate">
                      {customer.address || '—'}
                    </td>
                    <td className="p-3 text-xs">
                      {new Date(customer.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(customer)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDetailCustomer(customer)}>
                          View
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No guests found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {total === 0 ? 'No results' : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
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
                      …
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editCustomer ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Customer name" />
            </div>
            <div className="space-y-2">
              <Label>Phone Number *</Label>
              <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="+880..." />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={formAddress} onChange={(e) => setFormAddress(e.target.value)} placeholder="Address" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ID Type</Label>
                <Select value={formIdType} onValueChange={setFormIdType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passport">Passport</SelectItem>
                    <SelectItem value="national_id">National ID</SelectItem>
                    <SelectItem value="driving_license">Driving License</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>ID Number</Label>
                <Input value={formIdNumber} onChange={(e) => setFormIdNumber(e.target.value)} placeholder="ID Number" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Special notes..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : editCustomer ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Detail Dialog */}
      <Dialog open={!!detailCustomer} onOpenChange={() => setDetailCustomer(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Customer Details</DialogTitle>
          </DialogHeader>
          {detailCustomer && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">{detailCustomer.name}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  {detailCustomer.phone}
                </div>
                {detailCustomer.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    {detailCustomer.email}
                  </div>
                )}
                {detailCustomer.address && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    {detailCustomer.address}
                  </div>
                )}
              </div>
              {detailCustomer.idType && (
                <div className="text-sm">
                  <span className="text-muted-foreground">ID: </span>
                  <span className="font-medium">{detailCustomer.idType} - {detailCustomer.idNumber}</span>
                </div>
              )}

              {/* Booking History */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Booking History</h4>
                <div className="max-h-48 overflow-y-auto custom-scrollbar">
                  {((customerBookings as any)?.data || []).length > 0 ? (
                    <div className="space-y-2">
                      {((customerBookings as any)?.data || []).map((booking: any) => (
                        <div key={booking.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm">
                          <div>
                            <p className="font-medium">Room {booking.room?.roomNumber}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatCheckIn(booking.checkIn)} – {formatCheckOut(booking.checkOut)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">৳{booking.totalRoomCharge}</p>
                            <StatusBadge status={booking.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-3">No bookings yet</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


