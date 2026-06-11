import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api-utils';
import { getRestaurantName } from '@/lib/app-settings';
import { formatPaymentMethod } from '@/lib/payment-method';
import { resolveOrderBillingState } from '@/lib/restaurant-order-billing';
import { formatOrderTypeLabel } from '@/lib/restaurant-order-dues';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireAuth(request);
    if (authResult instanceof Response) return authResult;

    const { id } = await params;

    const order = await db.restaurantOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            menuItem: { select: { name: true, isVeg: true } },
          },
        },
        room: { select: { roomNumber: true } },
        table: { select: { tableNumber: true } },
        payments: {
          orderBy: { createdAt: 'asc' },
          include: {
            receiver: { select: { name: true } },
          },
        },
        companyLedgerBill: { select: { id: true } },
      },
    });

    if (!order) return notFoundResponse('Restaurant order');

    const billingState = resolveOrderBillingState(order);
    if (billingState !== 'PAID_DIRECT') {
      return errorResponse('Receipt is available only for paid orders', 400);
    }

    const restaurantName = await getRestaurantName();
    const latestPayment = order.payments[order.payments.length - 1];

    return successResponse({
      restaurantName,
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      orderTypeLabel: formatOrderTypeLabel(order.orderType),
      createdAt: order.createdAt,
      roomNumber: order.room?.roomNumber ?? null,
      tableNumber: order.table?.tableNumber ?? null,
      customerName: order.customerName,
      items: order.items.map((item) => ({
        name: item.menuItem.name,
        quantity: item.quantity,
        unitPrice: item.price,
        lineTotal: item.price * item.quantity,
        isVeg: item.menuItem.isVeg,
      })),
      subtotal: order.subtotal,
      discount: order.discount,
      vatPercent: order.vatPercent,
      vatAmount: order.vatAmount,
      totalAmount: order.totalAmount,
      payment: latestPayment
        ? {
            amount: latestPayment.amount,
            method: latestPayment.method,
            methodLabel: formatPaymentMethod(latestPayment.method),
            reference: latestPayment.reference,
            receivedBy: latestPayment.receiver?.name ?? null,
            paidAt: latestPayment.createdAt,
          }
        : null,
    });
  } catch (error) {
    console.error('Restaurant receipt error:', error);
    return errorResponse('Failed to load receipt', 500);
  }
}
