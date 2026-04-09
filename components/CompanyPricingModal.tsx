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
  id: string;
  name: string;
  price: string;
  bestFor: string;
  outcome: string;
  roleOpens: string;
  dialogueSlots: string;
  recruiterSeats: string;
  features: string[];
  recommended?: boolean;
}

const normalizeTier = (tier?: string | null): string => String(tier || 'free').trim().toLowerCase();

const CompanyPricingModal: React.FC<CompanyPricingModalProps> = ({
  open,
  onClose,
  companyProfile,
}) => {
  const { i18n } = useTranslation();
  const language = String(i18n.language || 'cs').split('-')[0].toLowerCase();
  const isCsLike = language === 'cs' || language === 'sk';
  const currentTier = normalizeTier(companyProfile?.subscription?.tier);
  const usage = companyProfile?.subscription?.usage;

  const copy = useMemo(() => (
    isCsLike
      ? {
          kicker: 'JobShaman pro firmy',
          title: 'Firemní plán a kapacita náboru',
          body: 'Žádné záložky a žádné zbytečné přepínání. Všechny plány vidíte najednou a hned víte, co odemknete pro svůj náborový rytmus.',
          currentPlan: 'Aktuální plán',
          currentUsage: 'Aktuální kapacita',
          aiUsage: 'AI screeningy',
          roleUsage: 'Aktivní výzvy',
          dialogueUsage: 'Kandidáti v procesu',
          currentPlanBadge: 'Váš plán',
          close: 'Zavřít',
          plans: [
            {
              id: 'free',
              name: 'Free',
              price: 'Zdarma',
              bestFor: 'Na první vyzkoušení, jestli vám nábor podle reálného signálu sedí ještě před placeným nasazením.',
              outcome: 'Jedna živá pozice a první reálný aha moment bez závazku.',
              roleOpens: '1 aktivní výzva',
              dialogueSlots: '3 kandidáti v procesu',
              recruiterSeats: '1 člen týmu',
              features: ['Vyzkoušení na jedné pozici', 'První praktická reakce a hodnoticí přehled', 'Bez rizika, jen ověření, jestli to sedí vašemu týmu'],
            },
            {
              id: 'starter',
              name: 'Starter',
              price: '249 EUR / měsíc',
              bestFor: 'Pro menší tým, který chce přestat třídit CV naslepo a začít rozhodovat z prvního signálu.',
              outcome: 'První opakovatelný postup pro několik klíčových rolí.',
              roleOpens: '3 aktivní výzvy',
              dialogueSlots: '12 kandidátů v procesu',
              recruiterSeats: '2 členové týmu',
              features: ['Praktická reakce jako první filtr', 'Hodnoticí přehled u každé reakce', 'Základ pro první výběr bez slepých telefonátů'],
            },
            {
              id: 'growth',
              name: 'Růst',
              price: '599 EUR / měsíc',
              bestFor: 'Pro firmy, které chtějí opakovatelný náborový systém místo improvizace role po roli.',
              outcome: 'Dost kapacity pro více rolí, více náborářů a jasnější rozhodování.',
              roleOpens: '10 aktivních výzev',
              dialogueSlots: '40 kandidátů v procesu',
              recruiterSeats: '5 členů týmu',
              features: ['Doporučený plán pro většinu týmů', 'Silná kapacita pro další výběr a navazující kroky', 'Jednotný jazyk náboru napříč týmem'],
              recommended: true,
            },
            {
              id: 'professional',
              name: 'Pokročilý',
              price: '899 EUR / měsíc',
              bestFor: 'Pro větší náborové organizace, které chtějí sladit náboráře, vedoucí týmů i tempo výběru.',
              outcome: 'Širší náborový provoz bez ztráty přehledu, kapacity a kvality signálu.',
              roleOpens: '25 aktivních výzev',
              dialogueSlots: '100 kandidátů v procesu',
              recruiterSeats: '12 členů týmu',
              features: ['Vysoká průchodnost bez chaosu', 'Více týmů v jednom prostředí', 'Kapacita pro větší rozpracovaný výběr i více lidí v rozhodování'],
            },
          ] as PlanCard[],
        }
      : {
          kicker: 'JobShaman for companies',
          title: 'Company plan and hiring capacity',
          body: 'No tabs and no pointless toggling. You see every plan at once and immediately understand what it unlocks for your hiring rhythm.',
          currentPlan: 'Current plan',
          currentUsage: 'Current capacity',
          aiUsage: 'AI screenings',
          roleUsage: 'Active challenges',
          dialogueUsage: 'Candidates in process',
          currentPlanBadge: 'Your plan',
          close: 'Close',
          plans: [
            {
              id: 'free',
              name: 'Free',
              price: 'Free',
              bestFor: 'To validate whether skill-first hiring fits your team before paying for rollout.',
              outcome: 'One live role and the first real aha moment without commitment.',
              roleOpens: '1 active challenge',
              dialogueSlots: '3 candidates in process',
              recruiterSeats: '1 team member',
              features: ['Try it on one live role', 'First practical handshake and dossier', 'Low-risk validation for your team'],
            },
            {
              id: 'starter',
              name: 'Starter',
              price: '249 EUR / month',
              bestFor: 'For smaller teams that want to stop sorting CVs blindly and start deciding from first signal.',
              outcome: 'The first repeatable workflow for a few key roles.',
              roleOpens: '3 active challenges',
              dialogueSlots: '12 candidates in process',
              recruiterSeats: '2 team members',
              features: ['Skill-first handshake workflow', 'Recruiter dossier for every response', 'First shortlist workflow without blind calls'],
            },
            {
              id: 'growth',
              name: 'Growth',
              price: '599 EUR / month',
              bestFor: 'For companies that want a repeatable hiring system instead of role-by-role improvisation.',
              outcome: 'Enough capacity for multiple roles, multiple recruiters, and sharper decisions.',
              roleOpens: '10 active challenges',
              dialogueSlots: '40 candidates in process',
              recruiterSeats: '5 team members',
              features: ['Recommended for most teams', 'Strong shortlist and follow-up capacity', 'One skill-first language across hiring'],
              recommended: true,
            },
            {
              id: 'professional',
              name: 'Professional',
              price: '899 EUR / month',
              bestFor: 'For larger hiring organizations aligning recruiters, hiring managers, and pipeline speed.',
              outcome: 'Wider hiring operations without losing clarity, capacity, or signal quality.',
              roleOpens: '25 active challenges',
              dialogueSlots: '100 candidates in process',
              recruiterSeats: '12 team members',
              features: ['High throughput without chaos', 'Multiple teams in one workspace', 'Capacity for larger pipelines and more stakeholders'],
            },
          ] as PlanCard[],
        }
  ), [isCsLike]);

  if (!open) return null;

  return (
    <ModalShell
      onClose={onClose}
      variant="hero"
      maxWidthClassName="max-w-7xl"
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
        <div className="rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-5">
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
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
            </div>

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                {copy.currentUsage}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[20px] border border-[var(--border-subtle)] bg-white/85 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
                    <Shield size={12} />
                    {copy.aiUsage}
                  </div>
                  <div className="mt-2 text-xl font-semibold text-[var(--text-strong)]">{usage?.aiAssessmentsUsed ?? 0}</div>
                </div>
                <div className="rounded-[20px] border border-[var(--border-subtle)] bg-white/85 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
                    <Building2 size={12} />
                    {copy.roleUsage}
                  </div>
                  <div className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
                    {usage?.roleOpensUsed ?? usage?.activeJobsCount ?? 0}
                  </div>
                </div>
                <div className="rounded-[20px] border border-[var(--border-subtle)] bg-white/85 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
                    <Users size={12} />
                    {copy.dialogueUsage}
                  </div>
                  <div className="mt-2 text-xl font-semibold text-[var(--text-strong)]">{usage?.activeDialogueSlotsUsed ?? 0}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-4">
          {copy.plans.map((plan) => {
            const isCurrent = normalizeTier(plan.name) === currentTier;
            return (
              <div
                key={plan.id}
                className={`rounded-[28px] border p-6 ${
                  isCurrent
                    ? 'border-cyan-300/50 bg-cyan-50/80'
                    : plan.recommended
                      ? 'border-cyan-400/50 bg-cyan-50/80 shadow-[0_24px_56px_-36px_rgba(8,145,178,0.34)]'
                      : 'border-[var(--border-subtle)] bg-[var(--surface-subtle)]'
                }`}
              >
                {plan.recommended ? (
                  <div className="mb-3 inline-flex rounded-full border border-cyan-300 bg-slate-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                    {isCsLike ? 'Nejčastější volba' : 'Most popular'}
                  </div>
                ) : null}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xl font-semibold text-[var(--text-strong)]">{plan.name}</div>
                    <div className="mt-1 text-2xl font-black text-[var(--text-strong)]">{plan.price}</div>
                  </div>
                  {isCurrent ? (
                    <div className="rounded-full border border-cyan-200 bg-white px-3 py-1 text-[11px] font-semibold text-cyan-800">
                      {copy.currentPlanBadge}
                    </div>
                  ) : null}
                </div>

                <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{plan.bestFor}</p>

                <div className="mt-4 grid gap-2">
                  {[plan.roleOpens, plan.dialogueSlots, plan.recruiterSeats].map((item) => (
                    <div key={item} className="rounded-[16px] border border-[var(--border-subtle)] bg-white/85 px-3.5 py-2.5 text-sm font-medium text-[var(--text-strong)]">
                      {item}
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-[18px] border border-[var(--border-subtle)] bg-white/85 px-4 py-3.5">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-faint)]">
                    {isCsLike ? 'Co odemknete' : 'What it unlocks'}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-[var(--text-strong)]">
                    {plan.outcome}
                  </div>
                </div>

                <div className="mt-4 space-y-2.5">
                  {plan.features.slice(0, 3).map((feature) => (
                    <div key={feature} className="flex items-start gap-2.5 text-sm leading-6 text-[var(--text-strong)]">
                      <CheckCircle2 size={15} className="mt-1 shrink-0 text-emerald-500" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ModalShell>
  );
};

export default CompanyPricingModal;
