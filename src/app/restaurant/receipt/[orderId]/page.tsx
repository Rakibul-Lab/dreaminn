'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { PosThermalReceiptView } from '@/components/erp/restaurant/PosThermalReceiptView';

export default function RestaurantReceiptPage() {
  const params = useParams<{ orderId: string }>();
  const searchParams = useSearchParams();
  const orderId = params?.orderId;
  const autoPrint = searchParams.get('print') === '1';

  if (!orderId) {
    return <div className="p-8 text-red-600 text-sm">Invalid receipt link.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      <PosThermalReceiptView orderId={orderId} autoPrint={autoPrint} />
    </div>
  );
}
