import { db } from '@/lib/db'
import { normalizePhone, phonesMatch } from '@/lib/phone'

/** Find a customer by phone, matching +880 / 01 / 171… formats. */
export async function findCustomerByPhone(phone: string) {
  const normalized = normalizePhone(phone)
  if (!normalized || normalized.length < 10) return null

  const last10 = normalized.slice(-10)
  const candidates = await db.customer.findMany({
    where: {
      OR: [{ phone: { contains: last10 } }, { phone: normalized }],
    },
    take: 50,
    orderBy: { updatedAt: 'desc' },
  })

  return candidates.find((c) => phonesMatch(c.phone, phone)) ?? null
}
