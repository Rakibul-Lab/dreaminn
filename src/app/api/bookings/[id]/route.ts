import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, notFoundResponse, logActivity } from '@/lib/api-utils';
import { RoleType } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const booking = await db.booking.findUnique({
      where: { id },
      include: {
        customer: true,
        room: { include: { type: true } },
        creator: { select: { id: true, name: true, email: true, role: true } },
        charges: true,
        payments: true,
        restaurantOrders: { include: { items: { include: { menuItem: true } } } },
        invoices: true,
      },
    });

    if (!booking) {
      return notFoundResponse('Booking');
    }

    return successResponse(booking);
  } catch (error) {
    console.error('Booking fetch error:', error);
    return errorResponse('Failed to fetch booking', 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireRole(request, 'ADMIN' as RoleType, 'HOTEL_STAFF' as RoleType);
    if (authResult instanceof Response) return authResult;

    const { id } = await params;
    const body = await request.json();

    const existing = await db.booking.findUnique({ where: { id } });
    if (!existing) {
      return notFoundResponse('Booking');
    }

    // Don't allow updates to checked-out or cancelled bookings
    if (existing.status === 'CHECKED_OUT' || existing.status === 'CANCELLED') {
      return errorResponse('Cannot update a checked-out or cancelled booking');
    }

    const updateData: Record<string, unknown> = {};
    if (body.checkIn !== undefined) updateData.checkIn = new Date(body.checkIn);
    if (body.checkOut !== undefined) updateData.checkOut = new Date(body.checkOut);
    if (body.adults !== undefined) updateData.adults = parseInt(String(body.adults));
    if (body.children !== undefined) updateData.children = parseInt(String(body.children));
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.status !== undefined) updateData.status = body.status;

    // If room is being changed, verify it
    if (body.roomId && body.roomId !== existing.roomId) {
      const room = await db.room.findUnique({ where: { id: body.roomId } });
      if (!room) {
        return errorResponse('Room not found');
      }
      updateData.roomId = body.roomId;
    }

    // If dates changed, recalculate charges
    const newCheckIn = body.checkIn ? new Date(body.checkIn) : existing.checkIn;
    const newCheckOut = body.checkOut ? new Date(body.checkOut) : existing.checkOut;
    const roomId = (body.roomId as string) || existing.roomId;

    if (body.checkIn || body.checkOut || body.roomId) {
      const room = await db.room.findUnique({
        where: { id: roomId },
        include: { type: true },
      });

      if (room) {
        const diffMs = newCheckOut.getTime() - newCheckIn.getTime();
        const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (days > 0) {
          const totalRoomCharge = days * room.type.basePrice;
          updateData.totalRoomCharge = totalRoomCharge;
          updateData.dueAmount = totalRoomCharge - existing.advancePayment - existing.initialPayment;
        }
      }
    }

    const booking = await db.booking.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
        room: { include: { type: true } },
      },
    });

    await logActivity(
      authResult.id,
      'UPDATE_BOOKING',
      'hotel',
      JSON.stringify({ bookingId: id, changes: updateData })
    );

    return successResponse(booking, 'Booking updated successfully');
  } catch (error) {
    console.error('Booking update error:', error);
    return errorResponse('Failed to update booking', 500);
  }
}
