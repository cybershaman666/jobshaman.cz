import React, { useMemo } from 'react';
import { Building2, CheckCircle2, CreditCard, Shield, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { CompanyProfile } from '../types';
import { ModalShell } from './ui/primitives';

interface CompanyPricingModalProps {
  open: boolean;
  onClose: () => void;
  companyProfile?: CompanyProfile | null;
}

interface PlanCard {
  name: string;
  price: string;
  note: string;
  features: string[];
  highlighted?: boolean;
}

const normalizeTier = (tier?: string | null): string => String(tier || 'free').trim().toLowerCase();

const CompanyPricingModal: React.FC<CompanyPricingModalProps> = ({
  open,
  onClose,
  companyProfile,
}) => {
  const { i18n } = useTranslation();
  const language = String(i18n.language || 'en').split('-')[0].toLowerCase();
  const isCsLike = language === 'cs' || language === 'sk';
  const currentTier = normalizeTier(companyProfile?.subscription?.tier);
  const usage = companyProfile?.subscription?.usage;

  const copy = useMemo(() => {
    if (isCsLike) {
      return {
        kicker: 'JobShaman pro firmy',
        title: 'Firemni plan a kapacita',
        body: 'Toto je firemni pricing a aktualni kapacita hiringu. Ne kandidatni premium. Tady patri role opens, dialogue sloty a assessment usage.',
        currentPlan: 'Aktualni plan',
        currentUsage: 'Aktualni usage',
        aiUsage: 'AI assessmenty',
        roleUsage: 'Aktivni vyzvy',
        dialogueUsage: 'Dialog sloty',
        currentPlanBadge: 'Vas plan',
        close: 'Zavrit',
        plans: [
          {
            name: 'Free',
            price: 'Zdarma',
            note: 'Na prvni overeni, ze novy hiring flow sedi vasemu tymu.',
            features: ['1 otevreni role', '3 aktivni dialogove sloty', 'Mapa + prvni vyzva'],
          },
          {
            name: 'Starter',
            price: '249 EUR / mesic',
            note: 'Na prvni realne hiring vyzvy.',
            features: ['3 role opens', '12 dialogue slots', 'Problem map + role editor'],
          },
          {
            name: 'Growth',
            price: '599 EUR / mesic',
            note: 'Pro tymy, ktere chteji opakovatelny hiring bez chaosu.',
            features: ['10 role opens', '40 dialogue slots', 'Plna challenge prace'],
            highlighted: true,
          },
          {
            name: 'Professional',
            price: '899 EUR / mesic',
            note: 'Pro vyssi throughput a vice recruiteru.',
            features: ['25 role opens', '100 dialogue slots', 'Rozsirena operativa a kapacita'],
          },
        ] as PlanCard[],
      };
    }

    return {
      kicker: 'JobShaman for companies',
      title: 'Company plan and capacity',
      body: 'This is the company pricing and current hiring capacity view, not candidate premium. Role opens, dialogue slots, and assessment usage belong here.',
      currentPlan: 'Current plan',
      currentUsage: 'Current usage',
      aiUsage: 'AI assessments',
      roleUsage: 'Active challenges',
      dialogueUsage: 'Dialogue slots',
      currentPlanBadge: 'Your plan',
      close: 'Close',
      plans: [
        {
          name: 'Free',
          price: 'Free',
          note: 'For validating whether the new hiring flow fits your team.',
          features: ['1 role open', '3 active dialogue slots', 'Map + first challenge'],
        },
        {
          name: 'Starter',
          price: '249 EUR / month',
          note: 'For the first real hiring challenges.',
          features: ['3 role opens', '12 dialogue slots', 'Problem map + role editor'],
        },
        {
          name: 'Growth',
          price: '599 EUR / month',
          note: 'For teams that want repeatable hiring without chaos.',
          features: ['10 role opens', '40 dialogue slots', 'Full challenge workflow'],
          highlighted: true,
        },
        {
          name: 'Professional',
          price: '899 EUR / month',
          note: 'For higher throughput and multiple recruiters.',
          features: ['25 role opens', '100 dialogue slots', 'Expanded operations and capacity'],
        },
      ] as PlanCard[],
    };
  }, [isCsLike]);

  if (!open) return null;

  return (
    <ModalShell
      onClose={onClose}
      variant="hero"
      maxWidthClassName="max-w-6xl"
      kicker={(
        <span className="inline-flex items-center gap-2">
          <Building2 size={12} />
          {copy.kicker}
        </span>
      )}
      title={copy.title}
      body={copy.body}
      actions={(
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-subtle)] px-5 py-2.5 text-sm font-semibold text-[var(--text-strong)]"
        >
          {copy.close}
        </button>
      )}
    >
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
              {copy.currentPlan}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <CreditCard size={18} className="text-[var(--accent)]" />
              <div className="text-2xl font-semibold text-[var(--text-strong)]">
                {companyProfile?.subscription?.tier || 'free'}
              </div>
            </div>
            {companyProfile?.subscription?.expiresAt ? (
              <div className="mt-2 text-sm text-[var(--text-muted)]">
                {new Date(companyProfile.subscription.expiresAt).toLocaleDateString(isCsLike ? 'cs-CZ' : 'en-US')}
              </div>
            ) : null}

            <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
              {copy.currentUsage}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[20px] border border-[var(--border-subtle)] bg-white/80 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
                  <Shield size={12} />
                  {copy.aiUsage}
                </div>
                <div className="mt-2 text-xl font-semibold text-[var(--text-strong)]">{usage?.aiAssessmentsUsed ?? 0}</div>
              </div>
              <div className="rounded-[20px] border border-[var(--border-subtle)] bg-white/80 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
                  <Building2 size={12} />
                  {copy.roleUsage}
                </div>
                <div className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
                  {usage?.roleOpensUsed ?? usage?.activeJobsCount ?? 0}
                </div>
              </div>
              <div className="rounded-[20px] border border-[var(--border-subtle)] bg-white/80 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
                  <Users size={12} />
                  {copy.dialogueUsage}
                </div>
                <div className="mt-2 text-xl font-semibold text-[var(--text-strong)]">{usage?.activeDialogueSlotsUsed ?? 0}</div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {copy.plans.map((plan) => {
              const isCurrent = normalizeTier(plan.name) === currentTier;
              return (
                <div
                  key={plan.name}
                  className={`rounded-[24px] border p-5 ${
                    isCurrent
                      ? 'border-cyan-300/50 bg-cyan-50/70'
                      : plan.highlighted
                        ? 'border-cyan-300/30 bg-cyan-300/10'
                        : 'border-[var(--border-subtle)] bg-[var(--surface-subtle)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-lg font-semibold text-[var(--text-strong)]">{plan.name}</div>
                    {isCurrent ? (
                      <div className="rounded-full border border-cyan-200 bg-white px-3 py-1 text-[11px] font-semibold text-cyan-800">
                        {copy.currentPlanBadge}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-2 text-2xl font-black text-[var(--text-strong)]">{plan.price}</div>
                  <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{plan.note}</p>
                  <div className="mt-4 space-y-2">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-2 text-sm text-[var(--text-strong)]">
                        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ModalShell>
  );
};

export default CompanyPricingModal;
