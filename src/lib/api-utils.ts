import { NextResponse } from 'next/server';
import { db } from './db';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

export function successResponse<T>(data: T, message?: string, status = 200): NextResponse {
  return NextResponse.json(
    { success: true, data, message } as ApiResponse<T>,
    { status }
  );
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  } as ApiResponse<T>);
}

export function errorResponse(error: string, status = 400): NextResponse {
  return NextResponse.json(
    { success: false, error } as ApiResponse,
    { status }
  );
}

export function notFoundResponse(resource: string): NextResponse {
  return NextResponse.json(
    { success: false, error: `${resource} not found` } as ApiResponse,
    { status: 404 }
  );
}

export async function logActivity(
  userId: string | null,
  action: string,
  module: string,
  details?: string
) {
  try {
    await db.activityLog.create({
      data: { userId, action, module, details },
    });
  } catch {
    // Silent fail for activity logs
  }
}

// Generate order number
export function generateOrderNumber(): string {
  const prefix = 'CV'; // CloudView
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// Generate invoice number
export function generateInvoiceNumber(): string {
  const prefix = 'INV';
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${date}-${random}`;
}
