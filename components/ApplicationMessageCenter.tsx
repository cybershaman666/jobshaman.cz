import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Mail, Paperclip, Send } from 'lucide-react';

import { DialogueMessage, DialogueMessageAttachment } from '../types';
import { DialogueMessageCreatePayload } from '../services/jobApplicationService';
import { uploadApplicationMessageAttachment } from '../services/supabaseService';

interface ApplicationMessageCenterProps {
  dialogueId?: string | null;
  applicationId?: string | null;
  storageOwnerId?: string | null;
  heading?: string;
  subtitle?: string;
  emptyText?: string;
  viewerRole: 'candidate' | 'recruiter';
  dialogueStatus?: string | null;
  dialogueDeadlineAt?: string | null;
  dialogueCurrentTurn?: 'candidate' | 'company' | null;
  dialogueClosedReason?: string | null;
  dialogueIsOverdue?: boolean;
  fetchMessages: (dialogueId: string) => Promise<DialogueMessage[]>;
  sendMessage: (dialogueId: string, payload: DialogueMessageCreatePayload) => Promise<DialogueMessage | null>;
}

const ApplicationMessageCenter: React.FC<ApplicationMessageCenterProps> = ({
  dialogueId,
  applicationId,
  storageOwnerId,
  heading,
  subtitle,
  emptyText,
  viewerRole,
  dialogueStatus,
  dialogueDeadlineAt,
  dialogueCurrentTurn,
  dialogueClosedReason,
  dialogueIsOverdue,
  fetchMessages,
  sendMessage
}) => {
  const { t, i18n } = useTranslation();
  const resolvedDialogueId = dialogueId || applicationId || null;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [messages, setMessages] = useState<DialogueMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<DialogueMessageAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!resolvedDialogueId) {
        if (!cancelled) {
          setMessages([]);
          setError(null);
        }
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const rows = await fetchMessages(resolvedDialogueId);
        if (!cancelled) {
          setMessages(rows);
        }
      } catch (err) {
        console.error('Failed to load dialogue messages:', err);
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
  }, [resolvedDialogueId, fetchMessages, t]);

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
    if (!canSend) return;
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).slice(0, 3);
    if (!files.length) return;

    setUploading(true);
    try {
      const uploaded: DialogueMessageAttachment[] = [];
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
    if (!resolvedDialogueId || sending || !canSend) return;
    const body = draft.trim();
    if (!body && attachments.length === 0) return;

    setSending(true);
    try {
      const message = await sendMessage(resolvedDialogueId, {
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
      console.error('Failed to send dialogue message:', err);
      window.alert(
        t('application.messages.send_failed', {
          defaultValue: 'Nepodařilo se odeslat zprávu.'
        })
      );
    } finally {
      setSending(false);
    }
  };

  const isOwnMessage = (message: DialogueMessage) => message.sender_role === viewerRole;
  const normalizedStatus = String(dialogueStatus || 'pending').toLowerCase();
  const isActiveDialogue = ['pending', 'reviewed', 'shortlisted'].includes(normalizedStatus);
  const canSend = isActiveDialogue;

  const getTimingMeta = (): { label: string; className: string } | null => {
    const closedReason = String(dialogueClosedReason || '').trim().toLowerCase();
    if (normalizedStatus === 'closed_timeout' || closedReason === 'timeout') {
      return {
        label: t('application.messages.timeout_closed', {
          defaultValue: 'This dialogue is closed because the reply window expired.'
        }),
        className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
      };
    }

    if (!canSend) {
      return {
        label: t('application.messages.closed', {
          defaultValue: 'This dialogue is closed. New messages are disabled.'
        }),
        className: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-300'
      };
    }

    const deadlineValue = String(dialogueDeadlineAt || '').trim();
    if (!deadlineValue) return null;
    const deadline = new Date(deadlineValue);
    if (Number.isNaN(deadline.getTime())) return null;

    const msRemaining = deadline.getTime() - Date.now();
    const actorLabel =
      dialogueCurrentTurn === 'candidate'
        ? viewerRole === 'candidate'
          ? t('application.messages.turn_you', { defaultValue: 'Your reply is due' })
          : t('application.messages.turn_candidate', { defaultValue: 'Waiting for candidate' })
        : viewerRole === 'recruiter'
          ? t('application.messages.turn_you', { defaultValue: 'Your reply is due' })
          : t('application.messages.turn_company', { defaultValue: 'Waiting for company' });

    if (dialogueIsOverdue || msRemaining <= 0) {
      return {
        label: `${actorLabel} • ${t('application.messages.deadline_passed', { defaultValue: 'deadline passed' })}`,
        className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
      };
    }

    const totalHours = msRemaining / (60 * 60 * 1000);
    const windowLabel =
      totalHours < 1
        ? t('application.messages.deadline_under_hour', { defaultValue: '< 1 hour left' })
        : totalHours < 24
          ? t('application.messages.deadline_hours', {
              defaultValue: '{{count}} h left',
              count: Math.max(1, Math.ceil(totalHours))
            })
          : t('application.messages.deadline_days', {
              defaultValue: '{{count}} d left',
              count: Math.max(1, Math.ceil(totalHours / 24))
            });

    return {
      label: `${actorLabel} • ${windowLabel}`,
      className:
        totalHours <= 12
          ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
          : 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-300'
    };
  };

  const timingMeta = getTimingMeta();

  return (
    <div className="rounded-[1.05rem] border border-slate-200 bg-white/92 p-4 shadow-[0_20px_38px_-32px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-slate-900/80">
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

      {timingMeta && (
        <div className={`mt-4 rounded-[0.95rem] border px-4 py-3 text-sm font-medium ${timingMeta.className}`}>
          {timingMeta.label}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('application.messages.loading', { defaultValue: 'Načítám zprávy…' })}
          </div>
        ) : error ? (
          <div className="rounded-[0.95rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
            {error}
          </div>
        ) : messages.length === 0 ? (
          <div className="rounded-[0.95rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
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
                  className={`rounded-[1rem] border p-3.5 ${
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
                          {attachment.kind === 'audio' && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                              {attachment.transcript_status === 'ready'
                                ? t('application.messages.transcript_ready', { defaultValue: 'Transcript ready' })
                                : t('application.messages.transcript_pending', { defaultValue: 'Transcript pending' })}
                            </span>
                          )}
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

      <div className="mt-4 rounded-[1rem] border border-slate-200 bg-slate-50/90 p-3.5 dark:border-slate-700 dark:bg-slate-950/40">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={4}
          placeholder={t('application.messages.placeholder', {
            defaultValue: 'Napište interní zprávu k této přihlášce…'
          })}
          disabled={!canSend}
          className="w-full resize-none rounded-[0.95rem] border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-cyan-700 dark:focus:ring-cyan-900/40 dark:[color-scheme:dark]"
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
              accept=".pdf,.doc,.docx,.txt,.mp3,.m4a,.webm,.wav,.ogg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,audio/mpeg,audio/mp4,audio/x-m4a,audio/webm,audio/wav,audio/x-wav,audio/ogg"
            />
            <button
              type="button"
              onClick={handleAttachClick}
              disabled={!canSend || uploading || attachments.length >= 5}
              className="inline-flex items-center gap-2 rounded-[0.95rem] border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              {t('application.messages.attach', { defaultValue: 'Přiložit soubor' })}
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {t('application.messages.attach_hint', { defaultValue: 'PDF, DOC, DOCX, TXT nebo krátké audio. Soubory se ukládají mimo hlavní databázové úložiště.' })}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend || sending || uploading || (!draft.trim() && attachments.length === 0)}
            className="inline-flex items-center gap-2 rounded-[0.95rem] bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
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
