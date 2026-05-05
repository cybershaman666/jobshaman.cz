import React from 'react';
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  Handshake,
  Sparkles,
  UserRound,
  UsersRound,
} from 'lucide-react';

import type { CompanyProfile, UserProfile } from '../../types';
import type { AuthIntent } from '../authTypes';
import { cn } from '../cn';
import type { PublicPage } from '../routing';
import { useTranslation } from 'react-i18next';
import { BrandMark, LanguageSwitcher, ThemeToggle } from '../ui/ShellChrome';
import i18n from '../../i18n';
import {
  panelClass,
  pillEyebrowClass,
  primaryButtonClass,
  secondaryButtonClass,
  shellPageClass,
} from '../ui/shellStyles';

const OrganizationSchema: React.FC = () => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "JobShaman",
    "url": "https://jobshaman.cz",
    "logo": "https://jobshaman.cz/logo-transparent.png",
    "sameAs": [
      "https://www.linkedin.com/company/jobshaman",
      "https://twitter.com/jobshaman"
    ],
    "description": "Skill-first hiring platform for the modern work reality. No CV spam, just signals that matter."
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
};

export const LandingChoicePage: React.FC<{
  userProfile: UserProfile;
  navigate: (path: string) => void;
  onOpenAuth: (intent: AuthIntent) => void;
}> = ({ userProfile, navigate, onOpenAuth }) => {
  const { t } = useTranslation();

  const landingCopy = {
    eyebrow: t('rebuild.landing.eyebrow', { defaultValue: 'Skill-first hiring for candidates and companies' }),
    title: t('rebuild.landing.title', { defaultValue: 'Work that makes sense.' }),
    subtitle: t('rebuild.landing.subtitle', { defaultValue: 'No CV spam. No silence after submission. No lost candidates.' }),
    primaryCta: t('rebuild.landing.primary_cta', { defaultValue: 'I am a candidate' }),
    companyCta: t('rebuild.landing.company_cta', { defaultValue: 'I am a company' }),
    principlesLabel: t('rebuild.landing.principles_label', { defaultValue: '3 key principles' }),
    pillars: [
      {
        title: t('rebuild.landing.pillar1_title', { defaultValue: 'Skills instead of CV' }),
        copy: t('rebuild.landing.pillar1_copy', { defaultValue: 'First you show what you can do. The CV is only the second step.' }),
        icon: Briefcase,
      },
      {
        title: t('rebuild.landing.pillar2_title', { defaultValue: 'Limited number of active applications' }),
        copy: t('rebuild.landing.pillar2_copy', { defaultValue: 'Every application matters. Less chaos, more responses.' }),
        meta: t('rebuild.landing.pillar2_meta', { defaultValue: 'Free: 5 active applications. Premium: 25 active applications.' }),
        icon: UsersRound,
      },
      {
        title: t('rebuild.landing.pillar3_title', { defaultValue: 'Verification in practice' }),
        copy: t('rebuild.landing.pillar3_copy', { defaultValue: 'The next step is not just a click. The candidate truly proves their skills — and the company responds.' }),
        icon: Handshake,
      },
    ],
  };

  return (
    <main className={cn(shellPageClass, 'flex min-h-screen items-center bg-[#fbfaf7] dark:bg-slate-950')}>
      <OrganizationSchema />
      <div className="absolute top-6 right-6 flex items-center gap-4">
        <ThemeToggle />
        <LanguageSwitcher i18n={i18n} />
      </div>
      <section aria-labelledby="hero-title" className="mx-auto grid w-full max-w-[1080px] gap-10 px-6 py-10 md:grid-cols-[minmax(0,1fr)_22rem] md:items-center">
        <div>
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <BrandMark subtitle="" compact />
            <div className="hidden h-5 w-px bg-slate-200 dark:bg-slate-800 sm:block" />
            <div className="text-[0.72rem] font-bold uppercase tracking-[0.18em] text-[#6f7890] dark:text-slate-400">
              {landingCopy.eyebrow}
            </div>
          </header>
          <div className="mt-12 inline-flex items-center gap-2 rounded-full border border-[#d7c7a8] bg-white px-3 py-1 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[#8c6727] shadow-sm dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-500">
            <Sparkles size={13} />
            {t('rebuild.landing.verified_hiring', { defaultValue: 'Verified hiring without ghosting' })}
          </div>
          <h1 id="hero-title" className="mt-5 max-w-3xl text-5xl font-semibold leading-[1.02] text-slate-950 dark:text-white md:text-7xl">
            {landingCopy.title}
          </h1>
          <p className="mt-6 max-w-2xl text-xl leading-8 text-slate-600 dark:text-slate-400">{landingCopy.subtitle}</p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              aria-label={t('rebuild.landing.enter_as_candidate', { defaultValue: 'Enter as a candidate' })}
              onClick={() => (userProfile.isLoggedIn ? navigate('/candidate/marketplace') : onOpenAuth('candidate'))}
              className="inline-flex h-12 items-center justify-center gap-3 rounded-xl bg-[#b98331] px-6 text-sm font-bold text-white shadow-[0_18px_34px_-24px_rgba(159,118,45,0.88)] transition hover:bg-[#a57124]"
            >
              <UserRound size={18} />
              {landingCopy.primaryCta}
            </button>
            <button
              type="button"
              aria-label={t('rebuild.landing.enter_as_company', { defaultValue: 'Enter as a company' })}
              onClick={() => navigate('/firmy')}
              className="inline-flex h-12 items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-6 text-sm font-bold text-slate-800 transition hover:border-[#c99a4a] hover:bg-[#fffbf5]"
            >
              <Building2 size={18} />
              {landingCopy.companyCta}
            </button>
          </div>
          <div className="mt-8 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-300">
            <span className="text-[#8c6727] dark:text-amber-500">◆</span>
            {landingCopy.principlesLabel}
          </div>
          <div className="mt-4 grid max-w-3xl gap-3 md:grid-cols-3">
            {landingCopy.pillars.map(({ title, copy, meta, icon: Icon }) => (
              <article key={title} className="rounded-lg border border-slate-200 bg-white/78 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
                <Icon size={18} className="text-[#8c6727] dark:text-amber-500" />
                <h2 className="mt-3 text-sm font-bold text-slate-950 dark:text-white">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{copy}</p>
                {meta ? <p className="mt-3 text-xs font-semibold leading-5 text-[#8c6727] dark:text-amber-500">{meta}</p> : null}
              </article>
            ))}
          </div>
        </div>

        <aside className="hidden rounded-lg border border-slate-200 bg-white p-5 shadow-[0_28px_80px_-58px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-900 md:block">
          <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-[radial-gradient(circle_at_center,#f3d691_0%,#f8f4e8_34%,#eef7f6_70%)] dark:bg-[radial-gradient(circle_at_center,#451a03_0%,#0f172a_70%)]">
            <img src="/logo-transparent.png" alt="JobShaman Logo" className="h-[82%] w-[82%] object-contain drop-shadow-[0_24px_40px_rgba(121,86,32,0.16)] dark:brightness-110 dark:filter" loading="eager" />
          </div>
          <div className="mt-5 grid gap-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
            {landingCopy.pillars.map(({ title, icon: Icon }) => (
              <div key={`visual-${title}`} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                <Icon size={17} className="text-[#8c6727] dark:text-amber-500" />
                {title}
              </div>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
};

export const CompanyEntryPage: React.FC<{
  userProfile: UserProfile;
  companyProfile: CompanyProfile | null;
  navigate: (path: string) => void;
  onOpenAuth: (intent: AuthIntent) => void;
  onCheckout?: (tier: 'starter' | 'growth' | 'professional') => void;
  checkoutBusyTier?: 'starter' | 'growth' | 'professional' | null;
}> = ({ userProfile, companyProfile, navigate, onOpenAuth, onCheckout, checkoutBusyTier }) => {
  const { t } = useTranslation();
  const companyReady = Boolean(userProfile.isLoggedIn && companyProfile?.id);
  const primaryAction = () => {
    if (companyReady) {
      navigate('/recruiter');
      return;
    }
    onOpenAuth('recruiter');
  };

  const workflow = [
    ['1', t('rebuild.company_landing.step1_title', { defaultValue: 'Role definition' }), t('rebuild.company_landing.step1_copy', { defaultValue: 'Describe the actual work, criteria, and situations that the candidate should think about.' })],
    ['2', t('rebuild.company_landing.step2_title', { defaultValue: 'First signal' }), t('rebuild.company_landing.step2_copy', { defaultValue: 'The candidate responds to a specific work scenario. Not just a CV, but proof of thinking.' })],
    ['3', t('rebuild.company_landing.step3_title', { defaultValue: 'Team selection' }), t('rebuild.company_landing.step3_copy', { defaultValue: 'The recruiter and hiring manager see the status, notes, risks, and next steps in one shared space.' })],
  ];

  const outcomes = [
    [t('rebuild.company_landing.outcome1_title', { defaultValue: 'Less noise' }), t('rebuild.company_landing.outcome1_copy', { defaultValue: 'Faster separation of candidates who only look good on paper from those who understand the work.' })],
    [t('rebuild.company_landing.outcome2_title', { defaultValue: 'Better assignments' }), t('rebuild.company_landing.outcome2_copy', { defaultValue: 'The role arises from the reality of the team, not from a template full of empty requirements.' })],
    [t('rebuild.company_landing.outcome3_title', { defaultValue: 'Clear audit' }), t('rebuild.company_landing.outcome3_copy', { defaultValue: 'Decisions are based on responses, signals, and agreed criteria, not on impressions from an inbox.' })],
  ];

  const plans = [
    {
      id: 'free' as const,
      name: t('rebuild.company_landing.plan_free_name', { defaultValue: 'Free' }),
      price: t('rebuild.company_landing.plan_free_price', { defaultValue: 'Zdarma' }),
      cadence: t('rebuild.company_landing.plan_free_cadence', { defaultValue: 'for verification' }),
      description: t('rebuild.company_landing.plan_free_desc', { defaultValue: 'For the first verification of whether skill-first hiring fits your practice.' }),
      features: [
        t('rebuild.company_landing.plan_free_feat1', { defaultValue: '1 active role' }),
        t('rebuild.company_landing.plan_free_feat2', { defaultValue: '3 candidates in process' }),
        t('rebuild.company_landing.plan_free_feat3', { defaultValue: '1 team member' }),
        t('rebuild.company_landing.plan_free_feat4', { defaultValue: 'risk-free trial' }),
      ],
      cta: t('rebuild.company_landing.plan_free_cta', { defaultValue: 'Try for free' }),
    },
    {
      id: 'starter' as const,
      name: t('rebuild.company_landing.plan_starter_name', { defaultValue: 'Starter' }),
      price: t('rebuild.company_landing.plan_starter_price', { defaultValue: '249 EUR' }),
      cadence: t('rebuild.company_landing.plan_starter_cadence', { defaultValue: 'monthly' }),
      description: t('rebuild.company_landing.plan_starter_desc', { defaultValue: 'For a smaller team that wants to systematically move from CV chaos to a clearer shortlist.' }),
      features: [
        t('rebuild.company_landing.plan_starter_feat1', { defaultValue: '3 active roles' }),
        t('rebuild.company_landing.plan_starter_feat2', { defaultValue: '12 candidates in process' }),
        t('rebuild.company_landing.plan_starter_feat3', { defaultValue: '2 team members' }),
        t('rebuild.company_landing.plan_starter_feat4', { defaultValue: '80 AI screenings per month' }),
      ],
      cta: t('rebuild.company_landing.plan_starter_cta', { defaultValue: 'Start with Starter' }),
      highlighted: true,
    },
    {
      id: 'growth' as const,
      name: t('rebuild.company_landing.plan_growth_name', { defaultValue: 'Growth' }),
      price: t('rebuild.company_landing.plan_growth_price', { defaultValue: '599 EUR' }),
      cadence: t('rebuild.company_landing.plan_growth_cadence', { defaultValue: 'monthly' }),
      description: t('rebuild.company_landing.plan_growth_desc', { defaultValue: 'For companies that hire repeatedly and want a clear system instead of role-by-role improvisation.' }),
      features: [
        t('rebuild.company_landing.plan_growth_feat1', { defaultValue: '10 active roles' }),
        t('rebuild.company_landing.plan_growth_feat2', { defaultValue: '40 candidates in process' }),
        t('rebuild.company_landing.plan_growth_feat3', { defaultValue: '5 team members' }),
        t('rebuild.company_landing.plan_growth_feat4', { defaultValue: '250 AI screenings per month' }),
      ],
      cta: t('rebuild.company_landing.plan_growth_cta', { defaultValue: 'Start with Growth' }),
    },
    {
      id: 'professional' as const,
      name: t('rebuild.company_landing.plan_pro_name', { defaultValue: 'Professional' }),
      price: t('rebuild.company_landing.plan_pro_price', { defaultValue: '899 EUR' }),
      cadence: t('rebuild.company_landing.plan_pro_cadence', { defaultValue: 'monthly' }),
      description: t('rebuild.company_landing.plan_pro_desc', { defaultValue: 'For larger hiring organizations that want to align recruiters, team leads, and decision speed.' }),
      features: [
        t('rebuild.company_landing.plan_pro_feat1', { defaultValue: '25 active roles' }),
        t('rebuild.company_landing.plan_pro_feat2', { defaultValue: '100 candidates in process' }),
        t('rebuild.company_landing.plan_pro_feat3', { defaultValue: '12 team members' }),
        t('rebuild.company_landing.plan_pro_feat4', { defaultValue: 'high throughput without chaos' }),
      ],
      cta: t('rebuild.company_landing.plan_pro_cta', { defaultValue: 'Start with Pro plan' }),
    },
  ];

  return (
    <div className={cn(shellPageClass, 'min-h-screen bg-[#f7f8f5] dark:bg-slate-950')}>
      <OrganizationSchema />
      <header className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-4 px-1 pb-8">
        <button type="button" onClick={() => navigate('/candidate/marketplace')} className="text-left">
          <BrandMark subtitle="Hiring workspace" compact />
        </button>
        <div className="hidden items-center gap-6 text-sm font-semibold text-slate-600 dark:text-slate-400 md:flex">
          <a href="#workflow" className="hover:text-slate-950 dark:hover:text-white">Jak to funguje</a>
          <a href="#pricing" className="hover:text-slate-950 dark:hover:text-white">Ceny</a>
          <a href="#faq" className="hover:text-slate-950 dark:hover:text-white">FAQ</a>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <LanguageSwitcher i18n={i18n} />
          {userProfile.isLoggedIn ? (
            <button type="button" onClick={() => navigate('/candidate/marketplace')} className={secondaryButtonClass}>
              {t('rebuild.company_landing.nav_candidate', { defaultValue: 'Kandidátská část' })}
            </button>
          ) : (
            <button type="button" onClick={() => onOpenAuth('candidate')} className={secondaryButtonClass}>
              {t('rebuild.company_landing.nav_login', { defaultValue: 'Přihlášení kandidáta' })}
            </button>
          )}
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-[1280px] gap-10 py-4 lg:grid-cols-[minmax(0,1fr)_30rem] lg:items-center">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#d7c7a8] bg-white px-3 py-1 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[#8c6727] shadow-sm dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-500">
            <Sparkles size={13} />
            {t('rebuild.company_landing.eyebrow', { defaultValue: 'Pro firmy, které vybírají podle práce' })}
          </div>
          <h1 className="mt-6 text-4xl font-semibold leading-[1.02] text-slate-950 dark:text-white md:text-6xl lg:text-7xl">
            {t('rebuild.company_landing.title', { defaultValue: 'Dejte kandidátům úkol, ne jen formulář.' })}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-400">
            {t('rebuild.company_landing.subtitle', { defaultValue: 'JobShaman pomáhá firmám převést roli do konkrétní pracovní reality, získat první užitečný signál od kandidátů a řídit výběr v jednom přehledném prostoru.' })}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={primaryAction} className={primaryButtonClass}>
              {companyReady ? t('rebuild.company_landing.action_open', { defaultValue: 'Otevřít firemní prostor' }) : t('rebuild.company_landing.action_start', { defaultValue: 'Začít jako firma' })}
              <ArrowRight size={16} />
            </button>
            <a href="#pricing" className={secondaryButtonClass}>
              Zobrazit ceny
            </a>
          </div>
          <div className="mt-6 grid max-w-2xl gap-3 text-sm text-slate-600 dark:text-slate-400 sm:grid-cols-3">
            <div><strong className="block text-slate-950 dark:text-white">{t('rebuild.company_landing.feat1_title', { defaultValue: 'No CV drops' })}</strong>{t('rebuild.company_landing.feat1_desc', { defaultValue: 'First response has context.' })}</div>
            <div><strong className="block text-slate-950 dark:text-white">{t('rebuild.company_landing.feat2_title', { defaultValue: 'No chaos' })}</strong>{t('rebuild.company_landing.feat2_desc', { defaultValue: 'Roles, candidates, and steps together.' })}</div>
            <div><strong className="block text-slate-950 dark:text-white">{t('rebuild.company_landing.feat3_title', { defaultValue: 'No lock-in' })}</strong>{t('rebuild.company_landing.feat3_desc', { defaultValue: 'Start with a single role.' })}</div>
          </div>
          <p className="mt-5 text-sm leading-7 text-slate-500 dark:text-slate-500">
            {companyReady
              ? t('rebuild.company_landing.signed_in_as', { defaultValue: 'Signed in as {{name}}.', name: companyProfile?.name || 'company account' })
              : t('rebuild.company_landing.signup_hint', { defaultValue: 'You can create a new company account via the same button. After signing in, you will proceed to create your company profile.' })}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_28px_80px_-52px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-900">
          <div className="rounded-lg border border-slate-200 bg-slate-950 p-4 text-white dark:border-slate-700 dark:bg-black">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d8a24c]">{t('rebuild.company_landing.mock_role_workspace', { defaultValue: 'Role workspace' })}</div>
                <div className="mt-1 text-lg font-semibold">Product Operations Lead</div>
              </div>
              <div className="rounded-full bg-emerald-400/12 px-3 py-1 text-xs font-semibold text-emerald-200">{t('rebuild.company_landing.mock_active', { defaultValue: 'Active' })}</div>
            </div>
            <div className="mt-4 grid gap-3">
              {[
                [t('rebuild.company_landing.mock_assignment', { defaultValue: 'Assignment' }), t('rebuild.company_landing.mock_assignment_desc', { defaultValue: 'Candidate solves a real-team situation' }), '82 %'],
                [t('rebuild.company_landing.mock_signals', { defaultValue: 'Signals' }), t('rebuild.company_landing.mock_signals_desc', { defaultValue: '5 responses waiting for team review' }), '5'],
                [t('rebuild.company_landing.mock_next_step', { defaultValue: 'Next step' }), t('rebuild.company_landing.mock_next_step_desc', { defaultValue: '2 candidates ready for interview' }), '2'],
              ].map(([label, copy, stat]) => (
                <div key={label} className="rounded-lg border border-white/10 bg-white/[0.06] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-white">{label}</div>
                      <div className="mt-1 text-sm leading-6 text-slate-300">{copy}</div>
                    </div>
                    <div className="text-2xl font-semibold text-[#f1c677]">{stat}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">
            <div className="rounded-lg bg-slate-50 px-3 py-3 dark:bg-slate-800/50">{t('rebuild.company_landing.mock_nav_roles', { defaultValue: 'Roles' })}</div>
            <div className="rounded-lg bg-slate-50 px-3 py-3 dark:bg-slate-800/50">{t('rebuild.company_landing.mock_nav_candidates', { defaultValue: 'Candidates' })}</div>
            <div className="rounded-lg bg-slate-50 px-3 py-3 dark:bg-slate-800/50">{t('rebuild.company_landing.mock_nav_decisions', { defaultValue: 'Decisions' })}</div>
          </div>
        </div>
      </section>

      <section id="workflow" className="mx-auto w-full max-w-[1280px] py-14">
        <div className="max-w-2xl">
          <div className={pillEyebrowClass}>{t('rebuild.company_landing.workflow_label', { defaultValue: 'Workflow' })}</div>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white md:text-4xl">{t('rebuild.company_landing.workflow_title', { defaultValue: 'Simple process that the team understands in minutes.' })}</h2>
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {workflow.map(([step, title, copy]) => (
            <article key={title} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f3eadb] text-sm font-bold text-[#8c6727] dark:bg-amber-900/30 dark:text-amber-500">{step}</div>
              <h3 className="mt-5 text-xl font-semibold text-slate-950 dark:text-white">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-[1280px] gap-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[0.9fr_1.1fr] lg:p-8">
        <div>
          <div className={pillEyebrowClass}>Co to zlepší</div>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">Méně dohadů, víc použitelných signálů.</h2>
          <p className="mt-4 text-base leading-8 text-slate-600 dark:text-slate-400">
            JobShaman není ATS náhrada pro všechno. Je to pracovní vrstva pro začátek výběru: role, první odpověď kandidáta, týmové posouzení a další krok.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {outcomes.map(([title, copy], index) => {
            const icons = [FileText, UsersRound, BarChart3];
            const Icon = icons[index];
            return (
              <article key={title} className="rounded-lg border border-slate-200 bg-[#fbfbf8] p-5 dark:border-slate-800 dark:bg-slate-950/50">
                <Icon size={20} className="text-[#8c6727] dark:text-amber-500" />
                <h3 className="mt-4 text-base font-semibold text-slate-950 dark:text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{copy}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="pricing" className="mx-auto w-full max-w-[1280px] py-14">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className={pillEyebrowClass}>Ceny</div>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white md:text-4xl">Začněte malým pilotem. Plaťte až za opakované používání.</h2>
          </div>
          <p className="max-w-md text-sm leading-7 text-slate-600 dark:text-slate-400">Ceny jsou orientační pro V2 pilot. Finální tarif se může upravit podle objemu rolí, podpory a integrací.</p>
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-4">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className={cn(
                'flex min-h-[27rem] flex-col rounded-lg border bg-white p-6 shadow-sm dark:bg-slate-900',
                plan.highlighted ? 'border-[#c99a4a] ring-4 ring-[#c99a4a]/12 dark:border-amber-500/50 dark:ring-amber-500/5' : 'border-slate-200 dark:border-slate-800',
              )}
            >
              {plan.highlighted ? <div className="mb-4 w-fit rounded-full bg-[#f3eadb] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#8c6727] dark:bg-amber-900/40 dark:text-amber-400">Doporučeno</div> : null}
              <h3 className="text-2xl font-semibold text-slate-950 dark:text-white">{plan.name}</h3>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="text-4xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">{plan.price}</span>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{plan.cadence}</span>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-400">{plan.description}</p>
              <div className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
                    <CheckCircle2 size={16} className="mt-1 shrink-0 text-[#8c6727] dark:text-amber-500" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => (plan.id === 'free' ? primaryAction() : onCheckout?.(plan.id))}
                disabled={checkoutBusyTier === plan.id}
                className={cn(plan.highlighted ? primaryButtonClass : secondaryButtonClass, 'mt-auto w-full justify-center disabled:opacity-60')}
              >
                {checkoutBusyTier === plan.id ? <CreditCard size={16} className="animate-pulse" /> : null}
                {plan.cta}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section id="faq" className="mx-auto grid w-full max-w-[1280px] gap-4 pb-10 lg:grid-cols-3">
        {[
          ['Je to náhrada ATS?', 'Ne primárně. JobShaman řeší pracovní zadání, první signál a týmové rozhodování. ATS může zůstat systém evidence.'],
          ['Musí kandidát nahrát CV?', 'Ne. CV může pomoct později, ale první interakce stojí na konkrétní odpovědi k roli.'],
          ['Co se stane po registraci?', 'Založíte firmu, doplníte profil a můžete připravit první roli nebo pilotní zadání.'],
        ].map(([title, copy]) => (
          <article key={title} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">{copy}</p>
          </article>
        ))}
      </section>

      <section className="mx-auto mb-8 flex w-full max-w-[1280px] flex-col gap-5 rounded-lg bg-slate-950 p-6 text-white md:flex-row md:items-center md:justify-between md:p-8 dark:bg-black dark:border dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.03em]">Připravte první roli bez velkého projektu.</h2>
          <p className="mt-2 text-sm leading-7 text-slate-300">Pilot může začít jednou pozicí a malým týmem.</p>
        </div>
        <button type="button" onClick={primaryAction} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#c99a4a] px-5 text-sm font-bold text-slate-950 transition hover:bg-[#e0b665]">
          {companyReady ? 'Otevřít firemní prostor' : 'Začít jako firma'}
          <ArrowRight size={16} />
        </button>
      </section>
    </div>
  );
};

const LegalShell: React.FC<{ title: string; eyebrow: string; children: React.ReactNode }> = ({ title, eyebrow, children }) => (
  <div className={cn(shellPageClass, 'min-h-screen pb-20 dark:bg-slate-950')}>
    <header className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-1 pb-4">
      <BrandMark subtitle="Právní centrum" compact />
      <ThemeToggle />
    </header>
    <section className={cn(panelClass, 'mx-auto max-w-4xl p-8 md:p-12 relative overflow-hidden dark:bg-slate-900 dark:border-slate-800')}>
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(circle_at_top_right,var(--shell-accent-cyan)_0%,transparent_70%)] opacity-[0.03] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-[radial-gradient(circle_at_bottom_left,#b98331_0%,transparent_70%)] opacity-[0.03] pointer-events-none" />

      <div className="relative z-10">
        <div className={pillEyebrowClass}>{eyebrow}</div>
        <h1 className="mt-5 text-4xl md:text-5xl font-bold tracking-tight text-slate-900 leading-tight dark:text-white">
          {title}
        </h1>
        <div className="mt-10 space-y-8 text-[0.95rem] leading-8 text-slate-600 prose prose-slate max-w-none dark:text-slate-400">
          {children}
        </div>
      </div>
    </section>
  </div>
);

export const LegalPublicPage: React.FC<{ page: PublicPage }> = ({ page }) => {
  if (page === 'privacy') {
    return (
      <LegalShell title="Ochrana osobních údajů" eyebrow="Soukromí & GDPR">
        <div className="space-y-6">
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3 dark:text-white">1. Úvodní ustanovení</h2>
            <p className="dark:text-slate-400">V JobShamanu bereme ochranu vašich osobních údajů vážně. Tento dokument popisuje, jaké údaje sbíráme, jak s nimi nakládáme a jaká jsou vaše práva v souladu s Nařízením EU 2016/679 (GDPR).</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3 dark:text-white">2. Rozsah zpracování údajů</h2>
            <p className="dark:text-slate-400">Zpracováváme údaje nezbytné pro fungování "Skill-first" náborového ekosystému:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2 dark:text-slate-400">
              <li><strong>Identifikační údaje:</strong> Jméno, příjmení, fotografie (pokud ji nahrajete).</li>
              <li><strong>Kontaktní údaje:</strong> E-mailová adresa, telefonní číslo, odkazy na profesní profily (LinkedIn, GitHub).</li>
              <li><strong>Profesní data:</strong> Obsah životopisu, dovednosti, pracovní zkušenosti, vzdělání a odpovědi v rámci "handshake" procesu.</li>
              <li><strong>Technická data:</strong> IP adresa, typ prohlížeče, cookies a analytická metadata pro zlepšování doporučovacího algoritmu.</li>
              <li><strong>Lokalizační data:</strong> Pro výpočet dojezdové reality (pokud povolíte nebo zadáte adresu).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3 dark:text-white">3. Účel zpracování</h2>
            <p className="dark:text-slate-400">Vaše údaje používáme k propojení talentů s reálnými týmovými výzvami:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2 dark:text-slate-400">
              <li>Provozování platformy a správa uživatelských účtů.</li>
              <li>Výpočet Indexu Štěstí (JHI) a Finanční reality.</li>
              <li>Zprostředkování komunikace mezi kandidátem a firmou v "Live dialogue lane".</li>
              <li>Optimalizace shody mezi profilem a pracovní pozicí pomocí AI analýzy.</li>
              <li>Zasílání relevantních pracovních nabídek (pokud jste udělili souhlas).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3 dark:text-white">4. Sdílení dat s firmami</h2>
            <p className="dark:text-slate-400">JobShaman chrání vaše soukromí. Firma vidí váš plný profil a životopis až v okamžiku, kdy aktivně odpovíte na jejich výzvu. Do té doby mohou být některá data anonymizována nebo zobrazena pouze jako agregované signály shody.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3 dark:text-white">5. Vaše práva</h2>
            <p className="dark:text-slate-400">Máte právo na přístup k údajům, jejich opravu, výmaz ("právo být zapomenut"), omezení zpracování a přenositelnost údajů. Kdykoliv můžete odvolat souhlas se zpracováním marketingových dat.</p>
            <p className="mt-4 dark:text-slate-400">Pro uplatnění svých práv nás kontaktujte na <a className="font-semibold text-[#8c6727] underline decoration-[#d7c7a8] underline-offset-4 dark:text-amber-500" href="mailto:privacy@jobshaman.com">privacy@jobshaman.com</a>.</p>
          </section>
        </div>
      </LegalShell>
    );
  }

  if (page === 'contact') {
    return (
      <LegalShell title="Kontaktujte nás" eyebrow="Spojení se Shamanem">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-6 dark:border-slate-800 dark:bg-slate-900/50">
            <h3 className="text-lg font-bold text-slate-900 mb-2 dark:text-white">Obecné dotazy & Podpora</h3>
            <p className="text-sm text-slate-600 mb-4 dark:text-slate-400">Pomůžeme vám s nastavením profilu nebo technickými dotazy.</p>
            <a className="text-xl font-bold text-[#8c6727] hover:underline" href="mailto:hello@jobshaman.com">hello@jobshaman.com</a>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-6 dark:border-slate-800 dark:bg-slate-900/50">
            <h3 className="text-lg font-bold text-slate-900 mb-2 dark:text-white">Pro firmy & Partnery</h3>
            <p className="text-sm text-slate-600 mb-4 dark:text-slate-400">Máte zájem o pilotní provoz V2 nebo integraci Recruiter OS?</p>
            <a className="text-xl font-bold text-[#1f6c80] hover:underline" href="mailto:partners@jobshaman.com">partners@jobshaman.com</a>
          </div>
        </div>
        <div className="mt-8">
          <h2 className="text-xl font-bold text-slate-900 mb-3 dark:text-white">Sídlo a fakturace</h2>
          <p className="dark:text-slate-400">JobShaman s.r.o.<br />Rybná 716/24, Staré Město<br />110 00 Praha 1, Česká republika</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-500">IČO: 00000000 (Placeholder)<br />DIČ: CZ00000000</p>
        </div>
      </LegalShell>
    );
  }

  return (
    <LegalShell title="Obchodní podmínky" eyebrow="Právní rámec">
      <div className="space-y-6">
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3 dark:text-white">1. Definice služby</h2>
          <p className="dark:text-slate-400">JobShaman poskytuje technologickou platformu pro propojování kandidátů a firem na základě reálných dovedností a pracovních scénářů. Nejsme personální agentura, ale poskytovatel softwaru (SaaS).</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3 dark:text-white">2. Pravidla pro kandidáty</h2>
          <p className="dark:text-slate-400">Kandidát se zavazuje uvádět pravdivé informace o svých dovednostech a zkušenostech. Zneužití platformy pro spamování firem nebo vkládání neoprávněného obsahu může vést k okamžitému zablokování účtu.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3 dark:text-white">3. Pravidla pro firmy</h2>
          <p className="dark:text-slate-400">Firmy využívající Recruiter OS se zavazují k férovému jednání a dodržování transparentnosti v odměňování. Placené tarify (Starter, Growth, Professional) se řídí aktuálním ceníkem a kapacitními limity.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3 dark:text-white">4. Platby a předplatné</h2>
          <p className="dark:text-slate-400">Platby probíhají prostřednictvím zabezpečené brány Stripe. Předplatné je účtováno měsíčně a lze jej kdykoliv zrušit v nastavení firmy. V případě zrušení zůstávají funkce aktivní do konce předplaceného období.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3 dark:text-white">5. Odpovědnost</h2>
          <p className="dark:text-slate-400">JobShaman neodpovídá za výsledek výběrového řízení ani za obsah vložený uživateli. Snažíme se o maximální dostupnost služby, ale vyhrazujeme si právo na údržbu a nezbytné technické odstávky.</p>
        </section>

        <p className="pt-6 border-t border-slate-100 text-sm text-slate-500 italic">
          Tyto podmínky jsou platné od 1. května 2026. Poslední aktualizace proběhla v souvislosti se spuštěním verze V2.
        </p>
      </div>
    </LegalShell>
  );
};

