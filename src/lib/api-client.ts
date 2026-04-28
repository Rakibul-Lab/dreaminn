const API_BASE = '/api';

interface FetchOptions extends RequestInit {
  params?: Record<string, string>;
}

export class ApiClient {
  private getHeaders(): HeadersInit {
    if (typeof window === 'undefined') return { 'Content-Type': 'application/json' };

    const stored = localStorage.getItem('erp-auth-storage');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const { user, token } = parsed.state || {};
        return {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '',
          'x-user-email': user?.email || '',
          'x-user-name': user?.name || '',
          'x-user-role': user?.role || '',
          'x-token': token || '',
        };
      } catch {
        // ignore parse errors
      }
    }
    return { 'Content-Type': 'application/json' };
  }

  async get<T>(path: string, options?: FetchOptions): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      headers: this.getHeaders(),
      ...options,
    });
    return res.json();
  }

  async post<T>(path: string, body?: unknown, options?: FetchOptions): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });
    return res.json();
  }

  async put<T>(path: string, body?: unknown, options?: FetchOptions): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });
    return res.json();
  }

  async patch<T>(path: string, body?: unknown, options?: FetchOptions): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });
    return res.json();
  }

  async delete<T>(path: string, options?: FetchOptions): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
      ...options,
    });
    return res.json();
  }
}

export const api = new ApiClient();
