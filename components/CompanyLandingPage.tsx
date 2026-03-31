import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Building2, CheckCircle2, LogIn } from 'lucide-react';

import AnalyticsService from '../services/analyticsService';
import { ModalShell } from './ui/primitives';
import CompanyGalaxyMapShell from './company/CompanyGalaxyMapShell';

interface CompanyLandingPageProps {
  onRegister?: () => void;
  onRequestDemo?: () => void;
  onLogin?: () => void;
}

interface PlanCard {
  name: string;
  price: string;
  note: string;
  features: string[];
  highlighted?: boolean;
}

const CompanyLandingPage: React.FC<CompanyLandingPageProps> = ({ onRegister, onRequestDemo, onLogin }) => {
  const { i18n } = useTranslation();
  const language = String(i18n.language || 'en').split('-')[0].toLowerCase();
  const isCsLike = language === 'cs' || language === 'sk';
  const hasTrackedView = useRef(false);
  const [pricingOpen, setPricingOpen] = useState(false);

  const trackEvent = (eventName: string, metadata?: Record<string, unknown>) => {
    AnalyticsService.trackEvent(eventName, {
      locale: i18n.language,
      ...metadata,
    });
  };

  useEffect(() => {
    if (hasTrackedView.current) return;
    hasTrackedView.current = true;
    trackEvent('company_landing_view', { section: 'problem_map_landing' });
  }, []);

  const copy = useMemo(() => {
    if (isCsLike) {
      return {
        modalKicker: 'JobShaman pro firmy',
        modalTitle: 'Chcete si to zkusit na vlastnim hiringu?',
        modalBody: 'Kapacitu a registraci otevirame az ve chvili, kdy firma vidi, ze tenhle flow dava smysl. Ne driv.',
        primaryCta: 'Vytvorit firemni ucet',
        secondaryCta: 'Pozadat o demo',
        tertiaryCta: 'Uz ucet mam',
        pricingTitle: 'Kapacita, ne feature list',
        pricingLead: 'Plany porad stoji na role opens a dialogue slotech. Jen uz nejsou rozesete po landing page.',
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
      modalKicker: 'JobShaman for companies',
      modalTitle: 'Want to try this on your own hiring flow?',
      modalBody: 'Capacity and signup only open once the company has felt why this flow is different. Not before.',
      primaryCta: 'Create company account',
      secondaryCta: 'Request demo',
      tertiaryCta: 'I already have an account',
      pricingTitle: 'Capacity, not feature theater',
      pricingLead: 'Plans still run on role opens and dialogue slots. They just no longer clutter the landing before the product moment.',
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

  const handleOpenPricing = (section: string) => {
    trackEvent('company_landing_open_pricing_modal', { section });
    setPricingOpen(true);
  };

  const handleRegister = (section: string) => {
    trackEvent('company_landing_cta_register_click', { section });
    onRegister?.();
  };

  const handleDemo = (section: string) => {
    trackEvent('company_landing_cta_demo_click', { section });
    if (onRequestDemo) {
      onRequestDemo();
      return;
    }
    onLogin?.();
  };

  const handleLogin = (section: string) => {
    trackEvent('company_landing_cta_login_click', { section });
    onLogin?.();
  };

  const landingLayers = useMemo(() => ([
    { id: 'challenge_map', label: 'Challenge Map', active: true, onClick: () => handleOpenPricing('landing_layer_challenge_map') },
    { id: 'candidate_wave', label: 'Challenge Cluster', onClick: () => handleOpenPricing('landing_layer_candidate_wave') },
    { id: 'human_detail', label: 'Human Detail', onClick: () => handleDemo('landing_layer_human_detail') },
    { id: 'open_wave', label: 'Open Challenge', onClick: () => handleRegister('landing_layer_open_wave') },
  ]), [handleDemo, handleOpenPricing, handleRegister]);

  const landingNodes = useMemo(() => (
    isCsLike
      ? [
          {
            id: 'landing-challenge-map',
            label: 'Challenge Map',
            narrative: 'Firma vstupuje do mapy pres realny hiring tlak a problem, ne pres dashboard taby.',
            x: 22,
            y: 24,
            accent: 'core' as const,
            secondaryLabel: 'Default layer',
            onClick: () => handleOpenPricing('landing_node_challenge_map'),
          },
          {
            id: 'landing-wave',
            label: 'Challenge Cluster',
            narrative: 'Jedna role se meni na zivy orbit kandidatu, dialogu, coverage a dalsich dalsich kroku.',
            x: 80,
            y: 26,
            accent: 'accent' as const,
            secondaryLabel: 'Layer 2',
            onClick: () => handleDemo('landing_node_candidate_wave'),
          },
          {
            id: 'landing-human',
            label: 'Human Detail',
            narrative: 'Dialog a dossier cloveka jde do centra driv, nez se hiring rozpadne do seznamu a karet.',
            x: 78,
            y: 78,
            accent: 'accent' as const,
            secondaryLabel: 'Layer 3',
            onClick: () => handleDemo('landing_node_human_detail'),
          },
          {
            id: 'landing-open-wave',
            label: 'Open Challenge',
            narrative: 'Nova challenge nebo role se otevre ze stejne mapy a jde rovnou do dalsi hiring vyzvy.',
            x: 24,
            y: 78,
            accent: 'muted' as const,
            secondaryLabel: 'Layer 4',
            onClick: () => handleRegister('landing_node_open_wave'),
          },
        ]
      : [
          {
            id: 'landing-challenge-map',
            label: 'Challenge Map',
            narrative: 'Companies enter from live hiring reality, not from a dashboard tab stack.',
            x: 22,
            y: 24,
            accent: 'core' as const,
            secondaryLabel: 'Default layer',
            onClick: () => handleOpenPricing('landing_node_challenge_map'),
          },
          {
            id: 'landing-wave',
            label: 'Challenge Cluster',
            narrative: 'A role becomes one live orbit of candidates, dialogue pressure, screening and next actions.',
            x: 80,
            y: 26,
            accent: 'accent' as const,
            secondaryLabel: 'Layer 2',
            onClick: () => handleDemo('landing_node_candidate_wave'),
          },
          {
            id: 'landing-human',
            label: 'Human Detail',
            narrative: 'The person and the dossier move to the center before hiring falls back into detached cards and lists.',
            x: 78,
            y: 78,
            accent: 'accent' as const,
            secondaryLabel: 'Layer 3',
            onClick: () => handleDemo('landing_node_human_detail'),
          },
          {
            id: 'landing-open-wave',
            label: 'Open Challenge',
            narrative: 'A new challenge or role opens from the same map and continues into the next hiring challenge.',
            x: 24,
            y: 78,
            accent: 'muted' as const,
            secondaryLabel: 'Layer 4',
            onClick: () => handleRegister('landing_node_open_wave'),
          },
        ]
  ), [handleDemo, handleOpenPricing, handleRegister, isCsLike]);

  return (
    <div className="relative flex h-full min-h-full w-full flex-col overflow-hidden">
      <CompanyGalaxyMapShell
        mode="landing"
        kicker={isCsLike ? 'JobShaman pro firmy' : 'JobShaman for companies'}
        title={isCsLike ? 'Firemni galaxy map zacina stejnym shellem jako kandidat.' : 'The company galaxy starts in the same shell as the candidate map.'}
        subtitle={isCsLike
          ? 'Nova firemni cesta je Challenge Map -> Challenge Cluster -> Human Detail -> Open Challenge. Landing uz neni oddeleny svet, ale prvni vstup do stejne galaxie.'
          : 'The new default journey is Challenge Map -> Challenge Cluster -> Human Detail -> Open Challenge. The landing is no longer a separate world, but the first step into the same galaxy.'}
        center={{
          name: isCsLike ? 'Company Journey' : 'Company Journey',
          motto: isCsLike
            ? 'Mapa, ktera zacina firemni identitou a vede az k dalsi hiring vyzve.'
            : 'A map that starts from company identity and carries the team all the way to the next hiring challenge.',
          tone: isCsLike ? 'Hiring galaxy' : 'Hiring galaxy',
          statusLine: 'Challenge Map / Challenge Cluster / Human Detail / Open Challenge',
          values: ['Logo in the core', 'Human-first flow', 'Challenge-based hiring'],
        }}
        layers={landingLayers}
        nodes={landingNodes}
        topActions={
          <>
            <button
              onClick={() => handleRegister('landing_header')}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:translate-y-[-1px]"
            >
              {copy.primaryCta}
              <ArrowRight size={16} />
            </button>
            <button
              onClick={() => handleDemo('landing_header')}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-subtle)] px-5 py-2.5 text-sm font-semibold text-[var(--text-strong)] transition hover:translate-y-[-1px]"
            >
              {copy.secondaryCta}
            </button>
            <button
              onClick={() => handleLogin('landing_header')}
              className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/84 px-4 py-2.5 text-sm font-semibold text-[var(--text-strong)] transition hover:translate-y-[-1px]"
            >
              <LogIn size={15} />
              {copy.tertiaryCta}
            </button>
          </>
        }
        detailPanel={
          <div className="space-y-5">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                {isCsLike ? 'Proc tenhle shell' : 'Why this shell'}
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[var(--text-strong)]">
                {isCsLike ? 'Jedna galaxie od vstupu az po live hiring.' : 'One galaxy from first touch to live hiring.'}
              </div>
              <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                {isCsLike
                  ? 'Firma vidi stejny prostor pred registraci i po ni. Stredem je firemni identita, kolem ni orbituji challenges, kandidati, dossier detail a otevreni dalsi role.'
                  : 'The company sees the same space before signup and after it. The brand identity sits in the center, while challenges, candidates, dossier detail and the next role orbit around it.'}
              </p>
            </div>

            <div className="space-y-3">
              {copy.plans.slice(0, 3).map((plan) => (
                <div key={plan.name} className="rounded-[22px] border border-white/70 bg-white/84 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[var(--text-strong)]">{plan.name}</div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">{plan.price}</div>
                  </div>
                  <div className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{plan.note}</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => handleOpenPricing('landing_detail_panel')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
            >
              {copy.pricingTitle}
              <ArrowRight size={16} />
            </button>
          </div>
        }
      />

      {pricingOpen ? (
        <ModalShell
          onClose={() => setPricingOpen(false)}
          variant="hero"
          maxWidthClassName="max-w-6xl"
          kicker={
            <span className="inline-flex items-center gap-2">
              <Building2 size={12} />
              {copy.modalKicker}
            </span>
          }
          title={copy.modalTitle}
          body={copy.modalBody}
          actions={
            <>
              <button
                onClick={() => handleRegister('pricing_modal_header')}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:translate-y-[-1px]"
              >
                {copy.primaryCta}
                <ArrowRight size={16} />
              </button>
              <button
                onClick={() => handleDemo('pricing_modal_header')}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-subtle)] px-5 py-2.5 text-sm font-semibold text-[var(--text-strong)] transition hover:translate-y-[-1px]"
              >
                {copy.secondaryCta}
              </button>
            </>
          }
        >
          <div className="space-y-6">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                {copy.pricingTitle}
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-muted)]">
                {copy.pricingLead}
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-4">
              {copy.plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`rounded-[26px] border p-5 ${
                    plan.highlighted
                      ? 'border-cyan-300/40 bg-cyan-300/12'
                      : 'border-[var(--border-subtle)] bg-[var(--surface-subtle)]'
                  }`}
                >
                  <div className="text-lg font-semibold text-[var(--text-strong)]">{plan.name}</div>
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
                  <button
                    onClick={() => handleRegister(`pricing_modal_plan_${plan.name.toLowerCase()}`)}
                    className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                      plan.highlighted
                        ? 'bg-slate-950 text-white hover:bg-slate-900'
                        : 'border border-[var(--border-strong)] bg-white text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    {copy.primaryCta}
                    <ArrowRight size={15} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-6 sm:flex-row">
              <button
                onClick={() => handleRegister('pricing_modal_footer')}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:translate-y-[-1px]"
              >
                {copy.primaryCta}
                <ArrowRight size={16} />
              </button>
              <button
                onClick={() => handleDemo('pricing_modal_footer')}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-subtle)] px-5 py-3 text-sm font-semibold text-[var(--text-strong)] transition hover:translate-y-[-1px]"
              >
                {copy.secondaryCta}
              </button>
              <button
                onClick={() => handleLogin('pricing_modal_footer')}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-transparent px-5 py-3 text-sm font-semibold text-[var(--text-muted)] transition hover:text-[var(--text-strong)]"
              >
                <LogIn size={16} />
                {copy.tertiaryCta}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
};

export default CompanyLandingPage;
