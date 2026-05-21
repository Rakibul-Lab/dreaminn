export const PAYMENT_METHOD_OPTIONS = [
  { value: 'NONE', label: 'None' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'MOBILE_BANKING', label: 'Mobile Banking' },
  { value: 'BKASH', label: 'bKash' },
  { value: 'NAGAD', label: 'Nagad' },
  { value: 'UPAY', label: 'Upay' },
] as const

/** Methods shown when recording an actual payment (check-in, checkout, etc.) */
export const PAYMENT_METHOD_OPTIONS_WITH_PAYMENT = PAYMENT_METHOD_OPTIONS.filter(
  (o) => o.value !== 'NONE'
)

export type PaymentMethodValue = (typeof PAYMENT_METHOD_OPTIONS)[number]['value']

const VALID_METHODS = new Set(PAYMENT_METHOD_OPTIONS.map((o) => o.value))

export function isValidPaymentMethod(method: string): method is PaymentMethodValue {
  return VALID_METHODS.has(method as PaymentMethodValue)
}

export function parsePaymentMethod(
  method: unknown,
  fallback: PaymentMethodValue = 'CASH'
): PaymentMethodValue {
  if (typeof method === 'string' && isValidPaymentMethod(method)) return method
  return fallback
}

export function parseReservationPaymentMethod(method: unknown): PaymentMethodValue {
  return parsePaymentMethod(method, 'NONE')
}

export function isNonePaymentMethod(method?: string | null): boolean {
  return method === 'NONE' || !method
}

export function formatPaymentMethod(method?: string | null): string {
  if (!method || method === 'NONE') return 'None'
  const match = PAYMENT_METHOD_OPTIONS.find((o) => o.value === method)
  return match?.label ?? method.replace(/_/g, ' ')
}

export function getAdvancePaymentMethod(
  payments?: { paymentType: string; method: string }[] | null
): string | null {
  const advance = payments?.find((p) => p.paymentType === 'ADVANCE')
  return advance?.method ?? null
}

/** Label for reservation confirmation "Form of payment" line */
export function formatFormOfPayment(
  advanceAmount: number,
  method?: string | null
): string {
  if (advanceAmount <= 0 || isNonePaymentMethod(method)) return 'Not paid at booking'
  return formatPaymentMethod(method)
}
