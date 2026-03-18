import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CheckCircle2, Clock3, FileText, MessageSquare, Shield, Sparkles } from 'lucide-react';

import ApplicationMessageCenter from '../components/ApplicationMessageCenter';
import { trackAnalyticsEvent } from '../services/supabaseService';
import { type DialogueMessage } from '../types';
import { type DialogueMessageCreatePayload } from '../services/jobApplicationService';
import {
  type DemoHandshakeAnswers,
  type DemoHandshakeStep,
  MIN_DEMO_HANDSHAKE_ANSWER_LENGTH,
  getAnswerLengths,
  hasRequiredAnswers,
  isStepTransitionAllowed,
} from '../services/demoHandshakeFlow';
import { SolarpunkProgressFlow } from '../components/ui/primitives';

interface DemoHandshakePageProps {
  onRegister?: () => void;
  onBrowseRoles?: () => void;
}

const getElapsedBucket = (durationMs: number): string => {
  if (durationMs < 60_000) return 'under_1m';
  if (durationMs < 120_000) return '1_2m';
  if (durationMs < 300_000) return '2_5m';
  return 'over_5m';
};

const createDemoThreadId = (): string => `THR-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

const createMessageId = (): string => `dm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createDeadlineAt = (hours: number): string => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

const DemoHandshakePage: React.FC<DemoHandshakePageProps> = ({ onRegister, onBrowseRoles }) => {
  const { t, i18n } = useTranslation();
  const locale = (i18n.language || 'en').split('-')[0].toLowerCase();
  const seededAnswers = useMemo<DemoHandshakeAnswers>(() => ({
    scenarioOne: t('demo_handshake.prefilled_answer_one'),
    scenarioTwo: t('demo_handshake.prefilled_answer_two'),
  }), [t]);
  const [step, setStep] = useState<DemoHandshakeStep>('company_truth');
  const [answers, setAnswers] = useState<DemoHandshakeAnswers>(seededAnswers);
  const [includeDocuments, setIncludeDocuments] = useState(true);
  const [includeJcfpm, setIncludeJcfpm] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showFirstCompanyMessage, setShowFirstCompanyMessage] = useState(false);
  const [candidateFollowupSent, setCandidateFollowupSent] = useState(false);
  const [showCompanyFollowup, setShowCompanyFollowup] = useState(false);
  const [threadMessages, setThreadMessages] = useState<DialogueMessage[]>([]);
  const [threadStatus, setThreadStatus] = useState<'pending' | 'reviewed' | 'shortlisted'>('pending');
  const [threadCurrentTurn, setThreadCurrentTurn] = useState<'candidate' | 'company'>('company');
  const [threadDeadlineAt, setThreadDeadlineAt] = useState<string | null>(createDeadlineAt(48));
  const startedAtRef = useRef<number>(Date.now());
  const completedTrackedRef = useRef<boolean>(false);
  const threadIdRef = useRef<string>(createDemoThreadId());
  const firstCompanyTimerRef = useRef<number | null>(null);
  const companyFollowupTimerRef = useRef<number | null>(null);

  const clearActiveTimers = useCallback(() => {
    if (firstCompanyTimerRef.current) {
      window.clearTimeout(firstCompanyTimerRef.current);
      firstCompanyTimerRef.current = null;
    }
    if (companyFollowupTimerRef.current) {
      window.clearTimeout(companyFollowupTimerRef.current);
      companyFollowupTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearActiveTimers();
    };
  }, [clearActiveTimers]);

  const createMessage = useCallback(
    (
      senderRole: 'candidate' | 'recruiter',
      body: string,
      attachments: DialogueMessage['attachments'] = [],
    ): DialogueMessage => {
      const createdAt = new Date().toISOString();
      return {
        id: createMessageId(),
        application_id: threadIdRef.current,
        company_id: null,
        candidate_id: null,
        sender_user_id: null,
        sender_role: senderRole,
        body,
        attachments,
        created_at: createdAt,
        read_by_candidate_at: senderRole === 'recruiter' ? createdAt : null,
        read_by_company_at: senderRole === 'candidate' ? createdAt : null,
      };
    },
    [],
  );

  const stepIndex = useMemo(() => {
    const order: DemoHandshakeStep[] = ['company_truth', 'candidate_reply', 'first_company_reply', 'completed'];
    return order.indexOf(step) + 1;
  }, [step]);

  const safeTrack = useCallback((eventType: string, metadata: Record<string, unknown> = {}) => {
    void trackAnalyticsEvent({
      event_type: eventType,
      feature: 'demo_handshake',
      metadata: {
        locale,
        ...metadata,
      },
    }).catch(() => undefined);
  }, [locale]);

  useEffect(() => {
    safeTrack('demo_handshake_opened', {
      path: typeof window !== 'undefined' ? window.location.pathname : '/demo-handshake',
    });
  }, [safeTrack]);

  useEffect(() => {
    setAnswers(seededAnswers);
  }, [seededAnswers]);

  useEffect(() => {
    if (step !== 'completed' || completedTrackedRef.current) return;
    completedTrackedRef.current = true;
    safeTrack('demo_handshake_completed', {
      elapsed_bucket: getElapsedBucket(Date.now() - startedAtRef.current),
    });
  }, [safeTrack, step]);

  useEffect(() => {
    if (step !== 'first_company_reply') return;

    clearActiveTimers();
    setShowFirstCompanyMessage(false);
    setCandidateFollowupSent(false);
    setShowCompanyFollowup(false);
    setThreadMessages([]);
    setThreadStatus('pending');
    setThreadCurrentTurn('company');
    setThreadDeadlineAt(createDeadlineAt(48));

    firstCompanyTimerRef.current = window.setTimeout(() => {
      setThreadMessages([
        createMessage('recruiter', t('demo_handshake.first_reply_company_1')),
      ]);
      setShowFirstCompanyMessage(true);
      setThreadStatus('reviewed');
      setThreadCurrentTurn('candidate');
      setThreadDeadlineAt(createDeadlineAt(24));
    }, 550);

    return () => {
      clearActiveTimers();
    };
  }, [clearActiveTimers, createMessage, step, t]);

  const openRegister = () => {
    safeTrack('demo_handshake_cta_clicked', { cta_type: 'register' });
    onRegister?.();
  };

  const openBrowseRoles = () => {
    safeTrack('demo_handshake_cta_clicked', { cta_type: 'browse_roles' });
    onBrowseRoles?.();
  };

  const handleMoveToCandidateReply = () => {
    if (!isStepTransitionAllowed('company_truth', 'candidate_reply')) return;
    setStep('candidate_reply');
  };

  const handleSubmitReplies = () => {
    if (!hasRequiredAnswers(answers, MIN_DEMO_HANDSHAKE_ANSWER_LENGTH)) {
      setValidationError(t('demo_handshake.min_chars_error', { count: MIN_DEMO_HANDSHAKE_ANSWER_LENGTH }));
      return;
    }

    if (!isStepTransitionAllowed('candidate_reply', 'first_company_reply', answers)) {
      setValidationError(t('demo_handshake.min_chars_error', { count: MIN_DEMO_HANDSHAKE_ANSWER_LENGTH }));
      return;
    }

    const lengths = getAnswerLengths(answers);
    safeTrack('demo_handshake_submitted', {
      scenario_one_length: lengths.scenarioOne,
      scenario_two_length: lengths.scenarioTwo,
      include_documents: includeDocuments,
      include_jcfpm: includeJcfpm,
      thread_id: threadIdRef.current,
    });

    setValidationError(null);
    setStep('first_company_reply');
  };

  const fetchDemoMessages = useCallback(async () => threadMessages, [threadMessages]);

  const sendDemoMessage = useCallback(async (_dialogueId: string, payload: DialogueMessageCreatePayload) => {
    const body = String(payload.body || '').trim();
    const outgoingAttachments = Array.isArray(payload.attachments) ? payload.attachments : [];
    if (!body && outgoingAttachments.length === 0) return null;

    const candidateMessage = createMessage('candidate', body, outgoingAttachments);
    setThreadMessages((current) => [...current, candidateMessage]);
    setCandidateFollowupSent(true);
    setThreadCurrentTurn('company');
    setThreadDeadlineAt(createDeadlineAt(48));

    safeTrack('demo_handshake_cta_clicked', {
      cta_type: 'candidate_followup_send',
      thread_id: threadIdRef.current,
      message_length: body.length,
    });

    if (companyFollowupTimerRef.current) {
      window.clearTimeout(companyFollowupTimerRef.current);
      companyFollowupTimerRef.current = null;
    }

    companyFollowupTimerRef.current = window.setTimeout(() => {
      setThreadMessages((current) => [
        ...current,
        createMessage('recruiter', t('demo_handshake.first_reply_company_2')),
      ]);
      setShowCompanyFollowup(true);
      setThreadStatus('shortlisted');
      setThreadCurrentTurn('candidate');
      setThreadDeadlineAt(createDeadlineAt(48));
    }, 1150);

    return candidateMessage;
  }, [createMessage, safeTrack, t]);

  const handleMoveToCompleted = () => {
    if (!showCompanyFollowup) return;
    if (!isStepTransitionAllowed('first_company_reply', 'completed')) return;
    setStep('completed');
  };

  const handleRestart = () => {
    safeTrack('demo_handshake_cta_clicked', { cta_type: 'restart_demo' });
    clearActiveTimers();
    startedAtRef.current = Date.now();
    completedTrackedRef.current = false;
    setValidationError(null);
    setAnswers(seededAnswers);
    setIncludeDocuments(true);
    setIncludeJcfpm(true);
    setShowFirstCompanyMessage(false);
    setCandidateFollowupSent(false);
    setShowCompanyFollowup(false);
    setThreadMessages([]);
    setThreadStatus('pending');
    setThreadCurrentTurn('company');
    setThreadDeadlineAt(createDeadlineAt(48));
    threadIdRef.current = createDemoThreadId();
    setStep('company_truth');
  };

  const prefilledFollowupDraft = t('demo_handshake.prefilled_followup_message', {
    defaultValue: 'Děkuji za první reakci. V prvním týdnu bych prošel předávání směn na dvou pilotních směnách, nastavil jednotný checklist a po 14 dnech sdílel měřitelné výsledky s týmem.',
  });
  const threadStatusText = showCompanyFollowup
    ? t('demo_handshake.thread_status_continue')
    : candidateFollowupSent
      ? t('demo_handshake.thread_status_waiting_company')
      : t('demo_handshake.thread_status_waiting_candidate');

  const flowProgress = [
    {
      key: 'first',
      title: t('demo_handshake.thread_plain_step_one'),
      done: showFirstCompanyMessage,
    },
    {
      key: 'second',
      title: t('demo_handshake.progress_step_candidate', {
        defaultValue: 'Kandidát odešle krátkou reakci',
      }),
      done: candidateFollowupSent,
    },
    {
      key: 'third',
      title: t('demo_handshake.thread_plain_step_two'),
      done: showCompanyFollowup,
    },
  ];

  return (
    <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar px-1">
      <section className="app-organic-shell mx-auto w-full max-w-5xl rounded-[1.4rem] border border-slate-200/80 dark:border-slate-800 bg-white/86 dark:bg-slate-900/70 p-5 lg:p-7 shadow-[0_22px_50px_-40px_rgba(15,23,42,0.38)]">
        <div className="flex flex-wrap items-center gap-2">
          <div className="app-organic-pill inline-flex items-center gap-2 rounded-full border border-cyan-300/70 dark:border-cyan-800 bg-cyan-50/80 dark:bg-cyan-900/25 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-300">
            <Sparkles size={12} />
            {t('demo_handshake.badge')}
          </div>
          <div className="app-organic-pill inline-flex items-center gap-2 rounded-full border border-slate-300/70 dark:border-slate-700 bg-white/70 dark:bg-slate-950/40 px-3 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            <Clock3 size={12} />
            {t('demo_handshake.reaction_window_value')}
          </div>
        </div>

        <h1 className="mt-4 text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          {t('demo_handshake.title')}
        </h1>
        <p className="mt-2 text-sm md:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
          {t('demo_handshake.subtitle')}
        </p>

        <div className="app-organic-panel-soft mt-6 py-4 px-4 rounded-lg bg-slate-50/40 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/50">
          <SolarpunkProgressFlow 
            steps={[
              { label: t('demo_handshake.step_company_truth'), completed: step !== 'company_truth' && stepIndex > 0 },
              { label: t('demo_handshake.step_candidate_reply'), completed: step !== 'candidate_reply' && stepIndex > 1 },
              { label: t('demo_handshake.step_first_reply'), completed: step !== 'first_company_reply' && stepIndex > 2 },
              { label: t('demo_handshake.step_complete'), completed: step === 'completed' }
            ]}
            currentStep={stepIndex}
          />
        </div>

        <div className="mt-5 hidden grid-cols-2 gap-2 md:grid md:grid-cols-4">
          {[
            ['company_truth', t('demo_handshake.step_company_truth')],
            ['candidate_reply', t('demo_handshake.step_candidate_reply')],
            ['first_company_reply', t('demo_handshake.step_first_reply')],
            ['completed', t('demo_handshake.step_complete')],
          ].map(([key, label], index) => {
            const reached = index < stepIndex;
            return (
              <div
                key={key}
                className={`rounded-lg border px-2.5 py-2 text-xs font-semibold ${
                  reached
                    ? 'border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300'
                    : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/30 text-slate-500 dark:text-slate-400'
                }`}
              >
                {label}
              </div>
            );
          })}
        </div>
      </section>

      {step === 'company_truth' && (
        <section className="app-organic-panel mx-auto mt-4 w-full max-w-5xl rounded-[1.2rem] border border-slate-200/80 dark:border-slate-800 bg-white/88 dark:bg-slate-900/66 p-5 lg:p-6">
          <div className="app-organic-panel-soft rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 p-4">
            <div className="app-organic-pill inline-flex items-center gap-2 rounded-full border border-cyan-200 dark:border-cyan-900/40 bg-cyan-50/80 dark:bg-cyan-950/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-300">
              {t('demo_handshake.demo_listing_badge')}
            </div>
            <h3 className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{t('demo_handshake.demo_listing_title')}</h3>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/85 dark:bg-slate-950/35 px-3 py-2">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{t('demo_handshake.demo_listing_company_label')}</div>
                <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{t('demo_handshake.demo_listing_company_value')}</div>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/85 dark:bg-slate-950/35 px-3 py-2">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{t('demo_handshake.demo_listing_location_label')}</div>
                <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{t('demo_handshake.demo_listing_location_value')}</div>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/85 dark:bg-slate-950/35 px-3 py-2">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{t('demo_handshake.demo_listing_mode_label')}</div>
                <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{t('demo_handshake.demo_listing_mode_value')}</div>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/85 dark:bg-slate-950/35 px-3 py-2">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{t('demo_handshake.demo_listing_salary_label')}</div>
                <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{t('demo_handshake.demo_listing_salary_value')}</div>
              </div>
            </div>

            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/85 dark:bg-slate-950/35 px-3 py-2.5">
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{t('demo_handshake.demo_listing_overview_title')}</div>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{t('demo_handshake.demo_listing_overview_body')}</p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/85 dark:bg-slate-950/35 px-3 py-2.5">
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{t('demo_handshake.demo_listing_success_title')}</div>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{t('demo_handshake.demo_listing_success_body')}</p>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/80 dark:bg-amber-950/20 px-3 py-2.5">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-300">{t('demo_handshake.demo_listing_truth_title')}</div>
              <p className="mt-1 text-sm text-amber-950 dark:text-amber-100 leading-relaxed">{t('demo_handshake.demo_listing_truth_body')}</p>
            </div>
          </div>

          <div className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            {t('demo_handshake.challenge_label')}
          </div>
          <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">{t('demo_handshake.challenge_title')}</h2>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('demo_handshake.challenge_meta')}</div>
          <p className="mt-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {t('demo_handshake.challenge_body')}
          </p>

          <div className="mt-4 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/20 p-4">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">
              <Shield size={14} />
              {t('demo_handshake.role_truth_label')}
            </div>
            <ul className="mt-2.5 space-y-2 text-sm text-slate-700 dark:text-slate-200">
              <li>{t('demo_handshake.role_truth_1')}</li>
              <li>{t('demo_handshake.role_truth_2')}</li>
              <li>{t('demo_handshake.role_truth_3')}</li>
            </ul>
          </div>

          <button
            type="button"
            onClick={handleMoveToCandidateReply}
            className="app-button-primary app-organic-cta mt-4 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold"
          >
            {t('demo_handshake.continue_to_reply')}
            <ArrowRight size={16} />
          </button>
        </section>
      )}

      {step === 'candidate_reply' && (
        <section className="app-organic-panel mx-auto mt-4 w-full max-w-5xl rounded-[1.2rem] border border-slate-200/80 dark:border-slate-800 bg-white/88 dark:bg-slate-900/66 p-5 lg:p-6">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            <MessageSquare size={14} />
            {t('demo_handshake.prompts_title')}
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t('demo_handshake.prompt_hint')}</p>
          <div className="app-organic-pill mt-2 inline-flex rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/75 dark:bg-cyan-950/25 px-2.5 py-1.5 text-xs font-medium text-cyan-700 dark:text-cyan-300">
            {t('demo_handshake.prefilled_notice')}
          </div>

          <div className="mt-4 space-y-4">
            <div className="app-organic-panel-soft rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/35 p-4">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">{t('demo_handshake.prompt_one')}</div>
              <textarea
                value={answers.scenarioOne}
                onChange={(event) => setAnswers((prev) => ({ ...prev, scenarioOne: event.target.value }))}
                className="mt-3 w-full h-28 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder={t('demo_handshake.placeholder_one')}
              />
            </div>

            <div className="app-organic-panel-soft rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/35 p-4">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">{t('demo_handshake.prompt_two')}</div>
              <textarea
                value={answers.scenarioTwo}
                onChange={(event) => setAnswers((prev) => ({ ...prev, scenarioTwo: event.target.value }))}
                className="mt-3 w-full h-28 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder={t('demo_handshake.placeholder_two')}
              />
            </div>
          </div>

          <div className="app-organic-panel-soft mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/30 p-4">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">{t('demo_handshake.supporting_context_title')}</div>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{t('demo_handshake.supporting_context_desc')}</p>

            <label className="mt-3 flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={includeDocuments}
                onChange={(event) => setIncludeDocuments(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
              />
              <span>
                <span className="font-semibold">{t('demo_handshake.include_documents_label')}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{t('demo_handshake.include_documents_help')}</span>
              </span>
            </label>

            {includeDocuments && (
              <div className="mt-2.5 grid gap-2 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/45 px-3 py-2">
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <FileText size={12} />
                    {t('demo_handshake.document_cv_label')}
                  </div>
                  <div className="mt-1 text-sm text-slate-800 dark:text-slate-100">{t('demo_handshake.document_cv_name')}</div>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/45 px-3 py-2">
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <FileText size={12} />
                    {t('demo_handshake.document_support_label')}
                  </div>
                  <div className="mt-1 text-sm text-slate-800 dark:text-slate-100">{t('demo_handshake.document_support_name')}</div>
                </div>
              </div>
            )}

            <label className="mt-3 flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={includeJcfpm}
                onChange={(event) => setIncludeJcfpm(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
              />
              <span>
                <span className="font-semibold">{t('demo_handshake.include_jcfpm_label')}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{t('demo_handshake.include_jcfpm_help')}</span>
              </span>
            </label>

            {includeJcfpm && (
              <div className="mt-2.5 rounded-lg border border-cyan-200 dark:border-cyan-900/50 bg-cyan-50/70 dark:bg-cyan-950/20 px-3 py-2.5">
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-cyan-700 dark:text-cyan-300">{t('demo_handshake.jcfpm_badge')}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{t('demo_handshake.jcfpm_share_state')}</div>
                <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">{t('demo_handshake.jcfpm_share_desc')}</div>
              </div>
            )}
          </div>

          {validationError && (
            <div className="mt-3 rounded-lg border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
              {validationError}
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmitReplies}
            className="app-button-primary app-organic-cta mt-4 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold"
          >
            {t('demo_handshake.submit_reply')}
            <ArrowRight size={16} />
          </button>
        </section>
      )}

      {step === 'first_company_reply' && (
        <section className="mx-auto mt-4 w-full max-w-5xl rounded-[1.2rem] border border-slate-200/80 dark:border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.08),_transparent_36%),linear-gradient(180deg,_rgba(255,255,255,0.9),_rgba(248,250,252,0.84))] dark:bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.12),_transparent_36%),linear-gradient(180deg,_rgba(15,23,42,0.82),_rgba(2,6,23,0.74))] p-5 lg:p-6">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            {t('demo_handshake.first_reply_badge')}
          </div>
          <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">{t('demo_handshake.first_reply_title')}</h2>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)] gap-3">
            <aside className="space-y-3">
              <div className="rounded-[1rem] border border-sky-200/80 dark:border-sky-900/40 bg-sky-50/75 dark:bg-sky-950/20 px-4 py-3.5">
                <div className="text-xs font-bold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-300">
                  {t('demo_handshake.thread_status_label')}
                </div>
                <div className="mt-1.5 text-sm md:text-base font-semibold text-slate-900 dark:text-slate-100">
                  {threadStatusText}
                </div>
                <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                  {t('demo_handshake.reaction_window_value')}
                </div>
              </div>

              <div className="rounded-[1rem] border border-slate-200/80 dark:border-slate-700 bg-white/85 dark:bg-slate-950/30 px-4 py-3.5">
                <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  {t('demo_handshake.progress_title', { defaultValue: 'Průchod dialogem' })}
                </div>
                <div className="mt-2 space-y-2">
                  {flowProgress.map((item) => (
                    <div key={item.key} className="flex items-start gap-2">
                      <CheckCircle2
                        size={15}
                        className={item.done ? 'mt-0.5 text-amber-600 dark:text-amber-300' : 'mt-0.5 text-slate-400 dark:text-slate-500'}
                      />
                      <div>
                        <div className={`text-sm ${item.done ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}`}>
                          {item.title}
                        </div>
                      <div className={`text-[11px] ${item.done ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}`}>
                          {item.done
                            ? t('demo_handshake.progress_done', { defaultValue: 'Hotovo' })
                            : t('demo_handshake.progress_pending', { defaultValue: 'Čeká' })}
                      </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1rem] border border-amber-200/70 bg-[linear-gradient(160deg,_rgba(255,251,235,0.95),_rgba(255,255,255,0.86))] px-3 py-3 shadow-[0_18px_34px_-30px_rgba(120,53,15,0.35)] dark:border-amber-900/40 dark:bg-[linear-gradient(160deg,_rgba(69,26,3,0.35),_rgba(15,23,42,0.72))]">
                <div className="text-xs font-bold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">
                  {t('demo_handshake.thread_opened_title', {
                    defaultValue: 'Demo thread je otevřený stejně jako v ostrém flow.',
                  })}
                </div>
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {t('demo_handshake.live_thread_hint', {
                    defaultValue: 'Níže vidíš stejný princip jako v reálném dialogu: zpráva firmy -> tvoje reakce -> navázání.',
                  })}
                </div>

                <div className="mt-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {t('demo_handshake.candidate_label')}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {t('demo_handshake.demo_listing_title')}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                      {t('demo_handshake.challenge_meta')}
                    </div>
                  </div>
                  <div className="inline-flex shrink-0 whitespace-nowrap items-center rounded-full bg-white/80 dark:bg-slate-900/60 px-2.5 py-1 text-xs font-semibold font-mono tracking-[0.04em] text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700">
                    {threadIdRef.current}
                  </div>
                </div>

                <div className="mt-2.5 rounded-[0.85rem] border border-white/80 dark:border-slate-800 bg-white/75 dark:bg-slate-900/45 px-2.5 py-2">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {t('demo_handshake.supporting_context_title')}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                      includeDocuments
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}>
                      {t('demo_handshake.include_documents_label')} · {includeDocuments
                        ? t('demo_handshake.progress_done', { defaultValue: 'Hotovo' })
                        : t('demo_handshake.progress_pending', { defaultValue: 'Čeká' })}
                    </span>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                      includeJcfpm
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}>
                      {t('demo_handshake.include_jcfpm_label')} · {includeJcfpm
                        ? t('demo_handshake.progress_done', { defaultValue: 'Hotovo' })
                        : t('demo_handshake.progress_pending', { defaultValue: 'Čeká' })}
                    </span>
                  </div>
                </div>
              </div>
            </aside>

            <div className="space-y-3">
              {!candidateFollowupSent && (
                <div className="rounded-[0.95rem] border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-medium text-cyan-800 dark:border-cyan-900/40 dark:bg-cyan-950/20 dark:text-cyan-300">
                  {t('demo_handshake.prefilled_followup_notice', {
                    defaultValue: 'Odpověď je předvyplněná. Stačí kliknout na Odeslat reakci.',
                  })}
                </div>
              )}

              {candidateFollowupSent && !showCompanyFollowup && (
                <div className="rounded-[0.95rem] border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-300">
                  {t('demo_handshake.company_typing')}
                </div>
              )}

              <ApplicationMessageCenter
                dialogueId={threadIdRef.current}
                applicationId={threadIdRef.current}
                viewerRole="candidate"
                visualVariant="immersive"
                dialogueStatus={threadStatus}
                dialogueDeadlineAt={threadDeadlineAt}
                dialogueTimeoutHours={48}
                dialogueCurrentTurn={threadCurrentTurn}
                dialogueClosedReason={null}
                dialogueIsOverdue={false}
                heading={t('demo_handshake.thread_component_heading')}
                subtitle={t('demo_handshake.thread_component_subtitle', {
                  defaultValue: 'Stejný asynchronní thread jako v ostrém flow aplikace.',
                })}
                emptyText={t('demo_handshake.thread_component_empty', {
                  defaultValue: 'Zatím tu nejsou zprávy. Začni krátkou reakcí kandidáta.',
                })}
                initialDraft={prefilledFollowupDraft}
                composerPlaceholder={t('demo_handshake.thread_component_placeholder', {
                  defaultValue: 'Doplň krátkou reakci nebo odešli předvyplněný návrh… (v ostrém flow můžeš přidat i přílohy)',
                })}
                sendButtonLabel={t('demo_handshake.thread_component_send', {
                  defaultValue: 'Odeslat reakci',
                })}
                allowAttachments={false}
                showAttachmentPlaceholderWhenDisabled
                fetchMessages={fetchDemoMessages}
                sendMessage={sendDemoMessage}
              />
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-sky-200 dark:border-sky-900/40 bg-sky-50/70 dark:bg-sky-950/20 p-4">
            <div className="text-sm font-bold text-slate-900 dark:text-white">{t('demo_handshake.state_rule_title')}</div>
            <p className="mt-1.5 text-sm text-slate-700 dark:text-slate-300">{t('demo_handshake.state_rule_body')}</p>
          </div>

          <button
            type="button"
            onClick={handleMoveToCompleted}
            className={`mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
              showCompanyFollowup
                ? 'bg-orange-500 text-white hover:bg-orange-400'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 cursor-not-allowed'
            }`}
          >
            {t('demo_handshake.continue_to_finish')}
            <ArrowRight size={16} />
          </button>
        </section>
      )}

      {step === 'completed' && (
        <section className="mx-auto mt-4 mb-2 w-full max-w-5xl rounded-[1.2rem] border border-amber-200 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/20 p-5 lg:p-6">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/35 text-amber-700 dark:text-amber-300">
            <CheckCircle2 size={20} />
          </div>
          <h2 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">{t('demo_handshake.completed_title')}</h2>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{t('demo_handshake.completed_body')}</p>
          <div className="mt-3 text-xs text-slate-600 dark:text-slate-300">
            {includeDocuments && includeJcfpm
              ? t('demo_handshake.completed_context_docs_jcfpm')
              : includeDocuments
                ? t('demo_handshake.completed_context_docs_only')
                : includeJcfpm
                  ? t('demo_handshake.completed_context_jcfpm_only')
                  : t('demo_handshake.completed_context_none')}
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={openRegister}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 dark:bg-white px-4 py-2.5 text-sm font-bold text-white dark:text-slate-950"
            >
              {t('demo_handshake.primary_cta')}
            </button>
            <button
              type="button"
              onClick={openBrowseRoles}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-950/35 px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-200"
            >
              {t('demo_handshake.secondary_cta')}
            </button>
            <button
              type="button"
              onClick={handleRestart}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              {t('demo_handshake.cta_try_again')}
            </button>
          </div>
        </section>
      )}
    </div>
  );
};

export default DemoHandshakePage;
