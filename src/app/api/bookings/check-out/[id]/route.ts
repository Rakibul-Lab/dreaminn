import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, notFoundResponse, logActivity, generateInvoiceNumber } from '@/lib/api-utils';
import { RoleType } from '@prisma/client';
import { parsePaymentMethod } from '@/lib/payment-method';
import { computeLateCheckoutFee } from '@/lib/app-settings';
import { sumBookingNetPaid } from '@/lib/booking-totals';
import {
  bookingDueAfterPayments,
  computeCheckoutSettlement,
} from '@/lib/checkout-settlement';
import { buildInvoiceLineItems, replaceInvoiceLineItems } from '@/lib/invoice-line-items';

async function loadCheckoutBooking(id: string) {
  return db.booking.findUnique({
    where: { id },
    include: {
      room: { include: { type: true } },
      customer: true,
      charges: true,
    },
  });
}

async function getDefaultDiscountPercent(): Promise<number> {
  const discountSetting = await db.setting.findUnique({
    where: { key: 'default_discount_percent' },
  });
  return discountSetting ? parseFloat(discountSetting.value) || 0 : 0;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireRole(request, 'ADMIN' as RoleType, 'HOTEL_STAFF' as RoleType);
    if (authResult instanceof Response) return authResult;

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const adjustStayEnabled = searchParams.get('adjustStay') === 'true';
    const chargeableNightsParam = searchParams.get('chargeableNights');
    const chargeableNights =
      chargeableNightsParam != null ? parseInt(chargeableNightsParam, 10) : null;
    const stayAdjustmentMode =
      searchParams.get('stayMode') === 'extend' ? ('extend' as const) : ('shrink' as const);
    const includeExtraCharges = searchParams.get('includeExtraCharges') !== 'false';

    const booking = await loadCheckoutBooking(id);
    if (!booking) return notFoundResponse('Booking');
    if (booking.status !== 'CHECKED_IN') {
      return errorResponse('Only checked-in bookings can be checked out');
    }

    const now = new Date();
    const { amount: lateCheckoutCharge } = await computeLateCheckoutFee(booking.checkOut, now);
    const restaurantOrders = await db.restaurantOrder.findMany({
      where: { bookingId: id, status: { not: 'CANCELLED' } },
    });
    const bookingPayments = await db.payment.findMany({
      where: { bookingId: id },
      select: { amount: true, paymentType: true },
    });

    const settlement = computeCheckoutSettlement({
      booking,
      nightlyRate: booking.room.type.basePrice,
      restaurantOrders,
      lateCheckoutCharge,
      payments: bookingPayments,
      defaultDiscountPercent: await getDefaultDiscountPercent(),
      includeExtraCharges,
      asOf: now,
    });

    return successResponse({
      bookingId: id,
      customerName: booking.customer.name,
      roomNumber: booking.room.roomNumber,
      roomTypeName: booking.room.type.name,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      actualCheckIn: booking.actualCheckIn,
      checkoutAt: now,
      ...settlement,
    });
  } catch (error) {
    console.error('Check-out preview error:', error);
    return errorResponse('Failed to load check-out preview', 500);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireRole(request, 'ADMIN' as RoleType, 'HOTEL_STAFF' as RoleType);
    if (authResult instanceof Response) return authResult;

    const authUser = await db.user.findUnique({
      where: { id: authResult.id },
      select: { id: true, active: true },
    });
    if (!authUser || !authUser.active) {
      return errorResponse('Session expired. Please log out and log in again.', 401);
    }

    const { id } = await params;
    const body = await request.json();
    const finalPayment = Number(body?.finalPayment || 0);
    const paymentMethod = parsePaymentMethod(body?.paymentMethod, 'CASH');
    const paymentReference = body?.paymentReference || null;
    const paymentNotes = body?.paymentNotes || null;
    const includeExtraCharges = body?.includeExtraCharges !== false;

    const booking = await loadCheckoutBooking(id);
    if (!booking) return notFoundResponse('Booking');
    if (booking.status !== 'CHECKED_IN') {
      return errorResponse('Only checked-in bookings can be checked out');
    }

    const now = new Date();
    const { amount: lateCheckoutCharge, hoursLate } = await computeLateCheckoutFee(
      booking.checkOut,
      now
    );

    if (includeExtraCharges && lateCheckoutCharge > 0) {
      const hasLateCharge = booking.charges.some((c) => c.chargeType === 'LATE_CHECKOUT');
      if (!hasLateCharge) {
        await db.roomCharge.create({
          data: {
            bookingId: id,
            chargeType: 'LATE_CHECKOUT',
            description: `Late checkout - ${hoursLate} hour(s) after scheduled time`,
            amount: lateCheckoutCharge,
            quantity: 1,
            chargeDate: now,
          },
        });
      }
      booking.charges = await db.roomCharge.findMany({ where: { bookingId: id } });
    }

    const restaurantOrders = await db.restaurantOrder.findMany({
      where: { bookingId: id, status: { not: 'CANCELLED' } },
    });
    let bookingPayments = await db.payment.findMany({
      where: { bookingId: id },
      select: { amount: true, paymentType: true },
    });

    const settlement = computeCheckoutSettlement({
      booking,
      nightlyRate: booking.room.type.basePrice,
      restaurantOrders,
      lateCheckoutCharge,
      payments: bookingPayments,
      defaultDiscountPercent: await getDefaultDiscountPercent(),
      includeExtraCharges,
      asOf: now,
    });

    const {
      roomCharges,
      foodCharges,
      extraCharges,
      subtotal,
      discount,
      vatAmount,
      totalAmount,
      totalPaid: totalPaidBeforeFinal,
      dueBeforeSettlement: finalDueAmount,
      creditAmount,
      chargeableNights: settledNights,
      nightlyRate,
      hotelVat,
      restaurantVat,
      vatApplied,
      vatPercent,
    } = settlement;

    if (finalDueAmount > 0 && finalPayment < finalDueAmount) {
      return errorResponse(
        `Due amount must be fully cleared to checkout. Required: ৳${finalDueAmount.toFixed(2)}`
      );
    }

    if (finalPayment > 0) {
      await db.payment.create({
        data: {
          amount: finalPayment,
          method: paymentMethod,
          paymentType: 'FINAL',
          bookingId: id,
          receivedBy: authUser.id,
          reference: paymentReference,
          notes: paymentNotes || 'Final payment at check-out',
        },
      });
      bookingPayments = await db.payment.findMany({
        where: { bookingId: id },
        select: { amount: true, paymentType: true },
      });
    }

    const totalPaidAfter = sumBookingNetPaid(bookingPayments);
    const dueAmount = bookingDueAfterPayments(booking.totalRoomCharge, totalPaidAfter, booking);

    const updatedBooking = await db.booking.update({
      where: { id },
      data: {
        status: 'CHECKED_OUT',
        actualCheckOut: now,
        dueAmount,
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

    await db.room.update({
      where: { id: booking.roomId },
      data: { status: 'CLEANING' },
    });

    await db.housekeepingTask.create({
      data: {
        roomId: booking.roomId,
        taskType: 'cleaning',
        status: 'PENDING',
        assignedTo: authUser.id,
        notes: `Post-checkout cleaning for room ${booking.room.roomNumber}`,
      },
    });

    const existingInvoice = await db.invoice.findFirst({
      where: { bookingId: id, status: { not: 'CANCELLED' } },
    });

    const restaurantOrdersWithItems = await db.restaurantOrder.findMany({
      where: { bookingId: id, status: { not: 'CANCELLED' } },
      include: {
        items: {
          include: { menuItem: { select: { name: true } } },
        },
      },
    });

    const lineItems = buildInvoiceLineItems({
      roomNumber: updatedBooking.room.roomNumber,
      roomTypeName: updatedBooking.room.type.name,
      checkIn: updatedBooking.checkIn,
      checkOut: updatedBooking.checkOut,
      charges: updatedBooking.charges,
      restaurantOrders: restaurantOrdersWithItems,
      roomCharges,
      chargeableNights: settledNights,
      nightlyRate,
      stayAdjusted: settlement.stayAdjusted,
      includeExtraCharges,
      discount,
      hotelVat,
      hotelVatPercent: vatPercent,
      vatApplied,
      restaurantVat,
    });

    const paidAmount = sumBookingNetPaid(bookingPayments);
    const invoiceDue = Math.max(0, totalAmount - paidAmount);
    const invoiceStatus = invoiceDue <= 0 ? 'PAID' : 'ISSUED';

    const invoicePayload = {
      roomCharges,
      foodCharges,
      extraCharges,
      subtotal,
      discount,
      vatAmount,
      totalAmount,
      paidAmount,
      dueAmount: invoiceDue,
      status: invoiceStatus,
      issuedAt: now,
      paidAt: invoiceStatus === 'PAID' ? now : null,
    };

    let generatedInvoiceId: string | null = null;
    await db.$transaction(async (tx) => {
      if (existingInvoice) {
        await tx.invoice.update({
          where: { id: existingInvoice.id },
          data: invoicePayload,
        });
        await replaceInvoiceLineItems(tx, existingInvoice.id, lineItems);
        generatedInvoiceId = existingInvoice.id;
      } else {
        const invoice = await tx.invoice.create({
          data: {
            invoiceNumber: generateInvoiceNumber(),
            bookingId: id,
            ...invoicePayload,
          },
        });
        await replaceInvoiceLineItems(tx, invoice.id, lineItems);
        generatedInvoiceId = invoice.id;
      }
    });

    await logActivity(
      authUser.id,
      'CHECK_OUT',
      'hotel',
      JSON.stringify({
        bookingId: id,
        roomId: booking.roomId,
        customerName: booking.customer.name,
        chargeableNights: settledNights,
        bookedNights: settlement.bookedNights,
        actualStayNights: settlement.actualStayNights,
        lateCheckoutCharge,
        roomCharges,
        totalAmount,
        finalPayment,
        finalDueAmount,
        creditAmount,
        invoiceId: generatedInvoiceId,
      })
    );

    return successResponse(
      {
        booking: updatedBooking,
        invoiceId: generatedInvoiceId,
        creditAmount,
        stayAdjusted: settlement.stayAdjusted,
      },
      creditAmount > 0
        ? `Check-out complete. Guest overpaid by ৳${creditAmount.toFixed(2)} — issue refund if needed.`
        : 'Check-out successful and invoice generated'
    );
  } catch (error) {
    console.error('Check-out error:', error);
    return errorResponse('Failed to check out', 500);
  }
}
