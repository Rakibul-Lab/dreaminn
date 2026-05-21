import { db } from '@/lib/db'

const ID_DOC_PREFIX = '/uploads/id-docs/'

function isSafeIdDocPath(path: string | null | undefined): path is string {
  return typeof path === 'string' && path.startsWith(ID_DOC_PREFIX)
}

/** Collect ID image paths from guest profile and their most recent booking attachments. */
export async function getCustomerIdDocumentPaths(customerId: string): Promise<string[]> {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { idDocPath: true },
  })

  if (!customer) return []

  const paths: string[] = []

  if (isSafeIdDocPath(customer.idDocPath)) {
    paths.push(customer.idDocPath)
  }

  const latestBooking = await db.booking.findFirst({
    where: {
      customerId,
      idDocuments: { some: {} },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      idDocuments: { orderBy: { sortOrder: 'asc' } },
    },
  })

  if (latestBooking) {
    for (const doc of latestBooking.idDocuments) {
      if (isSafeIdDocPath(doc.filePath) && !paths.includes(doc.filePath)) {
        paths.push(doc.filePath)
      }
    }
  }

  return paths
}
