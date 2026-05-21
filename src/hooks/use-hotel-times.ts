'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import {
  DEFAULT_HOTEL_TIMES,
  type HotelTimes,
  formatBookingCheckIn,
  formatBookingCheckOut,
  formatBookingCheckInShort,
  formatBookingCheckOutShort,
} from '@/lib/hotel-times'

type HotelSettingsResponse = {
  success: boolean
  data?: {
    checkInTime: string
    checkOutTime: string
  }
}

export function useHotelTimes() {
  const query = useQuery({
    queryKey: ['hotel-settings'],
    queryFn: () => api.get<HotelSettingsResponse>('/settings/hotel'),
    staleTime: 5 * 60 * 1000,
  })

  const times: HotelTimes =
    query.data?.success && query.data.data
      ? {
          checkInTime: query.data.data.checkInTime,
          checkOutTime: query.data.data.checkOutTime,
        }
      : DEFAULT_HOTEL_TIMES

  return {
    ...query,
    times,
    formatCheckIn: (value: string | Date) => formatBookingCheckIn(value, times),
    formatCheckOut: (value: string | Date) => formatBookingCheckOut(value, times),
    formatCheckInShort: (value: string | Date) => formatBookingCheckInShort(value, times),
    formatCheckOutShort: (value: string | Date) => formatBookingCheckOutShort(value, times),
  }
}
