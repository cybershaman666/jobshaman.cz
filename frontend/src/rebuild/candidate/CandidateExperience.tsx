import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ChevronRight,
  Clock3,
  Globe2,
  HeartHandshake,
  Loader2,
  Paperclip,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from 'lucide-react';

import { createDefaultTaxProfileByCountry } from '../../services/profileDefaults';
import { validateCvFile } from '../../services/v2CvService';
import { completeProfileOnboardingFromStory } from '../../services/aiProfileService';
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
  panelClass,
  pillEyebrowClass,
  primaryButtonClass,
  secondaryButtonClass,
  shellPageClass,
  textareaClass,
} from '../ui/shellStyles';
import {
  AttachmentChip,
  AttachmentPreview,
  formatAttachmentType,
  SharedJcfpmCard,
  ThreadMetaStrip,
} from '../shared/dialogueUi';
import { InsightBadge } from './CandidateShell';
import { CandidateDashboardV2 } from './CandidateDashboardV2';
import {
  CandidateShellSurface,
  ProgressNodeRow,
} from './CandidateShellSurface';

const getCandidateDialogueSlotsLimit = (tier?: string) =>
  tier === 'premium' ? 25 : 5;

const resolveDemoCoordinates = (address: string): { lat: number; lon: number } | null => {
  const normalized = address.trim().toLowerCase();
  if (normalized.includes('prague') || normalized.includes('praha')) return { lat: 50.0755, lon: 14.4378 };
  if (normalized.includes('brno')) return { lat: 49.1951, lon: 16.6068 };
  if (normalized.includes('vienna') || normalized.includes('wien') || normalized.includes('vide') || normalized.includes('vídeň')) return { lat: 48.2082, lon: 16.3738 };
  if (normalized.includes('berlin')) return { lat: 52.52, lon: 13.405 };
  if (normalized.includes('bratislava')) return { lat: 48.1486, lon: 17.1077 };
  if (normalized.includes('ostrava')) return { lat: 49.8209, lon: 18.2625 };
  return null;
};

const resolveCountryFromAddress = (address: string): string | null => {
  const normalized = address.toLowerCase();
  if (normalized.includes('česká republika') || normalized.includes('czech republic') || normalized.includes('česko') || normalized.includes(' czechia')) return 'CZ';
  if (normalized.includes('deutschland') || normalized.includes('germany')) return 'DE';
  if (normalized.includes('österreich') || normalized.includes('austria')) return 'AT';
  if (normalized.includes('polska') || normalized.includes('poland')) return 'PL';
  if (normalized.includes('slovensko') || normalized.includes('slovakia')) return 'SK';
  
  // Specific cities
  if (normalized.includes('praha') || normalized.includes('prague') || normalized.includes('brno') || normalized.includes('ostrava')) return 'CZ';
  if (normalized.includes('berlin') || normalized.includes('münchen') || normalized.includes('hamburg') || normalized.includes('munich')) return 'DE';
  if (normalized.includes('wien') || normalized.includes('vienna')) return 'AT';
  if (normalized.includes('warszawa') || normalized.includes('warsaw') || normalized.includes('kraków') || normalized.includes('krakow')) return 'PL';
  if (normalized.includes('bratislava')) return 'SK';

  return null;
};

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

const LifeStoryWizard: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onComplete: (summary: string) => void;
}> = ({ isOpen, onClose, onComplete }) => {
  const { t } = useTranslation();
  const [step, setStep] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  const steps = [
    {
      id: 'roots',
      title: t('rebuild.lifestory.roots_title'),
      prompt: t('rebuild.lifestory.roots_prompt'),
    },
    {
      id: 'growth',
      title: t('rebuild.lifestory.growth_title'),
      prompt: t('rebuild.lifestory.growth_prompt'),
    },
    {
      id: 'signals',
      title: t('rebuild.lifestory.signals_title'),
      prompt: t('rebuild.lifestory.signals_prompt'),
    },
    {
      id: 'craft',
      title: t('rebuild.lifestory.craft_title'),
      prompt: t('rebuild.lifestory.craft_prompt'),
    },
    {
      id: 'context',
      title: t('rebuild.lifestory.context_title'),
      prompt: t('rebuild.lifestory.context_prompt'),
    },
    {
      id: 'vision',
      title: t('rebuild.lifestory.vision_title'),
      prompt: t('rebuild.lifestory.vision_prompt'),
    },
  ];

  const currentStep = steps[step];

  const handleNext = async () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      setBusy(true);
      setError('');
      try {
        const payload = steps.map((s) => ({ id: s.id, text: answers[s.id] || '' }));
        const result = await completeProfileOnboardingFromStory(payload);
        onComplete(result.ai_profile?.story || '');
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : t('rebuild.lifestory.error_generation'));
      } finally {
        setBusy(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4">
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-[32px] bg-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-6 top-6 rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 transition"
        >
          <X size={20} />
        </button>

        <div className="p-6 md:p-12">
          <div className="flex items-center gap-3 text-[#12AFCB]">
            <Sparkles size={20} />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em]">{t('rebuild.lifestory.ai_guide')}</span>
          </div>

          <div className="mt-8">
            <div className="flex items-center gap-2">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-1.5 flex-1 rounded-full transition-all duration-500',
                    i === step ? 'bg-[#12AFCB] shadow-[0_0_12px_rgba(18,175,203,0.4)]' : i < step ? 'bg-slate-200' : 'bg-slate-100',
                  )}
                />
              ))}
            </div>
          </div>

          <div className="mt-8 md:mt-10 min-h-[14rem] md:min-h-[16rem]">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-[-0.04em] text-slate-900">{currentStep.title}</h2>
            <p className="mt-3 md:mt-4 text-base md:text-lg leading-7 md:leading-8 text-slate-600">{currentStep.prompt}</p>
            <textarea
              autoFocus
              value={answers[currentStep.id] || ''}
              onChange={(e) => setAnswers({ ...answers, [currentStep.id]: e.target.value })}
              className="mt-6 md:mt-8 h-32 md:h-40 w-full resize-none rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-base md:text-lg outline-none focus:border-[#12AFCB] transition"
              placeholder={t('rebuild.lifestory.placeholder')}
            />
          </div>

          {error && <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}

          <div className="mt-10 flex items-center justify-between">
            <button
              type="button"
              disabled={step === 0 || busy}
              onClick={() => setStep(step - 1)}
              className="text-sm font-semibold text-slate-400 hover:text-slate-600 disabled:opacity-0 transition"
            >
              {t('rebuild.lifestory.back')}
            </button>
            <button
              type="button"
              disabled={busy || !(answers[currentStep.id] || '').trim()}
              onClick={handleNext}
              className={cn(
                'inline-flex h-14 items-center gap-2 rounded-full px-8 text-lg font-semibold text-white transition-all',
                'bg-[#12AFCB] hover:bg-[#0f95ac] shadow-[0_12px_24px_-8px_rgba(18,175,203,0.4)] disabled:opacity-50 disabled:shadow-none'
              )}
            >
              {busy ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <>
                  {step === steps.length - 1 ? t('rebuild.lifestory.generate') : t('rebuild.lifestory.next')}
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
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

              {currentStep.type === 'identity' ? (
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

              {currentStep.type === 'motivation' ? (
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

              {currentStep.type === 'skill_alignment' ? (
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

              {currentStep.type === 'portfolio_or_proof' || currentStep.type === 'scenario_response' || currentStep.type === 'reflection' ? (
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

              {currentStep.type === 'task_workspace' ? (
                <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
                  <div className="space-y-4">
                    <div className="rounded-[8px] border border-slate-200 bg-white p-5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0f95ac]">{t('rebuild.journey.requirements')}</div>
                      <h1 className="mt-3 text-[2.5rem] font-semibold leading-[0.96] tracking-[-0.06em] text-slate-900">{role.challenge}</h1>
                      <p className="mt-4 text-sm leading-7 text-slate-600">{role.summary}</p>
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
                      value={String(session.answers.workspace || 'use orbit_core::{Protocol, Node};\nuse crypto::quantum::PQCSignature;\n\npub struct MeshArchitect {\n    nodes: Vec<Node>,\n    signature_engine: PQCSignature,\n}\n\nimpl Protocol for MeshArchitect {\n    fn sync_state(&self) -> Result<(), SyncError> {\n        // TODO: show your architecture logic here\n        Ok(())\n    }\n}')}
                      onChange={(event) => updateAnswer('workspace', event.target.value)}
                      className="h-[36rem] w-full resize-none bg-transparent px-5 py-5 font-mono text-[14px] leading-7 text-slate-200 outline-none"
                    />
                  </div>
                </div>
              ) : null}

              {currentStep.type === 'jcfpm_profile' ? (
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

              {currentStep.type === 'results_summary' ? (
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

              {currentStep.type === 'schedule_request' ? (
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
  onSaveProfile: () => void;
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
  setPreferences,
  userProfile,
  setUserProfile,
  activeCvDocument,
  cvDocuments,
  cvLoading,
  cvBusy,
  cvReviewBusy,
  candidateApplications,
  applicationsLoading,
  candidateCapacity,
  selectedApplicationId,
  selectedApplicationDetail,
  selectedApplicationMessages,
  applicationDetailLoading,
  applicationMessageBusy,
  applicationWithdrawBusy,
  savedRoleIds,
  isSavingProfile,
  onSaveProfile,
  onOpenAuth,
  onUploadCv,
  onSelectCv,
  onDeleteCv,
  onSaveCvReview,
  onSelectApplication,
  onUploadMessageAttachment,
  onSendApplicationMessage,
  onWithdrawApplication,
  onToggleSavedRole,
  onUploadPhoto,
  onSignOut,
  onCompanySwitch,
  currentLanguage,
  onLanguageChange,
  navigate,
}) => {
  const { t } = useTranslation();
  const useDashboardV2 = Boolean('dashboard-v2');
  if (useDashboardV2) {
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
  }

  const snapshots = React.useMemo(
    () => roles
      .map((role) => ({ role, evaluation: evaluateRole(role, preferences, t) }))
      .sort((left, right) => right.evaluation.jhi.personalizedScore - left.evaluation.jhi.personalizedScore),
    [preferences, roles, t],
  );
  const featuredSnapshot = snapshots[0] || null;
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [cvError, setCvError] = React.useState('');
  const [cvNotice, setCvNotice] = React.useState('');
  const [cvReview, setCvReview] = React.useState(() => ({
    jobTitle: userProfile.jobTitle || '',
    skillsCsv: (userProfile.skills || []).join(', '),
    summary: userProfile.cvAiText || userProfile.cvText || '',
  }));
  const [messageDraft, setMessageDraft] = React.useState('');
  const [messageAttachments, setMessageAttachments] = React.useState<ApplicationMessageAttachment[]>([]);
  const [applicationNotice, setApplicationNotice] = React.useState('');
  const [applicationError, setApplicationError] = React.useState('');
  const [messageAttachmentBusy, setMessageAttachmentBusy] = React.useState(false);
  const messageAttachmentInputRef = React.useRef<HTMLInputElement | null>(null);
  const photoInputRef = React.useRef<HTMLInputElement | null>(null);
  const [photoUploading, setPhotoUploading] = React.useState(false);
  const [photoError, setPhotoError] = React.useState('');
  const [isLifeStoryOpen, setIsLifeStoryOpen] = React.useState(false);

  React.useEffect(() => {
    setCvReview({
      jobTitle: activeCvDocument?.parsedData?.jobTitle || userProfile.jobTitle || '',
      skillsCsv: (activeCvDocument?.parsedData?.skills || userProfile.skills || []).join(', '),
      summary: activeCvDocument?.parsedData?.cvAiText || activeCvDocument?.parsedData?.cvText || userProfile.cvAiText || userProfile.cvText || '',
    });
  }, [activeCvDocument, userProfile.cvAiText, userProfile.cvText, userProfile.jobTitle, userProfile.skills]);

  const updateTaxProfile = (updater: (taxProfile: CandidatePreferenceProfile['taxProfile']) => CandidatePreferenceProfile['taxProfile']) => {
    setPreferences((current) => ({ ...current, taxProfile: updater(current.taxProfile) }));
  };

  const handleTaxCountryChange = (countryCode: CandidatePreferenceProfile['taxProfile']['countryCode']) => {
    setPreferences((current) => {
      const nextDefault = createDefaultTaxProfileByCountry(countryCode, current.taxProfile.taxYear);
      return {
        ...current,
        taxProfile: {
          ...nextDefault,
          taxYear: current.taxProfile.taxYear,
          childrenCount: current.taxProfile.childrenCount,
          specialReliefs: current.taxProfile.specialReliefs || [],
        },
      };
    });
  };

  const handleCvInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const validationError = validateCvFile(file);
    if (validationError) {
      setCvNotice('');
      setCvError(validationError === 'size' ? 'CV exceeds the 10 MB limit.' : 'Only PDF or Word CV files are supported.');
      event.target.value = '';
      return;
    }
    try {
      setCvError('');
      setCvNotice('');
      await onUploadCv(file);
      setCvNotice(`Uploaded ${file.name} and synced it into your candidate profile.`);
    } catch (uploadError) {
      setCvNotice('');
      setCvError(uploadError instanceof Error ? uploadError.message : 'CV upload failed.');
    } finally {
      event.target.value = '';
    }
  };

  const saveCvReview = async () => {
    try {
      setCvError('');
      setCvNotice('');
      await onSaveCvReview({
        jobTitle: cvReview.jobTitle,
        skills: cvReview.skillsCsv.split(',').map((item) => item.trim()).filter(Boolean),
        summary: cvReview.summary,
      });
      setCvNotice('Parsed CV review saved and synced into your active candidate profile.');
    } catch (error) {
      setCvError(error instanceof Error ? error.message : 'Failed to save CV review.');
    }
  };

  const handlePhotoInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setPhotoError('Only image files are supported.');
      event.target.value = '';
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Image exceeds the 5 MB limit.');
      event.target.value = '';
      return;
    }

    try {
      setPhotoError('');
      setPhotoUploading(true);
      await onUploadPhoto(file);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'Photo upload failed.');
    } finally {
      setPhotoUploading(false);
      event.target.value = '';
    }
  };

  const handleMessageAttachmentInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setApplicationError('');
      setApplicationNotice('');
      setMessageAttachmentBusy(true);
      const attachment = await onUploadMessageAttachment(file);
      setMessageAttachments((current) => [...current, attachment]);
      setApplicationNotice(`${file.name} attached to the outgoing message.`);
    } catch (error) {
      setApplicationError(error instanceof Error ? error.message : 'Failed to upload attachment.');
    } finally {
      setMessageAttachmentBusy(false);
      event.target.value = '';
    }
  };

  const savedRoles = React.useMemo(
    () => roles.filter((role) => savedRoleIds.includes(String(role.id))),
    [roles, savedRoleIds],
  );
  const selectedApplicationSummary = React.useMemo(
    () => candidateApplications.find((application) => application.id === selectedApplicationId) || candidateApplications[0] || null,
    [candidateApplications, selectedApplicationId],
  );
  const effectiveCandidateCapacity = React.useMemo(() => {
    const limit = getCandidateDialogueSlotsLimit(userProfile.subscription?.tier || 'free');
    const active = candidateCapacity?.active ?? candidateApplications.filter((application) => {
      const status = String(application.status || '').toLowerCase();
      return !status.startsWith('closed') && status !== 'withdrawn' && status !== 'rejected';
    }).length;
    return {
      active,
      limit,
      remaining: Math.max(0, limit - active),
    };
  }, [candidateApplications, candidateCapacity?.active, userProfile.subscription?.tier]);

  return (
    <div className={cn(shellPageClass, 'overflow-x-hidden')}>
      <div className={cn(panelClass, 'grid gap-6 p-6 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]')}>
        <div className="min-w-0 space-y-5">
          <div className={pillEyebrowClass}>{t('rebuild.insights.title', { defaultValue: 'Candidate intelligence' })}</div>
          <h1 className="mt-3 text-[3rem] font-semibold leading-[0.95] tracking-[-0.07em] text-slate-900">{t('rebuild.insights.subtitle', { defaultValue: 'Life-aware decision layer.' })}</h1>
          <p className="mt-4 text-base leading-8 text-slate-600">
            {t('rebuild.insights.intro_copy', { defaultValue: 'Here you keep jobs, applications, commute reality, take-home pay, and your work profile together.' })}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <InsightBadge label={t('rebuild.insights.role_snapshots', { defaultValue: 'Role snapshots' })} value={String(snapshots.length)} />
            <InsightBadge label={t('rebuild.insights.active_submissions', { defaultValue: 'Active submissions' })} value={String(candidateApplications.length)} />
            <InsightBadge label={t('rebuild.insights.border_search', { defaultValue: 'Border search' })} value={preferences.borderSearchEnabled ? t('rebuild.insights.enabled', { defaultValue: 'Enabled' }) : t('rebuild.insights.disabled', { defaultValue: 'Disabled' })} />
            <InsightBadge label={t('rebuild.insights.tax_stack', { defaultValue: 'Tax stack' })} value={`${preferences.taxProfile.countryCode} ${preferences.taxProfile.taxYear}`} />
          </div>
          {featuredSnapshot ? (
            <div className="rounded-[24px] border border-[#12AFCB]/12 bg-[#12AFCB]/5 p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0f95ac]">{t('rebuild.insights.best_fit', { defaultValue: 'Best current fit' })}</div>
              <div className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-900">{featuredSnapshot.role.title}</div>
              <div className="mt-2 text-sm text-slate-500">{featuredSnapshot.role.location}</div>
              <p className="mt-4 text-sm leading-7 text-slate-700">{featuredSnapshot.evaluation.summary}</p>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-3 pt-2">
            <button type="button" onClick={() => navigate('/candidate/jcfpm')} className={primaryButtonClass}>{t('rebuild.insights.open_jcfpm', { defaultValue: 'Open JCFPM' })}</button>
            {userProfile.isLoggedIn ? (
              <button type="button" onClick={onSaveProfile} disabled={isSavingProfile} className={cn(secondaryButtonClass, 'disabled:opacity-60')}>
                {isSavingProfile ? <Loader2 size={16} className="animate-spin" /> : null}
                {t('rebuild.save', { defaultValue: 'Save' })}
              </button>
            ) : (
              <button type="button" onClick={onOpenAuth} className={secondaryButtonClass}>{t('rebuild.insights.sign_in_sync', { defaultValue: 'Sign in to sync' })}</button>
            )}
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t('rebuild.insights.submission_lane', { defaultValue: 'Submission lane' })}</div>
            <div className="mt-3 text-sm leading-7 text-slate-600">
              {t('rebuild.insights.capacity_intro', { defaultValue: 'You currently have' })} {effectiveCandidateCapacity.active} {t('rebuild.insights.capacity_active_suffix', { defaultValue: 'active applications.' })} {t('rebuild.insights.capacity_remaining', { defaultValue: 'You can open' })} {effectiveCandidateCapacity.remaining} {t('rebuild.insights.capacity_remaining_suffix', { defaultValue: 'more before hitting the current limit of' })} {effectiveCandidateCapacity.limit}.
            </div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t('rebuild.insights.saved_roles', { defaultValue: 'Saved roles' })}</div>
            <div className="mt-3 text-sm leading-7 text-slate-600">
              {savedRoles.length > 0
                ? `${savedRoles.length} ${t('rebuild.insights.saved_roles_count_suffix', { defaultValue: 'roles are saved on the side.' })}`
                : t('rebuild.insights.no_saved_roles', { defaultValue: 'No roles saved yet. When something interests you, put it aside.' })}
            </div>
          </div>
        </div>
        <div className="min-w-0 space-y-5">
          <div className={cn(panelClass, 'min-w-0 p-6')}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t('rebuild.insights.live_submissions', { defaultValue: 'Live submissions' })}</div>
                <div className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-900">{t('rebuild.insights.live_submissions_title', { defaultValue: 'Applications already in flight.' })}</div>
              </div>
              <button type="button" onClick={() => navigate('/candidate/marketplace')} className={secondaryButtonClass}>{t('rebuild.insights.back_marketplace', { defaultValue: 'Back to marketplace' })}</button>
            </div>
            <div className="mt-5 space-y-3">
              {applicationError ? (
                <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{applicationError}</div>
              ) : null}
              {applicationNotice ? (
                <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{applicationNotice}</div>
              ) : null}
              {applicationsLoading ? (
                <div className="flex items-center gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  <Loader2 size={16} className="animate-spin" />
                  {t('rebuild.insights.loading_submissions', { defaultValue: 'Loading submissions...' })}
                </div>
              ) : null}
              {!applicationsLoading && candidateApplications.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm leading-7 text-slate-500">
                  {t('rebuild.insights.no_live_submissions', { defaultValue: 'No active applications here yet. Once you submit something, you will see the status and next step here.' })}
                </div>
              ) : null}
              {candidateApplications.slice(0, 4).map((application) => {
                const linkedRole = roles.find((role) => String(role.id) === String(application.job_id));
                const statusCopy = getApplicationStatusCopy(application.status);
                return (
                  <div key={application.id} className={cn('rounded-[20px] border p-4', selectedApplicationId === application.id ? 'border-[#12AFCB]/30 bg-[#12AFCB]/6' : 'border-slate-200 bg-slate-50')}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-slate-900">
                            {linkedRole?.title || application.job_snapshot?.title || 'Submitted role'}
                          </div>
                          <span className={cn('rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]', statusCopy.tone)}>
                            {statusCopy.label}
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          {application.company_name || linkedRole?.companyName || 'Company'} · {application.submitted_at ? new Date(application.submitted_at).toLocaleDateString(currentLanguage === 'cs' ? 'cs-CZ' : 'en-GB') : t('rebuild.journey.recently_submitted', { defaultValue: 'Recently submitted' })}
                        </div>
                        <p className="mt-3 text-sm leading-7 text-slate-600">
                          {application.dialogue_deadline_at
                            ? `${t('rebuild.insights.deadline_prefix', { defaultValue: 'Deadline to respond:' })} ${new Date(application.dialogue_deadline_at).toLocaleString(currentLanguage === 'cs' ? 'cs-CZ' : 'en-GB')}.`
                            : t('rebuild.insights.next_step_ready', { defaultValue: 'Everything is ready for the next step.' })}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => onSelectApplication(application.id)} className={secondaryButtonClass}>
                          {t('rebuild.insights.open_detail', { defaultValue: 'Open detail' })}
                        </button>
                        {linkedRole ? (
                          <button type="button" onClick={() => navigate(`/candidate/journey/${linkedRole.id}`)} className={secondaryButtonClass}>
                            {t('rebuild.insights.open_answers', { defaultValue: 'Open answers' })}
                          </button>
                        ) : null}
                        <button type="button" onClick={() => navigate('/candidate/marketplace')} className={secondaryButtonClass}>
                          {t('rebuild.insights.browse_roles', { defaultValue: 'Browse roles' })}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={cn(panelClass, 'min-w-0 p-6')}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t('rebuild.insights.application_detail', { defaultValue: 'Application detail' })}</div>
                <div className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-900">{t('rebuild.insights.application_detail_title', { defaultValue: 'Messages, materials, and what next.' })}</div>
              </div>
              {selectedApplicationSummary ? (
                <span className={cn('rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em]', getApplicationStatusCopy(selectedApplicationSummary.status).tone)}>
                  {getApplicationStatusCopy(selectedApplicationSummary.status).label}
                </span>
              ) : null}
            </div>
            {applicationDetailLoading ? (
              <div className="mt-5 flex items-center gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin" />
                {t('rebuild.insights.loading_application_detail', { defaultValue: 'Loading application detail and messages...' })}
              </div>
            ) : null}
            {!applicationDetailLoading && !selectedApplicationSummary ? (
              <div className="mt-5 rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm leading-7 text-slate-500">
                {t('rebuild.insights.pick_submission', { defaultValue: 'Select an application above to see what is happening around it.' })}
              </div>
            ) : null}
            {!applicationDetailLoading && selectedApplicationSummary ? (
              <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
                <div className="min-w-0 space-y-4">
                  <div className="min-w-0 rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">
                      {selectedApplicationDetail?.job_snapshot?.title || roles.find((role) => String(role.id) === String(selectedApplicationSummary.job_id))?.title || t('rebuild.insights.submitted_role', { defaultValue: 'Submitted role' })}
                    </div>
                    <div className="mt-2 break-words text-xs text-slate-500">
                      {selectedApplicationDetail?.company_name || selectedApplicationSummary.company_name || t('rebuild.insights.company_fallback', { defaultValue: 'Company' })} · {selectedApplicationSummary.submitted_at ? new Date(selectedApplicationSummary.submitted_at).toLocaleString(currentLanguage === 'cs' ? 'cs-CZ' : 'en-GB') : t('rebuild.insights.recently_submitted', { defaultValue: 'Recently submitted' })}
                    </div>
                    {selectedApplicationDetail?.cover_letter ? (
                      <p className="mt-4 text-sm leading-7 text-slate-600">{selectedApplicationDetail.cover_letter}</p>
                    ) : (
                      <p className="mt-4 text-sm leading-7 text-slate-500">{t('rebuild.insights.no_cover_letter', { defaultValue: 'No additional text is saved for this application.' })}</p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedApplicationDetail?.cv_snapshot?.originalName ? (
                        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
                          CV: {selectedApplicationDetail.cv_snapshot.originalName}
                        </span>
                      ) : null}
                      {selectedApplicationDetail?.candidate_profile_snapshot?.jobTitle ? (
                        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
                          {selectedApplicationDetail.candidate_profile_snapshot.jobTitle}
                        </span>
                      ) : null}
                      {(selectedApplicationDetail?.candidate_profile_snapshot?.skills || []).slice(0, 4).map((skill) => (
                        <span key={skill} className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700">{skill}</span>
                      ))}
                    </div>
                  </div>
                  <SharedJcfpmCard payload={selectedApplicationDetail?.shared_jcfpm_payload || null} />
                  <div className="min-w-0 rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">{t('rebuild.insights.messages_title', { defaultValue: 'Application messages' })}</div>
                    <div className="mt-4">
                      <ThreadMetaStrip detail={selectedApplicationDetail} />
                    </div>
                    <div className="mt-4 space-y-3">
                      {selectedApplicationMessages.length === 0 ? (
                        <div className="rounded-[16px] border border-dashed border-slate-200 bg-white px-4 py-4 text-sm leading-7 text-slate-500">
                          {t('rebuild.insights.no_messages', { defaultValue: 'No messages here yet. Feel free to write first.' })}
                        </div>
                      ) : null}
                      {selectedApplicationMessages.slice(-6).map((message) => (
                        <div key={message.id} className={cn('rounded-[18px] px-4 py-3 text-sm leading-7', message.sender_role === 'candidate' ? 'bg-[linear-gradient(145deg,#103d46,#2a78a0)] text-white' : 'bg-white text-slate-700')}>
                         <div className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">
                            {message.sender_role === 'candidate' ? t('rebuild.insights.you', { defaultValue: 'You' }) : t('rebuild.insights.recruiter_sender', { defaultValue: 'Company' })} · {new Date(message.created_at).toLocaleString(currentLanguage === 'cs' ? 'cs-CZ' : 'en-GB')}
                          </div>
                          <div className="mt-2">{message.body || t('rebuild.insights.attachment_only_message', { defaultValue: 'Message contains an attachment only.' })}</div>
                          {message.attachments.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {message.attachments.map((attachment, index) => (
                                <AttachmentChip
                                  key={`${message.id}-${attachment.id || attachment.url || index}`}
                                  attachment={attachment}
                                  inverted={message.sender_role === 'candidate'}
                                />
                              ))}
                            </div>
                          ) : null}
                          {message.attachments.length > 0 ? (
                            <div className="mt-3 space-y-3">
                              {message.attachments.map((attachment, index) => (
                                <AttachmentPreview
                                  key={`preview-${message.id}-${attachment.id || attachment.url || index}`}
                                  attachment={attachment}
                                />
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <input
                      ref={messageAttachmentInputRef}
                      type="file"
                      onChange={(event) => void handleMessageAttachmentInput(event)}
                      className="hidden"
                    />
                    <textarea
                      value={messageDraft}
                      onChange={(event) => setMessageDraft(event.target.value)}
                      rows={4}
                      placeholder={t('rebuild.insights.message_placeholder', { defaultValue: 'Write a short and factual message...' })}
                      className={cn(textareaClass, 'mt-4 bg-white')}
                    />
                    {messageAttachments.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {messageAttachments.map((attachment, index) => (
                          <button
                            key={`${attachment.id || attachment.url || index}`}
                            type="button"
                            onClick={() => setMessageAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                            className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"
                          >
                            {formatAttachmentType(attachment)} · {attachment.name || attachment.filename || 'Attachment'} ×
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-4 flex flex-wrap justify-between gap-3">
                      <button
                        type="button"
                        disabled={applicationWithdrawBusy || !selectedApplicationSummary || selectedApplicationSummary.status === 'withdrawn' || selectedApplicationSummary.status === 'closed_withdrawn'}
                        onClick={() => {
                          setApplicationError('');
                          setApplicationNotice('');
                          void onWithdrawApplication()
                            .then(() => {
                              setApplicationNotice(t('rebuild.insights.withdrawn_notice', { defaultValue: 'Application withdrawn.' }));
                            })
                            .catch((error) => {
                              setApplicationError(error instanceof Error ? error.message : t('rebuild.insights.withdraw_failed', { defaultValue: 'Failed to withdraw application.' }));
                            });
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                      >
                        {t('rebuild.insights.withdraw_application', { defaultValue: 'Withdraw application' })}
                      </button>
                      <button
                        type="button"
                        onClick={() => messageAttachmentInputRef.current?.click()}
                        disabled={messageAttachmentBusy}
                        className={cn(secondaryButtonClass, 'disabled:opacity-60')}
                      >
                        {messageAttachmentBusy ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
                        {t('rebuild.insights.attach_file', { defaultValue: 'Attach file' })}
                      </button>
                      <button
                        type="button"
                        disabled={applicationMessageBusy || (!messageDraft.trim() && messageAttachments.length === 0)}
                        onClick={() => {
                          setApplicationError('');
                          setApplicationNotice('');
                          void onSendApplicationMessage(messageDraft.trim(), messageAttachments)
                            .then(() => {
                              setMessageDraft('');
                              setMessageAttachments([]);
                              setApplicationNotice(t('rebuild.insights.message_sent', { defaultValue: 'Message sent.' }));
                            })
                            .catch((error) => {
                              setApplicationError(error instanceof Error ? error.message : t('rebuild.insights.message_failed', { defaultValue: 'Failed to send message.' }));
                            });
                        }}
                        className={cn(primaryButtonClass, 'disabled:opacity-60')}
                      >
                        {applicationMessageBusy ? <Loader2 size={16} className="animate-spin" /> : null}
                        {t('rebuild.insights.send_message', { defaultValue: 'Send message' })}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="min-w-0 space-y-4">
                  <div className="min-w-0 rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">{t('rebuild.insights.submission_packet', { defaultValue: 'Submission packet' })}</div>
                    <div className="mt-4 space-y-3 break-words text-sm leading-7 text-slate-600">
                      <div><strong>{t('rebuild.experience.candidate_label', { defaultValue: 'Candidate' })}:</strong> {selectedApplicationDetail?.candidate_profile_snapshot?.name || userProfile.name || userProfile.email || 'Candidate'}</div>
                      <div><strong>{t('rebuild.experience.email_label', { defaultValue: 'E-mail' })}:</strong> {selectedApplicationDetail?.candidate_profile_snapshot?.email || userProfile.email || 'Not available'}</div>
                      <div><strong>{t('rebuild.experience.phone_label', { defaultValue: 'Telefon' })}:</strong> {selectedApplicationDetail?.candidate_profile_snapshot?.phone || userProfile.phone || 'Not available'}</div>
                      <div><strong>{t('rebuild.experience.linkedin_label', { defaultValue: 'LinkedIn' })}:</strong> {selectedApplicationDetail?.candidate_profile_snapshot?.linkedin || preferences.linkedInUrl || 'Not shared'}</div>
                    </div>
                  </div>
                  <div className="min-w-0 rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">{t('rebuild.insights.saved_roles_nearby', { defaultValue: 'Saved roles nearby' })}</div>
                    <div className="mt-4 space-y-3">
                      {savedRoles.slice(0, 4).map((role) => (
                        <div key={role.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-white px-4 py-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{role.title}</div>
                            <div className="text-xs text-slate-500">{role.companyName || role.team} · {role.location}</div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => navigate(role.source === 'curated' ? `/candidate/role/${role.id}` : `/candidate/imported/${role.id}`)} className={secondaryButtonClass}>
                              {t('rebuild.insights.open', { defaultValue: 'Open' })}
                            </button>
                            <button type="button" onClick={() => onToggleSavedRole(role.id)} className={secondaryButtonClass}>
                              {t('rebuild.insights.unsave', { defaultValue: 'Remove' })}
                            </button>
                          </div>
                        </div>
                      ))}
                      {savedRoles.length === 0 ? (
                        <div className="rounded-[16px] border border-dashed border-slate-200 bg-white px-4 py-4 text-sm leading-7 text-slate-500">
                          {t('rebuild.insights.saved_roles_hint', { defaultValue: 'Saved roles will appear here.' })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className={cn(panelClass, 'p-6')}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Identity</div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-600">
                  Profile Photo
                  <div className="mt-2 flex items-center gap-4">
                    {userProfile.photo ? (
                      <img 
                        src={userProfile.photo} 
                        alt="Profile" 
                        className="h-16 w-16 rounded-full object-cover border-2 border-slate-200"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-slate-200 flex items-center justify-center">
                        <User size={24} className="text-slate-400" />
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(event) => void handlePhotoInput(event)}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        disabled={photoUploading}
                        className={cn(primaryButtonClass, 'disabled:opacity-60 text-sm px-4 py-2')}
                      >
                        {photoUploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                        {photoUploading ? 'Uploading...' : 'Upload Photo'}
                      </button>
                      {photoError && (
                        <div className="text-sm text-red-600">{photoError}</div>
                      )}
                    </div>
                  </div>
                </label>
              </div>
              <label className="block text-sm font-medium text-slate-600">
                Legal name
                <input
                  value={preferences.legalName}
                  onChange={(event) => setPreferences((current) => ({ ...current, legalName: event.target.value, name: event.target.value || current.name }))}
                  className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#255DAB]"
                />
              </label>
              <label className="block text-sm font-medium text-slate-600">
                Preferred alias
                <input
                  value={preferences.preferredAlias}
                  onChange={(event) => setPreferences((current) => ({ ...current, preferredAlias: event.target.value }))}
                  className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#255DAB]"
                />
              </label>
              <label className="block text-sm font-medium text-slate-600">
                LinkedIn
                <input
                  value={preferences.linkedInUrl}
                  onChange={(event) => setPreferences((current) => ({ ...current, linkedInUrl: event.target.value }))}
                  className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#255DAB]"
                />
              </label>
              <label className="block text-sm font-medium text-slate-600">
                Portfolio
                <input
                  value={preferences.portfolioUrl}
                  onChange={(event) => setPreferences((current) => ({ ...current, portfolioUrl: event.target.value }))}
                  className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#255DAB]"
                />
              </label>
              <label className="block text-sm font-medium text-slate-600 md:col-span-2">
                Candidate address
                <input
                  value={preferences.address}
                  onChange={(event) => {
                    const nextAddress = event.target.value;
                    const nextCoordinates = resolveDemoCoordinates(nextAddress);
                    const detectedCountry = resolveCountryFromAddress(nextAddress);
                    setPreferences((current) => ({
                      ...current,
                      address: nextAddress,
                      coordinates: nextCoordinates || current.coordinates,
                      taxProfile: {
                        ...current.taxProfile,
                        countryCode: (detectedCountry as any) || current.taxProfile.countryCode,
                      }
                    }));
                  }}
                  className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#255DAB]"
                />
              </label>
              <label className="block text-sm font-medium text-slate-600 md:col-span-2">
                <div className="flex items-center justify-between">
                  <span>{t('rebuild.experience.story_tab', { defaultValue: 'Story' })}</span>
                  <button
                    type="button"
                    onClick={() => setIsLifeStoryOpen(true)}
                    className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#12AFCB] hover:text-[#0f95ac] transition"
                  >
                    <Sparkles size={12} />
                    {t('rebuild.insights.ai_story_guide', { defaultValue: 'AI Story Guide' })}
                  </button>
                </div>
                <textarea
                  value={preferences.story}
                  onChange={(event) => setPreferences((current) => ({ ...current, story: event.target.value }))}
                  rows={4}
                  className="mt-2 w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 outline-none transition focus:border-[#255DAB]"
                />
              </label>
            </div>
          </div>

          <div className={cn(panelClass, 'p-6')}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t('rebuild.insights.cv_proof', { defaultValue: 'CV & proof layer' })}</div>
                <div className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-900">{t('rebuild.insights.keep_cv_active', { defaultValue: 'Keep your active CV in your profile.' })}</div>
              </div>
              {userProfile.isLoggedIn ? (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(event) => void handleCvInput(event)}
                    className="hidden"
                  />
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={cvBusy} className={cn(primaryButtonClass, 'disabled:opacity-60')}>
                    {cvBusy ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
                    {t('rebuild.insights.upload_cv', { defaultValue: 'Upload CV' })}
                  </button>
                </>
              ) : (
                <button type="button" onClick={onOpenAuth} className={secondaryButtonClass}>{t('rebuild.insights.sign_in_upload_cv', { defaultValue: 'Sign in to upload CV' })}</button>
              )}
            </div>
            {cvError ? <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{cvError}</div> : null}
            {cvNotice ? <div className="mt-4 rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{cvNotice}</div> : null}
            {userProfile.cvUrl ? (
              <div className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">{t('rebuild.insights.active_cv', { defaultValue: 'Active CV on profile' })}</div>
                <div className="mt-2 text-sm text-slate-500">{userProfile.cvUrl.split('/').pop() || userProfile.cvUrl}</div>
                <a href={userProfile.cvUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-semibold text-[#255DAB]">
                  {t('rebuild.insights.open_current_cv', { defaultValue: 'Open current CV' })}
                </a>
              </div>
            ) : null}
            <div className="mt-5 space-y-3">
              {cvLoading ? (
                <div className="flex items-center gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  <Loader2 size={16} className="animate-spin" />
                  {t('rebuild.insights.loading_cv_documents', { defaultValue: 'Loading CV documents...' })}
                </div>
              ) : null}
              {!cvLoading && cvDocuments.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm leading-7 text-slate-500">
                  {t('rebuild.insights.no_cv_documents', { defaultValue: 'No CV uploaded yet. Upload a PDF or DOCX and select an active document for applications.' })}
                </div>
              ) : null}
              {cvDocuments.map((document) => (
                <div key={document.id} className="rounded-[20px] border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-slate-900">{document.originalName}</div>
                        {document.isActive ? (
                          <span className="rounded-full bg-[#255DAB]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#255DAB]">{t('rebuild.insights.active_badge', { defaultValue: 'Active' })}</span>
                        ) : null}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        Uploaded {new Date(document.uploadedAt).toLocaleDateString(currentLanguage === 'cs' ? 'cs-CZ' : 'en-GB')} · {(document.fileSize / (1024 * 1024)).toFixed(1)} MB
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a href={document.fileUrl} target="_blank" rel="noreferrer" className={secondaryButtonClass}>{t('rebuild.insights.open', { defaultValue: 'Open' })}</a>
                      {!document.isActive ? (
                        <button type="button" disabled={cvBusy} onClick={() => { setCvError(''); setCvNotice(''); void onSelectCv(document.id).then(() => setCvNotice(`${document.originalName} is now the active CV.`)).catch((error) => setCvError(error instanceof Error ? error.message : 'Failed to select CV.')); }} className={secondaryButtonClass}>
                          {t('rebuild.insights.use_this_cv', { defaultValue: 'Use this CV' })}
                        </button>
                      ) : null}
                      <button type="button" disabled={cvBusy} onClick={() => { setCvError(''); setCvNotice(''); void onDeleteCv(document.id).then(() => setCvNotice(`${document.originalName} removed.`)).catch((error) => setCvError(error instanceof Error ? error.message : 'Failed to delete CV.')); }} className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60">
                        {t('rebuild.insights.delete', { defaultValue: 'Delete' })}
                      </button>
                    </div>
                  </div>
                  {document.parsedData?.cvAiText || document.parsedData?.cvText ? (
                    <p className="mt-4 text-sm leading-7 text-slate-600">
                      {(document.parsedData?.cvAiText || document.parsedData?.cvText || '').slice(0, 240)}
                      {(document.parsedData?.cvAiText || document.parsedData?.cvText || '').length > 240 ? '…' : ''}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
            {activeCvDocument ? (
              <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 p-5">
                <div className="text-sm font-semibold text-slate-900">{t('rebuild.insights.parsed_cv_review', { defaultValue: 'Parsed CV review' })}</div>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  This is the structured candidate packet that now follows into journey submission and recruiter interpretation.
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-600">
                    Interpreted headline
                    <input
                      value={cvReview.jobTitle}
                      onChange={(event) => setCvReview((current) => ({ ...current, jobTitle: event.target.value }))}
                      className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#255DAB]"
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-600">
                    Key skills
                    <input
                      value={cvReview.skillsCsv}
                      onChange={(event) => setCvReview((current) => ({ ...current, skillsCsv: event.target.value }))}
                      placeholder="Rust, distributed systems, leadership"
                      className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#255DAB]"
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-600 md:col-span-2">
                    Candidate summary
                    <textarea
                      value={cvReview.summary}
                      onChange={(event) => setCvReview((current) => ({ ...current, summary: event.target.value }))}
                      rows={5}
                      className="mt-2 w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm leading-7 outline-none transition focus:border-[#255DAB]"
                    />
                  </label>
                </div>
                <div className="mt-4 flex justify-end">
                  <button type="button" disabled={cvReviewBusy} onClick={() => void saveCvReview()} className={cn(secondaryButtonClass, 'disabled:opacity-60')}>
                    {cvReviewBusy ? <Loader2 size={16} className="animate-spin" /> : null}
                    {t('rebuild.insights.save_cv', { defaultValue: 'Save CV review' })}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <div className={cn(panelClass, 'p-6')}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t('rebuild.insights.commute_reality', { defaultValue: 'Commute reality' })}</div>
              <div className="mt-5 space-y-4">
                <label className="block text-sm font-medium text-slate-600">
                  {t('rebuild.insights.transport', { defaultValue: 'Transport mode' })}
                  <select
                    value={preferences.transportMode}
                    onChange={(event) => setPreferences((current) => ({ ...current, transportMode: event.target.value as CandidatePreferenceProfile['transportMode'] }))}
                    className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#255DAB]"
                  >
                    <option value="public">{t('rebuild.transport.public', { defaultValue: 'Public transport' })}</option>
                    <option value="car">{t('rebuild.transport.car', { defaultValue: 'Car' })}</option>
                    <option value="bike">{t('rebuild.transport.bike', { defaultValue: 'Bike' })}</option>
                    <option value="walk">{t('rebuild.transport.walk', { defaultValue: 'Walk' })}</option>
                  </select>
                </label>
                <label className="flex items-center gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={preferences.commuteFilterEnabled}
                    onChange={(event) => setPreferences((current) => ({ ...current, commuteFilterEnabled: event.target.checked }))}
                  />
                  Apply commute tolerance to discovery and JHI
                </label>
                <label className="block text-sm font-medium text-slate-600">
                  One-way tolerance
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="range"
                      min={15}
                      max={240}
                      step={5}
                      value={preferences.commuteToleranceMinutes}
                      onChange={(event) => setPreferences((current) => ({ ...current, commuteToleranceMinutes: Number(event.target.value) }))}
                      className="flex-1 accent-[#255DAB]"
                    />
                    <span className="min-w-[4rem] rounded-full bg-slate-100 px-3 py-1.5 text-center text-sm font-semibold text-slate-700">{preferences.commuteToleranceMinutes} min</span>
                  </div>
                </label>
                <label className="block text-sm font-medium text-slate-600">
                  Search radius
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="range"
                      min={10}
                      max={260}
                      step={5}
                      value={preferences.searchRadiusKm}
                      onChange={(event) => setPreferences((current) => ({ ...current, searchRadiusKm: Number(event.target.value) }))}
                      className="flex-1 accent-[#255DAB]"
                    />
                    <span className="min-w-[4rem] rounded-full bg-slate-100 px-3 py-1.5 text-center text-sm font-semibold text-slate-700">{preferences.searchRadiusKm} km</span>
                  </div>
                </label>
                <label className="flex items-center gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={preferences.borderSearchEnabled}
                    onChange={(event) => setPreferences((current) => ({ ...current, borderSearchEnabled: event.target.checked }))}
                  />
                  Search in border corridors
                </label>
              </div>
            </div>

            <div className={cn(panelClass, 'p-6')}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t('rebuild.insights.tax_profile', { defaultValue: 'Tax profile' })}</div>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                CZ, SK and PL currently use the real shared tax engine levers here: employee vs contractor, marital status, spouse income, children and single-parent reliefs.
              </p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-medium text-slate-600">
                  {t('rebuild.tax.country', { defaultValue: 'Country' })}
                  <select
                    value={preferences.taxProfile.countryCode}
                    onChange={(event) => handleTaxCountryChange(event.target.value as CandidatePreferenceProfile['taxProfile']['countryCode'])}
                    className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#255DAB]"
                  >
                    <option value="CZ">{t('rebuild.country.cz', { defaultValue: 'Czechia' })}</option>
                    <option value="SK">{t('rebuild.country.sk', { defaultValue: 'Slovakia' })}</option>
                    <option value="PL">{t('rebuild.country.pl', { defaultValue: 'Poland' })}</option>
                    <option value="DE">{t('rebuild.country.de', { defaultValue: 'Germany' })}</option>
                    <option value="AT">{t('rebuild.country.at', { defaultValue: 'Austria' })}</option>
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-600">
                  {t('rebuild.tax.tax_year', { defaultValue: 'Tax year' })}
                  <input
                    type="number"
                    min={2024}
                    max={2030}
                    value={preferences.taxProfile.taxYear}
                    onChange={(event) => updateTaxProfile((taxProfile) => ({ ...taxProfile, taxYear: Number(event.target.value) || taxProfile.taxYear }))}
                    className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#255DAB]"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-600">
                  {t('rebuild.tax.employment_type', { defaultValue: 'Employment type' })}
                  <select
                    value={preferences.taxProfile.employmentType}
                    onChange={(event) => updateTaxProfile((taxProfile) => ({ ...taxProfile, employmentType: event.target.value as CandidatePreferenceProfile['taxProfile']['employmentType'] }))}
                    className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#255DAB]"
                  >
                    <option value="employee">{t('rebuild.tax.employee', { defaultValue: 'Employee' })}</option>
                    <option value="contractor">{t('rebuild.tax.contractor', { defaultValue: 'Contractor / ICO' })}</option>
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-600">
                  {t('rebuild.tax.marital_status', { defaultValue: 'Marital status' })}
                  <select
                    value={preferences.taxProfile.maritalStatus}
                    onChange={(event) => updateTaxProfile((taxProfile) => ({ ...taxProfile, maritalStatus: event.target.value as CandidatePreferenceProfile['taxProfile']['maritalStatus'] }))}
                    className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#255DAB]"
                  >
                    <option value="single">{t('rebuild.tax.single', { defaultValue: 'Single' })}</option>
                    <option value="married">{t('rebuild.tax.married', { defaultValue: 'Married' })}</option>
                  </select>
                </label>
                {preferences.taxProfile.maritalStatus === 'married' ? (
                  <label className="block text-sm font-medium text-slate-600 md:col-span-2">
                    {t('rebuild.tax.spouse_income', { defaultValue: 'Spouse annual income' })}
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={preferences.taxProfile.spouseAnnualIncome || 0}
                      onChange={(event) => updateTaxProfile((taxProfile) => ({ ...taxProfile, spouseAnnualIncome: Number(event.target.value) || 0 }))}
                      className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#255DAB]"
                    />
                  </label>
                ) : null}
                <label className="block text-sm font-medium text-slate-600">
                  {t('rebuild.tax.children', { defaultValue: 'Children count' })}
                  <input
                    type="number"
                    min={0}
                    max={12}
                    value={preferences.taxProfile.childrenCount}
                    onChange={(event) => updateTaxProfile((taxProfile) => ({ ...taxProfile, childrenCount: Math.max(0, Number(event.target.value) || 0) }))}
                    className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#255DAB]"
                  />
                </label>
                <label className="flex items-center gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(preferences.taxProfile.isSingleParent)}
                    onChange={(event) => updateTaxProfile((taxProfile) => ({ ...taxProfile, isSingleParent: event.target.checked }))}
                  />
                  {t('rebuild.tax.single_parent', { defaultValue: 'Single parent relief' })}
                </label>
                <label className="block text-sm font-medium text-slate-600 md:col-span-2">
                  Special reliefs
                  <input
                    value={(preferences.taxProfile.specialReliefs || []).join(', ')}
                    onChange={(event) => updateTaxProfile((taxProfile) => ({
                      ...taxProfile,
                      specialReliefs: event.target.value.split(',').map((item) => item.trim()).filter(Boolean),
                    }))}
                    placeholder="e.g. disability, student, mortgage"
                    className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#255DAB]"
                  />
                </label>
                {preferences.taxProfile.countryCode === 'DE' ? (
                  <>
                    <label className="block text-sm font-medium text-slate-600">
                      German tax class
                      <select
                        value={preferences.taxProfile.deTaxClass || 'I'}
                        onChange={(event) => updateTaxProfile((taxProfile) => ({ ...taxProfile, deTaxClass: event.target.value as NonNullable<typeof taxProfile.deTaxClass> }))}
                        className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#255DAB]"
                      >
                        {['I', 'II', 'III', 'IV', 'V', 'VI'].map((taxClass) => <option key={taxClass} value={taxClass}>{taxClass}</option>)}
                      </select>
                    </label>
                    <label className="block text-sm font-medium text-slate-600">
                      Church tax
                      <select
                        value={String(preferences.taxProfile.deChurchTaxRate || 0)}
                        onChange={(event) => updateTaxProfile((taxProfile) => ({ ...taxProfile, deChurchTaxRate: Number(event.target.value) }))}
                        className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#255DAB]"
                      >
                        <option value="0">{t('rebuild.experience.no_church_tax', { defaultValue: 'No church tax' })}</option>
                        <option value="0.08">8%</option>
                        <option value="0.09">9%</option>
                      </select>
                    </label>
                    <label className="block text-sm font-medium text-slate-600 md:col-span-2">
                      Zusatzbeitrag health rate
                      <input
                        type="number"
                        min={0}
                        max={5}
                        step={0.1}
                        value={preferences.taxProfile.deKvzRate || 2.9}
                        onChange={(event) => updateTaxProfile((taxProfile) => ({ ...taxProfile, deKvzRate: Number(event.target.value) || 0 }))}
                        className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#255DAB]"
                      />
                    </label>
                  </>
                ) : null}
                {preferences.taxProfile.countryCode === 'AT' ? (
                  <label className="flex items-center gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 md:col-span-2">
                    <input
                      type="checkbox"
                      checked={Boolean(preferences.taxProfile.atHas13th14th)}
                      onChange={(event) => updateTaxProfile((taxProfile) => ({ ...taxProfile, atHas13th14th: event.target.checked }))}
                    />
                    Include standard 13th and 14th salary
                  </label>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="text-sm font-medium text-slate-600">{t('rebuild.insights.role_evaluation_snapshots', { defaultValue: 'Role evaluation snapshots' })}</div>
            {snapshots.map(({ role, evaluation }) => (
              <div key={role.id} className={cn(panelClass, 'grid gap-4 p-5 lg:grid-cols-[1fr_280px]')}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{role.source}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{role.workModel}</span>
                  </div>
                  <h3 className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-slate-900">{role.title}</h3>
                  <div className="mt-2 text-sm text-slate-500">{role.location}</div>
                  <p className="mt-4 text-sm leading-7 text-slate-600">{evaluation.summary}</p>
                </div>
                <div className="grid gap-3">
                  <InsightBadge label="JHI" value={`${Math.round(evaluation.jhi.personalizedScore)}/100`} />
                  <InsightBadge label="Take-home" value={`${evaluation.takeHomeMonthly.toLocaleString(currentLanguage === 'cs' ? 'cs-CZ' : 'en-GB')} ${role.currency}`} />
                  <InsightBadge label="Commute" value={`${evaluation.commuteMinutesOneWay} min`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <LifeStoryWizard
        isOpen={isLifeStoryOpen}
        onClose={() => setIsLifeStoryOpen(false)}
        onComplete={(summary) => setPreferences((current) => ({ ...current, story: summary }))}
      />
    </div>
  );
};
