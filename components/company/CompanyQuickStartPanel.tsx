import React from 'react';
import { useTranslation } from 'react-i18next';
import { BrainCircuit, PenTool, Users, Zap } from 'lucide-react';

interface CompanyQuickStartPanelProps {
  onOpenJobs: () => void;
  onOpenAssessments: () => void;
  onOpenSettings: () => void;
}

const CompanyQuickStartPanel: React.FC<CompanyQuickStartPanelProps> = ({
  onOpenJobs,
  onOpenAssessments,
  onOpenSettings
}) => {
  const { t, i18n } = useTranslation();
  const language = (() => {
    const normalized = String(i18n.language || 'en').split('-')[0].toLowerCase();
    return ['cs', 'sk', 'de', 'at', 'pl'].includes(normalized) ? (normalized === 'at' ? 'de' : normalized) : 'en';
  })() as 'cs' | 'sk' | 'de' | 'pl' | 'en';
  const copy = ({
    cs: {
      badge: 'Rychlý start',
      title: 'Vyladěný hiring flow nastavíte za pár minut',
      desc: 'Začněte jednou rolí, jedním znovupoužitelným assessmentem a kompletním firemním profilem. Pak se z této stránky stane váš každodenní hiring domov.',
      firstRole: 'Vytvořte první roli',
      firstRoleDesc: 'Pomocí editoru role vytvoříte jasný a kandidátsky přívětivý job post.',
      firstAssessment: 'Uložte první assessment',
      firstAssessmentDesc: 'Připravte znovupoužitelný screening flow, aby recruiteri mohli později postupovat rychleji.',
      companySetup: 'Dokončete nastavení firmy',
      companySetupDesc: 'Nastavte profil, značku a hiring defaulty ještě před příchodem prvních kandidátů.'
    },
    sk: {
      badge: 'Rýchly štart',
      title: 'Vyladený hiring flow nastavíte za pár minút',
      desc: 'Začnite jednou rolou, jedným znovupoužiteľným assessmentom a kompletným firemným profilom. Potom sa z tejto stránky stane váš každodenný hiring domov.',
      firstRole: 'Vytvorte prvú rolu',
      firstRoleDesc: 'Pomocou editora roly vytvoríte jasný a kandidátsky priateľský job post.',
      firstAssessment: 'Uložte prvý assessment',
      firstAssessmentDesc: 'Pripravte znovupoužiteľný screening flow, aby recruiteri mohli neskôr postupovať rýchlejšie.',
      companySetup: 'Dokončite nastavenie firmy',
      companySetupDesc: 'Nastavte profil, značku a hiring defaulty ešte pred príchodom prvých kandidátov.'
    },
    de: {
      badge: 'Schnellstart',
      title: 'Einen sauberen Hiring-Flow in wenigen Minuten aufsetzen',
      desc: 'Starten Sie mit einer Rolle, einem wiederverwendbaren Assessment und einem vollständigen Firmenprofil. Danach wird diese Seite zu Ihrem täglichen Hiring-Zentrum.',
      firstRole: 'Erste Rolle erstellen',
      firstRoleDesc: 'Nutzen Sie den Rollen-Editor für ein klares, kandidatenfreundliches Job-Posting.',
      firstAssessment: 'Ein Assessment speichern',
      firstAssessmentDesc: 'Bereiten Sie einen wiederverwendbaren Screening-Flow vor, damit Recruiter später schneller arbeiten können.',
      companySetup: 'Firmensetup abschließen',
      companySetupDesc: 'Setzen Sie Profil, Marke und Hiring-Defaults, bevor die ersten Bewerber:innen eintreffen.'
    },
    pl: {
      badge: 'Szybki start',
      title: 'Dopracowany hiring flow ustawisz w kilka minut',
      desc: 'Zacznij od jednej roli, jednego wielokrotnego assessmentu i kompletnego profilu firmy. Potem ta strona stanie się Twoim codziennym centrum hiringu.',
      firstRole: 'Utwórz pierwszą rolę',
      firstRoleDesc: 'Użyj edytora roli, aby przygotować jasny i przyjazny kandydatowi job post.',
      firstAssessment: 'Zapisz pierwszy assessment',
      firstAssessmentDesc: 'Przygotuj wielokrotny screening flow, aby recruiterzy mogli później działać szybciej.',
      companySetup: 'Dokończ setup firmy',
      companySetupDesc: 'Ustaw profil, markę i hiring defaulty, zanim pojawią się pierwsi kandydaci.'
    },
    en: {
      badge: 'Quick start',
      title: 'Set up a polished hiring flow in minutes',
      desc: 'Start with one role, one reusable assessment, and a complete company profile. After that, this page becomes your day-to-day hiring home.',
      firstRole: 'Create your first role',
      firstRoleDesc: 'Use the role editor to shape a clear, candidate-friendly job post.',
      firstAssessment: 'Save one assessment',
      firstAssessmentDesc: 'Prepare a reusable screening flow so recruiters can move faster later.',
      companySetup: 'Finish company setup',
      companySetupDesc: 'Set profile, brand, and hiring defaults before the first applicants arrive.'
    }
  } as const)[language];

  return (
    <div className="company-surface-elevated overflow-hidden rounded-[var(--radius-lg)] border p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="app-eyebrow">
            <Zap size={12} />
            {t('company.workspace.quickstart_badge', { defaultValue: copy.badge })}
          </div>
          <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
            {t('company.workspace.quickstart_title', { defaultValue: copy.title })}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
            {t('company.workspace.quickstart_desc', { defaultValue: copy.desc })}
          </p>
        </div>
        <button onClick={onOpenJobs} className="app-button-primary rounded-[var(--radius-md)] px-4 py-3">
          <PenTool size={16} />
          {t('company.dashboard.create_first_ad')}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        <button onClick={onOpenJobs} className="company-surface-subtle rounded-[var(--radius-md)] border p-4 text-left shadow-[var(--shadow-soft)] transition-colors hover:border-[rgba(var(--accent-rgb),0.18)]">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]">
            <PenTool size={14} />
            {t('company.workspace.quickstart_steps.first_role', { defaultValue: copy.firstRole })}
          </div>
          <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
            {t('company.workspace.quickstart_steps.first_role_desc', { defaultValue: copy.firstRoleDesc })}
          </div>
        </button>
        <button onClick={onOpenAssessments} className="company-surface-subtle rounded-[var(--radius-md)] border p-4 text-left shadow-[var(--shadow-soft)] transition-colors hover:border-[rgba(var(--accent-rgb),0.18)]">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]">
            <BrainCircuit size={14} />
            {t('company.workspace.quickstart_steps.first_assessment', { defaultValue: copy.firstAssessment })}
          </div>
          <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
            {t('company.workspace.quickstart_steps.first_assessment_desc', { defaultValue: copy.firstAssessmentDesc })}
          </div>
        </button>
        <button onClick={onOpenSettings} className="company-surface-subtle rounded-[var(--radius-md)] border p-4 text-left shadow-[var(--shadow-soft)] transition-colors hover:border-[rgba(var(--accent-rgb),0.18)]">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]">
            <Users size={14} />
            {t('company.workspace.quickstart_steps.company_setup', { defaultValue: copy.companySetup })}
          </div>
          <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
            {t('company.workspace.quickstart_steps.company_setup_desc', { defaultValue: copy.companySetupDesc })}
          </div>
        </button>
      </div>
    </div>
  );
};

export default CompanyQuickStartPanel;
