import React from 'react';
import { ArrowUpRight, Building2, Clock3, Compass, Route, Sparkles, Users, Wallet } from 'lucide-react';

import type { CommuteAnalysis, Job, JobHumanContext, JobPublicPerson, SalaryBenchmarkResolved, UserProfile } from '../../types';
import { MetricTile, SurfaceCard, cn } from '../ui/primitives';

export const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
  <div className="flex items-center gap-3">
    <div className="h-[10px] w-[10px] rounded-[3px] bg-[rgba(var(--accent-rgb),0.7)] shadow-[0_0_0_4px_rgba(var(--accent-rgb),0.08)]" />
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{title}</div>
    <div className="h-px flex-1 bg-[var(--border-subtle)]" />
  </div>
);

export const NarrativeCard: React.FC<{ title: string; body: string; tone?: 'default' | 'accent' }> = ({
  title,
  body,
  tone = 'default'
}) => (
  <div
    className={cn(
      'app-data-tile rounded-[var(--radius-panel)] px-5 py-4',
      tone === 'accent'
        ? 'border-[rgba(var(--accent-rgb),0.16)] bg-[rgba(var(--accent-rgb),0.05)]'
        : 'border-[var(--border-subtle)] bg-[var(--surface-soft)]'
    )}
  >
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{title}</div>
    <p className="mt-3 text-sm leading-7 text-[var(--text)]">{body || '—'}</p>
  </div>
);

const getInitials = (value: string): string => {
  const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return 'JS';
  return parts.map((part) => part[0]?.toUpperCase() || '').join('');
};

export const HumanContextPersonCard: React.FC<{
  person: JobPublicPerson;
  fallbackRole: string;
}> = ({
  person,
  fallbackRole
}) => (
  <div className="app-data-tile rounded-[var(--radius-panel)] p-4">
    <div className="flex items-start gap-3">
      {person.avatar_url ? (
        <img
          src={person.avatar_url}
          alt={person.display_name}
          className="h-12 w-12 rounded-[12px] object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-[var(--surface-card)] text-sm font-semibold text-[var(--accent)]">
          {getInitials(person.display_name)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-[var(--text-strong)]">{person.display_name}</div>
        <div className="mt-1 text-xs leading-5 text-[var(--text-faint)]">{person.display_role || fallbackRole}</div>
      </div>
    </div>
    {person.short_context ? (
      <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{person.short_context}</p>
    ) : null}
  </div>
);

interface ChallengeHumanContextSectionProps {
  humanContext: JobHumanContext | null;
  trustLabels?: string[];
  copy: {
    publisherLabel: string;
    respondersLabel: string;
    teamTrustLabel: string;
    humanContextFallbackRole: string;
  };
}

export const ChallengeHumanContextSection: React.FC<ChallengeHumanContextSectionProps> = ({
  humanContext,
  trustLabels = [],
  copy,
}) => {
  const hasContent = Boolean(
    humanContext?.publisher ||
    (humanContext?.responders?.length || 0) > 0 ||
    trustLabels.length > 0
  );

  if (!hasContent) return null;

  return (
    <div className="space-y-4 rounded-[var(--radius-surface)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
      {humanContext?.publisher ? (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.publisherLabel}</div>
          <HumanContextPersonCard person={humanContext.publisher} fallbackRole={copy.humanContextFallbackRole} />
        </div>
      ) : null}

      {humanContext?.responders?.length ? (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.respondersLabel}</div>
          <div className="grid gap-3 md:grid-cols-2">
            {humanContext.responders.map((person, index) => (
              <HumanContextPersonCard
                key={`${person.user_id || person.id || 'responder'}-${index}`}
                person={person}
                fallbackRole={copy.humanContextFallbackRole}
              />
            ))}
          </div>
        </div>
      ) : null}

      {trustLabels.length > 0 ? (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.teamTrustLabel}</div>
          <div className="flex flex-wrap gap-2">
            {trustLabels.map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]"
              >
                <Users size={13} className="text-[var(--accent)]" />
                {label}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

interface ChallengeFinancialSectionProps {
  job: Job;
  userProfile: UserProfile;
  commuteAnalysis: CommuteAnalysis | null;
  salaryBenchmark: SalaryBenchmarkResolved | null;
  isMicroJobRole: boolean;
  remoteRole: boolean;
  copy: Record<string, string>;
  microJobCopy: Record<string, string>;
  locale: string;
  onRequireAuth: () => void;
  onOpenProfile: () => void;
}

export const ChallengeFinancialSection: React.FC<ChallengeFinancialSectionProps> = ({
  userProfile,
  commuteAnalysis,
  salaryBenchmark,
  isMicroJobRole,
  remoteRole,
  copy,
  microJobCopy,
  locale,
  onRequireAuth,
  onOpenProfile,
}) => {
  if (isMicroJobRole) {
    return (
      <SurfaceCard className="space-y-4">
        <div className="app-eyebrow w-fit">
          <Wallet size={12} />
          {microJobCopy.financialNoteTitle}
        </div>
        <p className="text-sm leading-7 text-[var(--text-muted)]">{microJobCopy.financialNoteBody}</p>
      </SurfaceCard>
    );
  }

  if (!userProfile.isLoggedIn) {
    return (
      <SurfaceCard className="space-y-4">
        <div className="app-eyebrow w-fit">
          <Wallet size={12} />
          {copy.financialTitle}
        </div>
        <p className="text-sm leading-7 text-[var(--text-muted)]">{copy.loginPrompt}</p>
        <button type="button" onClick={onRequireAuth} className="app-button-primary">
          {copy.signInCreate}
        </button>
      </SurfaceCard>
    );
  }

  if (!userProfile.address && !userProfile.coordinates && !remoteRole) {
    return (
      <SurfaceCard className="space-y-4">
        <div className="app-eyebrow w-fit">
          <Route size={12} />
          {copy.financialTitle}
        </div>
        <p className="text-sm leading-7 text-[var(--text-muted)]">{copy.addressPrompt}</p>
        <button type="button" onClick={onOpenProfile} className="app-button-secondary">
          {copy.openProfile}
        </button>
      </SurfaceCard>
    );
  }

  if (!commuteAnalysis) return null;

  return (
    <SurfaceCard className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="app-eyebrow w-fit">
            <Wallet size={12} />
            {copy.financialTitle}
          </div>
          <p className="max-w-3xl text-sm leading-7 text-[var(--text-muted)]">{copy.financialBody}</p>
          {remoteRole ? (
            <p className="text-sm leading-6 text-[var(--accent)]">{copy.remoteReality}</p>
          ) : null}
        </div>
        <MetricTile
          label={copy.jhiImpact}
          value={`${commuteAnalysis.jhiImpact > 0 ? '+' : ''}${commuteAnalysis.jhiImpact}`}
          tone={commuteAnalysis.jhiImpact >= 0 ? 'success' : 'warning'}
          className="min-w-[150px]"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricTile label={copy.gross} value={`${commuteAnalysis.financialReality.grossMonthlySalary.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}`} />
        <MetricTile label={copy.net} value={`${commuteAnalysis.financialReality.netBaseSalary.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}`} />
        <MetricTile label={copy.benefits} value={`${commuteAnalysis.financialReality.benefitsValue.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}`} />
        <MetricTile label={copy.commute} value={`${commuteAnalysis.financialReality.commuteCost.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}`} />
        <MetricTile label={copy.oneWay} value={remoteRole ? '0 km' : `${commuteAnalysis.distanceKm} km`} />
        <MetricTile label={copy.realValue} value={`${commuteAnalysis.financialReality.finalRealMonthlyValue.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}`} tone="accent" />
      </div>

      <div className="app-data-tile rounded-[var(--radius-panel)] px-4 py-3 text-sm leading-6 text-[var(--text-muted)]">
        {copy.financialFormula
          .replace('{{net}}', `${commuteAnalysis.financialReality.netBaseSalary.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}`)
          .replace('{{benefits}}', `${commuteAnalysis.financialReality.benefitsValue.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}`)
          .replace('{{commute}}', `${commuteAnalysis.financialReality.commuteCost.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}`)
          .replace('{{total}}', `${commuteAnalysis.financialReality.finalRealMonthlyValue.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}`)}
      </div>

      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Clock3 size={15} className="text-[var(--text-faint)]" />
        {copy.dailyTime}: {commuteAnalysis.timeMinutes * 2} min
      </div>

      {salaryBenchmark && !salaryBenchmark.insufficient_data ? (
        <div className="app-data-tile grid gap-3 rounded-[var(--radius-panel)] p-4 sm:grid-cols-2">
          <MetricTile
            label={copy.marketMedian}
            value={`${(salaryBenchmark.p50 || 0).toLocaleString(locale)} ${salaryBenchmark.currency || commuteAnalysis.financialReality.currency}`}
          />
          <MetricTile
            label={copy.marketDelta}
            value={`${(salaryBenchmark.delta_vs_p50 || 0) > 0 ? '+' : ''}${(salaryBenchmark.delta_vs_p50 || 0).toLocaleString(locale)} ${salaryBenchmark.currency || commuteAnalysis.financialReality.currency}`}
            tone={(salaryBenchmark.delta_vs_p50 || 0) >= 0 ? 'success' : 'warning'}
          />
        </div>
      ) : null}
    </SurfaceCard>
  );
};

interface ChallengeRealityActionsProps {
  copy: {
    reality: string;
    openCompany: string;
    openContext: string;
    openListing: string;
  };
  job: Job;
  onOpenCompanyPage: (companyId: string) => void;
  onOpenSupportingContext: () => void;
  onOpenImportedListing: () => void;
}

export const ChallengeRealityActions: React.FC<ChallengeRealityActionsProps> = ({
  copy,
  job,
  onOpenCompanyPage,
  onOpenSupportingContext,
  onOpenImportedListing,
}) => (
  <SurfaceCard className="space-y-4">
    <SectionTitle title={copy.reality} />
    <div className="grid gap-3">
      <button
        type="button"
        onClick={() => {
          if (job.company_id) onOpenCompanyPage(job.company_id);
        }}
        disabled={!job.company_id}
        className={cn(
          'flex w-full items-center justify-between rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3 text-sm font-medium text-[var(--text)] transition-colors hover:border-[rgba(var(--accent-rgb),0.22)] hover:bg-[var(--surface)]',
          !job.company_id && 'cursor-not-allowed opacity-50'
        )}
      >
        <span className="inline-flex items-center gap-2">
          <Building2 size={16} />
          {copy.openCompany}
        </span>
        <ArrowUpRight size={15} />
      </button>
      <button
        type="button"
        onClick={onOpenSupportingContext}
        className="flex w-full items-center justify-between rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3 text-sm font-medium text-[var(--text)] transition-colors hover:border-[rgba(var(--accent-rgb),0.22)] hover:bg-[var(--surface)]"
      >
        <span className="inline-flex items-center gap-2">
          <Compass size={16} />
          {copy.openContext}
        </span>
        <ArrowUpRight size={15} />
      </button>
      {job.url ? (
        <button
          type="button"
          onClick={onOpenImportedListing}
          className="flex w-full items-center justify-between rounded-[var(--radius-control)] border border-[rgba(var(--accent-rgb),0.18)] bg-[rgba(var(--accent-rgb),0.08)] px-4 py-3 text-sm font-medium text-[var(--text-strong)] transition-colors hover:bg-[rgba(var(--accent-rgb),0.12)]"
        >
          <span className="inline-flex items-center gap-2">
            <Sparkles size={16} />
            {copy.openListing}
          </span>
          <ArrowUpRight size={15} />
        </button>
      ) : null}
    </div>
  </SurfaceCard>
);
