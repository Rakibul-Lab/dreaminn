import { computeOrderDue } from '@/lib/restaurant-order-dues'

export type OrderBillingState = 'PENDING' | 'HOTEL_BILL' | 'PAID_DIRECT'

type BillingOrder = {
  billingDisposition?: string | null
  companyLedgerBill?: { id: string } | null
  payments?: { amount: number; paymentType: string }[]
  totalAmount: number
}

export function resolveOrderBillingState(order: BillingOrder): OrderBillingState {
  if (order.billingDisposition === 'HOTEL_BILL' || order.companyLedgerBill) {
    return 'HOTEL_BILL'
  }
  const { isSettled } = computeOrderDue(order.totalAmount, order.payments ?? [])
  if (order.billingDisposition === 'PAID_DIRECT' || isSettled) {
    return 'PAID_DIRECT'
  }
  return 'PENDING'
}

export function canSendOrderToHotel(order: {
  orderType: string
  status: string
  billingDisposition?: string | null
  companyLedgerBill?: { id: string } | null
  payments?: { amount: number; paymentType: string }[]
  totalAmount: number
}): boolean {
  if (order.orderType !== 'ROOM_SERVICE') return false
  if (order.status !== 'DELIVERED') return false
  if (resolveOrderBillingState(order) !== 'PENDING') return false
  const { paidAmount } = computeOrderDue(order.totalAmount, order.payments ?? [])
  return paidAmount <= 0.009
}

export function canPayOrderDirectly(order: {
  status: string
  billingDisposition?: string | null
  companyLedgerBill?: { id: string } | null
  payments?: { amount: number; paymentType: string }[]
  totalAmount: number
}): boolean {
  if (order.status !== 'DELIVERED') return false
  if (resolveOrderBillingState(order) !== 'PENDING') return false
  const { dueAmount } = computeOrderDue(order.totalAmount, order.payments ?? [])
  return dueAmount > 0.009
}

export function formatOrderBillingState(state: OrderBillingState): string {
  switch (state) {
    case 'HOTEL_BILL':
      return 'Sent to hotel'
    case 'PAID_DIRECT':
      return 'Paid'
    default:
      return 'Awaiting action'
  }
}
