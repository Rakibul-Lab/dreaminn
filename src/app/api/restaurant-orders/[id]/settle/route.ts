import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, canAccessRestaurant } from '@/lib/auth';
import { successResponse, errorResponse, notFoundResponse, logActivity } from '@/lib/api-utils';
import { parsePaymentMethod } from '@/lib/payment-method';
import { computeOrderDue } from '@/lib/restaurant-order-dues';
import { resolveRestaurantSettlementSource } from '@/lib/restaurant-order-settle';
import { settleRestaurantOrderInTx } from '@/lib/restaurant-order-settle';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireAuth(request);
    if (authResult instanceof Response) return authResult;

    if (!canAccessRestaurant(authResult.role) && authResult.role !== 'HOTEL_STAFF' && authResult.role !== 'HOTEL_FD') {
      return errorResponse('You do not have permission to settle restaurant orders', 403);
    }

    const { id } = await params;
    const body = await request.json();
    const settleFull = body?.settleFull === true;
    const amountInput = settleFull ? null : Number(body?.amount);
    const method = parsePaymentMethod(body?.method, 'CASH');
    const reference = body?.reference ? String(body.reference).trim() : '';
    const notes = body?.notes ? String(body.notes).trim() : null;

    if (method === 'NONE') {
      return errorResponse('Invalid payment method');
    }
    const resolvedReference =
      reference || (method === 'CASH' ? `CASH-${id.slice(-8)}` : '');
    if (!resolvedReference) {
      return errorResponse('Transaction / receipt number is required');
    }

    const order = await db.restaurantOrder.findUnique({
      where: { id },
      include: {
        payments: { select: { amount: true, paymentType: true } },
        companyLedgerBill: { select: { id: true } },
      },
    });

    if (!order) return notFoundResponse('Restaurant order');

    const settlementSource =
      authResult.role === 'RESTAURANT_STAFF' || authResult.role === 'ADMIN'
        ? 'RESTAURANT_DIRECT'
        : resolveRestaurantSettlementSource(authResult.role);

    if (order.billingDisposition === 'HOTEL_BILL' || order.companyLedgerBill) {
      return errorResponse('This order was sent to hotel billing and cannot be paid here', 400);
    }
    if (order.billingDisposition === 'PAID_DIRECT') {
      return errorResponse('This order is already paid', 400);
    }

    const { dueAmount } = computeOrderDue(order.totalAmount, order.payments);
    const amount = settleFull ? dueAmount : amountInput;

    const result = await db.$transaction(async (tx) =>
      settleRestaurantOrderInTx(tx, order, {
        amount: amount!,
        method,
        reference: resolvedReference,
        notes,
        settlementSource,
        receivedBy: authResult.id,
      })
    );

    await logActivity(
      authResult.id,
      'RESTAURANT_ORDER_SETTLED',
      'billing',
      JSON.stringify({
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: result.payment.amount,
        method,
        reference: resolvedReference,
        settlementSource: result.payment.settlementSource,
        remainingDue: result.remainingDue,
      })
    );

    return successResponse(
      {
        payment: result.payment,
        orderId: order.id,
        orderNumber: order.orderNumber,
        paidAmount: result.payment.amount,
        remainingDue: result.remainingDue,
        isFullySettled: result.remainingDue <= 0.009,
      },
      result.remainingDue <= 0.009 ? 'Order fully settled' : 'Partial payment recorded'
    );
  } catch (error) {
    console.error('Restaurant order settle error:', error);
    const message = error instanceof Error ? error.message : 'Failed to settle restaurant order';
    return errorResponse(message, 500);
  }
}
