import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Building,
  CheckCircle,
  ChevronDown,
  Clock3,
  Crown,
  Layers3,
  LogIn,
  MessageSquare,
  Shield,
  Sparkles,
  Target
} from 'lucide-react';
import AnalyticsService from '../services/analyticsService';

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
  const locale = (i18n.language || 'en').split('-')[0].toLowerCase();
  const isCsLike = locale === 'cs' || locale === 'sk';
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const hasTrackedView = useRef(false);

  const trackEvent = (eventName: string, metadata?: Record<string, unknown>) => {
    AnalyticsService.trackEvent(eventName, {
      locale: i18n.language,
      ...metadata
    });
  };

  useEffect(() => {
    if (hasTrackedView.current) return;
    hasTrackedView.current = true;
    trackEvent('company_landing_view', { section: 'handshake_landing' });
  }, []);

  const copy = useMemo(() => (isCsLike ? {
    badge: 'Handshake hiring pro firmy',
    title: 'Lepší první kontakt pro moderní hiring.',
    subtitle: 'JobShaman nahrazuje mrtvé CV a nekonečný funnel omezeným oboustranným dialogem. Firma nejdřív ukáže pravdu o roli a pak dostane odpověď, která ukáže způsob přemýšlení kandidáta.',
    primaryCta: 'Otevřít firemní workspace',
    secondaryCta: 'Vyzkoušet demo',
    login: 'Přihlásit se',
    recommended: 'Doporučeno',
    roleTruth: 'Pravda o roli',
    asyncFirst: 'Async first',
    valuePills: ['Role Canvas místo inzerátu', 'Dialogue Inbox místo application tabulky', 'Sloty místo nekonečného funnelu'],
    rolePreviewLabel: 'Ukázka Role Canvas',
    rolePreviewTitle: 'Ještě před otevřením role firma otevřeně popíše realitu týmu.',
    rolePreviewItems: [
      'Co je na této roli skutečně těžké?',
      'Jaký typ člověka tady selže?',
      'Jak poznáme úspěch po 6 měsících?',
      'Které 2 situace chceme otevřít v handshake?'
    ],
    comparisonTitle: 'Co se mění v praxi',
    comparisonOld: 'Starý hiring',
    comparisonNew: 'Handshake hiring',
    comparisonRows: [
      ['Job post a CV screening', 'Role Canvas a krátký oboustranný dialog'],
      ['100+ uchazečů v jednom funnelu', 'Omezená kapacita a aktivní sloty'],
      ['Video, pitch a sebeprezentace', 'Text-first odpověď, audio jen volitelně'],
      ['Ghosting a nejasné stavy', 'Open, In Review, Shortlisted, Closed s důvodem']
    ],
    systemTitle: 'Core system platformy',
    systemCards: [
      {
        title: 'Modul rolí',
        body: 'Pozice není jen text. Je to strukturovaný objekt s kontextem týmu, hodnotami, realistickými situacemi a definicí úspěchu.'
      },
      {
        title: 'Modul dialogu',
        body: 'Místo seznamu aplikací pracujete s vlákny. Každé vlákno má jasný tah, shrnutí a stav.'
      },
      {
        title: 'Kapacitní sloty',
        body: 'Každá role má limit otevřených dialogů. To drží kvalitu a chrání čas recruiterů.'
      },
      {
        title: 'Transparentní uzavření',
        body: 'Každý uzavřený dialog má důvod. Platforma nemá prostor pro "seen" a pasivní ignoraci.'
      }
    ],
    pricingTitle: 'Monetizace je v souladu s chováním',
    pricingLead: 'Neplatíte za CV databázi ani za počet zobrazení. Platíte za kapacitu, kterou opravdu používáte.',
    pricingPlans: [
      {
        name: 'Starter',
        price: '249 EUR / měsíc',
        note: 'Pro první hiring procesy',
        features: ['3 otevření rolí měsíčně', '12 aktivních dialogue slotů', 'Role Canvas + Dialogue Inbox']
      },
      {
        name: 'Growth',
        price: '599 EUR / měsíc',
        note: 'Pro aktivní hiring tým',
        features: ['10 otevření rolí měsíčně', '40 aktivních dialogue slotů', 'Prioritní SLA a workflow přehled'],
        highlighted: true
      },
      {
        name: 'Professional',
        price: '899 EUR / měsíc',
        note: 'Pro více recruiterů a vyšší throughput',
        features: ['25 otevření rolí měsíčně', '100 aktivních dialogue slotů', 'Rozšířené decision signály a billing kontrola']
      },
      {
        name: 'Enterprise',
        price: 'Custom',
        note: 'Pro komplexní hiring provoz',
        features: ['Custom limity', 'Success fee volitelně', 'Integrace a custom rollout']
      }
    ] as PlanCard[],
    faqTitle: 'Co firmy řeší nejčastěji',
    faqItems: [
      {
        q: 'Co když nechceme měnit celý hiring proces naráz?',
        a: 'Nemusíte. Handshake může být první vrstva před dalšími assessmenty. Měníme začátek funnelu, ne nutně všechno ostatní v první fázi.'
      },
      {
        q: 'Proč nejsou v centru CV a video?',
        a: 'CV zůstává jako doplněk. Video zvedá stres, bias a performativnost. Core handshake má být rychlý, soukromý a nízkostresový.'
      },
      {
        q: 'Jak AI pomáhá bez toho, aby rozhodovala?',
        a: 'AI shrnuje vlákna, vytahuje signál a připravuje explainable scorecard. Stav kandidáta pořád mění člověk.'
      },
      {
        q: 'Proč jsou důležité sloty?',
        a: 'Bez limitu se z dialogu stane další zahlcený inbox. Sloty drží tempo, pozornost a kvalitu odpovědí na obou stranách.'
      }
    ],
    finalTitle: 'Vraťte do výběru lidí lidský faktor a pravdu.',
    finalBody: 'Místo dalšího CV funnelu otevřete prostředí, kde se dá dělat rychlý a férový první kontakt bez zbytečného tlaku.',
    finalPrimary: 'Začít s role canvas',
    finalSecondary: 'Přihlásit se do firmy'
  } : {
    badge: 'Handshake hiring for companies',
    title: 'Build modern hiring on a better first contact.',
    subtitle: 'JobShaman replaces dead CV funnels with limited two-way dialogue. The company shows the truth about the role first, then gets a response that reveals how the candidate actually thinks.',
    primaryCta: 'Open company workspace',
    secondaryCta: 'Try demo',
    login: 'Log in',
    recommended: 'Recommended',
    roleTruth: 'Role truth',
    asyncFirst: 'Async first',
    valuePills: ['Role Canvas instead of a static ad', 'Dialogue Inbox instead of an application table', 'Slots instead of an endless funnel'],
    rolePreviewLabel: 'Role Canvas preview',
    rolePreviewTitle: 'Before a role opens, the company has to tell the truth.',
    rolePreviewItems: [
      'What is actually hard about this role?',
      'What kind of person fails here?',
      'How do we define success after six months?',
      'Which two situations should open the handshake?'
    ],
    comparisonTitle: 'What changes in practice',
    comparisonOld: 'Old hiring',
    comparisonNew: 'Handshake hiring',
    comparisonRows: [
      ['Job post and CV screening', 'Role Canvas and a short two-way dialogue'],
      ['100+ candidates in one funnel', 'Limited capacity with active slots'],
      ['Video, pitch, and self-presentation', 'Text-first response, audio optional'],
      ['Ghosting and unclear states', 'Open, In Review, Shortlisted, Closed with a reason']
    ],
    systemTitle: 'Platform core',
    systemCards: [
      {
        title: 'Role Engine',
        body: 'A role is not just text. It is a structured object with team context, values, realistic situations, and a success definition.'
      },
      {
        title: 'Dialogue Engine',
        body: 'Instead of application lists, your team works with threads. Each thread has turn ownership, summary, and status.'
      },
      {
        title: 'Slot-based capacity',
        body: 'Every role has a hard limit for open dialogues. That keeps recruiter attention focused and response quality high.'
      },
      {
        title: 'Transparent closure',
        body: 'Every closed dialogue has a reason. There is no product space for "seen" or passive silence.'
      }
    ],
    pricingTitle: 'Monetization aligned with behavior',
    pricingLead: 'You do not pay for CV inventory or impressions. You pay for the capacity you actually use.',
    pricingPlans: [
      {
        name: 'Starter',
        price: '249 EUR / month',
        note: 'For your first structured hiring loops',
        features: ['3 role opens per month', '12 active dialogue slots', 'Role Canvas + Dialogue Inbox']
      },
      {
        name: 'Growth',
        price: '599 EUR / month',
        note: 'For active hiring teams',
        features: ['10 role opens per month', '40 active dialogue slots', 'Priority SLA and workflow visibility'],
        highlighted: true
      },
      {
        name: 'Professional',
        price: '899 EUR / month',
        note: 'For larger recruiter throughput',
        features: ['25 role opens per month', '100 active dialogue slots', 'Extended decision signals and billing controls']
      },
      {
        name: 'Enterprise',
        price: 'Custom',
        note: 'For complex hiring operations',
        features: ['Custom limits', 'Optional success fee', 'Integrations and tailored rollout']
      }
    ] as PlanCard[],
    faqTitle: 'What companies ask most often',
    faqItems: [
      {
        q: 'What if we do not want to replace the whole hiring process at once?',
        a: 'You do not have to. Handshake can operate as the first layer before deeper interviews or assessments. It changes the front of the funnel first.'
      },
      {
        q: 'Why are CV and video no longer central?',
        a: 'CV remains as supporting context. Video increases stress, bias, and performance pressure. The core handshake should stay quick, private, and low-friction.'
      },
      {
        q: 'How does AI help without deciding?',
        a: 'AI summarizes threads, extracts signal, and prepares an explainable scorecard. A human still changes the candidate status.'
      },
      {
        q: 'Why do slots matter so much?',
        a: 'Without limits, dialogue turns into another overloaded inbox. Slots protect pace, attention, and reciprocity on both sides.'
      }
    ],
    finalTitle: 'Bring truth and human signal back into hiring.',
    finalBody: 'Replace another CV funnel with a system built for fast, fair, low-pressure first contact.',
    finalPrimary: 'Start with Role Canvas',
    finalSecondary: 'Log in as company'
  }), [isCsLike]);

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

  return (
    <div className="app-shell-bg h-full w-full overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--border)]">
      <div className="mx-auto flex max-w-6xl flex-1 flex-col gap-6 p-6 lg:p-10">
        <div className="flex justify-end">
          <button onClick={() => handleLogin('topbar')} className="app-button-secondary rounded-full px-4 py-2">
            <LogIn size={16} />
            {copy.login}
          </button>
        </div>

        <section className="app-page-header rounded-[var(--radius-2xl)] border p-6 lg:p-8">
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <div>
              <div className="app-eyebrow">
                <Sparkles size={14} />
                {copy.badge}
              </div>
              <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.05em] text-[var(--text-strong)] md:text-[3.7rem] md:leading-[1.02]">
                {copy.title}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--text-muted)]">
                {copy.subtitle}
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button onClick={() => handleRegister('hero')} className="app-button-primary rounded-[var(--radius-md)] px-6 py-3.5">
                  <Building size={18} />
                  {copy.primaryCta}
                </button>
                <button onClick={() => handleDemo('hero')} className="app-button-secondary rounded-[var(--radius-md)] px-6 py-3.5">
                  {copy.secondaryCta}
                  <ArrowRight size={18} />
                </button>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {copy.valuePills.map((pill) => (
                  <div key={pill} className="app-filter-chip cursor-default">
                    {pill}
                  </div>
                ))}
              </div>
            </div>

            <div className="company-surface rounded-[var(--radius-xl)] border p-5 shadow-[var(--shadow-card)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
                {copy.rolePreviewLabel}
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
                {copy.rolePreviewTitle}
              </h2>
              <div className="mt-5 rounded-[var(--radius-lg)] border border-[rgba(var(--accent-rgb),0.16)] bg-[var(--accent-soft)] p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
                  <Shield size={16} />
                  {copy.roleTruth}
                </div>
                <div className="mt-4 space-y-3">
                  {copy.rolePreviewItems.map((item) => (
                    <div key={item} className="company-surface rounded-[var(--radius-md)] border px-4 py-3 text-sm leading-6 text-[var(--text)] shadow-[var(--shadow-soft)]">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="company-surface rounded-[var(--radius-xl)] border p-6 shadow-[var(--shadow-soft)] lg:p-8">
          <div className="mb-5 flex items-center gap-3">
            <Target className="text-[var(--accent)]" size={20} />
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">{copy.comparisonTitle}</h2>
          </div>
          <div className="grid grid-cols-[1fr,1fr] gap-3 text-sm">
            <div className="rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 px-4 py-3 font-semibold text-rose-700">
              {copy.comparisonOld}
            </div>
            <div className="rounded-[var(--radius-md)] border border-emerald-200 bg-emerald-50 px-4 py-3 font-semibold text-emerald-700">
              {copy.comparisonNew}
            </div>
            {copy.comparisonRows.map(([legacy, next]) => (
              <React.Fragment key={`${legacy}-${next}`}>
                <div className="company-surface-soft rounded-[var(--radius-md)] border px-4 py-3 text-[var(--text-muted)]">
                  {legacy}
                </div>
                <div className="company-surface rounded-[var(--radius-md)] border px-4 py-3 font-medium text-[var(--text-strong)]">
                  {next}
                </div>
              </React.Fragment>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {copy.systemCards.map((card, index) => {
            const Icon = [Layers3, MessageSquare, Clock3, CheckCircle][index] || Layers3;
            return (
              <div key={card.title} className="company-surface rounded-[var(--radius-xl)] border p-5 shadow-[var(--shadow-soft)]">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)]">
                  <Icon size={20} />
                </div>
                <h3 className="text-lg font-semibold tracking-[-0.03em] text-[var(--text-strong)]">{card.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{card.body}</p>
              </div>
            );
          })}
        </section>

        <section className="company-surface rounded-[var(--radius-xl)] border p-6 shadow-[var(--shadow-card)] lg:p-8">
          <div className="mb-3 flex items-center gap-3">
            <Crown className="text-[var(--accent)]" size={20} />
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">{copy.pricingTitle}</h2>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-[var(--text-muted)]">{copy.pricingLead}</p>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {copy.pricingPlans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-[var(--radius-xl)] border p-5 shadow-[var(--shadow-soft)] ${
                  plan.highlighted
                    ? 'border-[rgba(var(--accent-rgb),0.22)] bg-[var(--accent-soft)]'
                    : 'company-surface-subtle'
                }`}
              >
                {plan.highlighted && (
                  <div className="app-eyebrow !px-2.5 !py-1 !text-[10px]">
                    <Sparkles size={12} />
                    {copy.recommended}
                  </div>
                )}
                <div className="mt-3 text-lg font-semibold text-[var(--text-strong)]">{plan.name}</div>
                <div className="mt-2 text-2xl font-black text-[var(--text-strong)]">{plan.price}</div>
                <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{plan.note}</p>
                <div className="mt-4 space-y-2">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2 text-sm text-[var(--text)]">
                      <CheckCircle size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => (plan.name === 'Enterprise' ? handleDemo('pricing') : handleRegister('pricing'))}
                  className={plan.highlighted ? 'app-button-primary mt-5 w-full rounded-[var(--radius-md)] px-4 py-3' : 'app-button-secondary mt-5 w-full rounded-[var(--radius-md)] px-4 py-3'}
                >
                  {plan.name === 'Enterprise' ? copy.secondaryCta : copy.primaryCta}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="company-surface rounded-[var(--radius-xl)] border p-6 shadow-[var(--shadow-soft)] lg:p-8">
          <div className="mb-5 flex items-center gap-3">
            <MessageSquare className="text-[var(--accent)]" size={20} />
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">{copy.faqTitle}</h2>
          </div>
          <div className="space-y-3">
            {copy.faqItems.map((item, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div key={item.q} className="company-surface-soft rounded-[var(--radius-lg)] border">
                  <button
                    onClick={() => {
                      const nextIndex = isOpen ? null : index;
                      setOpenFaqIndex(nextIndex);
                      if (!isOpen) {
                        trackEvent('company_landing_faq_expand', { faq_index: index });
                      }
                    }}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <span className="text-sm font-semibold text-[var(--text-strong)]">{item.q}</span>
                    <ChevronDown className={`h-4 w-4 text-[var(--text-faint)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-sm leading-7 text-[var(--text-muted)]">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="app-page-header rounded-[var(--radius-xl)] border p-6 lg:p-8">
          <div className="grid items-center gap-6 lg:grid-cols-2">
            <div>
              <div className="app-eyebrow">
                <Shield size={14} />
                {copy.asyncFirst}
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-[var(--text-strong)]">
                {copy.finalTitle}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-muted)]">
                {copy.finalBody}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <button onClick={() => handleRegister('final_cta')} className="app-button-primary rounded-[var(--radius-md)] px-6 py-3.5">
                {copy.finalPrimary}
                <ArrowRight size={18} />
              </button>
              <button onClick={() => handleLogin('final_cta')} className="app-button-secondary rounded-[var(--radius-md)] px-6 py-3.5">
                <LogIn size={18} />
                {copy.finalSecondary}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default CompanyLandingPage;
