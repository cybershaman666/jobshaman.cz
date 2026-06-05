import React from 'react';
import { 
  MapPin, 
  X, 
  Search, 
  Loader2 
} from 'lucide-react';
import { cn } from '../cn';
import type { MarketplaceFilters } from '../models';
import {
  fieldClass,
  panelClass,
  secondaryButtonClass,
  topBarSearchClass,
} from '../ui/shellStyles';

export const MarketplaceActiveFilters: React.FC<{
  filters: MarketplaceFilters;
  activeFilterCount: number;
  t: (key: string, opts: { defaultValue: string }) => string;
}> = ({ filters, activeFilterCount, t }) => {
  if (activeFilterCount === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {filters.city.trim() ? <span className="rounded-full border border-[color:var(--shell-button-secondary-border)] bg-[color:var(--shell-button-secondary-bg)] px-3 py-1.5 text-xs font-medium text-[color:var(--shell-text-secondary)]">{t('rebuild.marketplace.current_city', { defaultValue: 'City' })}: {filters.city.trim()}</span> : null}
      <span className="rounded-full border border-[color:var(--shell-button-secondary-border)] bg-[color:var(--shell-button-secondary-bg)] px-3 py-1.5 text-xs font-medium text-[color:var(--shell-text-secondary)]">{t('rebuild.marketplace.current_radius', { defaultValue: 'Radius' })}: {filters.radiusKm} km</span>
      <span className="rounded-full border border-[color:var(--shell-button-secondary-border)] bg-[color:var(--shell-button-secondary-bg)] px-3 py-1.5 text-xs font-medium text-[color:var(--shell-text-secondary)]">{t('rebuild.marketplace.current_market', { defaultValue: 'Market scope' })}: {filters.crossBorder ? t('rebuild.marketplace.market_scope_cross_border', { defaultValue: 'Cross-border' }) : t('rebuild.marketplace.market_scope_domestic', { defaultValue: 'Domestic' })}</span>
      {filters.curatedOnly ? <span className="rounded-full border border-[color:color-mix(in_srgb,var(--shell-accent-cyan)_22%,transparent)] bg-[color:color-mix(in_srgb,var(--shell-accent-cyan)_12%,transparent)] px-3 py-1.5 text-xs font-medium text-[color:var(--shell-accent-cyan)]">{t('rebuild.marketplace.curated_only', { defaultValue: 'Curated only' })}</span> : null}
      {filters.benefits.slice(0, 3).map((benefit) => <span key={benefit} className="rounded-full border border-[color:color-mix(in_srgb,var(--shell-accent-cyan)_22%,transparent)] bg-[color:color-mix(in_srgb,var(--shell-accent-cyan)_12%,transparent)] px-3 py-1.5 text-xs font-medium text-[color:var(--shell-accent-cyan)]">{benefit}</span>)}
    </div>
  );
};

export const MarketplaceFilterControls: React.FC<{
  filters: MarketplaceFilters;
  onFiltersChange: (updater: React.SetStateAction<MarketplaceFilters>) => void;
  navigate: (path: string) => void;
  benefitOptions: string[];
  compact?: boolean;
  t: (key: string, opts: { defaultValue: string }) => string;
}> = ({ filters, onFiltersChange, navigate, benefitOptions, compact = false, t }) => (
  <>
    <div className={cn('space-y-4', !compact && 'xl:grid xl:grid-cols-[1.2fr_1fr] xl:gap-4 xl:space-y-0')}>
      <label className="block text-sm font-medium text-[color:var(--shell-text-secondary)]">
        {t('rebuild.marketplace.city_filter', { defaultValue: 'City' })}
        <div className="relative">
          <MapPin size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--shell-text-tertiary)]" />
          <input value={filters.city} onChange={(event) => onFiltersChange((current) => ({ ...current, city: event.target.value }))} placeholder={t('rebuild.marketplace.city_placeholder', { defaultValue: 'Prague, Brno, Berlin...' })} className={cn(fieldClass, 'pl-10')} />
        </div>
      </label>
      <label className="block text-sm font-medium text-[color:var(--shell-text-secondary)]">
        {t('rebuild.marketplace.role_family', { defaultValue: 'Domain' })}
        <select value={filters.roleFamily} onChange={(event) => onFiltersChange((current) => ({ ...current, roleFamily: event.target.value as MarketplaceFilters['roleFamily'] }))} className={cn(fieldClass, 'truncate pr-10')}>
          <option value="all">{t('rebuild.marketplace.role_family_all', { defaultValue: 'All domains' })}</option>
          <option value="engineering">{t('rebuild.marketplace.role_family_engineering', { defaultValue: 'Engineering' })}</option>
          <option value="design">{t('rebuild.marketplace.role_family_design', { defaultValue: 'Design' })}</option>
          <option value="product">{t('rebuild.marketplace.role_family_product', { defaultValue: 'Product' })}</option>
          <option value="operations">{t('rebuild.marketplace.role_family_operations', { defaultValue: 'Operations' })}</option>
          <option value="sales">{t('rebuild.marketplace.role_family_sales', { defaultValue: 'Sales' })}</option>
          <option value="care">{t('rebuild.marketplace.role_family_care', { defaultValue: 'People & Care' })}</option>
          <option value="frontline">{t('rebuild.marketplace.role_family_frontline', { defaultValue: 'Frontline' })}</option>
        </select>
      </label>
      <label className="block text-sm font-medium text-[color:var(--shell-text-secondary)]">
        {t('rebuild.marketplace.work_arrangement', { defaultValue: 'Work model' })}
        <select
          value={filters.remoteOnly ? 'remote' : filters.workArrangement}
          onChange={(event) => {
            const next = event.target.value as MarketplaceFilters['workArrangement'];
            onFiltersChange((current) => ({
              ...current,
              remoteOnly: next === 'remote',
              workArrangement: next === 'remote' ? 'all' : next,
            }));
          }}
          className={cn(fieldClass, 'truncate pr-10')}
        >
          <option value="all">{t('rebuild.marketplace.work_arrangement_all', { defaultValue: 'All models' })}</option>
          <option value="remote">{t('rebuild.marketplace.work_arrangement_remote', { defaultValue: 'Remote only' })}</option>
          <option value="hybrid">{t('rebuild.marketplace.work_arrangement_hybrid', { defaultValue: 'Hybrid' })}</option>
          <option value="onsite">{t('rebuild.marketplace.work_arrangement_onsite', { defaultValue: 'On-site' })}</option>
        </select>
      </label>
      <label className="block text-sm font-medium text-[color:var(--shell-text-secondary)]">
        {t('rebuild.marketplace.radius', { defaultValue: 'Commute radius' })}
        <select value={String(filters.radiusKm)} onChange={(event) => onFiltersChange((current) => ({ ...current, radiusKm: Number(event.target.value) }))} className={cn(fieldClass, 'truncate pr-10')}>
          {[15, 25, 35, 50, 80, 120, 180].map((radius) => <option key={radius} value={radius}>{radius} km</option>)}
        </select>
      </label>
    </div>
    <div className="mt-5 grid gap-2">
      <button type="button" onClick={() => onFiltersChange((current) => ({ ...current, curatedOnly: !current.curatedOnly }))} className={cn(secondaryButtonClass, 'w-full justify-between px-4 py-3 text-left', filters.curatedOnly && 'border-[color:color-mix(in_srgb,var(--shell-accent-cyan)_44%,transparent)] bg-[image:linear-gradient(135deg,color-mix(in_srgb,var(--shell-accent-cyan)_28%,transparent),color-mix(in_srgb,var(--shell-accent)_16%,transparent))] text-[color:var(--shell-text-primary)] hover:bg-[image:linear-gradient(135deg,color-mix(in_srgb,var(--shell-accent-cyan)_36%,transparent),color-mix(in_srgb,var(--shell-accent)_22%,transparent))]')}>
        {t('rebuild.marketplace.curated_only', { defaultValue: 'Curated only' })}
      </button>
      <button type="button" onClick={() => onFiltersChange((current) => ({ ...current, crossBorder: !current.crossBorder }))} className={cn(secondaryButtonClass, 'w-full justify-between px-4 py-3 text-left', filters.crossBorder && 'border-[color:color-mix(in_srgb,var(--shell-accent)_42%,transparent)] bg-[image:linear-gradient(135deg,color-mix(in_srgb,var(--shell-accent)_26%,transparent),color-mix(in_srgb,var(--shell-accent-cyan)_14%,transparent))] text-[color:var(--shell-text-primary)] hover:bg-[image:linear-gradient(135deg,color-mix(in_srgb,var(--shell-accent)_34%,transparent),color-mix(in_srgb,var(--shell-accent-cyan)_20%,transparent))]')}>
        {filters.crossBorder ? t('rebuild.marketplace.cross_border_on', { defaultValue: 'Cross-border on' }) : t('rebuild.marketplace.cross_border_off', { defaultValue: 'Domestic only' })}
      </button>
      <button type="button" onClick={() => navigate('/candidate/jcfpm')} className={cn(secondaryButtonClass, 'w-full justify-between px-4 py-3 text-left')}>
        {t('rebuild.marketplace.launch_jcfpm', { defaultValue: 'Spustit JobFit Kompas' })}
      </button>
    </div>
    {benefitOptions.length > 0 ? (
      <div className="mt-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--shell-text-tertiary)]">{t('rebuild.marketplace.benefits', { defaultValue: 'Benefits' })}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {benefitOptions.map((benefit) => {
            const active = filters.benefits.includes(benefit);
            return (
              <button
                key={benefit}
                type="button"
                onClick={() => onFiltersChange((current) => ({
                  ...current,
                  benefits: current.benefits.includes(benefit)
                    ? current.benefits.filter((item) => item !== benefit)
                    : [...current.benefits, benefit],
                }))}
                className={cn(
                  'max-w-full truncate rounded-full border px-3 py-2 text-xs font-semibold transition',
                  active
                    ? 'border-[color:color-mix(in_srgb,var(--shell-accent)_40%,transparent)] bg-[image:linear-gradient(135deg,color-mix(in_srgb,var(--shell-accent)_34%,transparent),color-mix(in_srgb,var(--shell-accent-cyan)_18%,transparent))] text-[color:var(--shell-text-primary)] shadow-[0_18px_32px_-24px_color-mix(in_srgb,var(--shell-accent)_45%,transparent)]'
                    : 'border-[color:var(--shell-button-secondary-border)] bg-[color:var(--shell-button-secondary-bg)] text-[color:var(--shell-text-secondary)] hover:border-[color:var(--shell-panel-border-strong)] hover:text-[color:var(--shell-text-primary)]',
                )}
                title={benefit}
              >
                {benefit}
              </button>
            );
          })}
        </div>
      </div>
    ) : null}
  </>
);

export const MarketplaceFilterPanel: React.FC<{
  filters: MarketplaceFilters;
  onFiltersChange: (updater: React.SetStateAction<MarketplaceFilters>) => void;
  onResetFilters: () => void;
  navigate: (path: string) => void;
  benefitOptions: string[];
  t: (key: string, opts: { defaultValue: string }) => string;
  className?: string;
  compact?: boolean;
}> = ({ filters, onFiltersChange, onResetFilters, navigate, benefitOptions, t, className, compact = false }) => (
  <div className={cn(panelClass, 'min-w-0 rounded-[28px] p-5', 'shrink-0', className)}>
    <div>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--shell-text-tertiary)]">{t('rebuild.marketplace.filters_title', { defaultValue: 'Search controls' })}</div>
        <div className="mt-2 text-sm leading-6 text-[color:var(--shell-text-secondary)]">{t('rebuild.marketplace.filters_subtitle', { defaultValue: 'Refine roles by place, domain and work setup.' })}</div>
      </div>
      <button type="button" onClick={onResetFilters} className={cn(secondaryButtonClass, 'mt-4 w-full justify-center')}>
        <X size={14} />
        {t('rebuild.marketplace.reset_filters', { defaultValue: 'Reset filters' })}
      </button>
    </div>
    <div className="mt-5">
      <MarketplaceFilterControls
        filters={filters}
        onFiltersChange={onFiltersChange}
        navigate={navigate}
        benefitOptions={benefitOptions}
        compact={compact}
        t={t}
      />
    </div>
  </div>
);

export const MarketplaceSearchPanel: React.FC<{
  searchValue: string;
  loading: boolean;
  onSearchChange: (value: string) => void;
  t: (key: string, opts: { defaultValue: string }) => string;
  className?: string;
}> = ({ searchValue, loading, onSearchChange, t, className }) => (
  <div className={cn(panelClass, 'shrink-0 p-4', className)}>
    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--shell-text-tertiary)]">
      {t('rebuild.marketplace.search_label', { defaultValue: 'Search marketplace' })}
    </div>
    <label className={cn(topBarSearchClass, 'mt-3 border-[color:color-mix(in_srgb,var(--shell-accent-cyan)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--shell-button-secondary-bg)_82%,transparent)] px-4 py-3 shadow-[0_18px_44px_-32px_color-mix(in_srgb,var(--shell-accent)_26%,transparent)]')}>
      <Search size={16} className="text-[color:var(--shell-accent-cyan)]" />
      <input
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={t('rebuild.search_placeholder', { defaultValue: 'Search roles, firms and candidate signals' })}
        className="w-full bg-transparent text-sm text-[color:var(--shell-text-primary)] outline-none placeholder:text-[color:var(--shell-text-subtle)]"
      />
      {loading ? <Loader2 size={14} className="animate-spin text-[color:var(--shell-accent-cyan)]" /> : null}
    </label>
  </div>
);
