import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Briefcase, Clock3, ExternalLink, Eye, Loader2, Mail, Search, Trash2 } from 'lucide-react';

import { CandidateApplicationDetail, CandidateApplicationSummary, Job, UserProfile } from '../types';
import {
  fetchCandidateApplicationDetail,
  fetchCandidateApplicationMessages,
  fetchCandidateApplications,
  sendCandidateApplicationMessage,
  withdrawCandidateApplication
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

type CandidateApplicationStatus = CandidateApplicationSummary['status'];

const ACTIVE_STATUSES: CandidateApplicationStatus[] = ['pending', 'reviewed', 'shortlisted'];
const LOCKED_WITHDRAW_STATUSES: CandidateApplicationStatus[] = ['rejected', 'hired', 'withdrawn'];

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
  const [applications, setApplications] = useState<CandidateApplicationSummary[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [applicationsError, setApplicationsError] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [activeDetailId, setActiveDetailId] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<CandidateApplicationDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [applicationSearch, setApplicationSearch] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadApplications = async () => {
      if (!userProfile.id) {
        if (!cancelled) {
          setApplications([]);
          setApplicationsError(null);
        }
        return;
      }

      setLoadingApplications(true);
      setApplicationsError(null);

      try {
        const rows = await fetchCandidateApplications(80);
        if (!cancelled) {
          setApplications(rows);
          if (rows.length > 0 && !activeDetailId) {
            setActiveDetailId(rows[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to load candidate applications:', error);
        if (!cancelled) {
          setApplications([]);
          setApplicationsError(
            t('profile.job_hub.load_failed', {
              defaultValue: 'Nepodařilo se načíst přehled odpovědí.'
            })
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingApplications(false);
        }
      }
    };

    loadApplications();

    return () => {
      cancelled = true;
    };
  }, [t, userProfile.id]);

  useEffect(() => {
    if (applications.length === 0) {
      if (activeDetailId) {
        setActiveDetailId(null);
      }
      return;
    }
    if (!activeDetailId || !applications.some((item) => item.id === activeDetailId)) {
      setActiveDetailId(applications[0].id);
    }
  }, [activeDetailId, applications]);

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
        const detail = await fetchCandidateApplicationDetail(activeDetailId);
        if (!detail) {
          throw new Error('Application detail unavailable');
        }
        if (!cancelled) {
          setActiveDetail(detail);
          setApplications((current) =>
            current.map((item) => (item.id === detail.id ? { ...item, ...detail } : item))
          );
        }
      } catch (error) {
        console.error('Failed to load application detail:', error);
        if (!cancelled) {
          setActiveDetail(null);
          setDetailError(
            t('profile.job_hub.detail_failed', {
              defaultValue: 'Nepodařilo se načíst detail odeslané přihlášky.'
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

  const filteredApplications = (() => {
    const query = applicationSearch.trim().toLowerCase();
    if (!query) return applications;
    return applications.filter((application) => {
      const haystack = [
        application.job_snapshot?.title,
        application.job_snapshot?.company,
        application.company_name,
        application.job_snapshot?.location,
        application.source
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  })();

  const activeCount = applications.filter((item) => ACTIVE_STATUSES.includes(item.status)).length;

  const handleOpenApplicationDetail = (applicationId: string) => {
    setActiveDetailId(applicationId);
  };

  const handleWithdrawApplication = async (application: CandidateApplicationSummary) => {
    if (!application?.id || LOCKED_WITHDRAW_STATUSES.includes(application.status)) return;

    const confirmed = window.confirm(
      t('profile.job_hub.withdraw_confirm', {
        defaultValue: 'Opravdu chcete stáhnout tuto reakci na nabídku?'
      })
    );
    if (!confirmed) return;

    setWithdrawingId(application.id);
    try {
      const result = await withdrawCandidateApplication(application.id);
      if (!result.ok) {
        throw new Error('Withdraw failed');
      }

      const updatedAt = new Date().toISOString();
      setApplications((current) =>
        current.map((item) =>
          item.id === application.id
            ? { ...item, status: 'withdrawn', updated_at: updatedAt }
            : item
        )
      );
      setActiveDetail((current) =>
        current && current.id === application.id
          ? { ...current, status: 'withdrawn', updated_at: updatedAt }
          : current
      );
    } catch (error) {
      console.error('Failed to withdraw application:', error);
      window.alert(
        t('profile.job_hub.withdraw_failed', {
          defaultValue: 'Reakci se nepodařilo stáhnout.'
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

  const getStatusLabel = (status: CandidateApplicationStatus): string => {
    switch (status) {
      case 'reviewed':
        return t('profile.job_hub.status_reviewed', { defaultValue: 'Prohlédnuto' });
      case 'shortlisted':
        return t('profile.job_hub.status_shortlisted', { defaultValue: 'Ve výběru' });
      case 'rejected':
        return t('profile.job_hub.status_rejected', { defaultValue: 'Uzavřeno' });
      case 'hired':
        return t('profile.job_hub.status_hired', { defaultValue: 'Přijato' });
      case 'withdrawn':
        return t('profile.job_hub.status_withdrawn', { defaultValue: 'Staženo' });
      default:
        return t('profile.job_hub.status_pending', { defaultValue: 'Odesláno' });
    }
  };

  const getStatusClassName = (status: CandidateApplicationStatus): string => {
    switch (status) {
      case 'reviewed':
        return 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300';
      case 'shortlisted':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      case 'rejected':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300';
      case 'hired':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'withdrawn':
        return 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const renderApplicationSignals = (application: CandidateApplicationSummary) => (
    <div className="mt-3 flex flex-wrap gap-2">
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {application.has_cover_letter
          ? t('profile.job_hub.cover_letter_yes', { defaultValue: 'Motivační dopis odeslán' })
          : t('profile.job_hub.cover_letter_no', { defaultValue: 'Bez motivačního dopisu' })}
      </span>
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {application.has_cv
          ? t('profile.job_hub.cv_yes', { defaultValue: 'CV přiloženo' })
          : t('profile.job_hub.cv_no', { defaultValue: 'Bez CV' })}
      </span>
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {application.has_jcfpm
          ? t('profile.job_hub.jcfpm_yes', { defaultValue: 'JCFPM sdíleno' })
          : t('profile.job_hub.jcfpm_no', { defaultValue: 'JCFPM nesdíleno' })}
      </span>
    </div>
  );

  const renderApplicationDetail = () => {
    if (loadingDetail) {
      return (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('profile.job_hub.detail_loading', { defaultValue: 'Načítám detail odeslané přihlášky…' })}
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

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:border-cyan-900/40 dark:bg-cyan-950/30 dark:text-cyan-300">
              <Eye className="h-3.5 w-3.5" />
              {t('profile.job_hub.detail_badge', { defaultValue: 'Detail odeslané přihlášky' })}
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

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              {t('profile.job_hub.meta.sent', { defaultValue: 'Odesláno' })}
            </div>
            <div className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
              {formatTimestamp(activeDetail.submitted_at)}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              {t('profile.job_hub.meta.updated', { defaultValue: 'Poslední změna' })}
            </div>
            <div className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
              {formatTimestamp(activeDetail.updated_at)}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              {t('profile.job_hub.meta.status', { defaultValue: 'Stav' })}
            </div>
            <div className="mt-2">
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClassName(activeDetail.status)}`}>
                {getStatusLabel(activeDetail.status)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/80">
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
                <span>{t('profile.job_hub.cv', { defaultValue: 'Životopis' })}</span>
                <span className="font-semibold text-right">
                  {activeDetail.cv_snapshot?.originalName ||
                    activeDetail.cv_snapshot?.label ||
                    (activeDetail.has_cv
                      ? t('profile.job_hub.cv_attached', { defaultValue: 'Přiloženo' })
                      : t('profile.job_hub.cv_missing', { defaultValue: 'Nepřiloženo' }))}
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

          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/80">
            <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              {t('profile.job_hub.profile_snapshot', { defaultValue: 'Profil odeslaný s přihláškou' })}
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
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950/40">
            <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              {t('profile.job_hub.cover_letter_title', { defaultValue: 'Odeslaný motivační dopis' })}
            </h4>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-300">
              {activeDetail.cover_letter}
            </p>
          </div>
        )}

        {activeDetail.has_jcfpm && (
          <div className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50/80 p-5 dark:border-cyan-900/40 dark:bg-cyan-950/10">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">
                  {t('profile.job_hub.jcfpm_shared_signal', { defaultValue: 'Sdílený JCFPM hiring signal' })}
                </h4>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {sharedPayload?.archetype?.title ||
                    t('profile.job_hub.jcfpm_signal_desc', {
                      defaultValue: 'Firma dostala pouze zkrácený hiring profil pro porovnání s ostatními uchazeči.'
                    })}
                </p>
              </div>
              <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300">
                {t('profile.job_hub.jcfpm_summary_only', { defaultValue: 'Pouze summary' })}
              </span>
            </div>

            {comparisonSignals.length > 0 && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {comparisonSignals.slice(0, 4).map((signal: any) => {
                  const score = Number(signal?.score || 0);
                  const clamped = Math.max(0, Math.min(100, score));
                  return (
                    <div key={String(signal?.key || signal?.label)} className="rounded-xl border border-cyan-100 bg-white/90 p-4 dark:border-cyan-900/30 dark:bg-slate-900/70">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {signal?.label || signal?.key}
                        </span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">{clamped}</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-800">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-sky-500"
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
            applicationId={activeDetail.id}
            storageOwnerId={userProfile.id || null}
            viewerRole="candidate"
            heading={t('profile.job_hub.messages_title', { defaultValue: 'Komunikace s firmou' })}
            subtitle={t('profile.job_hub.messages_desc', {
              defaultValue: 'Asynchronní interní vlákno pro doplnění podkladů, dokumentů a další komunikaci k této přihlášce.'
            })}
            emptyText={t('profile.job_hub.messages_empty', {
              defaultValue: 'Zatím tu nejsou žádné zprávy. Pokud firma něco doplní nebo budete chtít poslat dokument, objeví se to zde.'
            })}
            fetchMessages={fetchCandidateApplicationMessages}
            sendMessage={sendCandidateApplicationMessage}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-cyan-50 via-white to-slate-100 p-6 shadow-lg dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:border-cyan-900/50 dark:bg-cyan-950/30 dark:text-cyan-300">
              <Briefcase className="h-3.5 w-3.5" />
              {t('profile.job_hub.badge', { defaultValue: 'Job Inbox' })}
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">
              {t('profile.job_hub.title', { defaultValue: 'Správa nabídek a odpovědí' })}
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
              {t('profile.job_hub.desc', {
                defaultValue: 'Na jednom místě vidíte odeslané reakce, co přesně bylo sdíleno, a můžete se vracet k interakci s firmami.'
              })}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70">
              <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('profile.job_hub.metrics.applied', { defaultValue: 'Odpovědi' })}
              </div>
              <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{applications.length}</div>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70">
              <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('profile.job_hub.metrics.active', { defaultValue: 'Aktivní' })}
              </div>
              <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{activeCount}</div>
            </div>
            <div className="col-span-2 rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70 sm:col-span-1">
              <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('profile.job_hub.metrics.saved', { defaultValue: 'Uloženo' })}
              </div>
              <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{savedJobs.length}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-cyan-100 p-2 dark:bg-cyan-900/30">
                    <Mail className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      {t('profile.job_hub.applications_title', { defaultValue: 'Odeslané odpovědi' })}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {t('profile.job_hub.applications_desc', {
                        defaultValue: 'Sledujte stav, otevřete detail a vraťte se k firmě i k původnímu inzerátu.'
                      })}
                    </p>
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <Clock3 className="h-3.5 w-3.5" />
                  {filteredApplications.length} {t('profile.job_hub.items', { defaultValue: 'položek' })}
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-5">
                <label htmlFor="application-search" className="sr-only">
                  {t('profile.job_hub.search_placeholder', { defaultValue: 'Hledat v odpovědích' })}
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="application-search"
                    type="text"
                    value={applicationSearch}
                    onChange={(event) => setApplicationSearch(event.target.value)}
                    placeholder={t('profile.job_hub.search_placeholder', { defaultValue: 'Hledat v odpovědích' })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white dark:focus:border-cyan-700 dark:focus:ring-cyan-900/40"
                  />
                </div>
              </div>

              {loadingApplications ? (
                <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('profile.job_hub.loading', { defaultValue: 'Načítám vaše odpovědi…' })}
                </div>
              ) : applicationsError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
                  {applicationsError}
                </div>
              ) : filteredApplications.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-950/40">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm dark:bg-slate-900">
                      <Briefcase className="h-6 w-6 text-slate-400" />
                    </div>
                  <h4 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
                    {applicationSearch
                      ? t('profile.job_hub.empty_search_title', { defaultValue: 'Nic neodpovídá hledání' })
                      : t('profile.job_hub.empty_title', { defaultValue: 'Zatím tu nejsou žádné odpovědi' })}
                  </h4>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {applicationSearch
                      ? t('profile.job_hub.empty_search_desc', { defaultValue: 'Zkuste jiný název pozice, firmu nebo lokalitu.' })
                      : t('profile.job_hub.empty_desc', { defaultValue: 'Jakmile odpovíte na nabídku, objeví se zde přehled celé interakce.' })}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredApplications.map((application) => {
                    const isActive = activeDetailId === application.id;
                    const canWithdraw = !LOCKED_WITHDRAW_STATUSES.includes(application.status);
                    return (
                      <div
                        key={application.id}
                        className={`rounded-2xl border p-5 transition-colors ${
                          isActive
                            ? 'border-cyan-300 bg-cyan-50/60 dark:border-cyan-700 dark:bg-cyan-950/10'
                            : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/70'
                        }`}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="truncate text-lg font-semibold text-slate-900 dark:text-white">
                                {application.job_snapshot?.title ||
                                  t('profile.job_hub.unknown_position', { defaultValue: 'Neznámá pozice' })}
                              </h4>
                              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClassName(application.status)}`}>
                                {getStatusLabel(application.status)}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                              {[application.company_name || application.job_snapshot?.company, application.job_snapshot?.location]
                                .filter(Boolean)
                                .join(' • ') || t('profile.job_hub.not_available', { defaultValue: 'Neuvedeno' })}
                            </p>
                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                              {t('profile.job_hub.submitted_label', { defaultValue: 'Odesláno' })}: {formatTimestamp(application.submitted_at)}
                            </p>
                            {renderApplicationSignals(application)}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => onJobSelect(String(application.job_id))}
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              <Eye className="h-4 w-4" />
                              {t('profile.job_hub.open_job', { defaultValue: 'Otevřít v aplikaci' })}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenApplicationDetail(application.id)}
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              <Eye className="h-4 w-4" />
                              {t('profile.job_hub.review_sent', { defaultValue: 'Zkontrolovat odeslané' })}
                            </button>
                            {application.job_snapshot?.contact_email && (
                              <button
                                type="button"
                                onClick={() => openMail(application.job_snapshot?.contact_email, application.job_snapshot?.title || null)}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                <Mail className="h-4 w-4" />
                                {t('profile.job_hub.contact_company', { defaultValue: 'Napsat firmě' })}
                              </button>
                            )}
                            {application.job_snapshot?.url && (
                              <button
                                type="button"
                                onClick={() => openUrl(application.job_snapshot?.url)}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                <ExternalLink className="h-4 w-4" />
                                {t('profile.job_hub.original_listing', { defaultValue: 'Původní inzerát' })}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleWithdrawApplication(application)}
                              disabled={!canWithdraw || withdrawingId === application.id}
                              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300 dark:hover:bg-rose-950/30"
                            >
                              {withdrawingId === application.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                              {t('profile.job_hub.withdraw', { defaultValue: 'Stáhnout reakci' })}
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

          {renderApplicationDetail()}
        </div>

        <div className="xl:col-span-2 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-700 dark:bg-slate-900">
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

      <div className="overflow-visible rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_60px_-34px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-slate-900">
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
