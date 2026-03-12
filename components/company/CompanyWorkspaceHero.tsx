import React from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, BrainCircuit, PenTool, Radar, Users, Zap } from 'lucide-react';
import WorkspaceSyncBadge from './WorkspaceSyncBadge';

interface CompanyWorkspaceHeroProps {
  dialoguesLoading?: boolean;
  applicationsLoading: boolean;
  dialoguesLastSyncedAt?: string | null;
  applicationsLastSyncedAt?: string | null;
  liveRolesCount: number;
  reviewQueueCount: number;
  savedAssessmentsCount: number;
  onRefreshDialogues?: () => void;
  onRefreshApplications: () => void;
  onOpenJobs: () => void;
  onOpenDialogues?: () => void;
  onOpenApplications: () => void;
  onOpenAssessments: () => void;
}

const CompanyWorkspaceHero: React.FC<CompanyWorkspaceHeroProps> = ({
  dialoguesLoading,
  applicationsLoading,
  dialoguesLastSyncedAt,
  applicationsLastSyncedAt,
  liveRolesCount,
  reviewQueueCount,
  savedAssessmentsCount,
  onRefreshDialogues,
  onRefreshApplications,
  onOpenJobs,
  onOpenDialogues,
  onOpenApplications,
  onOpenAssessments
}) => {
  const { t, i18n } = useTranslation();
  const language = (() => {
    const normalized = String(i18n.language || 'en').split('-')[0].toLowerCase();
    return ['cs', 'sk', 'de', 'at', 'pl'].includes(normalized) ? (normalized === 'at' ? 'de' : normalized) : 'en';
  })() as 'cs' | 'sk' | 'de' | 'pl' | 'en';
  const copy = ({
    cs: {
      badge: 'Hiring workspace',
      title: 'Vše, co hiring tým potřebuje, na jednom místě',
      subtitle: 'Udržujte živé role, aktivní dialogy s kandidáty i progress assessmentů v jednom přehledném toku. Do hloubky jděte jen tehdy, když potřebujete upravit, porovnat nebo rozhodnout.',
      controlRoom: 'HR control room',
      liveRoles: 'Živé role',
      reviewQueue: 'Fronta k revizi',
      assessments: 'Assessmenty',
      liveConsole: 'Live konzole',
      reviewDialogues: 'Zkontrolovat dialogy',
      createOrEditRoles: 'Vytvořit nebo upravit role',
      openAssessmentHub: 'Otevřít assessment hub'
    },
    sk: {
      badge: 'Hiring workspace',
      title: 'Všetko, čo hiring tím potrebuje, na jednom mieste',
      subtitle: 'Udržiavajte živé roly, aktívne dialógy s kandidátmi aj progress assessmentov v jednom prehľadnom toku. Do hĺbky choďte len vtedy, keď potrebujete upraviť, porovnať alebo rozhodnúť.',
      controlRoom: 'HR control room',
      liveRoles: 'Živé roly',
      reviewQueue: 'Front na revíziu',
      assessments: 'Assessmenty',
      liveConsole: 'Live konzola',
      reviewDialogues: 'Skontrolovať dialógy',
      createOrEditRoles: 'Vytvoriť alebo upraviť roly',
      openAssessmentHub: 'Otvoriť assessment hub'
    },
    de: {
      badge: 'Hiring Workspace',
      title: 'Alles, was Ihr Hiring-Team braucht, an einem Ort',
      subtitle: 'Halten Sie Live-Rollen, aktive Kandidatendialoge und Assessment-Fortschritt in einem klaren Flow zusammen. Gehen Sie nur dann tiefer, wenn Sie etwas bearbeiten, vergleichen oder entscheiden müssen.',
      controlRoom: 'HR Control Room',
      liveRoles: 'Live-Rollen',
      reviewQueue: 'Review-Queue',
      assessments: 'Assessments',
      liveConsole: 'Live-Konsole',
      reviewDialogues: 'Dialoge prüfen',
      createOrEditRoles: 'Rollen erstellen oder bearbeiten',
      openAssessmentHub: 'Assessment-Hub öffnen'
    },
    pl: {
      badge: 'Hiring workspace',
      title: 'Wszystko, czego potrzebuje zespół hiringowy, w jednym miejscu',
      subtitle: 'Trzymaj aktywne role, dialogi z kandydatami i postęp assessmentów w jednym czytelnym przepływie. Schodź głębiej tylko wtedy, gdy trzeba coś edytować, porównać albo zdecydować.',
      controlRoom: 'HR control room',
      liveRoles: 'Aktywne role',
      reviewQueue: 'Kolejka review',
      assessments: 'Assessmenty',
      liveConsole: 'Live console',
      reviewDialogues: 'Sprawdź dialogi',
      createOrEditRoles: 'Utwórz lub edytuj role',
      openAssessmentHub: 'Otwórz hub assessmentów'
    },
    en: {
      badge: 'Hiring workspace',
      title: 'Everything your hiring team needs, in one place',
      subtitle: 'Keep live roles, active candidate dialogues, and assessment progress in one clear flow. Go deeper only when you need to edit, compare, or decide.',
      controlRoom: 'HR control room',
      liveRoles: 'Live roles',
      reviewQueue: 'Review queue',
      assessments: 'Assessments',
      liveConsole: 'Live console',
      reviewDialogues: 'Review dialogues',
      createOrEditRoles: 'Create or edit roles',
      openAssessmentHub: 'Open assessment hub'
    }
  } as const)[language];
  const resolvedDialoguesLoading = dialoguesLoading ?? applicationsLoading;
  const resolvedDialoguesLastSyncedAt = dialoguesLastSyncedAt ?? applicationsLastSyncedAt;
  const handleRefreshDialogues = onRefreshDialogues || onRefreshApplications;
  const handleOpenDialogues = onOpenDialogues || onOpenApplications;

  return (
    <div className="company-surface-elevated overflow-hidden rounded-[var(--radius-lg)] border p-5 shadow-[var(--shadow-card)]">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="space-y-4">
          <div className="app-eyebrow">
            <Zap size={12} />
            {t('company.workspace.badge', { defaultValue: copy.badge })}
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.6fr)]">
            <div>
              <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
                {t('company.workspace.title', { defaultValue: copy.title })}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
                {t('company.workspace.subtitle', { defaultValue: copy.subtitle })}
              </p>
            </div>
            <div className="company-surface rounded-[var(--radius-lg)] border p-4 shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-faint)]">
                <Radar size={12} className="text-[var(--accent)]" />
                {t('company.workspace.control_room', { defaultValue: copy.controlRoom })}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  {
                    key: 'roles',
                    label: t('company.workspace.metrics.live_roles', { defaultValue: copy.liveRoles }),
                    value: liveRolesCount,
                    icon: PenTool,
                    tone: 'text-[var(--accent)]'
                  },
                  {
                    key: 'queue',
                    label: t('company.workspace.metrics.review_queue', { defaultValue: copy.reviewQueue }),
                    value: reviewQueueCount,
                    icon: Activity,
                    tone: 'text-amber-700 dark:text-amber-300'
                  },
                  {
                    key: 'assessments',
                    label: t('company.dashboard.tabs.assessments', { defaultValue: copy.assessments }),
                    value: savedAssessmentsCount,
                    icon: BrainCircuit,
                    tone: 'text-emerald-700 dark:text-emerald-300'
                  }
                ].map((item) => (
                  <div key={item.key} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
                    <div className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${item.tone}`}>
                      <item.icon size={12} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    <div className="mt-2 text-2xl font-black tracking-tight text-[var(--text-strong)]">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="company-surface rounded-[var(--radius-lg)] border p-4 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
                {t('company.workspace.sync.console', { defaultValue: copy.liveConsole })}
              </div>
              <div className="mt-1 text-sm font-semibold text-[var(--text-strong)]">
                {t('company.workspace.actions.review_queue', { defaultValue: copy.reviewDialogues })}
              </div>
            </div>
            <WorkspaceSyncBadge
              loading={resolvedDialoguesLoading}
              syncedAt={resolvedDialoguesLastSyncedAt}
              syncedKey="company.workspace.sync.live_queue"
              syncedDefault="Live queue synced {{time}}"
              onRefresh={handleRefreshDialogues}
            />
          </div>
          <div className="mt-4 space-y-2">
            <button onClick={onOpenJobs} className="app-button-primary w-full justify-between rounded-[var(--radius-md)] px-4 py-3 text-left">
              <span className="flex items-center gap-2">
                <PenTool size={16} />
                {t('company.workspace.actions.new_role', { defaultValue: copy.createOrEditRoles })}
              </span>
              <span className="text-xs uppercase tracking-[0.18em] opacity-70">{liveRolesCount}</span>
            </button>
            <button onClick={handleOpenDialogues} className="app-button-secondary w-full justify-between rounded-[var(--radius-md)] px-4 py-3 text-left">
              <span className="flex items-center gap-2">
                <Users size={16} />
                {t('company.workspace.actions.review_queue', { defaultValue: copy.reviewDialogues })}
              </span>
              <span className="text-xs uppercase tracking-[0.18em] text-[var(--text-faint)]">{reviewQueueCount}</span>
            </button>
            <button onClick={onOpenAssessments} className="app-button-secondary w-full justify-between rounded-[var(--radius-md)] px-4 py-3 text-left">
              <span className="flex items-center gap-2">
                <BrainCircuit size={16} />
                {t('company.workspace.actions.assessments', { defaultValue: copy.openAssessmentHub })}
              </span>
              <span className="text-xs uppercase tracking-[0.18em] text-[var(--text-faint)]">{savedAssessmentsCount}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyWorkspaceHero;
