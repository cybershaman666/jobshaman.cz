import ApiService from './apiService';
import type { HandshakeResponse } from './handshakeService';
import type { RoleSlotAvailability } from '../rebuild/models';

const unwrapHandshake = (response: any): HandshakeResponse => {
  const payload = response?.data?.handshake_id ? response.data : response;
  return {
    status: payload?.status || payload?.session?.status || 'in_progress',
    handshake_id: payload?.handshake_id || payload?.id || payload?.session?.id,
    session: payload?.session,
    application: payload?.application || payload?.data || payload,
  };
};

export const startHandshake = async (jobId: string | number): Promise<HandshakeResponse> => {
  const response = await ApiService.post<any>(`/handshake/initiate/${encodeURIComponent(String(jobId))}`, {});
  return unwrapHandshake(response);
};

export const fetchHandshakeAvailability = async (jobId: string | number): Promise<RoleSlotAvailability | null> => {
  const response = await ApiService.get<any>(`/handshake/availability/${encodeURIComponent(String(jobId))}`);
  const data = response?.data || response;
  if (!data || typeof data !== 'object') return null;
  return {
    available: Boolean(data.available),
    reason: data.reason || null,
    existingHandshakeId: data.existing_handshake_id || data.existingHandshakeId || null,
    candidate: data.candidate,
    companyChallenge: data.company_challenge || data.companyChallenge,
  };
};

export const patchHandshakeAnswer = async (
  handshakeId: string,
  stepId: string,
  answer: unknown,
  stage?: string,
  elapsedMs?: number,
): Promise<HandshakeResponse> => {
  const response = await ApiService.patch<any>(`/handshake/${encodeURIComponent(handshakeId)}/answer`, {
    step_id: stepId,
    answer,
    stage,
    elapsed_ms: elapsedMs,
  });
  return unwrapHandshake(response);
};

export const finalizeHandshake = async (
  handshakeId: string,
  note?: string | null,
): Promise<HandshakeResponse> => {
  const response = await ApiService.post<any>(`/handshake/${encodeURIComponent(handshakeId)}/finalize`, {
    note: note || null,
  });
  return unwrapHandshake(response);
};

export const addExternalHandshakeSubmission = async (
  handshakeId: string,
  input: {
    provider: 'notion' | 'canva' | 'figma' | 'google_docs' | 'miro' | 'other';
    external_url: string;
    comment?: string | null;
    evidence_required?: boolean;
    visibility?: string;
  },
): Promise<HandshakeResponse> => {
  const response = await ApiService.post<any>(`/handshake/${encodeURIComponent(handshakeId)}/external-submission`, input);
  return unwrapHandshake(response);
};

export const fetchHandshake = async (handshakeId: string): Promise<HandshakeResponse> => {
  const response = await ApiService.get<any>(`/handshake/${encodeURIComponent(handshakeId)}`);
  return unwrapHandshake(response);
};
