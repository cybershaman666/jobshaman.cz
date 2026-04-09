import React, { useMemo } from 'react';
import { Coins, Dog, HeartHandshake, HeartPulse, Home, Import, RotateCcw, Sparkles, TrainFront, UtensilsCrossed } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { UserProfile } from '../../types';
import { SurfaceCard, cn } from '../ui/primitives';

export type DiscoveryMode = 'all' | 'micro_jobs';

interface ChallengeSidebarProps {
  userProfile: UserProfile;
  lane: 'challenges' | 'imports';
  setLane: (lane: 'challenges' | 'imports') => void;
  discoveryMode: DiscoveryMode;
  setDiscoveryMode: (mode: DiscoveryMode) => void;
  filterMinSalary: number;
  setFilterMinSalary: (salary: number) => void;
  filterBenefits: string[];
  setFilterBenefits: (benefits: string[]) => void;
  remoteOnly: boolean;
  setRemoteOnly: (enabled: boolean) => void;
  enableCommuteFilter: boolean;
  setEnableCommuteFilter: (enabled: boolean) => void;
  filterMaxDistance: number;
  setFilterMaxDistance: (distance: number) => void;
  filterDomains: string[];
  setFilterDomains: (domains: string[]) => void;
  filterSeniorities: string[];
  setFilterSeniorities: (seniorities: string[]) => void;
  filterContractTypes: string[];
  setFilterContractTypes: (types: string[]) => void;
  onOpenProfile: () => void;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const ChallengeSidebar: React.FC<ChallengeSidebarProps> = ({
  lane,
  setLane,
  discoveryMode,
  setDiscoveryMode,
  filterMinSalary,
  setFilterMinSalary,
  filterBenefits,
  setFilterBenefits,
  remoteOnly,
  setRemoteOnly,
  enableCommuteFilter,
  setEnableCommuteFilter,
  filterMaxDistance,
  setFilterMaxDistance,
  setFilterDomains,
  setFilterSeniorities,
  setFilterContractTypes,
  onOpenProfile,
}) => {
  const { i18n } = useTranslation();
  const locale = String(i18n.resolvedLanguage || i18n.language || 'en').split('-')[0].toLowerCase();

  const copy = useMemo(() => {
    if (locale === 'cs') {
      return {
        title: 'Reality filtry',
        helper: 'Jen to podstatné: co chcete opravdu vidět, odkud a za jakých podmínek.',
        profile: 'Profil',
        resetAll: 'Reset',
        explore: 'Co procházet',
        challenges: 'Všechny nabídky',
        imported: 'Importované role',
        miniChallenges: 'Mini výzvy',
        workMode: 'Jak chcete pracovat',
        remote: 'Jen remote',
        commute: 'Počítat dojezd',
        salary: 'Spodní hranice mzdy',
        distance: 'Maximální dojezd',
        noMinimum: 'Bez minima',
        off: 'Vypnuto',
        life: 'Co má sedět v životě',
        dogFriendly: 'Dog-friendly office',
        childFriendly: 'Child-friendly office',
        healthCare: 'Zdravotní péče',
        meal: 'Jídlo / stravenky',
      };
    }
    return {
      title: 'Reality filters',
      helper: 'Only what matters: what to browse, from where, and under which real conditions.',
      profile: 'Profile',
      resetAll: 'Reset',
      explore: 'What to browse',
      challenges: 'All roles',
      imported: 'Imported roles',
      miniChallenges: 'Mini challenges',
      workMode: 'How you want to work',
      remote: 'Remote only',
      commute: 'Use commute',
      salary: 'Minimum salary',
      distance: 'Max commute',
      noMinimum: 'Any',
      off: 'Off',
      life: 'What should fit life',
      dogFriendly: 'Dog-friendly office',
      childFriendly: 'Child-friendly office',
      healthCare: 'Health care',
      meal: 'Meals / allowance',
    };
  }, [locale]);

  const benefitOptions = [
    { key: 'dog_friendly', label: copy.dogFriendly, icon: <Dog size={14} /> },
    { key: 'child_friendly', label: copy.childFriendly, icon: <HeartHandshake size={14} /> },
    { key: 'health_care', label: copy.healthCare, icon: <HeartPulse size={14} /> },
    { key: 'meal_allowance', label: copy.meal, icon: <UtensilsCrossed size={14} /> },
  ];

  const salaryPresets = [0, 40000, 60000, 80000];
  const distancePresets = [20, 50, 80];
  const hasAnyFilters =
    remoteOnly ||
    enableCommuteFilter ||
    filterMinSalary > 0 ||
    lane === 'imports' ||
    discoveryMode === 'micro_jobs' ||
    filterBenefits.length > 0;

  const resetAllFilters = () => {
    setLane('challenges');
    setDiscoveryMode('all');
    setRemoteOnly(false);
    setEnableCommuteFilter(false);
    setFilterMaxDistance(50);
    setFilterMinSalary(0);
    setFilterBenefits([]);
    setFilterDomains([]);
    setFilterSeniorities([]);
    setFilterContractTypes([]);
  };

  const buttonClass = (active: boolean) =>
    cn(
      'flex w-full items-center gap-2 rounded-[16px] border px-3 py-3 text-left text-sm font-semibold transition',
      active
        ? 'border-[rgba(var(--accent-rgb),0.18)] bg-[rgba(var(--accent-rgb),0.12)] text-[var(--text-strong)]'
        : 'border-[var(--glass-stroke)] bg-[rgba(255,255,255,0.04)] text-[var(--text)] hover:border-[rgba(var(--accent-rgb),0.16)] hover:bg-[rgba(255,255,255,0.08)]'
    );

  return (
    <aside className="lg:sticky lg:top-[calc(var(--app-header-offset)+0.2rem)]">
      <SurfaceCard className="app-sidebar-shell space-y-4 rounded-[24px] p-4 lg:p-5" variant="dock">
        <div className="space-y-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              {copy.title}
            </div>
            <div className="mt-1 text-sm text-[var(--text-muted)]">
              {copy.helper}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={onOpenProfile}
              className="rounded-[13px] border border-[var(--glass-stroke)] bg-[rgba(255,255,255,0.04)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[rgba(var(--accent-rgb),0.18)] hover:bg-[rgba(var(--accent-rgb),0.08)] hover:text-[var(--text-strong)]"
            >
              {copy.profile}
            </button>
            {hasAnyFilters ? (
              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex items-center gap-2 rounded-[13px] border border-[var(--glass-stroke)] bg-[rgba(255,255,255,0.04)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[rgba(var(--accent-rgb),0.18)] hover:text-[var(--text-strong)]"
              >
                <RotateCcw size={12} />
                {copy.resetAll}
              </button>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
            {copy.explore}
          </div>
          <div className="space-y-1">
            <button type="button" onClick={() => { setLane('challenges'); setDiscoveryMode('all'); }} className={buttonClass(lane === 'challenges' && discoveryMode === 'all')}>
              <Sparkles size={16} className={cn('text-[var(--text-faint)]', lane === 'challenges' && discoveryMode === 'all' && 'text-[var(--accent)]')} />
              <span className="min-w-0 flex-1 truncate">{copy.challenges}</span>
            </button>
            <button type="button" onClick={() => { setLane('imports'); setDiscoveryMode('all'); }} className={buttonClass(lane === 'imports')}>
              <Import size={16} className={cn('text-[var(--text-faint)]', lane === 'imports' && 'text-[var(--accent)]')} />
              <span className="min-w-0 flex-1 truncate">{copy.imported}</span>
            </button>
            <button type="button" onClick={() => { setLane('challenges'); setDiscoveryMode('micro_jobs'); }} className={buttonClass(discoveryMode === 'micro_jobs')}>
              <Sparkles size={16} className={cn('text-[var(--text-faint)]', discoveryMode === 'micro_jobs' && 'text-[var(--accent)]')} />
              <span className="min-w-0 flex-1 truncate">{copy.miniChallenges}</span>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
            {copy.workMode}
          </div>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => {
                const nextRemoteOnly = !remoteOnly;
                setRemoteOnly(nextRemoteOnly);
                if (nextRemoteOnly) setEnableCommuteFilter(false);
              }}
              className={buttonClass(remoteOnly)}
            >
              <Home size={16} className={cn('text-[var(--text-faint)]', remoteOnly && 'text-[var(--accent)]')} />
              <span className="min-w-0 flex-1 truncate">{copy.remote}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const nextCommute = !enableCommuteFilter;
                if (nextCommute) setRemoteOnly(false);
                setEnableCommuteFilter(nextCommute);
              }}
              className={buttonClass(enableCommuteFilter)}
            >
              <TrainFront size={16} className={cn('text-[var(--text-faint)]', enableCommuteFilter && 'text-[var(--accent)]')} />
              <span className="min-w-0 flex-1 truncate">{copy.commute}</span>
            </button>
          </div>
        </div>

        <div className="app-sidebar-shell rounded-[20px] border border-[var(--glass-stroke)] bg-[var(--shell-pane-soft)] p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.salary}</div>
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]">
              <Coins size={14} className="text-[var(--accent)]" />
              {filterMinSalary > 0 ? filterMinSalary.toLocaleString(locale === 'cs' ? 'cs-CZ' : 'en-US') : copy.noMinimum}
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={250000}
            step={5000}
            value={clamp(Number(filterMinSalary || 0), 0, 250000)}
            onChange={(e) => setFilterMinSalary(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
          <div className="flex flex-wrap gap-1.5">
            {salaryPresets.map((value) => (
              <button
                key={`salary-preset-${value}`}
                type="button"
                onClick={() => setFilterMinSalary(value)}
                className={cn(
                  'rounded-[11px] border px-2.5 py-1 text-[11px] font-semibold transition',
                  filterMinSalary === value
                    ? 'border-[rgba(var(--accent-rgb),0.2)] bg-[rgba(var(--accent-rgb),0.1)] text-[var(--accent)]'
                    : 'border-[var(--glass-stroke)] bg-[rgba(255,255,255,0.04)] text-[var(--text-muted)] hover:border-[rgba(var(--accent-rgb),0.16)]'
                )}
              >
                {value === 0 ? copy.noMinimum : `${Math.round(value / 1000)}k+`}
              </button>
            ))}
          </div>
        </div>

        <div className="app-sidebar-shell grid gap-3 rounded-[20px] border border-[var(--glass-stroke)] bg-[var(--shell-pane-soft)] p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.distance}</div>
            <div className="text-sm font-semibold text-[var(--text-strong)]">{enableCommuteFilter ? `${filterMaxDistance} km` : copy.off}</div>
          </div>
          <input
            type="range"
            min={5}
            max={120}
            step={5}
            value={clamp(Number(filterMaxDistance || 0), 5, 120)}
            onChange={(e) => setFilterMaxDistance(Number(e.target.value))}
            className={cn('w-full accent-[var(--accent)]', !enableCommuteFilter && 'opacity-60')}
            disabled={!enableCommuteFilter}
          />
          <div className="flex flex-wrap gap-1.5">
            {distancePresets.map((value) => (
              <button
                key={`distance-preset-${value}`}
                type="button"
                onClick={() => {
                  if (remoteOnly) setRemoteOnly(false);
                  if (!enableCommuteFilter) setEnableCommuteFilter(true);
                  setFilterMaxDistance(value);
                }}
                className={cn(
                  'rounded-[11px] border px-2.5 py-1 text-[11px] font-semibold transition',
                  enableCommuteFilter && filterMaxDistance === value
                    ? 'border-[rgba(var(--accent-rgb),0.2)] bg-[rgba(var(--accent-rgb),0.1)] text-[var(--accent)]'
                    : 'border-[var(--glass-stroke)] bg-[rgba(255,255,255,0.04)] text-[var(--text-muted)] hover:border-[rgba(var(--accent-rgb),0.16)]'
                )}
              >
                {value} km
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 border-t border-[var(--border-subtle)] pt-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
            {copy.life}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {benefitOptions.map((benefit) => (
              <button
                key={benefit.key}
                type="button"
                onClick={() => {
                  const next = filterBenefits.includes(benefit.key)
                    ? filterBenefits.filter((key) => key !== benefit.key)
                    : [...filterBenefits, benefit.key];
                  setFilterBenefits(next);
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-[11px] border px-2.5 py-1 text-[11px] font-semibold transition',
                  filterBenefits.includes(benefit.key)
                    ? 'border-[rgba(var(--accent-rgb),0.2)] bg-[rgba(var(--accent-rgb),0.1)] text-[var(--accent)]'
                    : 'border-[var(--glass-stroke)] bg-[rgba(255,255,255,0.04)] text-[var(--text-muted)] hover:border-[rgba(var(--accent-rgb),0.16)]'
                )}
              >
                <span className="opacity-80">{benefit.icon}</span>
                {benefit.label}
              </button>
            ))}
          </div>
        </div>
      </SurfaceCard>
    </aside>
  );
};

export default ChallengeSidebar;
