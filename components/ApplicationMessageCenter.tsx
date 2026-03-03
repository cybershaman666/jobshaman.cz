import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Mail, Paperclip, Send } from 'lucide-react';

import { ApplicationMessage, ApplicationMessageAttachment } from '../types';
import { ApplicationMessageCreatePayload } from '../services/jobApplicationService';
import { uploadApplicationMessageAttachment } from '../services/supabaseService';

interface ApplicationMessageCenterProps {
  applicationId?: string | null;
  storageOwnerId?: string | null;
  heading?: string;
  subtitle?: string;
  emptyText?: string;
  viewerRole: 'candidate' | 'recruiter';
  fetchMessages: (applicationId: string) => Promise<ApplicationMessage[]>;
  sendMessage: (applicationId: string, payload: ApplicationMessageCreatePayload) => Promise<ApplicationMessage | null>;
}

const ApplicationMessageCenter: React.FC<ApplicationMessageCenterProps> = ({
  applicationId,
  storageOwnerId,
  heading,
  subtitle,
  emptyText,
  viewerRole,
  fetchMessages,
  sendMessage
}) => {
  const { t, i18n } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [messages, setMessages] = useState<ApplicationMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<ApplicationMessageAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!applicationId) {
        if (!cancelled) {
          setMessages([]);
          setError(null);
        }
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const rows = await fetchMessages(applicationId);
        if (!cancelled) {
          setMessages(rows);
        }
      } catch (err) {
        console.error('Failed to load application messages:', err);
        if (!cancelled) {
          setMessages([]);
          setError(
            t('application.messages.load_failed', {
              defaultValue: 'Nepodařilo se načíst vlákno zpráv.'
            })
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [applicationId, fetchMessages, t]);

  const formatDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString(i18n.language || undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).slice(0, 3);
    if (!files.length || !storageOwnerId) return;

    setUploading(true);
    try {
      const uploaded: ApplicationMessageAttachment[] = [];
      for (const file of files) {
        const attachment = await uploadApplicationMessageAttachment(storageOwnerId, file);
        uploaded.push(attachment);
      }
      setAttachments((current) => [...current, ...uploaded].slice(0, 5));
    } catch (err: any) {
      console.error('Attachment upload failed:', err);
      window.alert(
        err?.message ||
          t('application.messages.upload_failed', {
            defaultValue: 'Nepodařilo se nahrát přílohu.'
          })
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSend = async () => {
    if (!applicationId || sending) return;
    const body = draft.trim();
    if (!body && attachments.length === 0) return;

    setSending(true);
    try {
      const message = await sendMessage(applicationId, {
        body,
        attachments
      });
      if (!message) {
        throw new Error('Message not sent');
      }
      setMessages((current) => [...current, message]);
      setDraft('');
      setAttachments([]);
    } catch (err) {
      console.error('Failed to send application message:', err);
      window.alert(
        t('application.messages.send_failed', {
          defaultValue: 'Nepodařilo se odeslat zprávu.'
        })
      );
    } finally {
      setSending(false);
    }
  };

  const isOwnMessage = (message: ApplicationMessage) => message.sender_role === viewerRole;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg dark:border-slate-700 dark:bg-slate-900/80">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:border-cyan-900/40 dark:bg-cyan-950/20 dark:text-cyan-300">
            <Mail className="h-3.5 w-3.5" />
            {heading || t('application.messages.badge', { defaultValue: 'Interní zprávy' })}
          </div>
          {subtitle && (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('application.messages.loading', { defaultValue: 'Načítám zprávy…' })}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
            {error}
          </div>
        ) : messages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
            {emptyText ||
              t('application.messages.empty', {
                defaultValue: 'Zatím tu nejsou žádné zprávy. Můžete poslat první interní zprávu k této přihlášce.'
              })}
          </div>
        ) : (
          <div className="max-h-[24rem] space-y-3 overflow-y-auto pr-1">
            {messages.map((message) => {
              const own = isOwnMessage(message);
              return (
                <div
                  key={message.id}
                  className={`rounded-2xl border p-4 ${
                    own
                      ? 'border-cyan-200 bg-cyan-50/70 dark:border-cyan-900/40 dark:bg-cyan-950/10'
                      : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      {message.sender_role === 'candidate'
                        ? t('application.messages.sender_candidate', { defaultValue: 'Uchazeč' })
                        : t('application.messages.sender_company', { defaultValue: 'Firma' })}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(message.created_at)}
                    </div>
                  </div>
                  {message.body && (
                    <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">
                      {message.body}
                    </div>
                  )}
                  {message.attachments.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {message.attachments.map((attachment, index) => (
                        <a
                          key={`${attachment.url}-${index}`}
                          href={attachment.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          {attachment.name}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={4}
          placeholder={t('application.messages.placeholder', {
            defaultValue: 'Napište interní zprávu k této přihlášce…'
          })}
          className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-cyan-700 dark:focus:ring-cyan-900/40"
        />

        {attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {attachments.map((attachment, index) => (
              <button
                key={`${attachment.name}-${index}`}
                type="button"
                onClick={() => handleRemoveAttachment(index)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Paperclip className="h-3.5 w-3.5" />
                {attachment.name}
                <span className="text-slate-400">×</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              onChange={handleFilesSelected}
              accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            />
            <button
              type="button"
              onClick={handleAttachClick}
              disabled={uploading || attachments.length >= 5 || !storageOwnerId}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              {t('application.messages.attach', { defaultValue: 'Přiložit soubor' })}
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {t('application.messages.attach_hint', { defaultValue: 'PDF, DOC, DOCX nebo TXT do 10 MB' })}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSend}
            disabled={sending || uploading || (!draft.trim() && attachments.length === 0)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {t('application.messages.send', { defaultValue: 'Odeslat zprávu' })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApplicationMessageCenter;
