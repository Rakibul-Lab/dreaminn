import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

function maskDatabaseUrl(url: string | undefined) {
  if (!url) return null
  return url.replace(/:([^:@/]+)@/, ':****@')
}

export async function GET() {
  try {
    const userCount = await db.user.count()
    const sample = await db.user.findFirst({
      select: { email: true, active: true, role: true },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({
      success: true,
      connected: true,
      userCount,
      sampleUser: sample,
      database: maskDatabaseUrl(process.env.DATABASE_URL),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database connection failed'
    return NextResponse.json(
      {
        success: false,
        connected: false,
        error: message,
        database: maskDatabaseUrl(process.env.DATABASE_URL),
        hint: 'Set DATABASE_URL in cPanel env vars or create ~/dreaminn/.env then restart the app.',
      },
      { status: 500 }
    )
  }
}
