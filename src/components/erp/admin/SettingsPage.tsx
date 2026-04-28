'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAuthStore, canAccessAdmin } from '@/lib/auth-store'
import { useToast } from '@/hooks/use-toast'
import {
  Settings, Save, Hotel, UtensilsCrossed, Wrench, RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

interface SettingItem {
  id: string
  key: string
  value: string
}

export default function SettingsPage() {
  const { user } = useAuthStore()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [editedValues, setEditedValues] = useState<Record<string, string>>({})

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { settings: SettingItem[]; grouped: Record<string, SettingItem[]> } }>('/settings')
      return res.data
    },
    enabled: !!user && canAccessAdmin(user?.role),
  })

  const saveMutation = useMutation({
    mutationFn: async (updates: Array<{ key: string; value: string }>) => {
      return api.put('/settings', updates)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      setEditedValues({})
      toast({ title: 'Settings Saved', description: 'All changes have been saved successfully' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' })
    },
  })

  if (!user || !canAccessAdmin(user.role)) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-6 text-center">
          <p className="text-amber-700 font-medium">Access Denied</p>
          <p className="text-amber-600 text-sm mt-1">Only administrators can access settings.</p>
        </CardContent>
      </Card>
    )
  }

  const grouped = settingsData?.grouped || {}
  const groupIcons: Record<string, React.ReactNode> = {
    hotel: <Hotel className="h-5 w-5 text-amber-600" />,
    restaurant: <UtensilsCrossed className="h-5 w-5 text-emerald-600" />,
    general: <Wrench className="h-5 w-5 text-sky-600" />,
    billing: <Settings className="h-5 w-5 text-purple-600" />,
    payment: <Settings className="h-5 w-5 text-orange-600" />,
  }

  const groupLabels: Record<string, string> = {
    hotel: 'Hotel Settings',
    restaurant: 'Restaurant Settings',
    general: 'General Settings',
    billing: 'Billing Settings',
    payment: 'Payment Settings',
  }

  const handleSave = () => {
    const updates = Object.entries(editedValues).map(([key, value]) => ({ key, value }))
    if (updates.length === 0) {
      toast({ title: 'No Changes', description: 'There are no changes to save' })
      return
    }
    saveMutation.mutate(updates)
  }

  const getValue = (key: string, originalValue: string) => {
    return editedValues[key] !== undefined ? editedValues[key] : originalValue
  }

  const friendlyLabels: Record<string, string> = {
    hotel_name: 'Hotel Name',
    restaurant_name: 'Restaurant Name',
    vat_percent: 'VAT Percentage (%)',
    currency: 'Currency',
    late_checkout_charge: 'Late Checkout Charge (৳)',
    late_checkout_hours: 'Late Checkout Hour (24h)',
    service_charge_percent: 'Service Charge (%)',
    default_discount_percent: 'Default Discount (%)',
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Settings className="h-6 w-6 text-amber-600" />
            System Settings
          </h2>
          <p className="text-slate-500 text-sm mt-1">Configure system-wide settings</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['settings'] })}
          >
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button
            className="bg-amber-600 hover:bg-amber-700 text-white"
            onClick={handleSave}
            disabled={saveMutation.isPending || Object.keys(editedValues).length === 0}
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {Object.keys(editedValues).length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-3 flex items-center justify-between">
            <p className="text-sm text-amber-700">
              <Badge variant="outline" className="bg-amber-100 text-amber-700 mr-2">
                {Object.keys(editedValues).length}
              </Badge>
              unsaved change(s)
            </p>
            <Button variant="ghost" size="sm" onClick={() => setEditedValues({})}>
              Discard
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-40 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : (
        Object.entries(grouped).map(([group, items]) => (
          <Card key={group}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {groupIcons[group] || <Settings className="h-5 w-5 text-slate-600" />}
                {groupLabels[group] || `${group.charAt(0).toUpperCase() + group.slice(1)} Settings`}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, index) => (
                <div key={item.id}>
                  {index > 0 && <Separator className="mb-4" />}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <Label className="sm:w-64 text-sm font-medium text-slate-700">
                      {friendlyLabels[item.key] || item.key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </Label>
                    <div className="flex-1">
                      <Input
                        value={getValue(item.key, item.value)}
                        onChange={(e) => setEditedValues((prev) => ({ ...prev, [item.key]: e.target.value }))}
                        className={editedValues[item.key] !== undefined ? 'border-amber-400 ring-1 ring-amber-200' : ''}
                      />
                    </div>
                    <span className="text-xs text-slate-400 font-mono sm:w-32 shrink-0">{item.key}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
