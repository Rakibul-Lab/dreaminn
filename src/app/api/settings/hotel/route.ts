import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-utils'
import {
  getEarlyCheckoutSettings,
  getHotelCheckInOutTimes,
  getHotelName,
  getHotelVatPercent,
  getLateCheckoutSettings,
} from '@/lib/app-settings'
import { RoleType } from '@prisma/client'

/** Hotel operational settings for reservations, checkout, and documents. */
export async function GET(request: NextRequest) {
  try {
    const authResult = requireRole(
      request,
      'ADMIN' as RoleType,
      'HOTEL_STAFF' as RoleType,
      'HOTEL_FD' as RoleType
    )
    if (authResult instanceof Response) return authResult

    const [hotelName, vatPercent, hotelTimes, lateCheckout, earlyCheckout] = await Promise.all([
      getHotelName(),
      getHotelVatPercent(),
      getHotelCheckInOutTimes(),
      getLateCheckoutSettings(),
      getEarlyCheckoutSettings(),
    ])

    return successResponse({
      hotelName,
      vatPercent,
      vatAppliedByDefault: true,
      checkInTime: hotelTimes.checkInTime,
      checkOutTime: hotelTimes.checkOutTime,
      lateCheckoutCharge: lateCheckout.charge,
      lateCheckoutHour: lateCheckout.checkoutHour,
      earlyCheckoutFeePercent: earlyCheckout.feePercent,
      earlyCheckoutFeeAmount: earlyCheckout.feeAmount,
    })
  } catch (error) {
    console.error('Hotel settings error:', error)
    return errorResponse('Failed to load hotel settings', 500)
  }
}
