import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Briefcase, Clock3, ExternalLink, Eye, Loader2, Mail, Search, Trash2 } from 'lucide-react';

import { CandidateDialogueCapacity, DialogueDetail, DialogueSummary, Job, UserProfile } from '../types';
import {
  fetchMyDialogueDetail,
  fetchMyDialogueCapacity,
  fetchMyDialogueMessages,
  fetchMyDialogues,
  sendMyDialogueMessage,
  withdrawMyDialogue
} from '../services/jobApplicationService';
import ApplicationMessageCenter from './ApplicationMessageCenter';
import MyInvitations from './MyInvitations';
import SavedJobsPage from './SavedJobsPage';

interface ProfileJobManagerProps {
  userProfile: UserProfile;
  savedJobs: Job[];
  savedJobIds: string[];
  onToggleSave: (jobId: string) => void;
  onJobSelect: (jobId: string) => void;
  onApplyToJob: (job: Job) => void;
  selectedJobId: string | null;
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

type CandidateDialogueStatus = DialogueSummary['status'];

const ACTIVE_STATUSES: CandidateDialogueStatus[] = ['pending', 'reviewed', 'shortlisted'];
const LOCKED_WITHDRAW_STATUSES: CandidateDialogueStatus[] = [
  'rejected',
  'hired',
  'withdrawn',
  'closed',
  'closed_timeout',
  'closed_rejected',
  'closed_withdrawn',
  'closed_role_filled'
];

const ProfileJobManager: React.FC<ProfileJobManagerProps> = ({
  userProfile,
  savedJobs,
  savedJobIds,
  onToggleSave,
  onJobSelect,
  onApplyToJob,
  selectedJobId,
  searchTerm,
  onSearchChange
}) => {
  const { t, i18n } = useTranslation();
  const [dialogues, setDialogues] = useState<DialogueSummary[]>([]);
  const [loadingDialogues, setLoadingDialogues] = useState(false);
  const [dialoguesError, setDialoguesError] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [activeDetailId, setActiveDetailId] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<DialogueDetail | null>(null);
  const [dialogueCapacity, setDialogueCapacity] = useState<CandidateDialogueCapacity | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [dialogueSearch, setDialogueSearch] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadDialogues = async () => {
      if (!userProfile.id) {
        if (!cancelled) {
          setDialogues([]);
          setDialoguesError(null);
        }
        return;
      }

      setLoadingDialogues(true);
      setDialoguesError(null);

      try {
        const [rows, capacity] = await Promise.all([
          fetchMyDialogues(80),
          fetchMyDialogueCapacity()
        ]);
        if (!cancelled) {
          setDialogues(rows);
          setDialogueCapacity(capacity);
          if (rows.length > 0 && !activeDetailId) {
            setActiveDetailId(rows[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to load candidate applications:', error);
        if (!cancelled) {
          setDialogues([]);
          setDialogueCapacity(null);
          setDialoguesError(
            t('profile.job_hub.load_failed', {
              defaultValue: 'Nepodařilo se načíst přehled dialogových vláken.'
            })
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingDialogues(false);
        }
      }
    };

    loadDialogues();

    return () => {
      cancelled = true;
    };
  }, [t, userProfile.id]);

  useEffect(() => {
    if (dialogues.length === 0) {
      if (activeDetailId) {
        setActiveDetailId(null);
      }
      return;
    }
    if (!activeDetailId || !dialogues.some((item) => item.id === activeDetailId)) {
      setActiveDetailId(dialogues[0].id);
    }
  }, [activeDetailId, dialogues]);

  useEffect(() => {
    let cancelled = false;

    const loadDetail = async () => {
      if (!activeDetailId) {
        setActiveDetail(null);
        setDetailError(null);
        return;
      }

      setLoadingDetail(true);
      setDetailError(null);

      try {
        const detail = await fetchMyDialogueDetail(activeDetailId);
        if (!detail) {
          throw new Error('Application detail unavailable');
        }
        if (!cancelled) {
          setActiveDetail(detail);
          setDialogues((current) =>
            current.map((item) => (item.id === detail.id ? { ...item, ...detail } : item))
          );
        }
      } catch (error) {
        console.error('Failed to load application detail:', error);
        if (!cancelled) {
          setActiveDetail(null);
          setDetailError(
            t('profile.job_hub.detail_failed', {
              defaultValue: 'Nepodařilo se načíst detail otevřeného handshaku.'
            })
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingDetail(false);
        }
      }
    };

    loadDetail();

    return () => {
      cancelled = true;
    };
  }, [activeDetailId, t]);

  const filteredDialogues = (() => {
    const query = dialogueSearch.trim().toLowerCase();
    if (!query) return dialogues;
    return dialogues.filter((dialogue) => {
      const haystack = [
        dialogue.job_snapshot?.title,
        dialogue.job_snapshot?.company,
        dialogue.company_name,
        dialogue.job_snapshot?.location,
        dialogue.source
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  })();

  const activeCount = dialogues.filter((item) => ACTIVE_STATUSES.includes(item.status)).length;

  const handleOpenDialogueDetail = (dialogueId: string) => {
    setActiveDetailId(dialogueId);
  };

  const handleWithdrawDialogue = async (dialogue: DialogueSummary) => {
    if (!dialogue?.id || LOCKED_WITHDRAW_STATUSES.includes(dialogue.status)) return;

    const confirmed = window.confirm(
      t('profile.job_hub.withdraw_confirm', {
        defaultValue: 'Opravdu chcete tento dialog uzavřít?'
      })
    );
    if (!confirmed) return;

    setWithdrawingId(dialogue.id);
    try {
      const result = await withdrawMyDialogue(dialogue.id);
      if (!result.ok) {
        throw new Error('Withdraw failed');
      }

      const updatedAt = new Date().toISOString();
      setDialogues((current) =>
        current.map((item) =>
          item.id === dialogue.id
            ? { ...item, status: 'withdrawn', updated_at: updatedAt }
            : item
        )
      );
      setActiveDetail((current) =>
        current && current.id === dialogue.id
          ? { ...current, status: 'withdrawn', updated_at: updatedAt }
          : current
      );
      setDialogueCapacity((current) =>
        current
          ? {
              ...current,
              active: Math.max(0, current.active - 1),
              remaining: Math.min(current.limit, current.remaining + 1)
            }
          : current
      );
    } catch (error) {
      console.error('Failed to withdraw application:', error);
      window.alert(
        t('profile.job_hub.withdraw_failed', {
          defaultValue: 'Dialog se nepodařilo uzavřít.'
        })
      );
    } finally {
      setWithdrawingId(null);
    }
  };

  const openUrl = (url?: string | null) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openMail = (email?: string | null, subject?: string | null) => {
    if (!email) return;
    const mailto = `mailto:${encodeURIComponent(email)}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
    window.location.href = mailto;
  };

  const formatTimestamp = (value?: string | null): string => {
    if (!value) {
      return t('profile.job_hub.not_available', { defaultValue: 'Neuvedeno' });
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    return parsed.toLocaleString(i18n.language || undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusLabel = (status: CandidateDialogueStatus): string => {
    const languagePrefix = String(i18n.language || 'en').split('-')[0].toLowerCase();
    const isCsLike = languagePrefix === 'cs' || languagePrefix === 'sk';
    switch (status) {
      case 'reviewed':
        return t('profile.job_hub.status_reviewed', { defaultValue: isCsLike ? 'Přečteno' : 'Read' });
      case 'shortlisted':
        return t('profile.job_hub.status_shortlisted', { defaultValue: isCsLike ? 'Chceme pokračovat' : 'We want to continue' });
      case 'rejected':
      case 'closed_rejected':
        return t('profile.job_hub.status_rejected', {
          defaultValue: isCsLike ? 'Děkujeme, ale hledáme jiný přístup' : 'Thanks, we are choosing a different direction'
        });
      case 'hired':
        return t('profile.job_hub.status_hired', { defaultValue: 'Přijato' });
      case 'withdrawn':
      case 'closed_withdrawn':
        return t('profile.job_hub.status_withdrawn', { defaultValue: 'Uzavřeno z vaší strany' });
      case 'closed_timeout':
        return t('profile.job_hub.status_timeout', { defaultValue: 'Uzavřeno pro neaktivitu' });
      case 'closed_role_filled':
        return t('profile.job_hub.status_role_filled', { defaultValue: 'Pozice uzavřena' });
      case 'closed':
        return t('profile.job_hub.status_closed', { defaultValue: 'Uzavřeno' });
      default:
        return t('profile.job_hub.status_pending', {
          defaultValue: isCsLike ? 'Čeká na první reakci firmy' : 'Waiting for first company response'
        });
    }
  };

  const getStatusClassName = (status: CandidateDialogueStatus): string => {
    switch (status) {
      case 'reviewed':
        return 'bg-[var(--accent-soft)] text-[var(--accent)]';
      case 'shortlisted':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      case 'rejected':
      case 'closed_rejected':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300';
      case 'hired':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'withdrawn':
      case 'closed_withdrawn':
      case 'closed':
        return 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
      case 'closed_timeout':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      case 'closed_role_filled':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const getDialogueClosedReasonMeta = (
    dialogue: Pick<DialogueSummary, 'status' | 'dialogue_closed_reason'>
  ): { label: string; className: string } | null => {
    if (!dialogue || ACTIVE_STATUSES.includes(dialogue.status)) {
      return null;
    }

    const normalizedReason = String(dialogue.dialogue_closed_reason || dialogue.status || '')
      .trim()
      .toLowerCase();

    switch (normalizedReason) {
      case 'timeout':
      case 'closed_timeout':
        return {
          label: t('profile.job_hub.close_reason_timeout', { defaultValue: 'Nikdo neodpověděl včas, takže se dialog automaticky uzavřel.' }),
          className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
        };
      case 'rejected':
      case 'closed_rejected':
        return {
          label: t('profile.job_hub.close_reason_rejected', { defaultValue: 'Firma se rozhodla v tomto dialogu nepokračovat.' }),
          className: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300'
        };
      case 'withdrawn':
      case 'closed_withdrawn':
        return {
          label: t('profile.job_hub.close_reason_withdrawn', { defaultValue: 'Dialog jste uzavřeli vy.' }),
          className: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
        };
      case 'closed_role_filled':
        return {
          label: t('profile.job_hub.close_reason_role_filled', { defaultValue: 'Pozice byla mezitím obsazena.' }),
          className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300'
        };
      case 'hired':
        return {
          label: t('profile.job_hub.close_reason_hired', { defaultValue: 'Firma vás posunula do stavu přijetí.' }),
          className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
        };
      case 'closed':
      default:
        return {
          label: t('profile.job_hub.close_reason_generic', { defaultValue: 'Tento dialog byl uzavřen bez dalšího kroku.' }),
          className: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
        };
    }
  };

  const getDialogueTimingMeta = (
    dialogue: Pick<
      DialogueSummary,
      'status' | 'dialogue_deadline_at' | 'dialogue_current_turn' | 'dialogue_closed_reason' | 'dialogue_is_overdue'
    >
  ): { label: string; className: string } | null => {
    if (!dialogue) return null;

    const closedReason = String(dialogue.dialogue_closed_reason || '').trim().toLowerCase();
    if (dialogue.status === 'closed_timeout' || closedReason === 'timeout') {
      return {
        label: t('profile.job_hub.timeout_closed', { defaultValue: 'Dialog se uzavřel kvůli chybějící odpovědi.' }),
        className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
      };
    }

    if (!ACTIVE_STATUSES.includes(dialogue.status)) {
      return null;
    }

    const deadlineValue = String(dialogue.dialogue_deadline_at || '').trim();
    if (!deadlineValue) return null;
    const deadline = new Date(deadlineValue);
    if (Number.isNaN(deadline.getTime())) return null;

    const msRemaining = deadline.getTime() - Date.now();
    const actorLabel =
      dialogue.dialogue_current_turn === 'candidate'
        ? t('profile.job_hub.turn_candidate', { defaultValue: 'Na tahu jste vy' })
        : t('profile.job_hub.turn_company', { defaultValue: 'Čeká se na firmu' });

    if (dialogue.dialogue_is_overdue || msRemaining <= 0) {
      return {
        label: `${actorLabel} • ${t('profile.job_hub.deadline_passed', { defaultValue: 'lhůta právě vypršela' })}`,
        className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
      };
    }

    const totalHours = msRemaining / (60 * 60 * 1000);
    const windowLabel =
      totalHours < 1
        ? t('profile.job_hub.deadline_under_hour', { defaultValue: 'méně než hodina' })
        : totalHours < 24
          ? t('profile.job_hub.deadline_hours', {
              defaultValue: 'zbývá {{count}} h',
              count: Math.max(1, Math.ceil(totalHours))
            })
          : t('profile.job_hub.deadline_days', {
              defaultValue: 'zbývá {{count}} d',
              count: Math.max(1, Math.ceil(totalHours / 24))
            });

    const className =
      totalHours <= 12
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
        : 'bg-[var(--accent-soft)] text-[var(--accent)]';

    return {
      label: `${actorLabel} • ${windowLabel}`,
      className
    };
  };

  const getResponseSlaHint = (
    dialogue: Pick<DialogueSummary, 'dialogue_timeout_hours'>
  ): string => {
    const rawHours = Number(dialogue.dialogue_timeout_hours);
    const resolvedHours = Number.isFinite(rawHours) && rawHours > 0 ? Math.max(1, Math.round(rawHours)) : 48;
    const languagePrefix = String(i18n.language || 'en').split('-')[0].toLowerCase();
    const isCsLike = languagePrefix === 'cs' || languagePrefix === 'sk';
    const windowLabel =
      resolvedHours % 24 === 0
        ? t('profile.job_hub.response_sla_days', {
            defaultValue: isCsLike ? '{{count}} dní' : '{{count}} days',
            count: Math.max(1, Math.round(resolvedHours / 24))
          })
        : t('profile.job_hub.response_sla_hours', {
            defaultValue: isCsLike ? '{{count}} hodin' : '{{count}} hours',
            count: resolvedHours
          });
    return t('profile.job_hub.response_sla_hint', {
      defaultValue: isCsLike ? 'Firma odpovídá obvykle do {{window}}' : 'Company usually replies within {{window}}',
      window: windowLabel
    });
  };

  const renderDialogueSignals = (dialogue: DialogueSummary) => {
    const timingMeta = getDialogueTimingMeta(dialogue);
    const closeReasonMeta = getDialogueClosedReasonMeta(dialogue);
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {timingMeta && (
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${timingMeta.className}`}>
            {timingMeta.label}
          </span>
        )}
        {closeReasonMeta && (
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${closeReasonMeta.className}`}>
            {closeReasonMeta.label}
          </span>
        )}
        <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent)]">
          {getResponseSlaHint(dialogue)}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {dialogue.has_cover_letter
            ? t('profile.job_hub.cover_letter_yes', { defaultValue: 'Motivační dopis odeslán' })
            : t('profile.job_hub.cover_letter_no', { defaultValue: 'Bez motivačního dopisu' })}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {dialogue.has_cv
            ? t('profile.job_hub.supporting_doc_yes', { defaultValue: 'Podklad přiložen' })
            : t('profile.job_hub.supporting_doc_no', { defaultValue: 'Bez podkladu' })}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {dialogue.has_jcfpm
            ? t('profile.job_hub.jcfpm_yes', { defaultValue: 'JCFPM sdíleno' })
            : t('profile.job_hub.jcfpm_no', { defaultValue: 'JCFPM nesdíleno' })}
        </span>
      </div>
    );
  };

  const renderDialogueDetail = () => {
    if (loadingDetail) {
      return (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('profile.job_hub.detail_loading', { defaultValue: 'Načítám detail otevřeného handshaku…' })}
        </div>
      );
    }

    if (detailError) {
      return (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
          {detailError}
        </div>
      );
    }

    if (!activeDetail) return null;

    const sharedPayload = activeDetail.shared_jcfpm_payload as any;
    const comparisonSignals = Array.isArray(sharedPayload?.comparison_signals)
      ? sharedPayload.comparison_signals
      : [];
    const timingMeta = getDialogueTimingMeta(activeDetail);
    const closeReasonMeta = getDialogueClosedReasonMeta(activeDetail);

    return (
      <div className="rounded-[1.05rem] border border-slate-200/80 bg-white/92 p-5 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.24)] dark:border-slate-700 dark:bg-slate-900/92">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--accent-rgb),0.18)] bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
              <Eye className="h-3.5 w-3.5" />
              {t('profile.job_hub.detail_badge', { defaultValue: 'Detail otevřeného handshaku' })}
            </div>
            <h3 className="mt-3 text-xl font-semibold text-slate-900 dark:text-white">
              {activeDetail.job_snapshot?.title || t('profile.job_hub.unknown_position', { defaultValue: 'Neznámá pozice' })}
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {[activeDetail.company_name || activeDetail.job_snapshot?.company, activeDetail.job_snapshot?.location]
                .filter(Boolean)
                .join(' • ') || t('profile.job_hub.not_available', { defaultValue: 'Neuvedeno' })}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {activeDetail.job_snapshot?.contact_email && (
              <button
                type="button"
                onClick={() => openMail(activeDetail.job_snapshot?.contact_email, activeDetail.job_snapshot?.title || null)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Mail className="h-4 w-4" />
                {t('profile.job_hub.contact_company', { defaultValue: 'Napsat firmě' })}
              </button>
            )}
            {activeDetail.company_website && (
              <button
                type="button"
                onClick={() => openUrl(activeDetail.company_website)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <ExternalLink className="h-4 w-4" />
                {t('profile.job_hub.company_site', { defaultValue: 'Web firmy' })}
              </button>
            )}
            {activeDetail.job_snapshot?.url && (
              <button
                type="button"
                onClick={() => openUrl(activeDetail.job_snapshot?.url)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              >
                <ExternalLink className="h-4 w-4" />
                {t('profile.job_hub.original_listing', { defaultValue: 'Původní inzerát' })}
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          <div className="rounded-[0.95rem] border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              {t('profile.job_hub.meta.sent', { defaultValue: 'Odesláno' })}
            </div>
            <div className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
              {formatTimestamp(activeDetail.submitted_at)}
            </div>
          </div>
          <div className="rounded-[0.95rem] border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              {t('profile.job_hub.meta.updated', { defaultValue: 'Poslední změna' })}
            </div>
            <div className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
              {formatTimestamp(activeDetail.updated_at)}
            </div>
          </div>
          <div className="rounded-[0.95rem] border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              {t('profile.job_hub.meta.status', { defaultValue: 'Stav' })}
            </div>
            <div className="mt-2">
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClassName(activeDetail.status)}`}>
                {getStatusLabel(activeDetail.status)}
              </span>
              {closeReasonMeta && (
                <div className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
                  {closeReasonMeta.label}
                </div>
              )}
            </div>
          </div>
          <div className="rounded-[0.95rem] border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              {closeReasonMeta
                ? t('profile.job_hub.meta.closed_reason', { defaultValue: 'Důvod uzavření' })
                : t('profile.job_hub.meta.next_step', { defaultValue: 'Další krok' })}
            </div>
            <div className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
              {closeReasonMeta
                ? closeReasonMeta.label
                : timingMeta
                  ? timingMeta.label
                  : t('profile.job_hub.no_deadline', { defaultValue: 'Bez aktivní lhůty' })}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <div className="rounded-[1rem] border border-slate-200/80 bg-white/90 p-5 dark:border-slate-700 dark:bg-slate-900/80">
            <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              {t('profile.job_hub.sent_payload', { defaultValue: 'Co bylo odesláno' })}
            </h4>
            <div className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-300">
              <div className="flex items-center justify-between gap-4">
                <span>{t('profile.job_hub.cover_letter', { defaultValue: 'Motivační dopis' })}</span>
                <span className="font-semibold">
                  {activeDetail.has_cover_letter
                    ? t('common.yes', { defaultValue: 'Ano' })
                    : t('common.no', { defaultValue: 'Ne' })}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>{t('profile.job_hub.supporting_doc', { defaultValue: 'Podpůrný dokument' })}</span>
                <span className="font-semibold text-right">
                  {activeDetail.cv_snapshot?.originalName ||
                    activeDetail.cv_snapshot?.label ||
                    (activeDetail.has_cv
                      ? t('profile.job_hub.supporting_doc_attached', { defaultValue: 'Přiloženo' })
                      : t('profile.job_hub.supporting_doc_missing', { defaultValue: 'Nepřiloženo' }))}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>{t('profile.job_hub.jcfpm', { defaultValue: 'JCFPM sdílení' })}</span>
                <span className="font-semibold">
                  {activeDetail.jcfpm_share_level === 'summary'
                    ? t('profile.job_hub.jcfpm_summary', { defaultValue: 'Hiring profil' })
                    : t('profile.job_hub.jcfpm_none', { defaultValue: 'Nesdíleno' })}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-[1rem] border border-slate-200/80 bg-white/90 p-5 dark:border-slate-700 dark:bg-slate-900/80">
            <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              {t('profile.job_hub.profile_snapshot', { defaultValue: 'Profil sdílený při handshaku' })}
            </h4>
            <div className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-300">
              <div className="flex items-center justify-between gap-4">
                <span>{t('profile.job_hub.snapshot_name', { defaultValue: 'Jméno' })}</span>
                <span className="font-semibold text-right">
                  {activeDetail.candidate_profile_snapshot?.name || t('profile.job_hub.not_available', { defaultValue: 'Neuvedeno' })}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>{t('profile.job_hub.snapshot_email', { defaultValue: 'Email' })}</span>
                <span className="font-semibold text-right">
                  {activeDetail.candidate_profile_snapshot?.email || t('profile.job_hub.not_available', { defaultValue: 'Neuvedeno' })}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>{t('profile.job_hub.snapshot_phone', { defaultValue: 'Telefon' })}</span>
                <span className="font-semibold text-right">
                  {activeDetail.candidate_profile_snapshot?.phone || t('profile.job_hub.not_available', { defaultValue: 'Neuvedeno' })}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>{t('profile.job_hub.snapshot_role', { defaultValue: 'Role' })}</span>
                <span className="font-semibold text-right">
                  {activeDetail.candidate_profile_snapshot?.jobTitle || t('profile.job_hub.not_available', { defaultValue: 'Neuvedeno' })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {!!activeDetail.cover_letter && (
          <div className="mt-6 rounded-[1rem] border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950/40">
            <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              {t('profile.job_hub.cover_letter_title', { defaultValue: 'Odeslaný motivační dopis' })}
            </h4>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-300">
              {activeDetail.cover_letter}
            </p>
          </div>
        )}

        {activeDetail.has_jcfpm && (
          <div className="mt-6 rounded-[1rem] border border-[rgba(var(--accent-rgb),0.18)] bg-[rgba(var(--accent-rgb),0.06)] p-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                  {t('profile.job_hub.jcfpm_shared_signal', { defaultValue: 'Sdílený JCFPM hiring signal' })}
                </h4>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {sharedPayload?.archetype?.title ||
                    t('profile.job_hub.jcfpm_signal_desc', {
                      defaultValue: 'Firma dostala pouze zkrácený hiring profil pro porovnání s ostatními uchazeči.'
                    })}
                </p>
              </div>
              <span className="inline-flex rounded-full border border-[rgba(var(--accent-rgb),0.18)] bg-white px-3 py-1 text-xs font-semibold text-[var(--accent)] dark:bg-slate-900/70">
                {t('profile.job_hub.jcfpm_summary_only', { defaultValue: 'Pouze summary' })}
              </span>
            </div>

            {comparisonSignals.length > 0 && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {comparisonSignals.slice(0, 4).map((signal: any) => {
                  const score = Number(signal?.score || 0);
                  const clamped = Math.max(0, Math.min(100, score));
                  return (
                    <div key={String(signal?.key || signal?.label)} className="rounded-xl border border-[rgba(var(--accent-rgb),0.14)] bg-white/90 p-4 dark:bg-slate-900/70">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {signal?.label || signal?.key}
                        </span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">{clamped}</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-800">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-400"
                          style={{ width: `${clamped}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="mt-6">
          <ApplicationMessageCenter
            dialogueId={activeDetail.id}
            storageOwnerId={userProfile.id || null}
            viewerRole="candidate"
            dialogueStatus={activeDetail.status}
            dialogueDeadlineAt={activeDetail.dialogue_deadline_at || null}
            dialogueTimeoutHours={activeDetail.dialogue_timeout_hours ?? null}
            dialogueCurrentTurn={activeDetail.dialogue_current_turn || null}
            dialogueClosedReason={activeDetail.dialogue_closed_reason || null}
            dialogueIsOverdue={Boolean(activeDetail.dialogue_is_overdue)}
            heading={t('profile.job_hub.messages_title', { defaultValue: 'Komunikace s firmou' })}
            subtitle={t('profile.job_hub.messages_desc', {
              defaultValue: 'Asynchronní vlákno pro doplnění podkladů, dokumentů a další komunikaci k tomuto dialogu.'
            })}
            emptyText={t('profile.job_hub.messages_empty', {
              defaultValue: 'Zatím tu nejsou žádné zprávy. Pokud firma něco doplní nebo budete chtít poslat dokument, objeví se to zde.'
            })}
            fetchMessages={fetchMyDialogueMessages}
            sendMessage={sendMyDialogueMessage}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[1.15rem] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.12),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(251,191,36,0.10),_transparent_32%),linear-gradient(180deg,_rgba(255,255,255,0.97)_0%,_rgba(241,245,249,0.98)_100%)] p-5 shadow-[0_18px_38px_-34px_rgba(15,23,42,0.26)] dark:border-slate-700 dark:bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.12),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(251,191,36,0.08),_transparent_32%),linear-gradient(180deg,_rgba(2,6,23,0.97)_0%,_rgba(15,23,42,0.98)_100%)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--accent-rgb),0.18)] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)] dark:bg-slate-900/70">
              <Briefcase className="h-3.5 w-3.5" />
              {t('profile.job_hub.badge', { defaultValue: 'Dialogové centrum' })}
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">
              {t('profile.job_hub.title', { defaultValue: 'Správa rolí a úvodních dialogů' })}
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
              {t('profile.job_hub.desc', {
                defaultValue: 'Na jednom místě vidíte otevřené dialogy, co přesně bylo sdíleno, a můžete se vracet k asynchronní komunikaci s firmami.'
              })}
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[rgba(var(--accent-rgb),0.18)] bg-white/80 px-3 py-1.5 text-xs font-medium text-[var(--accent)] dark:bg-slate-900/70">
              <Clock3 className="h-3.5 w-3.5" />
              {dialogueCapacity
                ? t('profile.job_hub.capacity_inline', {
                    defaultValue: '{{remaining}} volné sloty z {{limit}}',
                    remaining: dialogueCapacity.remaining,
                    limit: dialogueCapacity.limit
                  })
                : t('profile.job_hub.capacity_inline_fallback', {
                    defaultValue: 'Kapacita dialogových vláken se právě načítá'
                  })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-[0.95rem] border border-slate-200/80 bg-white/90 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70">
              <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('profile.job_hub.metrics.applied', { defaultValue: 'Odpovědi' })}
              </div>
              <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{dialogues.length}</div>
            </div>
            <div className="rounded-[0.95rem] border border-slate-200/80 bg-white/90 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70">
              <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('profile.job_hub.metrics.active', { defaultValue: 'Aktivní' })}
              </div>
              <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{activeCount}</div>
            </div>
            <div className="col-span-2 rounded-[0.95rem] border border-slate-200/80 bg-white/90 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70 sm:col-span-1">
              <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('profile.job_hub.metrics.capacity', { defaultValue: 'Dialogové sloty' })}
              </div>
              <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
                {dialogueCapacity ? `${dialogueCapacity.active}/${dialogueCapacity.limit}` : activeCount}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                {dialogueCapacity
                  ? t('profile.job_hub.metrics.capacity_hint', {
                      defaultValue: '{{count}} volných',
                      count: dialogueCapacity.remaining
                    })
                  : t('profile.job_hub.metrics.saved_hint', {
                      defaultValue: 'Aktivní dialogy v oběhu'
                    })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3 space-y-4">
          <div className="rounded-[1.05rem] border border-slate-200/80 bg-white/92 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.24)] dark:border-slate-700 dark:bg-slate-900/92">
            <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-[var(--accent-soft)] p-2">
                    <Mail className="h-5 w-5 text-[var(--accent)]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      {t('profile.job_hub.applications_title', { defaultValue: 'Otevřené dialogy' })}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {t('profile.job_hub.applications_desc', {
                        defaultValue: 'Sledujte stav dialogu, otevřete detail a vraťte se k firmě i k původní roli.'
                      })}
                    </p>
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <Clock3 className="h-3.5 w-3.5" />
                      {filteredDialogues.length} {t('profile.job_hub.items', { defaultValue: 'položek' })}
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-5">
                <label htmlFor="application-search" className="sr-only">
                  {t('profile.job_hub.search_placeholder', { defaultValue: 'Hledat v dialozích' })}
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="application-search"
                    type="text"
                  value={dialogueSearch}
                    onChange={(event) => setDialogueSearch(event.target.value)}
                    placeholder={t('profile.job_hub.search_placeholder', { defaultValue: 'Hledat v dialozích' })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-[rgba(var(--accent-rgb),0.45)] focus:ring-2 focus:ring-[rgba(var(--accent-rgb),0.16)] dark:border-slate-700 dark:bg-slate-950/40 dark:text-white dark:focus:border-[rgba(var(--accent-rgb),0.45)] dark:focus:ring-[rgba(var(--accent-rgb),0.16)]"
                  />
                </div>
              </div>

              {loadingDialogues ? (
                <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('profile.job_hub.loading', { defaultValue: 'Načítám vaše dialogy…' })}
                </div>
              ) : dialoguesError ? (
                <div className="rounded-[0.95rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
                  {dialoguesError}
                </div>
              ) : filteredDialogues.length === 0 ? (
                <div className="rounded-[1rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-950/40">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm dark:bg-slate-900">
                      <Briefcase className="h-6 w-6 text-slate-400" />
                    </div>
                  <h4 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
                    {dialogueSearch
                      ? t('profile.job_hub.empty_search_title', { defaultValue: 'Nic neodpovídá hledání' })
                      : t('profile.job_hub.empty_title', { defaultValue: 'Zatím tu nejsou žádné dialogy' })}
                  </h4>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {dialogueSearch
                      ? t('profile.job_hub.empty_search_desc', { defaultValue: 'Zkuste jiný název pozice, firmu nebo lokalitu.' })
                      : t('profile.job_hub.empty_desc', { defaultValue: 'Jakmile otevřete první dialog, objeví se zde přehled celé interakce.' })}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredDialogues.map((dialogue) => {
                    const isActive = activeDetailId === dialogue.id;
                    const canWithdraw = !LOCKED_WITHDRAW_STATUSES.includes(dialogue.status);
                    return (
                      <div
                        key={dialogue.id}
                        className={`rounded-[1rem] border p-5 transition-colors ${
                          isActive
                            ? 'border-[rgba(var(--accent-rgb),0.28)] bg-[var(--accent-soft)]'
                            : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/70'
                        }`}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="truncate text-lg font-semibold text-slate-900 dark:text-white">
                                {dialogue.job_snapshot?.title ||
                                  t('profile.job_hub.unknown_position', { defaultValue: 'Neznámá pozice' })}
                              </h4>
                              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClassName(dialogue.status)}`}>
                                {getStatusLabel(dialogue.status)}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                              {[dialogue.company_name || dialogue.job_snapshot?.company, dialogue.job_snapshot?.location]
                                .filter(Boolean)
                                .join(' • ') || t('profile.job_hub.not_available', { defaultValue: 'Neuvedeno' })}
                            </p>
                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                              {t('profile.job_hub.submitted_label', { defaultValue: 'Odesláno' })}: {formatTimestamp(dialogue.submitted_at)}
                            </p>
                            {renderDialogueSignals(dialogue)}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => onJobSelect(String(dialogue.job_id))}
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              <Eye className="h-4 w-4" />
                              {t('profile.job_hub.open_job', { defaultValue: 'Otevřít v aplikaci' })}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDialogueDetail(dialogue.id)}
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              <Eye className="h-4 w-4" />
                              {t('profile.job_hub.review_sent', { defaultValue: 'Otevřít dialog' })}
                            </button>
                            {dialogue.job_snapshot?.contact_email && (
                              <button
                                type="button"
                                onClick={() => openMail(dialogue.job_snapshot?.contact_email, dialogue.job_snapshot?.title || null)}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                <Mail className="h-4 w-4" />
                                {t('profile.job_hub.contact_company', { defaultValue: 'Napsat firmě' })}
                              </button>
                            )}
                            {dialogue.job_snapshot?.url && (
                              <button
                                type="button"
                                onClick={() => openUrl(dialogue.job_snapshot?.url)}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                <ExternalLink className="h-4 w-4" />
                                {t('profile.job_hub.original_listing', { defaultValue: 'Původní inzerát' })}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleWithdrawDialogue(dialogue)}
                              disabled={!canWithdraw || withdrawingId === dialogue.id}
                              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300 dark:hover:bg-rose-950/30"
                            >
                              {withdrawingId === dialogue.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                              {t('profile.job_hub.withdraw', { defaultValue: 'Uzavřít dialog' })}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {renderDialogueDetail()}
        </div>

        <div className="xl:col-span-2 space-y-4">
          <div className="rounded-[1.05rem] border border-slate-200/80 bg-white/92 p-5 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.24)] dark:border-slate-700 dark:bg-slate-900/92">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {t('profile.job_hub.assessments_title', { defaultValue: 'Pozvánky na assessmenty' })}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {t('profile.job_hub.assessments_desc', {
                    defaultValue: 'Všechny otevřené i dokončené testovací pozvánky na jednom místě.'
                  })}
                </p>
              </div>
            </div>
            <MyInvitations />
          </div>
        </div>
      </div>

      <div className="overflow-visible rounded-[1.15rem] border border-slate-200/80 bg-white/94 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.26)] dark:border-slate-700 dark:bg-slate-900/94">
        <SavedJobsPage
          savedJobs={savedJobs}
          savedJobIds={savedJobIds}
          onToggleSave={onToggleSave}
          onJobSelect={onJobSelect}
          onApplyToJob={onApplyToJob}
          selectedJobId={selectedJobId}
          userProfile={userProfile}
          searchTerm={searchTerm}
          onSearchChange={onSearchChange}
        />
      </div>
    </div>
  );
};

export default ProfileJobManager;
