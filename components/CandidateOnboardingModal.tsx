import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, Loader2, MapPin, Sparkles, Target, TimerReset } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type {
  CandidateDomainKey,
  CandidateOnboardingIntent,
  CandidateOnboardingProfileNudgeKey,
  CandidateOnboardingScenarioId,
  CandidateOnboardingSessionV2,
  CandidateSeniority,
  Job,
  SearchLanguageCode,
  UserProfile,
} from '../types';
import { getCandidateIntentDomainLabel, getCandidateIntentDomainOptions } from '../services/candidateIntentService';
import { resolveAddressToCoordinates } from '../services/commuteService';
import { markFirstQualityAction } from '../services/candidateActivationService';
import { createDefaultCandidateSearchProfile } from '../services/profileDefaults';
import {
  createDefaultCandidateOnboardingSession,
  getPreviousCandidateOnboardingStep,
  sanitizeCandidateOnboardingSession,
} from '../services/candidateOnboardingState';
import {
  buildFallbackCandidateOnboardingEvaluation,
  evaluateCandidateOnboardingAnswer,
} from '../services/candidateOnboardingService';
import { trackAnalyticsEvent } from '../services/supabaseService';
import ChallengeComposer from './challenges/ChallengeComposer';
import { FilterChip, SurfaceCard, cn } from './ui/primitives';
import { getTaskFirstOnboardingCopy } from './candidate-onboarding/taskFirstOnboardingCopy';

interface CandidateOnboardingModalProps {
  isOpen: boolean;
  profile: UserProfile;
  jobs?: Job[];
  onClose: () => void;
  onComplete: () => void;
  onGoToProfile?: () => void;
  onUpdateProfile: (p: UserProfile, persist?: boolean) => void | Promise<void>;
  onOpenPremium: (featureLabel: string) => void;
  onRefreshProfile?: () => Promise<void>;
  initialStep?: 'entry' | 'location' | 'preferences' | 'cv' | 'done';
  onStepViewed?: (step: string) => void;
  onStepCompleted?: (step: string) => void;
}

const MIN_ANSWER_LENGTH = 80;
const MIN_SUPPORTING_TEXT_LENGTH = 180;
const SUPPORTED_LANGUAGE_CODES: SearchLanguageCode[] = ['cs', 'sk', 'en', 'de', 'pl'];
const ONBOARDING_INTENTS: CandidateOnboardingIntent[] = ['explore_options', 'compare_offers', 'try_real_work'];

const hashString = (value: string): number =>
  Array.from(value).reduce((accumulator, char) => ((accumulator << 5) - accumulator) + char.charCodeAt(0), 0);

const shorten = (value: string | null | undefined, maxLength = 120): string => {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
};

const formatNumberLabel = (value: number, locale: string): string =>
  new Intl.NumberFormat(locale).format(Math.max(0, value));

const normalizeLocale = (value: string): string => {
  const base = String(value || 'en').split('-')[0].toLowerCase();
  if (base === 'at') return 'at';
  if (['cs', 'sk', 'en', 'de', 'pl'].includes(base)) return base;
  return 'en';
};

const getSessionStorageKey = (profile: UserProfile): string =>
  `jobshaman:candidate-onboarding:v2:${profile.id || 'guest'}`;

const normalizeJobLanguage = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const base = String(value).split('-')[0].toLowerCase();
  if (base === 'at') return 'de';
  return base || null;
};

const localeMatchesJob = (jobLanguage: string | null | undefined, locale: string): boolean => {
  const normalizedJobLanguage = normalizeJobLanguage(jobLanguage);
  if (!normalizedJobLanguage) return true;
  if (locale === 'at') return normalizedJobLanguage === 'de';
  if (locale === 'cs') return normalizedJobLanguage === 'cs' || normalizedJobLanguage === 'sk';
  if (locale === 'sk') return normalizedJobLanguage === 'sk' || normalizedJobLanguage === 'cs';
  return normalizedJobLanguage === locale;
};

const buildTaskCards = (jobs: Job[], locale: string) => {
  const taskReadyJobs = jobs.filter((job) => {
    const hasIdentity = String(job.title || '').trim() && String(job.company || '').trim();
    const hasTaskSignal = Boolean(
      String(job.challenge || '').trim()
      || String(job.firstStepPrompt || '').trim()
      || job.listingKind === 'challenge'
      || job.challenge_format === 'micro_job'
    );
    return hasIdentity && hasTaskSignal && localeMatchesJob(job.language_code, locale);
  });

  const sorted = [...taskReadyJobs]
    .sort((left, right) => {
      const leftNative = left.listingKind === 'challenge' || (left.listingKind !== 'imported' && left.company_id);
      const rightNative = right.listingKind === 'challenge' || (right.listingKind !== 'imported' && right.company_id);
      if (leftNative !== rightNative) return rightNative ? 1 : -1;

      const leftMicro = left.challenge_format === 'micro_job';
      const rightMicro = right.challenge_format === 'micro_job';
      if (leftMicro !== rightMicro) return rightMicro ? 1 : -1;

      const rightScore = Number(right.priorityScore ?? right.aiMatchScore ?? right.searchScore ?? right.jhi?.score ?? 0);
      const leftScore = Number(left.priorityScore ?? left.aiMatchScore ?? left.searchScore ?? left.jhi?.score ?? 0);
      return rightScore - leftScore;
    })
    .slice(0, 2);

  const cards = sorted.map((job) => {
    const slotsTaken = Math.max(0, Number(job.open_dialogues_count || 0));
    const slotsTotal = Math.max(slotsTaken + 2, Number(job.dialogue_capacity_limit || 5));
    const timeLabel = String(job.micro_job_time_estimate || '').trim()
      || (Number(job.reaction_window_days || 0) > 0 ? `${job.reaction_window_days}d window` : 'Short response');
    const rewardLabel = String(job.salaryRange || '').trim()
      || (Number(job.salary_from || 0) > 0
        ? `${formatNumberLabel(Number(job.salary_from || 0), locale)} ${(job as any).salary_currency || 'CZK'}+`
        : 'Reward shared in task');

    return {
      id: `task:${job.id}`,
      job_id: job.id,
      company: job.company,
      title: job.title,
      problem: shorten(job.challenge || job.firstStepPrompt || job.aiAnalysis?.summary || job.description, 110),
      time_label: timeLabel,
      reward_label: rewardLabel,
      slots_total: slotsTotal,
      slots_taken: slotsTaken,
      dialogue_window_label: Number(job.reaction_window_hours || 0) > 0
        ? `${job.reaction_window_hours}h`
        : Number(job.reaction_window_days || 0) > 0
          ? `${job.reaction_window_days}d`
          : null,
    };
  });

  const byId = new Map(sorted.map((job) => [job.id, job]));
  return { cards, byId };
};

const resolveMissingProfileSteps = (profile: UserProfile): CandidateOnboardingProfileNudgeKey[] => {
  const missing: CandidateOnboardingProfileNudgeKey[] = [];
  if (!profile.address && !profile.coordinates) {
    missing.push('location');
  }
  if (!Array.isArray(profile.skills) || profile.skills.map((item) => String(item || '').trim()).filter(Boolean).length < 3) {
    missing.push('skills');
  }
  const desiredRole = String(profile.preferences?.desired_role || profile.jobTitle || '').trim();
  const hasSalary = Number.isFinite(Number(profile.preferences?.desired_salary_min))
    || Number.isFinite(Number(profile.preferences?.desired_salary_max));
  const searchProfile = profile.preferences?.searchProfile;
  const hasPrimaryDomain = Boolean(searchProfile?.primaryDomain);
  const hasWorkArrangement = searchProfile?.preferredWorkArrangement === 'remote'
    || searchProfile?.preferredWorkArrangement === 'hybrid'
    || searchProfile?.preferredWorkArrangement === 'onsite';
  const hasLanguageSetup = Array.isArray(searchProfile?.remoteLanguageCodes)
    && searchProfile.remoteLanguageCodes.map((item) => String(item || '').trim()).filter(Boolean).length > 0;
  if (!desiredRole || !hasPrimaryDomain || !hasSalary || !hasWorkArrangement || !hasLanguageSetup) {
    missing.push('preferences');
  }
  const supportingContext = String(profile.cvText || profile.cvAiText || '').trim();
  if (supportingContext.length < MIN_SUPPORTING_TEXT_LENGTH && !String(profile.cvUrl || '').trim()) {
    missing.push('supporting_context');
  }
  return missing;
};

const updateSessionStorage = (key: string, session: CandidateOnboardingSessionV2) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(session));
  } catch (error) {
    console.warn('Failed to persist candidate onboarding session:', error);
  }
};

const readSessionStorage = (key: string): CandidateOnboardingSessionV2 | null => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return sanitizeCandidateOnboardingSession(JSON.parse(raw));
  } catch (error) {
    console.warn('Failed to read candidate onboarding session:', error);
    return null;
  }
};

const clearSessionStorage = (key: string) => {
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn('Failed to clear candidate onboarding session:', error);
  }
};

const splitHumanSignalList = (value: string): string[] =>
  String(value || '')
    .split(/[\n,.;]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3)
    .slice(0, 6);

const SENIORITY_ORDER: CandidateSeniority[] = ['entry', 'junior', 'medior', 'senior', 'lead'];

const getSeniorityLabel = (value: CandidateSeniority, locale: string): string => {
  const labels = {
    cs: { entry: 'Začátek', junior: 'Junior', medior: 'Medior', senior: 'Senior', lead: 'Lead' },
    sk: { entry: 'Začiatočník', junior: 'Junior', medior: 'Medior', senior: 'Senior', lead: 'Lead' },
    de: { entry: 'Einstieg', junior: 'Junior', medior: 'Medior', senior: 'Senior', lead: 'Lead' },
    at: { entry: 'Einstieg', junior: 'Junior', medior: 'Medior', senior: 'Senior', lead: 'Lead' },
    pl: { entry: 'Początek', junior: 'Junior', medior: 'Medior', senior: 'Senior', lead: 'Lead' },
    en: { entry: 'Entry', junior: 'Junior', medior: 'Mid', senior: 'Senior', lead: 'Lead' },
  } as const;

  const dictionary = labels[locale as keyof typeof labels] || labels.en;
  return dictionary[value];
};

const formatSalaryRange = (profile: UserProfile, locale: string): string => {
  const min = Number(profile.preferences?.desired_salary_min);
  const max = Number(profile.preferences?.desired_salary_max);
  const formatter = new Intl.NumberFormat(locale);
  if (Number.isFinite(min) && Number.isFinite(max)) return `${formatter.format(min)} - ${formatter.format(max)}`;
  if (Number.isFinite(min)) return `${formatter.format(min)}+`;
  if (Number.isFinite(max)) return `<= ${formatter.format(max)}`;
  return '';
};

const getMissingStepLabel = (step: CandidateOnboardingProfileNudgeKey, locale: string): string => {
  const labels = {
    cs: {
      location: 'lokaci',
      skills: 'silné skills',
      preferences: 'obor a cílový směr',
      supporting_context: 'stručný pracovní kontext',
    },
    sk: {
      location: 'lokalitu',
      skills: 'silné skills',
      preferences: 'odbor a cieľový smer',
      supporting_context: 'stručný pracovný kontext',
    },
    de: {
      location: 'Standort',
      skills: 'starke Skills',
      preferences: 'Bereich und Zielrichtung',
      supporting_context: 'kurzen Arbeitskontext',
    },
    at: {
      location: 'Standort',
      skills: 'starke Skills',
      preferences: 'Bereich und Zielrichtung',
      supporting_context: 'kurzen Arbeitskontext',
    },
    pl: {
      location: 'lokalizację',
      skills: 'mocne kompetencje',
      preferences: 'obszar i kierunek',
      supporting_context: 'krótki kontekst zawodowy',
    },
    en: {
      location: 'location',
      skills: 'strong skills',
      preferences: 'domain and target direction',
      supporting_context: 'short work context',
    },
  } as const;

  const dictionary = labels[locale as keyof typeof labels] || labels.en;
  return dictionary[step];
};

const buildOnboardingNarrative = (
  profile: UserProfile,
  session: CandidateOnboardingSessionV2,
  locale: string
): string => {
  const searchProfile = profile.preferences?.searchProfile;
  const domainLabel = getCandidateIntentDomainLabel(searchProfile?.primaryDomain, locale);
  const role = String(searchProfile?.targetRole || profile.preferences?.desired_role || profile.jobTitle || '').trim();
  const interest = String(session.interest_reveal_draft || profile.preferences?.candidate_onboarding_v2?.interest_reveal || profile.story || '').trim();
  const strength = String(session.evaluation?.strengths?.[0] || session.evaluation?.summary || '').trim();
  const arrangement = searchProfile?.preferredWorkArrangement;
  const arrangementLabel = arrangement
    ? locale === 'cs'
      ? arrangement === 'remote' ? 'remote setup' : arrangement === 'hybrid' ? 'hybrid setup' : 'práci na místě'
      : locale === 'sk'
        ? arrangement === 'remote' ? 'remote setup' : arrangement === 'hybrid' ? 'hybrid setup' : 'prácu na mieste'
        : arrangement === 'remote' ? 'remote work' : arrangement === 'hybrid' ? 'hybrid work' : 'on-site work'
    : '';

  if (locale === 'cs') {
    return [
      strength ? `Působíš jako člověk, který ${strength.charAt(0).toLowerCase()}${strength.slice(1).replace(/\.$/, '')}.` : '',
      domainLabel || role ? `Aktuálně ti nejvíc sedí směr ${[domainLabel, role].filter(Boolean).join(' / ')}.` : '',
      interest ? `Nejvíc tě táhne: ${interest.replace(/\.$/, '')}.` : '',
      arrangementLabel || profile.address ? `Další doporučení budeme stavět hlavně kolem ${[arrangementLabel, profile.address].filter(Boolean).join(' • ')}.` : '',
    ].filter(Boolean).join(' ');
  }

  if (locale === 'sk') {
    return [
      strength ? `Pôsobíš ako človek, ktorý ${strength.charAt(0).toLowerCase()}${strength.slice(1).replace(/\.$/, '')}.` : '',
      domainLabel || role ? `Aktuálne ti najviac sedí smer ${[domainLabel, role].filter(Boolean).join(' / ')}.` : '',
      interest ? `Najviac ťa ťahá: ${interest.replace(/\.$/, '')}.` : '',
      arrangementLabel || profile.address ? `Ďalšie odporúčania budeme stavať hlavne okolo ${[arrangementLabel, profile.address].filter(Boolean).join(' • ')}.` : '',
    ].filter(Boolean).join(' ');
  }

  return [
    strength ? `You come across as someone who ${strength.charAt(0).toLowerCase()}${strength.slice(1).replace(/\.$/, '')}.` : '',
    domainLabel || role ? `Your strongest current direction is ${[domainLabel, role].filter(Boolean).join(' / ')}.` : '',
    interest ? `What pulls you in most: ${interest.replace(/\.$/, '')}.` : '',
    arrangementLabel || profile.address ? `Next recommendations will lean around ${[arrangementLabel, profile.address].filter(Boolean).join(' • ')}.` : '',
  ].filter(Boolean).join(' ');
};

const getOnboardingLanguageOptions = (locale: string): Array<{ code: SearchLanguageCode; label: string }> => {
  const labels = {
    cs: { cs: 'Čeština', en: 'Angličtina', de: 'Němčina', sk: 'Slovenština', pl: 'Polština' },
    sk: { cs: 'Čeština', en: 'Angličtina', de: 'Nemčina', sk: 'Slovenčina', pl: 'Poľština' },
    de: { cs: 'Tschechisch', en: 'Englisch', de: 'Deutsch', sk: 'Slowakisch', pl: 'Polnisch' },
    at: { cs: 'Tschechisch', en: 'Englisch', de: 'Deutsch', sk: 'Slowakisch', pl: 'Polnisch' },
    pl: { cs: 'Czeski', en: 'Angielski', de: 'Niemiecki', sk: 'Słowacki', pl: 'Polski' },
    en: { cs: 'Czech', en: 'English', de: 'German', sk: 'Slovak', pl: 'Polish' },
  } as const;

  const dictionary = labels[locale as keyof typeof labels] || labels.en;
  return SUPPORTED_LANGUAGE_CODES.map((code) => ({ code, label: dictionary[code] }));
};

const normalizeSearchLanguageCodes = (codes: string[] | undefined | null, locale: string): SearchLanguageCode[] => {
  const next = (codes || [])
    .map((value) => String(value || '').trim().toLowerCase())
    .filter((value): value is SearchLanguageCode => SUPPORTED_LANGUAGE_CODES.includes(value as SearchLanguageCode));

  if (next.length > 0) {
    return Array.from(new Set(next));
  }
  if (locale === 'at') return ['de'];
  if (SUPPORTED_LANGUAGE_CODES.includes(locale as SearchLanguageCode)) return [locale as SearchLanguageCode];
  return ['cs'];
};

const CandidateOnboardingModal: React.FC<CandidateOnboardingModalProps> = ({
  isOpen,
  profile,
  jobs = [],
  onClose,
  onComplete,
  onGoToProfile,
  onUpdateProfile,
  onRefreshProfile,
  initialStep = 'entry',
  onStepViewed,
  onStepCompleted,
}) => {
  const { i18n } = useTranslation();
  const locale = normalizeLocale(i18n.resolvedLanguage || i18n.language || profile.preferredLocale || 'en');
  const copy = getTaskFirstOnboardingCopy(locale);
  const sessionStorageKey = useMemo(() => getSessionStorageKey(profile), [profile]);
  const { cards: taskCards, byId: jobById } = useMemo(() => buildTaskCards(jobs, locale), [jobs, locale]);

  const [session, setSession] = useState<CandidateOnboardingSessionV2>(createDefaultCandidateOnboardingSession);
  const [addressDraft, setAddressDraft] = useState(profile.address || '');
  const [skillsDraft, setSkillsDraft] = useState((profile.skills || []).join(', '));
  const [primaryDomainDraft, setPrimaryDomainDraft] = useState<CandidateDomainKey | ''>(
    profile.preferences?.searchProfile?.primaryDomain || ''
  );
  const [desiredRoleDraft, setDesiredRoleDraft] = useState(profile.preferences?.desired_role || profile.jobTitle || '');
  const [seniorityDraft, setSeniorityDraft] = useState<CandidateSeniority | null>(
    profile.preferences?.searchProfile?.seniority || null
  );
  const [salaryMinDraft, setSalaryMinDraft] = useState(
    profile.preferences?.desired_salary_min != null ? String(profile.preferences.desired_salary_min) : ''
  );
  const [salaryMaxDraft, setSalaryMaxDraft] = useState(
    profile.preferences?.desired_salary_max != null ? String(profile.preferences.desired_salary_max) : ''
  );
  const [supportingContextDraft, setSupportingContextDraft] = useState(profile.cvText || profile.cvAiText || '');
  const [currentProfile, setCurrentProfile] = useState<UserProfile>(profile);
  const [profileNudgeIndex, setProfileNudgeIndex] = useState(0);
  const [addressState, setAddressState] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [profileSaving, setProfileSaving] = useState(false);
  const [remoteLanguageDraft, setRemoteLanguageDraft] = useState<SearchLanguageCode[]>(
    normalizeSearchLanguageCodes(profile.preferences?.searchProfile?.remoteLanguageCodes, locale)
  );
  const [workArrangementDraft, setWorkArrangementDraft] = useState<'remote' | 'hybrid' | 'onsite' | null>(
    profile.preferences?.searchProfile?.preferredWorkArrangement || (profile.preferences?.searchProfile?.wantsRemoteRoles ? 'remote' : null)
  );
  const [preferencesError, setPreferencesError] = useState<string | null>(null);

  const selectedScenario = useMemo(
    () => copy.scenarios.find((scenario) => scenario.id === session.scenario_id) || null,
    [copy.scenarios, session.scenario_id]
  );
  const selectedTask = useMemo(
    () => (session.selected_task_id ? jobById.get(session.selected_task_id) || null : null),
    [jobById, session.selected_task_id]
  );
  const selectedTaskCard = useMemo(
    () => taskCards.find((task) => task.job_id === session.selected_task_id) || null,
    [session.selected_task_id, taskCards]
  );
  const missingProfileSteps = useMemo(() => resolveMissingProfileSteps(currentProfile), [currentProfile]);
  const currentProfileStep = missingProfileSteps[profileNudgeIndex] || null;
  const autoScenario = useMemo(() => {
    const seed = profile.id || profile.email || profile.name || 'jobshaman';
    const index = Math.abs(hashString(seed)) % copy.scenarios.length;
    return copy.scenarios[index] || copy.scenarios[0];
  }, [copy.scenarios, profile.email, profile.id, profile.name]);
  const answerLength = session.answer_draft.trim().length;
  const interestRevealLength = session.interest_reveal_draft.trim().length;
  const languageOptions = useMemo(() => getOnboardingLanguageOptions(locale), [locale]);
  const domainOptions = useMemo(() => getCandidateIntentDomainOptions(locale), [locale]);
  const onboardingNarrative = useMemo(
    () => buildOnboardingNarrative(currentProfile, session, locale),
    [currentProfile, locale, session]
  );
  const summaryChips = useMemo(() => {
    const searchProfile = currentProfile.preferences?.searchProfile;
    const domainLabel = getCandidateIntentDomainLabel(searchProfile?.primaryDomain, locale);
    const role = String(searchProfile?.targetRole || currentProfile.preferences?.desired_role || currentProfile.jobTitle || '').trim();
    const salary = formatSalaryRange(currentProfile, locale);
    const arrangement = searchProfile?.preferredWorkArrangement
      ? copy.workArrangementOptions[searchProfile.preferredWorkArrangement]
      : '';
    const seniority = searchProfile?.seniority ? getSeniorityLabel(searchProfile.seniority, locale) : '';
    const languages = (searchProfile?.remoteLanguageCodes || [])
      .map((code) => languageOptions.find((option) => option.code === code)?.label || code.toUpperCase())
      .slice(0, 3)
      .join(', ');

    return [
      domainLabel ? `${copy.summaryDomain}: ${domainLabel}` : '',
      role ? `${copy.summaryRole}: ${role}` : '',
      seniority ? `${copy.summarySeniority}: ${seniority}` : '',
      currentProfile.address ? `${copy.summaryLocation}: ${currentProfile.address}` : '',
      arrangement ? `${copy.summarySetup}: ${arrangement}` : '',
      salary ? `${copy.summarySalary}: ${salary}` : '',
      languages ? `${copy.summaryLanguages}: ${languages}` : '',
    ].filter(Boolean);
  }, [copy, currentProfile, languageOptions, locale]);
  const skillsSummary = useMemo(
    () => (currentProfile.skills || []).map((item) => String(item || '').trim()).filter(Boolean).slice(0, 6),
    [currentProfile.skills]
  );
  const missingSummary = useMemo(
    () => missingProfileSteps.map((step) => getMissingStepLabel(step, locale)).slice(0, 3),
    [locale, missingProfileSteps]
  );

  useEffect(() => {
    if (!isOpen) return;

    const stored = readSessionStorage(sessionStorageKey);
    const hasCompletedTaskFlow = Boolean(profile.preferences?.candidate_onboarding_v2?.completed_at);
    const profileOnly = initialStep === 'preferences'
      || initialStep === 'cv'
      || (initialStep === 'location' && hasCompletedTaskFlow);
    const nextSession: CandidateOnboardingSessionV2 = stored && !profileOnly
      ? stored
      : {
          ...createDefaultCandidateOnboardingSession(),
          current_step: initialStep === 'done' ? 'done' : profileOnly ? 'profile_nudge' : 'entry',
          scenario_id: autoScenario.id,
          interest_reveal_draft: profile.preferences?.candidate_onboarding_v2?.interest_reveal
            || profile.story
            || (profile.motivations || []).join(', '),
          started_at: profile.preferences?.candidate_onboarding_v2?.started_at,
          completed_at: profile.preferences?.candidate_onboarding_v2?.completed_at,
        };

    setSession(nextSession);
    setCurrentProfile(profile);
    setAddressDraft(profile.address || '');
    setSkillsDraft((profile.skills || []).join(', '));
    setPrimaryDomainDraft(profile.preferences?.searchProfile?.primaryDomain || '');
    setDesiredRoleDraft(profile.preferences?.desired_role || profile.jobTitle || '');
    setSeniorityDraft(profile.preferences?.searchProfile?.seniority || null);
    setSalaryMinDraft(profile.preferences?.desired_salary_min != null ? String(profile.preferences.desired_salary_min) : '');
    setSalaryMaxDraft(profile.preferences?.desired_salary_max != null ? String(profile.preferences.desired_salary_max) : '');
    setSupportingContextDraft(profile.cvText || profile.cvAiText || '');
    setRemoteLanguageDraft(normalizeSearchLanguageCodes(profile.preferences?.searchProfile?.remoteLanguageCodes, locale));
    setWorkArrangementDraft(profile.preferences?.searchProfile?.preferredWorkArrangement || (profile.preferences?.searchProfile?.wantsRemoteRoles ? 'remote' : null));
    setPreferencesError(null);
    setAddressState(profile.coordinates ? 'success' : 'idle');
    setProfileNudgeIndex(0);
  }, [autoScenario.id, initialStep, isOpen, locale, sessionStorageKey]);

  useEffect(() => {
    if (!isOpen) return;
    onStepViewed?.(session.current_step);
    void trackAnalyticsEvent({
      event_type: 'candidate_onboarding_step_viewed',
      feature: 'candidate_onboarding_v2',
      metadata: {
        step: session.current_step,
        scenario_id: session.scenario_id,
        selected_intent: session.selected_intent,
      },
    });
  }, [isOpen, onStepViewed, session.current_step, session.scenario_id, session.selected_intent]);

  useEffect(() => {
    if (!isOpen) return;
    updateSessionStorage(sessionStorageKey, session);
  }, [isOpen, session, sessionStorageKey]);

  useEffect(() => {
    if (!isOpen || session.current_step !== 'processing') return;

    const timeoutId = window.setTimeout(() => {
      setSession((current) => {
        if (current.current_step !== 'processing') return current;
        return {
          ...current,
          evaluation: current.evaluation || buildFallbackCandidateOnboardingEvaluation(current.answer_draft.trim()),
          current_step: 'reflection',
        };
      });
    }, 9000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isOpen, session.current_step]);

  const mergeProfileProgress = async (patch: Partial<UserProfile['preferences']['candidate_onboarding_v2']>) => {
    const nextProfile: UserProfile = {
      ...currentProfile,
      preferences: {
        ...currentProfile.preferences,
        candidate_onboarding_v2: {
          ...currentProfile.preferences?.candidate_onboarding_v2,
          ...patch,
        },
      },
    };
    setCurrentProfile(nextProfile);
    await onUpdateProfile(nextProfile, true);
    if (onRefreshProfile) {
      await onRefreshProfile().catch(() => undefined);
    }
  };

  const updateSession = (updater: (current: CandidateOnboardingSessionV2) => CandidateOnboardingSessionV2) => {
    setSession((current) => updater(current));
  };

  const completeStep = (step: string) => {
    onStepCompleted?.(step);
    void trackAnalyticsEvent({
      event_type: 'candidate_onboarding_step_completed',
      feature: 'candidate_onboarding_v2',
      metadata: {
        step,
        scenario_id: session.scenario_id,
        selected_task_id: session.selected_task_id,
      },
    });
  };

  const handleStartFlow = async (intent?: CandidateOnboardingIntent) => {
    const startedAt = session.started_at || new Date().toISOString();
    const selectedIntent = intent || session.selected_intent;
    updateSession((current) => ({
      ...current,
      started_at: startedAt,
      selected_intent: intent || current.selected_intent,
      current_step: 'scenario_select',
      scenario_id: current.scenario_id || autoScenario.id,
    }));
    completeStep('entry');
    await mergeProfileProgress({
      started_at: startedAt,
      selected_intent: selectedIntent,
      last_step: 'scenario_select',
    }).catch(() => undefined);
  };

  const handleScenarioContinue = (scenarioId?: CandidateOnboardingScenarioId) => {
    updateSession((current) => ({
      ...current,
      scenario_id: scenarioId || current.scenario_id || autoScenario.id,
      current_step: 'micro_task',
    }));
    completeStep('scenario_select');
  };

  const handleSubmitAnswer = async () => {
    if (answerLength < MIN_ANSWER_LENGTH || !session.scenario_id) return;

    updateSession((current) => ({ ...current, current_step: 'processing' }));
    completeStep('micro_task');
    const answer = session.answer_draft.trim();

    try {
      const evaluation = await evaluateCandidateOnboardingAnswer({
        scenarioId: session.scenario_id,
        answer,
        locale,
      });

      updateSession((current) => ({
        ...current,
        evaluation,
        current_step: 'reflection',
      }));

      void trackAnalyticsEvent({
        event_type: 'candidate_onboarding_evaluation_received',
        feature: 'candidate_onboarding_v2',
        metadata: {
          scenario_id: session.scenario_id,
          answer_length: answer.length,
          intent_hints: evaluation.intent_hints,
        },
      });
    } catch (error) {
      console.error('Candidate onboarding reflection failed unexpectedly, using local fallback.', error);
      const evaluation = buildFallbackCandidateOnboardingEvaluation(answer);
      updateSession((current) => ({
        ...current,
        evaluation,
        current_step: 'reflection',
      }));
    }
  };

  const handleIntentSelect = (intent: CandidateOnboardingIntent) => {
    updateSession((current) => ({
      ...current,
      selected_intent: intent,
    }));
  };

  const persistInterestReveal = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    const nextSignals = splitHumanSignalList(trimmed);
    const mergedMotivations = Array.from(new Set([...(currentProfile.motivations || []), ...nextSignals])).slice(0, 8);
    const mergedSideProjects = Array.from(new Set([
      ...(currentProfile.sideProjects || []),
      ...nextSignals.filter((item) => /(prototype|project|build|invent|design|maker|tool|system|experiment|prototyp|projekt|stav|vynález)/i.test(item)),
    ])).slice(0, 8);

    const nextProfile: UserProfile = {
      ...currentProfile,
      story: currentProfile.story || trimmed,
      motivations: mergedMotivations,
      sideProjects: mergedSideProjects,
      preferences: {
        ...currentProfile.preferences,
        candidate_onboarding_v2: {
          ...currentProfile.preferences?.candidate_onboarding_v2,
          interest_reveal: trimmed,
        },
      },
    };

    setCurrentProfile(nextProfile);
    await onUpdateProfile(nextProfile, true);
  };

  const handleInterestContinue = async (skip = false) => {
    const interestValue = skip ? '' : session.interest_reveal_draft.trim();
    if (interestValue) {
      await persistInterestReveal(interestValue).catch(() => undefined);
    }
    updateSession((current) => ({
      ...current,
      current_step: 'intent',
    }));
    completeStep('interest_reveal');
  };

  const handleIntentContinue = () => {
    if (!session.selected_intent) return;
    const nextStep = session.selected_intent === 'try_real_work' ? 'real_task_pick' : 'decision';
    updateSession((current) => ({
      ...current,
      current_step: nextStep,
    }));
    completeStep('intent');
    void mergeProfileProgress({
      selected_intent: session.selected_intent,
      interest_reveal: session.interest_reveal_draft.trim() || currentProfile.preferences?.candidate_onboarding_v2?.interest_reveal,
      last_step: nextStep,
    }).catch(() => undefined);
  };

  const handleTaskPick = (jobId: string) => {
    updateSession((current) => ({
      ...current,
      selected_task_id: jobId,
      current_step: 'slot_reserve',
    }));
    completeStep('real_task_pick');
    void trackAnalyticsEvent({
      event_type: 'candidate_onboarding_task_selected',
      feature: 'candidate_onboarding_v2',
      metadata: {
        selected_task_id: jobId,
        selected_intent: session.selected_intent,
      },
    });
  };

  const handleReserveSlot = () => {
    updateSession((current) => ({
      ...current,
      slot_reserved_at: current.slot_reserved_at || new Date().toISOString(),
      trial_started_at: current.trial_started_at || new Date().toISOString(),
      current_step: 'trial_task',
    }));
    completeStep('slot_reserve');
    void trackAnalyticsEvent({
      event_type: 'candidate_onboarding_slot_reserved',
      feature: 'candidate_onboarding_v2',
      metadata: {
        selected_task_id: session.selected_task_id,
      },
    });
  };

  const handleDialogueOpened = async () => {
    const nextProfile = markFirstQualityAction(currentProfile);
    setCurrentProfile(nextProfile);
    await onUpdateProfile(nextProfile, true);
    updateSession((current) => ({
      ...current,
      trial_completed_at: new Date().toISOString(),
      current_step: 'decision',
    }));
    completeStep('trial_task');
    void trackAnalyticsEvent({
      event_type: 'candidate_onboarding_trial_completed',
      feature: 'candidate_onboarding_v2',
      metadata: {
        selected_task_id: session.selected_task_id,
      },
    });
  };

  const finalizeFlow = async (skipProfileNudge = false) => {
    const completedAt = session.completed_at || new Date().toISOString();

    if (!skipProfileNudge && missingProfileSteps.length > 0 && session.current_step !== 'profile_nudge') {
      updateSession((current) => ({
        ...current,
        completed_at: completedAt,
        current_step: 'profile_nudge',
      }));
      completeStep('decision');
      return;
    }

    updateSession((current) => ({
      ...current,
      completed_at: completedAt,
      profile_nudge_completed_at: current.profile_nudge_completed_at || new Date().toISOString(),
      current_step: 'done',
    }));
    completeStep(session.current_step);

    await mergeProfileProgress({
      completed_at: completedAt,
      last_step: 'done',
      selected_intent: session.selected_intent,
      profile_nudge_completed_at: missingProfileSteps.length > 0 ? new Date().toISOString() : currentProfile.preferences?.candidate_onboarding_v2?.profile_nudge_completed_at,
    }).catch(() => undefined);
  };

  const finishAndClose = async () => {
    clearSessionStorage(sessionStorageKey);
    onComplete();
  };

  const advanceProfileNudge = async () => {
    if (profileNudgeIndex < missingProfileSteps.length - 1) {
      setProfileNudgeIndex((current) => current + 1);
      return;
    }

    updateSession((current) => ({
      ...current,
      profile_nudge_completed_at: new Date().toISOString(),
      current_step: 'done',
    }));

    await mergeProfileProgress({
      completed_at: session.completed_at || new Date().toISOString(),
      last_step: 'done',
      selected_intent: session.selected_intent,
      profile_nudge_completed_at: new Date().toISOString(),
    }).catch(() => undefined);
  };

  const saveLocation = async () => {
    if (!addressDraft.trim()) {
      advanceProfileNudge().catch(() => undefined);
      return;
    }
    setAddressState('verifying');
    setProfileSaving(true);
    try {
      const coordinates = await resolveAddressToCoordinates(addressDraft.trim());
      if (!coordinates) {
        setAddressState('error');
        return;
      }
      const nextProfile: UserProfile = {
        ...currentProfile,
        address: addressDraft.trim(),
        coordinates,
      };
      setCurrentProfile(nextProfile);
      await onUpdateProfile(nextProfile, true);
      setAddressState('success');
      completeStep('profile_location');
      await advanceProfileNudge();
    } finally {
      setProfileSaving(false);
    }
  };

  const saveSkills = async () => {
    const nextSkills = skillsDraft
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12);
    if (nextSkills.length < 3) {
      return;
    }
    setProfileSaving(true);
    try {
      const nextProfile: UserProfile = {
        ...currentProfile,
        skills: nextSkills,
      };
      setCurrentProfile(nextProfile);
      await onUpdateProfile(nextProfile, true);
      completeStep('profile_skills');
      await advanceProfileNudge();
    } finally {
      setProfileSaving(false);
    }
  };

  const savePreferences = async () => {
    const nextMin = salaryMinDraft.trim() ? Number(salaryMinDraft.trim()) : null;
    const nextMax = salaryMaxDraft.trim() ? Number(salaryMaxDraft.trim()) : null;
    const nextLanguages = Array.from(new Set(remoteLanguageDraft)).filter((code): code is SearchLanguageCode => SUPPORTED_LANGUAGE_CODES.includes(code));
    const nextWorkArrangement = workArrangementDraft;
    if (
      !primaryDomainDraft
      || !desiredRoleDraft.trim()
      || (!Number.isFinite(Number(nextMin)) && !Number.isFinite(Number(nextMax)))
      || nextLanguages.length === 0
      || !nextWorkArrangement
    ) {
      setPreferencesError(copy.preferencesError);
      return;
    }
    setPreferencesError(null);
    setProfileSaving(true);
    try {
      const currentSearchProfile = {
        ...createDefaultCandidateSearchProfile(),
        ...(currentProfile.preferences?.searchProfile || {}),
      };
      const shouldUseCommuteFilter = nextWorkArrangement !== 'remote' && Boolean(currentProfile.coordinates || currentProfile.address || addressDraft.trim());
      const nextProfile: UserProfile = {
        ...currentProfile,
        jobTitle: desiredRoleDraft.trim(),
        preferences: {
          ...currentProfile.preferences,
          desired_role: desiredRoleDraft.trim(),
          desired_salary_min: Number.isFinite(Number(nextMin)) ? Number(nextMin) : null,
          desired_salary_max: Number.isFinite(Number(nextMax)) ? Number(nextMax) : null,
          searchProfile: {
            ...currentSearchProfile,
            primaryDomain: primaryDomainDraft,
            targetRole: desiredRoleDraft.trim(),
            seniority: seniorityDraft,
            inferenceSource: 'manual',
            wantsRemoteRoles: nextWorkArrangement === 'remote',
            preferredWorkArrangement: nextWorkArrangement,
            remoteLanguageCodes: nextLanguages,
            defaultEnableCommuteFilter: shouldUseCommuteFilter,
          },
        },
      };
      setCurrentProfile(nextProfile);
      await onUpdateProfile(nextProfile, true);
      completeStep('profile_preferences');
      await advanceProfileNudge();
    } finally {
      setProfileSaving(false);
    }
  };

  const saveSupportingContext = async () => {
    if (supportingContextDraft.trim().length < MIN_SUPPORTING_TEXT_LENGTH) {
      return;
    }
    setProfileSaving(true);
    try {
      const nextProfile: UserProfile = {
        ...currentProfile,
        cvText: supportingContextDraft.trim(),
      };
      setCurrentProfile(nextProfile);
      await onUpdateProfile(nextProfile, true);
      completeStep('profile_supporting_context');
      await advanceProfileNudge();
    } finally {
      setProfileSaving(false);
    }
  };

  const handleBack = () => {
    if (session.current_step === 'profile_nudge') {
      if (profileNudgeIndex > 0) {
        setProfileNudgeIndex((current) => current - 1);
        return;
      }
      updateSession((current) => ({ ...current, current_step: 'decision' }));
      return;
    }

    if (session.current_step === 'decision' && !session.selected_task_id) {
      updateSession((current) => ({ ...current, current_step: 'intent' }));
      return;
    }

    updateSession((current) => ({
      ...current,
      current_step: getPreviousCandidateOnboardingStep(current.current_step),
    }));
  };

  if (!isOpen) return null;

  const renderHeader = (showBack = true) => (
    <div className="flex items-center justify-between gap-3">
      {showBack ? (
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 rounded-[999px] border border-[var(--border)] bg-white/85 px-3 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-white dark:bg-slate-950/85"
        >
          <ChevronLeft size={16} />
          {copy.back}
        </button>
      ) : <div />}
      <button
        type="button"
        onClick={onClose}
        className="rounded-[999px] border border-[var(--border)] bg-white/85 px-3 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:bg-white dark:bg-slate-950/85"
      >
        {copy.skipForNow}
      </button>
    </div>
  );

  const renderScenarioCards = () => (
    <div className="grid gap-3 md:grid-cols-2">
      {copy.scenarios.map((scenario) => {
        const active = scenario.id === session.scenario_id;
        return (
          <button
            key={scenario.id}
            type="button"
            onClick={() => updateSession((current) => ({ ...current, scenario_id: scenario.id }))}
            className={cn(
              'rounded-[20px] border p-4 text-left transition-all',
              active
                ? 'border-[rgba(var(--accent-rgb),0.32)] bg-[rgba(var(--accent-rgb),0.08)] shadow-[0_18px_38px_-28px_rgba(15,23,42,0.24)]'
                : 'border-[var(--border)] bg-white/85 hover:border-[rgba(var(--accent-rgb),0.18)] hover:bg-white dark:bg-slate-950/80'
            )}
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
              {scenario.title}
            </div>
            <div className="mt-2 text-base font-semibold tracking-[-0.03em] text-[var(--text-strong)]">
              {scenario.context}
            </div>
            <div className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{scenario.problem}</div>
          </button>
        );
      })}
    </div>
  );

  const renderEntryCards = () => (
    <div className="grid gap-3 md:grid-cols-3">
      {ONBOARDING_INTENTS.map((intent, index) => {
        const option = copy.entryOptions[intent];
        const active = session.selected_intent === intent;
        return (
          <button
            key={intent}
            type="button"
            onClick={() => handleStartFlow(intent).catch(() => undefined)}
            className={cn('app-entry-intent-card text-left', active && 'app-entry-intent-card-active')}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)] text-[var(--text-muted)] shadow-[var(--shadow-soft)]">
                    {`0${index + 1}`}
                  </span>
                  {copy.intentOptions[intent]}
                </div>
                <div className="text-lg font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
                  {option.title}
                </div>
                <p className="text-sm leading-6 text-[var(--text-muted)]">{option.body}</p>
              </div>
              <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)] text-[var(--accent-green)] shadow-[var(--shadow-soft)]">
                <Sparkles size={16} />
              </div>
            </div>
            <div className="mt-5 text-xs leading-5 text-[var(--text-faint)]">{option.hint}</div>
          </button>
        );
      })}
    </div>
  );

  const renderProfileNudge = () => {
    if (!currentProfileStep) {
      return (
        <SurfaceCard className="space-y-4 rounded-[28px] border-[var(--border)] bg-white/90 p-6 shadow-[0_26px_80px_-46px_rgba(15,23,42,0.32)] dark:bg-slate-950/92">
          {renderHeader()}
          <div className="space-y-2">
            <div className="app-eyebrow w-fit">
              <CheckCircle2 size={14} />
              {copy.profileDone}
            </div>
            <h2 className="text-3xl font-semibold tracking-[-0.05em] text-[var(--text-strong)]">{copy.finishTitle}</h2>
            <p className="max-w-2xl text-sm leading-6 text-[var(--text-muted)]">{copy.finishBody}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="app-button-primary app-organic-cta" onClick={() => finishAndClose().catch(() => undefined)}>
              {copy.finishCta}
            </button>
            {onGoToProfile ? (
              <button type="button" className="app-button-secondary" onClick={onGoToProfile}>
                {copy.openProfile}
              </button>
            ) : null}
          </div>
        </SurfaceCard>
      );
    }

    return (
      <SurfaceCard className="space-y-5 rounded-[28px] border-[var(--border)] bg-white/90 p-6 shadow-[0_26px_80px_-46px_rgba(15,23,42,0.32)] dark:bg-slate-950/92">
        {renderHeader()}
        <div className="space-y-2">
          <div className="app-eyebrow w-fit">
            <Sparkles size={14} />
            {copy.profileTitle}
          </div>
          <h2 className="text-3xl font-semibold tracking-[-0.05em] text-[var(--text-strong)]">
            {currentProfileStep === 'location'
              ? copy.locationTitle
              : currentProfileStep === 'skills'
                ? copy.skillsTitle
                : currentProfileStep === 'preferences'
                  ? copy.preferencesTitle
                  : copy.supportingTitle}
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
            {currentProfileStep === 'location'
              ? copy.locationBody
              : currentProfileStep === 'skills'
                ? copy.skillsBody
                : currentProfileStep === 'preferences'
                  ? copy.preferencesBody
                  : copy.supportingBody}
          </p>
        </div>

        {currentProfileStep === 'location' ? (
          <div className="space-y-3">
            <input
              value={addressDraft}
              onChange={(event) => {
                setAddressDraft(event.target.value);
                setAddressState('idle');
              }}
              placeholder={copy.addressPlaceholder}
              className="w-full rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[rgba(var(--accent-rgb),0.3)]"
            />
            {addressState === 'success' ? <div className="text-sm text-emerald-700">{copy.verifiedAddress}</div> : null}
            {addressState === 'error' ? <div className="text-sm text-rose-600">{copy.addressError}</div> : null}
            <div className="flex flex-wrap gap-3">
              <button type="button" className="app-button-primary app-organic-cta" disabled={profileSaving || !addressDraft.trim()} onClick={() => saveLocation().catch(() => undefined)}>
                {profileSaving || addressState === 'verifying' ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
                {copy.verifyAddress}
              </button>
              <button type="button" className="app-button-secondary" onClick={() => advanceProfileNudge().catch(() => undefined)}>
                {copy.skipForNow}
              </button>
            </div>
          </div>
        ) : null}

        {currentProfileStep === 'skills' ? (
          <div className="space-y-3">
            <textarea
              value={skillsDraft}
              onChange={(event) => setSkillsDraft(event.target.value)}
              placeholder={copy.skillsPlaceholder}
              rows={4}
              className="w-full rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[rgba(var(--accent-rgb),0.3)]"
            />
            <div className="flex flex-wrap gap-3">
              <button type="button" className="app-button-primary app-organic-cta" disabled={profileSaving} onClick={() => saveSkills().catch(() => undefined)}>
                {profileSaving ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {copy.saveAndContinue}
              </button>
              <button type="button" className="app-button-secondary" onClick={() => advanceProfileNudge().catch(() => undefined)}>
                {copy.skipForNow}
              </button>
            </div>
          </div>
        ) : null}

        {currentProfileStep === 'preferences' ? (
          <div className="grid gap-4 md:grid-cols-2">
            <select
              value={primaryDomainDraft}
              onChange={(event) => {
                setPrimaryDomainDraft((event.target.value || '') as CandidateDomainKey | '');
                setPreferencesError(null);
              }}
              className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[rgba(var(--accent-rgb),0.3)]"
            >
              <option value="">{copy.domainPlaceholder}</option>
              {domainOptions.map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
            <input
              value={desiredRoleDraft}
              onChange={(event) => {
                setDesiredRoleDraft(event.target.value);
                setPreferencesError(null);
              }}
              placeholder={copy.desiredRolePlaceholder}
              className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[rgba(var(--accent-rgb),0.3)]"
            />
            <div className="space-y-2 md:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.seniorityLabel}</div>
              <div className="flex flex-wrap gap-2">
                {SENIORITY_ORDER.map((level) => {
                  const active = seniorityDraft === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => {
                        setSeniorityDraft(active ? null : level);
                        setPreferencesError(null);
                      }}
                      className={cn(
                        'rounded-full border px-3 py-2 text-sm font-medium transition',
                        active
                          ? 'border-[rgba(var(--accent-rgb),0.24)] bg-[var(--accent-soft)] text-[var(--accent)]'
                          : 'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text)] hover:border-[rgba(var(--accent-rgb),0.18)]'
                      )}
                    >
                      {getSeniorityLabel(level, locale)}
                    </button>
                  );
                })}
              </div>
            </div>
            <input
              value={salaryMinDraft}
              onChange={(event) => {
                setSalaryMinDraft(event.target.value.replace(/[^\d]/g, ''));
                setPreferencesError(null);
              }}
              placeholder={copy.salaryMinPlaceholder}
              className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[rgba(var(--accent-rgb),0.3)]"
            />
            <input
              value={salaryMaxDraft}
              onChange={(event) => {
                setSalaryMaxDraft(event.target.value.replace(/[^\d]/g, ''));
                setPreferencesError(null);
              }}
              placeholder={copy.salaryMaxPlaceholder}
              className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[rgba(var(--accent-rgb),0.3)]"
            />
            <div className="space-y-2 md:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.workArrangementLabel}</div>
              <div className="flex flex-wrap gap-2">
                {(['remote', 'hybrid', 'onsite'] as const).map((mode) => {
                  const active = workArrangementDraft === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setWorkArrangementDraft(mode);
                        setPreferencesError(null);
                      }}
                      className={cn(
                        'rounded-full border px-3 py-2 text-sm font-medium transition',
                        active
                          ? 'border-[rgba(var(--accent-rgb),0.24)] bg-[var(--accent-soft)] text-[var(--accent)]'
                          : 'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text)] hover:border-[rgba(var(--accent-rgb),0.18)]'
                      )}
                    >
                      {copy.workArrangementOptions[mode]}
                    </button>
                  );
                })}
              </div>
              <p className="text-sm leading-6 text-[var(--text-muted)]">{copy.workArrangementBody}</p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.languagesLabel}</div>
              <div className="flex flex-wrap gap-2">
                {languageOptions.map((option) => {
                  const active = remoteLanguageDraft.includes(option.code);
                  return (
                    <button
                      key={option.code}
                      type="button"
                      onClick={() => {
                        setRemoteLanguageDraft((current) => {
                          const next = active
                            ? current.filter((code) => code !== option.code)
                            : [...current, option.code];
                          return Array.from(new Set(next));
                        });
                        setPreferencesError(null);
                      }}
                      className={cn(
                        'rounded-full border px-3 py-2 text-sm font-medium transition',
                        active
                          ? 'border-[rgba(var(--accent-rgb),0.24)] bg-[var(--accent-soft)] text-[var(--accent)]'
                          : 'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text)] hover:border-[rgba(var(--accent-rgb),0.18)]'
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-sm leading-6 text-[var(--text-muted)]">{copy.languagesBody}</p>
            </div>
            {preferencesError ? (
              <div className="text-sm text-amber-700 md:col-span-2">{preferencesError}</div>
            ) : null}
            <div className="flex flex-wrap gap-3 md:col-span-2">
              <button type="button" className="app-button-primary app-organic-cta" disabled={profileSaving} onClick={() => savePreferences().catch(() => undefined)}>
                {profileSaving ? <Loader2 size={16} className="animate-spin" /> : <Target size={16} />}
                {copy.saveAndContinue}
              </button>
              <button type="button" className="app-button-secondary" onClick={() => advanceProfileNudge().catch(() => undefined)}>
                {copy.skipForNow}
              </button>
            </div>
          </div>
        ) : null}

        {currentProfileStep === 'supporting_context' ? (
          <div className="space-y-3">
            <textarea
              value={supportingContextDraft}
              onChange={(event) => setSupportingContextDraft(event.target.value)}
              placeholder={copy.supportingPlaceholder}
              rows={6}
              className="w-full rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[rgba(var(--accent-rgb),0.3)]"
            />
            <div className="text-xs text-[var(--text-faint)]">
              {Math.max(0, supportingContextDraft.trim().length)} / {MIN_SUPPORTING_TEXT_LENGTH}
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" className="app-button-primary app-organic-cta" disabled={profileSaving} onClick={() => saveSupportingContext().catch(() => undefined)}>
                {profileSaving ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {copy.saveAndContinue}
              </button>
              <button type="button" className="app-button-secondary" onClick={() => advanceProfileNudge().catch(() => undefined)}>
                {copy.skipForNow}
              </button>
            </div>
          </div>
        ) : null}
      </SurfaceCard>
    );
  };

  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(var(--accent-rgb),0.12),transparent_36%),linear-gradient(180deg,#f5f7fb_0%,#eef2f8_100%)] px-4 py-5 dark:bg-[radial-gradient(circle_at_top,rgba(var(--accent-rgb),0.16),transparent_34%),linear-gradient(180deg,#020617_0%,#0f172a_100%)]">
      <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-6xl items-center justify-center">
        {session.current_step === 'entry' ? (
          <SurfaceCard variant="hero" className="app-entry-ritual-panel w-full max-w-4xl space-y-8 rounded-[40px] p-7 shadow-[0_30px_110px_-54px_rgba(15,23,42,0.38)] sm:p-10 md:p-12">
            {renderHeader(false)}
            <div className="space-y-8 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.06)] text-[var(--accent-green)] shadow-[0_0_80px_-32px_rgba(var(--accent-green-rgb),0.8)]">
                <Sparkles size={28} />
              </div>
              <div className="space-y-4">
                <div className="app-eyebrow mx-auto w-fit">
                  <Sparkles size={14} />
                  {copy.entryEyebrow}
                </div>
                <h1 className="app-display mx-auto max-w-3xl text-4xl font-semibold tracking-[-0.06em] text-[var(--text-strong)] sm:text-5xl md:text-6xl">
                  {copy.entryHeadline}
                </h1>
                <p className="mx-auto max-w-2xl text-sm leading-7 text-[var(--text-muted)] sm:text-base">
                  {copy.entryBody}
                </p>
              </div>
              {renderEntryCards()}
            </div>
          </SurfaceCard>
        ) : null}

        {session.current_step === 'scenario_select' ? (
          <SurfaceCard className="w-full max-w-5xl space-y-6 rounded-[30px] border-[var(--border)] bg-white/92 p-6 shadow-[0_30px_110px_-54px_rgba(15,23,42,0.38)] dark:bg-slate-950/94 sm:p-8">
            {renderHeader()}
            <div className="space-y-2">
              <div className="app-eyebrow w-fit">
                <Sparkles size={14} />
                {copy.scenarioTitle}
              </div>
              <p className="text-sm leading-6 text-[var(--text-muted)]">{copy.scenarioBody}</p>
            </div>
            {renderScenarioCards()}
            <div className="flex flex-wrap gap-3">
              <button type="button" className="app-button-primary app-organic-cta" onClick={() => handleScenarioContinue(session.scenario_id || autoScenario.id)}>
                {copy.scenarioContinue}
              </button>
              <button type="button" className="app-button-secondary" onClick={() => handleScenarioContinue(autoScenario.id)}>
                {copy.scenarioSkip}
              </button>
            </div>
          </SurfaceCard>
        ) : null}

        {session.current_step === 'micro_task' && selectedScenario ? (
          <SurfaceCard className="w-full max-w-4xl space-y-6 rounded-[30px] border-[var(--border)] bg-white/92 p-6 shadow-[0_30px_110px_-54px_rgba(15,23,42,0.38)] dark:bg-slate-950/94 sm:p-8">
            {renderHeader()}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-2">
                <div className="app-eyebrow w-fit">
                  <Sparkles size={14} />
                  {selectedScenario.title}
                </div>
                <div className="max-w-2xl text-2xl font-semibold tracking-[-0.05em] text-[var(--text-strong)]">
                  {selectedScenario.context}
                </div>
                <p className="text-base text-[var(--text-muted)]">{selectedScenario.problem}</p>
              </div>
              <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text)]">
                <div className="flex items-center gap-2 font-semibold">
                  <TimerReset size={16} className="text-[var(--accent)]" />
                  {copy.timerLabel}
                </div>
                <div className="mt-1 text-xs text-[var(--text-faint)]">{copy.timerSoft}</div>
              </div>
            </div>
            <textarea
              value={session.answer_draft}
              onChange={(event) => updateSession((current) => ({ ...current, answer_draft: event.target.value }))}
              placeholder={copy.answerPlaceholder}
              rows={9}
              className="w-full rounded-[22px] border border-[var(--border)] bg-[var(--surface-muted)] px-5 py-4 text-sm leading-6 text-[var(--text)] outline-none transition focus:border-[rgba(var(--accent-rgb),0.3)]"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-[var(--text-muted)]">
                {answerLength < MIN_ANSWER_LENGTH ? copy.answerHint : `${formatNumberLabel(answerLength, locale)} characters`}
              </div>
              <button type="button" className="app-button-primary app-organic-cta" disabled={answerLength < MIN_ANSWER_LENGTH} onClick={() => handleSubmitAnswer().catch(() => undefined)}>
                {copy.submit}
              </button>
            </div>
            {answerLength > 0 && answerLength < MIN_ANSWER_LENGTH ? (
              <div className="text-sm text-amber-700">{copy.answerTooShort}</div>
            ) : null}
          </SurfaceCard>
        ) : null}

        {session.current_step === 'processing' ? (
          <SurfaceCard className="w-full max-w-2xl space-y-5 rounded-[30px] border-[var(--border)] bg-white/92 p-8 text-center shadow-[0_30px_110px_-54px_rgba(15,23,42,0.38)] dark:bg-slate-950/94">
            {renderHeader()}
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] bg-[rgba(var(--accent-rgb),0.1)] text-[var(--accent)]">
              <Loader2 size={24} className="animate-spin" />
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-semibold tracking-[-0.05em] text-[var(--text-strong)]">{copy.processing}</div>
              <p className="text-sm leading-6 text-[var(--text-muted)]">{copy.processingBody}</p>
            </div>
            <div className="flex justify-center">
              <button
                type="button"
                className="app-button-secondary"
                onClick={() => updateSession((current) => ({ ...current, current_step: 'micro_task' }))}
              >
                {copy.processingBack}
              </button>
            </div>
          </SurfaceCard>
        ) : null}

        {session.current_step === 'reflection' && session.evaluation ? (
          <SurfaceCard className="w-full max-w-5xl space-y-6 rounded-[30px] border-[var(--border)] bg-white/92 p-6 shadow-[0_30px_110px_-54px_rgba(15,23,42,0.38)] dark:bg-slate-950/94 sm:p-8">
            {renderHeader()}
            <div className="space-y-2">
              <div className="app-eyebrow w-fit">
                <Sparkles size={14} />
                {copy.reflectionTitle}
              </div>
              <p className="max-w-3xl text-sm leading-6 text-[var(--text-muted)]">{session.evaluation.summary || copy.reflectionIntro}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <SurfaceCard className="space-y-3 rounded-[22px] border-[var(--border)] bg-[var(--surface-muted)] p-4 shadow-none">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.strengthsTitle}</div>
                <div className="space-y-2 text-sm leading-6 text-[var(--text)]">
                  {(session.evaluation.strengths.length > 0 ? session.evaluation.strengths : [copy.reflectionIntro]).map((item) => (
                    <div key={item}>✔ {item}</div>
                  ))}
                </div>
              </SurfaceCard>
              <SurfaceCard className="space-y-3 rounded-[22px] border-[var(--border)] bg-[var(--surface-muted)] p-4 shadow-none">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.missesTitle}</div>
                <div className="space-y-2 text-sm leading-6 text-[var(--text)]">
                  {(session.evaluation.misses.length > 0 ? session.evaluation.misses : ['Still room to sharpen the first move.']).map((item) => (
                    <div key={item}>⚠ {item}</div>
                  ))}
                </div>
              </SurfaceCard>
              <SurfaceCard className="space-y-3 rounded-[22px] border-[var(--border)] bg-[var(--surface-muted)] p-4 shadow-none">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.rolesTitle}</div>
                <div className="space-y-2 text-sm leading-6 text-[var(--text)]">
                  {(session.evaluation.role_signals.length > 0 ? session.evaluation.role_signals : ['The signal is directional.']).map((item) => (
                    <div key={item}>→ {item}</div>
                  ))}
                </div>
              </SurfaceCard>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                className="app-button-primary app-organic-cta"
                onClick={() => {
                  updateSession((current) => ({ ...current, current_step: 'reality_check' }));
                  completeStep('reflection');
                }}
              >
                {copy.reflectionCta}
              </button>
            </div>
          </SurfaceCard>
        ) : null}

        {session.current_step === 'reality_check' && session.evaluation ? (
          <SurfaceCard className="w-full max-w-3xl space-y-6 rounded-[30px] border-[var(--border)] bg-white/92 p-6 shadow-[0_30px_110px_-54px_rgba(15,23,42,0.38)] dark:bg-slate-950/94 sm:p-8">
            {renderHeader()}
            <div className="space-y-3">
              <div className="app-eyebrow w-fit">
                <Target size={14} />
                {copy.realityTitle}
              </div>
              <h2 className="text-3xl font-semibold tracking-[-0.05em] text-[var(--text-strong)]">{session.evaluation.reality_check}</h2>
              <p className="text-sm leading-6 text-[var(--text-muted)]">{copy.realityBody}</p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                className="app-button-primary app-organic-cta"
                onClick={() => {
                  const fallbackIntent = session.evaluation?.intent_hints?.[0] || 'explore_options';
                  updateSession((current) => ({
                    ...current,
                    selected_intent: current.selected_intent || fallbackIntent,
                    current_step: 'interest_reveal',
                  }));
                  completeStep('reality_check');
                }}
              >
                {copy.realityCta}
              </button>
            </div>
          </SurfaceCard>
        ) : null}

        {session.current_step === 'interest_reveal' ? (
          <SurfaceCard className="w-full max-w-4xl space-y-6 rounded-[30px] border-[var(--border)] bg-white/92 p-6 shadow-[0_30px_110px_-54px_rgba(15,23,42,0.38)] dark:bg-slate-950/94 sm:p-8">
            {renderHeader()}
            <div className="space-y-3">
              <div className="app-eyebrow w-fit">
                <Sparkles size={14} />
                {copy.interestTitle}
              </div>
              <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.05em] text-[var(--text-strong)]">{copy.interestPrompt}</h2>
              <p className="max-w-3xl text-sm leading-6 text-[var(--text-muted)]">{copy.interestBody}</p>
            </div>
            <textarea
              value={session.interest_reveal_draft}
              onChange={(event) => updateSession((current) => ({ ...current, interest_reveal_draft: event.target.value }))}
              placeholder={copy.interestPlaceholder}
              rows={7}
              className="w-full rounded-[22px] border border-[var(--border)] bg-[var(--surface-muted)] px-5 py-4 text-sm leading-6 text-[var(--text)] outline-none transition focus:border-[rgba(var(--accent-rgb),0.3)]"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-[var(--text-muted)]">
                {interestRevealLength > 0 ? `${formatNumberLabel(interestRevealLength, locale)} characters` : copy.interestHint}
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="app-button-secondary" onClick={() => handleInterestContinue(true).catch(() => undefined)}>
                  {copy.interestSkip}
                </button>
                <button type="button" className="app-button-primary app-organic-cta" onClick={() => handleInterestContinue(false).catch(() => undefined)}>
                  {copy.interestCta}
                </button>
              </div>
            </div>
          </SurfaceCard>
        ) : null}

        {session.current_step === 'intent' ? (
          <SurfaceCard className="w-full max-w-3xl space-y-6 rounded-[30px] border-[var(--border)] bg-white/92 p-6 shadow-[0_30px_110px_-54px_rgba(15,23,42,0.38)] dark:bg-slate-950/94 sm:p-8">
            {renderHeader()}
            <div className="space-y-2">
              <div className="app-eyebrow w-fit">
                <Sparkles size={14} />
                {copy.intentTitle}
              </div>
              <p className="text-sm leading-6 text-[var(--text-muted)]">{copy.intentBody}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {ONBOARDING_INTENTS.map((intent) => (
                <FilterChip key={intent} active={session.selected_intent === intent} onClick={() => handleIntentSelect(intent)}>
                  {copy.intentOptions[intent]}
                </FilterChip>
              ))}
            </div>
            <div className="flex justify-end">
              <button type="button" className="app-button-primary app-organic-cta" disabled={!session.selected_intent} onClick={handleIntentContinue}>
                {copy.intentCta}
              </button>
            </div>
          </SurfaceCard>
        ) : null}

        {session.current_step === 'real_task_pick' ? (
          <SurfaceCard className="w-full max-w-5xl space-y-6 rounded-[30px] border-[var(--border)] bg-white/92 p-6 shadow-[0_30px_110px_-54px_rgba(15,23,42,0.38)] dark:bg-slate-950/94 sm:p-8">
            {renderHeader()}
            <div className="space-y-2">
              <div className="app-eyebrow w-fit">
                <Sparkles size={14} />
                {copy.tasksTitle}
              </div>
              <p className="text-sm leading-6 text-[var(--text-muted)]">{copy.tasksBody}</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
              <SurfaceCard className="space-y-4 rounded-[24px] border-[var(--border)] bg-[var(--surface-muted)] p-6 shadow-none">
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.tasksTitle}</div>
                  <div className="text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">{copy.tasksContinueTitle}</div>
                  <p className="text-sm leading-6 text-[var(--text-muted)]">{copy.tasksContinueBody}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="button" className="app-button-primary app-organic-cta" onClick={() => finalizeFlow().catch(() => undefined)}>
                    {copy.tasksContinueCta}
                  </button>
                  <button type="button" className="app-button-secondary" onClick={handleBack}>
                    {copy.back}
                  </button>
                </div>
              </SurfaceCard>

              {taskCards.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.tasksOptionalTitle}</div>
                  <div className="grid gap-4">
                    {taskCards.map((task) => (
                      <SurfaceCard key={task.id} className="space-y-4 rounded-[24px] border-[var(--border)] bg-[var(--surface-muted)] p-5 shadow-none">
                        <div className="space-y-2">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{task.company}</div>
                          <div className="text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">{task.title}</div>
                          <p className="text-sm leading-6 text-[var(--text-muted)]">{task.problem}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <div className="rounded-[999px] bg-white/80 px-3 py-2 text-xs font-medium text-[var(--text)] dark:bg-white/10">{task.time_label}</div>
                          <div className="rounded-[999px] bg-white/80 px-3 py-2 text-xs font-medium text-[var(--text)] dark:bg-white/10">{task.reward_label}</div>
                        </div>
                        <button type="button" className="app-button-primary app-organic-cta" onClick={() => handleTaskPick(task.job_id)}>
                          {copy.taskCta}
                        </button>
                      </SurfaceCard>
                    ))}
                  </div>
                </div>
              ) : (
                <SurfaceCard className="space-y-4 rounded-[24px] border-[var(--border)] bg-[var(--surface-muted)] p-6 shadow-none">
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.tasksOptionalTitle}</div>
                    <div className="text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">{copy.tasksEmptyTitle}</div>
                    <p className="max-w-2xl text-sm leading-6 text-[var(--text-muted)]">{copy.tasksEmptyBody}</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button type="button" className="app-button-secondary" onClick={() => finalizeFlow().catch(() => undefined)}>
                      {copy.tasksEmptyCta}
                    </button>
                  </div>
                </SurfaceCard>
              )}
            </div>
          </SurfaceCard>
        ) : null}

        {session.current_step === 'slot_reserve' && selectedTaskCard ? (
          <SurfaceCard className="w-full max-w-3xl space-y-6 rounded-[30px] border-[var(--border)] bg-white/92 p-6 shadow-[0_30px_110px_-54px_rgba(15,23,42,0.38)] dark:bg-slate-950/94 sm:p-8">
            {renderHeader()}
            <div className="space-y-2">
              <div className="app-eyebrow w-fit">
                <Sparkles size={14} />
                {copy.slotTitle}
              </div>
              <div className="text-3xl font-semibold tracking-[-0.05em] text-[var(--text-strong)]">
                {selectedTaskCard.title}
              </div>
              <p className="text-sm leading-6 text-[var(--text-muted)]">{copy.slotBody}</p>
            </div>
            <SurfaceCard className="rounded-[24px] border-[var(--border)] bg-[var(--surface-muted)] p-5 shadow-none">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{selectedTaskCard.company}</div>
              <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--text-strong)]">
                {selectedTaskCard.slots_total - selectedTaskCard.slots_taken} / {selectedTaskCard.slots_total} {copy.slotsLabel}
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/80 dark:bg-white/10">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
                  style={{ width: `${Math.min(100, Math.max(10, (selectedTaskCard.slots_taken / selectedTaskCard.slots_total) * 100))}%` }}
                />
              </div>
              {selectedTaskCard.dialogue_window_label ? (
                <div className="mt-3 text-xs text-[var(--text-faint)]">Window: {selectedTaskCard.dialogue_window_label}</div>
              ) : null}
            </SurfaceCard>
            <div className="flex flex-wrap gap-3">
              <button type="button" className="app-button-primary app-organic-cta" onClick={handleReserveSlot}>
                {copy.slotCta}
              </button>
              <button
                type="button"
                className="app-button-secondary"
                onClick={() => updateSession((current) => ({ ...current, selected_task_id: null, current_step: 'real_task_pick' }))}
              >
                {copy.slotChange}
              </button>
            </div>
          </SurfaceCard>
        ) : null}

        {session.current_step === 'trial_task' && selectedTask ? (
          <SurfaceCard className="w-full max-w-5xl space-y-6 rounded-[30px] border-[var(--border)] bg-white/92 p-6 shadow-[0_30px_110px_-54px_rgba(15,23,42,0.38)] dark:bg-slate-950/94 sm:p-8">
            {renderHeader()}
            <div className="space-y-2">
              <div className="app-eyebrow w-fit">
                <Sparkles size={14} />
                {copy.trialTitle}
              </div>
              <div className="text-3xl font-semibold tracking-[-0.05em] text-[var(--text-strong)]">{selectedTask.title}</div>
              <p className="max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
                {selectedTask.challenge || selectedTask.firstStepPrompt || selectedTask.aiAnalysis?.summary || copy.trialBody}
              </p>
            </div>
            <ChallengeComposer
              job={selectedTask}
              userProfile={currentProfile}
              onRequireAuth={() => undefined}
              onOpenSupportingContext={() => {
                updateSession((current) => ({ ...current, current_step: 'profile_nudge' }));
                setProfileNudgeIndex(Math.max(0, missingProfileSteps.indexOf('supporting_context')));
              }}
              onDialogueOpened={() => {
                handleDialogueOpened().catch(() => undefined);
              }}
            />
          </SurfaceCard>
        ) : null}

        {session.current_step === 'decision' && session.evaluation ? (
          <SurfaceCard className="w-full max-w-4xl space-y-6 rounded-[30px] border-[var(--border)] bg-white/92 p-6 shadow-[0_30px_110px_-54px_rgba(15,23,42,0.38)] dark:bg-slate-950/94 sm:p-8">
            {renderHeader()}
            <div className="space-y-2">
              <div className="app-eyebrow w-fit">
                <CheckCircle2 size={14} />
                {copy.decisionTitle}
              </div>
              <div className="text-3xl font-semibold tracking-[-0.05em] text-[var(--text-strong)]">
                {selectedTask ? selectedTask.title : session.evaluation.summary || copy.decisionTitle}
              </div>
              {onboardingNarrative ? (
                <p className="max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
                  {onboardingNarrative}
                </p>
              ) : null}
              {!selectedTask && session.interest_reveal_draft.trim() ? (
                <p className="max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
                  {session.interest_reveal_draft.trim()}
                </p>
              ) : null}
            </div>
            {(summaryChips.length > 0 || skillsSummary.length > 0 || missingSummary.length > 0) ? (
              <SurfaceCard className="space-y-4 rounded-[22px] border-[var(--border)] bg-[var(--surface-muted)] p-4 shadow-none">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.summaryTitle}</div>
                {summaryChips.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {summaryChips.map((item) => (
                      <div key={item} className="rounded-full bg-white/80 px-3 py-2 text-xs font-medium text-[var(--text)] dark:bg-white/10">
                        {item}
                      </div>
                    ))}
                  </div>
                ) : null}
                {skillsSummary.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.summarySkills}</div>
                    <div className="flex flex-wrap gap-2">
                      {skillsSummary.map((item) => (
                        <div key={item} className="rounded-full border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--text)]">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {missingSummary.length > 0 ? (
                  <div className="text-sm leading-6 text-[var(--text-muted)]">
                    {copy.summaryMissingPrefix} {missingSummary.join(', ')}.
                  </div>
                ) : null}
              </SurfaceCard>
            ) : null}
            <div className="grid gap-4 md:grid-cols-3">
              <SurfaceCard className="space-y-3 rounded-[22px] border-[var(--border)] bg-[var(--surface-muted)] p-4 shadow-none">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.workedTitle}</div>
                <div className="space-y-2 text-sm leading-6 text-[var(--text)]">
                  {(session.evaluation.strengths.length > 0 ? session.evaluation.strengths : [session.evaluation.summary]).slice(0, 3).map((item) => (
                    <div key={item}>✔ {item}</div>
                  ))}
                </div>
              </SurfaceCard>
              <SurfaceCard className="space-y-3 rounded-[22px] border-[var(--border)] bg-[var(--surface-muted)] p-4 shadow-none">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.missedTitle}</div>
                <div className="space-y-2 text-sm leading-6 text-[var(--text)]">
                  {(session.evaluation.misses.length > 0 ? session.evaluation.misses : ['The first answer can still get sharper.']).slice(0, 3).map((item) => (
                    <div key={item}>✖ {item}</div>
                  ))}
                </div>
              </SurfaceCard>
              <SurfaceCard className="space-y-3 rounded-[22px] border-[var(--border)] bg-[var(--surface-muted)] p-4 shadow-none">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.tradeoffsTitle}</div>
                <div className="space-y-2 text-sm leading-6 text-[var(--text)]">
                  <div>⚖ {session.evaluation.reality_check}</div>
                  {selectedTask ? <div>→ JHI {Math.round(Number(selectedTask.jhi?.score || 0))}/100</div> : null}
                  {session.evaluation.role_signals[0] ? <div>→ {session.evaluation.role_signals[0]}</div> : null}
                  {!selectedTask && session.selected_intent ? <div>→ {copy.intentOptions[session.selected_intent]}</div> : null}
                </div>
              </SurfaceCard>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" className="app-button-primary app-organic-cta" onClick={() => finalizeFlow().catch(() => undefined)}>
                {selectedTask ? copy.continueCompany : copy.finishCta}
              </button>
              {selectedTask ? (
                <button
                  type="button"
                  className="app-button-secondary"
                  onClick={() => updateSession((current) => ({ ...current, selected_task_id: null, current_step: 'real_task_pick' }))}
                >
                  {copy.tryAnother}
                </button>
              ) : (
                <button
                  type="button"
                  className="app-button-secondary"
                  onClick={() => updateSession((current) => ({ ...current, selected_intent: 'try_real_work', current_step: 'real_task_pick' }))}
                >
                  {copy.intentOptions.try_real_work}
                </button>
              )}
            </div>
          </SurfaceCard>
        ) : null}

        {session.current_step === 'profile_nudge' ? renderProfileNudge() : null}

        {session.current_step === 'done' ? (
          <SurfaceCard className="w-full max-w-3xl space-y-5 rounded-[30px] border-[var(--border)] bg-white/92 p-7 text-center shadow-[0_30px_110px_-54px_rgba(15,23,42,0.38)] dark:bg-slate-950/94 sm:p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-[rgba(var(--accent-rgb),0.1)] text-[var(--accent)]">
              <CheckCircle2 size={28} />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-semibold tracking-[-0.05em] text-[var(--text-strong)]">{copy.finishTitle}</h2>
              <p className="text-sm leading-6 text-[var(--text-muted)]">{copy.finishBody}</p>
              {onboardingNarrative ? (
                <p className="text-sm leading-6 text-[var(--text-muted)]">{onboardingNarrative}</p>
              ) : null}
            </div>
            {(summaryChips.length > 0 || skillsSummary.length > 0) ? (
              <SurfaceCard className="space-y-4 rounded-[22px] border-[var(--border)] bg-[var(--surface-muted)] p-4 text-left shadow-none">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.summaryTitle}</div>
                {summaryChips.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {summaryChips.map((item) => (
                      <div key={item} className="rounded-full bg-white/80 px-3 py-2 text-xs font-medium text-[var(--text)] dark:bg-white/10">
                        {item}
                      </div>
                    ))}
                  </div>
                ) : null}
                {skillsSummary.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.summarySkills}</div>
                    <div className="flex flex-wrap gap-2">
                      {skillsSummary.map((item) => (
                        <div key={item} className="rounded-full border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--text)]">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </SurfaceCard>
            ) : null}
            <div className="flex justify-center gap-3">
              <button type="button" className="app-button-primary app-organic-cta" onClick={() => finishAndClose().catch(() => undefined)}>
                {copy.finishCta}
              </button>
              {onGoToProfile ? (
                <button type="button" className="app-button-secondary" onClick={onGoToProfile}>
                  {copy.openProfile}
                </button>
              ) : null}
            </div>
          </SurfaceCard>
        ) : null}
      </div>
    </div>
  );
};

export default CandidateOnboardingModal;
