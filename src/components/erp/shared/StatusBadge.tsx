'use client';

import { Badge } from '@/components/ui/badge';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
  // Room statuses
  AVAILABLE: { label: 'Available', variant: 'outline', className: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50' },
  OCCUPIED: { label: 'Occupied', variant: 'outline', className: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-50' },
  CLEANING: { label: 'Cleaning', variant: 'outline', className: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50' },
  MAINTENANCE: { label: 'Maintenance', variant: 'outline', className: 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-50' },

  // Booking statuses
  RESERVED: { label: 'Reserved', variant: 'outline', className: 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-50' },
  CHECKED_IN: { label: 'Checked In', variant: 'outline', className: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50' },
  CHECKED_OUT: { label: 'Checked Out', variant: 'outline', className: 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-50' },
  CANCELLED: { label: 'Cancelled', variant: 'destructive', className: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-50' },

  // Order statuses
  PENDING: { label: 'Pending', variant: 'outline', className: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50' },
  COOKING: { label: 'Cooking', variant: 'outline', className: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-50' },
  READY: { label: 'Ready', variant: 'outline', className: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50' },
  DELIVERED: { label: 'Delivered', variant: 'outline', className: 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-50' },

  // Housekeeping statuses
  IN_PROGRESS: { label: 'In Progress', variant: 'outline', className: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50' },
  COMPLETED: { label: 'Completed', variant: 'outline', className: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50' },

  // Invoice statuses
  DRAFT: { label: 'Draft', variant: 'outline', className: 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-50' },
  ISSUED: { label: 'Issued', variant: 'outline', className: 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-50' },
  PAID: { label: 'Paid', variant: 'outline', className: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50' },
  PARTIALLY_PAID: { label: 'Partially Paid', variant: 'outline', className: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50' },

  // Table statuses
  available: { label: 'Available', variant: 'outline', className: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50' },
  occupied: { label: 'Occupied', variant: 'outline', className: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-50' },
  reserved: { label: 'Reserved', variant: 'outline', className: 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-50' },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config = statusConfig[status];

  if (!config) {
    return (
      <Badge variant="outline" className={className}>
        {status}
      </Badge>
    );
  }

  return (
    <Badge variant={config.variant} className={`${config.className} ${className}`}>
      {config.label}
    </Badge>
  );
}
