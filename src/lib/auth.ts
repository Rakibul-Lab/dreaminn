import { NextRequest, NextResponse } from 'next/server';
import { RoleType } from '@prisma/client';
import { isIdleSessionExpired } from '@/lib/session';

// Simple session-based auth using headers
// In production, use proper JWT/NextAuth with secure tokens

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: RoleType;
}

export function getAuthUser(request: NextRequest): AuthUser | null {
  const userId = request.headers.get('x-user-id');
  const userEmail = request.headers.get('x-user-email');
  const userName = request.headers.get('x-user-name');
  const userRole = request.headers.get('x-user-role') as RoleType;

  if (!userId || !userEmail || !userRole) {
    return null;
  }

  return {
    id: userId,
    email: userEmail,
    name: userName || '',
    role: userRole,
  };
}

export function validateSession(request: NextRequest): NextResponse | null {
  const lastActivityHeader = request.headers.get('x-last-activity');
  const lastActivity = lastActivityHeader ? Number(lastActivityHeader) : null;

  if (lastActivity && Number.isFinite(lastActivity) && isIdleSessionExpired(lastActivity)) {
    return NextResponse.json(
      { error: 'Session expired due to inactivity', code: 'SESSION_EXPIRED' },
      { status: 401 }
    );
  }

  return null;
}

export function requireAuth(request: NextRequest): AuthUser | NextResponse {
  const sessionError = validateSession(request);
  if (sessionError) return sessionError;

  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  return user;
}

export function requireRole(request: NextRequest, ...roles: RoleType[]): AuthUser | NextResponse {
  const result = requireAuth(request);
  if (result instanceof NextResponse) return result;

  if (!roles.includes(result.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  return result;
}

// Permission checks
export function canAccessHotel(role: RoleType): boolean {
  return role === 'ADMIN' || role === 'HOTEL_STAFF';
}

export function canAccessRestaurant(role: RoleType): boolean {
  return role === 'ADMIN' || role === 'RESTAURANT_STAFF';
}

export function canAccessAdmin(role: RoleType): boolean {
  return role === 'ADMIN';
}
