'use client'

import { Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { InvoicePrintView } from '@/components/erp/billing/InvoicePrintView'

function InvoicePrintPageContent() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const invoiceId = params?.id
  const fromCheckout = searchParams.get('from') === 'checkout'
  const successMsg = searchParams.get('msg')

  if (!invoiceId) {
    return <div className="p-8 text-red-600">Invalid invoice link.</div>
  }

  return (
    <InvoicePrintView
      invoiceId={invoiceId}
      title={fromCheckout ? 'Check-out invoice' : 'Guest invoice'}
      successBanner={
        fromCheckout
          ? successMsg
            ? decodeURIComponent(successMsg)
            : 'Check-out complete. Print or download the invoice below.'
          : undefined
      }
      onClose={() => window.close()}
    />
  )
}

export default function InvoicePrintPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading invoice...</div>}>
      <InvoicePrintPageContent />
    </Suspense>
  )
}
