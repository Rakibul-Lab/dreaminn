/**
 * Reset a user password on the server (SHA-256, same as the app).
 * Usage:
 *   export DATABASE_URL='mysql://user:pass@localhost:3306/db'
 *   node scripts/reset-user-password.js admin@erp.com newpassword
 */
const crypto = require('crypto')
const { PrismaClient } = require('@prisma/client')

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex')
}

async function main() {
  const email = process.argv[2]
  const password = process.argv[3]
  if (!email || !password) {
    console.error('Usage: node scripts/reset-user-password.js EMAIL NEW_PASSWORD')
    process.exit(1)
  }
  if (!process.env.DATABASE_URL) {
    console.error('Set DATABASE_URL first')
    process.exit(1)
  }

  const db = new PrismaClient()
  const hash = hashPassword(password)
  const user = await db.user.update({
    where: { email },
    data: { password: hash, active: true },
  })
  console.log(`Password updated for ${user.email}`)
  await db.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
