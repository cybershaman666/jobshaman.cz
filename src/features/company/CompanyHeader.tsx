import React from 'react';
import { useTranslation } from 'react-i18next';
import { Crown, Settings, Sparkles } from 'lucide-react';
import type { CompanyProfile } from '../../../types';

interface CompanyHeaderProps {
  companyProfile?: CompanyProfile | null;
  userEmail?: string;
  onOpenPricing?: () => void;
}

export const CompanyHeader: React.FC<CompanyHeaderProps> = ({
  companyProfile,
  userEmail,
  onOpenPricing,
}) => {
  const { t } = useTranslation();
  const companyName = companyProfile?.name || '';
  const companyLogo = companyProfile?.logo_url;
  const companyDescription = String(companyProfile?.description || '').trim();
  const companyIndustry = String(companyProfile?.industry || '').trim();
  const companyTone = String(companyProfile?.tone || '').trim();
  const companyValues = Array.isArray(companyProfile?.values) ? companyProfile.values.filter(Boolean).slice(0, 3) : [];

  const initials = companyName
    .split(/\s+/)
    .map((word: string) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'CO';

  return (
    <header className="border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-dark)] text-lg font-bold text-white shadow-sm">
                {companyLogo ? (
                  <img src={companyLogo} alt={companyName} className="h-full w-full rounded-2xl object-cover" />
                ) : (
                  initials
                )}
              </div>

              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-800">
                  <Sparkles size={12} />
                  {t('company.header.kicker', { defaultValue: 'Skill-first hiring workspace' })}
                </div>
                <h1 className="mt-3 truncate text-2xl font-bold tracking-[-0.04em] text-slate-950 dark:text-white">
                  {companyName || t('company.header.no_name', { defaultValue: 'Company' })}
                </h1>
                {companyDescription && (
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                    {companyDescription}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {companyIndustry && (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {companyIndustry}
                    </span>
                  )}
                  {companyTone && (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {companyTone}
                    </span>
                  )}
                  {companyValues.map((value) => (
                    <span
                      key={value}
                      className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-900 dark:border-cyan-800/70 dark:bg-cyan-950/30 dark:text-cyan-200"
                    >
                      {value}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {onOpenPricing && (
              <button
                onClick={onOpenPricing}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-white"
              >
                <Crown size={14} />
                {t('company.header.pricing', { defaultValue: 'Plans' })}
              </button>
            )}
            <button className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              <Settings size={14} />
              {t('company.header.settings', { defaultValue: 'Settings' })}
            </button>
          </div>
        </div>

        {userEmail && (
          <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
            {t('company.header.logged_in_as', { defaultValue: 'Logged in as' })}: {userEmail}
          </div>
        )}
      </div>
    </header>
  );
};
