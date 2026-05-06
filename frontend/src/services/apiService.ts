import { getSupabaseClient } from './supabaseClient';

const normalizeApiBaseUrl = (): string => {
  const rejectPreviewApiHost = (candidate: string): string => {
    if (import.meta.env.DEV) return candidate;
    try {
      const parsed = new URL(candidate);
      if (parsed.hostname.endsWith('.code.run') && parsed.hostname.startsWith('site--jobshaman--')) {
        return 'https://api.jobshaman.cz';
      }
    } catch {
      // Leave relative or malformed values to the existing fallback rules.
    }
    return candidate;
  };

  const explicit = (import.meta.env.VITE_API_URL || import.meta.env.VITE_V2_API_URL || '').trim();
  if (explicit) return rejectPreviewApiHost(explicit.replace(/\/$/, ''));
  if (import.meta.env.DEV) return 'http://localhost:8000';

  const backend = (import.meta.env.VITE_BACKEND_URL || '').trim().replace(/\/$/, '');
  if (!backend) return 'https://api.jobshaman.cz';
  return rejectPreviewApiHost(backend);
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
