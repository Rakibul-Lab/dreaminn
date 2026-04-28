import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { successResponse, paginatedResponse, errorResponse, logActivity } from '@/lib/api-utils';
import { RoleType } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search');
    const name = searchParams.get('name');
    const phone = searchParams.get('phone');

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    // Build OR conditions for search
    const orConditions: Record<string, unknown>[] = [];
    if (search) {
      orConditions.push(
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } }
      );
    }
    if (name) {
      orConditions.push({ name: { contains: name } });
    }
    if (phone) {
      orConditions.push({ phone: { contains: phone } });
    }

    if (orConditions.length > 0) {
      where.OR = orConditions;
    }

    const [customers, total] = await Promise.all([
      db.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.customer.count({ where }),
    ]);

    return paginatedResponse(customers, total, page, limit);
  } catch (error) {
    console.error('Customers list error:', error);
    return errorResponse('Failed to fetch customers', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = requireRole(request, 'ADMIN' as RoleType, 'HOTEL_STAFF' as RoleType);
    if (authResult instanceof Response) return authResult;

    const body = await request.json();
    const { name, email, phone, address, idType, idNumber, idDocPath, notes } = body;

    if (!name || !phone) {
      return errorResponse('Name and phone are required');
    }

    // Check for duplicate phone
    const existing = await db.customer.findFirst({ where: { phone } });
    if (existing) {
      return errorResponse('Customer with this phone number already exists');
    }

    const customer = await db.customer.create({
      data: {
        name,
        email,
        phone,
        address,
        idType,
        idNumber,
        idDocPath,
        notes,
      },
    });

    await logActivity(
      authResult.id,
      'CREATE_CUSTOMER',
      'hotel',
      JSON.stringify({ customerId: customer.id, name, phone })
    );

    return successResponse(customer, 'Customer created successfully', 201);
  } catch (error) {
    console.error('Customer creation error:', error);
    return errorResponse('Failed to create customer', 500);
  }
}
