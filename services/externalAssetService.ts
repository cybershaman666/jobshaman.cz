import { BACKEND_URL } from '../constants';
import { ApplicationMessageAttachment, UploadSession } from '../types';
import { authenticatedFetch } from './csrfService';

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/webm',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
]);

const MAX_SIZE_BY_KIND: Record<'attachment' | 'audio' | 'candidate_document', number> = {
  attachment: 10 * 1024 * 1024,
  audio: 12 * 1024 * 1024,
  candidate_document: 15 * 1024 * 1024,
};

export type ExternalAssetKind = 'attachment' | 'audio' | 'candidate_document';

const inferAssetKind = (file: File): ExternalAssetKind => {
  return file.type.toLowerCase().startsWith('audio/') ? 'audio' : 'attachment';
};

const directUpload = async (session: UploadSession, file: File): Promise<Response> => {
  const method = (session.upload_method || 'PUT').toUpperCase();
  const headers = new Headers(session.upload_headers || {});
  if (!headers.has('Content-Type') && file.type) {
    headers.set('Content-Type', file.type);
  }
  return fetch(session.upload_url, {
    method,
    headers,
    body: file
  });
};

const validateExternalAsset = (file: File, kind: ExternalAssetKind) => {
  if (!file) {
    throw new Error('Missing file');
  }
  const contentType = (file.type || '').toLowerCase().trim();
  if (!contentType || !ALLOWED_TYPES.has(contentType)) {
    throw new Error('Unsupported file type');
  }
  const maxSize = MAX_SIZE_BY_KIND[kind];
  if (file.size <= 0 || file.size > maxSize) {
    throw new Error(`File exceeds ${Math.round(maxSize / (1024 * 1024))} MB limit`);
  }
};

export const requestAssetUploadSession = async (
  file: File,
  kind: ExternalAssetKind = inferAssetKind(file)
): Promise<UploadSession> => {
  validateExternalAsset(file, kind);
  const response = await authenticatedFetch(`${BACKEND_URL}/assets/upload-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind,
      file_name: file.name,
      content_type: file.type || 'application/octet-stream',
      size_bytes: file.size
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || 'Failed to create upload session');
  }

  return await response.json();
};

export const uploadExternalAsset = async (
  file: File,
  kind: ExternalAssetKind = inferAssetKind(file)
): Promise<ApplicationMessageAttachment> => {
  const session = await requestAssetUploadSession(file, kind);
  const uploadResponse = session.direct_upload
    ? await directUpload(session, file)
    : await authenticatedFetch(session.upload_url, {
        method: session.upload_method || 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream'
        },
        body: file
      });

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text().catch(() => '');
    throw new Error(text || 'Failed to upload file bytes');
  }

  const finalizeResponse = await authenticatedFetch(`${BACKEND_URL}/assets/complete-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      upload_token: session.upload_token
    })
  });

  if (!finalizeResponse.ok) {
    const text = await finalizeResponse.text().catch(() => '');
    throw new Error(text || 'Failed to finalize uploaded asset');
  }

  const payload = await finalizeResponse.json();
  if (!payload?.asset) {
    throw new Error('Asset metadata missing');
  }
  return payload.asset as ApplicationMessageAttachment;
};

export const uploadExternalCandidateDocument = async (file: File): Promise<ApplicationMessageAttachment> => {
  return uploadExternalAsset(file, 'candidate_document');
};

export const refreshAssetDownloadUrl = async (assetId: string): Promise<string | null> => {
  if (!assetId) return null;
  const response = await authenticatedFetch(`${BACKEND_URL}/assets/${encodeURIComponent(assetId)}/download-url`, {
    method: 'GET'
  });
  if (!response.ok) {
    return null;
  }
  const payload = await response.json();
  return payload?.download_url || null;
};
