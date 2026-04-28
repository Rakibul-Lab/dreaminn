'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Construction } from 'lucide-react';

export function PlaceholderPage() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <Construction className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Coming Soon</h2>
          <p className="text-sm text-muted-foreground">
            This module is under development. Check back soon for updates!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
