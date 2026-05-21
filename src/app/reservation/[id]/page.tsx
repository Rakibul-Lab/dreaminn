'use client'

import { useParams } from 'next/navigation'
import { ReservationDocumentView } from '@/components/erp/hotel/ReservationDocumentView'
import { AppDevelopedByFooter } from '@/components/AppDevelopedByFooter'

export default function ReservationPrintPage() {
  const params = useParams<{ id: string }>()
  const reservationId = params?.id

  if (!reservationId) {
    return <div className="p-8 text-red-600">Invalid reservation link.</div>
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 mx-auto w-full p-6 print:bg-white print:p-0 flex justify-center">
        <ReservationDocumentView
          reservationId={reservationId}
          showToolbar
          onClose={() => window.close()}
        />
      </main>
      <AppDevelopedByFooter printHidden />
    </div>
  )
}
