export function openNewReservationTab() {
  if (typeof window === 'undefined') return
  window.open('/reservations/new', '_blank', 'noopener,noreferrer')
}
