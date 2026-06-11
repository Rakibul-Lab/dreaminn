'use client';

import { CloudViewRestaurantLedgerView } from '@/components/erp/restaurant/CloudViewRestaurantLedgerView';
import { AppDevelopedByFooter } from '@/components/AppDevelopedByFooter';
import { Button } from '@/components/ui/button';

export default function CloudViewRestaurantLedgerPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6">
        <div className="mb-4 flex justify-end print:hidden">
          <Button variant="outline" size="sm" onClick={() => window.close()}>
            Close tab
          </Button>
        </div>
        <CloudViewRestaurantLedgerView />
      </main>
      <AppDevelopedByFooter printHidden />
    </div>
  );
}
