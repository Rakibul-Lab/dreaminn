'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { toast } from 'sonner'
import {
  Plus,
  UtensilsCrossed,
  Users,
  MapPin,
  ChefHat,
  Armchair,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Types
interface RestaurantTable {
  id: string
  tableNumber: string
  capacity: number
  status: string // available, occupied, reserved
  location: string | null // indoor, outdoor, vip
  createdAt: string
  updatedAt: string
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string; icon: typeof Armchair }> = {
  available: {
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-300',
    label: 'Available',
    icon: Armchair,
  },
  occupied: {
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-300',
    label: 'Occupied',
    icon: Armchair,
  },
  reserved: {
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    label: 'Reserved',
    icon: Armchair,
  },
}

const LOCATION_CONFIG: Record<string, { label: string; icon: typeof MapPin }> = {
  indoor: { label: 'Indoor', icon: MapPin },
  outdoor: { label: 'Outdoor', icon: MapPin },
  vip: { label: 'VIP', icon: MapPin },
}

const STATUS_FLOW: Record<string, string[]> = {
  available: ['occupied', 'reserved'],
  occupied: ['available'],
  reserved: ['available', 'occupied'],
}

interface TableFormData {
  tableNumber: string
  capacity: number
  status: string
  location: string
}

const defaultTableForm: TableFormData = {
  tableNumber: '',
  capacity: 4,
  status: 'available',
  location: '',
}

export default function TablesPage() {
  const queryClient = useQueryClient()
  const [filterLocation, setFilterLocation] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null)
  const [tableForm, setTableForm] = useState<TableFormData>(defaultTableForm)

  // Fetch tables
  const { data: tablesData, isLoading } = useQuery({
    queryKey: ['restaurant-tables', filterLocation],
    queryFn: () => {
      const params = new URLSearchParams()
      if (filterLocation !== 'all') {
        // Client-side filter since API only supports status filter
      }
      return api.get<{ success: boolean; data: RestaurantTable[] }>('/restaurant-tables')
    },
    refetchInterval: 15000,
  })
  const tables = tablesData?.data || []

  // Filter by location
  const filteredTables = filterLocation === 'all'
    ? tables
    : tables.filter((t) => t.location === filterLocation)

  // Stats
  const availableCount = tables.filter((t) => t.status === 'available').length
  const occupiedCount = tables.filter((t) => t.status === 'occupied').length
  const reservedCount = tables.filter((t) => t.status === 'reserved').length

  // Create table mutation
  const createTableMutation = useMutation({
    mutationFn: (data: TableFormData) =>
      api.post('/restaurant-tables', {
        ...data,
        location: data.location || null,
      }),
    onSuccess: () => {
      toast.success('Table created')
      queryClient.invalidateQueries({ queryKey: ['restaurant-tables'] })
      setDialogOpen(false)
      setTableForm(defaultTableForm)
    },
    onError: (error: Error) => toast.error('Failed to create table', { description: error.message }),
  })

  // Update table mutation
  const updateTableMutation = useMutation({
    mutationFn: (data: TableFormData & { id: string }) =>
      api.put('/restaurant-tables', {
        id: data.id,
        tableNumber: data.tableNumber,
        capacity: data.capacity,
        status: data.status,
        location: data.location || null,
      }),
    onSuccess: () => {
      toast.success('Table updated')
      queryClient.invalidateQueries({ queryKey: ['restaurant-tables'] })
      setDialogOpen(false)
      setEditingTable(null)
      setTableForm(defaultTableForm)
    },
    onError: (error: Error) => toast.error('Failed to update table', { description: error.message }),
  })

  // Quick status change mutation
  const changeStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.put('/restaurant-tables', { id, status }),
    onSuccess: (_, vars) => {
      toast.success(`Table status changed to ${vars.status}`)
      queryClient.invalidateQueries({ queryKey: ['restaurant-tables'] })
    },
    onError: (error: Error) => toast.error('Failed to change status', { description: error.message }),
  })

  const handleEditTable = (table: RestaurantTable) => {
    setEditingTable(table)
    setTableForm({
      tableNumber: table.tableNumber,
      capacity: table.capacity,
      status: table.status,
      location: table.location || '',
    })
    setDialogOpen(true)
  }

  const handleSaveTable = () => {
    if (!tableForm.tableNumber.trim()) {
      toast.error('Table number is required')
      return
    }
    if (editingTable) {
      updateTableMutation.mutate({ ...tableForm, id: editingTable.id })
    } else {
      createTableMutation.mutate(tableForm)
    }
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-slate-900 text-white px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center">
              <Armchair className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Table Management</h1>
              <p className="text-xs text-slate-400">CloudView Restaurant</p>
            </div>
          </div>
          <Button
            onClick={() => {
              setEditingTable(null)
              setTableForm(defaultTableForm)
              setDialogOpen(true)
            }}
            className="bg-amber-600 hover:bg-amber-700"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Table
          </Button>
        </div>
      </div>

      {/* Stats & Filters */}
      <div className="px-6 py-4 bg-white border-b shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-xs text-slate-600">Available: <strong>{availableCount}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-xs text-slate-600">Occupied: <strong>{occupiedCount}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-xs text-slate-600">Reserved: <strong>{reservedCount}</strong></span>
            </div>
          </div>
          <Select value={filterLocation} onValueChange={setFilterLocation}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              <SelectItem value="indoor">Indoor</SelectItem>
              <SelectItem value="outdoor">Outdoor</SelectItem>
              <SelectItem value="vip">VIP</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table Grid */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Armchair className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">No tables found</p>
            <p className="text-xs mt-1">Add tables to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredTables.map((table) => {
              const statusCfg = STATUS_CONFIG[table.status] || STATUS_CONFIG.available
              const StatusIcon = statusCfg.icon

              return (
                <Card
                  key={table.id}
                  className={`cursor-pointer transition-all hover:shadow-lg border-2 ${statusCfg.border} ${statusCfg.bg}`}
                  onClick={() => handleEditTable(table)}
                >
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center mb-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${statusCfg.bg} border-2 ${statusCfg.border}`}>
                        <StatusIcon className={`w-6 h-6 ${statusCfg.color}`} />
                      </div>
                    </div>
                    <h3 className="font-bold text-lg text-slate-800">
                      {table.tableNumber}
                    </h3>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <Users className="w-3 h-3 text-slate-400" />
                      <span className="text-xs text-slate-500">{table.capacity} seats</span>
                    </div>
                    {table.location && (
                      <Badge variant="outline" className="mt-2 text-[10px]">
                        {table.location}
                      </Badge>
                    )}
                    <Badge
                      className={`mt-2 text-[10px] ${statusCfg.bg} ${statusCfg.color} border ${statusCfg.border}`}
                    >
                      {statusCfg.label}
                    </Badge>

                    {/* Quick Status Buttons */}
                    <div className="mt-3 pt-2 border-t border-slate-200/50">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full h-7 text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Change Status
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {(STATUS_FLOW[table.status] || []).map((nextStatus) => {
                            const nextCfg = STATUS_CONFIG[nextStatus]
                            return (
                              <DropdownMenuItem
                                key={nextStatus}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  changeStatusMutation.mutate({
                                    id: table.id,
                                    status: nextStatus,
                                  })
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${
                                    nextStatus === 'available' ? 'bg-green-500' :
                                    nextStatus === 'occupied' ? 'bg-red-500' : 'bg-amber-500'
                                  }`} />
                                  {nextCfg.label}
                                </div>
                              </DropdownMenuItem>
                            )
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Table Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingTable ? `Edit Table ${editingTable.tableNumber}` : 'Add New Table'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Table Number *</Label>
              <Input
                value={tableForm.tableNumber}
                onChange={(e) =>
                  setTableForm({ ...tableForm, tableNumber: e.target.value })
                }
                placeholder="e.g. T1, T2..."
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Capacity (seats)</Label>
              <Input
                type="number"
                min={1}
                value={tableForm.capacity}
                onChange={(e) =>
                  setTableForm({
                    ...tableForm,
                    capacity: Number(e.target.value) || 4,
                  })
                }
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Location</Label>
              <Select
                value={tableForm.location || '_none'}
                onValueChange={(val) =>
                  setTableForm({
                    ...tableForm,
                    location: val === '_none' ? '' : val,
                  })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No location</SelectItem>
                  <SelectItem value="indoor">Indoor</SelectItem>
                  <SelectItem value="outdoor">Outdoor</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editingTable && (
              <div>
                <Label className="text-xs">Status</Label>
                <Select
                  value={tableForm.status}
                  onValueChange={(val) =>
                    setTableForm({ ...tableForm, status: val })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="occupied">Occupied</SelectItem>
                    <SelectItem value="reserved">Reserved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveTable}
              disabled={createTableMutation.isPending || updateTableMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {editingTable ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
