import ApiService from './apiService';

export const INTEGRATION_SCOPES = [
  'candidates:read',
  'applications:read',
  'handshakes:read',
  'webhooks:manage',
] as const;

export const WEBHOOK_EVENTS = [
  'application.submitted',
  'application.updated',
  'candidate.packet_ready',
  'candidate.withdrawn',
  'handshake.completed',
] as const;

export type IntegrationScope = typeof INTEGRATION_SCOPES[number];
export type WebhookEventType = typeof WEBHOOK_EVENTS[number];

export interface IntegrationApiKey {
  id: string;
  company_id: string;
  name: string;
  token_prefix: string;
  token?: string;
  scopes: IntegrationScope[];
  created_at: string;
  updated_at?: string;
  last_used_at?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
}

export interface IntegrationWebhook {
  id: string;
  company_id: string;
  url: string;
  secret_prefix: string;
  secret?: string;
  events: WebhookEventType[];
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  last_success_at?: string | null;
  last_failure_at?: string | null;
}

export interface IntegrationDelivery {
  id: string;
  company_id: string;
  webhook_id?: string | null;
  event_id: string;
  event_type: WebhookEventType | string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  response_status?: number | null;
  response_body?: string | null;
  last_error?: string | null;
  created_at: string;
  delivered_at?: string | null;
}

export interface AtsGuide {
  id: string;
  name: string;
  purpose: string;
  permissions: string[];
  mapping: Array<{ jobshaman: string; ats: string; note: string }>;
  setup: string[];
  checklist: string[];
  troubleshooting: string[];
  links: string[];
}

export interface IntegrationCatalog {
  source: 'jobshaman';
  schema_version: string;
  scopes: IntegrationScope[];
  events: WebhookEventType[];
  guides: AtsGuide[];
  sample_payload: Record<string, unknown>;
}

export const fetchIntegrationCatalog = () => ApiService.get<IntegrationCatalog>('/integrations/catalog');
export const fetchIntegrationApiKeys = () => ApiService.get<{ company_id: string; items: IntegrationApiKey[] }>('/integrations/api-keys');
export const createIntegrationApiKey = (body: { name: string; scopes: IntegrationScope[]; expires_at?: string | null }) =>
  ApiService.post<IntegrationApiKey>('/integrations/api-keys', body);
export const revokeIntegrationApiKey = (keyId: string) => ApiService.delete<IntegrationApiKey>(`/integrations/api-keys/${encodeURIComponent(keyId)}`);

export const fetchIntegrationWebhooks = () => ApiService.get<{ company_id: string; items: IntegrationWebhook[] }>('/integrations/webhooks');
export const createIntegrationWebhook = (body: { url: string; events: WebhookEventType[]; is_active?: boolean }) =>
  ApiService.post<IntegrationWebhook>('/integrations/webhooks', body);
export const updateIntegrationWebhook = (webhookId: string, body: Partial<Pick<IntegrationWebhook, 'url' | 'events' | 'is_active'>>) =>
  ApiService.patch<IntegrationWebhook>(`/integrations/webhooks/${encodeURIComponent(webhookId)}`, body);
export const deleteIntegrationWebhook = (webhookId: string) => ApiService.delete<IntegrationWebhook>(`/integrations/webhooks/${encodeURIComponent(webhookId)}`);
export const sendIntegrationTestEvent = (webhookId: string) =>
  ApiService.post<IntegrationDelivery>(`/integrations/webhooks/${encodeURIComponent(webhookId)}/test`, {});
export const fetchIntegrationDeliveries = () => ApiService.get<{ company_id: string; items: IntegrationDelivery[] }>('/integrations/deliveries?limit=50');
