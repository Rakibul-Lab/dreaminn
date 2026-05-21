/** Open guest check-out settlement in a new browser tab. */
export function openCheckoutTab(bookingId: string): void {
  window.open(`/checkout/${bookingId}`, '_blank', 'noopener,noreferrer')
}
