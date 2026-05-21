import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, canAccessHotel, canAccessRestaurant } from '@/lib/auth';
import { successResponse, errorResponse, paginatedResponse, logActivity } from '@/lib/api-utils';
import { bookingVatOptions, computeRoomBookingTotals, sumBookingNetPaid } from '@/lib/booking-totals';
import { PaymentType, PaymentMethod } from '@prisma/client';

// GET /api/payments - List payments with filters
export async function GET(request: NextRequest) {
  try {
    const authResult = requireAuth(request);
    if (authResult instanceof Response) return authResult;

    const user = authResult;
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const bookingId = searchParams.get('bookingId');
    const orderId = searchParams.get('orderId');
    const paymentType = searchParams.get('paymentType') as PaymentType | null;
    const method = searchParams.get('method') as PaymentMethod | null;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const skip = (page - 1) * limit;

    // Build where clause with role-based filtering
    const where: Record<string, unknown> = {};

    // Role-based access control
    if (user.role === 'HOTEL_STAFF') {
      // Hotel staff can only see hotel-related payments
      where.bookingId = { not: null };
    } else if (user.role === 'RESTAURANT_STAFF') {
      // Restaurant staff can only see restaurant payments
      where.orderId = { not: null };
    }
    // ADMIN can see all

    // Apply filters
    if (bookingId) {
      where.bookingId = where.bookingId ? { ...where.bookingId as object, equals: bookingId } : bookingId;
    }
    if (orderId) {
      where.orderId = where.orderId ? { ...where.orderId as object, equals: orderId } : orderId;
    }
    if (paymentType) {
      where.paymentType = paymentType;
    }
    if (method) {
      where.method = method;
    }

    // Date range filter
    if (startDate || endDate) {
      const createdAt: Record<string, unknown> = {};
      if (startDate) createdAt.gte = new Date(startDate);
      if (endDate) createdAt.lte = new Date(endDate);
      where.createdAt = createdAt;
    }

    const [payments, total] = await Promise.all([
      db.payment.findMany({
        where,
        include: {
          booking: {
            select: {
              id: true,
              customer: { select: { id: true, name: true } },
              room: { select: { id: true, roomNumber: true } },
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
              orderType: true,
            },
          },
          receiver: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.payment.count({ where }),
    ]);

    return paginatedResponse(payments, total, page, limit);
  } catch (error) {
    console.error('Error listing payments:', error);
    return errorResponse('Failed to fetch payments', 500);
  }
}

// POST /api/payments - Create payment record
export async function POST(request: NextRequest) {
  try {
    const authResult = requireAuth(request);
    if (authResult instanceof Response) return authResult;

    const user = authResult;
    const body = await request.json();
    const { amount, method, paymentType, bookingId, orderId, invoiceId, reference, notes } = body;

    // Validate amount
    if (!amount || amount <= 0) {
      return errorResponse('Payment amount must be greater than 0');
    }

    if (!paymentType) {
      return errorResponse('Payment type is required');
    }

    if (!method) {
      return errorResponse('Payment method is required');
    }

    // Role-based validation
    if (bookingId && !canAccessHotel(user.role)) {
      return errorResponse('You do not have permission to create hotel payments', 403);
    }

    if (orderId && !canAccessRestaurant(user.role)) {
      return errorResponse('You do not have permission to create restaurant payments', 403);
    }

    // Validate booking exists if provided
    if (bookingId) {
      const booking = await db.booking.findUnique({ where: { id: bookingId } });
      if (!booking) {
        return errorResponse('Booking not found', 404);
      }
    }

    // Validate order exists if provided
    if (orderId) {
      const order = await db.restaurantOrder.findUnique({ where: { id: orderId } });
      if (!order) {
        return errorResponse('Order not found', 404);
      }
    }

    // Validate invoice exists if provided
    if (invoiceId) {
      const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) {
        return errorResponse('Invoice not found', 404);
      }
    }

    // Create payment
    const payment = await db.payment.create({
      data: {
        amount,
        method,
        paymentType,
        bookingId: bookingId || null,
        orderId: orderId || null,
        invoiceId: invoiceId || null,
        reference: reference || null,
        notes: notes || null,
        receivedBy: user.id,
      },
      include: {
        booking: {
          select: {
            id: true,
            dueAmount: true,
            customer: { select: { id: true, name: true } },
          },
        },
        order: {
          select: { id: true, orderNumber: true },
        },
      },
    });

    // Update booking dueAmount (VAT-inclusive room total minus all payments)
    if (bookingId) {
      const booking = await db.booking.findUnique({ where: { id: bookingId } });
      if (booking) {
        const paymentRows = await db.payment.findMany({
          where: { bookingId },
          select: { amount: true, paymentType: true },
        });
        const totalPaid = sumBookingNetPaid(paymentRows);
        const { dueAmount } = computeRoomBookingTotals(
          booking.totalRoomCharge,
          totalPaid,
          bookingVatOptions(booking)
        );
        await db.booking.update({
          where: { id: bookingId },
          data: { dueAmount },
        });
      }
    }

    // Log activity
    await logActivity(
      user.id,
      'PAYMENT_CREATED',
      'billing',
      JSON.stringify({
        paymentId: payment.id,
        amount,
        method,
        paymentType,
        bookingId: bookingId || undefined,
        orderId: orderId || undefined,
      })
    );

    return successResponse(payment, 'Payment recorded successfully', 201);
  } catch (error) {
    console.error('Error creating payment:', error);
    return errorResponse('Failed to record payment', 500);
  }
}
