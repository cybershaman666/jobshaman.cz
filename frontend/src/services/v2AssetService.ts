import type { StoredAsset, UploadSession } from '../types';
import { getSupabaseClient } from './supabaseClient';

// Production calls go through Vercel's /api/v2 proxy to eliminate CORS issues.
const DEFAULT_PRODUCTION_API_URL = '/api/v2';

const normalizeApiBaseUrl = (): string => {
  // In dev mode, respect env vars and use Vite proxy
  if (import.meta.env.DEV || (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname))) {
    const explicit = (import.meta.env.VITE_API_URL || import.meta.env.VITE_V2_API_URL || '').trim();
    if (explicit) return explicit.replace(/\/$/, '');
    return 'http://localhost:8000/api/v2';
  }

  // Production: ALWAYS use /api/v2 Vercel proxy to avoid CORS
  return DEFAULT_PRODUCTION_API_URL;
};

const API_BASE_URL = normalizeApiBaseUrl();

export type V2AssetKind =
  | 'candidate_document'
  | 'profile_photo'
  | 'company_branding'
  | 'handshake_material'
  | 'dialogue_attachment';

const MAX_SIZE_BY_KIND: Record<V2AssetKind, number> = {
  candidate_document: 15 * 1024 * 1024,
  profile_photo: 8 * 1024 * 1024,
  company_branding: 12 * 1024 * 1024,
  handshake_material: 25 * 1024 * 1024,
  dialogue_attachment: 12 * 1024 * 1024,
};

const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/svg+xml',
]);

const GENERAL_ATTACHMENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/rtf',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
  'text/markdown',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/webm',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'video/mp4',
  'video/webm',
  ...IMAGE_TYPES,
]);

const getAuthHeaders = async (contentType = 'application/json'): Promise<Record<string, string>> => {
  const headers: Record<string, string> = { 'Content-Type': contentType };
  const supabase = getSupabaseClient();
  if (!supabase) return headers;
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return headers;
};

const validateAssetFile = (file: File, kind: V2AssetKind) => {
  if (!file) throw new Error('Missing file');
  const mime = (file.type || '').toLowerCase().trim();
  if (!mime) throw new Error('Unsupported file type');
  if (file.size <= 0 || file.size > MAX_SIZE_BY_KIND[kind]) {
    throw new Error(`File exceeds ${Math.round(MAX_SIZE_BY_KIND[kind] / (1024 * 1024))} MB limit`);
  }

  const allowed = kind === 'profile_photo' || kind === 'company_branding' ? IMAGE_TYPES : GENERAL_ATTACHMENT_TYPES;
  if (!allowed.has(mime)) {
    throw new Error('Unsupported file type');
  }
};

export const requestV2AssetUploadSession = async (
  file: File,
  options: {
    kind: V2AssetKind;
    usage?: string;
    companyId?: string;
    title?: string;
    caption?: string;
    visibility?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<UploadSession> => {
  validateAssetFile(file, options.kind);
  const response = await fetch(`${API_BASE_URL}/assets/upload-session`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      kind: options.kind,
      usage: options.usage,
      company_id: options.companyId,
      title: options.title,
      caption: options.caption,
      visibility: options.visibility,
      metadata: options.metadata,
      file_name: file.name,
      content_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to create upload session' }));
    throw new Error(error.detail || 'Failed to create upload session');
  }

  return response.json();
};

export const uploadV2Asset = async (
  file: File,
  options: {
    kind: V2AssetKind;
    usage?: string;
    companyId?: string;
    title?: string;
    caption?: string;
    visibility?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<StoredAsset> => {
  const session = await requestV2AssetUploadSession(file, options);
  const uploadHeaders = new Headers(session.upload_headers || {});
  if (!uploadHeaders.has('Content-Type') && file.type) {
    uploadHeaders.set('Content-Type', file.type);
  }

  const uploadResponse = await fetch(session.upload_url, {
    method: session.upload_method || 'PUT',
    headers: uploadHeaders,
    body: file,
  });

  if (!uploadResponse.ok && uploadResponse.status !== 204) {
    const text = await uploadResponse.text().catch(() => '');
    throw new Error(text || 'Failed to upload file bytes');
  }

  const finalizeResponse = await fetch(`${API_BASE_URL}/assets/complete-upload`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ upload_token: session.upload_token }),
  });

  if (!finalizeResponse.ok) {
    const error = await finalizeResponse.json().catch(() => ({ detail: 'Failed to finalize upload' }));
    throw new Error(error.detail || 'Failed to finalize upload');
  }

  const payload = await finalizeResponse.json();
  if (!payload?.asset) {
    throw new Error('Uploaded asset metadata missing');
  }
  return payload.asset as StoredAsset;
};
