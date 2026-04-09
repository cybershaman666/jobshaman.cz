import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, BrainCircuit, Clock3, RefreshCw, ShieldCheck, Sparkles, Target, X } from 'lucide-react';

import {
  buildCompanyHandshakeDecisionView,
  getCompanyDialogueAlias,
  type CompanyHandshakeEvidenceBlock,
  type CompanyHandshakeScoreCard,
} from '../../../../services/companyHandshakeDossierService';

interface ApplicationsTabProps {
  dialoguesData: any;
}

const formatDate = (value: unknown) => {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' });
};

const statusTone: Record<string, string> = {
  new: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-900/20 dark:text-blue-300',
  pending: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-300',
  reviewed: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-900/20 dark:text-violet-300',
  shortlisted: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300',
  invited: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300',
  rejected: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300',
};

const formatStatus = (status: unknown) => {
  const value = String(status || 'pending').trim();
  if (!value) return 'Pending';
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
};

export const ApplicationsTab: React.FC<ApplicationsTabProps> = ({ dialoguesData }) => {
  const { t } = useTranslation();
  const dialogues = dialoguesData?.dialogues || [];
  const loading = dialoguesData?.dialoguesLoading;
  const refreshDialogues = dialoguesData?.refreshDialogues || (() => {});
  const selectedDialogue = dialoguesData?.selectedDialogueDetail;
  const openDialogueDetail = dialoguesData?.openDialogueDetail || (() => {});
  const closeDialogueDetail = dialoguesData?.closeDialogueDetail || (() => {});

  const pendingCount = dialogues.filter((dialogue: any) => ['pending', 'reviewed'].includes(String(dialogue?.status || ''))).length;
  const shortlistCount = dialogues.filter((dialogue: any) => ['shortlisted', 'invited'].includes(String(dialogue?.status || ''))).length;
  const activeCount = dialogues.filter((dialogue: any) => !['rejected', 'closed', 'closed_rejected', 'closed_withdrawn', 'withdrawn'].includes(String(dialogue?.status || ''))).length;
  const selectedView = selectedDialogue ? buildCompanyHandshakeDecisionView(selectedDialogue) : null;

  if (loading && dialogues.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw size={24} className="animate-spin text-slate-400" />
        <span className="ml-3 text-sm text-slate-500 dark:text-slate-400">
          {t('company.applications.loading', { defaultValue: 'Loading applications...' })}
        </span>
      </div>
    );
  }

  if (dialogues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <BrainCircuit size={48} className="mb-4 text-slate-300 dark:text-slate-600" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          {t('company.applications.empty_title', { defaultValue: 'No applications yet' })}
        </h3>
        <p className="mt-1 max-w-xl text-sm text-slate-500 dark:text-slate-400">
          {t('company.applications.empty_desc', { defaultValue: 'Applications will appear here when candidates respond to your jobs' })}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              <Sparkles size={14} className="text-[var(--accent)]" />
              {t('company.applications.hero_badge', { defaultValue: 'Decision-first application review' })}
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                {t('company.applications.title', { defaultValue: 'Applications' })}
                <span className="ml-2 text-base font-normal text-slate-400">({dialogues.length})</span>
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
                {t('company.applications.hero_copy', {
                  defaultValue: 'Review anonymous practical signal first, compare applicants on the same logic, and move the strongest people forward before the process cools down.'
                })}
              </p>
            </div>
          </div>

          <button
            onClick={() => refreshDialogues({ silent: true })}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RefreshCw size={14} />
            {t('company.applications.refresh', { defaultValue: 'Refresh' })}
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            {
              label: t('company.applications.metric_active', { defaultValue: 'Active dossiers' }),
              value: activeCount,
              sublabel: t('company.applications.metric_active_sub', { defaultValue: 'People still moving in the process' }),
              icon: BrainCircuit,
            },
            {
              label: t('company.applications.metric_validate', { defaultValue: 'Waiting for validation' }),
              value: pendingCount,
              sublabel: t('company.applications.metric_validate_sub', { defaultValue: 'Signals worth opening and pressure-testing' }),
              icon: ShieldCheck,
            },
            {
              label: t('company.applications.metric_shortlist', { defaultValue: 'Shortlist ready' }),
              value: shortlistCount,
              sublabel: t('company.applications.metric_shortlist_sub', { defaultValue: 'Candidates already strong enough for the next move' }),
              icon: Target,
            },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 p-4">
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
                <item.icon size={18} />
              </div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{item.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{item.value}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.sublabel}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              {t('company.applications.list_title', { defaultValue: 'Anonymous dossiers' })}
            </h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {dialogues.map((dialogue: any) => {
              const selected = String(selectedDialogue?.id || '') === String(dialogue.id || dialogue.dialogue_id || '');
              const alias = getCompanyDialogueAlias(dialogue);
              return (
                <button
                  key={dialogue.id || dialogue.dialogue_id}
                  type="button"
                  className={`w-full px-5 py-4 text-left transition-colors ${selected ? 'bg-[var(--accent)]/5' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
                  onClick={() => openDialogueDetail(dialogue.id || dialogue.dialogue_id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{alias}</div>
                      <div className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {dialogue.job_title || dialogue.role || t('company.applications.role_fallback', { defaultValue: 'Untitled role' })}
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                        {String(dialogue.status) === 'shortlisted'
                          ? t('company.applications.row_shortlisted', { defaultValue: 'Already strong enough for a human next step. Open the dossier and decide how fast to move.' })
                          : t('company.applications.row_pending', { defaultValue: 'Open the dossier and check whether the first move already shows judgment, priorities, and practical transfer.' })}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone[String(dialogue.status)] || statusTone.pending}`}>
                        {formatStatus(dialogue.status)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                        <Clock3 size={12} />
                        {formatDate(dialogue.submitted_at || dialogue.created_at)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          {selectedDialogue && selectedView ? (
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--accent)]">
                    {selectedView.spotlight.kicker}
                  </div>
                  <h3 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                    {selectedView.spotlight.title}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-400">
                    {selectedView.spotlight.summary}
                  </p>
                </div>
                <button
                  onClick={() => closeDialogueDetail()}
                  className="rounded-full border border-slate-200 p-2 text-slate-400 transition-colors hover:text-slate-700 dark:border-slate-700 dark:hover:text-slate-200"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-cyan-100 bg-cyan-50/80 px-4 py-4 dark:border-cyan-900/50 dark:bg-cyan-950/20">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-300">
                    {t('company.applications.detail_candidate_move', { defaultValue: 'Candidate move' })}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{selectedView.spotlight.candidateMove}</div>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                    {t('company.applications.detail_business_impact', { defaultValue: 'Business impact' })}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{selectedView.spotlight.businessImpact}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    {t('company.applications.detail_next_step', { defaultValue: 'Recommended next step' })}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{selectedView.spotlight.nextStep}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    {t('company.applications.detail_benchmark', { defaultValue: 'Benchmark read' })}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{selectedView.spotlight.benchmarkLabel}</div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {selectedView.scoreCards.map((card: CompanyHandshakeScoreCard) => (
                  <div key={card.key} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-950">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{card.label}</div>
                    <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{card.score}/100</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {card.verdict} · baseline {card.benchmark}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 px-4 py-4 dark:border-slate-800">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    {t('company.applications.detail_evidence', { defaultValue: 'Evidence the recruiter can already use' })}
                  </div>
                  <div className="mt-3 space-y-3">
                    {selectedView.evidenceBlocks.slice(0, 3).map((block: CompanyHandshakeEvidenceBlock) => (
                      <div key={block.title} className="rounded-xl bg-slate-50 px-3 py-3 dark:bg-slate-950">
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{block.title}</div>
                        <div className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{block.body}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 px-4 py-4 dark:border-slate-800">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    {t('company.applications.detail_follow_up', { defaultValue: 'What to validate next' })}
                  </div>
                  <div className="mt-3 space-y-3">
                    {(selectedView.followUpQuestions.length ? selectedView.followUpQuestions : selectedView.validationFocus).slice(0, 4).map((question: string) => (
                      <div key={question} className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-600 dark:bg-slate-950 dark:text-slate-400">
                        <ArrowRight size={14} className="mt-1 shrink-0 text-[var(--accent)]" />
                        <span>{question}</span>
                      </div>
                    ))}
                    {!selectedView.followUpQuestions.length && !selectedView.validationFocus.length && (
                      <div className="rounded-xl bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-600 dark:bg-slate-950 dark:text-slate-400">
                        {t('company.applications.detail_follow_up_empty', { defaultValue: 'Open a short human follow-up and verify ownership, judgment, and transfer into your team reality.' })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center px-8 py-12 text-center">
              <Sparkles size={36} className="text-slate-300 dark:text-slate-600" />
              <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
                {t('company.applications.detail_empty_title', { defaultValue: 'Open one dossier on the right' })}
              </h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                {t('company.applications.detail_empty_desc', { defaultValue: 'This view should help the team decide, not just read profiles. Pick any application and you will see the practical signal, benchmark, and next step in one place.' })}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
