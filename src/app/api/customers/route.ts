import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { successResponse, paginatedResponse, errorResponse, logActivity } from '@/lib/api-utils';
import { findCustomerByPhone } from '@/lib/customer-phone';
import { normalizePhone, isValidPhone } from '@/lib/phone';
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

    const orConditions: Record<string, unknown>[] = [];
    if (search) {
      orConditions.push(
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } }
      );
      const searchDigits = search.replace(/\D/g, '');
      if (searchDigits.length >= 6) {
        orConditions.push({ phone: { contains: searchDigits.slice(-10) } });
      }
    }
    if (name) {
      orConditions.push({ name: { contains: name } });
    }
    if (phone) {
      orConditions.push({ phone: { contains: phone } });
      const phoneDigits = phone.replace(/\D/g, '');
      if (phoneDigits.length >= 6) {
        orConditions.push({ phone: { contains: phoneDigits.slice(-10) } });
      }
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
    const { name, company, email, phone, address, idType, idNumber, dateOfBirth, idDocPath, notes } = body;

    if (!name?.trim() || !phone?.trim()) {
      return errorResponse('Name and phone are required');
    }

    if (!isValidPhone(phone)) {
      return errorResponse('Please enter a valid phone number (at least 10 digits)');
    }

    const normalizedPhone = normalizePhone(phone);

    const existing = await findCustomerByPhone(phone);
    if (existing) {
      return successResponse(
        existing,
        'Guest profile already exists for this phone — using existing record.',
        200
      );
    }

    const customer = await db.customer.create({
      data: {
        name: name.trim(),
        company: company?.trim() || null,
        email: email?.trim() || null,
        phone: normalizedPhone,
        address: address?.trim() || null,
        idType,
        idNumber,
        dateOfBirth,
        idDocPath,
        notes,
      },
    });

    await logActivity(
      authResult.id,
      'CREATE_CUSTOMER',
      'hotel',
      JSON.stringify({ customerId: customer.id, name: customer.name, phone: customer.phone })
    );

    return successResponse(customer, 'Customer created successfully', 201);
  } catch (error) {
    console.error('Customer creation error:', error);
    return errorResponse('Failed to create customer', 500);
  }
}
