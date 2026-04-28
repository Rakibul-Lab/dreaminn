import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse, paginatedResponse, notFoundResponse } from '@/lib/api-utils';

// GET /api/notifications - List notifications with filters
export async function GET(request: NextRequest) {
  try {
    const authResult = requireAuth(request);
    if (authResult instanceof Response) return authResult;

    const user = authResult;
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const userId = searchParams.get('userId');
    const type = searchParams.get('type');
    const read = searchParams.get('read');

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    // Filter by userId (if provided, or default to current user)
    if (userId) {
      where.userId = userId;
    } else {
      // Show notifications for this user or global notifications (userId = null)
      where.OR = [
        { userId: user.id },
        { userId: null },
      ];
    }

    if (type) {
      where.type = type;
    }

    if (read !== null && read !== undefined) {
      where.read = read === 'true';
    }

    const [notifications, total] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.notification.count({ where }),
    ]);

    // Get unread count for current user
    const unreadCount = await db.notification.count({
      where: {
        OR: [
          { userId: user.id },
          { userId: null },
        ],
        read: false,
      },
    });

    return paginatedResponse(notifications, total, page, limit);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return errorResponse('Failed to fetch notifications', 500);
  }
}

// PUT /api/notifications - Mark notification as read
export async function PUT(request: NextRequest) {
  try {
    const authResult = requireAuth(request);
    if (authResult instanceof Response) return authResult;

    const user = authResult;
    const body = await request.json();
    const { id, markAll } = body;

    if (markAll) {
      // Mark all notifications as read for this user
      await db.notification.updateMany({
        where: {
          OR: [
            { userId: user.id },
            { userId: null },
          ],
          read: false,
        },
        data: { read: true },
      });

      return successResponse({ markedAll: true }, 'All notifications marked as read');
    }

    if (!id) {
      return errorResponse('Notification ID is required');
    }

    const notification = await db.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      return notFoundResponse('Notification');
    }

    // Verify the notification belongs to this user or is global
    if (notification.userId && notification.userId !== user.id) {
      return errorResponse('You can only mark your own notifications as read', 403);
    }

    const updated = await db.notification.update({
      where: { id },
      data: { read: true },
    });

    return successResponse(updated, 'Notification marked as read');
  } catch (error) {
    console.error('Error updating notification:', error);
    return errorResponse('Failed to update notification', 500);
  }
}
