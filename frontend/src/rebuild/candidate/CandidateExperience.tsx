import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  Globe2,
  HeartHandshake,
  Loader2,
  Paperclip,
  ShieldCheck,
} from 'lucide-react';

import { patchHandshakeAnswer } from '../../services/v2HandshakeService';
import type {
  ApplicationMessageAttachment,
  CandidateDialogueCapacity,
  CVDocument,
  DialogueDetail,
  DialogueMessage,
  DialogueSummary,
  UserProfile,
} from '../../types';

import { cn } from '../cn';
import { evaluateRole } from '../intelligence';
import type { CandidateJourneySession, CandidatePreferenceProfile, Company, HandshakeBlueprint, Role } from '../models';
import { resolveCompany } from '../shellDomain';
import { getApplicationStatusCopy } from '../status';
import {
  fieldClass,
  primaryButtonClass,
  secondaryButtonClass,
  shellPageClass,
  textareaClass,
} from '../ui/shellStyles';
import { CandidateDashboardV2 } from './CandidateDashboardV2';
import {
  CandidateShellSurface,
  ProgressNodeRow,
} from './CandidateShellSurface';

const StepRail: React.FC<{
  steps: HandshakeBlueprint['steps'];
  currentStepId: string;
  onSelect: (stepId: string) => void;
}> = ({ steps, currentStepId, onSelect }) => {
  const { t } = useTranslation();
  return (
  <aside className="hidden xl:block rounded-[8px] border border-slate-200 bg-slate-50/80 p-4">
    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1f5fbf]">{t('rebuild.flow.application_flow')}</div>
    <div className="mt-5 space-y-2">
      {steps.map((step, index) => {
        const active = step.id === currentStepId;
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onSelect(step.id)}
            className={cn(
              'flex w-full items-center justify-between rounded-[8px] px-3 py-3 text-left transition',
              active ? 'bg-white text-[#1f5fbf] shadow-sm' : 'text-slate-500 hover:bg-white/70 hover:text-slate-900',
            )}
          >
            <span className="flex items-center gap-3">
              <span className={cn('inline-flex h-7 w-7 items-center justify-center rounded-[7px] text-xs font-bold', active ? 'bg-[#dbeafe] text-[#1f5fbf]' : 'bg-slate-100 text-slate-500')}>
                {index + 1}
              </span>
              <span>
                <span className="block text-sm font-bold">{step.title}</span>
                <span className="block text-[11px] uppercase tracking-[0.14em] text-slate-400">{t('rebuild.flow.phase')} {index + 1}</span>
              </span>
            </span>
            <ChevronRight size={16} />
          </button>
        );
      })}
    </div>
  </aside>
  );
};

export const CandidateJourneyPage: React.FC<{
  role: Role;
  companyId: string;
  blueprint: HandshakeBlueprint;
  session: CandidateJourneySession;
  setSession: React.Dispatch<React.SetStateAction<CandidateJourneySession>>;
  preferences: CandidatePreferenceProfile;
  userProfile: UserProfile;
  activeCvDocument: CVDocument | null;
  companyLibrary: Company[];
  finalizeBusy: boolean;
  onFinalizeJourney: (payload: {
    role: Role;
    session: CandidateJourneySession;
    candidateName: string;
    scheduledSlot: string;
    candidateScore: number;
    reviewerSummary: string;
    submissionSnapshot: NonNullable<CandidateJourneySession['submissionSnapshot']>;
  }) => Promise<void>;
  navigate: (path: string) => void;
}> = ({ role, companyId, blueprint, session, setSession, preferences, userProfile, activeCvDocument, companyLibrary, finalizeBusy, onFinalizeJourney, navigate }) => {
  const { t, i18n } = useTranslation();
  void companyId;
  const company = resolveCompany(role, companyLibrary);
  const hasJcfpm = Boolean(userProfile.preferences?.jcfpm_v1?.dimension_scores?.length);
  const journeyBlueprint = React.useMemo(() => {
    if (hasJcfpm || blueprint.steps.some((step) => step.id === 'jcfpm_profile')) return blueprint;
    const jcfpmStep = {
      id: 'jcfpm_profile',
      type: 'jcfpm_profile',
      title: t('rebuild.jcfpm.step_title'),
      prompt: t('rebuild.jcfpm.step_prompt'),
      helper: t('rebuild.jcfpm.step_helper'),
    } as HandshakeBlueprint['steps'][number];
    const reviewIndex = blueprint.steps.findIndex((step) => step.type === 'results_summary');
    const nextSteps = [...blueprint.steps];
    nextSteps.splice(reviewIndex >= 0 ? reviewIndex : nextSteps.length, 0, jcfpmStep);
    return { ...blueprint, steps: nextSteps };
  }, [blueprint, hasJcfpm]);
  const currentStepId = session.currentStepId || journeyBlueprint.steps[0]?.id || 'identity';
  const stepIndex = Math.max(0, journeyBlueprint.steps.findIndex((step) => step.id === currentStepId));
  const currentStep = journeyBlueprint.steps[stepIndex] || journeyBlueprint.steps[0];
  const currentStepType = String((currentStep as any)?.type || '');
  const evaluation = React.useMemo(() => evaluateRole(role, preferences, t), [role, preferences, t]);
  const candidateScore = React.useMemo(() => {
    const textVolume = Object.values(session.answers).reduce((sum, value) => {
      if (Array.isArray(value)) return sum + value.join(' ').length;
      return sum + String(value || '').length;
    }, 0);
    return Math.max(74, Math.min(96, 72 + Math.round(textVolume / 36)));
  }, [session.answers]);

  const goToStep = (nextStepId: string) => {
    setSession((current) => ({ ...current, currentStepId: nextStepId }));
    navigate(`/candidate/journey/${role.id}/${nextStepId}`);
  };

  const previousStep = journeyBlueprint.steps[stepIndex - 1];
  const nextStep = journeyBlueprint.steps[stepIndex + 1];
  const selectedSlot = String(session.answers.schedule_slot || '');

  const updateAnswer = (key: string, value: string | string[]) => {
    setSession((current) => ({ ...current, answers: { ...current.answers, [key]: value } }));
  };
  const packetSkills = React.useMemo(
    () => (activeCvDocument?.parsedData?.skills || userProfile.skills || role.skills).slice(0, 4),
    [activeCvDocument, role.skills, userProfile.skills],
  );
  const packetSummary = React.useMemo(
    () => activeCvDocument?.parsedData?.cvAiText || activeCvDocument?.parsedData?.cvText || userProfile.cvAiText || userProfile.cvText || '',
    [activeCvDocument, userProfile.cvAiText, userProfile.cvText],
  );
  const candidatePacket = React.useMemo(() => ({
    activeCvName: activeCvDocument?.originalName || (userProfile.cvUrl ? userProfile.cvUrl.split('/').pop() || t('rebuild.journey.active_cv') : undefined),
    activeCvUrl: activeCvDocument?.fileUrl || userProfile.cvUrl,
    activeCvSummary: packetSummary ? packetSummary.slice(0, 220) : undefined,
    candidateJobTitle: activeCvDocument?.parsedData?.jobTitle || userProfile.jobTitle || role.title,
    keySkills: packetSkills,
    taxSummary: `${preferences.taxProfile.countryCode} ${preferences.taxProfile.taxYear} · ${preferences.taxProfile.employmentType} · ${preferences.taxProfile.childrenCount} ${t('rebuild.journey.children_unit')}`,
    commuteSummary: `${preferences.transportMode} · ${preferences.commuteToleranceMinutes} ${t('rebuild.journey.min_tolerance')} · ${preferences.searchRadiusKm} ${t('rebuild.journey.radius_unit')}`,
    realMonthlyValue: evaluation.totalRealMonthlyValue,
    takeHomeMonthly: evaluation.takeHomeMonthly,
    commuteMinutesOneWay: evaluation.commuteMinutesOneWay,
    jhiScore: Math.round(evaluation.jhi.personalizedScore),
    borderFitLabel: evaluation.borderFitLabel,
  }), [activeCvDocument, evaluation, packetSkills, packetSummary, preferences, role.title, userProfile.cvUrl, userProfile.jobTitle]);
  const effectivePacket = session.submissionSnapshot || candidatePacket;
  const [submitError, setSubmitError] = React.useState('');
  const lastSavedAnswersRef = React.useRef('');

  React.useEffect(() => {
    if (!session.applicationId) return;
    const serialized = JSON.stringify(session.answers || {});
    if (serialized === lastSavedAnswersRef.current) return;
    const previous = lastSavedAnswersRef.current ? JSON.parse(lastSavedAnswersRef.current) as Record<string, unknown> : {};
    const changedEntries = Object.entries(session.answers || {}).filter(([key, value]) => JSON.stringify(previous[key]) !== JSON.stringify(value));
    if (!changedEntries.length) return;
    const timer = window.setTimeout(() => {
      lastSavedAnswersRef.current = serialized;
      void Promise.all(changedEntries.map(([stepId, answer]) => patchHandshakeAnswer(session.applicationId as string, stepId, answer, stepId))).catch((error) => {
        console.error('Failed to autosave handshake answers', error);
        lastSavedAnswersRef.current = '';
      });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [session.answers, session.applicationId]);

  return (
    <CandidateShellSurface
      variant="journey"
      className={cn(shellPageClass, 'space-y-5')}
    >
      <div className="rounded-[8px] border border-slate-200 bg-white px-4 py-3 shadow-[0_18px_50px_-44px_rgba(15,23,42,0.34)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => navigate(`/candidate/role/${role.id}`)} className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-slate-200 text-slate-500 transition hover:border-[#1f5fbf] hover:text-[#1f5fbf]">
              <ArrowLeft size={16} />
            </button>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-[#1f5fbf]">{company.name}</div>
              <div className="truncate text-xs text-slate-500">{role.title}</div>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 justify-center gap-2 overflow-x-auto px-2">
            {journeyBlueprint.steps.slice(0, 5).map((step) => (
              <button
                key={step.id}
                type="button"
                onClick={() => goToStep(step.id)}
                className={cn(
                  'shrink-0 border-b-2 px-3 py-2 text-sm font-semibold transition',
                  step.id === currentStep.id ? 'border-[#1f5fbf] text-[#1f5fbf]' : 'border-transparent text-slate-500 hover:text-slate-800',
                )}
              >
                {step.title}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-xs text-slate-500 sm:block">
              <div className="font-bold uppercase tracking-[0.14em] text-slate-400">{t('rebuild.journey.step_count', { current: stepIndex + 1, total: journeyBlueprint.steps.length })}</div>
              <div>{journeyBlueprint.overview}</div>
            </div>
            <img src={company.reviewer.avatarUrl} alt={company.reviewer.name} className="h-9 w-9 rounded-full object-cover" />
          </div>
        </div>
      </div>

      {session.slotAvailability && !session.slotAvailability.available ? (
        <div className="rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {session.slotAvailability.reason === 'candidate_slots_full'
            ? t('rebuild.journey.candidate_slots_full', { defaultValue: 'All your active handshake slots are currently occupied. Close or finish another handshake before starting this one.' })
            : t('rebuild.journey.company_slots_full', { defaultValue: 'This company challenge is currently full. Try again after the company frees a handshake slot.' })}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
        <StepRail steps={journeyBlueprint.steps} currentStepId={currentStep.id} onSelect={goToStep} />
        <div className="space-y-5">
          <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-[0_24px_70px_-58px_rgba(15,23,42,0.38)]">
            <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1f5fbf]">{t('rebuild.journey.assessment_center')}</div>
                  <div className="mt-1 text-sm text-slate-500">{currentStep.title}</div>
                </div>
                <ProgressNodeRow
                  className="max-w-full overflow-hidden"
                  items={journeyBlueprint.steps.map((step, index) => ({
                    id: step.id,
                    title: String(index + 1),
                    caption: step.id === currentStep.id ? t('rebuild.journey.active_step') : t('rebuild.journey.phase_count', { count: index + 1 }),
                    active: step.id === currentStep.id,
                    icon: <span className="text-xs font-bold">{index + 1}</span>,
                  }))}
                />
              </div>
            </div>

            <div className="p-6 md:p-8">
              <div className="mb-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr_0.9fr]">
                <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t('rebuild.journey.candidate_packet')}</div>
                  <div className="mt-3 text-lg font-semibold tracking-[-0.03em] text-slate-900">{effectivePacket.candidateJobTitle}</div>
                  <div className="mt-2 text-sm text-slate-500">{effectivePacket.activeCvName || t('rebuild.journey.no_cv')}</div>
                  <p className="mt-4 text-sm leading-7 text-slate-600">
                    {effectivePacket.activeCvSummary || t('rebuild.journey.active_cv_prompt')}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {effectivePacket.keySkills.map((skill) => (
                      <span key={skill} className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700">{skill}</span>
                    ))}
                  </div>
                </div>
                <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t('rebuild.journey.tax_reality')}</div>
                  <div className="mt-3 text-lg font-semibold tracking-[-0.03em] text-slate-900">{effectivePacket.taxSummary}</div>
                  <div className="mt-4 text-sm leading-7 text-slate-600">
                    {t('rebuild.journey.take_home')} <strong>{effectivePacket.takeHomeMonthly.toLocaleString(i18n.language === 'cs' ? 'cs-CZ' : 'en-GB')} {role.currency}</strong><br />
                    {t('rebuild.journey.border_fit')} <strong>{effectivePacket.borderFitLabel}</strong>
                  </div>
                </div>
                <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t('rebuild.journey.commute_reality')}</div>
                  <div className="mt-3 text-lg font-semibold tracking-[-0.03em] text-slate-900">{effectivePacket.commuteSummary}</div>
                  <div className="mt-4 text-sm leading-7 text-slate-600">
                    {t('rebuild.journey.one_way_commute')} <strong>{effectivePacket.commuteMinutesOneWay} min</strong><br />
                    {t('rebuild.journey.real_monthly')} <strong>{effectivePacket.realMonthlyValue.toLocaleString(i18n.language === 'cs' ? 'cs-CZ' : 'en-GB')} {role.currency}</strong>
                  </div>
                </div>
              </div>

              {currentStepType === 'identity' ? (
                <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
                  <div className="space-y-4">
                    <div className="overflow-hidden rounded-[8px] bg-[#0f172a]">
                      <img src={company.reviewer.avatarUrl} alt={company.reviewer.name} className="h-[20rem] w-full object-cover" />
                    </div>
                    <div className="rounded-[8px] bg-slate-50 p-5 text-lg italic leading-8 text-slate-700">
                      “{company.reviewer.intro}”
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0f95ac]">{t('rebuild.journey.step_label')} 1 {t('rebuild.journey.of')} {journeyBlueprint.steps.length}</div>
                    <h1 className="mt-3 text-[3.2rem] font-semibold leading-[0.94] tracking-[-0.07em] text-slate-900">{t('rebuild.journey.join_dialogue')}</h1>
                    <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
                      {t('rebuild.journey.identity_intro_prefix')} {company.name} {t('rebuild.journey.identity_intro_suffix')}
                    </p>
                    <div className="mt-8 grid gap-4 md:grid-cols-2">
                      <input
                        value={String(session.answers.legal_name || preferences.legalName)}
                        onChange={(event) => updateAnswer('legal_name', event.target.value)}
                        placeholder={t('rebuild.journey.legal_name')}
                        className={cn(fieldClass, 'mt-0')}
                      />
                      <input
                        value={String(session.answers.preferred_alias || preferences.preferredAlias)}
                        onChange={(event) => updateAnswer('preferred_alias', event.target.value)}
                        placeholder={t('rebuild.journey.alias')}
                        className={cn(fieldClass, 'mt-0')}
                      />
                    </div>
                    <textarea
                      value={String(session.answers.identity_story || preferences.story)}
                      onChange={(event) => updateAnswer('identity_story', event.target.value)}
                      placeholder={t('rebuild.journey.identity_placeholder')}
                      rows={4}
                      className={cn(textareaClass, 'min-h-[120px] md:min-h-[200px]')}
                    />
                  </div>
                </div>
              ) : null}

              {currentStepType === 'motivation' ? (
                <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0f95ac]">{t('rebuild.journey.motivation_label')}</div>
                    <h1 className="mt-3 text-[3rem] font-semibold leading-[0.95] tracking-[-0.06em] text-slate-900">{t('rebuild.journey.motivation_title')}</h1>
                    <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">{currentStep.prompt}</p>
                    <textarea
                      value={String(session.answers.motivation || '')}
                      onChange={(event) => updateAnswer('motivation', event.target.value)}
                      rows={4}
                      className={cn(textareaClass, 'mt-6 min-h-[120px] md:min-h-[220px]')}
                      placeholder={t('rebuild.journey.motivation_placeholder')}
                    />
                    <div className="mt-5 flex flex-wrap gap-2">
                      {['Innovation', 'Collaboration', 'Ethical Tech', 'Growth'].map((chip) => {
                        const selected = Array.isArray(session.answers.motivation_tags) && session.answers.motivation_tags.includes(chip);
                        return (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => {
                              const current = Array.isArray(session.answers.motivation_tags) ? session.answers.motivation_tags : [];
                              updateAnswer('motivation_tags', selected ? current.filter((item) => item !== chip) : [...current, chip]);
                            }}
                            className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition', selected ? 'bg-[#12AFCB] text-white' : 'bg-slate-100 text-slate-600')}
                          >
                            {chip}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-5">
                    <div className="text-sm font-semibold text-slate-900">{t('rebuild.journey.reviewer_context')}</div>
                    <p className="mt-4 text-sm leading-7 text-slate-600">{company.reviewer.intro}</p>
                  </div>
                </div>
              ) : null}

              {currentStepType === 'skill_alignment' ? (
                <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
                  <div className="rounded-[8px] border border-slate-200 bg-[#f9fbff] p-6">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t('rebuild.journey.skill_map_overlay')}</div>
                    <div className="relative mt-6 flex min-h-[24rem] items-center justify-center">
                      <div className="absolute flex h-28 w-28 items-center justify-center rounded-full bg-[#12AFCB] text-center text-sm font-semibold text-white shadow-[0_18px_40px_-18px_rgba(18,175,203,0.48)]">CORE</div>
                      {['Leadership', 'Architecture', 'Scale', 'AI Synthesis'].map((label, index) => (
                        <div
                          key={label}
                          className="absolute flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-[#12AFCB]/30 bg-white text-[11px] font-medium text-slate-700"
                          style={{
                            top: index === 0 ? '25%' : index === 1 ? '10%' : index === 2 ? '65%' : '70%',
                            left: index === 0 ? '18%' : index === 1 ? '62%' : index === 2 ? '18%' : '52%',
                          }}
                        >
                          {label}
                        </div>
                      ))}
                    </div>
                    <div className="rounded-[8px] bg-white p-4 text-sm leading-7 text-slate-600 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.12)]">
                      {t('rebuild.journey.skill_map_copy')}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="rounded-[8px] border border-slate-200 bg-white p-5">
                      <div className="text-sm font-semibold text-slate-900">{t('rebuild.journey.growth_intentions')}</div>
                      {[
                        ['AI & Machine Learning', '40% leap'],
                        ['Strategic Scaling', 'Consistent'],
                        ['Ethical Frameworks', '20% leap'],
                      ].map(([label, value]) => (
                        <div key={label} className="mt-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-slate-700">{label}</span>
                            <span className="rounded-full bg-[#12AFCB]/10 px-2 py-0.5 text-[11px] font-semibold text-[#0f95ac]">{value} {t('rebuild.journey.leap_unit')}</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={Number(session.answers[`align_${label}`] || 55)}
                            onChange={(event) => updateAnswer(`align_${label}`, event.target.value)}
                            className="mt-3 h-2 w-full accent-[#12AFCB]"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="rounded-[8px] border border-slate-200 bg-white p-5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t('rebuild.journey.focus_areas')}</div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {['Cloud Systems', 'Microservices', 'Data Orchestration', 'User Centricity', 'Rust/Go'].map((chip) => {
                          const selected = Array.isArray(session.answers.focus_areas) && session.answers.focus_areas.includes(chip);
                          return (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => {
                                const current = Array.isArray(session.answers.focus_areas) ? session.answers.focus_areas : [];
                                updateAnswer('focus_areas', selected ? current.filter((item) => item !== chip) : [...current, chip]);
                              }}
                              className={cn('rounded-full px-3 py-2 text-sm font-medium transition', selected ? 'bg-[#12AFCB] text-white' : 'bg-slate-100 text-slate-600')}
                            >
                              {chip}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {[
                'portfolio_or_proof',
                'scenario_response',
                'reflection',
                'context',
                'text_response',
                'work_sample',
                'workspace',
                'external_link',
                'file_upload',
              ].includes(currentStepType) ? (
                <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0f95ac]">{currentStep.title}</div>
                    <h1 className="mt-3 text-[2.8rem] font-semibold leading-[0.96] tracking-[-0.06em] text-slate-900">{currentStep.prompt}</h1>
                    <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">{currentStep.helper}</p>
                    <textarea
                      value={String(session.answers[currentStep.id] || '')}
                      onChange={(event) => updateAnswer(currentStep.id, event.target.value)}
                      rows={5}
                      className={cn(textareaClass, 'mt-6 min-h-[140px] md:min-h-[260px]')}
                      placeholder={t('rebuild.journey.response_placeholder')}
                    />
                  </div>
                  <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-5">
                    <div className="text-sm font-semibold text-slate-900">{t('rebuild.journey.strong_signal')}</div>
                    <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                      <li>{t('rebuild.journey.specific_examples')}</li>
                      <li>{t('rebuild.journey.tradeoff')}</li>
                      <li>{t('rebuild.journey.judgment')}</li>
                    </ul>
                  </div>
                </div>
              ) : null}

              {currentStepType === 'task_workspace' ? (
                <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
                  <div className="space-y-4">
                    <div className="rounded-[8px] border border-slate-200 bg-white p-5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0f95ac]">{t('rebuild.journey.requirements')}</div>
                      <h1 className="mt-3 text-[2.5rem] font-semibold leading-[0.96] tracking-[-0.06em] text-slate-900">{currentStep.prompt || role.challenge}</h1>
                      <p className="mt-4 text-sm leading-7 text-slate-600">{currentStep.helper || role.summary}</p>
                    </div>
                    <div className="rounded-[8px] border border-slate-200 bg-white p-5">
                      <div className="text-sm font-semibold text-slate-900">{t('rebuild.journey.security_constraints')}</div>
                      <p className="mt-3 text-sm leading-7 text-slate-600">{t('rebuild.journey.security_constraints_copy')}</p>
                    </div>
                    <div className="rounded-[8px] border border-slate-200 bg-white p-5">
                      <div className="text-sm font-semibold text-slate-900">{t('rebuild.journey.target')}</div>
                      <p className="mt-3 text-sm leading-7 text-slate-600">{t('rebuild.journey.target_copy')}</p>
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-[8px] border border-slate-200 bg-[#10161f] text-white shadow-[0_30px_80px_-40px_rgba(2,8,23,0.75)]">
                    <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                      <div className="flex items-center gap-3 text-sm text-slate-300">
                        <span className="rounded-md bg-white/10 px-2 py-1">protocol_v2.rs</span>
                        <span className="rounded-md bg-white/10 px-2 py-1">mesh_network.rs</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" className="rounded-[8px] bg-white/10 px-3 py-2 text-xs font-semibold text-white">{t('rebuild.journey.run_tests')}</button>
                        <button type="button" className="rounded-[8px] bg-[#1f5fbf] px-3 py-2 text-xs font-semibold text-white">{t('rebuild.journey.auto_format')}</button>
                      </div>
                    </div>
                    <textarea
                      value={String(session.answers[currentStep.id] || '')}
                      onChange={(event) => updateAnswer(currentStep.id, event.target.value)}
                      placeholder={currentStep.prompt}
                      className="h-[36rem] w-full resize-none bg-transparent px-5 py-5 font-mono text-[14px] leading-7 text-slate-200 outline-none"
                    />
                  </div>
                </div>
              ) : null}

              {currentStepType === 'jcfpm_profile' ? (
                <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1f5fbf]">JCFPM signal</div>
                    <h1 className="mt-3 text-[2.8rem] font-semibold leading-[0.96] tracking-[-0.06em] text-slate-900">{t('rebuild.jcfpm.step_required_title', { defaultValue: 'Complete your work profile for assessment results.' })}</h1>
                    <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
                      {t('rebuild.jcfpm.step_required_desc', { defaultValue: 'JCFPM is not restarted in the handshake if you have already completed it. Since we don\'t see it in your profile yet, please add it before the final readout.' })}
                    </p>
                    <div className="mt-6 rounded-[8px] border border-slate-200 bg-slate-50 p-5">
                      <div className="text-sm font-bold text-slate-900">{t('rebuild.jcfpm.what_will_be_used', { defaultValue: 'What will be used in results' })}</div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {[
                          t('rebuild.jcfpm.style', { defaultValue: 'Work style' }),
                          t('rebuild.jcfpm.motivation', { defaultValue: 'Motivation' }),
                          t('rebuild.jcfpm.values', { defaultValue: 'Value setting' }),
                          t('rebuild.jcfpm.decisions', { defaultValue: 'Decisions in uncertainty' }),
                        ].map((item) => (
                          <div key={item} className="rounded-[8px] border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">{item}</div>
                        ))}
                      </div>
                    </div>
                    <button type="button" onClick={() => navigate('/candidate/jcfpm')} className={cn(primaryButtonClass, 'mt-6 rounded-[8px]')}>
                      {t('rebuild.jcfpm.open_profile', { defaultValue: 'Open JCFPM profile' })}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                  <div className="rounded-[8px] border border-slate-200 bg-white p-5">
                    <div className="text-sm font-bold text-slate-900">{t('rebuild.jcfpm.handshake_rule_title', { defaultValue: 'Handshake rule' })}</div>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      {t('rebuild.jcfpm.handshake_rule_desc', { defaultValue: 'A finished JCFPM is simply used. An unfinished JCFPM is part of the handshake and, once completed, is saved to the profile for further challenges.' })}
                    </p>
                  </div>
                </div>
              ) : null}

              {currentStepType === 'results_summary' ? (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#12AFCB]/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0f95ac]">
                      <ShieldCheck size={12} />
                      {t('rebuild.journey.analysis_done', { defaultValue: 'Analysis complete' })}
                    </div>
                    <h1 className="mx-auto mt-5 max-w-[14ch] text-[3.5rem] font-semibold leading-[0.94] tracking-[-0.07em] text-slate-900">{t('rebuild.journey.exemplary', { defaultValue: 'Exemplary signal, candidate.' })}</h1>
                    <p className="mx-auto mt-4 max-w-3xl text-base leading-8 text-slate-600">
                      {t('rebuild.journey.summary_intro', { defaultValue: 'According to your answers, you fit' })} {candidateScore}% {t('rebuild.journey.summary_outro', { defaultValue: 'of what is truly important for the role.' })}
                    </p>
                  </div>
                  <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
                    <div className="rounded-[8px] border border-slate-200 bg-white p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-3xl font-semibold tracking-[-0.04em] text-slate-900">{company.name} standards</div>
                          <div className="mt-2 text-sm text-slate-500">Performance benchmarking vs. role criteria.</div>
                        </div>
                        <div className="text-right text-4xl font-semibold tracking-[-0.05em] text-[#0f95ac]">{candidateScore}<span className="text-base text-slate-400">/100</span></div>
                      </div>
                      {[
                        ['Structured reasoning', Math.max(candidateScore, 82)],
                        ['Mission resonance', Math.max(78, candidateScore - 4)],
                        ['Reflection quality', Math.max(76, candidateScore - 2)],
                        ['Decision clarity', Math.max(80, candidateScore - 1)],
                      ].map(([label, value]) => (
                        <div key={label} className="mt-5">
                          <div className="flex items-center justify-between text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                            <span>{label}</span>
                            <span>{value}%</span>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-slate-100">
                            <div className="h-2 rounded-full bg-[#12AFCB]" style={{ width: `${value}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-[8px] bg-[#10161f] p-6 text-white shadow-[0_30px_80px_-42px_rgba(18,89,100,0.56)]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/72">{t('rebuild.journey.reviewer_note', { defaultValue: 'Reviewer note' })}</div>
                      <p className="mt-8 text-lg leading-8">
                        {t('rebuild.journey.strong_signal_note', { defaultValue: 'Strong signal. The candidate shows structured thought, clear motivation and enough evidence to justify a live conversation.' })}
                      </p>
                      <div className="mt-10 flex items-center gap-3">
                        <img src={company.reviewer.avatarUrl} alt={company.reviewer.name} className="h-12 w-12 rounded-full object-cover" />
                        <div>
                          <div className="font-semibold">{company.reviewer.name}</div>
                          <div className="text-sm text-white/72">{company.reviewer.role}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    {[
                      ['JHI', `${Math.round(evaluation.jhi.personalizedScore)} / 100`],
                      ['Real monthly value', `${evaluation.totalRealMonthlyValue.toLocaleString(i18n.language === 'cs' ? 'cs-CZ' : 'en-GB')} ${role.currency}`],
                      ['Commute-adjusted fit', evaluation.borderFitLabel],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-[8px] border border-slate-200 bg-white p-5">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
                        <div className="mt-3 text-xl font-semibold tracking-[-0.03em] text-slate-900">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-[8px] border border-slate-200 bg-white p-6">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t('rebuild.journey.reviewer_packet', { defaultValue: 'What the company will see' })}</div>
                    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{effectivePacket.activeCvName || t('rebuild.journey.packet_without_cv')}</div>
                        <p className="mt-3 text-sm leading-7 text-slate-600">{effectivePacket.activeCvSummary || t('rebuild.journey.no_cv_summary')}</p>
                      </div>
                      <div className="space-y-3 text-sm leading-7 text-slate-600">
                        <div><strong>{t('rebuild.journey.tax_label', { defaultValue: 'Taxes:' })}</strong> {effectivePacket.taxSummary}</div>
                        <div><strong>{t('rebuild.journey.commute_label', { defaultValue: 'Commute:' })}</strong> {effectivePacket.commuteSummary}</div>
                        <div><strong>{t('rebuild.journey.skills_label', { defaultValue: 'Key skills:' })}</strong> {effectivePacket.keySkills.join(', ') || t('rebuild.journey.no_skills', { defaultValue: 'None yet' })}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {currentStepType === 'schedule_request' ? (
                <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
                  <div className="space-y-4">
                    <div className="rounded-[8px] border border-slate-200 bg-white p-6">
                      <div className="flex items-center gap-3">
                        <img src={company.reviewer.avatarUrl} alt={company.reviewer.name} className="h-16 w-16 rounded-2xl object-cover" />
                        <div>
                          <div className="text-xl font-semibold tracking-[-0.03em] text-slate-900">{company.reviewer.name}</div>
                          <div className="text-sm uppercase tracking-[0.18em] text-slate-400">{company.reviewer.role}</div>
                        </div>
                      </div>
                      <div className="mt-6 space-y-3 text-sm text-slate-600">
                        <div className="flex items-center gap-3"><HeartHandshake size={16} /> {company.reviewer.meetingLabel}</div>
                        <div className="flex items-center gap-3"><Clock3 size={16} /> {company.reviewer.durationMinutes} minutes</div>
                        <div className="flex items-center gap-3"><Globe2 size={16} /> {company.reviewer.tool}</div>
                      </div>
                    </div>
                    <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-6">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Why this matters</div>
                      <blockquote className="mt-4 text-sm italic leading-8 text-slate-600">“We believe the best collaborations happen when we connect as humans first. This session is about finding resonance, not checking boxes.”</blockquote>
                    </div>
                  </div>
                  <div className="rounded-[8px] border border-slate-200 bg-white p-6">
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-semibold tracking-[-0.03em] text-slate-900">{t('rebuild.journey.select_datetime', { defaultValue: 'Select a date & time' })}</div>
                      <div className="text-sm text-slate-500">Week of June 7</div>
                    </div>
                    <div className="mt-6 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      {[t('rebuild.day.mon', { defaultValue: 'Mon' }), t('rebuild.day.tue', { defaultValue: 'Tue' }), t('rebuild.day.wed', { defaultValue: 'Wed' }), t('rebuild.day.thu', { defaultValue: 'Thu' }), t('rebuild.day.fri', { defaultValue: 'Fri' }), t('rebuild.day.sat', { defaultValue: 'Sat' }), t('rebuild.day.sun', { defaultValue: 'Sun' })].map((day) => <div key={day}>{day}</div>)}
                    </div>
                    <div className="mt-3 grid grid-cols-7 gap-2 text-center text-sm">
                      {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                        <div key={day} className={cn('rounded-[8px] px-3 py-4 font-medium', day === 7 ? 'bg-[#1f5fbf] text-white' : 'text-slate-500')}>
                          {day}
                        </div>
                      ))}
                    </div>
                    <div className="mt-8 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Available slots for Wednesday, June 7</div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {['09:30 AM', '11:00 AM', '02:15 PM', '04:45 PM'].map((slot) => {
                        const active = selectedSlot === slot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => updateAnswer('schedule_slot', slot)}
                            className={cn(
                              'rounded-[8px] border px-4 py-4 text-sm font-semibold transition',
                              active ? 'border-[#1f5fbf] bg-[#dbeafe] text-[#1f5fbf]' : 'border-slate-200 bg-white text-slate-700',
                            )}
                          >
                            {slot}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {previousStep ? (
              <button type="button" onClick={() => goToStep(previousStep.id)} className={secondaryButtonClass}>
                <ArrowLeft size={16} /> {t('rebuild.journey.prev', { defaultValue: 'Previous' })}
              </button>
            ) : <span />}
            {nextStep ? (
              <button type="button" onClick={() => goToStep(nextStep.id)} className={primaryButtonClass}>
                {t('rebuild.journey.next', { defaultValue: 'Next' })} <ArrowRight size={16} />
              </button>
            ) : session.applicationId || session.submittedAt ? (
              <button type="button" onClick={() => navigate('/candidate/insights')} className={primaryButtonClass}>
                <Check size={16} />
                {t('rebuild.journey.open_lane', { defaultValue: 'Open submission lane' })}
              </button>
            ) : (
              <button
                type="button"
                disabled={finalizeBusy}
                onClick={() => {
                  if (session.slotAvailability && !session.slotAvailability.available && !session.applicationId) {
                    setSubmitError(t('rebuild.journey.no_slots_error', { defaultValue: 'This handshake cannot be submitted because no active slot is available.' }));
                    return;
                  }
                  const candidateName = String(session.answers.preferred_alias || session.answers.legal_name || preferences.name);
                  const reviewerSummary =
                    candidateScore >= 90
                      ? 'Structured submission with strong alignment, clear motivation and credible next-step readiness.'
                      : 'Promising signal with enough evidence to justify a live conversation and deeper review.';
                  setSubmitError('');
                  void onFinalizeJourney({
                    role,
                    session,
                    candidateName,
                    scheduledSlot: selectedSlot,
                    candidateScore,
                    reviewerSummary,
                    submissionSnapshot: candidatePacket,
                  }).catch((error) => {
                    setSubmitError(error instanceof Error ? error.message : t('rebuild.journey.finalize_error'));
                  });
                }}
                className={cn(primaryButtonClass, 'disabled:opacity-60')}
              >
                {finalizeBusy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {t('rebuild.journey.finalize', { defaultValue: 'Finalize journey' })}
              </button>
            )}
          </div>
          {submitError ? <div className="rounded-[8px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{submitError}</div> : null}
        </div>
      </div>
    </CandidateShellSurface>
  );
};

export const CandidateInsightsPage: React.FC<{
  roles: Role[];
  preferences: CandidatePreferenceProfile;
  setPreferences: React.Dispatch<React.SetStateAction<CandidatePreferenceProfile>>;
  userProfile: UserProfile;
  setUserProfile: (updates: Partial<UserProfile>) => void;
  activeCvDocument: CVDocument | null;
  cvDocuments: CVDocument[];
  cvLoading: boolean;
  cvBusy: boolean;
  cvReviewBusy: boolean;
  candidateApplications: DialogueSummary[];
  applicationsLoading: boolean;
  candidateCapacity: CandidateDialogueCapacity | null;
  selectedApplicationId: string;
  selectedApplicationDetail: DialogueDetail | null;
  selectedApplicationMessages: DialogueMessage[];
  applicationDetailLoading: boolean;
  applicationMessageBusy: boolean;
  applicationWithdrawBusy: boolean;
  savedRoleIds: string[];
  isSavingProfile: boolean;
  onSaveProfile: (updates?: Partial<UserProfile>) => void | Promise<void>;
  onOpenAuth: () => void;
  onUploadCv: (file: File) => Promise<void>;
  onSelectCv: (cvId: string) => Promise<void>;
  onDeleteCv: (cvId: string) => Promise<void>;
  onSaveCvReview: (input: { jobTitle: string; skills: string[]; summary: string }) => Promise<void>;
  onSelectApplication: (applicationId: string) => void;
  onUploadMessageAttachment: (file: File) => Promise<ApplicationMessageAttachment>;
  onSendApplicationMessage: (body: string, attachments: ApplicationMessageAttachment[]) => Promise<void>;
  onWithdrawApplication: () => Promise<void>;
  onToggleSavedRole: (roleId: string) => void;
  onUploadPhoto: (file: File) => Promise<void>;
  onSignOut?: () => void;
  onCompanySwitch?: () => void;
  currentLanguage?: string;
  onLanguageChange?: (lang: string) => void;
  navigate: (path: string) => void;
}> = ({
  roles,
  preferences,
  userProfile,
  setUserProfile,
  activeCvDocument,
  cvDocuments,
  cvLoading,
  cvBusy,
  candidateApplications,
  applicationsLoading,
  candidateCapacity,
  selectedApplicationId,
  savedRoleIds,
  isSavingProfile,
  onSaveProfile,
  onOpenAuth,
  onUploadCv,
  onSelectCv,
  onDeleteCv,
  onSelectApplication,
  onToggleSavedRole,
  onUploadPhoto,
  onSignOut,
  onCompanySwitch,
  currentLanguage,
  onLanguageChange,
  navigate,
}) => {
  const { t } = useTranslation();

  return (
    <CandidateDashboardV2
      roles={roles}
      preferences={preferences}
      userProfile={userProfile}
      setUserProfile={setUserProfile}
      activeCvDocument={activeCvDocument}
      cvDocuments={cvDocuments}
      cvLoading={cvLoading}
      cvBusy={cvBusy}
      candidateApplications={candidateApplications}
      applicationsLoading={applicationsLoading}
      candidateCapacity={candidateCapacity}
      selectedApplicationId={selectedApplicationId}
      savedRoleIds={savedRoleIds}
      isSavingProfile={isSavingProfile}
      onSaveProfile={onSaveProfile}
      onOpenAuth={onOpenAuth}
      onSelectApplication={onSelectApplication}
      onToggleSavedRole={onToggleSavedRole}
      onUploadCv={onUploadCv}
      onSelectCv={onSelectCv}
      onDeleteCv={onDeleteCv}
      onUploadPhoto={onUploadPhoto}
      onSignOut={onSignOut}
      onCompanySwitch={onCompanySwitch}
      currentLanguage={currentLanguage}
      onLanguageChange={onLanguageChange}
      navigate={navigate}
      t={t}
    />
  );
};
