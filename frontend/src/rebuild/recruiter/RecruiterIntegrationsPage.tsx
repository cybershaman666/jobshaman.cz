import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  FileJson,
  KeyRound,
  Loader2,
  PlugZap,
  RefreshCw,
  Send,
  Trash2,
  Webhook,
} from 'lucide-react';

import { cn } from '../cn';
import {
  createIntegrationApiKey,
  createIntegrationWebhook,
  deleteIntegrationWebhook,
  fetchIntegrationApiKeys,
  fetchIntegrationCatalog,
  fetchIntegrationDeliveries,
  fetchIntegrationWebhooks,
  INTEGRATION_SCOPES,
  revokeIntegrationApiKey,
  sendIntegrationTestEvent,
  updateIntegrationWebhook,
  WEBHOOK_EVENTS,
  type AtsGuide,
  type IntegrationApiKey,
  type IntegrationCatalog,
  type IntegrationDelivery,
  type IntegrationScope,
  type IntegrationWebhook,
  type WebhookEventType,
} from '../../services/integrationService';
import {
  fieldClass,
  panelClass,
  primaryButtonClass,
  secondaryButtonClass,
  textareaClass,
} from '../ui/shellStyles';

type TFunction = (key: string, options?: { defaultValue?: string } & Record<string, any>) => string;

const cardClass = 'rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_20px_64px_-56px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-900';
const chipClass = 'inline-flex items-center gap-2 rounded-[6px] border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';

const sampleCurl = `curl -H "Authorization: Bearer jsh_live_..." \\
  https://site--jobshaman--rb4dlj74d5kc.code.run/integrations/v1/handshakes/{id}/packet`;

const statusTone = (status: string) => {
  if (status === 'delivered') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'pending') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-rose-200 bg-rose-50 text-rose-700';
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Nikdy';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const copyText = async (value: string) => {
  if (!value) return;
  await navigator.clipboard?.writeText(value);
};

const GuidePanel: React.FC<{ guide: AtsGuide }> = ({ guide }) => (
  <section className={cardClass}>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0f95ac]">ATS návod</div>
        <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-900 dark:text-slate-100">{guide.name}</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">{guide.purpose}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {guide.links.map((link) => (
          <a key={link} href={link} target="_blank" rel="noreferrer" className={cn(secondaryButtonClass, 'rounded-[8px] px-3 py-2 text-xs')}>
            Docs <ExternalLink size={13} />
          </a>
        ))}
      </div>
    </div>

    <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <div>
        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Mapping polí</h4>
        <div className="mt-3 overflow-hidden rounded-[8px] border border-slate-200 dark:border-slate-800">
          {guide.mapping.map((row) => (
            <div key={`${row.jobshaman}-${row.ats}`} className="grid gap-3 border-b border-slate-100 px-4 py-3 text-xs last:border-b-0 dark:border-slate-800 md:grid-cols-[1fr_1fr_1.2fr]">
              <code className="font-semibold text-[#255DAB]">{row.jobshaman}</code>
              <code className="font-semibold text-slate-800 dark:text-slate-200">{row.ats}</code>
              <span className="leading-5 text-slate-500 dark:text-slate-400">{row.note}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Potřebná oprávnění</h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {guide.permissions.map((permission) => <span key={permission} className={chipClass}>{permission}</span>)}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Troubleshooting</h4>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
            {guide.troubleshooting.map((item) => <li key={item}>- {item}</li>)}
          </ul>
        </div>
      </div>
    </div>

    <div className="mt-6 grid gap-5 lg:grid-cols-2">
      <div>
        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Setup krok za krokem</h4>
        <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
          {guide.setup.map((step, index) => <li key={step}>{index + 1}. {step}</li>)}
        </ol>
      </div>
      <div>
        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Testovací checklist</h4>
        <div className="mt-3 grid gap-2">
          {guide.checklist.map((item) => (
            <div key={item} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
              <CheckCircle2 size={15} className="mt-0.5 text-emerald-600" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export const RecruiterIntegrationsPage: React.FC<{ t: TFunction }> = ({ t }) => {
  const [catalog, setCatalog] = React.useState<IntegrationCatalog | null>(null);
  const [keys, setKeys] = React.useState<IntegrationApiKey[]>([]);
  const [webhooks, setWebhooks] = React.useState<IntegrationWebhook[]>([]);
  const [deliveries, setDeliveries] = React.useState<IntegrationDelivery[]>([]);
  const [selectedGuideId, setSelectedGuideId] = React.useState('greenhouse');
  const [keyName, setKeyName] = React.useState('ATS export');
  const [selectedScopes, setSelectedScopes] = React.useState<IntegrationScope[]>(['candidates:read', 'applications:read', 'handshakes:read']);
  const [newToken, setNewToken] = React.useState('');
  const [webhookUrl, setWebhookUrl] = React.useState('');
  const [selectedEvents, setSelectedEvents] = React.useState<WebhookEventType[]>(['candidate.packet_ready', 'handshake.completed']);
  const [newSecret, setNewSecret] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState('');
  const [error, setError] = React.useState('');

  const refresh = React.useCallback(async () => {
    setError('');
    const [catalogPayload, keyPayload, webhookPayload, deliveryPayload] = await Promise.all([
      fetchIntegrationCatalog(),
      fetchIntegrationApiKeys(),
      fetchIntegrationWebhooks(),
      fetchIntegrationDeliveries(),
    ]);
    setCatalog(catalogPayload);
    setKeys(keyPayload.items || []);
    setWebhooks(webhookPayload.items || []);
    setDeliveries(deliveryPayload.items || []);
    if (!catalogPayload.guides.some((guide) => guide.id === selectedGuideId)) {
      setSelectedGuideId(catalogPayload.guides[0]?.id || 'greenhouse');
    }
  }, [selectedGuideId]);

  React.useEffect(() => {
    let cancelled = false;
    setBusy(true);
    refresh()
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Integrace se nepodařilo načíst.');
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const toggleScope = (scope: IntegrationScope) => {
    setSelectedScopes((current) => current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]);
  };

  const toggleEvent = (event: WebhookEventType) => {
    setSelectedEvents((current) => current.includes(event) ? current.filter((item) => item !== event) : [...current, event]);
  };

  const handleCreateKey = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const created = await createIntegrationApiKey({ name: keyName.trim() || 'ATS export', scopes: selectedScopes });
      setNewToken(created.token || '');
      setNotice('API klíč byl vytvořen. Token si zkopírujte teď, později se už nezobrazí.');
      await refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'API klíč se nepodařilo vytvořit.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateWebhook = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const created = await createIntegrationWebhook({ url: webhookUrl.trim(), events: selectedEvents, is_active: true });
      setNewSecret(created.secret || '');
      setNotice('Webhook byl založen. Secret si zkopírujte pro ověření podpisu.');
      setWebhookUrl('');
      await refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Webhook se nepodařilo založit.');
    } finally {
      setBusy(false);
    }
  };

  const selectedGuide = catalog?.guides.find((guide) => guide.id === selectedGuideId) || catalog?.guides[0];
  const samplePayload = JSON.stringify(catalog?.sample_payload || {}, null, 2);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-[6px] bg-[#e8fbff] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#0f95ac]">
            <PlugZap size={14} />
            {t('rebuild.recruiter.integrations_label', { defaultValue: 'Integrace' })}
          </div>
          <h1 className="mt-3 text-[2.4rem] font-semibold tracking-[-0.055em] text-slate-900 dark:text-slate-100">
            {t('rebuild.recruiter.integrations_title', { defaultValue: 'ATS exporty, API klíče a webhooky.' })}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-400">
            {t('rebuild.recruiter.integrations_copy', { defaultValue: 'První verze posílá data z JobShamanu do ATS přes company-scoped API a podepsané webhooky. Credentials cizích ATS zatím neukládáme.' })}
          </p>
        </div>
        <button type="button" onClick={() => void refresh()} className={secondaryButtonClass}>
          <RefreshCw size={16} />
          Obnovit
        </button>
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-[8px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
          <AlertTriangle size={16} className="mt-0.5" />
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="flex items-start gap-3 rounded-[8px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
          <CheckCircle2 size={16} className="mt-0.5" />
          {notice}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-5">
        {[
          ['API klíče', `${keys.filter((key) => !key.revoked_at).length} aktivní`, KeyRound],
          ['Webhooks', `${webhooks.filter((hook) => hook.is_active).length} aktivní`, Webhook],
          ['ATS návody', `${catalog?.guides.length || 6} systémů`, PlugZap],
          ['Audit doručení', `${deliveries.length} záznamů`, CheckCircle2],
          ['Testovací payload', 'candidate.packet_ready', FileJson],
        ].map(([label, value, Icon]) => (
          <section key={String(label)} className={cardClass}>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#effcff] text-[#0f95ac]">
                <Icon size={18} />
              </span>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{String(label)}</div>
                <div className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">{String(value)}</div>
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section className={cn(panelClass, 'rounded-[8px] p-5')}>
          <div className="flex items-center gap-3">
            <KeyRound size={20} className="text-[#255DAB]" />
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">API klíče</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Token se zobrazí jen při vytvoření. Ukládá se pouze hash.</p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Název klíče
              <input value={keyName} onChange={(event) => setKeyName(event.target.value)} className={cn(fieldClass, 'rounded-[8px]')} />
            </label>
            <div>
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">Scopes</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {INTEGRATION_SCOPES.map((scope) => (
                  <button key={scope} type="button" onClick={() => toggleScope(scope)} className={cn(chipClass, selectedScopes.includes(scope) && 'border-[#255DAB] bg-[#eff6ff] text-[#255DAB]')}>
                    {selectedScopes.includes(scope) ? <CheckCircle2 size={13} /> : null}
                    {scope}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" onClick={() => void handleCreateKey()} disabled={busy || selectedScopes.length === 0} className={cn(primaryButtonClass, 'rounded-[8px] disabled:opacity-60')}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
              Vytvořit klíč
            </button>
            {newToken ? (
              <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-3">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Token pouze jednou</div>
                <div className="mt-2 flex gap-2">
                  <code className="min-w-0 flex-1 overflow-x-auto rounded-[6px] bg-white px-3 py-2 text-xs text-slate-800">{newToken}</code>
                  <button type="button" onClick={() => void copyText(newToken)} className={cn(secondaryButtonClass, 'rounded-[8px] px-3 py-2')}>
                    <Clipboard size={14} />
                  </button>
                </div>
              </div>
            ) : null}
            <div className="space-y-2">
              {keys.map((key) => (
                <div key={key.id} className="rounded-[8px] border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">{key.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{key.token_prefix}... · last used {formatDate(key.last_used_at)}</div>
                    </div>
                    {key.revoked_at ? (
                      <span className="rounded-[6px] bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">Revoked</span>
                    ) : (
                      <button type="button" onClick={() => void revokeIntegrationApiKey(key.id).then(refresh)} className={cn(secondaryButtonClass, 'rounded-[8px] px-3 py-2 text-xs')}>
                        <Trash2 size={14} />
                        Revoke
                      </button>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {key.scopes.map((scope) => <span key={scope} className="rounded-[5px] bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{scope}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={cn(panelClass, 'rounded-[8px] p-5')}>
          <div className="flex items-center gap-3">
            <Webhook size={20} className="text-[#0f95ac]" />
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Webhooks</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Payloady podepisujeme přes X-JobShaman-Signature.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Endpoint URL
              <input value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} placeholder="https://integrations.example.com/jobshaman" className={cn(fieldClass, 'rounded-[8px]')} />
            </label>
            <div>
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">Události</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {WEBHOOK_EVENTS.map((event) => (
                  <button key={event} type="button" onClick={() => toggleEvent(event)} className={cn(chipClass, selectedEvents.includes(event) && 'border-[#0f95ac] bg-[#effcff] text-[#0f95ac]')}>
                    {event}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" onClick={() => void handleCreateWebhook()} disabled={busy || !webhookUrl.trim() || selectedEvents.length === 0} className={cn(primaryButtonClass, 'rounded-[8px] disabled:opacity-60')}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Webhook size={16} />}
              Založit webhook
            </button>
            {newSecret ? (
              <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-3">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Webhook secret</div>
                <div className="mt-2 flex gap-2">
                  <code className="min-w-0 flex-1 overflow-x-auto rounded-[6px] bg-white px-3 py-2 text-xs text-slate-800">{newSecret}</code>
                  <button type="button" onClick={() => void copyText(newSecret)} className={cn(secondaryButtonClass, 'rounded-[8px] px-3 py-2')}>
                    <Clipboard size={14} />
                  </button>
                </div>
              </div>
            ) : null}
            <div className="space-y-2">
              {webhooks.map((webhook) => (
                <div key={webhook.id} className="rounded-[8px] border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{webhook.url}</div>
                      <div className="mt-1 text-xs text-slate-500">secret {webhook.secret_prefix}... · success {formatDate(webhook.last_success_at)}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void sendIntegrationTestEvent(webhook.id).then(refresh)} className={cn(secondaryButtonClass, 'rounded-[8px] px-3 py-2 text-xs')}>
                        <Send size={14} />
                        Send test
                      </button>
                      <button type="button" onClick={() => void updateIntegrationWebhook(webhook.id, { is_active: !webhook.is_active }).then(refresh)} className={cn(secondaryButtonClass, 'rounded-[8px] px-3 py-2 text-xs')}>
                        {webhook.is_active ? 'Vypnout' : 'Zapnout'}
                      </button>
                      <button type="button" onClick={() => void deleteIntegrationWebhook(webhook.id).then(refresh)} className={cn(secondaryButtonClass, 'rounded-[8px] px-3 py-2 text-xs')}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {webhook.events.map((event) => <span key={event} className="rounded-[5px] bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{event}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className={cardClass}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">ATS návody</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Priorita: Greenhouse, Workday, Ashby, iCIMS, Workable a Lever.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(catalog?.guides || []).map((guide) => (
              <button key={guide.id} type="button" onClick={() => setSelectedGuideId(guide.id)} className={cn(chipClass, selectedGuideId === guide.id && 'border-[#255DAB] bg-[#eff6ff] text-[#255DAB]')}>
                {guide.name}
              </button>
            ))}
          </div>
        </div>
        {selectedGuide ? <GuidePanel guide={selectedGuide} /> : null}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className={cardClass}>
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} className="text-emerald-600" />
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Audit doručení</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Posledních 50 webhook delivery pokusů.</p>
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-[8px] border border-slate-200 dark:border-slate-800">
            {deliveries.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">Zatím žádné doručení. Pošlete test event z webhooku.</div>
            ) : deliveries.map((delivery) => (
              <div key={delivery.id} className="grid gap-3 border-b border-slate-100 px-4 py-3 text-xs last:border-b-0 dark:border-slate-800 md:grid-cols-[1.2fr_0.9fr_0.7fr_0.8fr]">
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-100">{delivery.event_type}</div>
                  <div className="mt-1 truncate text-slate-500">{delivery.event_id}</div>
                </div>
                <div className="text-slate-500">{formatDate(delivery.created_at)}</div>
                <div><span className={cn('rounded-[6px] border px-2 py-1 font-bold', statusTone(delivery.status))}>{delivery.status}</span></div>
                <div className="text-slate-500">HTTP {delivery.response_status || '-'} · pokusů {delivery.attempts}</div>
              </div>
            ))}
          </div>
        </section>

        <section className={cardClass}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <FileJson size={20} className="text-[#c28a2c]" />
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Testovací payload</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Ukázka candidate.packet_ready.</p>
              </div>
            </div>
            <button type="button" onClick={() => void copyText(samplePayload)} className={cn(secondaryButtonClass, 'rounded-[8px] px-3 py-2')}>
              <Clipboard size={14} />
            </button>
          </div>
          <textarea readOnly value={samplePayload} className={cn(textareaClass, 'h-72 rounded-[8px] font-mono text-xs')} />
          <div className="mt-4">
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Rychlý pull packetu</div>
            <pre className="mt-2 overflow-x-auto rounded-[8px] bg-slate-950 p-3 text-xs leading-6 text-slate-100">{sampleCurl}</pre>
          </div>
        </section>
      </div>
    </div>
  );
};
