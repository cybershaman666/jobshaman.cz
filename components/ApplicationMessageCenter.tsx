import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Mail, Paperclip, Send } from 'lucide-react';

import { DialogueMessage, DialogueMessageAttachment } from '../types';
import { DialogueMessageCreatePayload } from '../services/jobApplicationService';
import { uploadApplicationMessageAttachment } from '../services/supabaseService';
import { EXTERNAL_ATTACHMENT_ACCEPT } from '../services/externalAssetService';

interface ApplicationMessageCenterProps {
  dialogueId?: string | null;
  applicationId?: string | null;
  storageOwnerId?: string | null;
  heading?: string;
  subtitle?: string;
  emptyText?: string;
  initialDraft?: string;
  composerPlaceholder?: string;
  sendButtonLabel?: string;
  allowAttachments?: boolean;
  showAttachmentPlaceholderWhenDisabled?: boolean;
  visualVariant?: 'default' | 'immersive';
  viewerRole: 'candidate' | 'recruiter';
  dialogueStatus?: string | null;
  dialogueDeadlineAt?: string | null;
  dialogueTimeoutHours?: number | null;
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
  initialDraft,
  composerPlaceholder,
  sendButtonLabel,
  allowAttachments = true,
  showAttachmentPlaceholderWhenDisabled = false,
  visualVariant = 'default',
  viewerRole,
  dialogueStatus,
  dialogueDeadlineAt,
  dialogueTimeoutHours,
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

  useEffect(() => {
    setDraft((current) => {
      if (!resolvedDialogueId) return current;
      if (current.trim().length > 0) return current;
      return initialDraft || '';
    });
  }, [resolvedDialogueId, initialDraft]);

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
    if (!allowAttachments || !canSend) return;
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
    const outgoingAttachments = allowAttachments ? attachments : [];
    if (!body && outgoingAttachments.length === 0) return;

    setSending(true);
    try {
      const message = await sendMessage(resolvedDialogueId, {
        body,
        attachments: outgoingAttachments
      });
      if (!message) {
        throw new Error('Message not sent');
      }
      setMessages((current) => [...current, message]);
      setDraft('');
      if (allowAttachments) {
        setAttachments([]);
      }
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

  const resolveAttachmentHref = (attachment: DialogueMessageAttachment): string => {
    return String(attachment.url || attachment.download_url || '').trim();
  };

  const resolveAttachmentName = (attachment: DialogueMessageAttachment): string => {
    const raw = String(attachment.name || attachment.filename || '').trim();
    if (raw) return raw;
    return t('application.messages.attachment_fallback_name', { defaultValue: 'Příloha' });
  };

  const isOwnMessage = (message: DialogueMessage) => message.sender_role === viewerRole;
  const normalizedStatus = String(dialogueStatus || 'pending').toLowerCase();
  const isActiveDialogue = ['pending', 'reviewed', 'shortlisted'].includes(normalizedStatus);
  const canSend = isActiveDialogue;
  const languagePrefix = String(i18n.language || 'en').split('-')[0].toLowerCase();
  const language = languagePrefix === 'at' ? 'de' : languagePrefix;
  const isImmersive = visualVariant === 'immersive';
  const resolvedTimeoutHours = (() => {
    const value = Number(dialogueTimeoutHours);
    if (Number.isFinite(value) && value > 0) {
      return Math.max(1, Math.round(value));
    }
    return 48;
  })();
  const responseSlaLabel =
    resolvedTimeoutHours % 24 === 0
      ? t('application.messages.sla_days', {
          defaultValue:
            language === 'cs' ? 'do {{count}} dnů'
              : language === 'sk' ? 'do {{count}} dní'
              : language === 'de' ? 'innerhalb von {{count}} Tagen'
              : language === 'pl' ? 'w ciągu {{count}} dni'
              : 'within {{count}} days',
          count: Math.max(1, Math.round(resolvedTimeoutHours / 24))
        })
      : t('application.messages.sla_hours', {
          defaultValue:
            language === 'cs' ? 'do {{count}} hodin'
              : language === 'sk' ? 'do {{count}} hodín'
              : language === 'de' ? 'innerhalb von {{count}} Stunden'
              : language === 'pl' ? 'w ciągu {{count}} godzin'
              : 'within {{count}} hours',
          count: resolvedTimeoutHours
        });
  const responseOutcomeLabels = {
    read: t('application.messages.guarantee_read', {
      defaultValue:
        language === 'cs' ? 'Přečteno'
          : language === 'sk' ? 'Prečítané'
          : language === 'de' ? 'Gelesen'
          : language === 'pl' ? 'Przeczytane'
          : 'Read'
    }),
    continue: t('application.messages.guarantee_continue', {
      defaultValue:
        language === 'cs' ? 'Chceme pokračovat'
          : language === 'sk' ? 'Chceme pokračovať'
          : language === 'de' ? 'Wir wollen weitermachen'
          : language === 'pl' ? 'Chcemy kontynuować'
          : 'We want to continue'
    }),
    declined: t('application.messages.guarantee_declined', {
      defaultValue:
        language === 'cs' ? 'Děkujeme, ale hledáme jiný přístup'
          : language === 'sk' ? 'Ďakujeme, ale hľadáme iný prístup'
          : language === 'de' ? 'Danke, aber wir wählen eine andere Richtung'
          : language === 'pl' ? 'Dziękujemy, ale wybieramy inny kierunek'
          : 'Thanks, but we are choosing a different direction'
    })
  };
  const activeOutcomeKey: 'read' | 'continue' | 'declined' | null = (() => {
    if (normalizedStatus === 'reviewed') return 'read';
    if (normalizedStatus === 'shortlisted' || normalizedStatus === 'hired') return 'continue';
    if (normalizedStatus === 'rejected' || normalizedStatus === 'closed_rejected') return 'declined';
    return null;
  })();
  const responseStateLabel = (() => {
    if (activeOutcomeKey) return responseOutcomeLabels[activeOutcomeKey];
    if (normalizedStatus === 'pending') {
      return viewerRole === 'candidate'
        ? t('application.messages.awaiting_company', {
          defaultValue:
            language === 'cs' ? 'Čeká na první reakci firmy'
              : language === 'sk' ? 'Čaká na prvú reakciu firmy'
              : language === 'de' ? 'Wartet auf die erste Reaktion des Unternehmens'
              : language === 'pl' ? 'Czeka na pierwszą reakcję firmy'
              : 'Waiting for the first company response'
        })
        : t('application.messages.awaiting_recruiter', {
          defaultValue:
            language === 'cs' ? 'Čeká na vaši první reakci'
              : language === 'sk' ? 'Čaká na vašu prvú reakciu'
              : language === 'de' ? 'Wartet auf Ihre erste Reaktion'
              : language === 'pl' ? 'Czeka na twoją pierwszą reakcję'
              : 'Waiting for your first response'
        });
    }
    if (normalizedStatus === 'closed_timeout') {
      return t('application.messages.auto_closed', {
        defaultValue:
          language === 'cs' ? 'Automaticky uzavřeno bez odpovědi'
            : language === 'sk' ? 'Automaticky uzavreté bez odpovede'
            : language === 'de' ? 'Automatisch ohne Antwort geschlossen'
            : language === 'pl' ? 'Automatycznie zamknięte bez odpowiedzi'
            : 'Auto-closed without response'
      });
    }
    if (!canSend) {
      return t('application.messages.closed_simple', {
        defaultValue:
          language === 'cs' ? 'Dialog uzavřen'
            : language === 'sk' ? 'Dialóg uzavretý'
            : language === 'de' ? 'Dialog geschlossen'
            : language === 'pl' ? 'Dialog zamknięty'
            : 'Dialogue closed'
      });
    }
    return t('application.messages.in_progress', {
      defaultValue:
        language === 'cs' ? 'Probíhá'
          : language === 'sk' ? 'Prebieha'
          : language === 'de' ? 'Läuft'
          : language === 'pl' ? 'W toku'
          : 'In progress'
    });
  })();

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
  const rootClassName = isImmersive
    ? 'company-surface-elevated rounded-[1.15rem] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.12),_transparent_34%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.94))] p-4 shadow-[0_24px_48px_-36px_rgba(15,23,42,0.45)] backdrop-blur dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.18),_transparent_30%),linear-gradient(180deg,_rgba(15,23,42,0.98),_rgba(2,6,23,0.94))]'
    : 'rounded-[1.05rem] border border-slate-200 bg-white/92 p-4 shadow-[0_20px_38px_-32px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-slate-900/80';
  const guaranteeClassName = isImmersive
    ? 'mt-4 rounded-[0.95rem] border border-slate-200/80 bg-white/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/45'
    : 'mt-4 rounded-[0.95rem] border border-slate-200 bg-slate-50/85 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/35';
  const ownMessageClassName = isImmersive
    ? 'border-cyan-200/80 bg-[linear-gradient(160deg,_rgba(236,254,255,0.9),_rgba(224,242,254,0.68))] shadow-[0_14px_26px_-24px_rgba(6,182,212,0.45)] dark:border-cyan-900/40 dark:bg-[linear-gradient(160deg,_rgba(8,47,73,0.32),_rgba(12,74,110,0.2))]'
    : 'border-cyan-200 bg-cyan-50/70 dark:border-cyan-900/40 dark:bg-cyan-950/10';
  const otherMessageClassName = isImmersive
    ? 'border-slate-200/80 bg-[linear-gradient(160deg,_rgba(255,255,255,0.95),_rgba(241,245,249,0.86))] shadow-[0_14px_28px_-24px_rgba(15,23,42,0.28)] dark:border-slate-700 dark:bg-[linear-gradient(160deg,_rgba(15,23,42,0.74),_rgba(2,6,23,0.6))]'
    : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/40';
  const composerClassName = isImmersive
    ? 'mt-4 rounded-[1rem] border border-slate-200/80 bg-white/80 p-3.5 dark:border-slate-700 dark:bg-slate-950/45'
    : 'mt-4 rounded-[1rem] border border-slate-200 bg-slate-50/90 p-3.5 dark:border-slate-700 dark:bg-slate-950/40';
  const sendButtonClassName = isImmersive
    ? 'inline-flex items-center gap-2 rounded-[0.95rem] bg-[linear-gradient(135deg,_rgba(8,145,178,0.96),_rgba(14,116,144,0.96))] px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60'
    : 'inline-flex items-center gap-2 rounded-[0.95rem] bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200';
  const badgeClassName = isImmersive
    ? 'inline-flex items-center gap-2 rounded-full border border-cyan-200/80 bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:border-cyan-900/40 dark:bg-slate-950/40 dark:text-cyan-300'
    : 'inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:border-cyan-900/40 dark:bg-cyan-950/20 dark:text-cyan-300';
  const showDemoAttachmentPlaceholder = !allowAttachments && showAttachmentPlaceholderWhenDisabled;

  return (
    <div className={rootClassName}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={badgeClassName}>
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

      <div className={guaranteeClassName}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            {t('application.messages.reaction_guarantee_title', {
              defaultValue:
                language === 'cs' ? 'Garance reakce'
                  : language === 'sk' ? 'Garancia reakcie'
                  : language === 'de' ? 'Reaktionsgarantie'
                  : language === 'pl' ? 'Gwarancja reakcji'
                  : 'Reaction guarantee'
            })}
          </div>
          <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-300">
            {responseStateLabel}
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
          {viewerRole === 'candidate'
            ? t('application.messages.reaction_sla_candidate', {
                defaultValue:
                  language === 'cs' ? 'Firma odpovídá obvykle {{window}}.'
                    : language === 'sk' ? 'Firma odpovedá zvyčajne {{window}}.'
                    : language === 'de' ? 'Unternehmen antworten normalerweise {{window}}.'
                    : language === 'pl' ? 'Firmy zwykle odpowiadają {{window}}.'
                    : 'Companies usually respond {{window}}.',
                window: responseSlaLabel
              })
            : t('application.messages.reaction_sla_recruiter', {
                defaultValue:
                  language === 'cs' ? 'Kandidát vidí očekávání odpovědi {{window}}.'
                    : language === 'sk' ? 'Kandidát vidí očakávanie odpovede {{window}}.'
                    : language === 'de' ? 'Kandidaten sehen eine Antwort-Erwartung von {{window}}.'
                    : language === 'pl' ? 'Kandydat widzi oczekiwany czas odpowiedzi {{window}}.'
                    : 'Candidates see response expectation {{window}}.',
                window: responseSlaLabel
              })}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(responseOutcomeLabels) as Array<'read' | 'continue' | 'declined'>).map((key) => (
            <span
              key={key}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                activeOutcomeKey === key
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {responseOutcomeLabels[key]}
            </span>
          ))}
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
                      ? ownMessageClassName
                      : otherMessageClassName
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
                        (() => {
                          const href = resolveAttachmentHref(attachment);
                          const attachmentName = resolveAttachmentName(attachment);
                          const className = 'inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800';
                          const content = (
                            <>
                              <Paperclip className="h-3.5 w-3.5" />
                              {attachmentName}
                              {attachment.kind === 'audio' && (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                  {attachment.transcript_status === 'ready'
                                    ? t('application.messages.transcript_ready', { defaultValue: 'Transcript ready' })
                                    : t('application.messages.transcript_pending', { defaultValue: 'Transcript pending' })}
                                </span>
                              )}
                            </>
                          );

                          if (!href) {
                            return (
                              <span key={`${attachmentName}-${index}`} className={className}>
                                {content}
                              </span>
                            );
                          }

                          return (
                            <a
                              key={`${href}-${index}`}
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              className={className}
                            >
                              {content}
                            </a>
                          );
                        })()
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className={composerClassName}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={4}
          placeholder={composerPlaceholder || t('application.messages.placeholder', {
            defaultValue: 'Napište interní zprávu k této přihlášce…'
          })}
          disabled={!canSend}
          className="w-full resize-none rounded-[0.95rem] border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-cyan-700 dark:focus:ring-cyan-900/40 dark:[color-scheme:dark]"
        />

        {allowAttachments && attachments.length > 0 && (
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

        {showDemoAttachmentPlaceholder ? (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                disabled
                aria-disabled="true"
                aria-label={t('application.messages.attach', { defaultValue: 'Přiložit soubor' })}
                title={t('application.messages.attach', { defaultValue: 'Přiložit soubor' })}
                className="inline-flex h-8 w-8 items-center justify-center rounded-[0.7rem] border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend || sending || uploading || (!draft.trim() && (!allowAttachments || attachments.length === 0))}
                className={sendButtonClassName}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sendButtonLabel || t('application.messages.send', { defaultValue: 'Odeslat zprávu' })}
              </button>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t('application.messages.attach_disabled_demo_hint', {
                defaultValue: 'V demu je upload vypnutý. V ostrém flow lze posílat dokumenty, obrázky i návrhy smluv.',
              })}
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {allowAttachments ? (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    onChange={handleFilesSelected}
                    accept={EXTERNAL_ATTACHMENT_ACCEPT}
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
                    {t('application.messages.attach_hint', { defaultValue: 'PDF, DOCX, PPTX, XLSX, obrázky, TXT/MD nebo krátké audio. Hodí se i pro návrh smlouvy v PDF.' })}
                  </span>
                </>
              ) : null}
            </div>

            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend || sending || uploading || (!draft.trim() && (!allowAttachments || attachments.length === 0))}
              className={sendButtonClassName}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sendButtonLabel || t('application.messages.send', { defaultValue: 'Odeslat zprávu' })}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApplicationMessageCenter;
