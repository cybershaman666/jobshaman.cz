import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Award,
  Briefcase,
  ChevronRight,
  CircleUserRound,
  Clock3,
  GraduationCap,
  Info,
  LayoutDashboard,
  MapPin,
  MessageSquare,
  Network,
  ShieldAlert,
  Target,
  ArrowRight,
  Users,
  Zap,
  Brain,
  Loader2,
  Send,
  Sparkles,
  CalendarDays,
  TrendingUp,
  CheckCircle2,
  Circle,
  Star,
  Compass,
  BookOpen,
} from 'lucide-react';

import type { CVDocument, DialogueSummary, UserProfile } from '../../types';
import type { CandidatePreferenceProfile, Role } from '../models';
import { cn } from '../cn';
import { buildCandidateDashboardViewModel, clamp } from '../dashboard/viewModels';
import { evaluateRole } from '../intelligence';
import { DashboardLayoutV2 } from '../ui/DashboardLayoutV2';
import { useRebuildTheme } from '../ui/rebuildTheme';
import { primaryButtonClass, secondaryButtonClass } from '../ui/shellStyles';
import { CandidateShellSurface, CompactActionButton, MetricPill, ShellCard } from './CandidateShellSurface';
import { CandidateProfileV2 } from './CandidateProfileV2';
import { sendMentorChatMessage, type MentorChatMessage, type ShamiJobRecommendation } from '../../services/v2MentorService';
import { getCandidateGreetingName } from './greeting';
import { ChatMentor } from '../../components/ChatMentor';
import { CandidateChatSidebar } from '../../components/CandidateChatSidebar';

type TFunction = (key: string, options?: { defaultValue?: string } & Record<string, any>) => string;

type HeroMetric = ReturnType<typeof buildCandidateDashboardViewModel>['heroMetrics'][number];

const sectionTitleClass = 'text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--dashboard-text-muted)]';

const companyTileClass = [
  'bg-[linear-gradient(180deg,#eef3ff,#dfe7ff)] text-[#214b98]',
  'bg-[linear-gradient(180deg,#f0ecff,#ddd7ff)] text-[#5a37c8]',
  'bg-[linear-gradient(180deg,#daf6f4,#b8ece7)] text-[#0f6a6a]',
  'bg-[linear-gradient(180deg,#fff4e6,#ffe5b4)] text-[#a05c00]',
] as const;

const getRolePath = (role: Role | null | undefined) => {
  if (!role) return '/';
  return role.source === 'curated' ? `/candidate/role/${role.id}` : `/candidate/imported/${role.id}`;
};

const getHeroMetricIcon = (metricId: string, label: string) => {
  const key = `${metricId} ${label}`.toLowerCase();
  if (key.includes('system') || key.includes('myslen')) return <Brain size={13} />;
  if (key.includes('adapt') || key.includes('tech') || key.includes('ai')) return <Zap size={13} />;
  if (key.includes('social')) return <Users size={13} />;
  if (key.includes('stress') || key.includes('odolnost') || key.includes('energy')) return <ShieldAlert size={13} />;
  if (key.includes('strateg') || key.includes('problem')) return <Target size={13} />;
  if (key.includes('flex') || key.includes('ambigu') || key.includes('network')) return <Network size={13} />;
  return <Award size={13} />;
};

const formatArchetypeCopy = (copy: string, t: TFunction) => {
  const parts = String(copy)
    .split(/[.!?]\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return [
      t('rebuild.dashboard.default_copy_1', { defaultValue: 'You see connections where others are not looking yet.' }),
      t('rebuild.dashboard.default_copy_2', { defaultValue: 'You build systems that make sense.' }),
    ];
  }

  return parts.map((part) => (/[.!?]$/.test(part) ? part : `${part}.`));
};

const getCompactArchetypeTitle = (title: string, t: any) => {
  const parts = String(title)
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return t('rebuild.dashboard.archetype', { defaultValue: 'Archetyp' });
  if (parts[0].length <= 24) return parts[0];
  return parts[0].split(/\s+/).slice(0, 2).join(' ');
};

const formatShamiFitScore = (score?: number) => {
  if (typeof score !== 'number' || Number.isNaN(score)) return '';
  return `${Math.round(score)}% fit`;
};

const getShamiIntentLabel = (intent?: string) => {
  const labels: Record<string, string> = {
    safe_match: 'Přesná shoda',
    stretch_match: 'Stretch role',
    growth_path: 'Růstová výzva',
    income_now: 'Rychlý příjem',
    exploration: 'K prozkoumání',
    fallback: 'Další možnost',
  };
  return labels[intent || ''] || '';
};

// ─── Animated Enso Ring ────────────────────────────────────────────────────
const AnimatedEnsoRing: React.FC = () => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none mix-blend-screen opacity-80">
    <svg viewBox="0 0 100 100" className="w-[125%] h-[125%] max-w-[600px] animate-[spin_40s_linear_infinite]" style={{ filter: 'drop-shadow(0 0 12px rgba(var(--accent-gold-rgb), 0.4))' }}>
      <path
        d="M 50,5 C 75,5 95,25 95,50 C 95,75 75,95 50,95 C 25,95 5,75 5,50 C 5,28 20,10 40,6"
        fill="none"
        stroke="url(#enso-grad)"
        strokeWidth="1.2"
        strokeLinecap="round"
        className="animate-[pulse_4s_ease-in-out_infinite]"
      />
      <path
        d="M 50,12 C 29,12 12,29 12,50 C 12,71 29,88 50,88 C 71,88 88,71 88,50 C 88,32 75,15 58,13"
        fill="none"
        stroke="url(#enso-grad-2)"
        strokeWidth="0.8"
        strokeLinecap="round"
        style={{ transformOrigin: '50px 50px', animation: 'spin 25s linear infinite reverse' }}
      />
      <circle cx="40" cy="6" r="1.5" fill="rgba(var(--accent-gold-rgb), 1)" className="animate-pulse" />
      <circle cx="58" cy="13" r="1" fill="rgba(var(--accent-rgb), 1)" className="animate-pulse" />
      <defs>
        <linearGradient id="enso-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(var(--accent-gold-rgb), 1)" />
          <stop offset="60%" stopColor="rgba(var(--accent-rgb), 0.4)" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
        <linearGradient id="enso-grad-2" x1="100%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="rgba(var(--accent-rgb), 0.8)" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

// ─── Radial JHI Score Gauge ────────────────────────────────────────────────
const JHIGauge: React.FC<{ score: number; size?: number }> = ({ score, size = 80 }) => {
  const value = clamp(score, 0, 100);
  const r = 34;
  const circumference = 2 * Math.PI * r;
  const dash = (value / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80" aria-hidden>
        <circle cx="40" cy="40" r={r} stroke="var(--dashboard-soft-border)" strokeWidth="3" fill="none" />
        <circle
          cx="40" cy="40" r={r}
          stroke="url(#jhi-grad)"
          strokeWidth="4"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          fill="none"
          style={{ filter: 'drop-shadow(0 0 6px rgba(var(--accent-gold-rgb),0.5))' }}
        />
        <defs>
          <linearGradient id="jhi-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent-gold)" />
            <stop offset="100%" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="relative z-10 flex flex-col items-center">
        <span className="text-[20px] font-black leading-none text-[color:var(--text-strong)]">{value}</span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-[color:var(--accent-gold)]">JHI</span>
      </div>
    </div>
  );
};

// ─── KPI Chip ──────────────────────────────────────────────────────────────
const KpiChip: React.FC<{
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone?: 'default' | 'gold' | 'teal' | 'green';
  onClick?: () => void;
}> = ({ label, value, icon, tone = 'default', onClick }) => {
  const toneStyles = {
    default: 'border-[color:var(--dashboard-soft-border)] bg-[color:var(--dashboard-card-bg)] text-[color:var(--text-strong)]',
    gold: 'border-[color:var(--accent-gold)]/30 bg-[color:var(--accent-gold)]/5 text-[color:var(--accent-gold)]',
    teal: 'border-[color:var(--accent)]/30 bg-[color:var(--accent)]/5 text-[color:var(--accent)]',
    green: 'border-[color:var(--accent-green)]/30 bg-[color:var(--accent-green)]/5 text-[color:var(--accent-green)]',
  };

  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'flex items-center gap-2.5 rounded-2xl border px-4 py-3 transition-all',
        toneStyles[tone],
        onClick && 'cursor-pointer hover:scale-[1.02] hover:shadow-sm',
      )}
    >
      <div className={cn('shrink-0 opacity-70', tone !== 'default' ? '' : 'text-[color:var(--text-muted)]')}>
        {icon}
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--text-muted)] leading-none mb-1">{label}</div>
        <div className={cn('text-[15px] font-black leading-none', tone === 'default' && 'text-[color:var(--text-strong)]')}>{value}</div>
      </div>
    </Tag>
  );
};

// ─── Skill/Trait Pill ──────────────────────────────────────────────────────
const TraitPill: React.FC<{ label: string; value: number; tone: 'gold' | 'teal' | 'muted' }> = ({ label, value, tone }) => {
  const colors = {
    gold: 'bg-[color:var(--accent-gold)]/10 text-[color:var(--accent-gold)] border-[color:var(--accent-gold)]/20',
    teal: 'bg-[color:var(--accent)]/10 text-[color:var(--accent)] border-[color:var(--accent)]/20',
    muted: 'bg-[color:var(--dashboard-soft-bg)] text-[color:var(--text-muted)] border-[color:var(--dashboard-soft-border)]',
  };

  return (
    <div className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold', colors[tone])}>
      {getHeroMetricIcon('', label)}
      <span className="truncate max-w-[80px]">{label}</span>
      <span className="ml-0.5 opacity-75">{value.toFixed(0)}</span>
    </div>
  );
};

// ─── Handshake Score Ring ──────────────────────────────────────────────────
const HandshakeScore: React.FC<{ score: number }> = ({ score }) => {
  const value = clamp(score, 0, 100);
  const circumference = 113.1;
  return (
    <div className="relative flex h-10 w-10 items-center justify-center shrink-0">
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 40 40" aria-hidden>
        <circle cx="20" cy="20" r="18" stroke="#ebeff2" strokeWidth="2.1" fill="none" />
        <circle
          cx="20" cy="20" r="18"
          stroke="var(--accent-gold)"
          strokeWidth="2.1"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (circumference * value) / 100}
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <span className="text-[11px] font-black text-[color:var(--accent-gold)]">{value}%</span>
    </div>
  );
};

// ─── Onboarding Alert ─────────────────────────────────────────────────────
const OnboardingAlert: React.FC<{ onStart: () => void }> = ({ onStart }) => {
  const { t } = useTranslation();
  return (
    <div className="mb-5 overflow-hidden rounded-[20px] border border-amber-200 bg-amber-50/80 backdrop-blur-md shadow-sm">
      <div className="flex flex-col items-center gap-4 p-4 md:flex-row md:justify-between md:p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="text-sm font-bold text-amber-900">{t('rebuild.dashboard.onboarding_pending_title', { defaultValue: 'Průvodce Shamim není dokončen' })}</div>
            <p className="mt-0.5 text-xs leading-5 text-amber-800/80">
              {t('rebuild.dashboard.onboarding_pending_desc', { defaultValue: 'Projdi krátkým onboardingem, ať profil a doporučení dávají smysl hned od začátku.' })}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onStart}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-amber-600 px-5 text-xs font-bold text-white shadow-lg shadow-amber-600/20 transition hover:bg-amber-700"
        >
          {t('rebuild.dashboard.start_onboarding', { defaultValue: 'Dokončit onboarding' })}
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};

// ─── Timeline Milestone ────────────────────────────────────────────────────
const MilestoneDot: React.FC<{ done?: boolean; active?: boolean; label: string; caption: string }> = ({
  done, active, label, caption,
}) => (
  <div className="flex items-start gap-3">
    <div className="flex flex-col items-center">
      <div className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all',
        done
          ? 'border-[color:var(--accent-green)] bg-[color:var(--accent-green)]/10 text-[color:var(--accent-green)]'
          : active
            ? 'border-[color:var(--accent-gold)] bg-[color:var(--accent-gold)]/10 text-[color:var(--accent-gold)]'
            : 'border-[color:var(--dashboard-soft-border)] bg-[color:var(--dashboard-card-bg)] text-[color:var(--text-faint)]',
      )}>
        {done ? <CheckCircle2 size={14} /> : active ? <Star size={12} /> : <Circle size={10} />}
      </div>
    </div>
    <div className="min-w-0 pb-4">
      <p className={cn('text-[13px] font-bold leading-none', done ? 'text-[color:var(--accent-green)]' : active ? 'text-[color:var(--accent-gold)]' : 'text-[color:var(--text-muted)]')}>
        {label}
      </p>
      <p className="mt-1 text-[11px] text-[color:var(--text-muted)] leading-snug">{caption}</p>
    </div>
  </div>
);

// ─── Main Export ───────────────────────────────────────────────────────────
export const CandidateDashboardV2: React.FC<{
  roles: Role[];
  preferences: CandidatePreferenceProfile;
  userProfile: UserProfile;
  setUserProfile: (updates: Partial<UserProfile>) => void;
  activeCvDocument?: CVDocument | null;
  cvDocuments?: CVDocument[];
  cvLoading?: boolean;
  cvBusy?: boolean;
  candidateApplications: DialogueSummary[];
  applicationsLoading?: boolean;
  candidateCapacity?: unknown;
  selectedApplicationId?: string | null;
  savedRoleIds?: string[];
  isSavingProfile?: boolean;
  onSaveProfile?: (updates?: Partial<UserProfile>) => void | Promise<void>;
  onOpenAuth?: (intent: 'candidate' | 'recruiter') => void;
  onSelectApplication?: (id: string) => void;
  onToggleSavedRole?: (roleId: string) => void;
  onUploadCv?: (file: File) => Promise<void>;
  onSelectCv?: (cvId: string) => Promise<void>;
  onDeleteCv?: (cvId: string) => Promise<void>;
  onUploadPhoto?: (file: File) => Promise<void>;
  onUpgradePremium?: () => void;
  premiumBusy?: boolean;
  onSignOut?: () => void;
  onCompanySwitch?: () => void;
  currentLanguage?: string;
  onLanguageChange?: (lang: string) => void;
  navigate: (path: string) => void;
  t: TFunction;
}> = ({
  roles,
  preferences,
  userProfile,
  setUserProfile,
  activeCvDocument = null,
  cvDocuments = [],
  cvLoading = false,
  cvBusy = false,
  candidateApplications,
  isSavingProfile,
  onSaveProfile,
  onOpenAuth,
  onUploadCv,
  onSelectCv,
  onDeleteCv,
  onUploadPhoto,
  onUpgradePremium,
  premiumBusy,
  onSignOut,
  onCompanySwitch,
  currentLanguage,
  onLanguageChange,
  navigate,
  t,
}) => {
  const { resolvedMode } = useRebuildTheme();
  const [currentChatId, setCurrentChatId] = React.useState<string | null>(null);
  const [mentorPrompt, setMentorPrompt] = React.useState('');
  const [activeArchetypeTab, setActiveArchetypeTab] = React.useState('skills');

  const resolveSectionFromLocation = React.useCallback(() => {
    if (typeof window === 'undefined') return '';
    if (window.location.pathname === '/candidate/profile') return 'profile';
    if (window.location.pathname === '/candidate/learning') return 'learning';
    return window.location.hash.replace('#', '').trim();
  }, []);

  const [hashSection, setHashSection] = React.useState(() => resolveSectionFromLocation());

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const update = () => setHashSection(resolveSectionFromLocation());
    update();
    window.addEventListener('hashchange', update);
    window.addEventListener('popstate', update);
    return () => {
      window.removeEventListener('hashchange', update);
      window.removeEventListener('popstate', update);
    };
  }, [resolveSectionFromLocation]);

  const vm = React.useMemo(
    () => buildCandidateDashboardViewModel(roles, preferences, userProfile, candidateApplications, resolvedMode, t),
    [candidateApplications, preferences, resolvedMode, roles, userProfile, t],
  );

  const evaluatedRoles = React.useMemo(
    () => roles
      .map((role) => ({
        role,
        score: clamp(Math.round(evaluateRole(role, preferences, t).jhi.personalizedScore), 58, 99),
      }))
      .sort((a, b) => b.score - a.score),
    [preferences, roles, t],
  );

  const featuredRole = evaluatedRoles[0]?.role || null;
  const featuredScore = evaluatedRoles[0]?.score || vm.resonanceScore;

  const handshakeRows = React.useMemo(() => {
    if (candidateApplications.length > 0) {
      return candidateApplications.slice(0, 4).map((app, idx) => {
        const matched = evaluatedRoles.find((i) => String(i.role.id) === String(app.job_id)) || evaluatedRoles[idx];
        return {
          id: app.id,
          company: app.company_name || matched?.role.companyName || t('rebuild.dashboard.selected_company', { defaultValue: 'Vybraná firma' }),
          role: app.job_snapshot?.title || matched?.role.title || t('rebuild.dashboard.active_handshake', { defaultValue: 'Aktivní jednání' }),
          score: matched?.score || clamp(vm.resonanceScore - idx * 6, 58, 96),
          isActive: !!app.job_id,
        };
      });
    }
    return evaluatedRoles.slice(0, 4).map((item, idx) => ({
      id: item.role.id,
      company: item.role.companyName || `Firma ${idx + 1}`,
      role: item.role.title,
      score: item.score,
      isActive: false,
    }));
  }, [candidateApplications, evaluatedRoles, t, vm.resonanceScore]);

  const openHandshakeOrRole = React.useCallback((id: string) => {
    const app = candidateApplications.find((a) => String(a.id) === String(id));
    if (app?.job_id) { navigate(`/candidate/journey/${app.job_id}`); return; }
    const role = roles.find((r) => String(r.id) === String(id));
    if (role) { navigate(getRolePath(role)); return; }
    navigate('/candidate/applications');
  }, [candidateApplications, navigate, roles]);

  const handleMentorPromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mentorPrompt.trim()) return;
    sessionStorage.setItem('shami_mentor_initial_prompt', mentorPrompt);
    setMentorPrompt('');
    window.location.hash = '#mentor';
  };

  const archetypeCopy = formatArchetypeCopy(vm.archetypeDescription, t);
  const tabCopy: Record<string, string> = {
    skills: archetypeCopy.join(' '),
    motivation: vm.mentorAdvice || t('rebuild.dashboard.motivation_default', { defaultValue: 'Vaše motivace směřuje k seberealizaci a objevování nových obzorů.' }),
    environment: t('rebuild.dashboard.top_signals', { defaultValue: 'Nejsilnější kariérní signály: {{signals}}.', signals: vm.heroMetrics.slice(0, 3).map((m) => m.label).join(', ') }),
    values: vm.challengeTags.length ? `Témata hodnotově nejbližší: ${vm.challengeTags.join(', ')}.` : vm.archetypeDescription,
    risks: vm.blindSpots.length ? `Pozor na: ${vm.blindSpots.slice(0, 2).map((s) => s.label).join(', ')}.` : 'Slepé skvrny upřesníme po JobFit Kompasu.',
  };
  const tabLabels: Record<string, string> = {
    skills: 'Esence', motivation: 'Rada', environment: 'Prostředí', values: 'Hodnoty', risks: 'Rizika',
  };

  const navItems = [
    { id: 'home', label: t('rebuild.nav.home', { defaultValue: 'Dashboard' }), icon: LayoutDashboard, path: '/candidate/insights' },
    { id: 'profile', label: t('rebuild.nav.profile', { defaultValue: 'Profil' }), icon: CircleUserRound, path: '/candidate/profile' },
    { id: 'jcfpm', label: t('rebuild.nav.self_knowledge', { defaultValue: 'JobFit Kompas' }), icon: Brain, path: '/candidate/jcfpm' },
    { id: 'work', label: t('rebuild.nav.work', { defaultValue: 'Tržiště práce' }), icon: Briefcase, path: '/candidate/marketplace' },
    { id: 'applications', label: t('rebuild.nav.applications', { defaultValue: 'Moje žádosti' }), icon: MessageSquare, path: '/candidate/applications' },
    { id: 'learning', label: t('rebuild.nav.learning', { defaultValue: 'Rozvoj' }), icon: GraduationCap, path: '/candidate/learning' },
  ];

  const activeItemId = hashSection === 'profile' ? 'profile'
    : hashSection === 'learning' ? 'learning'
      : hashSection === 'mentor' ? 'home'
        : hashSection === 'messages' ? 'applications'
          : 'home';

  const isProfileView = hashSection === 'profile';
  const isMentorView = hashSection === 'mentor';
  const firstName = userProfile.isLoggedIn
    ? getCandidateGreetingName({ profileName: userProfile.name, language: currentLanguage })
    : '';

  // ─── Logged-out view ──────────────────────────────────────────────────
  if (!userProfile.isLoggedIn) {
    return (
      <DashboardLayoutV2
        userRole="candidate"
        navItems={navItems}
        activeItemId={activeItemId}
        onNavigate={(_id, path) => { if (path) navigate(path); }}
        userProfile={userProfile}
        onCompanySwitch={onCompanySwitch}
        currentLanguage={currentLanguage}
        onLanguageChange={onLanguageChange}
        title="Jobshaman"
        subtitle={t('rebuild.dashboard.logged_out_subtitle', { defaultValue: 'Přihlaste se a otevřete svůj osobní pracovní kompas.' })}
        t={t}
      >
        <CandidateShellSurface variant="dashboard" className="max-w-full px-2 pb-2 pt-1">
          <ShellCard className="overflow-hidden p-0 shamanic-glass-card relative">
            <div className="shamanic-noise-overlay absolute inset-0 rounded-[24px]" />
            <div className="grid gap-6 p-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center relative z-10">
              <div>
                <div className={sectionTitleClass}>{t('rebuild.dashboard.private_compass', { defaultValue: 'Osobní pracovní kompas' })}</div>
                <h1 className="mt-4 max-w-2xl text-[2.35rem] font-semibold leading-[1.02] tracking-[-0.055em] text-[color:var(--text-strong)]">
                  {t('rebuild.dashboard.auth_required_title', { defaultValue: 'Vaše data se zobrazí po přihlášení.' })}
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-[color:var(--text-muted)]">
                  {t('rebuild.dashboard.auth_required_desc', { defaultValue: 'Profil, archetyp, JHI a doporučení jsou soukromé. V odhlášeném režimu je nezobrazujeme.' })}
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <button type="button" onClick={() => onOpenAuth?.('candidate')} className={primaryButtonClass}>
                    {t('rebuild.nav.sign_in', { defaultValue: 'Přihlásit se' })}
                  </button>
                  <button type="button" onClick={onCompanySwitch || (() => onOpenAuth?.('recruiter'))} className={secondaryButtonClass}>
                    {t('rebuild.dashboard.company_profile', { defaultValue: 'Firemní profil' })}
                  </button>
                  <button type="button" onClick={() => navigate('/candidate/marketplace')} className={secondaryButtonClass}>
                    {t('rebuild.dashboard.browse_jobs', { defaultValue: 'Procházet nabídky' })}
                  </button>
                </div>
              </div>
              <div className="rounded-[26px] border border-[color:var(--dashboard-soft-border)] bg-[color:var(--dashboard-soft-bg)] p-5">
                <div className="text-[1.05rem] font-semibold text-[color:var(--text-strong)]">{t('rebuild.dashboard.auth_info_title', { defaultValue: 'Co se po přihlášení odemkne' })}</div>
                <div className="mt-4 space-y-3 text-sm leading-6 text-[color:var(--text-muted)]">
                  <div className="rounded-[18px] bg-[color:var(--dashboard-card-bg)] border border-[color:var(--dashboard-soft-border)] px-4 py-3">{t('rebuild.dashboard.auth_info_profile', { defaultValue: 'Profil a dokumenty životopisu' })}</div>
                  <div className="rounded-[18px] bg-[color:var(--dashboard-card-bg)] border border-[color:var(--dashboard-soft-border)] px-4 py-3">{t('rebuild.dashboard.auth_info_jhi', { defaultValue: 'Sebepoznání, JHI index a mapa růstu' })}</div>
                  <div className="rounded-[18px] bg-[color:var(--dashboard-card-bg)] border border-[color:var(--dashboard-soft-border)] px-4 py-3">{t('rebuild.dashboard.auth_info_apps', { defaultValue: 'Jednání s firmami, doporučení a uložené role' })}</div>
                </div>
              </div>
            </div>
          </ShellCard>
        </CandidateShellSurface>
      </DashboardLayoutV2>
    );
  }

  return (
    <DashboardLayoutV2
      userRole="candidate"
      navItems={navItems}
      activeItemId={activeItemId}
      onNavigate={(_id, path) => { if (path) navigate(path); }}
      userProfile={userProfile}
      onSignOut={onSignOut}
      onCompanySwitch={onCompanySwitch}
      currentLanguage={currentLanguage}
      onLanguageChange={onLanguageChange}
      title={isProfileView
        ? t('rebuild.dashboard.my_profile', { defaultValue: 'Můj profil' })
        : firstName
          ? t('rebuild.dashboard.greeting', { defaultValue: 'Ahoj, {{name}}', name: firstName })
          : t('rebuild.dashboard.default_title', { defaultValue: 'Tvůj pracovní kompas' })}
      subtitle={isProfileView
        ? t('rebuild.dashboard.profile_subtitle', { defaultValue: 'Vaše dovednosti, zkušenosti a potenciál na jednom místě.' })
        : t('rebuild.dashboard.default_subtitle', { defaultValue: '„Každý má v sobě potenciál. Naším posláním je ho probudit." — Shami' })}
      t={t}
    >
      {/* ── Profile View ── */}
      {isProfileView ? (
        <CandidateProfileV2
          userProfile={userProfile}
          setUserProfile={setUserProfile}
          preferences={preferences}
          activeCvDocument={activeCvDocument}
          cvDocuments={cvDocuments}
          cvLoading={cvLoading}
          cvBusy={cvBusy}
          isSavingProfile={isSavingProfile}
          onSaveProfile={onSaveProfile}
          onUploadCv={onUploadCv}
          onSelectCv={onSelectCv}
          onDeleteCv={onDeleteCv}
          onUploadPhoto={onUploadPhoto}
          navigate={navigate}
        />

      ) : isMentorView ? (
        /* ── Mentor Chat View ── */
        <div className="flex w-full h-[75vh] gap-5">
          <div className="flex-1 min-w-0 rounded-3xl border border-cyan-100 bg-white shadow-xl overflow-hidden p-2 md:p-4">
            <ChatMentor
              intro={t('rebuild.dashboard.mentor_intro', { defaultValue: 'Jsem tady. Ne jako chatbot na líbivé věty, ale jako pracovní zrcadlo. Začni otázkou, nebo mi rovnou řekni, kde se ti kariéra zasekla, {{name}}.', name: getCandidateGreetingName({ profileName: userProfile.name, language: currentLanguage }) || t('rebuild.dashboard.you', { defaultValue: 'ty' }) })}
              sendMessageFn={async (message, messages) => {
                const reply = await sendMentorChatMessage(message, messages);
                return {
                  reply: [reply.reply, reply.next_step ? `${t('rebuild.dashboard.next_step', { defaultValue: 'Další krok' })}: ${reply.next_step}` : ''].filter(Boolean).join('\n\n'),
                };
              }}
              storageKey={`shami_candidate_chat_${userProfile?.id || 'anonymous'}`}
            />
          </div>
          <div className="hidden xl:block w-[360px] max-w-xs flex-shrink-0">
            <CandidateChatSidebar
              userId={userProfile?.id}
              selectedChatId={currentChatId}
              onSelectChat={setCurrentChatId}
            />
          </div>
        </div>

      ) : (
        /* ── Main Dashboard View ── */
        <CandidateShellSurface variant="dashboard" className="max-w-full px-2 pb-8 pt-1">

          {/* Onboarding Alert */}
          {!vm.isOnboardingComplete && (
            <OnboardingAlert onStart={() => navigate('/candidate/onboarding')} />
          )}

          {/* Premium Upsell */}
          {(userProfile.subscription?.tier || 'free') === 'free' && (
            <div className="mb-5 rounded-[20px] border border-[#0f95ac]/20 bg-gradient-to-r from-[#f0fafc] to-[#f7fcfd] p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0f95ac]/10 text-[#0f95ac]">
                  <Sparkles size={18} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0f95ac]">Premium</span>
                  <p className="text-[13px] font-semibold text-slate-800 leading-snug">
                    {t('rebuild.premium.candidate_title', { defaultValue: 'Odemkni JobFit Kompas a více odpovědí.' })}
                  </p>
                </div>
              </div>
              <button type="button" disabled={premiumBusy} onClick={onUpgradePremium} className="shrink-0 inline-flex items-center gap-2 rounded-full bg-[#0f95ac] px-5 py-2 text-xs font-bold text-white shadow-lg shadow-[#0f95ac]/20 transition hover:bg-[#0b7181]">
                {premiumBusy ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                {t('rebuild.premium.upgrade_cta', { defaultValue: 'Upgradovat' })}
              </button>
            </div>
          )}

          {/* ══ ROW 1: Welcome Hero Bar ══════════════════════════════════════ */}
          <div className="mb-5 rounded-[24px] border border-[color:var(--dashboard-soft-border)] bg-[color:var(--dashboard-card-bg)] shadow-sm p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Greeting */}
            <div className="min-w-0">
              <div className={sectionTitleClass}>Tvůj pracovní kompas</div>
              <h1 className="mt-1.5 text-[22px] font-extrabold tracking-tight text-[color:var(--text-strong)] leading-tight">
                {firstName ? `Ahoj, ${firstName} 👋` : 'Tvůj dashboard'}
              </h1>
              <p className="mt-1 text-[12px] text-[color:var(--text-muted)] leading-snug max-w-[40ch]">
                {vm.isJcfpmComplete
                  ? `Archetyp: ${vm.archetypeTitle}`
                  : 'Dokonči JobFit Kompas a odemkni svůj kariérní archetyp.'}
              </p>
            </div>

            {/* KPI Chips */}
            <div className="flex flex-wrap gap-2.5 shrink-0">
              <KpiChip
                label="JHI Index"
                value={`${vm.resonanceScore}%`}
                icon={<Compass size={16} />}
                tone="gold"
                onClick={() => navigate('/candidate/jcfpm')}
              />
              <KpiChip
                label="Aktivní žádosti"
                value={candidateApplications.length || 0}
                icon={<MessageSquare size={16} />}
                tone={candidateApplications.length > 0 ? 'teal' : 'default'}
                onClick={() => navigate('/candidate/applications')}
              />
              <KpiChip
                label="Volné sloty"
                value={Math.max(0, (userProfile.subscription?.tier === 'premium' ? 25 : (userProfile.slots || 5)) - candidateApplications.length)}
                icon={<Target size={16} />}
                tone="default"
              />
              <KpiChip
                label="Nabídky"
                value={roles.length}
                icon={<Briefcase size={16} />}
                tone="default"
                onClick={() => navigate('/candidate/marketplace')}
              />
            </div>
          </div>

          {/* ══ ROW 2: Main Content ══════════════════════════════════════════ */}
          <div className="mb-5 grid gap-5 lg:grid-cols-12 items-start">

            {/* ── LEFT: Archetype & Identity Card (lg:col-span-7) ── */}
            <div className="lg:col-span-7 shamanic-glass-card rounded-[28px] overflow-hidden relative">
              <div className="shamanic-noise-overlay absolute inset-0 rounded-[28px]" />
              <div className="relative z-10 p-6">

                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <span className={sectionTitleClass}>Kariérní identita</span>
                    {vm.isJcfpmComplete && (
                      <h2 className="mt-1 text-[22px] font-extrabold leading-tight tracking-tight text-[color:var(--accent-gold)] drop-shadow-[0_0_12px_rgba(var(--accent-gold-rgb),0.2)]">
                        {vm.archetypeTitle}
                      </h2>
                    )}
                  </div>
                  <div className="shrink-0">
                    <JHIGauge score={vm.resonanceScore} size={72} />
                  </div>
                </div>

                {vm.isJcfpmComplete ? (
                  <>
                    {/* Enso + Score Centrepiece */}
                    <div className="relative h-[160px] flex items-center justify-center overflow-hidden mb-5">
                      <AnimatedEnsoRing />
                      <div className="relative z-10 flex flex-col items-center">
                        <span className="text-[52px] font-black tracking-tighter text-[color:var(--text-strong)] leading-none">{vm.resonanceScore}%</span>
                        <span className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--text-muted)] mt-1">Rezonance</span>
                      </div>
                    </div>

                    {/* Tab content */}
                    <div className="rounded-2xl bg-[color:var(--dashboard-soft-bg)] border border-[color:var(--dashboard-soft-border)] p-4 mb-4">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--accent-gold)] mb-2">
                        {activeArchetypeTab === 'skills' ? 'Kariérní esence' : activeArchetypeTab === 'motivation' ? 'Šamanovo doporučení' : activeArchetypeTab === 'environment' ? 'Ideální prostředí' : activeArchetypeTab === 'values' ? 'Hodnotové ladění' : 'Oblasti růstu'}
                      </p>
                      <p className="text-[13px] text-[color:var(--text-muted)] leading-relaxed">{tabCopy[activeArchetypeTab]}</p>
                    </div>

                    {/* Tab switcher */}
                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {Object.entries(tabLabels).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setActiveArchetypeTab(key)}
                          className={cn(
                            'px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border',
                            activeArchetypeTab === key
                              ? 'bg-[color:var(--accent-gold)] text-black border-[color:var(--accent-gold)]'
                              : 'bg-transparent text-[color:var(--text-muted)] border-[color:var(--dashboard-soft-border)] hover:text-[color:var(--text-strong)]',
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Hero Metric Pills */}
                    {vm.heroMetrics.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {vm.heroMetrics.slice(0, 6).map((m) => (
                          <TraitPill key={m.id} label={m.label} value={m.value} tone={m.tone} />
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  /* Not yet completed JCFPM */
                  <div className="flex flex-col items-center justify-center text-center py-10">
                    <div className="relative mb-4">
                      <div className="absolute inset-0 bg-[color:var(--accent-gold)]/10 rounded-full blur-2xl scale-150 animate-pulse" />
                      <Brain size={52} className="relative z-10 text-[color:var(--accent-gold)] animate-pulse" />
                    </div>
                    <h3 className="text-lg font-bold text-[color:var(--accent-gold)]">Odemkni svou identitu</h3>
                    <p className="mt-2 text-xs text-[color:var(--text-muted)] max-w-[26ch] leading-relaxed">
                      Projdi JobFit Kompasem a zobraz kariérní archetyp i index souladu.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate('/candidate/jcfpm')}
                      className="mt-6 inline-flex items-center gap-2 rounded-full bg-[color:var(--accent-gold)] text-black px-6 py-2.5 text-xs font-bold transition hover:scale-105"
                    >
                      <Brain size={14} />
                      Spustit JobFit Kompas
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT: Next Move Card (lg:col-span-5) ── */}
            <div className="lg:col-span-5 flex flex-col gap-4">

              {/* Shami Advice + Chat */}
              <div className="rounded-[24px] border border-[color:var(--dashboard-soft-border)] bg-[color:var(--dashboard-card-bg)] p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative shrink-0">
                    <div className="absolute inset-0 bg-[color:var(--accent)]/10 rounded-full blur-lg scale-150 animate-pulse" />
                    <img
                      src={vm.isJcfpmComplete ? '/shami-happy.png' : '/shami.png'}
                      alt="Průvodce Shami"
                      className="w-12 h-12 object-contain relative z-10"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-extrabold text-[color:var(--text-strong)]">Průvodce Shami</span>
                      <Sparkles size={13} className="text-[color:var(--accent-gold)]" />
                    </div>
                    <span className="text-[10px] text-[color:var(--text-muted)]">Tvůj AI kariérní mentor</span>
                  </div>
                </div>

                <div className="rounded-2xl bg-[color:var(--dashboard-soft-bg)] border border-[color:var(--dashboard-soft-border)] p-3.5 mb-4 text-[13px] text-[color:var(--text-muted)] leading-relaxed italic">
                  „{vm.mentorAdvice || 'Naslouchej svému vnitřnímu hlasu. Tvá profesní cesta se začíná jasně rýsovat. Zeptej se mě na cokoliv.'}"
                </div>

                <form onSubmit={handleMentorPromptSubmit} className="relative">
                  <input
                    type="text"
                    placeholder="Zeptej se na svou kariéru..."
                    value={mentorPrompt}
                    onChange={(e) => setMentorPrompt(e.target.value)}
                    className="w-full h-10 rounded-full bg-[color:var(--dashboard-soft-bg)] border border-[color:var(--dashboard-soft-border)] px-4 pr-10 text-[12px] text-[color:var(--text-strong)] focus:outline-none focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--accent)] transition"
                  />
                  <button
                    type="submit"
                    className="absolute right-1.5 top-1.5 h-7 w-7 rounded-full bg-[color:var(--accent)] text-white flex items-center justify-center hover:scale-105 active:scale-95 transition"
                  >
                    <Send size={11} />
                  </button>
                </form>

                <button
                  type="button"
                  onClick={() => navigate('/candidate/insights#mentor')}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-[color:var(--accent)] hover:underline"
                >
                  <MessageSquare size={12} />
                  Otevřít plné chatovací zrcadlo
                </button>
              </div>

              {/* Top Recommended Role */}
              {roles.length > 0 && (
                <div className="rounded-[24px] border border-[#c7e9f0]/60 bg-gradient-to-br from-[#f7fcfd] to-[#edf8fb] p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#0f95ac]">
                      <Star size={10} className="inline mr-1" />
                      Doporučená výzva
                    </span>
                    <span className="rounded-full border border-[#b8e4ec] bg-white px-2.5 py-1 text-[10px] font-black text-[#0f95ac]">
                      {featuredScore}% fit
                    </span>
                  </div>
                  <h4 className="text-[15px] font-black text-slate-900 leading-tight mb-1">{featuredRole?.title || 'Žádné nabídky'}</h4>
                  <p className="text-[12px] text-slate-500 mb-3 truncate">
                    {[featuredRole?.companyName, featuredRole?.location].filter(Boolean).join(' · ')}
                  </p>
                  {featuredRole?.skills?.length ? (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {featuredRole.skills.slice(0, 3).map((skill) => (
                        <span key={skill} className="rounded-full bg-[#e0f5f9] px-2.5 py-0.5 text-[10px] font-bold text-[#0f6a7a]">{skill}</span>
                      ))}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => navigate(getRolePath(featuredRole))}
                    className="inline-flex items-center gap-1.5 text-[12px] font-black text-[#0f95ac] hover:text-[#0b7181] transition"
                  >
                    Otevřít detail role <ArrowRight size={13} />
                  </button>
                </div>
              )}

              {/* 2 quick stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-[color:var(--dashboard-soft-border)] bg-[color:var(--dashboard-card-bg)] p-4">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[color:var(--text-muted)]">Fokus týdne</span>
                  <p className="mt-1.5 text-[13px] font-bold text-[color:var(--text-strong)] truncate">{vm.recommendedGrowthTitle}</p>
                </div>
                <div className="rounded-2xl border border-[color:var(--dashboard-soft-border)] bg-[color:var(--dashboard-card-bg)] p-4">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[color:var(--text-muted)]">Příležitost</span>
                  <p className="mt-1.5 text-[13px] font-bold text-[color:var(--accent)] truncate">{vm.challengeTags[0] || 'Prozkoumat trh'}</p>
                </div>
              </div>
            </div>

          </div>

          {/* ══ ROW 3: Action Layer ══════════════════════════════════════════ */}
          <div className="grid gap-5 lg:grid-cols-3">

            {/* ── Cesta rozvoje (Growth Timeline) ── */}
            <div className="rounded-[24px] border border-[color:var(--dashboard-soft-border)] bg-[color:var(--dashboard-card-bg)] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className={sectionTitleClass}>Cesta rozvoje</span>
                <span className="text-xs font-bold text-[color:var(--accent-green)]">{vm.growthProgress}%</span>
              </div>

              {/* Progress bar */}
              <div className="relative h-1.5 bg-[color:var(--dashboard-soft-border)] rounded-full overflow-hidden mb-5">
                <div
                  className="absolute top-0 bottom-0 left-0 bg-[color:var(--accent-green)] shadow-[0_0_8px_rgba(var(--accent-green-rgb),0.5)] transition-all duration-1000 rounded-full"
                  style={{ width: `${vm.growthProgress}%` }}
                />
              </div>

              {/* Milestones */}
              <div className="space-y-0">
                <MilestoneDot
                  done
                  label="Onboarding"
                  caption="Základní profil vyplněn"
                />
                <MilestoneDot
                  active={vm.isJcfpmComplete}
                  done={vm.isJcfpmComplete}
                  label="JobFit Kompas"
                  caption={vm.isJcfpmComplete ? 'Archetyp odemčen' : 'Spusť a odemkni svůj profil'}
                />
                <MilestoneDot
                  active={candidateApplications.length > 0}
                  done={candidateApplications.length >= 3}
                  label="První jednání"
                  caption={candidateApplications.length > 0 ? `${candidateApplications.length} aktivních žádostí` : 'Pošli první žádost'}
                />
                <MilestoneDot
                  label="Nabídka práce"
                  caption="Cíl: úspěšné umístění"
                />
              </div>
            </div>

            {/* ── Aktivní jednání ── */}
            <div className="rounded-[24px] border border-[color:var(--dashboard-soft-border)] bg-[color:var(--dashboard-card-bg)] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className={sectionTitleClass}>Aktivní jednání</span>
                <button
                  type="button"
                  onClick={() => navigate('/candidate/applications')}
                  className="text-[10px] font-bold text-[color:var(--text-muted)] hover:text-[color:var(--text-strong)] flex items-center gap-1"
                >
                  Vše <ChevronRight size={12} />
                </button>
              </div>

              {handshakeRows.length > 0 ? (
                <div className="space-y-2.5">
                  {handshakeRows.slice(0, 3).map((row, idx) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => openHandshakeOrRole(row.id)}
                      className="w-full text-left flex items-center gap-3 p-3 rounded-2xl border border-[color:var(--dashboard-soft-border)] bg-[color:var(--dashboard-soft-bg)] hover:bg-[color:var(--dashboard-card-bg)] transition group"
                    >
                      <div className={cn(
                        'h-9 w-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0',
                        companyTileClass[idx % companyTileClass.length],
                      )}>
                        {row.company.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold text-[color:var(--text-strong)] truncate">{row.company}</p>
                        <p className="text-[11px] text-[color:var(--text-muted)] truncate">{row.role}</p>
                      </div>
                      <HandshakeScore score={row.score} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <MessageSquare size={28} className="text-[color:var(--dashboard-soft-border)] mb-3" />
                  <p className="text-xs text-[color:var(--text-muted)] mb-3">Zatím žádné žádosti.</p>
                  <button
                    type="button"
                    onClick={() => navigate('/candidate/marketplace')}
                    className="text-[11px] font-bold text-[color:var(--accent)] hover:underline"
                  >
                    Prozkoumat nabídky →
                  </button>
                </div>
              )}

              {candidateApplications.length === 0 && roles.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[color:var(--dashboard-soft-border)]">
                  <p className="text-[10px] text-[color:var(--text-muted)] mb-2 uppercase font-bold tracking-wider">Doporučené nabídky</p>
                  {evaluatedRoles.slice(0, 2).map((item, idx) => (
                    <button
                      key={item.role.id}
                      type="button"
                      onClick={() => navigate(getRolePath(item.role))}
                      className="w-full text-left flex items-center gap-2 py-2 group"
                    >
                      <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0', companyTileClass[idx % companyTileClass.length])}>
                        {(item.role.companyName || 'F').slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-[color:var(--text-strong)] truncate">{item.role.title}</p>
                      </div>
                      <span className="text-[10px] font-black text-[color:var(--accent-gold)]">{item.score}%</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Rychlé akce ── */}
            <div className="rounded-[24px] border border-[color:var(--dashboard-soft-border)] bg-[color:var(--dashboard-card-bg)] p-5 shadow-sm flex flex-col">
              <span className={cn(sectionTitleClass, 'mb-4')}>Rychlé akce</span>

              <div className="flex flex-col gap-2.5 flex-1">
                <button
                  type="button"
                  onClick={() => navigate('/candidate/marketplace')}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl border border-[#c7e9f0]/70 bg-gradient-to-r from-[#f0fafc] to-[#f7fcfd] text-[13px] font-bold text-[#0f6a7a] hover:from-[#e4f5f9] hover:to-[#edf8fb] transition group"
                >
                  <Briefcase size={16} className="text-[#0f95ac] shrink-0" />
                  <span>Prozkoumat trh práce</span>
                  <ArrowRight size={14} className="ml-auto text-[#0f95ac] group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/candidate/jcfpm')}
                  className={cn(
                    'flex items-center gap-3 w-full px-4 py-3 rounded-2xl border text-[13px] font-bold transition group',
                    vm.isJcfpmComplete
                      ? 'border-[color:var(--dashboard-soft-border)] bg-[color:var(--dashboard-soft-bg)] text-[color:var(--text-strong)] hover:bg-[color:var(--dashboard-soft-border)]'
                      : 'border-[color:var(--accent-gold)]/40 bg-[color:var(--accent-gold)]/5 text-[color:var(--accent-gold)] hover:bg-[color:var(--accent-gold)]/10',
                  )}
                >
                  <Brain size={16} className="shrink-0" />
                  <span>{vm.isJcfpmComplete ? 'Zobrazit JobFit Kompas' : 'Spustit JobFit Kompas'}</span>
                  <ArrowRight size={14} className="ml-auto group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/candidate/profile')}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl border border-[color:var(--dashboard-soft-border)] bg-[color:var(--dashboard-soft-bg)] text-[13px] font-bold text-[color:var(--text-strong)] hover:bg-[color:var(--dashboard-soft-border)] transition group"
                >
                  <CircleUserRound size={16} className="text-[color:var(--text-muted)] shrink-0" />
                  <span>Upravit profil</span>
                  <ArrowRight size={14} className="ml-auto text-[color:var(--text-muted)] group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/candidate/learning')}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl border border-[color:var(--dashboard-soft-border)] bg-[color:var(--dashboard-soft-bg)] text-[13px] font-bold text-[color:var(--text-strong)] hover:bg-[color:var(--dashboard-soft-border)] transition group"
                >
                  <BookOpen size={16} className="text-[color:var(--text-muted)] shrink-0" />
                  <span>Plán rozvoje</span>
                  <ArrowRight size={14} className="ml-auto text-[color:var(--text-muted)] group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/candidate/insights#mentor')}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl border border-[color:var(--dashboard-soft-border)] bg-[color:var(--dashboard-soft-bg)] text-[13px] font-bold text-[color:var(--text-strong)] hover:bg-[color:var(--dashboard-soft-border)] transition group"
                >
                  <Sparkles size={16} className="text-[color:var(--accent-gold)] shrink-0" />
                  <span>Chat se Shamim</span>
                  <ArrowRight size={14} className="ml-auto text-[color:var(--text-muted)] group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              {/* Motivační citát */}
              <div className="mt-4 pt-4 border-t border-[color:var(--dashboard-soft-border)]">
                <p className="text-[11px] italic text-[color:var(--text-muted)] leading-relaxed text-center">
                  „Každý má v sobě potenciál. Naším posláním je ho probudit."
                </p>
                <p className="text-[10px] font-bold text-[color:var(--accent-gold)] text-center mt-1">— Shami</p>
              </div>
            </div>

          </div>

        </CandidateShellSurface>
      )}
    </DashboardLayoutV2>
  );
};
