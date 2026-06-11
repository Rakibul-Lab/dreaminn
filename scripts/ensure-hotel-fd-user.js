const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function main() {
  const email = 'fd@erp.com';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`User already exists: ${email} (${existing.role})`);
    return;
  }

  const password = await hashPassword('fd123');
  await prisma.user.create({
    data: {
      email,
      name: 'Hotel Front Desk',
      password,
      role: 'HOTEL_FD',
      phone: '+8801733333333',
    },
  });
  console.log(`Created ${email} with password fd123 (role HOTEL_FD)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
