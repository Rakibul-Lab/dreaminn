import type { PrismaClient } from '@prisma/client';
import { hashPassword } from '@/lib/password';

const DEFAULT_HOTEL_FD = {
  email: 'fd@erp.com',
  name: 'Hotel Front Desk',
  password: 'fd123',
  role: 'HOTEL_FD' as const,
  phone: '+8801733333333',
};

/** Create missing built-in demo users (e.g. Hotel F.D. after role was added). */
export async function ensureDefaultUsers(db: PrismaClient): Promise<string[]> {
  const created: string[] = [];

  const existing = await db.user.findUnique({
    where: { email: DEFAULT_HOTEL_FD.email },
    select: { id: true },
  });

  if (!existing) {
    const passwordHash = await hashPassword(DEFAULT_HOTEL_FD.password);
    await db.user.create({
      data: {
        email: DEFAULT_HOTEL_FD.email,
        name: DEFAULT_HOTEL_FD.name,
        password: passwordHash,
        role: DEFAULT_HOTEL_FD.role,
        phone: DEFAULT_HOTEL_FD.phone,
      },
    });
    created.push(DEFAULT_HOTEL_FD.email);
  }

  return created;
}
