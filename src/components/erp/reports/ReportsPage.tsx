'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAuthStore, canAccessHotel, canAccessRestaurant, canAccessAdmin } from '@/lib/auth-store'
import { format } from 'date-fns'
import {
  BarChart, PieChart, Bar, Pie, Cell,
  XAxis, YAxis, CartesianGrid
} from 'recharts'
import {
  BarChart3, Download, CalendarRange, FileDown, Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  resolveBookingDateRange,
  type BookingDatePreset,
} from '@/lib/booking-date-filter'
import {
  downloadReportsPdf,
  REPORT_DATE_PRESET_OPTIONS,
  type ReportsExportTab,
} from '@/lib/reports-export'
import { toast } from 'sonner'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'

const CHART_COLORS = ['#d97706', '#059669', '#0891b2', '#7c3aed', '#dc2626', '#ea580c', '#65a30d', '#0d9488']

const barChartConfig: ChartConfig = {
  sales: { label: 'Sales', color: '#d97706' },
  revenue: { label: 'Revenue', color: '#059669' },
  hotelRevenue: { label: 'Hotel Revenue', color: '#d97706' },
  restaurantRevenue: { label: 'Restaurant Revenue', color: '#059669' },
}

const lineChartConfig: ChartConfig = {
  occupancy: { label: 'Occupancy Rate', color: '#0891b2' },
  trend: { label: 'Trend', color: '#d97706' },
}

const pieChartConfig: ChartConfig = {
  PENDING: { label: 'Pending', color: '#d97706' },
  COOKING: { label: 'Cooking', color: '#0891b2' },
  READY: { label: 'Ready', color: '#059669' },
  DELIVERED: { label: 'Delivered', color: '#7c3aed' },
  CANCELLED: { label: 'Cancelled', color: '#dc2626' },
}

function buildReportQueryParams(
  type: string,
  dateFrom?: string,
  dateTo?: string
): string {
  const params = new URLSearchParams({ type })
  if (dateFrom) params.set('startDate', dateFrom)
  if (dateTo) params.set('endDate', dateTo)
  return `/reports?${params.toString()}`
}

export default function ReportsPage() {
  const { user } = useAuthStore()
  const [datePreset, setDatePreset] = useState<BookingDatePreset>('today')
  const [customDateFrom, setCustomDateFrom] = useState('')
  const [customDateTo, setCustomDateTo] = useState('')
  const [exportingPdf, setExportingPdf] = useState(false)

  const isHotel = canAccessHotel(user?.role)
  const isRestaurant = canAccessRestaurant(user?.role)
  const isAdmin = canAccessAdmin(user?.role)

  const defaultTab: ReportsExportTab = isRestaurant || isAdmin
    ? 'restaurant'
    : isHotel
      ? 'hotel'
      : 'restaurant'
  const [activeTab, setActiveTab] = useState<ReportsExportTab>(defaultTab)

  const dateRange = useMemo(
    () => resolveBookingDateRange(datePreset, customDateFrom, customDateTo),
    [datePreset, customDateFrom, customDateTo]
  )

  const reportQueryKey = [datePreset, dateRange.dateFrom, dateRange.dateTo] as const

  // Restaurant daily sales
  const { data: restaurantDaily, isLoading: loadingDaily } = useQuery({
    queryKey: ['report-restaurant-daily', ...reportQueryKey],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Record<string, unknown> }>(
        buildReportQueryParams('restaurant-daily', dateRange.dateFrom, dateRange.dateTo)
      )
      return res.data
    },
    enabled: isRestaurant || isAdmin,
  })

  const { data: restaurantMonthly, isLoading: loadingMonthly } = useQuery({
    queryKey: ['report-restaurant-monthly', ...reportQueryKey],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Record<string, unknown> }>(
        buildReportQueryParams('restaurant-monthly', dateRange.dateFrom, dateRange.dateTo)
      )
      return res.data
    },
    enabled: isRestaurant || isAdmin,
  })

  const { data: orderStatus, isLoading: loadingOrderStatus } = useQuery({
    queryKey: ['report-order-status', ...reportQueryKey],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Record<string, unknown> }>(
        buildReportQueryParams('order-status', dateRange.dateFrom, dateRange.dateTo)
      )
      return res.data
    },
    enabled: isRestaurant || isAdmin,
  })

  const { data: hotelRevenue, isLoading: loadingHotelRevenue } = useQuery({
    queryKey: ['report-hotel-revenue', ...reportQueryKey],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Record<string, unknown> }>(
        buildReportQueryParams('hotel-revenue', dateRange.dateFrom, dateRange.dateTo)
      )
      return res.data
    },
    enabled: isHotel || isAdmin,
  })

  const { data: hotelOccupancy, isLoading: loadingOccupancy } = useQuery({
    queryKey: ['report-hotel-occupancy', ...reportQueryKey],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Record<string, unknown> }>(
        buildReportQueryParams('hotel-occupancy', dateRange.dateFrom, dateRange.dateTo)
      )
      return res.data
    },
    enabled: isHotel || isAdmin,
  })

  const { data: foodCharges, isLoading: loadingFoodCharges } = useQuery({
    queryKey: ['report-food-charges', ...reportQueryKey],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Record<string, unknown> }>(
        buildReportQueryParams('food-charges-by-room', dateRange.dateFrom, dateRange.dateTo)
      )
      return res.data
    },
    enabled: isHotel || isAdmin,
  })

  const { data: combinedRevenue, isLoading: loadingCombined } = useQuery({
    queryKey: ['report-combined-revenue', ...reportQueryKey],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Record<string, unknown> }>(
        buildReportQueryParams('combined-revenue', dateRange.dateFrom, dateRange.dateTo)
      )
      return res.data
    },
    enabled: isAdmin,
  })

  const { data: adminSummary, isLoading: loadingAdminSummary } = useQuery({
    queryKey: ['report-admin-summary', ...reportQueryKey],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Record<string, unknown> }>(
        buildReportQueryParams('admin-summary', dateRange.dateFrom, dateRange.dateTo)
      )
      return res.data
    },
    enabled: isAdmin,
  })

  const exportCSV = (data: Record<string, unknown>[], filename: string) => {
    if (!data.length) return
    const headers = Object.keys(data[0])
    const csv = [
      headers.join(','),
      ...data.map((row) => headers.map((h) => JSON.stringify(row[h] ?? '')).join(',')),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Build chart data from daily breakdown
  const dailyBreakdown = restaurantMonthly?.dailyBreakdown as Record<string, { orders: number; sales: number }> | undefined
  const dailyChartData = dailyBreakdown
    ? Object.entries(dailyBreakdown).map(([date, val]) => ({ date: format(new Date(date), 'MMM dd'), sales: val.sales, orders: val.orders }))
    : []

  // Build pie chart data from order status
  const statusDist = orderStatus?.statusDistribution as Record<string, { count: number; totalAmount: number }> | undefined
  const pieData = statusDist
    ? Object.entries(statusDist).map(([status, val]) => ({ name: status, value: val.count, amount: val.totalAmount }))
    : []

  // Build revenue by type chart data
  const revenueByType = hotelRevenue?.revenueByType as Record<string, { bookings: number; revenue: number }> | undefined
  const revenueByTypeData = revenueByType
    ? Object.entries(revenueByType).map(([type, val]) => ({ type, revenue: val.revenue, bookings: val.bookings }))
    : []

  // Top selling items
  const topItems = (restaurantDaily?.topSellingItems || restaurantMonthly?.topSellingItems) as Array<{ name: string; quantity: number; revenue: number }> | undefined

  // Food charges by room
  const roomsData = foodCharges?.rooms as Array<{ roomNumber: string; totalOrders: number; totalCharges: number }> | undefined

  // Combined revenue data
  const combinedData = combinedRevenue ? [
    { name: 'Hotel', revenue: (combinedRevenue.hotelRevenue as number) || 0 },
    { name: 'Restaurant', revenue: (combinedRevenue.restaurantRevenue as number) || 0 },
    { name: 'Extra', revenue: (combinedRevenue.extraRevenue as number) || 0 },
  ] : []

  // Top customers
  const topCustomers = adminSummary?.topCustomers as Array<{ name: string; totalSpent: number; bookingCount: number }> | undefined

  const handleExportPdf = async () => {
    setExportingPdf(true)
    const toastId = toast.loading('Preparing PDF export…')
    try {
      if (activeTab === 'restaurant' && !(isRestaurant || isAdmin)) {
        throw new Error('No restaurant report data available')
      }
      if (activeTab === 'hotel' && !(isHotel || isAdmin)) {
        throw new Error('No hotel report data available')
      }
      if (activeTab === 'combined' && !isAdmin) {
        throw new Error('Combined reports are admin only')
      }

      await downloadReportsPdf(
        {
          restaurant:
            activeTab === 'restaurant'
              ? {
                  totalSales: (restaurantDaily?.totalSales as number) ?? 0,
                  totalOrders: (restaurantDaily?.totalOrders as number) ?? 0,
                  averageOrderValue: (restaurantDaily?.averageOrderValue as number) ?? 0,
                  dailyBreakdown: restaurantMonthly?.dailyBreakdown as Record<string, { orders: number; sales: number }>,
                  statusDistribution: orderStatus?.statusDistribution as Record<string, { count: number; totalAmount: number }>,
                  topSellingItems: topItems,
                }
              : undefined,
          hotel:
            activeTab === 'hotel'
              ? {
                  totalRevenue: (hotelRevenue?.totalRevenue as number) ?? 0,
                  totalBookings: (hotelRevenue?.totalBookings as number) ?? 0,
                  averageRate: (hotelRevenue?.averageRate as number) ?? 0,
                  occupancyRate: (hotelOccupancy?.occupancyRate as number) ?? 0,
                  revenueByType: hotelRevenue?.revenueByType as Record<string, { bookings: number; revenue: number }>,
                  occupancy: {
                    totalRooms: (hotelOccupancy?.totalRooms as number) ?? 0,
                    availableRooms: (hotelOccupancy?.availableRooms as number) ?? 0,
                    occupiedRooms: (hotelOccupancy?.occupiedRooms as number) ?? 0,
                    cleaningRooms: (hotelOccupancy?.cleaningRooms as number) ?? 0,
                    maintenanceRooms: (hotelOccupancy?.maintenanceRooms as number) ?? 0,
                    todayCheckins: (hotelOccupancy?.todayCheckins as number) ?? 0,
                    todayCheckouts: (hotelOccupancy?.todayCheckouts as number) ?? 0,
                  },
                  foodCharges: roomsData,
                  foodGrandTotal: (foodCharges?.grandTotal as number) ?? undefined,
                }
              : undefined,
          combined:
            activeTab === 'combined'
              ? {
                  totalRevenue: (combinedRevenue?.totalRevenue as number) ?? 0,
                  hotelRevenue: (combinedRevenue?.hotelRevenue as number) ?? 0,
                  restaurantRevenue: (combinedRevenue?.restaurantRevenue as number) ?? 0,
                  extraRevenue: (combinedRevenue?.extraRevenue as number) ?? 0,
                  profitSummary: adminSummary?.profitSummary as {
                    totalPaymentsReceived?: number
                    outstandingDues?: number
                    netPosition?: number
                  },
                  topCustomers,
                }
              : undefined,
        },
        {
          tab: activeTab,
          datePreset,
          customDateFrom,
          customDateTo,
          generatedBy: user ? { name: user.name, email: user.email, role: user.role } : undefined,
        }
      )
      toast.success('Report exported to PDF', { id: toastId })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed'
      toast.error(msg, { id: toastId })
    } finally {
      setExportingPdf(false)
    }
  }

  const isReportLoading =
    (activeTab === 'restaurant' && (loadingDaily || loadingMonthly || loadingOrderStatus)) ||
    (activeTab === 'hotel' && (loadingHotelRevenue || loadingOccupancy || loadingFoodCharges)) ||
    (activeTab === 'combined' && (loadingCombined || loadingAdminSummary))

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-amber-600" />
            Reports & Analytics
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Comprehensive business insights</p>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Period</Label>
            <Select
              value={datePreset}
              onValueChange={(v) => setDatePreset(v as BookingDatePreset)}
            >
              <SelectTrigger className="w-44">
                <CalendarRange className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_DATE_PRESET_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {datePreset === 'custom' && (
            <>
              <div className="space-y-1">
                <Label htmlFor="report-date-from" className="text-xs text-muted-foreground">From</Label>
                <Input
                  id="report-date-from"
                  type="date"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="report-date-to" className="text-xs text-muted-foreground">To</Label>
                <Input
                  id="report-date-to"
                  type="date"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                  className="w-40"
                />
              </div>
            </>
          )}
          <Button
            variant="outline"
            onClick={() => void handleExportPdf()}
            disabled={exportingPdf || isReportLoading}
          >
            {exportingPdf ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4 mr-2" />
            )}
            Export PDF
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReportsExportTab)}>
        <TabsList>
          {(isRestaurant || isAdmin) && <TabsTrigger value="restaurant">Restaurant</TabsTrigger>}
          {(isHotel || isAdmin) && <TabsTrigger value="hotel">Hotel</TabsTrigger>}
          {isAdmin && <TabsTrigger value="combined">Combined</TabsTrigger>}
        </TabsList>

        {/* Restaurant Reports */}
        {(isRestaurant || isAdmin) && (
          <TabsContent value="restaurant" className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Total Sales</p>
                  <p className="text-2xl font-bold text-amber-700">
                    ৳{((restaurantDaily?.totalSales || 0) as number).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                  <p className="text-2xl font-bold text-emerald-700">
                    {((restaurantDaily?.totalOrders || 0) as number)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Avg Order Value</p>
                  <p className="text-2xl font-bold text-sky-700">
                    ৳{((restaurantDaily?.averageOrderValue || 0) as number).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Daily Sales Bar Chart */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base">Daily Sales Trend</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => exportCSV(dailyChartData, 'daily-sales')}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingMonthly ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <ChartContainer config={barChartConfig} className="h-64 w-full">
                    <BarChart data={dailyChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="sales" fill="var(--color-sales)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Order Status Pie Chart */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Order Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingOrderStatus ? (
                    <Skeleton className="h-64 w-full" />
                  ) : pieData.length > 0 ? (
                    <ChartContainer config={pieChartConfig} className="h-64 w-full">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {pieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                      </PieChart>
                    </ChartContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No order data available</p>
                  )}
                </CardContent>
              </Card>

              {/* Top Selling Items */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-base">Top Selling Items</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => exportCSV(topItems || [], 'top-items')}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topItems?.length ? topItems.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right text-emerald-600">৳{item.revenue.toLocaleString()}</TableCell>
                          </TableRow>
                        )) : (
                          <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">No data</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        {/* Hotel Reports */}
        {(isHotel || isAdmin) && (
          <TabsContent value="hotel" className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold text-amber-700">
                    ৳{((hotelRevenue?.totalRevenue || 0) as number).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Occupancy Rate</p>
                  <p className="text-2xl font-bold text-emerald-700">
                    {(hotelOccupancy?.occupancyRate || 0 as number).toFixed(1)}%
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Total Bookings</p>
                  <p className="text-2xl font-bold text-sky-700">{((hotelRevenue?.totalBookings || 0) as number)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Avg Daily Rate</p>
                  <p className="text-2xl font-bold text-purple-700">
                    ৳{((hotelRevenue?.averageRate || 0) as number).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Revenue by Room Type Chart */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base">Revenue by Room Type</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => exportCSV(revenueByTypeData, 'room-revenue')}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingHotelRevenue ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <ChartContainer config={barChartConfig} className="h-64 w-full">
                    <BarChart data={revenueByTypeData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="type" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="revenue" fill="var(--color-hotelRevenue)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Occupancy Info & Food Charges */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Room Status Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingOccupancy ? (
                    <Skeleton className="h-48 w-full" />
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-between"><span className="text-muted-foreground">Total Rooms</span><span className="font-semibold">{(hotelOccupancy?.totalRooms || 0) as number}</span></div>
                      <div className="flex justify-between"><span className="text-emerald-600">Available</span><span className="font-semibold">{(hotelOccupancy?.availableRooms || 0) as number}</span></div>
                      <div className="flex justify-between"><span className="text-amber-600">Occupied</span><span className="font-semibold">{(hotelOccupancy?.occupiedRooms || 0) as number}</span></div>
                      <div className="flex justify-between"><span className="text-sky-600">Cleaning</span><span className="font-semibold">{(hotelOccupancy?.cleaningRooms || 0) as number}</span></div>
                      <div className="flex justify-between"><span className="text-red-600">Maintenance</span><span className="font-semibold">{(hotelOccupancy?.maintenanceRooms || 0) as number}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Today Check-ins</span><span className="font-semibold">{(hotelOccupancy?.todayCheckins || 0) as number}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Today Check-outs</span><span className="font-semibold">{(hotelOccupancy?.todayCheckouts || 0) as number}</span></div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-base">Food Charges by Room</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => exportCSV(roomsData || [], 'food-by-room')}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Room</TableHead>
                          <TableHead className="text-right">Orders</TableHead>
                          <TableHead className="text-right">Charges</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {roomsData?.length ? roomsData.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono">{r.roomNumber}</TableCell>
                            <TableCell className="text-right">{r.totalOrders}</TableCell>
                            <TableCell className="text-right text-emerald-600">৳{r.totalCharges.toLocaleString()}</TableCell>
                          </TableRow>
                        )) : (
                          <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">No data</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        {/* Combined Reports - ADMIN only */}
        {isAdmin && (
          <TabsContent value="combined" className="space-y-4">
            {/* Revenue Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold text-foreground">
                    ৳{((combinedRevenue?.totalRevenue || 0) as number).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Hotel Revenue</p>
                  <p className="text-2xl font-bold text-amber-700">
                    ৳{((combinedRevenue?.hotelRevenue || 0) as number).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Restaurant Revenue</p>
                  <p className="text-2xl font-bold text-emerald-700">
                    ৳{((combinedRevenue?.restaurantRevenue || 0) as number).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Revenue Breakdown Bar Chart */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base">Revenue Breakdown</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => exportCSV(combinedData, 'combined-revenue')}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingCombined ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <ChartContainer config={barChartConfig} className="h-64 w-full">
                    <BarChart data={combinedData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                        {combinedData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Profit Summary & Top Customers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Profit Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingAdminSummary ? (
                    <Skeleton className="h-48 w-full" />
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-between"><span className="text-muted-foreground">Total Revenue</span><span className="font-semibold">৳{((adminSummary?.totalRevenue || 0) as number).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Total Payments Received</span><span className="font-semibold text-emerald-600">৳{((adminSummary?.profitSummary as Record<string, number>)?.totalPaymentsReceived || 0).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Outstanding Dues</span><span className="font-semibold text-red-600">৳{((adminSummary?.profitSummary as Record<string, number>)?.outstandingDues || 0).toLocaleString()}</span></div>
                      <hr />
                      <div className="flex justify-between"><span className="text-foreground font-medium">Net Position</span><span className={`font-bold ${((adminSummary?.profitSummary as Record<string, number>)?.netPosition || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>৳{((adminSummary?.profitSummary as Record<string, number>)?.netPosition || 0).toLocaleString()}</span></div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-base">Top Customers</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => exportCSV(topCustomers || [], 'top-customers')}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead className="text-right">Bookings</TableHead>
                          <TableHead className="text-right">Total Spent</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topCustomers?.length ? topCustomers.map((c, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{c.name}</TableCell>
                            <TableCell className="text-right">{c.bookingCount}</TableCell>
                            <TableCell className="text-right text-emerald-600">৳{c.totalSpent.toLocaleString()}</TableCell>
                          </TableRow>
                        )) : (
                          <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">No data</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
