import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, notFoundResponse, logActivity } from '@/lib/api-utils';
import { RoleType } from '@prisma/client';

export async function GET() {
  try {
    const roomTypes = await db.roomType.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { rooms: true } },
      },
    });

    return successResponse(roomTypes);
  } catch (error) {
    console.error('Room types list error:', error);
    return errorResponse('Failed to fetch room types', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = requireRole(request, 'ADMIN' as RoleType);
    if (authResult instanceof Response) return authResult;

    const body = await request.json();
    const { name, description, basePrice, capacity, hourlyRate, amenities } = body;

    if (!name || basePrice === undefined) {
      return errorResponse('Name and base price are required');
    }

    // Check for duplicate name
    const existing = await db.roomType.findUnique({ where: { name } });
    if (existing) {
      return errorResponse('Room type with this name already exists');
    }

    const roomType = await db.roomType.create({
      data: {
        name,
        description,
        basePrice: parseFloat(String(basePrice)),
        capacity: capacity || 2,
        hourlyRate: hourlyRate ? parseFloat(String(hourlyRate)) : null,
        amenities: amenities ? (typeof amenities === 'string' ? amenities : JSON.stringify(amenities)) : null,
      },
    });

    await logActivity(
      authResult.id,
      'CREATE_ROOM_TYPE',
      'hotel',
      JSON.stringify({ roomTypeId: roomType.id, name })
    );

    return successResponse(roomType, 'Room type created successfully', 201);
  } catch (error) {
    console.error('Room type creation error:', error);
    return errorResponse('Failed to create room type', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = requireRole(request, 'ADMIN' as RoleType);
    if (authResult instanceof Response) return authResult;

    const body = await request.json();
    const { id, name, description, basePrice, capacity, hourlyRate, amenities } = body;

    if (!id) {
      return errorResponse('Room type ID is required');
    }

    const existing = await db.roomType.findUnique({ where: { id } });
    if (!existing) {
      return notFoundResponse('Room type');
    }

    // Check for duplicate name if name is being changed
    if (name && name !== existing.name) {
      const duplicate = await db.roomType.findUnique({ where: { name } });
      if (duplicate) {
        return errorResponse('Room type with this name already exists');
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (basePrice !== undefined) updateData.basePrice = parseFloat(String(basePrice));
    if (capacity !== undefined) updateData.capacity = parseInt(String(capacity));
    if (hourlyRate !== undefined) updateData.hourlyRate = hourlyRate ? parseFloat(String(hourlyRate)) : null;
    if (amenities !== undefined) updateData.amenities = typeof amenities === 'string' ? amenities : JSON.stringify(amenities);

    const roomType = await db.roomType.update({
      where: { id },
      data: updateData,
    });

    await logActivity(
      authResult.id,
      'UPDATE_ROOM_TYPE',
      'hotel',
      JSON.stringify({ roomTypeId: id, changes: updateData })
    );

    return successResponse(roomType, 'Room type updated successfully');
  } catch (error) {
    console.error('Room type update error:', error);
    return errorResponse('Failed to update room type', 500);
  }
}
