import { BACKEND_URL } from '../constants';
import { authenticatedFetch } from './csrfService';

export interface HandshakeSessionV1 {
  schema_version: 'handshake-session-v1';
  id: string;
  application_id: string;
  candidate_id: string;
  job_id: string | number;
  company_id?: string | null;
  status: 'in_progress' | 'submitted' | string;
  started_at: string;
  updated_at: string;
  finalized_at?: string | null;
  blueprint: Record<string, any>;
  candidate_context: Record<string, any>;
  answers: Record<string, any>;
  stages: Array<Record<string, any>>;
  attachments: Array<Record<string, any>>;
  final_note?: string | null;
}

export interface HandshakeResponse {
  status?: string;
  handshake_id: string;
  session: HandshakeSessionV1;
  application?: Record<string, any>;
}

export interface HandshakeRecruiterReadoutResponse {
  handshake_id: string;
  readout: Record<string, any>;
  application?: Record<string, any>;
}

const parseError = async (response: Response, fallback: string): Promise<Error> => {
  try {
    const payload = await response.json();
    const detail = payload?.detail;
    if (typeof detail === 'string') return new Error(detail);
    if (detail?.validation) return new Error(JSON.stringify(detail.validation));
    return new Error(payload?.message || fallback);
  } catch {
    const text = await response.text().catch(() => '');
    return new Error(text || fallback);
  }
};

export const startHandshake = async (jobId: string | number, source = 'jobshaman_rebuild_journey'): Promise<HandshakeResponse> => {
  const response = await authenticatedFetch(`${BACKEND_URL}/handshakes/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_id: jobId, source }),
  });
  if (!response.ok) throw await parseError(response, 'Handshake se nepodařilo založit.');
  return response.json();
};

export const patchHandshakeAnswer = async (
  handshakeId: string,
  stepId: string,
  answer: unknown,
  stage?: string,
  elapsedMs?: number,
): Promise<HandshakeResponse> => {
  const response = await authenticatedFetch(`${BACKEND_URL}/handshakes/${encodeURIComponent(handshakeId)}/answer`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      step_id: stepId,
      answer,
      stage,
      elapsed_ms: elapsedMs,
    }),
  });
  if (!response.ok) throw await parseError(response, 'Handshake odpověď se nepodařilo uložit.');
  return response.json();
};

export const finalizeHandshake = async (handshakeId: string, note?: string | null): Promise<HandshakeResponse> => {
  const response = await authenticatedFetch(`${BACKEND_URL}/handshakes/${encodeURIComponent(handshakeId)}/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note: note || null }),
  });
  if (!response.ok) throw await parseError(response, 'Handshake se nepodařilo dokončit.');
  return response.json();
};

export const fetchCompanyHandshakeReadout = async (handshakeId: string): Promise<HandshakeRecruiterReadoutResponse> => {
  const response = await authenticatedFetch(`${BACKEND_URL}/company/handshakes/${encodeURIComponent(handshakeId)}/readout`);
  if (!response.ok) throw await parseError(response, 'Recruiter readout se nepodařilo načíst.');
  return response.json();
};
