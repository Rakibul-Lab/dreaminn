import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, logActivity } from '@/lib/api-utils';

// GET /api/settings - List all settings (ADMIN only)
export async function GET(request: NextRequest) {
  try {
    const authResult = requireRole(request, 'ADMIN');
    if (authResult instanceof Response) return authResult;

    const settings = await db.setting.findMany({
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });

    // Group settings by group
    const grouped: Record<string, Array<{ id: string; key: string; value: string }>> = {};
    for (const setting of settings) {
      const group = setting.group || 'general';
      if (!grouped[group]) {
        grouped[group] = [];
      }
      grouped[group].push({
        id: setting.id,
        key: setting.key,
        value: setting.value,
      });
    }

    return successResponse({
      settings,
      grouped,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return errorResponse('Failed to fetch settings', 500);
  }
}

// PUT /api/settings - Update settings (ADMIN only)
export async function PUT(request: NextRequest) {
  try {
    const authResult = requireRole(request, 'ADMIN');
    if (authResult instanceof Response) return authResult;

    const user = authResult;
    const body = await request.json();

    // Accept single { key, value } or array of updates
    const updates: Array<{ key: string; value: string }> = Array.isArray(body) ? body : [body];

    if (updates.length === 0) {
      return errorResponse('No updates provided');
    }

    // Validate each update
    for (const update of updates) {
      if (!update.key || update.value === undefined || update.value === null) {
        return errorResponse('Each update must have key and value');
      }
    }

    const results = [];

    for (const update of updates) {
      const existing = await db.setting.findUnique({
        where: { key: update.key },
      });

      if (existing) {
        const updated = await db.setting.update({
          where: { key: update.key },
          data: { value: String(update.value) },
        });
        results.push(updated);
      } else {
        // Create the setting if it doesn't exist
        const created = await db.setting.create({
          data: {
            key: update.key,
            value: String(update.value),
            group: guessGroup(update.key),
          },
        });
        results.push(created);
      }
    }

    // Log activity
    await logActivity(
      user.id,
      'SETTINGS_UPDATED',
      'admin',
      JSON.stringify({
        updatedKeys: updates.map((u) => u.key),
        count: updates.length,
      })
    );

    return successResponse(results, 'Settings updated successfully');
  } catch (error) {
    console.error('Error updating settings:', error);
    return errorResponse('Failed to update settings', 500);
  }
}

// Helper to guess the group from a setting key
function guessGroup(key: string): string {
  if (key.startsWith('hotel_') || key.startsWith('room_')) return 'hotel';
  if (key.startsWith('restaurant_') || key.startsWith('menu_')) return 'restaurant';
  if (key.startsWith('vat_') || key.startsWith('tax_') || key.startsWith('invoice_')) return 'billing';
  if (key.startsWith('payment_')) return 'payment';
  return 'general';
}
