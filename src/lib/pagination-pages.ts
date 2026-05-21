export type PaginationPageItem = number | 'ellipsis'

/** Page numbers with ellipsis for large page counts (e.g. 1 … 4 5 6 … 20). */
export function getPaginationPages(
  currentPage: number,
  totalPages: number
): PaginationPageItem[] {
  if (totalPages <= 0) return []
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const items: PaginationPageItem[] = [1]

  if (currentPage > 3) items.push('ellipsis')

  const start = Math.max(2, currentPage - 1)
  const end = Math.min(totalPages - 1, currentPage + 1)
  for (let i = start; i <= end; i++) items.push(i)

  if (currentPage < totalPages - 2) items.push('ellipsis')
  items.push(totalPages)

  return items.filter((item, index, arr) => index === 0 || item !== arr[index - 1])
}
