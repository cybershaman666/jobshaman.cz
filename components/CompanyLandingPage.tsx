import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CheckCircle2, LockKeyhole, LogIn, Sparkles, Target } from 'lucide-react';

import type { DialogueDossier } from '../types';
import AnalyticsService from '../services/analyticsService';
import { buildCompanyHandshakeDecisionView } from '../services/companyHandshakeDossierService';

interface CompanyLandingPageProps {
  onRegister?: () => void;
  onRequestDemo?: () => void;
  onLogin?: () => void;
}

interface LandingPlan {
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

const CompanyLandingPage: React.FC<CompanyLandingPageProps> = ({ onRegister, onRequestDemo, onLogin }) => {
  const { i18n } = useTranslation();
  const language = String(i18n.resolvedLanguage || i18n.language || 'cs').toLowerCase();
  const isCsLike = language.startsWith('cs') || language.startsWith('sk');
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    AnalyticsService.trackEvent('company_landing_view', {
      locale: i18n.language,
      section: 'conversion_first',
      shell_mode: 'landing_page',
    });
  }, [i18n.language]);

  const trackClick = (eventName: string, metadata?: Record<string, unknown>) => {
    AnalyticsService.trackEvent(eventName, { locale: i18n.language, ...metadata });
  };

  const callRegister = (source: string) => {
    trackClick('company_landing_register_click', { source });
    onRegister?.();
  };

  const callDemo = (source: string) => {
    trackClick('company_landing_demo_click', { source });
    onRequestDemo?.();
  };

  const callLogin = (source: string) => {
    trackClick('company_landing_login_click', { source });
    onLogin?.();
  };

  const copy = useMemo(() => (
    isCsLike
      ? {
          kicker: 'JobShaman pro firmy',
          heroTitle: 'Kandidáta nečtete z CV. Poznáte ho z toho, jak řeší váš reálný problém.',
          heroBody: 'Firma zadá krátkou výzvu z praxe. Kandidát ukáže první tah. Vy dostanete anonymní hodnoticí přehled, ze kterého je opravdu možné vybrat silné lidi ještě před prvním pohovorem.',
          primaryCta: 'Vytvořit účet a první výzvu',
          secondaryCta: 'Ukázat mi to na demu',
          tertiaryCta: 'Přihlásit se',
          heroProofs: [
            'Žádné CV-first třídění naslepo',
            'Krátká praktická reakce místo generických odpovědí',
            'Anonymní hodnoticí přehled ještě před odhalením identity',
          ],
          stepsTitle: 'Jednoduchý princip. Silnější náborová rozhodnutí.',
          dossierTitle: 'Během pár minut víte, jestli toho člověka chcete opravdu poznat blíž',
          dossierBody: 'Místo dalšího slepého callu dostanete odpověď, ze které je okamžitě cítit úsudek, priorita a schopnost řešit vaši realitu. Přesně ten typ signálu, kvůli kterému si řeknete: ano, tohle má smysl posunout dál.',
          compareTitle: 'Konečně nábor, ve kterém už po prvním kontaktu víte, kdo stojí za další krok',
          pricingTitle: 'Pricing bez chaosu a bez zbytečného překlikávání',
          pricingBody: 'Všechny plány vidíte najednou. Hned je jasné, co odemknete, kolik výzev můžete vést a pro jak velký náborový tým to dává smysl.',
          finalTitle: 'Pokud chcete méně slepých telefonátů a víc rozhodnutí z reálného signálu, začíná to první výzvou.',
          finalBody: 'Stačí vytvořit firemní účet, popsat jednu skutečnou situaci a nechat kandidáty ukázat první tah.',
        }
      : {
          kicker: 'JobShaman for companies',
          heroTitle: 'Do not read candidates from their CV. Read them from how they solve your real problem.',
          heroBody: 'Your team frames a short practical challenge. The candidate shows the first move. You get an anonymous skill-first dossier strong enough to shortlist before the interview.',
          primaryCta: 'Create account and first challenge',
          secondaryCta: 'Show me the demo',
          tertiaryCta: 'Log in',
          heroProofs: [
            'No more blind CV-first filtering',
            'Short practical handshake instead of generic answers',
            'Anonymous recruiter dossier before identity reveal',
          ],
          stepsTitle: 'A simple principle. Stronger hiring decisions.',
          dossierTitle: 'Within minutes, you know whether this is someone you genuinely want to meet',
          dossierBody: 'Instead of another blind call, you get a response that immediately shows judgment, priorities, and the ability to solve your reality. Exactly the kind of signal that makes a team say: yes, this person is worth moving forward.',
          compareTitle: 'Finally, a hiring flow where the first contact already tells you who deserves the next step',
          pricingTitle: 'Pricing without chaos or pointless toggling',
          pricingBody: 'All plans are visible at once. You immediately see what unlocks, how many challenges you can run, and what team size each plan fits.',
          finalTitle: 'If you want fewer blind calls and more decisions from real signal, it starts with the first challenge.',
          finalBody: 'Create the company account, describe one real situation, and let candidates show the first move.',
        }
  ), [isCsLike]);

  const sampleDossier = useMemo<DialogueDossier>(() => ({
    id: 'landing-dialogue-platform-lead',
    candidate_id: 'candidate-signal-01',
    job_id: 'job-platform-lead',
    job_title: 'Platform / SRE Lead',
    status: 'shortlisted',
    submitted_at: '2026-04-02T09:20:00Z',
    updated_at: '2026-04-02T11:45:00Z',
    dialogue_deadline_at: '2026-04-04T16:00:00Z',
    dialogue_current_turn: 'company',
    dialogue_timeout_hours: 48,
    dialogue_is_overdue: false,
    candidate_name: 'Signal Candidate',
    candidate_email: 'signal.candidate@example.com',
    candidate_profile_snapshot: {
      name: 'Signal Candidate',
      email: 'signal.candidate@example.com',
      jobTitle: 'Platform / SRE Lead',
      skills: ['Incident response', 'Kubernetes', 'Operational design', 'Python'],
      values: isCsLike ? ['Ownership', 'Klid pod tlakem'] : ['Ownership', 'Calm under pressure'],
    },
    application_payload: {
      practical_assessment_brief: {
        kicker: 'Practical handshake',
        timebox: isCsLike ? '15 až 20 minut' : '15 to 20 minutes',
        scenario_title: isCsLike ? 'První měsíc ve chvíli, kdy tým ztrácí důvěru v priority' : 'First month when the team has lost trust in priorities',
        scenario_context: isCsLike
          ? 'Produkt i platform tým jsou po sérii incidentů přetížené a lidé nevěří, že se řeší správné věci ve správném pořadí.'
          : 'After repeated incidents, product and platform are overloaded and people no longer trust that the right things are being solved in the right order.',
        core_problem: isCsLike
          ? 'Navrhněte první týden a první měsíc tak, aby se zklidnil provoz, srovnal ownership a tým viděl rychlý důkaz zlepšení.'
          : 'Design the first week and first month to calm operations, restore ownership, and show fast proof of improvement.',
        constraints: isCsLike
          ? ['Bez velké reorganizace', 'Bez ztráty důvěry týmu', 'První viditelný dopad do 30 dní']
          : ['No big reorg', 'Do not lose team trust', 'First visible impact within 30 days'],
        structured_sections: [
          { id: 'first_move', title: isCsLike ? 'První tah' : 'First move' },
          { id: 'what_to_verify', title: isCsLike ? 'Co si ověřit' : 'What to verify' },
          { id: 'risk_tradeoffs', title: isCsLike ? 'Rizika a trade-offy' : 'Risks and trade-offs' },
        ],
      },
      practical_assessment_response: {
        first_move: isCsLike
          ? 'První 72 hodin bych neřešil všechno. Srovnal bych tři nejbolestivější incidenty, zviditelnil ownership handoffy a otevřel jeden veřejný decision log, aby tým hned viděl, co se mění.'
          : 'In the first 72 hours I would not try to fix everything. I would stabilize the three most painful incidents, make ownership handoffs visible, and open one public decision log so the team sees change immediately.',
        what_to_verify: isCsLike
          ? 'Potřebuji ověřit, kde dnes vzniká největší latency mezi product a platform, kdo ve skutečnosti schvaluje kritické změny a jestli incident review mění chování, nebo jen archivuje stres.'
          : 'I need to verify where the largest latency appears between product and platform, who actually approves critical changes, and whether incident review changes behavior or only archives stress.',
        risk_tradeoffs: isCsLike
          ? 'Největší riziko je přepálit centralizaci a vytvořit nové bottlenecky. Proto bych oddělil dočasný stabilizační režim od dlouhodobého operating modelu.'
          : 'The biggest risk is over-centralizing and creating new bottlenecks. I would separate the temporary stabilization mode from the long-term operating model.',
      },
    } as any,
    signal_boost: {
      signal_summary: {
        items: [
          { key: 'context_read', label: 'Context read', score: 84 },
          { key: 'decision_quality', label: 'Decision quality', score: 81 },
          { key: 'risk_judgment', label: 'Risk judgment', score: 76 },
          { key: 'role_specificity', label: 'Role specificity', score: 82 },
        ],
      },
      recruiter_readout: {
        headline: isCsLike
          ? 'Kandidát okamžitě odděluje stabilizaci od redesignu a neskrývá se za obecné best practices.'
          : 'The candidate immediately separates stabilization from redesign and does not hide behind generic best practices.',
        evidence_excerpt: isCsLike
          ? 'První odpověď ukazuje klid pod tlakem, realistickou priorizaci a schopnost vrátit týmu důvěru bez velkého divadla.'
          : 'The first answer shows calm under pressure, realistic prioritization, and the ability to restore team trust without drama.',
        strength_signals: isCsLike
          ? ['Klidná priorizace', 'Silný ownership framing', 'Praktický follow-through']
          : ['Calm prioritization', 'Strong ownership framing', 'Practical follow-through'],
        risk_flags: isCsLike
          ? ['Ověřit stakeholder sequencing ve větší organizaci']
          : ['Verify stakeholder sequencing in a larger organization'],
        what_cv_does_not_show: isCsLike
          ? ['Jak přemýšlí pod tlakem', 'Jak zachází s ownership chaosem', 'Jak odděluje rychlou stabilizaci od redesignu']
          : ['How they think under pressure', 'How they handle ownership chaos', 'How they separate stabilization from redesign'],
        follow_up_questions: isCsLike
          ? ['Jak by rozdělil ownership mezi product a platform?', 'Kdy by ukončil stabilizační režim?']
          : ['How would they split ownership between product and platform?', 'When would they end the stabilization mode?'],
        recommended_next_step: isCsLike
          ? 'Pozvat do krátkého navazujícího hovoru a ověřit práci s neformálním vlivem ve větším týmu.'
          : 'Invite to a short follow-up call and validate how they handle informal influence in a larger team.',
        fit_context: {
          headline: isCsLike
            ? 'Vysoká pravděpodobnost, že zklidní napětí a vrátí týmu důvěru v rozhodování během prvních týdnů.'
            : 'High probability of calming tension and restoring trust in decision-making within the first weeks.',
          recruiter_validation_focus: isCsLike
            ? ['Ověřit práci s neformálním vlivem', 'Ověřit práci s leadership alignment']
            : ['Validate informal influence', 'Validate leadership alignment'],
          recruiter_soft_signals: isCsLike
            ? ['Nízké ego', 'Systémové myšlení', 'Klid v tlaku']
            : ['Low ego', 'Systems thinking', 'Calm under pressure'],
          stretch_areas: isCsLike
            ? ['Doplnit sequencing stakeholderů na delším horizontu']
            : ['Add stakeholder sequencing for the longer horizon'],
        },
      },
    } as any,
  }), [isCsLike]);

  const view = useMemo(() => buildCompanyHandshakeDecisionView(sampleDossier), [sampleDossier]);
  const visualAssets = useMemo(() => ({
    heroPhoto: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1400&q=80',
    workspacePhoto: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1400&q=80',
  }), []);
  const radarChart = useMemo(() => {
    const size = 260;
    const center = size / 2;
    const radius = 88;
    const levels = [0.25, 0.5, 0.75, 1];
    const cards = view.scoreCards;
    const pointFor = (index: number, valueRatio: number) => {
      const angle = (-Math.PI / 2) + (index / cards.length) * Math.PI * 2;
      const r = radius * valueRatio;
      const x = center + Math.cos(angle) * r;
      const y = center + Math.sin(angle) * r;
      return { x, y };
    };
    const polygon = cards.map((card, index) => {
      const p = pointFor(index, Math.max(0, Math.min(1, card.score / 100)));
      return `${p.x},${p.y}`;
    }).join(' ');
    const axes = cards.map((card, index) => {
      const edge = pointFor(index, 1);
      const label = pointFor(index, 1.18);
      return { card, edge, label };
    });
    const rings = levels.map((level) => cards.map((_, index) => {
      const p = pointFor(index, level);
      return `${p.x},${p.y}`;
    }).join(' '));
    return { size, center, polygon, axes, rings };
  }, [view.scoreCards]);
  const landingDossierCopy = useMemo(() => (
    isCsLike
      ? {
          kicker: 'První silný signál pro další krok',
          title: 'U tohohle člověka rychle cítíte, že by mohl týmu skutečně pomoct',
          summary: 'Ne proto, že má hezké CV. Ale proto, že jeho první odpověď působí klidně, přesně a prakticky. Přesně tak vypadá moment, kdy náborář přestane jen číst a začne si říkat: tohohle člověka chci poznat blíž.',
          signalBadge: 'Signál, který dává smysl posunout dál',
          companyProblem: 'Co firma potřebuje vyřešit',
          candidateMove: 'Jak kandidát přemýšlí o prvním tahu',
          businessImpact: 'Proč to působí silně už teď',
          nextStep: 'Co dává smysl udělat hned potom',
          scoreLabels: {
            context_read: 'Porozumění situaci',
            decision_quality: 'Kvalita rozhodnutí',
            risk_judgment: 'Práce s rizikem',
            role_specificity: 'Přenos do role',
          } as Record<string, string>,
          scoreVerdict: 'Silný nadprůměrný dojem',
          evidenceTitle: 'Co firmu přesvědčí během pár vteřin',
          identityTitle: 'Identita zůstává zamčená, dokud není na stole skutečný zájem',
          identityBody: 'Nejdřív se rozhodujete z kvality reakce. Jméno, kontakt a celý profil se odemknou až ve chvíli, kdy opravdu chcete navázat další krok.',
        }
      : {
          kicker: 'First shortlist-ready signal',
          title: 'This is the kind of candidate who immediately feels useful to the team',
          summary: 'Not because the CV looks polished, but because the first response feels calm, precise, and practical. This is the moment when a recruiter stops just reading and starts thinking: yes, I want to meet this person.',
          signalBadge: 'A signal worth moving forward',
          companyProblem: 'What the company needs solved',
          candidateMove: 'How the candidate thinks about the first move',
          businessImpact: 'Why this already feels strong',
          nextStep: 'What makes sense to do next',
          scoreLabels: {
            context_read: 'Situational understanding',
            decision_quality: 'Decision quality',
            risk_judgment: 'Risk handling',
            role_specificity: 'Role transfer',
          } as Record<string, string>,
          scoreVerdict: 'Strong above-baseline signal',
          evidenceTitle: 'What convinces the team within seconds',
          identityTitle: 'Identity stays locked until there is real interest',
          identityBody: 'The team decides from response quality first. Name, direct contact, and full profile unlock only when you genuinely want to continue.',
        }
  ), [isCsLike]);

  const steps = useMemo(() => (
    isCsLike
      ? [
          {
            title: '1. Zadáte reálný problém',
            body: 'Ne další generický inzerát. Jednu konkrétní situaci, kterou nový člověk opravdu převezme.',
          },
          {
            title: '2. Kandidát ukáže první tah',
            body: 'Krátká praktická reakce odhalí úsudek, priority, práci s rizikem a přenos do reality týmu.',
          },
          {
            title: '3. Dostanete hodnoticí přehled',
            body: 'Anonymní, srovnatelný a lidský výstup, ze kterého můžete vybrat silné lidi dřív než z CV.',
          },
        ]
      : [
          {
            title: '1. Frame a real problem',
            body: 'Not another generic listing. One concrete situation the new person will actually take over.',
          },
          {
            title: '2. The candidate shows the first move',
            body: 'A short practical handshake reveals judgment, priorities, risk, and practical transfer into the team reality.',
          },
          {
            title: '3. You get a recruiter dossier',
            body: 'An anonymous, comparable, human output strong enough to shortlist before the CV becomes the center.',
          },
        ]
  ), [isCsLike]);

  const compareItems = useMemo(() => (
    isCsLike
      ? [
          {
            title: 'Běžný náborový proces',
            points: [
              'Nejdřív čtete profil, ale až call ukáže, jestli ten člověk opravdu přemýšlí způsobem, který potřebujete.',
              'První rozhovory často jen dohánějí to, co mělo být jasné už předem.',
              'Tým investuje čas do lidí, u kterých se základní jistota objeví až příliš pozdě.',
            ],
            tone: 'border-slate-200 bg-white shadow-sm',
          },
          {
            title: 'Nábor přes JobShaman',
            points: [
              'Už první reakce ukáže, jestli ten člověk umí přemýšlet nad vaším problémem klidně, prakticky a s prioritou.',
              'Do dalšího kola posouváte lidi, u kterých už teď cítíte reálný přínos pro tým.',
              'Náborář i vedoucí týmu se opírají o jeden silný signál, ne o pocit z hezky napsaného CV.',
            ],
            tone: 'border-slate-200 bg-white shadow-sm',
          },
        ]
      : [
          {
            title: 'Standard hiring flow',
            points: [
              'You read the profile first, but only the call tells you whether the person actually thinks the way you need.',
              'Early interviews often exist just to discover what should have been obvious earlier.',
              'The team spends time on people before there is enough confidence they are truly worth it.',
            ],
            tone: 'border-slate-200 bg-white shadow-sm',
          },
          {
            title: 'Hiring with JobShaman',
            points: [
              'The first response already shows whether the person thinks about your problem in a calm, practical, high-priority way.',
              'You move forward with people who already feel capable of helping the team.',
              'Recruiters and hiring managers align around one strong signal instead of a polished CV impression.',
            ],
            tone: 'border-slate-200 bg-white shadow-sm',
          },
        ]
  ), [isCsLike]);

  const plans = useMemo<LandingPlan[]>(() => (
    isCsLike
      ? [
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
            bestFor: 'Pro menší tým, který chce začít nabírat podle reálného signálu místo chaosu kolem CV.',
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
            bestFor: 'Pro firmy, které chtějí z náboru udělat jasný systém, ne improvizaci role po roli.',
            outcome: 'Dost kapacity pro opakovatelný nábor napříč několika rolemi a náboráři.',
            roleOpens: '10 aktivních výzev',
            dialogueSlots: '40 kandidátů v procesu',
            recruiterSeats: '5 členů týmu',
            features: ['Doporučený plán pro většinu týmů', 'Silná kapacita pro další výběr a navazující kroky', 'Jeden konzistentní jazyk náboru napříč týmem'],
            recommended: true,
          },
          {
            id: 'professional',
            name: 'Pokročilý',
            price: '899 EUR / měsíc',
            bestFor: 'Pro větší náborové organizace, které chtějí sladit náboráře, vedoucí týmů i rychlost rozhodování.',
            outcome: 'Širší náborový provoz bez ztráty přehledu a kvality signálu.',
            roleOpens: '25 aktivních výzev',
            dialogueSlots: '100 kandidátů v procesu',
            recruiterSeats: '12 členů týmu',
            features: ['Vysoká průchodnost bez chaosu v tarifech', 'Více týmů v jednom prostředí', 'Kapacita pro větší rozpracovaný výběr i více lidí v rozhodování'],
          },
        ]
      : [
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
            bestFor: 'For smaller teams that want to move from CV chaos to real hiring signal.',
            outcome: 'The first repeatable workflow for a few key roles.',
            roleOpens: '3 active challenges',
            dialogueSlots: '12 candidates in process',
            recruiterSeats: '2 team members',
            features: ['Skill-first handshake workflow', 'Recruiter dossier on every response', 'A real shortlist workflow before blind calls'],
          },
          {
            id: 'growth',
            name: 'Growth',
            price: '599 EUR / month',
            bestFor: 'For companies that want a clear hiring system instead of role-by-role improvisation.',
            outcome: 'Enough capacity for repeatable hiring across multiple roles and recruiters.',
            roleOpens: '10 active challenges',
            dialogueSlots: '40 candidates in process',
            recruiterSeats: '5 team members',
            features: ['Recommended for most teams', 'Strong shortlist and follow-up capacity', 'One consistent skill-first hiring language across the team'],
            recommended: true,
          },
          {
            id: 'professional',
            name: 'Professional',
            price: '899 EUR / month',
            bestFor: 'For larger hiring organizations aligning recruiters, hiring managers, and decision speed.',
            outcome: 'Wider hiring operations without losing clarity or signal quality.',
            roleOpens: '25 active challenges',
            dialogueSlots: '100 candidates in process',
            recruiterSeats: '12 team members',
            features: ['Higher throughput without pricing chaos', 'Multiple teams in one hiring workspace', 'Capacity for larger pipelines and more stakeholders'],
          },
        ]
  ), [isCsLike]);

  return (
    <div className="min-h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <section className="rounded-[32px] border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8 lg:px-10 lg:py-10">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-800">
                <Sparkles size={13} />
                {copy.kicker}
              </div>
              <h1 className="mt-5 max-w-5xl text-4xl font-black tracking-[-0.06em] text-slate-950 sm:text-5xl lg:text-6xl">
                {copy.heroTitle}
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-slate-700 sm:text-lg">
                {copy.heroBody}
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => callRegister('landing_hero_primary')}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_18px_42px_-24px_rgba(12,74,110,0.45)]"
                >
                  {copy.primaryCta}
                  <ArrowRight size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => callDemo('landing_hero_secondary')}
                  className="rounded-full border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700"
                >
                  {copy.secondaryCta}
                </button>
                <button
                  type="button"
                  onClick={() => callLogin('landing_hero_login')}
                  className="inline-flex items-center gap-2 rounded-full border border-transparent px-5 py-3.5 text-sm font-semibold text-slate-500"
                >
                  <LogIn size={15} />
                  {copy.tertiaryCta}
                </button>
              </div>
            </div>

            <div className="relative min-h-[420px]">
              <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950 shadow-sm">
                <img
                  src={visualAssets.heroPhoto}
                  alt={isCsLike ? 'Hiring tým v reálném pracovním prostředí' : 'Hiring team in a real work setting'}
                  className="h-[420px] w-full object-cover opacity-95"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.04)_0%,rgba(15,23,42,0.36)_56%,rgba(15,23,42,0.74)_100%)]" />

                <div className="absolute inset-x-0 bottom-0 p-6">
                  <div className="max-w-sm rounded-[22px] border border-white/15 bg-slate-950/72 p-5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                      {isCsLike ? 'Nábor podle reálného signálu v praxi' : 'Skill-first hiring in practice'}
                    </div>
                    <div className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
                      {isCsLike ? 'Méně slepých telefonátů. Víc silných výběrů.' : 'Fewer blind calls. More strong shortlists.'}
                    </div>
                    <div className="mt-3 text-sm leading-7 text-slate-200">
                      {isCsLike
                        ? 'Landing má teď ukazovat skutečný pocit z lepšího náboru, ne jen seznam funkcí.'
                        : 'The landing should now feel like better hiring in motion, not a stack of feature boxes.'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute -left-3 top-6 hidden max-w-[220px] rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-[0_20px_48px_-32px_rgba(15,23,42,0.35)] md:block">
                <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                  {isCsLike ? 'První dojem pro firmu' : 'First company impression'}
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-950">
                  {isCsLike ? 'Tým vidí reálnou reakci na problém, ne jen hezky napsanou zkušenost.' : 'The team sees a real response to a problem, not just a polished background.'}
                </div>
              </div>

              <div className="absolute -right-3 bottom-8 hidden max-w-[240px] rounded-[22px] border border-cyan-200 bg-cyan-50 px-4 py-4 shadow-[0_20px_48px_-32px_rgba(14,116,144,0.35)] md:block">
                <div className="text-[11px] uppercase tracking-[0.14em] text-cyan-700">
                  {isCsLike ? 'Aha moment' : 'Aha moment'}
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-950">
                  {isCsLike ? '„Tohle chci zkusit hned teď.“' : '"I want to try this right now."'}
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-700">
                  {isCsLike ? 'Přesně ten pocit má nový landing vyvolat během prvních sekund.' : 'That is the exact feeling the new landing should create within seconds.'}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {copy.heroProofs.map((proof) => (
              <div key={proof} className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                {proof}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <div className="max-w-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              {isCsLike ? 'Jak to funguje' : 'How it works'}
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">
              {copy.stepsTitle}
            </h2>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.title} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-lg font-semibold tracking-[-0.03em] text-slate-950">{step.title}</div>
                <p className="mt-3 text-sm leading-7 text-slate-700">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="relative h-full min-h-[320px]">
              <img
                src={visualAssets.workspacePhoto}
                alt={isCsLike ? 'Lidé spolupracující v moderním týmu' : 'People collaborating in a modern team'}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,23,42,0.12)_0%,rgba(15,23,42,0.04)_42%,rgba(255,255,255,0.02)_100%)]" />
            </div>
            <div className="flex flex-col justify-center px-6 py-8 sm:px-8 lg:px-10">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                {isCsLike ? 'Lidštější nábor' : 'Human-like hiring'}
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">
                {isCsLike ? 'Firma i kandidát mají mít pocit, že se už trochu znají ještě před prvním interview.' : 'The company and the candidate should already feel like they know each other a bit before the first interview.'}
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-700">
                {isCsLike
                  ? 'Tohle není jen nový layout. Celý princip je postavený tak, aby první interakce byla konkrétní, lidská a rozhodovací zároveň.'
                  : 'This is not just a new layout. The whole principle is built so the first interaction feels concrete, human, and decision-ready at the same time.'}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  isCsLike ? 'Reálný problém místo obecného inzerátu' : 'A real problem instead of a generic listing',
                  isCsLike ? 'První tah místo motivačního textu' : 'A first move instead of motivational fluff',
                  isCsLike ? 'Hodnoticí přehled místo poznámkového chaosu' : 'A dossier instead of scattered notes',
                  isCsLike ? 'Silnější výběr ještě před prvním hovorem' : 'A stronger shortlist before the call',
                ].map((item) => (
                  <div key={item} className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="max-w-3xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              {isCsLike ? 'Tohle je moment rozhodnutí' : 'This is the decision moment'}
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">
              {copy.dossierTitle}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              {copy.dossierBody}
            </p>
          </div>

          <div className="mt-8 grid gap-5 xl:grid-cols-[1.12fr_0.88fr]">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-cyan-700">
                    {landingDossierCopy.kicker}
                  </div>
                  <h3 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.04em] text-slate-950">
                    {landingDossierCopy.title}
                  </h3>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                    {landingDossierCopy.summary}
                  </p>
                </div>
                <div className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800">
                  {landingDossierCopy.signalBadge}
                </div>
              </div>

              <div className="mt-6 rounded-[26px] border border-cyan-100 bg-cyan-50/70 px-5 py-5">
                <div className="text-[11px] uppercase tracking-[0.14em] text-cyan-700">
                  {landingDossierCopy.companyProblem}
                </div>
                <div className="mt-2 text-base font-semibold leading-7 text-slate-950">
                  {view.task.coreProblem}
                </div>
              </div>

              <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
                <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                  {landingDossierCopy.candidateMove}
                </div>
                <div className="mt-3 text-lg font-semibold leading-8 text-slate-950">
                  {view.spotlight.candidateMove}
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-[18px] border border-emerald-100 bg-emerald-50 px-4 py-4">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-emerald-700">
                      {landingDossierCopy.businessImpact}
                    </div>
                    <div className="mt-2 text-sm leading-7 text-slate-700">
                      {view.spotlight.businessImpact}
                    </div>
                  </div>
                  <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-4">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                      {landingDossierCopy.nextStep}
                    </div>
                    <div className="mt-2 text-sm leading-7 text-slate-700">
                      {view.spotlight.nextStep}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-[26px] border border-slate-200 bg-white px-5 py-5">
                <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                  {landingDossierCopy.evidenceTitle}
                </div>
                <div className="mt-4 space-y-3">
                  {view.evidenceBlocks.slice(0, 2).map((block) => (
                    <div key={block.title} className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="text-sm font-semibold text-slate-950">{block.title}</div>
                      <div className="mt-2 text-sm leading-7 text-slate-700">{block.body}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                  {isCsLike ? 'Rychlý vizuální otisk kandidáta' : 'Quick visual signal snapshot'}
                </div>
                <div className="mx-auto mt-4 w-full max-w-[300px]">
                  <svg viewBox={`0 0 ${radarChart.size} ${radarChart.size}`} className="h-full w-full overflow-visible">
                    {radarChart.rings.map((ring, index) => (
                      <polygon
                        key={`ring-${index}`}
                        points={ring}
                        fill={index === radarChart.rings.length - 1 ? 'rgba(14,165,233,0.06)' : 'transparent'}
                        stroke="rgba(148,163,184,0.32)"
                        strokeWidth="1"
                      />
                    ))}
                    {radarChart.axes.map((axis) => (
                      <line
                        key={`axis-${axis.card.key}`}
                        x1={radarChart.center}
                        y1={radarChart.center}
                        x2={axis.edge.x}
                        y2={axis.edge.y}
                        stroke="rgba(148,163,184,0.28)"
                        strokeWidth="1"
                      />
                    ))}
                    <polygon
                      points={radarChart.polygon}
                      fill="rgba(14,165,233,0.18)"
                      stroke="rgba(8,145,178,0.95)"
                      strokeWidth="2.5"
                    />
                    {radarChart.axes.map((axis) => {
                      const label = landingDossierCopy.scoreLabels[axis.card.key] || axis.card.label;
                      return (
                        <g key={`label-${axis.card.key}`}>
                          <circle cx={axis.edge.x} cy={axis.edge.y} r="3.5" fill="rgba(8,145,178,0.95)" />
                          <text
                            x={axis.label.x}
                            y={axis.label.y}
                            textAnchor={axis.label.x < radarChart.center - 8 ? 'end' : axis.label.x > radarChart.center + 8 ? 'start' : 'middle'}
                            dominantBaseline="middle"
                            fontSize="10"
                            fill="#475569"
                            style={{ fontWeight: 600 }}
                          >
                            {label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
                <div className="mt-4 text-sm leading-7 text-slate-700">
                  {isCsLike
                    ? 'Jedním pohledem je vidět, že tenhle člověk už teď působí jistě, prakticky a přenositelně do reality týmu.'
                    : 'At a glance, it is clear this person already feels confident, practical, and transferable into the team reality.'}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  <LockKeyhole size={12} />
                  {landingDossierCopy.identityTitle}
                </div>
                <div className="mt-3 text-lg font-semibold text-slate-950">
                  {isCsLike ? 'Firma nejdřív vidí kvalitu, ne jméno' : 'The team sees quality before identity'}
                </div>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  {landingDossierCopy.identityBody}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {view.identity.skills.slice(0, 3).map((skill) => (
                    <span key={skill} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <div className="max-w-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              {isCsLike ? 'Proč to funguje lépe' : 'Why it works better'}
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">
              {copy.compareTitle}
            </h2>
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {compareItems.map((item) => (
              <div key={item.title} className={`rounded-[24px] border p-6 ${item.tone}`}>
                <h3 className="text-xl font-semibold tracking-[-0.03em] text-slate-950">{item.title}</h3>
                <div className="mt-4 space-y-3">
                  {item.points.map((point) => (
                    <div key={point} className="flex items-start gap-3 text-sm leading-7 text-slate-700">
                      <Target size={15} className="mt-1 shrink-0 text-[var(--accent)]" />
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 overflow-hidden rounded-[34px] border border-slate-800 bg-[linear-gradient(180deg,#0f172a_0%,#111827_100%)] px-6 py-8 shadow-[0_34px_90px_-46px_rgba(15,23,42,0.58)] sm:px-8">
          <div className="max-w-3xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
              {isCsLike ? 'Pricing bez chaosu' : 'Pricing without chaos'}
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">
              {copy.pricingTitle}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              {copy.pricingBody}
            </p>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-4">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-[26px] border p-5 shadow-sm ${plan.recommended ? 'border-cyan-300 bg-[linear-gradient(180deg,rgba(14,165,233,0.20)_0%,rgba(8,47,73,0.88)_100%)] shadow-[0_28px_62px_-34px_rgba(8,145,178,0.5)]' : 'border-slate-700 bg-slate-900/88'}`}
              >
                {plan.recommended ? (
                  <div className="absolute -top-3 left-5 rounded-full border border-cyan-300 bg-slate-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                    {isCsLike ? 'Nejčastější volba' : 'Most popular'}
                  </div>
                ) : null}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className={`text-xl font-semibold tracking-[-0.03em] ${plan.recommended ? 'text-white' : 'text-slate-100'}`}>{plan.name}</div>
                    <div className={`mt-1 text-2xl font-black ${plan.recommended ? 'text-white' : 'text-slate-50'}`}>{plan.price}</div>
                  </div>
                  {plan.recommended ? (
                    <div className="rounded-full border border-cyan-200 bg-white/95 px-3 py-1 text-[11px] font-semibold text-cyan-800">
                      {isCsLike ? 'Doporučený plán' : 'Recommended'}
                    </div>
                  ) : null}
                </div>

                <p className={`mt-3 text-sm leading-6 ${plan.recommended ? 'text-cyan-50' : 'text-slate-300'}`}>{plan.bestFor}</p>

                <div className="mt-4 grid gap-2">
                  {[plan.roleOpens, plan.dialogueSlots, plan.recruiterSeats].map((item) => (
                    <div key={item} className={`rounded-[16px] border px-3.5 py-2.5 text-sm font-medium ${plan.recommended ? 'border-cyan-200/30 bg-white/10 text-white' : 'border-slate-700 bg-slate-950/80 text-slate-200'}`}>
                      {item}
                    </div>
                  ))}
                </div>

                <div className={`mt-4 rounded-[18px] border px-4 py-3.5 ${plan.recommended ? 'border-cyan-200/30 bg-white/10' : 'border-slate-700 bg-slate-950/80'}`}>
                  <div className={`text-[11px] uppercase tracking-[0.14em] ${plan.recommended ? 'text-cyan-100/80' : 'text-slate-500'}`}>
                    {isCsLike ? 'Co odemknete' : 'What it unlocks'}
                  </div>
                  <div className={`mt-2 text-sm leading-6 ${plan.recommended ? 'text-white' : 'text-slate-300'}`}>
                    {plan.outcome}
                  </div>
                </div>

                <div className="mt-4 space-y-2.5">
                  {plan.features.slice(0, 3).map((feature) => (
                    <div key={feature} className={`flex items-start gap-2.5 text-sm leading-6 ${plan.recommended ? 'text-cyan-50' : 'text-slate-300'}`}>
                      <CheckCircle2 size={15} className="mt-1 shrink-0 text-emerald-500" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => callRegister(`landing_pricing_${plan.id}`)}
                  className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold ${plan.recommended ? 'bg-white text-slate-950' : 'border border-slate-600 bg-slate-800 text-white'}`}
                >
                  {plan.id === 'free'
                    ? (isCsLike ? 'Vyzkoušet zdarma' : 'Try for free')
                    : (isCsLike ? 'Začít s tímto plánem' : 'Start with this plan')}
                  <ArrowRight size={15} />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-[28px] border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                {isCsLike ? 'Začít je jednodušší, než vypadá' : 'Starting is simpler than it looks'}
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">
                {copy.finalTitle}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-700">
                {copy.finalBody}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => callRegister('landing_final_primary')}
                className="rounded-full bg-slate-950 px-6 py-3.5 text-sm font-semibold text-white"
              >
                {copy.primaryCta}
              </button>
              <button
                type="button"
                onClick={() => callDemo('landing_final_secondary')}
                className="rounded-full border border-slate-200 bg-slate-50 px-6 py-3.5 text-sm font-semibold text-slate-700"
              >
                {copy.secondaryCta}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default CompanyLandingPage;
