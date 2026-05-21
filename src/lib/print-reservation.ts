/** Print reservation without browser header/footer text (title, URL, date). */
export function printReservationDocument(): void {
  const previousTitle = document.title
  document.title = ' '

  const restore = () => {
    document.title = previousTitle
    window.removeEventListener('afterprint', restore)
  }

  window.addEventListener('afterprint', restore)
  window.print()
}
