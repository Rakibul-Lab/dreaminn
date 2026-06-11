export function openRestaurantReceiptTab(orderId: string, options?: { autoPrint?: boolean }) {
  if (typeof window === 'undefined') return
  const query = options?.autoPrint ? '?print=1' : ''
  window.open(`/restaurant/receipt/${orderId}${query}`, '_blank', 'noopener,noreferrer')
}
