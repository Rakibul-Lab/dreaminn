import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, canAccessHotel, canAccessRestaurant, canAccessAdmin } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';

// GET /api/dashboard - Dashboard stats based on user role
export async function GET(request: NextRequest) {
  try {
    const authResult = requireAuth(request);
    if (authResult instanceof Response) return authResult;

    const user = authResult;

    switch (user.role) {
      case 'ADMIN':
        return await handleAdminDashboard();
      case 'HOTEL_STAFF':
        return await handleHotelDashboard();
      case 'RESTAURANT_STAFF':
        return await handleRestaurantDashboard();
      default:
        return errorResponse('Invalid role', 403);
    }
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return errorResponse('Failed to fetch dashboard data', 500);
  }
}

// Admin Dashboard - Full system overview
async function handleAdminDashboard() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Today's check-ins
  const todaysCheckins = await db.booking.findMany({
    where: {
      checkIn: { gte: today, lt: tomorrow },
      status: { not: 'CANCELLED' },
    },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      room: { select: { id: true, roomNumber: true, type: { select: { name: true } } } },
    },
    take: 10,
  });

  // Today's check-outs
  const todaysCheckouts = await db.booking.findMany({
    where: {
      checkOut: { gte: today, lt: tomorrow },
      status: { not: 'CANCELLED' },
    },
    include: {
      customer: { select: { id: true, name: true } },
      room: { select: { id: true, roomNumber: true } },
    },
    take: 10,
  });

  // Room status summary
  const totalRooms = await db.room.count();
  const occupiedRooms = await db.room.count({ where: { status: 'OCCUPIED' } });
  const availableRooms = await db.room.count({ where: { status: 'AVAILABLE' } });
  const cleaningRooms = await db.room.count({ where: { status: 'CLEANING' } });
  const maintenanceRooms = await db.room.count({ where: { status: 'MAINTENANCE' } });

  // Today's restaurant orders
  const todaysOrders = await db.restaurantOrder.findMany({
    where: {
      createdAt: { gte: today, lt: tomorrow },
    },
  });

  const todaysOrderCount = todaysOrders.length;
  const todaysFoodSales = todaysOrders
    .filter((o) => o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  // Revenue summary
  const allBookings = await db.booking.findMany({
    where: { status: { not: 'CANCELLED' } },
  });

  const hotelRevenue = allBookings.reduce((sum, b) => sum + b.totalRoomCharge, 0);
  const totalDue = allBookings.reduce((sum, b) => sum + b.dueAmount, 0);

  const allOrders = await db.restaurantOrder.findMany({
    where: { status: { not: 'CANCELLED' } },
  });

  const restaurantRevenue = allOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  // Today's payments
  const todaysPayments = await db.payment.findMany({
    where: { createdAt: { gte: today, lt: tomorrow } },
  });

  const todaysRevenue = todaysPayments.reduce((sum, p) => sum + p.amount, 0);

  // Recent activities
  const recentActivities = await db.activityLog.findMany({
    take: 15,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, role: true } },
    },
  });

  // Charts data - last 7 days revenue
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const recentPayments = await db.payment.findMany({
    where: { createdAt: { gte: sevenDaysAgo } },
    select: { amount: true, createdAt: true },
  });

  const revenueByDay: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    revenueByDay[d.toISOString().slice(0, 10)] = 0;
  }
  for (const payment of recentPayments) {
    const day = payment.createdAt.toISOString().slice(0, 10);
    if (revenueByDay[day] !== undefined) {
      revenueByDay[day] += payment.amount;
    }
  }

  // Active bookings count
  const activeBookings = await db.booking.count({
    where: { status: { in: ['CHECKED_IN', 'RESERVED'] } },
  });

  // Pending invoices
  const pendingInvoices = await db.invoice.count({
    where: { status: { in: ['ISSUED', 'PARTIALLY_PAID'] } },
  });

  return successResponse({
    role: 'ADMIN',
    today: today.toISOString().slice(0, 10),
    checkIns: { count: todaysCheckins.length, items: todaysCheckins },
    checkOuts: { count: todaysCheckouts.length, items: todaysCheckouts },
    rooms: {
      total: totalRooms,
      occupied: occupiedRooms,
      available: availableRooms,
      cleaning: cleaningRooms,
      maintenance: maintenanceRooms,
      occupancyRate: totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 10000) / 100 : 0,
    },
    restaurant: {
      todaysOrders: todaysOrderCount,
      todaysFoodSales,
      activeOrders: todaysOrders.filter((o) => ['PENDING', 'COOKING', 'READY'].includes(o.status)).length,
    },
    revenue: {
      hotelRevenue,
      restaurantRevenue,
      totalRevenue: hotelRevenue + restaurantRevenue,
      totalDue,
      todaysRevenue,
    },
    activeBookings,
    pendingInvoices,
    recentActivities,
    charts: {
      revenueByDay: Object.entries(revenueByDay).map(([date, amount]) => ({ date, amount })),
    },
  });
}

// Hotel Staff Dashboard - Hotel-focused
async function handleHotelDashboard() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Rooms by status
  const totalRooms = await db.room.count();
  const roomsByStatus = await db.room.groupBy({
    by: ['status'],
    _count: { status: true },
  });

  const roomStatusMap: Record<string, number> = {};
  for (const entry of roomsByStatus) {
    roomStatusMap[entry.status] = entry._count.status;
  }

  const occupiedRooms = roomStatusMap['OCCUPIED'] || 0;
  const availableRooms = roomStatusMap['AVAILABLE'] || 0;

  // Today's arrivals
  const todaysArrivals = await db.booking.findMany({
    where: {
      checkIn: { gte: today, lt: tomorrow },
      status: { not: 'CANCELLED' },
    },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      room: { select: { id: true, roomNumber: true, type: { select: { name: true, basePrice: true } } } },
    },
    orderBy: { checkIn: 'asc' },
  });

  // Today's departures
  const todaysDepartures = await db.booking.findMany({
    where: {
      checkOut: { gte: today, lt: tomorrow },
      status: { not: 'CANCELLED' },
    },
    include: {
      customer: { select: { id: true, name: true } },
      room: { select: { id: true, roomNumber: true } },
    },
    orderBy: { checkOut: 'asc' },
  });

  // Active bookings
  const activeBookings = await db.booking.findMany({
    where: { status: { in: ['CHECKED_IN', 'RESERVED'] } },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      room: { select: { id: true, roomNumber: true, type: { select: { name: true } } } },
    },
    take: 20,
    orderBy: { createdAt: 'desc' },
  });

  // Recent restaurant orders for rooms (room service linked to hotel)
  const recentRoomOrders = await db.restaurantOrder.findMany({
    where: {
      roomId: { not: null },
      orderType: 'ROOM_SERVICE',
      status: { in: ['PENDING', 'COOKING', 'READY'] },
    },
    include: {
      room: { select: { id: true, roomNumber: true } },
      items: {
        include: { menuItem: { select: { name: true } } },
        take: 3,
      },
    },
    take: 10,
    orderBy: { createdAt: 'desc' },
  });

  // Housekeeping tasks
  const pendingHousekeeping = await db.housekeepingTask.count({
    where: { status: 'PENDING' },
  });

  const inProgressHousekeeping = await db.housekeepingTask.count({
    where: { status: 'IN_PROGRESS' },
  });

  return successResponse({
    role: 'HOTEL_STAFF',
    today: today.toISOString().slice(0, 10),
    rooms: {
      total: totalRooms,
      byStatus: roomStatusMap,
      occupied: occupiedRooms,
      available: availableRooms,
      occupancyRate: totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 10000) / 100 : 0,
    },
    arrivals: { count: todaysArrivals.length, items: todaysArrivals },
    departures: { count: todaysDepartures.length, items: todaysDepartures },
    activeBookings: { count: activeBookings.length, items: activeBookings },
    roomServiceOrders: recentRoomOrders,
    housekeeping: {
      pending: pendingHousekeeping,
      inProgress: inProgressHousekeeping,
    },
  });
}

// Restaurant Staff Dashboard - Restaurant-focused
async function handleRestaurantDashboard() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Active orders
  const activeOrders = await db.restaurantOrder.findMany({
    where: { status: { in: ['PENDING', 'COOKING', 'READY'] } },
    include: {
      table: { select: { id: true, tableNumber: true, location: true } },
      room: { select: { id: true, roomNumber: true } },
      items: {
        include: { menuItem: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });

  // Today's sales
  const todaysOrders = await db.restaurantOrder.findMany({
    where: {
      createdAt: { gte: today, lt: tomorrow },
      status: { not: 'CANCELLED' },
    },
  });

  const todaysSales = todaysOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const todaysOrderCount = todaysOrders.length;
  const averageOrderValue = todaysOrderCount > 0 ? todaysSales / todaysOrderCount : 0;

  // Table status
  const tables = await db.restaurantTable.findMany({
    orderBy: { tableNumber: 'asc' },
  });

  const tableStatus = {
    total: tables.length,
    available: tables.filter((t) => t.status === 'available').length,
    occupied: tables.filter((t) => t.status === 'occupied').length,
    reserved: tables.filter((t) => t.status === 'reserved').length,
  };

  // KOT queue (items pending or cooking)
  const kotItems = await db.orderItem.findMany({
    where: {
      kotStatus: { in: ['pending', 'cooking'] },
      order: {
        status: { in: ['PENDING', 'COOKING'] },
      },
    },
    include: {
      menuItem: { select: { name: true } },
      order: {
        select: {
          id: true,
          orderNumber: true,
          orderType: true,
          room: { select: { roomNumber: true } },
          table: { select: { tableNumber: true } },
        },
      },
    },
    orderBy: { order: { createdAt: 'asc' } },
    take: 30,
  });

  // Orders by type for today
  const ordersByType: Record<string, number> = {};
  for (const order of todaysOrders) {
    ordersByType[order.orderType] = (ordersByType[order.orderType] || 0) + 1;
  }

  // Hourly sales breakdown for today
  const hourlySales: Record<number, number> = {};
  for (const order of todaysOrders) {
    const hour = order.createdAt.getHours();
    hourlySales[hour] = (hourlySales[hour] || 0) + order.totalAmount;
  }

  return successResponse({
    role: 'RESTAURANT_STAFF',
    today: today.toISOString().slice(0, 10),
    activeOrders: { count: activeOrders.length, items: activeOrders },
    sales: {
      todaysSales,
      todaysOrderCount,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
    },
    tables: tableStatus,
    kotQueue: {
      pending: kotItems.filter((i) => i.kotStatus === 'pending').length,
      cooking: kotItems.filter((i) => i.kotStatus === 'cooking').length,
      items: kotItems,
    },
    ordersByType,
    hourlySales,
  });
}
