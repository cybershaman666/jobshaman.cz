import { getSupabaseClient } from './supabaseClient';

const normalizeApiBaseUrl = (): string => {
  const explicit = (import.meta.env.VITE_API_URL || import.meta.env.VITE_V2_API_URL || '').trim();
  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    if (!explicit || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/api\/v2\/?$/i.test(explicit)) {
      return '/api/v2';
    }
  }
  if (explicit) return explicit.replace(/\/$/, '');
  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return '/api/v2';
  }
  if (import.meta.env.DEV) return 'http://localhost:8000/api/v2';

  const backend = (import.meta.env.VITE_BACKEND_URL || '').trim().replace(/\/$/, '');
  if (!backend) return 'https://api.jobshaman.cz/api/v2';
  return backend.endsWith('/api/v2') ? backend : `${backend}/api/v2`;
};

const API_BASE_URL = normalizeApiBaseUrl();

const parseErrorResponse = async (response: Response): Promise<string> => {
  const fallback = `Request failed with status ${response.status}`;

  try {
    const raw = await response.text();
    if (!raw) return fallback;

    try {
      const parsed = JSON.parse(raw);
      const detail = parsed?.detail;
      const message = parsed?.message;
      const error = parsed?.error;

      if (typeof detail === 'string' && detail.trim()) return detail;
      if (typeof message === 'string' && message.trim()) return message;
      if (typeof error === 'string' && error.trim()) return error;
      if (detail && typeof detail === 'object') return JSON.stringify(detail);
      if (message && typeof message === 'object') return JSON.stringify(message);

      return fallback;
    } catch {
      const normalized = raw.replace(/\s+/g, ' ').trim();
      return normalized || fallback;
    }
  } catch {
    return fallback;
  }
};

const parseSuccessResponse = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) return undefined as T;

  const raw = await response.text();
  if (!raw) return undefined as T;

  return JSON.parse(raw) as T;
};

class ApiService {
  static async hasAuthSession(): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;
    const { data: { session } } = await supabase.auth.getSession();
    return Boolean(session?.access_token);
  }

  private static async getHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const supabase = getSupabaseClient();
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    }

    return headers;
  }

  static async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }

    return parseSuccessResponse<T>(response);
  }

  static async post<T>(endpoint: string, body: any): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }

    return parseSuccessResponse<T>(response);
  }

  static async patch<T>(endpoint: string, body: any): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PATCH',
      headers: await this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }

    return parseSuccessResponse<T>(response);
  }

  static async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }

    return parseSuccessResponse<T>(response);
  }
}

export default ApiService;
