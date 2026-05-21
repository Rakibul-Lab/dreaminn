'use client'

import { useParams } from 'next/navigation'
import { CheckoutPageView } from '@/components/erp/hotel/CheckoutPageView'
import { Button } from '@/components/ui/button'
import { AppDevelopedByFooter } from '@/components/AppDevelopedByFooter'

export default function CheckoutTabPage() {
  const params = useParams<{ id: string }>()
  const bookingId = params?.id

  if (!bookingId) {
    return <div className="p-8 text-red-600">Invalid check-out link.</div>
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm print:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Guest check-out</h1>
            <p className="text-xs text-muted-foreground">
              Settle the stay, then print or download the invoice on this tab
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.close()}>
            Close tab
          </Button>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-6">
        <CheckoutPageView bookingId={bookingId} />
      </main>
      <AppDevelopedByFooter printHidden />
    </div>
  )
}
