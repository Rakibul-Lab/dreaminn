'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAuthStore, canAccessHotel, canAccessRestaurant, canAccessAdmin } from '@/lib/auth-store'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'
import {
  BarChart, LineChart, PieChart, Bar, Line, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import {
  BarChart3, TrendingUp, PieChart as PieIcon, Download, Calendar
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

export default function ReportsPage() {
  const { user } = useAuthStore()
  const [dateRange, setDateRange] = useState({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  })

  const isHotel = canAccessHotel(user?.role)
  const isRestaurant = canAccessRestaurant(user?.role)
  const isAdmin = canAccessAdmin(user?.role)

  // Restaurant daily sales
  const { data: restaurantDaily, isLoading: loadingDaily } = useQuery({
    queryKey: ['report-restaurant-daily', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({ type: 'restaurant-daily', ...dateRange })
      const res = await api.get<{ success: boolean; data: Record<string, unknown> }>(`/reports?${params.toString()}`)
      return res.data
    },
    enabled: isRestaurant || isAdmin,
  })

  // Restaurant monthly sales
  const { data: restaurantMonthly, isLoading: loadingMonthly } = useQuery({
    queryKey: ['report-restaurant-monthly', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({ type: 'restaurant-monthly', ...dateRange })
      const res = await api.get<{ success: boolean; data: Record<string, unknown> }>(`/reports?${params.toString()}`)
      return res.data
    },
    enabled: isRestaurant || isAdmin,
  })

  // Order status
  const { data: orderStatus, isLoading: loadingOrderStatus } = useQuery({
    queryKey: ['report-order-status', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({ type: 'order-status', ...dateRange })
      const res = await api.get<{ success: boolean; data: Record<string, unknown> }>(`/reports?${params.toString()}`)
      return res.data
    },
    enabled: isRestaurant || isAdmin,
  })

  // Hotel revenue
  const { data: hotelRevenue, isLoading: loadingHotelRevenue } = useQuery({
    queryKey: ['report-hotel-revenue', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({ type: 'hotel-revenue', ...dateRange })
      const res = await api.get<{ success: boolean; data: Record<string, unknown> }>(`/reports?${params.toString()}`)
      return res.data
    },
    enabled: isHotel || isAdmin,
  })

  // Hotel occupancy
  const { data: hotelOccupancy, isLoading: loadingOccupancy } = useQuery({
    queryKey: ['report-hotel-occupancy', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({ type: 'hotel-occupancy', ...dateRange })
      const res = await api.get<{ success: boolean; data: Record<string, unknown> }>(`/reports?${params.toString()}`)
      return res.data
    },
    enabled: isHotel || isAdmin,
  })

  // Food charges by room
  const { data: foodCharges, isLoading: loadingFoodCharges } = useQuery({
    queryKey: ['report-food-charges', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({ type: 'food-charges-by-room', ...dateRange })
      const res = await api.get<{ success: boolean; data: Record<string, unknown> }>(`/reports?${params.toString()}`)
      return res.data
    },
    enabled: isHotel || isAdmin,
  })

  // Combined revenue
  const { data: combinedRevenue, isLoading: loadingCombined } = useQuery({
    queryKey: ['report-combined-revenue', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({ type: 'combined-revenue', ...dateRange })
      const res = await api.get<{ success: boolean; data: Record<string, unknown> }>(`/reports?${params.toString()}`)
      return res.data
    },
    enabled: isAdmin,
  })

  // Admin summary
  const { data: adminSummary, isLoading: loadingAdminSummary } = useQuery({
    queryKey: ['report-admin-summary', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({ type: 'admin-summary', ...dateRange })
      const res = await api.get<{ success: boolean; data: Record<string, unknown> }>(`/reports?${params.toString()}`)
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-amber-600" />
            Reports & Analytics
          </h2>
          <p className="text-slate-500 text-sm mt-1">Comprehensive business insights</p>
        </div>
        <div className="flex gap-2 items-end">
          <div>
            <Label className="text-xs">Start Date</Label>
            <Input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange((d) => ({ ...d, startDate: e.target.value }))}
              className="w-40"
            />
          </div>
          <div>
            <Label className="text-xs">End Date</Label>
            <Input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange((d) => ({ ...d, endDate: e.target.value }))}
              className="w-40"
            />
          </div>
        </div>
      </div>

      <Tabs defaultValue={isRestaurant ? 'restaurant' : isHotel ? 'hotel' : 'restaurant'}>
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
                  <p className="text-sm text-slate-500">Total Sales</p>
                  <p className="text-2xl font-bold text-amber-700">
                    ৳{((restaurantDaily?.totalSales || 0) as number).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-slate-500">Total Orders</p>
                  <p className="text-2xl font-bold text-emerald-700">
                    {((restaurantDaily?.totalOrders || 0) as number)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-slate-500">Avg Order Value</p>
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
                  <CardTitle className="text-base">Daily Sales (Monthly View)</CardTitle>
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
                    <p className="text-center text-slate-500 py-8">No order data available</p>
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
                          <TableRow><TableCell colSpan={3} className="text-center py-4 text-slate-500">No data</TableCell></TableRow>
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
                  <p className="text-sm text-slate-500">Total Revenue</p>
                  <p className="text-2xl font-bold text-amber-700">
                    ৳{((hotelRevenue?.totalRevenue || 0) as number).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-slate-500">Occupancy Rate</p>
                  <p className="text-2xl font-bold text-emerald-700">
                    {(hotelOccupancy?.occupancyRate || 0 as number).toFixed(1)}%
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-slate-500">Total Bookings</p>
                  <p className="text-2xl font-bold text-sky-700">{((hotelRevenue?.totalBookings || 0) as number)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-slate-500">Avg Daily Rate</p>
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
                      <div className="flex justify-between"><span className="text-slate-600">Total Rooms</span><span className="font-semibold">{(hotelOccupancy?.totalRooms || 0) as number}</span></div>
                      <div className="flex justify-between"><span className="text-emerald-600">Available</span><span className="font-semibold">{(hotelOccupancy?.availableRooms || 0) as number}</span></div>
                      <div className="flex justify-between"><span className="text-amber-600">Occupied</span><span className="font-semibold">{(hotelOccupancy?.occupiedRooms || 0) as number}</span></div>
                      <div className="flex justify-between"><span className="text-sky-600">Cleaning</span><span className="font-semibold">{(hotelOccupancy?.cleaningRooms || 0) as number}</span></div>
                      <div className="flex justify-between"><span className="text-red-600">Maintenance</span><span className="font-semibold">{(hotelOccupancy?.maintenanceRooms || 0) as number}</span></div>
                      <div className="flex justify-between"><span className="text-slate-600">Today Check-ins</span><span className="font-semibold">{(hotelOccupancy?.todayCheckins || 0) as number}</span></div>
                      <div className="flex justify-between"><span className="text-slate-600">Today Check-outs</span><span className="font-semibold">{(hotelOccupancy?.todayCheckouts || 0) as number}</span></div>
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
                          <TableRow><TableCell colSpan={3} className="text-center py-4 text-slate-500">No data</TableCell></TableRow>
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
                  <p className="text-sm text-slate-500">Total Revenue</p>
                  <p className="text-2xl font-bold text-slate-800">
                    ৳{((combinedRevenue?.totalRevenue || 0) as number).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-slate-500">Hotel Revenue</p>
                  <p className="text-2xl font-bold text-amber-700">
                    ৳{((combinedRevenue?.hotelRevenue || 0) as number).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-slate-500">Restaurant Revenue</p>
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
                      <div className="flex justify-between"><span className="text-slate-600">Total Revenue</span><span className="font-semibold">৳{((adminSummary?.totalRevenue || 0) as number).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-slate-600">Total Payments Received</span><span className="font-semibold text-emerald-600">৳{((adminSummary?.profitSummary as Record<string, number>)?.totalPaymentsReceived || 0).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-slate-600">Outstanding Dues</span><span className="font-semibold text-red-600">৳{((adminSummary?.profitSummary as Record<string, number>)?.outstandingDues || 0).toLocaleString()}</span></div>
                      <hr />
                      <div className="flex justify-between"><span className="text-slate-800 font-medium">Net Position</span><span className={`font-bold ${((adminSummary?.profitSummary as Record<string, number>)?.netPosition || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>৳{((adminSummary?.profitSummary as Record<string, number>)?.netPosition || 0).toLocaleString()}</span></div>
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
                          <TableRow><TableCell colSpan={3} className="text-center py-4 text-slate-500">No data</TableCell></TableRow>
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
