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
    title: 'Nehledate dalsi ATS. Potrebujete lepsi prvni kontakt.',
    subtitle: 'JobShaman nahrazuje mrtve CV a nekonecny funnel omezenym oboustrannym dialogem. Firma nejdriv ukaze pravdu o roli a pak dostane odpoved, ktera ukaze zpusob premysleni kandidata.',
    primaryCta: 'Otevrit firemni workspace',
    secondaryCta: 'Domluvit demo',
    login: 'Prihlasit se',
    recommended: 'Doporuceno',
    roleTruth: 'Pravda o roli',
    asyncFirst: 'Async first',
    valuePills: ['Role Canvas misto inzeratu', 'Dialogue Inbox misto application tabulky', 'Sloty misto nekonecneho funnelu'],
    rolePreviewLabel: 'Role Canvas preview',
    rolePreviewTitle: 'Pred otevrenim role musi firma rict pravdu.',
    rolePreviewItems: [
      'Co je na teto roli skutecne tezke?',
      'Jaky typ cloveka tady selze?',
      'Jak pozname uspech po 6 mesicich?',
      'Ktere 2 situace chceme otevrit v handshake?'
    ],
    comparisonTitle: 'Co se meni v praxi',
    comparisonOld: 'Stary hiring',
    comparisonNew: 'Handshake hiring',
    comparisonRows: [
      ['Job post a CV screening', 'Role Canvas a kratky oboustranny dialog'],
      ['100+ uchazecu v jednom funnelu', 'Omezena kapacita a aktivni sloty'],
      ['Video, pitch a sebeprezentace', 'Text-first odpoved, audio jen volitelne'],
      ['Ghosting a nejasne stavy', 'Open, In Review, Shortlisted, Closed s duvodem']
    ],
    systemTitle: 'Core system platformy',
    systemCards: [
      {
        title: 'Role Engine',
        body: 'Pozice neni jen text. Je to strukturovany objekt s kontextem tymu, hodnotami, realistickymi situacemi a definici uspechu.'
      },
      {
        title: 'Dialogue Engine',
        body: 'Misto seznamu aplikaci pracujete s vlakny. Kazde vlakno ma jasny tah, shrnuti a status.'
      },
      {
        title: 'Slot-based capacity',
        body: 'Kazda role ma limit otevrenych dialogu. To drzi kvalitu a chrani recruiter time.'
      },
      {
        title: 'Transparent closure',
        body: 'Kazdy uzavreny dialog ma duvod. Platforma nema prostor pro "seen" a pasivni ignoraci.'
      }
    ],
    pricingTitle: 'Monetizace je v souladu s chovanim',
    pricingLead: 'Neplatite za CV databazi ani za pocet zobrazeni. Platite za kapacitu, kterou opravdu pouzivate.',
    pricingPlans: [
      {
        name: 'Starter',
        price: '249 EUR / mesic',
        note: 'Pro prvni hiring procesy',
        features: ['3 otevreni roli mesicne', '12 aktivnich dialogue slotu', 'Role Canvas + Dialogue Inbox']
      },
      {
        name: 'Growth',
        price: '599 EUR / mesic',
        note: 'Pro aktivni hiring tym',
        features: ['10 otevreni roli mesicne', '40 aktivnich dialogue slotu', 'Prioritni SLA a workflow prehled'],
        highlighted: true
      },
      {
        name: 'Professional',
        price: '899 EUR / mesic',
        note: 'Pro vice recruiteru a vyssi throughput',
        features: ['25 otevreni roli mesicne', '100 aktivnich dialogue slotu', 'Rozsirene decision signaly a billing kontrola']
      },
      {
        name: 'Enterprise',
        price: 'Custom',
        note: 'Pro komplexni hiring provoz',
        features: ['Custom limity', 'Success fee volitelne', 'Integrace a custom rollout']
      }
    ] as PlanCard[],
    faqTitle: 'Co firmy resi nejcasteji',
    faqItems: [
      {
        q: 'Co kdyz nechceme menit cely hiring proces naraz?',
        a: 'Nemusite. Handshake muze byt prvni vrstva pred dalsimi assessmenty. Menime zacatek funnelu, ne nutne vsechno ostatni v prvni fazi.'
      },
      {
        q: 'Proc nejsou v centru CV a video?',
        a: 'CV zustava jako doplnek. Video zveda stres, bias a performativnost. Core handshake ma byt rychly, soukromy a nizkostresovy.'
      },
      {
        q: 'Jak AI pomaha bez toho, aby rozhodovala?',
        a: 'AI shrnuje vlakna, vytahuje signal a pripravuje explainable scorecard. Stav kandidata porad meni clovek.'
      },
      {
        q: 'Proc jsou dulezite sloty?',
        a: 'Bez limitu se z dialogu stane dalsi zahlceny inbox. Sloty drzi tempo, pozornost a kvalitu odpovedi na obou stranach.'
      }
    ],
    finalTitle: 'Vratte do vyberu lidi lidsky faktor a pravdu.',
    finalBody: 'Misto dalsiho CV funnelu otevrite prostredi, kde se da delat rychly a ferovy prvni kontakt bez zbytecneho tlaku.',
    finalPrimary: 'Zacit s role canvas',
    finalSecondary: 'Prihlasit se do firmy'
  } : {
    badge: 'Handshake hiring for companies',
    title: 'You do not need another ATS. You need a better first contact.',
    subtitle: 'JobShaman replaces dead CV funnels with limited two-way dialogue. The company shows the truth about the role first, then gets a response that reveals how the candidate actually thinks.',
    primaryCta: 'Open company workspace',
    secondaryCta: 'Book a demo',
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
    <div className="h-full flex flex-col overflow-y-auto custom-scrollbar relative w-full bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.15),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(34,197,94,0.12),_transparent_34%),linear-gradient(180deg,_#f8fafc_0%,_#ecfeff_100%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(34,197,94,0.10),_transparent_36%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] rounded-xl border border-slate-200 dark:border-slate-800">
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={() => handleLogin('topbar')}
          className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-300 bg-white/80 dark:bg-slate-950/75 backdrop-blur px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm"
        >
          <LogIn size={16} />
          {copy.login}
        </button>
      </div>

      <div className="relative z-10 flex-1 p-6 lg:p-12">
        <div className="max-w-6xl mx-auto">
          <section className="pt-8 pb-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-7">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/70 dark:border-sky-800/60 bg-white/80 dark:bg-slate-950/60 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-sky-700 dark:text-sky-300">
                  <Sparkles size={14} />
                  {copy.badge}
                </div>
                <h1 className="mt-5 text-4xl md:text-6xl font-black tracking-tight leading-[1.04] text-slate-900 dark:text-white">
                  {copy.title}
                </h1>
                <p className="mt-5 max-w-3xl text-lg text-slate-700 dark:text-slate-300 leading-relaxed">
                  {copy.subtitle}
                </p>

                <div className="mt-7 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => handleRegister('hero')}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 dark:bg-white px-7 py-3.5 text-sm font-bold text-white dark:text-slate-950 shadow-xl"
                  >
                    <Building size={18} />
                    {copy.primaryCta}
                  </button>
                  <button
                    onClick={() => handleDemo('hero')}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300/80 dark:border-slate-700 bg-white/70 dark:bg-slate-950/40 px-7 py-3.5 text-sm font-semibold text-slate-900 dark:text-white"
                  >
                    {copy.secondaryCta}
                    <ArrowRight size={18} />
                  </button>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {copy.valuePills.map((pill) => (
                    <div key={pill} className="rounded-full border border-slate-300/80 dark:border-slate-700 bg-white/80 dark:bg-slate-950/55 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {pill}
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="rounded-[2rem] border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-950/75 p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)]">
                  <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                    {copy.rolePreviewLabel}
                  </div>
                  <h2 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{copy.rolePreviewTitle}</h2>
                  <div className="mt-5 rounded-[1.5rem] border border-amber-200/80 dark:border-amber-900/70 bg-amber-50/80 dark:bg-amber-950/20 p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
                      <Shield size={16} />
                      {copy.roleTruth}
                    </div>
                    <div className="mt-4 space-y-3">
                      {copy.rolePreviewItems.map((item) => (
                        <div key={item} className="rounded-xl bg-white/80 dark:bg-slate-900/60 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 border border-white/70 dark:border-slate-800">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="pb-8">
            <div className="rounded-[2rem] border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-950/65 p-6 lg:p-8">
              <div className="flex items-center gap-3 mb-5">
                <Target className="text-sky-600 dark:text-sky-300" size={20} />
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{copy.comparisonTitle}</h2>
              </div>
              <div className="grid grid-cols-[1fr,1fr] gap-3 text-sm">
                <div className="rounded-2xl bg-rose-50/80 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/60 px-4 py-3 font-bold text-rose-700 dark:text-rose-300">
                  {copy.comparisonOld}
                </div>
                <div className="rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/60 px-4 py-3 font-bold text-emerald-700 dark:text-emerald-300">
                  {copy.comparisonNew}
                </div>
                {copy.comparisonRows.map(([legacy, next]) => (
                  <React.Fragment key={`${legacy}-${next}`}>
                    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 px-4 py-3 text-slate-700 dark:text-slate-200">
                      {legacy}
                    </div>
                    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-white font-medium">
                      {next}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </section>

          <section className="pb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {copy.systemCards.map((card, index) => {
                const Icon = [Layers3, MessageSquare, Clock3, CheckCircle][index] || Layers3;
                return (
                  <div key={card.title} className="rounded-[1.6rem] border border-slate-200/80 dark:border-slate-800 bg-white/85 dark:bg-slate-950/55 p-5">
                    <div className="w-11 h-11 rounded-2xl bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 flex items-center justify-center mb-4">
                      <Icon size={20} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{card.title}</h3>
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{card.body}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="pb-8">
            <div className="rounded-[2rem] border border-slate-200/80 dark:border-slate-800 bg-slate-950 text-white p-6 lg:p-8 shadow-[0_28px_80px_-40px_rgba(2,132,199,0.42)]">
              <div className="flex items-center gap-3 mb-3">
                <Crown className="text-amber-300" size={20} />
                <h2 className="text-2xl font-bold">{copy.pricingTitle}</h2>
              </div>
              <p className="text-sm text-slate-300 max-w-3xl">{copy.pricingLead}</p>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {copy.pricingPlans.map((plan) => (
                  <div
                    key={plan.name}
                    className={`rounded-[1.6rem] border p-5 ${
                      plan.highlighted
                        ? 'border-sky-400/50 bg-sky-500/10'
                        : 'border-white/10 bg-white/5'
                    }`}
                  >
                    {plan.highlighted && (
                      <div className="inline-flex items-center gap-1 rounded-full bg-sky-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-950">
                        <Sparkles size={12} />
                        {copy.recommended}
                      </div>
                    )}
                    <div className="mt-3 text-lg font-bold">{plan.name}</div>
                    <div className="mt-2 text-2xl font-black text-white">{plan.price}</div>
                    <p className="mt-2 text-xs text-slate-300">{plan.note}</p>
                    <div className="mt-4 space-y-2">
                      {plan.features.map((feature) => (
                        <div key={feature} className="flex items-start gap-2 text-sm text-slate-200">
                          <CheckCircle size={16} className="text-emerald-300 mt-0.5 shrink-0" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => (plan.name === 'Enterprise' ? handleDemo('pricing') : handleRegister('pricing'))}
                      className={`mt-5 w-full rounded-2xl px-4 py-3 text-sm font-bold ${
                        plan.highlighted
                          ? 'bg-sky-400 text-slate-950'
                          : 'bg-white text-slate-950'
                      }`}
                    >
                      {plan.name === 'Enterprise' ? copy.secondaryCta : copy.primaryCta}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="pb-8">
            <div className="rounded-[2rem] border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-950/65 p-6 lg:p-8">
              <div className="flex items-center gap-3 mb-5">
                <MessageSquare className="text-sky-600 dark:text-sky-300" size={20} />
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{copy.faqTitle}</h2>
              </div>
              <div className="space-y-3">
                {copy.faqItems.map((item, index) => {
                  const isOpen = openFaqIndex === index;
                  return (
                    <div key={item.q} className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50">
                      <button
                        onClick={() => {
                          const nextIndex = isOpen ? null : index;
                          setOpenFaqIndex(nextIndex);
                          if (!isOpen) {
                            trackEvent('company_landing_faq_expand', { faq_index: index });
                          }
                        }}
                        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                      >
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">{item.q}</span>
                        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                          {item.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="pb-4">
            <div className="rounded-[2rem] border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-950/65 p-6 lg:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-sky-100 dark:bg-sky-950/40 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-sky-700 dark:text-sky-300">
                    <Shield size={14} />
                    {copy.asyncFirst}
                  </div>
                  <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                    {copy.finalTitle}
                  </h2>
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                    {copy.finalBody}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 lg:justify-end">
                  <button
                    onClick={() => handleRegister('final_cta')}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 dark:bg-white px-7 py-3.5 text-sm font-bold text-white dark:text-slate-950"
                  >
                    {copy.finalPrimary}
                    <ArrowRight size={18} />
                  </button>
                  <button
                    onClick={() => handleLogin('final_cta')}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300/80 dark:border-slate-700 bg-white/70 dark:bg-slate-950/40 px-7 py-3.5 text-sm font-semibold text-slate-900 dark:text-white"
                  >
                    <LogIn size={18} />
                    {copy.finalSecondary}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default CompanyLandingPage;
