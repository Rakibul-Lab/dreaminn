import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { successResponse, paginatedResponse, errorResponse, logActivity } from '@/lib/api-utils';
import { Prisma, RoleType } from '@prisma/client';
import { resolveBookingCheckInOut } from '@/lib/app-settings';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const floor = searchParams.get('floor');
    const typeId = searchParams.get('typeId');
    const forBooking = searchParams.get('forBooking') === 'true';
    const checkIn = searchParams.get('checkIn');
    const checkOut = searchParams.get('checkOut');

    const skip = (page - 1) * limit;

    const where: Prisma.RoomWhereInput = {};
    if (forBooking) {
      where.status = 'AVAILABLE';
    } else if (status) {
      where.status = status as Prisma.EnumRoomStatusFilter['equals'];
    }
    if (floor) where.floor = parseInt(floor);
    if (typeId) where.typeId = typeId;

    if (checkIn && checkOut) {
      try {
        const { checkIn: checkInDate, checkOut: checkOutDate } = await resolveBookingCheckInOut(
          checkIn,
          checkOut
        );
        where.NOT = {
          bookings: {
            some: {
              status: { in: ['RESERVED', 'CHECKED_IN'] },
              checkIn: { lt: checkOutDate },
              checkOut: { gt: checkInDate },
            },
          },
        };
      } catch {
        // Invalid date range — skip availability filter
      }
    }

    const [rooms, total] = await Promise.all([
      db.room.findMany({
        where,
        include: { type: true },
        skip,
        take: limit,
        orderBy: [
          { floor: 'asc' },
          { roomNumber: 'asc' },
        ],
      }),
      db.room.count({ where }),
    ]);

    return paginatedResponse(rooms, total, page, limit);
  } catch (error) {
    console.error('Rooms list error:', error);
    return errorResponse('Failed to fetch rooms', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = requireRole(request, 'ADMIN' as RoleType, 'HOTEL_STAFF' as RoleType);
    if (authResult instanceof Response) return authResult;

    const body = await request.json();
    const { roomNumber, floor, typeId, status } = body;

    if (!roomNumber || !typeId) {
      return errorResponse('Room number and type ID are required');
    }

    // Check if room number already exists
    const existing = await db.room.findUnique({ where: { roomNumber } });
    if (existing) {
      return errorResponse('Room number already exists');
    }

    // Verify room type exists
    const roomType = await db.roomType.findUnique({ where: { id: typeId } });
    if (!roomType) {
      return errorResponse('Room type not found');
    }

    const room = await db.room.create({
      data: {
        roomNumber,
        floor: floor || 1,
        typeId,
        status: status || 'AVAILABLE',
      },
      include: { type: true },
    });

    await logActivity(
      authResult.id,
      'CREATE_ROOM',
      'hotel',
      JSON.stringify({ roomId: room.id, roomNumber })
    );

    return successResponse(room, 'Room created successfully', 201);
  } catch (error) {
    console.error('Room creation error:', error);
    return errorResponse('Failed to create room', 500);
  }
}
