import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { RoleType } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const authResult = requireRole(
      request,
      'ADMIN' as RoleType,
      'HOTEL_STAFF' as RoleType,
      'HOTEL_FD' as RoleType,
      'RESTAURANT_STAFF' as RoleType
    );
    if (authResult instanceof Response) return authResult;

    // Fetch all rooms with OCCUPIED status
    const occupiedRooms = await db.room.findMany({
      where: { status: 'OCCUPIED' },
      include: {
        type: { select: { name: true } },
        bookings: {
          where: { status: 'CHECKED_IN' },
          select: { id: true },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { roomNumber: 'asc' },
    });

    // Map to the required format
    const result = occupiedRooms.map((room) => ({
      room_id: room.id,
      room_number: room.roomNumber,
      room_type: room.type.name,
      current_booking_id: room.bookings.length > 0 ? room.bookings[0].id : null,
    }));

    return successResponse(result);
  } catch (error) {
    console.error('Occupied rooms fetch error:', error);
    return errorResponse('Failed to fetch occupied rooms', 500);
  }
}
