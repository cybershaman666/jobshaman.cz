import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  BadgeCheck,
  BookOpen,
  Briefcase,
  Camera,
  ChevronRight,
  Compass,
  Cpu,
  Filter,
  FileText,
  GraduationCap,
  HelpCircle,
  Languages,
  Link2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react';

import type { CandidateLanguage, CVDocument, Education, TransportMode, UserProfile, WorkExperience } from '../../types';
import type { CandidatePreferenceProfile } from '../models';
import { cn } from '../cn';
import { CandidateShellSurface, SectionEyebrow, ShellCard } from './CandidateShellSurface';
import { primaryButtonClass, secondaryButtonClass } from '../ui/shellStyles';
import { validateCvFile } from '../../services/v2CvService';
import { buildCandidateSearchPresets } from '../../services/searchProfilePresets';
import { createDefaultCandidateSearchProfile } from '../../services/profileDefaults';
import { getCandidateIntentDomainLabel, resolveCandidateIntentProfile } from '../../services/candidateIntentService';
import { getStaticCoordinates } from '../../services/geocodingService';



const formatVisibility = (value?: string, t?: (k: string, d: string) => string) => {
  const _t = t || ((_k: string, d: string) => d);
  if (value === 'public') return _t('rebuild.profile.visibility_public', 'Veřejný profil');
  if (value === 'recruiter') return _t('rebuild.profile.visibility_recruiter', 'Viditelný firmám');
  return _t('rebuild.profile.visibility_private', 'Soukromý profil');
};

const formatTransportMode = (value?: string, t?: (k: string, d: string) => string) => {
  const _t = t || ((_k: string, d: string) => d);
  if (value === 'car') return _t('rebuild.profile.transport_car', 'Auto');
  if (value === 'public' || value === 'public_transport') return _t('rebuild.profile.transport_public', 'MHD / vlak');
  if (value === 'bike') return _t('rebuild.profile.transport_bike', 'Kolo');
  if (value === 'walk' || value === 'walking') return _t('rebuild.profile.transport_walk', 'Pěšky');
  return _t('rebuild.profile.transport_flexible', 'Dle příležitosti');
};

const formatEmploymentType = (value?: string, t?: (k: string, d: string) => string) => {
  const _t = t || ((_k: string, d: string) => d);
  if (value === 'full_time') return _t('rebuild.profile.employment_full_time', 'Plný úvazek');
  if (value === 'part_time') return _t('rebuild.profile.employment_part_time', 'Zkrácený úvazek');
  if (value === 'contract') return _t('rebuild.profile.employment_contract', 'Kontrakt');
  if (value === 'internship') return _t('rebuild.profile.employment_internship', 'Stáž');
  if (value === 'temporary') return _t('rebuild.profile.employment_temporary', 'Dočasná spolupráce');
  return _t('rebuild.profile.employment_flexible', 'Flexibilní');
};

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: 'full_time', label: 'Plný úvazek' },
  { value: 'part_time', label: 'Zkrácený úvazek' },
  { value: 'contract', label: 'Kontrakt' },
  { value: 'internship', label: 'Stáž' },
  { value: 'temporary', label: 'Dočasná spolupráce' },
] as const;

const TRANSPORT_MODE_OPTIONS = [
  { value: 'public', label: 'Dle příležitosti' },
  { value: 'car', label: 'Auto' },
  { value: 'bike', label: 'Kolo' },
  { value: 'walk', label: 'Pěšky' },
] as const;

const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Soukromý profil' },
  { value: 'recruiter', label: 'Viditelný firmám' },
  { value: 'public', label: 'Veřejný profil' },
] as const;

const parseListInput = (value: string) =>
  value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

const listToInput = (values?: string[]) => (values || []).join('\n');

const clampLanguageLevel = (value: number) => Math.max(1, Math.min(8, Math.round(value || 1)));

const normalizeLanguages = (languages?: CandidateLanguage[]) =>
  (languages || [])
    .map((language) => ({
      label: String(language.label || '').trim(),
      level: clampLanguageLevel(Number(language.level || 1)),
      note: String(language.note || '').trim(),
    }))
    .filter((language) => language.label);

type ProfileEditForm = {
  name: string;
  jobTitle: string;
  phone: string;
  address: string;
  story: string;
  skillsText: string;
  inferredSkillsText: string;
  workPreferencesText: string;
  languages: CandidateLanguage[];
  desiredEmploymentType: UserProfile['preferences']['desired_employment_type'] | '';
  desiredSalaryMin: string;
  desiredSalaryMax: string;
  profileVisibility: NonNullable<UserProfile['preferences']['profile_visibility']>;
  searchRadiusKm: string;
  transportMode: TransportMode;
  linkedIn: string;
  portfolio: string;
};

const formatUploadedAt = (value?: string) => {
  if (!value) return 'Právě teď'; // i18n: rebuild.profile.uploaded_just_now
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('cs-CZ');
};

const computeProfileCompletion = (userProfile: UserProfile, preferences: CandidatePreferenceProfile, cvDocuments: CVDocument[]) => {
  const checkpoints = [
    Boolean(userProfile.name?.trim()),
    Boolean(userProfile.jobTitle?.trim()),
    Boolean(userProfile.address?.trim()),
    Boolean(userProfile.phone?.trim()),
    Boolean((userProfile.skills || []).length),
    Boolean((userProfile.workHistory || []).length),
    Boolean((userProfile.education || []).length),
    Boolean(userProfile.photo),
    Boolean(cvDocuments.length),
    Boolean(preferences.linkedInUrl || preferences.portfolioUrl),
    Boolean(userProfile.story?.trim()),
  ];

  return Math.round((checkpoints.filter(Boolean).length / checkpoints.length) * 100);
};

const deriveStrengthMetrics = (userProfile: UserProfile, completion: number, t?: (k: string, d: string) => string) => {
  const snapshot = userProfile.preferences?.jcfpm_v1;
  const isJcfpmComplete = !!snapshot || !!userProfile.hasAssessment;
  
  if (!isJcfpmComplete) {
    return [
      { label: t ? t('rebuild.profile.strength_reliability', 'Spolehlivost') : 'Spolehlivost', value: 0 },
      { label: t ? t('rebuild.profile.strength_practical_thinking', 'Praktické myšlení') : 'Praktické myšlení', value: 0 },
      { label: t ? t('rebuild.profile.strength_teamwork', 'Týmovost') : 'Týmovost', value: 0 },
      { label: t ? t('rebuild.profile.strength_stress_resilience', 'Odolnost ve stresu') : 'Odolnost ve stresu', value: 0 },
      { label: t ? t('rebuild.profile.strength_learning', 'Učení se') : 'Učení se', value: 0 },
    ];
  }

  const scores = snapshot?.dimension_scores || [];
  const find = (dimension: string, fallback: number) => {
    const item = scores.find((entry) => String(entry.dimension) === dimension);
    return Math.max(35, Math.min(96, Math.round(Number(item?.percentile || fallback))));
  };

  return [
    { label: t ? t('rebuild.profile.strength_reliability', 'Spolehlivost') : 'Spolehlivost', value: find('d5_values', 76) },
    { label: t ? t('rebuild.profile.strength_practical_thinking', 'Praktické myšlení') : 'Praktické myšlení', value: find('d11_problem_decomposition', 72) },
    { label: t ? t('rebuild.profile.strength_teamwork', 'Týmovost') : 'Týmovost', value: find('d2_social', 68) },
    { label: t ? t('rebuild.profile.strength_stress_resilience', 'Odolnost ve stresu') : 'Odolnost ve stresu', value: find('d4_energy', 66) },
    { label: t ? t('rebuild.profile.strength_learning', 'Učení se') : 'Učení se', value: find('d6_ai_readiness', Math.max(58, completion - 8)) },
  ];
};

const buildRadarPoints = (values: number[], radius: number, center = 110) =>
  values
    .map((value, index) => {
      const angle = (-Math.PI / 2) + ((Math.PI * 2) / values.length) * index;
      const pointRadius = (radius * value) / 100;
      const x = center + Math.cos(angle) * pointRadius;
      const y = center + Math.sin(angle) * pointRadius;
      return `${x},${y}`;
    })
    .join(' ');

const extractSkills = (userProfile: UserProfile, activeCvDocument: CVDocument | null) =>
  Array.from(new Set([
    ...(activeCvDocument?.parsedData?.skills || []),
    ...(userProfile.skills || []),
    ...(userProfile.inferredSkills || []),
  ])).filter(Boolean);

const extractWorkHistory = (userProfile: UserProfile, activeCvDocument: CVDocument | null): WorkExperience[] =>
  (activeCvDocument?.parsedData?.workHistory || userProfile.workHistory || []).slice(0, 4);

const extractEducation = (userProfile: UserProfile, activeCvDocument: CVDocument | null, t: any): Education[] => {
  const source = activeCvDocument?.parsedData?.education || userProfile.education || [];
  const certifications = (userProfile.certifications || []).slice(0, 2).map((item, index) => ({
    id: `cert-${index}`,
    school: t ? t('rebuild.profile.certifications_label', 'Certifikace') : 'Certifikace',
    degree: item,
    field: t ? t('rebuild.profile.certificates_label', 'Osvědčení') : 'Osvědčení',
    year: '',
  }));
  return [...source, ...certifications].slice(0, 4);
};

const normalizeNarrative = (...values: Array<string | null | undefined>) =>
  values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' \n ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const hasAny = (text: string, needles: string[]) => needles.some((needle) => text.includes(needle));

const capitalizeLabel = (value: string) => value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

const deriveIdentityNarrative = (userProfile: UserProfile, t?: (k: string, d: string) => string) => {
  const locale = userProfile.preferredLocale || 'cs';
  const intent = resolveCandidateIntentProfile(userProfile);
  const storyText = normalizeNarrative(
    userProfile.story,
    userProfile.preferences?.candidate_onboarding_v2?.interest_reveal,
    userProfile.cvAiText,
    userProfile.jobTitle,
    userProfile.preferences?.desired_role,
  );
  const builderSignals = hasAny(storyText, ['stav', 'builder', 'system', 'architekt', 'infrastr', 'prototyp', 'earthship', 'merkur']);
  const mobilitySignals = hasAny(storyText, ['vlak', 'letadl', 'mobilit', 'dispatch', 'dispec', 'doprav']);
  const humanSignals = hasAny(storyText, ['lidem', 'lidi', 'lidskost', 'human', 'pomoc', 'pomohl', 'trh prace']);
  const aiSignals = hasAny(storyText, ['ai', 'automat', 'workflow', 'platform']);
  const sustainabilitySignals = hasAny(storyText, ['eko', 'earthship', 'energie', 'vodni elektrarn', 'prirod', 'udrz']);
  const routineAversion = hasAny(storyText, ['rutinu', 'excel', 'administr', 'repet', 'kancelari']);
  const sideIncomeSignals = hasAny(storyText, ['vedlejsi zdroj prijmu', 'vedlejší zdroj příjmu', 'micro-project', 'sandbox', 'consulting']);

  const targetRole = intent.targetRole || userProfile.preferences?.desired_role || userProfile.jobTitle || (t ? t('rebuild.profile.target_role_fallback', 'Systémový tvůrce') : 'Systémový tvůrce');
  const primaryDomainLabel = getCandidateIntentDomainLabel(intent.primaryDomain, locale) || (t ? t('rebuild.profile.domain_fallback', 'Systémová tvorba') : 'Systémová tvorba');
  const secondaryLabels = intent.secondaryDomains
    .map((domain) => getCandidateIntentDomainLabel(domain, locale))
    .filter(Boolean);

  const isJcfpmComplete = !!userProfile.preferences?.jcfpm_v1 || !!userProfile.hasAssessment;

  const feedPriorities = [
    builderSignals ? (t ? t('rebuild.profile.feed_priority_project', 'Projektová a návrhová práce') : 'Projektová a návrhová práce') : '',
    aiSignals ? (t ? t('rebuild.profile.feed_priority_ai', 'AI workflow a platformy') : 'AI workflow a platformy') : '',
    mobilitySignals ? (t ? t('rebuild.profile.feed_priority_mobility', 'Mobilita a infrastruktura') : 'Mobilita a infrastruktura') : '',
    humanSignals ? (t ? t('rebuild.profile.feed_priority_human', 'Human-centric technologie') : 'Human-centric technologie') : '',
    t ? t('rebuild.profile.feed_priority_complex', 'Komplexní systémové role') : 'Komplexní systémové role',
  ].filter(Boolean).slice(0, 4);

  const feedAvoid = [
    routineAversion ? (t ? t('rebuild.profile.feed_avoid_routine', 'Rutinní administrativa') : 'Rutinní administrativa') : '',
    routineAversion ? (t ? t('rebuild.profile.feed_avoid_execution', 'Čistě exekuční role') : 'Čistě exekuční role') : '',
    t ? t('rebuild.profile.feed_avoid_rigid', 'Rigidní operativa') : 'Rigidní operativa',
    t ? t('rebuild.profile.feed_avoid_no_autonomy', 'Práce bez autonomie') : 'Práce bez autonomie',
  ].filter(Boolean).slice(0, 4);

  const feedMode = sideIncomeSignals
    ? (t ? t('rebuild.profile.feed_mode_sandbox', 'Micro-projects · challenge contracts · sandbox consulting') : 'Micro-projects · challenge contracts · sandbox consulting')
    : (t ? t('rebuild.profile.feed_mode_design', 'System design · innovation tracks · architecture challenges') : 'System design · innovation tracks · architecture challenges');

  const coreSignalEvent = storyText.includes('earthship')
    ? {
      title: t ? t('rebuild.profile.earthship_moment_title', 'Core Signal Event: Earthship moment') : 'Core Signal Event: Earthship moment',
      body: t ? t('rebuild.profile.earthship_moment_body', 'Došel jsi k řešení typu Earthship bez znalosti existujícího konceptu. To je silný marker nezávislé systémové představivosti a architektonického myšlení.') : 'Došel jsi k řešení typu Earthship bez znalosti existujícího konceptu. To je silný marker nezávislé systémové představivosti a architektonického myšlení.',
    }
    : {
      title: t ? t('rebuild.profile.core_signal_title', 'Core Signal Event') : 'Core Signal Event',
      body: t ? t('rebuild.profile.core_signal_body', 'AI ve tvém příběhu hledá momenty, kdy ses samostatně dostal k neobvyklému, ale funkčnímu řešení. Tyhle momenty pak používá při matchingu rezonance.') : 'AI ve tvém příběhu hledá momenty, kdy ses samostatně dostal k neobvyklému, ale funkčnímu řešení. Tyhle momenty pak používá při matchingu rezonance.',
    };

  const jhiWeights = builderSignals
    ? [
      { label: t ? t('jhi.label_values', 'Values fit') : 'Values fit', value: 0.35 },
      { label: t ? t('jhi.label_growth', 'Growth') : 'Growth', value: 0.25 },
      { label: t ? t('rebuild.profile.weight_autonomy', 'Autonomy') : 'Autonomy', value: 0.25 },
      { label: t ? t('jhi.label_financial', 'Finance') : 'Finance', value: 0.10 },
      { label: t ? t('rebuild.profile.weight_stability', 'Stability') : 'Stability', value: 0.05 },
    ]
    : [
      { label: t ? t('jhi.label_growth', 'Growth') : 'Growth', value: 0.28 },
      { label: t ? t('jhi.label_values', 'Values fit') : 'Values fit', value: 0.24 },
      { label: t ? t('rebuild.profile.weight_autonomy', 'Autonomy') : 'Autonomy', value: 0.20 },
      { label: t ? t('jhi.label_financial', 'Finance') : 'Finance', value: 0.16 },
      { label: t ? t('rebuild.profile.weight_stability', 'Stability') : 'Stability', value: 0.12 },
    ];

  const identityTitle = isJcfpmComplete
    ? (builderSignals ? 'Vizionářský architekt systémů' : humanSignals && aiSignals ? 'Tvůrce human-centric technologií' : capitalizeLabel(targetRole))
    : (userProfile.jobTitle || (t ? t('rebuild.profile.profile_composing', 'Profil se skládá...') : 'Profil se skládá...'));

  const identitySummary = isJcfpmComplete
    ? (builderSignals
        ? (t ? t('rebuild.profile.narrative_builder', 'Tvoje energie patří do tvorby systémů, které propojují lidi, technologie a prostředí. Rutina tě oslabuje, komplexita tě nabíjí.') : 'Tvoje energie patří do tvorby systémů, které propojují lidi, technologie a prostředí. Rutina tě oslabuje, komplexita tě nabíjí.')
        : humanSignals
          ? (t ? t('rebuild.profile.narrative_human', 'Silný signál směřuje k rolím, kde se propojuje dopad na lidi, změna systému a práce s nejasností.') : 'Silný signál směřuje k rolím, kde se propojuje dopad na lidi, změna systému a práce s nejasností.')
          : (t ? t('rebuild.profile.narrative_creator', 'AI z tvého onboardingu čte směr, ve kterém máš tvořit, né jen vykonávat.') : 'AI z tvého onboardingu čte směr, ve kterém máš tvořit, né jen vykonávat.'))
    : (t ? t('rebuild.profile.complete_test_narrative', 'Dokonči JCFPM test a Cybershaman ti vytvoří přesnou pracovní identitu.') : 'Dokonči JCFPM test a Cybershaman ti vytvoří přesnou pracovní identitu.');

  const directions = isJcfpmComplete
    ? [
        { label: primaryDomainLabel || 'System architecture', tone: 'primary' as const },
        ...(aiSignals ? [{ label: 'AI + human interface systems', tone: 'secondary' as const }] : []),
        ...(sustainabilitySignals ? [{ label: 'Sustainable infrastructure', tone: 'secondary' as const }] : []),
        ...(mobilitySignals ? [{ label: 'Mobility platforms', tone: 'explore' as const }] : []),
        ...secondaryLabels.slice(0, 2).map((label, index) => ({ label, tone: index === 0 ? 'secondary' as const : 'explore' as const })),
      ].filter((item, index, list) => list.findIndex((candidate) => candidate.label === item.label) === index).slice(0, 4)
    : [];

  return {
    intent,
    identityTitle,
    identitySummary,
    targetRole,
    primaryDomainLabel,
    directions,
    feedPriorities: isJcfpmComplete ? feedPriorities : [],
    feedAvoid: isJcfpmComplete ? feedAvoid : [],
    feedMode: isJcfpmComplete ? feedMode : 'Standard matching',
    coreSignalEvent,
    jhiWeights: isJcfpmComplete ? jhiWeights : [],
    burnoutRisk: isJcfpmComplete ? (routineAversion ? (t ? t('rebuild.profile.burnout_risk_routine', 'Rutinní administrativní role') : 'Rutinní administrativní role') : (t ? t('rebuild.profile.burnout_risk_no_autonomy', 'Role bez autonomie a dlouhodobého smyslu') : 'Role bez autonomie a dlouhodobého smyslu')) : (t ? t('rebuild.profile.to_be_refined_jcfpm', 'Bude upřesněno po JCFPM') : 'Bude upřesněno po JCFPM'),
    strongZone: isJcfpmComplete ? (builderSignals ? (t ? t('rebuild.profile.strong_zone_builder', 'Komplexní návrh systémů bez existující šablony') : 'Komplexní návrh systémů bez existující šablony') : (t ? t('rebuild.profile.strong_zone_creator', 'Tvorba nových struktur a orientace v nejasnosti') : 'Tvorba nových struktur a orientace v nejasnosti')) : (t ? t('rebuild.profile.to_be_refined_jcfpm', 'Bude upřesněno po JCFPM') : 'Bude upřesněno po JCFPM'),
  };
};

const DetailRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="grid grid-cols-[124px_1fr] gap-3 text-[13px]">
    <div className="text-[color:var(--dashboard-text-muted)]">{label}</div>
    <div className="font-medium text-[color:var(--dashboard-text-strong)]">{value}</div>
  </div>
);

const SectionCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, icon, action, children, className }) => (
  <ShellCard className={cn('h-full p-5', className)}>
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[color:color-mix(in_srgb,var(--dashboard-soft-bg)_94%,white)] text-[color:var(--dashboard-gold)]">
          {icon}
        </div>
        <div className="text-[1.05rem] font-semibold text-[color:var(--dashboard-text-strong)]">{title}</div>
      </div>
      {action}
    </div>
    <div className="mt-5">{children}</div>
  </ShellCard>
);

export const CandidateProfileV2: React.FC<{
  userProfile: UserProfile;
  setUserProfile?: (updates: Partial<UserProfile>) => void;
  preferences: CandidatePreferenceProfile;
  activeCvDocument: CVDocument | null;
  cvDocuments: CVDocument[];
  cvLoading?: boolean;
  cvBusy?: boolean;
  isSavingProfile?: boolean;
  onSaveProfile?: (updates?: Partial<UserProfile>) => void | Promise<void>;
  onUploadCv?: (file: File) => Promise<void>;
  onSelectCv?: (cvId: string) => Promise<void>;
  onDeleteCv?: (cvId: string) => Promise<void>;
  onUploadPhoto?: (file: File) => Promise<void>;
  navigate: (path: string) => void;
}> = ({
  userProfile,
  setUserProfile,
  preferences,
  activeCvDocument,
  cvDocuments,
  cvLoading,
  cvBusy,
  isSavingProfile,
  onSaveProfile,
  onUploadCv,
  onSelectCv,
  onDeleteCv,
  onUploadPhoto,
  navigate,
}) => {
    const { t } = useTranslation();
    const photoInputRef = React.useRef<HTMLInputElement | null>(null);
    const cvInputRef = React.useRef<HTMLInputElement | null>(null);
    const [photoUploading, setPhotoUploading] = React.useState(false);
    const [photoError, setPhotoError] = React.useState('');
    const [cvError, setCvError] = React.useState('');
    const [cvNotice, setCvNotice] = React.useState('');
    const [isEditingProfile, setIsEditingProfile] = React.useState(false);
    const buildEditForm = React.useCallback((): ProfileEditForm => ({
      name: userProfile.name || '',
      jobTitle: userProfile.jobTitle || '',
      phone: userProfile.phone || '',
      address: userProfile.address || preferences.address || '',
      story: userProfile.story || userProfile.bio || '',
      skillsText: listToInput(userProfile.skills),
      inferredSkillsText: listToInput(userProfile.inferredSkills),
      workPreferencesText: listToInput(userProfile.workPreferences),
      languages: normalizeLanguages(userProfile.languages),
      desiredEmploymentType: userProfile.preferences?.desired_employment_type || '',
      desiredSalaryMin: userProfile.preferences?.desired_salary_min ? String(userProfile.preferences.desired_salary_min) : '',
      desiredSalaryMax: userProfile.preferences?.desired_salary_max ? String(userProfile.preferences.desired_salary_max) : '',
      profileVisibility: userProfile.preferences?.profile_visibility || 'private',
      searchRadiusKm: String(preferences.searchRadiusKm || userProfile.preferences?.searchProfile?.defaultMaxDistanceKm || 25),
      transportMode: userProfile.transportMode || preferences.transportMode || 'public',
      linkedIn: userProfile.preferences?.linkedIn || preferences.linkedInUrl || '',
      portfolio: userProfile.preferences?.portfolio || preferences.portfolioUrl || '',
    }), [preferences.address, preferences.linkedInUrl, preferences.portfolioUrl, preferences.searchRadiusKm, preferences.transportMode, userProfile]);
    const [editForm, setEditForm] = React.useState<ProfileEditForm>(buildEditForm);

    const currentProfileForm = React.useMemo(() => buildEditForm(), [buildEditForm]);

    React.useEffect(() => {
      if (isEditingProfile) return;
      setEditForm(currentProfileForm);
    }, [currentProfileForm, isEditingProfile]);

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

    const handleSaveEdit = async () => {
      const detectedCountry = resolveCountryFromAddress(editForm.address);
      const staticCoordinates = getStaticCoordinates(editForm.address);
      const basePreferences: UserProfile['preferences'] = userProfile.preferences || {
        workLifeBalance: 50,
        financialGoals: 50,
        commuteTolerance: 45,
        priorities: [],
      };
      const nextPreferences: UserProfile['preferences'] = {
        ...basePreferences,
        desired_employment_type: editForm.desiredEmploymentType || undefined,
        desired_salary_min: editForm.desiredSalaryMin ? Number(editForm.desiredSalaryMin) : null,
        desired_salary_max: editForm.desiredSalaryMax ? Number(editForm.desiredSalaryMax) : null,
        profile_visibility: editForm.profileVisibility as UserProfile['preferences']['profile_visibility'],
        linkedIn: editForm.linkedIn.trim() || undefined,
        portfolio: editForm.portfolio.trim() || undefined,
        searchProfile: {
          ...(basePreferences.searchProfile || createDefaultCandidateSearchProfile()),
          defaultMaxDistanceKm: Math.max(0, Number(editForm.searchRadiusKm) || 0),
        },
      };
      const updates = {
        name: editForm.name.trim(),
        jobTitle: editForm.jobTitle.trim(),
        phone: editForm.phone.trim(),
        address: editForm.address.trim(),
        story: editForm.story.trim(),
        bio: editForm.story.trim(),
        skills: parseListInput(editForm.skillsText),
        inferredSkills: parseListInput(editForm.inferredSkillsText),
        workPreferences: parseListInput(editForm.workPreferencesText),
        languages: normalizeLanguages(editForm.languages),
        transportMode: editForm.transportMode as UserProfile['transportMode'],
        preferences: nextPreferences,
        ...(staticCoordinates ? { coordinates: staticCoordinates } : {}),
      };
      setUserProfile?.(updates);

      if (detectedCountry && (detectedCountry as any) !== preferences.taxProfile.countryCode) {
        // We can't call handleTaxCountryChange here easily if it's not passed, 
        // but we can update preferences directly if we have setPreferences
        // CandidateProfileV2 doesn't have setPreferences in its props based on CandidateDashboardV2
      }
      await onSaveProfile?.(updates);
      setIsEditingProfile(false);
    };

    const updateLanguage = (index: number, updates: Partial<CandidateLanguage>) => {
      setEditForm((prev) => ({
        ...prev,
        languages: prev.languages.map((language, itemIndex) => (
          itemIndex === index ? { ...language, ...updates } : language
        )),
      }));
    };

    const addLanguage = () => {
      setEditForm((prev) => ({
        ...prev,
        languages: [...prev.languages, { label: '', level: 3, note: '' }],
      }));
    };

    const removeLanguage = (index: number) => {
      setEditForm((prev) => ({
        ...prev,
        languages: prev.languages.filter((_, itemIndex) => itemIndex !== index),
      }));
    };

    const completion = React.useMemo(
      () => computeProfileCompletion(userProfile, preferences, cvDocuments),
      [cvDocuments, preferences, userProfile],
    );
    const strengthMetrics = React.useMemo(
      () => deriveStrengthMetrics(userProfile, completion, t),
      [completion, userProfile, t],
    );
    const skills = React.useMemo(
      () => extractSkills(userProfile, activeCvDocument),
      [activeCvDocument, userProfile],
    );
    const languages = React.useMemo(
      () => normalizeLanguages(userProfile.languages),
      [userProfile.languages],
    );
    const workHistory = React.useMemo(
      () => extractWorkHistory(userProfile, activeCvDocument),
      [activeCvDocument, userProfile],
    );
const education = React.useMemo(
  () => extractEducation(userProfile, activeCvDocument, t),
  [activeCvDocument, userProfile, t],
);
    const identityModel = React.useMemo(
      () => deriveIdentityNarrative(userProfile, t),
      [userProfile, t],
    );
    const searchPresets = React.useMemo(
      () => buildCandidateSearchPresets(userProfile, userProfile.preferredLocale || 'cs').slice(0, 3),
      [userProfile],
    );
    const completionTasks = React.useMemo(() => [
      { id: 'experience', label: t('rebuild.profile.add_experience_task', 'Přidej zkušenosti'), copy: t('rebuild.profile.add_experience_task_desc', 'Doplň další pracovní zkušenosti') },
      { id: 'skills', label: t('rebuild.profile.verify_skills_task', 'Ověř své dovednosti'), copy: t('rebuild.profile.verify_skills_task_desc', 'Získej odznaky a zvyšte důvěryhodnost') },
      { id: 'signals', label: t('rebuild.profile.answer_questions_task', 'Odpověz na otázky'), copy: t('rebuild.profile.answer_questions_task_desc', 'Pomůže nám to lépe tě poznat') },
    ], [t]);

    const isJcfpmComplete = !!userProfile.preferences?.jcfpm_v1 || !!userProfile.hasAssessment;
    const archetypeTitle = userProfile.preferences?.jcfpm_v1?.archetype?.title || userProfile.jobTitle || t('rebuild.profile.profile_composing', 'Profil se skládá...');
    const archetypeCopy = userProfile.preferences?.jcfpm_v1?.archetype?.description || userProfile.story || t('rebuild.profile.complete_test_narrative', 'Doplň pár klíčových signálů a Cybershaman ti zpřesní pracovní identitu i doporučené role.');
    const jhiIndex = Math.max(520, Math.min(980, Math.round(completion * 8.7)));
    const desiredSalary = userProfile.preferences?.desired_salary_min
      ? `${userProfile.preferences.desired_salary_min.toLocaleString(userProfile.preferredLocale || 'cs')} ${(userProfile.preferredLocale === 'cs' || userProfile.preferredLocale === 'sk') ? 'Kč' : 'EUR'}`
      : t('rebuild.profile.not_specified', 'Neuvedeno');

    const handlePhotoInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        setPhotoError(t('rebuild.profile.only_images_supported', 'Nahrávat lze pouze obrázky.'));
        event.target.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setPhotoError(t('rebuild.profile.photo_too_large', 'Fotka nesmí přesáhnout velikost 5 MB.'));
        event.target.value = '';
        return;
      }
      try {
        setPhotoError('');
        setPhotoUploading(true);
        await onUploadPhoto?.(file);
      } catch (error) {
        setPhotoError(error instanceof Error ? error.message : t('rebuild.profile.photo_upload_failed', 'Nahrání fotky se nepovedlo.'));
      } finally {
        setPhotoUploading(false);
        event.target.value = '';
      }
    };

    const handleCvInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const validationError = validateCvFile(file);
      if (validationError) {
        setCvNotice('');
        setCvError(validationError === 'size' ? t('rebuild.profile.cv_too_large', 'Dokument nesmí přesáhnout velikost 10 MB.') : t('rebuild.profile.cv_format_unsupported', 'Podporovány jsou pouze dokumenty PDF nebo Word.'));
        event.target.value = '';
        return;
      }
      try {
        setCvError('');
        setCvNotice('');
        await onUploadCv?.(file);
        setCvNotice(`${t('rebuild.profile.uploaded', 'Nahráno')}: ${file.name}`);
      } catch (error) {
        setCvNotice('');
        setCvError(error instanceof Error ? error.message : t('rebuild.profile.cv_upload_failed', 'Nahrání dokumentu se nepovedlo.'));
      } finally {
        event.target.value = '';
      }
    };

    return (
      <CandidateShellSurface
        variant="profile"
        className="max-w-full px-2 pb-2 pt-1"
        eyebrow={<SectionEyebrow>{t('rebuild.profile.my_profile_title', 'Můj profil')}</SectionEyebrow>}
        title={t('rebuild.profile.my_profile_title', 'Můj profil')}
        subtitle={t('rebuild.profile.my_profile_subtitle', 'Tvé dovednosti, zkušenosti a potenciál na jednom místě.')}
        actions={(
          <>
            {userProfile.isLoggedIn ? (
              <div className="flex gap-2">
                <button type="button" onClick={() => { setEditForm(currentProfileForm); setIsEditingProfile(true); }} className={cn(secondaryButtonClass, 'rounded-[16px] px-4 py-2.5 text-sm')}>
                  {t('rebuild.profile.edit_profile', 'Upravit profil')}
                </button>
                <button type="button" onClick={() => void onSaveProfile?.()} disabled={isSavingProfile} className={cn(primaryButtonClass, 'rounded-[16px] px-4 py-2.5 text-sm disabled:opacity-60')}>
                  {isSavingProfile ? t('rebuild.profile.saving', 'Ukládám…') : t('rebuild.profile.save_to_server', 'Uložit na server')}
                </button>
              </div>
            ) : null}
          </>
        )}
      >
        {isEditingProfile ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
            <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[24px] bg-white p-6 shadow-xl">
              <h3 className="text-xl font-semibold text-slate-900">{t('rebuild.profile.edit_profile', 'Upravit profil')}</h3>
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('rebuild.profile.name_label', 'Jméno')}</label>
                    <input type="text" value={editForm.name} onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))} className="w-full rounded-[12px] border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-[#255DAB] focus:ring-2 focus:ring-[#255DAB]/20" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('rebuild.profile.role_label', 'Pracovní role')}</label>
                    <input type="text" value={editForm.jobTitle} onChange={(e) => setEditForm(prev => ({ ...prev, jobTitle: e.target.value }))} className="w-full rounded-[12px] border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-[#255DAB] focus:ring-2 focus:ring-[#255DAB]/20" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('rebuild.profile.phone_label', 'Telefon')}</label>
                    <input type="text" value={editForm.phone} onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))} className="w-full rounded-[12px] border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-[#255DAB] focus:ring-2 focus:ring-[#255DAB]/20" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('rebuild.profile.address_label', 'Adresa / lokalita')}</label>
                    <input type="text" value={editForm.address} onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))} className="w-full rounded-[12px] border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-[#255DAB] focus:ring-2 focus:ring-[#255DAB]/20" />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('rebuild.profile.story_label', 'Příběh / bio')}</label>
                  <textarea value={editForm.story} onChange={(e) => setEditForm(prev => ({ ...prev, story: e.target.value }))} rows={4} className="w-full rounded-[12px] border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-[#255DAB] focus:ring-2 focus:ring-[#255DAB]/20" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('rebuild.profile.skills_label', 'Dovednosti')}</label>
                  <textarea value={editForm.skillsText} onChange={(e) => setEditForm(prev => ({ ...prev, skillsText: e.target.value }))} rows={5} placeholder={t('rebuild.profile.skills_placeholder', 'Každou dovednost na nový řádek')} className="w-full rounded-[12px] border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-[#255DAB] focus:ring-2 focus:ring-[#255DAB]/20" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('rebuild.profile.inferred_skills_label', 'Odvozené / doplňkové dovednosti')}</label>
                  <textarea value={editForm.inferredSkillsText} onChange={(e) => setEditForm(prev => ({ ...prev, inferredSkillsText: e.target.value }))} rows={5} placeholder={t('rebuild.profile.inferred_skills_placeholder', 'Např. leadership, komunikace, analytika')} className="w-full rounded-[12px] border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-[#255DAB] focus:ring-2 focus:ring-[#255DAB]/20" />
                </div>
                <div className="md:col-span-2">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="block text-sm font-medium text-slate-700">{t('rebuild.profile.languages_label', 'Jazykové znalosti')}</label>
                    <button type="button" onClick={addLanguage} className={cn(secondaryButtonClass, 'rounded-full px-3 py-2 text-xs')}><Plus size={14} /> {t('rebuild.profile.add_language', 'Přidat jazyk')}</button>
                  </div>
                  <div className="space-y-3">
                    {editForm.languages.map((language, index) => (
                      <div key={`edit-language-${index}`} className="grid gap-3 rounded-[16px] border border-slate-200 p-3 md:grid-cols-[1fr_130px_1fr_auto] md:items-end">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">{t('rebuild.profile.language_name_label', 'Jazyk')}</label>
                          <input type="text" value={language.label} onChange={(e) => updateLanguage(index, { label: e.target.value })} className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#255DAB]" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">{t('rebuild.profile.level_label', 'Úroveň 1-8')}</label>
                          <input type="number" min={1} max={8} value={language.level} onChange={(e) => updateLanguage(index, { level: clampLanguageLevel(Number(e.target.value)) })} className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#255DAB]" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">{t('rebuild.profile.note_label', 'Poznámka')}</label>
                          <input type="text" value={language.note || ''} onChange={(e) => updateLanguage(index, { note: e.target.value })} className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#255DAB]" />
                        </div>
                        <button type="button" onClick={() => removeLanguage(index)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-200 text-rose-600 transition hover:bg-rose-50" aria-label={t('rebuild.profile.remove_language', 'Odebrat jazyk')}><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('rebuild.profile.preferences_label', 'Preferované podmínky')}</label>
                  <textarea value={editForm.workPreferencesText} onChange={(e) => setEditForm(prev => ({ ...prev, workPreferencesText: e.target.value }))} rows={4} placeholder={t('rebuild.profile.preferences_placeholder', 'Hybrid, autonomie, žádné noční směny...')} className="w-full rounded-[12px] border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-[#255DAB] focus:ring-2 focus:ring-[#255DAB]/20" />
                </div>
                <div className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('rebuild.profile.employment_type_label', 'Typ úvazku')}</label>
                      <select value={editForm.desiredEmploymentType} onChange={(e) => setEditForm(prev => ({ ...prev, desiredEmploymentType: e.target.value as ProfileEditForm['desiredEmploymentType'] }))} className="w-full rounded-[12px] border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#255DAB]">
                        <option value="">{t('rebuild.profile.employment_flexible', 'Flexibilní')}</option>
                        {EMPLOYMENT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('rebuild.profile.transport_label', 'Doprava')}</label>
                      <select value={editForm.transportMode} onChange={(e) => setEditForm(prev => ({ ...prev, transportMode: e.target.value as TransportMode }))} className="w-full rounded-[12px] border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#255DAB]">
                        {TRANSPORT_MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('rebuild.profile.commute_radius_label', 'Dojíždění km')}</label>
                      <input type="number" min={0} value={editForm.searchRadiusKm} onChange={(e) => setEditForm(prev => ({ ...prev, searchRadiusKm: e.target.value }))} className="w-full rounded-[12px] border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#255DAB]" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('rebuild.profile.salary_min_label', 'Mzda od')}</label>
                      <input type="number" min={0} value={editForm.desiredSalaryMin} onChange={(e) => setEditForm(prev => ({ ...prev, desiredSalaryMin: e.target.value }))} className="w-full rounded-[12px] border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#255DAB]" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('rebuild.profile.salary_max_label', 'Mzda do')}</label>
                      <input type="number" min={0} value={editForm.desiredSalaryMax} onChange={(e) => setEditForm(prev => ({ ...prev, desiredSalaryMax: e.target.value }))} className="w-full rounded-[12px] border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#255DAB]" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">LinkedIn</label>
                  <input type="text" value={editForm.linkedIn} onChange={(e) => setEditForm(prev => ({ ...prev, linkedIn: e.target.value }))} className="w-full rounded-[12px] border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-[#255DAB] focus:ring-2 focus:ring-[#255DAB]/20" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Portfolio</label>
                  <input type="text" value={editForm.portfolio} onChange={(e) => setEditForm(prev => ({ ...prev, portfolio: e.target.value }))} className="w-full rounded-[12px] border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-[#255DAB] focus:ring-2 focus:ring-[#255DAB]/20" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('rebuild.profile.visibility_label', 'Viditelnost')}</label>
                  <select value={editForm.profileVisibility} onChange={(e) => setEditForm(prev => ({ ...prev, profileVisibility: e.target.value as ProfileEditForm['profileVisibility'] }))} className="w-full rounded-[12px] border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#255DAB]">
                    {VISIBILITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-8 flex justify-end gap-3">
                <button type="button" onClick={() => setIsEditingProfile(false)} className={secondaryButtonClass}>
                  {t('rebuild.profile.cancel', 'Zrušit')}
                </button>
                <button type="button" onClick={() => void handleSaveEdit()} disabled={isSavingProfile} className={cn(primaryButtonClass, 'disabled:opacity-60')}>
                  {isSavingProfile ? t('rebuild.profile.saving', 'Ukládám…') : t('rebuild.profile.save', 'Uložit')}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoInput} />
        <input ref={cvInputRef} type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={handleCvInput} />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,2.1fr)_minmax(320px,0.9fr)]">
          <ShellCard className="overflow-hidden p-0">
            <div className="grid md:grid-cols-[1.25fr_0.95fr]">
              <div className="border-b border-[color:color-mix(in_srgb,var(--dashboard-card-border)_38%,transparent)] p-5 md:border-b-0 md:border-r">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                  <div className="relative">
                    {userProfile.photo ? (
                      <img src={userProfile.photo} alt={userProfile.name} className="h-28 w-28 rounded-[28px] object-cover shadow-[0_22px_40px_-28px_rgba(22,32,48,0.36)]" />
                    ) : (
                      <div className="flex h-28 w-28 items-center justify-center rounded-[28px] bg-[linear-gradient(180deg,#eff4f8,#dde6ef)] text-slate-400 shadow-[0_22px_40px_-28px_rgba(22,32,48,0.24)]">
                        <UserRound size={36} />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full border border-white bg-white text-[color:var(--dashboard-gold)] shadow-[0_12px_24px_-18px_rgba(37,30,14,0.42)]"
                      aria-label={t('rebuild.profile.change_photo', 'Změnit fotku')}
                    >
                      {photoUploading ? <span className="text-[11px] font-semibold">…</span> : <Camera size={16} />}
                    </button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-[2rem] font-semibold tracking-[-0.05em] text-[color:var(--dashboard-text-strong)]">{userProfile.name || t('rebuild.profile.name_label', 'Jméno')}</h2>
                      <span className="rounded-full bg-[#e8f6f1] px-3 py-1 text-[11px] font-semibold text-[#2c8f72]">{completion}% {t('rebuild.profile.completed_pct', 'profil kompletní')}</span>
                    </div>
                    <div className="mt-1 text-[1.05rem] text-[color:var(--dashboard-text-body)]">{activeCvDocument?.parsedData?.jobTitle || userProfile.jobTitle || t('rebuild.profile.fill_main_role', 'Doplň svou hlavní roli')}</div>
                    <div className="mt-1 text-sm text-[color:var(--dashboard-text-muted)]">{userProfile.address || preferences.address || t('rebuild.profile.fill_location', 'Doplň lokalitu')}</div>

                    <div className="mt-5 flex flex-wrap gap-4 text-[13px] text-[color:var(--dashboard-text-body)]">
                      <span className="inline-flex items-center gap-2"><Phone size={15} className="text-[color:var(--dashboard-text-muted)]" />{userProfile.phone || t('rebuild.profile.phone_not_specified', 'Telefon neuveden')}</span>
                      <span className="inline-flex items-center gap-2"><ShieldCheck size={15} className="text-[color:var(--dashboard-text-muted)]" />{formatTransportMode(userProfile.transportMode, t)}</span>
                      <span className="inline-flex items-center gap-2"><MapPin size={15} className="text-[color:var(--dashboard-text-muted)]" />{t('rebuild.profile.willing_to_commute', 'Ochoten dojíždět')} {preferences.searchRadiusKm} km</span>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button type="button" onClick={() => photoInputRef.current?.click()} className={cn(secondaryButtonClass, 'rounded-[16px] px-4 py-2.5 text-sm')}>
                        <Camera size={16} /> {t('rebuild.profile.change_photo', 'Změnit fotku')}
                      </button>
                      <button type="button" onClick={() => cvInputRef.current?.click()} className={cn(secondaryButtonClass, 'rounded-[16px] px-4 py-2.5 text-sm')}>
                        <Upload size={16} /> {t('rebuild.profile.upload_document', 'Nahrát dokument')}
                      </button>
                    </div>
                    {photoError ? <div className="mt-3 text-sm text-rose-600">{photoError}</div> : null}
                    {cvError ? <div className="mt-3 text-sm text-rose-600">{cvError}</div> : null}
                    {cvNotice ? <div className="mt-3 text-sm text-emerald-600">{cvNotice}</div> : null}
                  </div>
                </div>
              </div>

              <div className="p-5">
                <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[color:var(--dashboard-text-muted)]">{t('rebuild.profile.work_identity_title', 'Tvoje pracovní identita')}</div>
                <div className="mt-5 flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-[#eef9f6] text-[#2e9f7d]">
                    <BadgeCheck size={28} />
                  </div>
                  <div>
                    <div className="text-[1.35rem] font-semibold tracking-[-0.04em] text-[color:var(--dashboard-text-strong)]">{identityModel.identityTitle}</div>
                    <p className="mt-2 text-sm leading-7 text-[color:var(--dashboard-text-body)]">{identityModel.identitySummary}</p>
                    {isJcfpmComplete ? (
                      <div className="mt-4 grid gap-2 text-[12px] text-[color:var(--dashboard-text-body)]">
                        <div><span className="font-semibold text-[color:var(--dashboard-text-strong)]">{t('rebuild.profile.work_direction_label', 'Pracovní směr:')}</span> {identityModel.primaryDomainLabel}</div>
                        <div><span className="font-semibold text-[color:var(--dashboard-text-strong)]">{t('rebuild.profile.burnout_risk_label', 'Riziko vyhoření:')}</span> {identityModel.burnoutRisk}</div>
                        <div><span className="font-semibold text-[color:var(--dashboard-text-strong)]">{t('rebuild.profile.strong_zone_label', 'Silná zóna:')}</span> {identityModel.strongZone}</div>
                      </div>
                    ) : (
                      <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-100">
                        <div className="text-[13px] text-amber-900 font-medium">{t('rebuild.profile.empty_profile_title', 'Tvůj pracovní profil je zatím prázdný')}</div>
                        <p className="mt-1 text-[12px] text-amber-800/80 leading-relaxed">{t('rebuild.profile.empty_profile_desc', 'Pro aktivaci AI analýzy tvé identity a silných stránek je potřeba dokončit test.')}</p>
                        <button type="button" onClick={() => navigate('/candidate/jcfpm')} className="mt-3 text-[13px] font-bold text-amber-900 flex items-center gap-1">
                          {t('rebuild.profile.start_jcfpm_test', 'Spustit JCFPM test')} <ChevronRight size={14} />
                        </button>
                      </div>
                    )}
                    {isJcfpmComplete && (
                      <button type="button" onClick={() => navigate('/candidate/jcfpm')} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#2563eb]">
                        {t('rebuild.profile.view_detail', 'Zobrazit detail')} <ChevronRight size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </ShellCard>

          <div className="grid auto-rows-min gap-4">
            <SectionCard title={t('rebuild.profile.your_strengths_title', 'Tvoje silné stránky')} icon={<Star size={18} />}>
              <div className="grid gap-4">
                <div className="flex justify-center">
                  <div className="relative h-[220px] w-[220px]">
                    <svg viewBox="0 0 220 220" className="h-full w-full" aria-hidden>
                      {[1, 2, 3, 4].map((step) => (
                        <polygon
                          key={step}
                          points={buildRadarPoints(Array(5).fill(step * 25), 76, 110)}
                          fill="none"
                          stroke="rgba(148,163,184,0.16)"
                        />
                      ))}
                      {strengthMetrics.map((_, index) => {
                        const angle = (-Math.PI / 2) + ((Math.PI * 2) / strengthMetrics.length) * index;
                        const x = 110 + Math.cos(angle) * 82;
                        const y = 110 + Math.sin(angle) * 82;
                        return <line key={index} x1="110" y1="110" x2={x} y2={y} stroke="rgba(148,163,184,0.16)" />;
                      })}
                      <polygon points={buildRadarPoints(strengthMetrics.map((item) => item.value), 76, 110)} fill={isJcfpmComplete ? "rgba(36,150,171,0.12)" : "rgba(148,163,184,0.05)"} stroke={isJcfpmComplete ? "#2496ab" : "#e2e8f0"} strokeWidth="2.2" />
                      {isJcfpmComplete && strengthMetrics.map((item, index) => {
                        const angle = (-Math.PI / 2) + ((Math.PI * 2) / strengthMetrics.length) * index;
                        const pointRadius = (76 * item.value) / 100;
                        const x = 110 + Math.cos(angle) * pointRadius;
                        const y = 110 + Math.sin(angle) * pointRadius;
                        return <circle key={index} cx={x} cy={y} r="4" fill="#2496ab" stroke="white" strokeWidth="2" />;
                      })}
                    </svg>
                  </div>
                </div>
                {!isJcfpmComplete && (
                   <div className="mb-4 p-3 rounded-lg bg-slate-50 border border-dashed border-slate-200 text-center">
                     <p className="text-[12px] text-slate-500">{t('rebuild.profile.strengths_after_jcfpm', 'Dovednosti se zobrazí po JCFPM')}</p>
                   </div>
                )}
                <div className="grid grid-cols-2 gap-3 text-[12px]">
                  {strengthMetrics.map((item, index) => (
                    <div key={`strength-${item.label}-${index}`} className="rounded-[16px] bg-[color:color-mix(in_srgb,var(--dashboard-soft-bg)_96%,white)] px-3 py-2.5">
                      <div className="text-[color:var(--dashboard-text-muted)]">{item.label}</div>
                      <div className="mt-1 font-semibold text-[color:var(--dashboard-text-strong)]">{item.value}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>

            <SectionCard title={t('rebuild.profile.jhi_index_title', 'JHI Index')} icon={<HelpCircle size={18} />}>
              <div className="flex items-center gap-4">
                <div className="relative flex h-[112px] w-[112px] items-center justify-center">
                  <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 112 112" aria-hidden>
                    <circle cx="56" cy="56" r="46" stroke="#e7edf1" strokeWidth="8" fill="none" />
                    <circle
                      cx="56"
                      cy="56"
                      r="46"
                      stroke="#2496ab"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={289}
                      strokeDashoffset={289 - (289 * Math.min(100, Math.round(jhiIndex / 10))) / 100}
                      fill="none"
                    />
                  </svg>
                  <div className="text-center">
                    <div className="text-[2rem] font-semibold text-[#2496ab]">{isJcfpmComplete ? jhiIndex : '---'}</div>
                    <div className="text-[11px] text-[color:var(--dashboard-text-muted)]">{t('rebuild.profile.out_of_1000', 'z 1000')}</div>
                  </div>
                </div>
                <div className="min-w-0 flex-1 text-sm leading-7 text-[color:var(--dashboard-text-body)]">
                  {isJcfpmComplete 
                    ? t('rebuild.profile.jhi_active_desc', 'Tvůj Job Human Index ukazuje tvůj potenciál, adaptabilitu a připravenost na nové výzvy.')
                    : t('rebuild.profile.jhi_pending_desc', 'Tvůj JHI index se vypočítá na základě výsledků testu a tvého profilu.')
                  }
                  <button type="button" onClick={() => navigate('/candidate/jcfpm')} className="mt-2 block font-medium text-[#2563eb]">
                    {isJcfpmComplete ? t('rebuild.profile.how_jhi_works', 'Jak JHI funguje?') : t('rebuild.profile.start_calculation', 'Spustit výpočet')}
                  </button>
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-4 xl:col-span-2 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.95fr)_minmax(300px,1fr)]">
            <SectionCard title={t('rebuild.profile.career_direction_map', 'Career Direction Map') || 'Career Direction Map'} icon={<Compass size={18} />}>
              <div className="space-y-3">
                {identityModel.directions.map((direction, index) => (
                  <div key={`direction-${direction.label}-${index}`} className="flex items-center gap-3 rounded-[18px] bg-[color:color-mix(in_srgb,var(--dashboard-soft-bg)_94%,white)] px-4 py-3">
                    <div className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold',
                      direction.tone === 'primary' && 'bg-[#fff1d6] text-[#b6721d]',
                      direction.tone === 'secondary' && 'bg-[#e8f6f7] text-[#217f91]',
                      direction.tone === 'explore' && 'bg-[#eef2ff] text-[#5469cf]',
                    )}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-[color:var(--dashboard-text-strong)]">{direction.label}</div>
                      <div className="text-[12px] text-[color:var(--dashboard-text-muted)]">
                        {index === 0 ? t('rebuild.profile.primary_direction', 'Primární směr') : index === 1 ? t('rebuild.profile.secondary_direction', 'Sekundární směr') : index === 2 ? t('rebuild.profile.third_direction', 'Třetí směr') : t('rebuild.profile.exploration_direction', 'Exploration směr')}
                      </div>
                    </div>
                  </div>
                ))}
                {identityModel.targetRole ? (
                  <div className="rounded-[18px] border border-[color:var(--dashboard-soft-border)] px-4 py-3 text-sm text-[color:var(--dashboard-text-body)]">
                    <span className="font-semibold text-[color:var(--dashboard-text-strong)]">AI odhad cílové role:</span> {identityModel.targetRole}
                  </div>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard title={t('rebuild.profile.feed_adjustment_title', 'Jak se upraví feed') || 'Jak se upraví feed'} icon={<Filter size={18} />}>
              <div className="space-y-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--dashboard-text-muted)]">{t('rebuild.profile.feed_prioritize', 'Upřednostnit')}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {identityModel.feedPriorities.map((item, index) => (
                      <span key={`priority-${item}-${index}`} className="rounded-full bg-[#e8f6f1] px-3 py-1.5 text-[12px] font-medium text-[#2e8d72]">{item}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--dashboard-text-muted)]">{t('rebuild.profile.feed_restrict', 'Omezit')}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {identityModel.feedAvoid.map((item, index) => (
                      <span key={`avoid-${item}-${index}`} className="rounded-full bg-[#fff1eb] px-3 py-1.5 text-[12px] font-medium text-[#cc6a45]">{item}</span>
                    ))}
                  </div>
                </div>
                <div className="rounded-[18px] bg-[color:color-mix(in_srgb,var(--dashboard-soft-bg)_94%,white)] px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--dashboard-text-muted)]">{t('rebuild.profile.feed_mode_label', 'Feed mode')}</div>
                  <div className="mt-2 text-sm font-medium text-[color:var(--dashboard-text-strong)]">{identityModel.feedMode}</div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title={t('rebuild.profile.jhi_weights_title', 'JHI Priority Weights')} icon={<Target size={18} />}>
              <div className="space-y-3">
                {identityModel.jhiWeights.map((item, index) => (
                  <div key={`jhi-weight-${item.label}-${index}`}>
                    <div className="flex items-center justify-between gap-3 text-[13px]">
                      <span className="font-medium text-[color:var(--dashboard-text-strong)]">{item.label}</span>
                      <span className="text-[color:var(--dashboard-text-muted)]">{item.value.toFixed(2)}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-[color:var(--dashboard-track)]">
                      <div className="h-2 rounded-full bg-[#2496ab]" style={{ width: `${item.value * 100}%` }} />
                    </div>
                  </div>
                ))}
                <div className="rounded-[18px] border border-[color:var(--dashboard-soft-border)] px-4 py-3 text-[12px] leading-6 text-[color:var(--dashboard-text-body)]">
                  Po onboardingu se doporučení neřídí jen názvem role, ale i tím, kolik prostoru potřebuješ pro smysl, autonomii a tvorbu.
                </div>
              </div>
            </SectionCard>

            <SectionCard title={t('rebuild.profile.core_signal_event_title', 'Core Signal Event') || 'Core Signal Event'} icon={<Cpu size={18} />}>
              <div className="rounded-[18px] bg-[linear-gradient(180deg,rgba(255,247,226,0.94),rgba(255,255,255,0.86))] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a86c20]">{t('rebuild.profile.ai_signal_marker', 'AI Signal Marker')}</div>
                <div className="mt-2 text-[1rem] font-semibold text-[color:var(--dashboard-text-strong)]">{identityModel.coreSignalEvent.title}</div>
                <p className="mt-3 text-sm leading-7 text-[color:var(--dashboard-text-body)]">{identityModel.coreSignalEvent.body}</p>
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-4 xl:col-span-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.95fr)_minmax(300px,0.95fr)]">
            <SectionCard
              title={t('rebuild.profile.experience_title', 'Zkušenosti')}
              icon={<Briefcase size={18} />}
              action={<button type="button" className={cn(secondaryButtonClass, 'rounded-full px-3 py-2 text-xs')}><Plus size={14} /> {t('rebuild.profile.add_item', 'Přidat')}</button>}
            >
              <div className="space-y-4">
                {workHistory.length > 0 ? workHistory.map((item, index) => (
                  <div key={`work-${item.id || item.role || item.company || 'item'}-${index}`} className="flex gap-3 rounded-[18px] bg-[color:color-mix(in_srgb,var(--dashboard-soft-bg)_94%,white)] p-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#4a7fde] shadow-[0_10px_22px_-20px_rgba(39,60,110,0.44)]">
                      <Briefcase size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[color:var(--dashboard-text-strong)]">{item.role}</div>
                      <div className="text-sm text-[color:var(--dashboard-text-body)]">{item.company}</div>
                      <div className="mt-1 text-[12px] text-[color:var(--dashboard-text-muted)]">{item.duration}</div>
                    </div>
                  </div>
                )) : <div className="text-sm text-[color:var(--dashboard-text-muted)]">{t('rebuild.profile.no_experience_desc', 'Zatím tu nejsou zkušenosti. Nahráním CV je doplníš automaticky.')}</div>}
              </div>
            </SectionCard>

            <SectionCard
              title={t('rebuild.profile.education_title', 'Vzdělání a kurzy')}
              icon={<GraduationCap size={18} />}
              action={<button type="button" className={cn(secondaryButtonClass, 'rounded-full px-3 py-2 text-xs')}><Plus size={14} /> {t('rebuild.profile.add_item', 'Přidat')}</button>}
            >
              <div className="space-y-4">
                {education.length > 0 ? education.map((item, index) => (
                  <div key={`education-${item.id || item.school || item.degree || 'item'}-${index}`} className="flex gap-3 rounded-[18px] bg-[color:color-mix(in_srgb,var(--dashboard-soft-bg)_94%,white)] p-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#7a63d1] shadow-[0_10px_22px_-20px_rgba(63,45,120,0.38)]">
                      <BookOpen size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[color:var(--dashboard-text-strong)]">{item.school || item.degree}</div>
                      <div className="text-sm text-[color:var(--dashboard-text-body)]">{item.degree}{item.field ? ` • ${item.field}` : ''}</div>
                      <div className="mt-1 text-[12px] text-[color:var(--dashboard-text-muted)]">{item.year || t('rebuild.profile.no_year', 'Bez roku')}</div>
                    </div>
                  </div>
                )) : <div className="text-sm text-[color:var(--dashboard-text-muted)]">{t('rebuild.profile.no_education', 'Vzdělání zatím nebylo přidáno.')}</div>}
              </div>
            </SectionCard>

            <SectionCard title={t('rebuild.profile.documents_title', 'Dokumenty a onboarding')} icon={<FileText size={18} />}>
              <div className="space-y-3">
                <div className="rounded-[18px] bg-[color:color-mix(in_srgb,var(--dashboard-soft-bg)_94%,white)] p-3.5">
                  <div className="font-semibold text-[color:var(--dashboard-text-strong)]">{t('rebuild.profile.profile_status', 'Stav profilu')}</div>
                  <div className="mt-2 text-sm text-[color:var(--dashboard-text-body)]">
                    {t('rebuild.profile.onboarding_label', 'Onboarding')} {completion >= 70 ? t('rebuild.profile.onboarding_mostly_done', 'dokončen z větší části') : t('rebuild.profile.onboarding_needs_steps', 'ještě potřebuje doplnit několik kroků')}.
                  </div>
                </div>
                {cvLoading ? <div className="text-sm text-[color:var(--dashboard-text-muted)]">{t('rebuild.profile.loading_documents', 'Načítám dokumenty…')}</div> : null}
                {!cvLoading && cvDocuments.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-[color:var(--dashboard-soft-border)] p-4 text-sm text-[color:var(--dashboard-text-muted)]">
                    Zatím tu není žádný dokument.
                  </div>
                ) : null}
                {cvDocuments.slice(0, 3).map((document, index) => (
                  <div key={`cv-${document.id || document.originalName || 'document'}-${index}`} className="rounded-[18px] border border-[color:color-mix(in_srgb,var(--dashboard-soft-border)_70%,transparent)] bg-white/70 p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-[color:var(--dashboard-text-strong)]">{document.label || document.originalName}</div>
                        <div className="mt-1 text-[12px] text-[color:var(--dashboard-text-muted)]">{t('rebuild.profile.uploaded', 'Nahráno')} {formatUploadedAt(document.uploadedAt)}</div>
                      </div>
                      {document.isActive ? <span className="rounded-full bg-[#e8f6f1] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#2c8f72]">{t('rebuild.profile.active', 'Aktivní')}</span> : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {!document.isActive ? (
                        <button type="button" onClick={() => void onSelectCv?.(document.id)} className={cn(secondaryButtonClass, 'rounded-[14px] px-3 py-2 text-xs')} disabled={cvBusy}>
                          Vybrat
                        </button>
                      ) : null}
                      <button type="button" onClick={() => void onDeleteCv?.(document.id)} className="inline-flex items-center gap-1 rounded-[14px] border border-rose-200 px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50" disabled={cvBusy}>
                        <Trash2 size={13} /> Odebrat
                      </button>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => cvInputRef.current?.click()} className={cn(secondaryButtonClass, 'w-full rounded-[16px] px-4 py-2.5 text-sm')} disabled={cvBusy}>
                  <Upload size={16} /> {cvBusy ? t('rebuild.profile.uploading', 'Nahrávám…') : t('rebuild.profile.upload_document', 'Nahrát dokument')}
                </button>
              </div>
            </SectionCard>

            <SectionCard title={t('rebuild.profile.quick_tools_title', 'Rychlé nástroje')} icon={<Settings2 size={18} />}>
              <div className="space-y-3">
                {[
                  { label: t('rebuild.profile.tax_calculator_title', 'Daňová kalkulačka'), copy: t('rebuild.profile.tax_calculator_desc', 'Spočítej si čistou mzdu'), action: () => navigate('/candidate/insights') },
                  { label: t('rebuild.profile.search_filters_title', 'Nastavení filtrů hledání'), copy: t('rebuild.profile.search_filters_desc', 'Uprav, co chceš ve výzvách vidět'), action: () => navigate('/candidate/marketplace') },
                  { label: t('rebuild.profile.notifications_title', 'Email a notifikace'), copy: t('rebuild.profile.notifications_desc', 'Spravuj upozornění a souhrny'), action: () => void onSaveProfile?.() },
                  ...searchPresets.map((preset) => ({
                    label: preset.name,
                    copy: preset.description,
                    action: () => navigate('/candidate/marketplace'),
                  })),
                ].slice(0, 5).map((tool, index) => (
                  <button key={`tool-${tool.label}-${index}`} type="button" onClick={tool.action} className="flex w-full items-center justify-between rounded-[18px] bg-[color:color-mix(in_srgb,var(--dashboard-soft-bg)_94%,white)] px-4 py-3 text-left transition hover:bg-white">
                    <div>
                      <div className="font-semibold text-[color:var(--dashboard-text-strong)]">{tool.label}</div>
                      <div className="mt-1 text-sm text-[color:var(--dashboard-text-muted)]">{tool.copy}</div>
                    </div>
                    <ChevronRight size={16} className="text-[color:var(--dashboard-text-muted)]" />
                  </button>
                ))}
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-4 xl:col-span-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(300px,0.95fr)]">
            <SectionCard title={t('rebuild.profile.my_skills_title', 'Moje dovednosti')} icon={<Sparkles size={18} />} action={<button type="button" onClick={() => { setEditForm(currentProfileForm); setIsEditingProfile(true); }} className={cn(secondaryButtonClass, 'rounded-full px-3 py-2 text-xs')}><Plus size={14} /> {t('rebuild.profile.edit_item', 'Upravit')}</button>}>
              <div className="flex flex-wrap gap-2">
                {skills.length > 0 ? skills.slice(0, 12).map((skill, index) => (
                  <span key={`skill-${skill}-${index}`} className="rounded-full border border-[color:var(--dashboard-soft-border)] bg-[color:color-mix(in_srgb,var(--dashboard-soft-bg)_94%,white)] px-3 py-1.5 text-[12px] font-medium text-[color:var(--dashboard-text-body)]">
                    {skill}
                  </span>
                )) : <div className="text-sm text-[color:var(--dashboard-text-muted)]">{t('rebuild.profile.no_skills_desc', 'Dovednosti se objeví po doplnění CV nebo profilu.')}</div>}
              </div>
            </SectionCard>

            <SectionCard title={t('rebuild.profile.languages_card_title', 'Jazykové znalosti')} icon={<Languages size={18} />} action={<button type="button" onClick={() => { setEditForm(currentProfileForm); setIsEditingProfile(true); }} className={cn(secondaryButtonClass, 'rounded-full px-3 py-2 text-xs')}><Plus size={14} /> {t('rebuild.profile.edit_item', 'Upravit')}</button>}>
              <div className="space-y-4">
                {languages.length > 0 ? languages.map((language, index) => (
                  <div key={`language-${language.label}-${index}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-[color:var(--dashboard-text-strong)]">{language.label}</div>
                        <div className="text-[12px] text-[color:var(--dashboard-text-muted)]">{language.note}</div>
                      </div>
                      <div className="flex gap-1.5">
                        {Array.from({ length: 8 }).map((_, index) => (
                          <span key={index} className={cn('h-2.5 w-2.5 rounded-full', index < language.level ? 'bg-[#2496ab]' : 'bg-[#e7edf1]')} />
                        ))}
                      </div>
                    </div>
                  </div>
                )) : <div className="text-sm text-[color:var(--dashboard-text-muted)]">{t('rebuild.profile.no_languages_desc', 'Jazyky zatím nejsou doplněné.')}</div>}
              </div>
            </SectionCard>

            <SectionCard title={t('rebuild.profile.preferences_label', 'Preferované podmínky')} icon={<MapPin size={18} />} action={<button type="button" onClick={() => { setEditForm(currentProfileForm); setIsEditingProfile(true); }} className={cn(secondaryButtonClass, 'rounded-full px-3 py-2 text-xs')}><Plus size={14} /> {t('rebuild.profile.edit_item', 'Upravit')}</button>}>
              <div className="space-y-3">
                <DetailRow label={t('rebuild.profile.location_row_label', 'Lokalita')} value={userProfile.address || preferences.address || t('rebuild.profile.not_specified', 'Neuvedeno')} />
                <DetailRow label={t('rebuild.profile.employment_type_label', 'Typ úvazku')} value={formatEmploymentType(userProfile.preferences?.desired_employment_type, t)} />
                <DetailRow label={t('rebuild.profile.commute_row_label', 'Dojíždění')} value={`${preferences.searchRadiusKm} km • ${formatTransportMode(userProfile.transportMode)}`} />
                <DetailRow label={t('rebuild.profile.salary_row_label', 'Mzda')} value={desiredSalary} />
                <DetailRow label={t('rebuild.profile.visibility_label', 'Viditelnost')} value={formatVisibility(userProfile.preferences?.profile_visibility, t)} />
                {userProfile.workPreferences?.length ? <DetailRow label={t('rebuild.profile.other_row_label', 'Další')} value={userProfile.workPreferences.join(', ')} /> : null}
              </div>
            </SectionCard>

            <SectionCard title={t('rebuild.profile.personal_details_title', 'Osobní údaje a nastavení')} icon={<Settings2 size={18} />}>
              <div className="space-y-3">
                <DetailRow label={t('rebuild.profile.email_row_label', 'E-mail')} value={<span className="inline-flex items-center gap-2"><Mail size={14} className="text-[color:var(--dashboard-text-muted)]" />{userProfile.email || 'Neuvedeno'}</span>} />
                <DetailRow label={t('rebuild.profile.phone_label', 'Telefon')} value={<span className="inline-flex items-center gap-2"><Phone size={14} className="text-[color:var(--dashboard-text-muted)]" />{userProfile.phone || 'Neuvedeno'}</span>} />
                <DetailRow label={t('rebuild.profile.linkedin_label', 'LinkedIn')} value={preferences.linkedInUrl ? <a href={preferences.linkedInUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[#2563eb]"><Link2 size={14} />{t('rebuild.profile.open_profile_link', 'Otevřít profil')}</a> : 'Neuvedeno'} />
                <DetailRow label={t('rebuild.profile.portfolio_label', 'Portfolio')} value={preferences.portfolioUrl ? <a href={preferences.portfolioUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[#2563eb]"><Link2 size={14} />{t('rebuild.profile.open_portfolio_link', 'Otevřít portfolio')}</a> : 'Neuvedeno'} />
              </div>
            </SectionCard>
          </div>

          <ShellCard className="xl:col-span-2 p-5">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_320px] xl:items-end">
              <div>
                <div className="text-[1.55rem] font-semibold tracking-[-0.04em] text-[color:var(--dashboard-text-strong)]">{t('rebuild.profile.profile_growth_title', 'Profil roste s tebou')}</div>
                <p className="mt-2 text-sm leading-7 text-[color:var(--dashboard-text-body)]">{t('rebuild.profile.profile_growth_desc', 'Čím víc informací doplníš, tím lépe ti Cybershaman najde ty pravé příležitosti.')}</p>

                <div className="mt-4 flex items-center gap-4">
                  <div className="h-2.5 flex-1 rounded-full bg-[color:var(--dashboard-track)]">
                    <div className="h-2.5 rounded-full bg-[#2496ab]" style={{ width: `${completion}%` }} />
                  </div>
                  <div className="text-sm font-semibold text-[color:var(--dashboard-text-strong)]">{completion}% {t('rebuild.profile.filled_pct', 'vyplněno')}</div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  {completionTasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between rounded-[20px] border border-[color:var(--dashboard-soft-border)] bg-[color:color-mix(in_srgb,var(--dashboard-soft-bg)_94%,white)] px-4 py-3">
                      <div>
                        <div className="font-semibold text-[color:var(--dashboard-text-strong)]">{task.label}</div>
                        <div className="mt-1 text-[12px] text-[color:var(--dashboard-text-muted)]">{task.copy}</div>
                      </div>
                      <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--dashboard-soft-border)] bg-white text-[color:var(--dashboard-text-muted)]">
                        <Plus size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-[color:color-mix(in_srgb,var(--dashboard-card-border)_45%,transparent)] bg-[linear-gradient(160deg,rgba(255,255,255,0.94),rgba(247,242,234,0.9))] p-5">
                <div className="text-[1.25rem] font-semibold text-[color:var(--dashboard-text-strong)]">{t('rebuild.profile.not_sure_title', 'Nejsi si jistý?')}</div>
                <p className="mt-2 text-sm leading-7 text-[color:var(--dashboard-text-body)]">{t('rebuild.profile.not_sure_desc', 'Cybershaman ti pomůže doplnit tvůj profil krok za krokem.')}</p>
                <button type="button" onClick={() => navigate('/candidate/insights#mentor')} className={cn(secondaryButtonClass, 'mt-4 rounded-[16px] px-4 py-2.5 text-sm')}>
                  <Sparkles size={16} /> {t('rebuild.profile.talk_to_us', 'Promluvit si')}
                </button>
              </div>
            </div>
          </ShellCard>
        </div>
      </CandidateShellSurface>
    );
  };
