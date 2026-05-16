import { getSupabaseClient } from './supabaseClient';
import { BACKEND_URL } from '../constants';

const normalizeApiBaseUrl = (): string => (BACKEND_URL || '/api/v2').replace(/\/$/, '');

const API_BASE_URL = normalizeApiBaseUrl();
const DIRECT_API_BASE_URL = 'https://jobshaman-api.mangorock-7014fb1a.northeurope.azurecontainerapps.io';

const isHtmlResponse = (response: Response): boolean => {
  const contentType = response.headers.get('Content-Type') || '';
  return contentType.includes('text/html');
};

const shouldRetryViaDirectBackend = (response: Response): boolean => (
  API_BASE_URL === '/api/v2' &&
  response.ok &&
  isHtmlResponse(response)
);

const parseErrorResponse = async (response: Response): Promise<string> => {
  const fallback = `Request failed with status ${response.status}`;

  try {
    const raw = (await response.text()).trim();
    if (!raw) return fallback;

    // Check if it's actually JSON
    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
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
        // Fallback to text if JSON parsing fails despite Content-Type
      }
    }

    // Return normalized text for non-JSON or failed JSON parsing
    const normalized = raw.replace(/\s+/g, ' ').trim();
    return normalized.slice(0, 500) || fallback;
  } catch {
    return fallback;
  }
};

const parseSuccessResponse = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) return undefined as T;

  const raw = (await response.text()).trim();
  if (!raw) return undefined as T;

  const contentType = response.headers.get('Content-Type') || '';
  
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error('API Response Parse Error:', {
      status: response.status,
      contentType,
      url: response.url,
      preview: raw.slice(0, 200),
      error: e
    });

    if (contentType.includes('text/html') || raw.startsWith('<!DOCTYPE')) {
      throw new Error('Received HTML instead of JSON. This usually indicates a routing error or a session timeout.');
    }
    
    throw new Error(`Failed to parse server response as JSON: ${raw.slice(0, 50)}...`);
  }
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

  private static async request<T>(method: string, endpoint: string, body?: any): Promise<T> {
    const headers = await this.getHeaders();
    const init: RequestInit = { method, headers };
    if (body !== undefined) init.body = JSON.stringify(body);

    let response = await fetch(`${API_BASE_URL}${endpoint}`, init);

    if (shouldRetryViaDirectBackend(response)) {
      console.warn('API proxy returned HTML; retrying direct backend', {
        status: response.status,
        url: response.url,
        endpoint,
      });
      response = await fetch(`${DIRECT_API_BASE_URL}${endpoint}`, init);
    }

    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }

    return parseSuccessResponse<T>(response);
  }

  static async get<T>(endpoint: string): Promise<T> {
    return this.request<T>('GET', endpoint);
  }

  static async post<T>(endpoint: string, body: any): Promise<T> {
    return this.request<T>('POST', endpoint, body);
  }

  static async patch<T>(endpoint: string, body: any): Promise<T> {
    return this.request<T>('PATCH', endpoint, body);
  }

  static async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>('DELETE', endpoint);
  }
}

export default ApiService;
