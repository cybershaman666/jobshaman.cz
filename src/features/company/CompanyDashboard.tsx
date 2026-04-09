import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  Bell,
  BookOpen,
  BrainCircuit,
  Building2,
  CalendarDays,
  ChevronRight,
  Crown,
  FileDown,
  LifeBuoy,
  LogOut,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Target,
  Users,
  Zap,
} from 'lucide-react';
import type { CompanyProfile } from '../../../types';
import { useCompanyJobsData } from '../../../hooks/useCompanyJobsData';
import { useCompanyActivityLog } from '../../../hooks/useCompanyActivityLog';
import { useCompanyDialoguesData } from '../../../hooks/useCompanyApplicationsData';
import { useCompanyAssessmentsData } from '../../../hooks/useCompanyAssessmentsData';
import { useCompanyCandidatesData } from '../../../hooks/useCompanyCandidatesData';
import { ChallengeTabContent } from './ChallengeTabContent';
import { ChallengeEditor } from './ChallengeEditor';

const TABS = ['overview', 'challenges', 'applications', 'candidates', 'assessments', 'calendar', 'team', 'settings'] as const;
type CompanyTab = typeof TABS[number];

interface CompanyDashboardProps {
  companyProfile?: CompanyProfile | null;
  userEmail?: string;
  onDeleteAccount?: () => Promise<boolean>;
  onProfileUpdate?: (profile: CompanyProfile) => void;
  onOpenCompanyPricing?: () => void;
}

const getInitials = (value: string) =>
  String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'JS';

export const CompanyDashboard: React.FC<CompanyDashboardProps> = ({
  companyProfile,
  userEmail,
  onDeleteAccount,
  onProfileUpdate,
  onOpenCompanyPricing,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<CompanyTab>('overview');
  const [showChallengeEditor, setShowChallengeEditor] = useState(false);
  const [challengeFormat, setChallengeFormat] = useState<'standard' | 'micro_job'>('standard');
  const [searchValue, setSearchValue] = useState('');

  const handleCreateChallenge = () => {
    setChallengeFormat('standard');
    setShowChallengeEditor(true);
  };

  const handleCreateMiniChallenge = () => {
    setChallengeFormat('micro_job');
    setShowChallengeEditor(true);
  };

  const handleEditorClose = () => {
    setShowChallengeEditor(false);
  };

  const companyId = companyProfile?.id || '';
  const jobsData = useCompanyJobsData(companyId);
  const activityLog = useCompanyActivityLog(companyId);
  const dialoguesData = useCompanyDialoguesData({ companyId, activeTab });
  const assessmentsData = useCompanyAssessmentsData(companyId, activeTab);
  const candidatesData = useCompanyCandidatesData(companyId, activeTab, '', t);

  const jobs = jobsData?.jobs || [];
  const activeJobs = jobs.filter((job: any) => job.status === 'active').length;
  const pendingDialogues = (dialoguesData?.dialogues || []).filter(
    (dialogue: any) => dialogue.status === 'pending' || dialogue.status === 'new',
  ).length;
  const totalCandidates = candidatesData?.candidates?.length || 0;
  const totalAssessments = assessmentsData?.assessmentLibrary?.length || 0;
  const teamMembers = companyProfile?.members || [];

  const handleTabChange = (tab: CompanyTab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('company_tab', tab);
    window.history.replaceState({}, '', url.toString());
  };

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabFromUrl = params.get('company_tab') as CompanyTab | null;
    if (tabFromUrl && TABS.includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, []);

  const recruiterLabel = userEmail || teamMembers[0]?.email || 'team@jobshaman.ai';
  const profileName = teamMembers[0]?.name || recruiterLabel.split('@')[0] || 'Recruiter';
  const profileAvatar = teamMembers[0]?.avatar || companyProfile?.logo_url || null;

  const navSections = useMemo(
    () => [
      {
        title: t('company.nav.primary', { defaultValue: 'Přehled' }),
        items: [
          { key: 'overview' as CompanyTab, icon: BarChart3, label: t('company.tabs.overview', { defaultValue: 'Přehled' }) },
          { key: 'candidates' as CompanyTab, icon: Users, label: t('company.tabs.talent_pool', { defaultValue: 'Talent pool' }), badge: totalCandidates > 0 ? totalCandidates : undefined },
          { key: 'assessments' as CompanyTab, icon: BookOpen, label: t('company.tabs.assessment', { defaultValue: 'Hodnocení' }), badge: totalAssessments > 0 ? totalAssessments : undefined },
          { key: 'calendar' as CompanyTab, icon: CalendarDays, label: t('company.tabs.calendar', { defaultValue: 'Kalendář' }) },
        ],
      },
      {
        title: t('company.nav.ops', { defaultValue: 'Nábor' }),
        items: [
          { key: 'challenges' as CompanyTab, icon: Target, label: t('company.tabs.challenges', { defaultValue: 'Otevřené role' }), badge: activeJobs > 0 ? activeJobs : undefined },
          { key: 'applications' as CompanyTab, icon: BrainCircuit, label: t('company.tabs.reactions', { defaultValue: 'Reakce' }), badge: pendingDialogues > 0 ? pendingDialogues : undefined },
          { key: 'team' as CompanyTab, icon: Building2, label: t('company.tabs.team', { defaultValue: 'Tým' }) },
          { key: 'settings' as CompanyTab, icon: Settings2, label: t('company.tabs.settings', { defaultValue: 'Nastavení' }) },
        ],
      },
    ],
    [activeJobs, pendingDialogues, t, totalAssessments, totalCandidates],
  );

  const overviewHeadline = t('company.overview.hero_title', {
    defaultValue: '{{name}}, vítejte zpět',
    name: profileName.split(' ')[0] || profileName,
  });
  const overviewCopy = t('company.overview.hero_copy', {
    defaultValue: 'Dnes na vás čeká {{count}} kandidátů s vysokou shodou.',
    count: Math.max(totalCandidates, 4),
  });

  const currentTabMeta = {
    overview: {
      kicker: t('company.hero.dashboard_kicker', { defaultValue: 'Řídicí centrum náboru' }),
      title: overviewHeadline,
      copy: overviewCopy,
    },
    candidates: {
      kicker: t('company.hero.talent_kicker', { defaultValue: 'Talent pool' }),
      title: t('company.hero.talent_title', { defaultValue: 'Přehled kandidátních signálů' }),
      copy: t('company.hero.talent_copy', { defaultValue: 'Projděte silné profily, porovnejte signály a posuňte nejslibnější kandidáty rychleji do dalšího kroku.' }),
    },
    assessments: {
      kicker: t('company.hero.assessment_kicker', { defaultValue: 'Centrum hodnocení' }),
      title: t('company.hero.assessment_title', { defaultValue: 'Praktický důkaz před rozhodnutím' }),
      copy: t('company.hero.assessment_copy', { defaultValue: 'Vytvářejte, spouštějte a porovnávejte skill-first hodnocení bez ztráty náborového tempa.' }),
    },
    calendar: {
      kicker: t('company.hero.calendar_kicker', { defaultValue: 'Kalendář náboru' }),
      title: t('company.hero.calendar_title', { defaultValue: 'Sdílený přehled interview a týmových bloků' }),
      copy: t('company.hero.calendar_copy', { defaultValue: 'Držte interview, synchronizace i rozhodovací okna v jednom společném kalendáři pro celý hiring tým.' }),
    },
    challenges: {
      kicker: t('company.hero.jobs_kicker', { defaultValue: 'Aktivní nábor' }),
      title: t('company.hero.jobs_title', { defaultValue: 'Správa otevřených rolí' }),
      copy: t('company.hero.jobs_copy', { defaultValue: 'Mějte přehled, které role jsou otevřené, kde je signál nejsilnější a kde pipeline potřebuje další pozornost.' }),
    },
    applications: {
      kicker: t('company.hero.applications_kicker', { defaultValue: 'Tok pipeline' }),
      title: t('company.hero.applications_title', { defaultValue: 'Vyhodnocení reakcí v kontextu' }),
      copy: t('company.hero.applications_copy', { defaultValue: 'Udržte tým v pohybu nad novými reakcemi, otevřenými smyčkami a čekajícími rozhodnutími bez ztráty kontextu.' }),
    },
    team: {
      kicker: t('company.hero.team_kicker', { defaultValue: 'Tým a role' }),
      title: t('company.hero.team_title', { defaultValue: 'Správa recruiterů a hiring rolí' }),
      copy: t('company.hero.team_copy', { defaultValue: 'Pozvěte kolegy, nastavte odpovědnosti a udržte celý tým v jednom sdíleném pracovním toku.' }),
    },
    settings: {
      kicker: t('company.hero.settings_kicker', { defaultValue: 'Nastavení firmy' }),
      title: t('company.hero.settings_title', { defaultValue: 'Identita firmy a provozní nastavení' }),
      copy: t('company.hero.settings_copy', { defaultValue: 'Udržujte firemní prezentaci, právní údaje a základní hiring kontext v jednom přehledném místě.' }),
    },
  }[activeTab];

  return (
    <div
      className="min-h-full bg-[#f4f7fb] text-slate-900 dark:bg-slate-950 dark:text-slate-100"
      style={
        {
          ['--accent' as any]: '#0f9bb8',
          ['--accent-dark' as any]: '#0b7f98',
          ['--accent-rgb' as any]: '15, 155, 184',
          ['--accent-soft' as any]: 'rgba(15, 155, 184, 0.12)',
        } as React.CSSProperties
      }
    >
      <div className="flex min-h-screen">
        <aside className="flex w-[236px] shrink-0 flex-col border-r border-slate-200/80 bg-white/88 px-4 py-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/86">
          <div className="flex items-center gap-3 px-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,var(--accent),var(--accent-dark))] text-white shadow-[0_16px_28px_-18px_rgba(15,155,184,0.4)]">
                <Sparkles size={18} />
              </div>
            <div>
              <div className="text-[15px] font-semibold tracking-[-0.03em] text-[var(--accent)]">Jobshaman</div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                {t('company.shell.premium', { defaultValue: 'Náborový workspace' })}
              </div>
            </div>
          </div>

          <nav className="mt-7 space-y-6">
            {navSections.map((section) => (
              <div key={section.title}>
                <div className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  {section.title}
                </div>
                <div className="mt-2.5 space-y-1.5">
                  {section.items.map(({ key, icon: Icon, label, badge }) => {
                    const active = activeTab === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleTabChange(key)}
                        className={`flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-left text-[14px] font-medium transition ${
                          active
                            ? 'bg-white text-[var(--accent)] shadow-[0_18px_40px_-32px_rgba(15,155,184,0.28)] ring-1 ring-[rgba(var(--accent-rgb),0.16)] dark:bg-slate-900 dark:text-[var(--accent)] dark:ring-[rgba(var(--accent-rgb),0.24)]'
                            : 'text-slate-500 hover:bg-white/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900/80 dark:hover:text-slate-100'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <Icon size={18} />
                          {label}
                        </span>
                        {badge ? (
                          <span className={`inline-flex min-w-[22px] items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${active ? 'bg-[var(--accent-soft)] text-[var(--accent)] dark:bg-[rgba(var(--accent-rgb),0.16)] dark:text-[var(--accent)]' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>
                            {badge}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-auto space-y-5 pt-6">
            <button
              type="button"
              onClick={handleCreateChallenge}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-[0_22px_46px_-30px_rgba(37,93,171,0.6)] transition hover:bg-[var(--accent-dark)]"
            >
              <Plus size={16} />
              {t('company.actions.nova_vyzva', { defaultValue: 'Přidat novou pozici' })}
            </button>

            <div className="space-y-2">
              <button className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-slate-500 transition hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100">
                <LifeBuoy size={17} />
                {t('company.shell.help', { defaultValue: 'Podpora' })}
              </button>
              <button className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-slate-500 transition hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100">
                <LogOut size={17} />
                {t('company.shell.logout', { defaultValue: 'Odhlasit se' })}
              </button>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/88 px-6 py-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/84">
            <div className="flex items-center gap-4">
              <div className="relative max-w-xl flex-1">
                <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder={t('company.shell.search', { defaultValue: 'Hledat kandidáty, role nebo reporty…' })}
                  className="h-14 w-full rounded-full border border-slate-200 bg-slate-50/90 pl-12 pr-5 text-[15px] text-slate-900 outline-none transition focus:border-[rgba(var(--accent-rgb),0.22)] focus:ring-2 focus:ring-[rgba(var(--accent-rgb),0.12)] dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-[rgba(var(--accent-rgb),0.35)] dark:focus:ring-[rgba(var(--accent-rgb),0.16)]"
                />
              </div>

              <button className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white">
                <Bell size={17} />
              </button>
              <button className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white">
                <Settings2 size={17} />
              </button>

              <div className="ml-1 flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{profileName}</div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    {t('company.shell.user_role', { defaultValue: 'Vedoucí náboru' })}
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {profileAvatar ? (
                    <img src={profileAvatar} alt={profileName} className="h-full w-full object-cover" />
                  ) : (
                    getInitials(profileName)
                  )}
                </div>
              </div>
            </div>
          </header>

          <main className="px-6 py-6">
            <div className="mx-auto max-w-[1320px]">
              <section className="mb-7 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    {currentTabMeta.kicker}
                  </div>
                  <h1 className="mt-3 text-[32px] font-semibold leading-[0.98] tracking-[-0.05em] text-slate-950 dark:text-white">
                    {currentTabMeta.title}
                  </h1>
                  <p className="mt-3 max-w-3xl text-[14px] leading-6 text-slate-600 dark:text-slate-400">
                    {currentTabMeta.copy}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {activeTab === 'overview' ? (
                    <>
                      <button className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
                        <FileDown size={17} />
                        {t('company.hero.download_report', { defaultValue: 'Stáhnout přehled' })}
                      </button>
                      <button className="inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-[0_20px_42px_-28px_rgba(37,93,171,0.58)] transition hover:bg-[var(--accent-dark)]">
                        {t('company.hero.review_tasks', { defaultValue: 'Projít priority' })}
                        <ChevronRight size={18} />
                      </button>
                    </>
                  ) : activeTab === 'calendar' ? (
                    <button className="inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-4 text-base font-semibold text-white shadow-[0_20px_42px_-28px_rgba(37,93,171,0.58)] transition hover:bg-[var(--accent-dark)]">
                      <CalendarDays size={17} />
                      {t('company.calendar.share_button', { defaultValue: 'Sdílet s týmem' })}
                    </button>
                  ) : activeTab === 'challenges' ? (
                    <>
                      <button
                        onClick={handleCreateMiniChallenge}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <Zap size={17} />
                        {t('company.actions.mini_vyzva', { defaultValue: 'Mini výzva' })}
                      </button>
                      <button
                        onClick={handleCreateChallenge}
                        className="inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-[0_20px_42px_-28px_rgba(37,93,171,0.58)] transition hover:bg-[var(--accent-dark)]"
                      >
                        <Plus size={17} />
                        {t('company.actions.nova_vyzva', { defaultValue: 'Přidat novou pozici' })}
                      </button>
                    </>
                  ) : onOpenCompanyPricing ? (
                    <button
                      onClick={onOpenCompanyPricing}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[rgba(var(--accent-rgb),0.18)] bg-[var(--accent-soft)] px-4 py-3 text-sm font-medium text-[var(--accent)] transition hover:bg-[rgba(var(--accent-rgb),0.16)]"
                    >
                      <Crown size={17} />
                      {t('company.header.pricing', { defaultValue: 'Tarify' })}
                    </button>
                  ) : null}
                </div>
              </section>

              <ChallengeTabContent
                activeTab={activeTab}
                companyId={companyId}
                companyProfile={companyProfile}
                jobsData={jobsData}
                activityLog={activityLog}
                dialoguesData={dialoguesData}
                assessmentsData={assessmentsData}
                candidatesData={candidatesData}
                onProfileUpdate={onProfileUpdate}
                onDeleteAccount={onDeleteAccount}
              />
            </div>
          </main>
        </div>
      </div>

      {showChallengeEditor && companyProfile ? (
        <div className="fixed inset-0 z-50">
          <ChallengeEditor
            companyProfile={companyProfile}
            initialFormat={challengeFormat}
            onBack={handleEditorClose}
          />
        </div>
      ) : null}
    </div>
  );
};

export default CompanyDashboard;
