import React from 'react';
import { CreditCard, Shield, Users } from 'lucide-react';

import type { CompanyProfile } from '../../../types';
import { companyMapText, resolveCompanyMapLocale } from '../companyMapLocale';
import CompanySettings from '../../CompanySettings';
import { CompanyMapStatCard } from './CompanyMapPrimitives';

interface CompanyBrandCorePanelProps {
  profile: CompanyProfile;
  locale?: string;
  onProfileUpdate?: (profile: CompanyProfile) => void;
  onDeleteAccount?: () => Promise<boolean>;
  onOpenCompanyPricing?: () => void;
}

const CompanyBrandCorePanel: React.FC<CompanyBrandCorePanelProps> = ({
  profile,
  locale: localeInput,
  onProfileUpdate,
  onDeleteAccount,
  onOpenCompanyPricing,
}) => {
  const locale = resolveCompanyMapLocale(localeInput);
  const text = (variants: Parameters<typeof companyMapText>[1]) => companyMapText(locale, variants);
  const tier = profile.subscription?.tier || 'free';
  const usage = profile.subscription?.usage;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <CompanyMapStatCard
          label={text({
            cs: 'Tým',
            sk: 'Tím',
            en: 'Team',
            de: 'Team',
            pl: 'Zespół',
          })}
          value={profile.members?.length || 0}
          icon={<Users size={12} />}
        />
        <CompanyMapStatCard
          label={text({
            cs: 'Plán',
            sk: 'Plán',
            en: 'Plan',
            de: 'Tarif',
            pl: 'Plan',
          })}
          value={tier}
          icon={<CreditCard size={12} />}
        />
        <CompanyMapStatCard
          label={text({
            cs: 'AI assessmenty',
            sk: 'AI assessmenty',
            en: 'AI assessments',
            de: 'KI-Assessments',
            pl: 'Assessmenty AI',
          })}
          value={usage?.aiAssessmentsUsed ?? 0}
          icon={<Shield size={12} />}
        />
      </div>

      {onOpenCompanyPricing ? (
        <div className="rounded-[24px] border border-cyan-200/80 bg-cyan-50/80 px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700">
                {text({
                  cs: 'Předplatné',
                  sk: 'Predplatné',
                  en: 'Subscription',
                  de: 'Abonnement',
                  pl: 'Subskrypcja',
                })}
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-700">
                {text({
                  cs: 'Tady spravujete plán, usage i to, jak se firma a recruiter tým ukazují kandidátům.',
                  sk: 'Tu spravujete plán, usage aj to, ako sa firma a recruiter tím zobrazujú kandidátom.',
                  en: 'This is where you manage the plan, usage, and how the company and recruiter team appear to candidates.',
                  de: 'Hier verwalten Sie Tarif, Nutzung und wie Unternehmen und Recruiter-Team Kandidatinnen und Kandidaten erscheinen.',
                  pl: 'Tutaj zarządzasz planem, użyciem oraz tym, jak firma i zespół rekruterów pokazują się kandydatom.',
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenCompanyPricing()}
              className="rounded-full border border-cyan-200 bg-white px-4 py-2 text-xs font-semibold text-cyan-900"
            >
              {text({
                cs: 'Otevřít plán a pricing',
                sk: 'Otvoriť plán a pricing',
                en: 'Open plan and pricing',
                de: 'Tarif und Preise öffnen',
                pl: 'Otwórz plan i cennik',
              })}
            </button>
          </div>
        </div>
      ) : null}

      <CompanySettings
        profile={profile}
        onSave={(nextProfile) => onProfileUpdate?.(nextProfile)}
        onDeleteAccount={onDeleteAccount}
      />
    </div>
  );
};

export default CompanyBrandCorePanel;
