import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, notFoundResponse, logActivity } from '@/lib/api-utils';
import { RoleType } from '@prisma/client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireRole(request, 'ADMIN' as RoleType, 'HOTEL_STAFF' as RoleType);
    if (authResult instanceof Response) return authResult;

    const { id } = await params;

    // Fetch the booking with all related data
    const booking = await db.booking.findUnique({
      where: { id },
      include: {
        room: { include: { type: true } },
        customer: true,
        charges: true,
        restaurantOrders: true,
      },
    });

    if (!booking) {
      return notFoundResponse('Booking');
    }

    // Validate booking status
    if (booking.status !== 'CHECKED_IN') {
      return errorResponse('Only checked-in bookings can be checked out');
    }

    const now = new Date();
    let lateCheckoutCharge = 0;

    // Check for late checkout (after scheduled checkout time)
    if (now > booking.checkOut) {
      const diffMs = now.getTime() - booking.checkOut.getTime();
      const hoursLate = Math.ceil(diffMs / (1000 * 60 * 60));

      // If room type has hourly rate, use it; otherwise calculate based on daily rate
      const hourlyRate = booking.room.type.hourlyRate;
      if (hourlyRate) {
        lateCheckoutCharge = hoursLate * hourlyRate;
      } else {
        // Charge half day rate for every 6 hours late, max 1 day rate
        const halfDaysLate = Math.ceil(hoursLate / 6);
        const halfDayRate = booking.room.type.basePrice / 2;
        lateCheckoutCharge = Math.min(halfDaysLate * halfDayRate, booking.room.type.basePrice);
      }

      // Create late checkout charge
      await db.roomCharge.create({
        data: {
          bookingId: id,
          chargeType: 'LATE_CHECKOUT',
          description: `Late checkout - ${hoursLate} hours late`,
          amount: lateCheckoutCharge,
          quantity: 1,
          chargeDate: now,
        },
      });
    }

    // Calculate all charges
    // Room charges total
    const roomCharges = booking.charges.reduce((sum, charge) => sum + charge.amount, 0);
    const totalRoomCharges = booking.totalRoomCharge + roomCharges + lateCheckoutCharge;

    // Restaurant orders total for this booking's room
    const restaurantOrders = await db.restaurantOrder.findMany({
      where: { bookingId: id, status: { not: 'CANCELLED' } },
    });
    const foodCharges = restaurantOrders.reduce((sum, order) => sum + order.totalAmount, 0);

    const totalCharges = totalRoomCharges + foodCharges;
    const totalPaid = booking.advancePayment + booking.initialPayment;
    const finalDueAmount = totalCharges - totalPaid;

    // Update booking
    const updatedBooking = await db.booking.update({
      where: { id },
      data: {
        status: 'CHECKED_OUT',
        actualCheckOut: now,
        dueAmount: finalDueAmount,
      },
      include: {
        customer: true,
        room: { include: { type: true } },
        charges: true,
        payments: true,
        restaurantOrders: true,
        invoices: true,
      },
    });

    // Update room status to CLEANING
    await db.room.update({
      where: { id: booking.roomId },
      data: { status: 'CLEANING' },
    });

    // Create housekeeping task for the room
    await db.housekeepingTask.create({
      data: {
        roomId: booking.roomId,
        taskType: 'cleaning',
        status: 'PENDING',
        assignedTo: authResult.id,
        notes: `Post-checkout cleaning for room ${booking.room.roomNumber}`,
      },
    });

    await logActivity(
      authResult.id,
      'CHECK_OUT',
      'hotel',
      JSON.stringify({
        bookingId: id,
        roomId: booking.roomId,
        customerName: booking.customer.name,
        lateCheckoutCharge,
        totalRoomCharges,
        foodCharges,
        totalPaid,
        finalDueAmount,
      })
    );

    return successResponse(updatedBooking, 'Check-out successful');
  } catch (error) {
    console.error('Check-out error:', error);
    return errorResponse('Failed to check out', 500);
  }
}
