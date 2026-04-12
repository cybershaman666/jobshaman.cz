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
          heroTitle: 'Přestaňte číst 300 životopisů. Začněte 5 kvalitních konverzací.',
          heroBody: 'JobShaman nahrazuje hromadné aplikace strukturovaným dialogem. Získejte kandidáty, kteří skutečně přemýšlejí o vašem problému, ne jen optimalizují CV pro ATS.',
          primaryCta: 'Vyzkoušet zdarma na jednu pozici',
          secondaryCta: 'Ukázat mi demo',
          tertiaryCta: 'Přihlásit se',
          heroProofs: [
            'Žádná kreditní karta',
            'Nastavení do 5 minut',
            'První odpovědi do 48 hodin',
          ],
          painTitle: 'Současný nábor je rozbitý. Vy i kandidáti to víte.',
          stepsTitle: 'Nábor založený na signálu, ne na šumu',
          dossierTitle: 'Nejdřív vidíte způsob uvažování. Až potom identitu.',
          dossierBody: 'Místo dalšího slepého callu dostanete odpověď, ze které je okamžitě cítit úsudek, priorita a schopnost řešit vaši realitu. Přesně ten typ signálu, kvůli kterému si řeknete: ano, tohle má smysl posunout dál.',
          compareTitle: 'JobShaman vs. tradiční nábor',
          pricingTitle: 'Jednoduché ceny bez skrytých poplatků',
          pricingBody: 'Vyberete plán podle počtu živých výzev, kandidátů v procesu a lidí v týmu. Žádné překvapení, jen jasná kapacita pro váš nábor.',
          faqTitle: 'Časté otázky',
          finalTitle: 'Přestaňte ztrácet čas čtením CV, která nic neříkají.',
          finalBody: 'Začněte dnes s jednou výzvou zdarma. Rozdíl uvidíte během prvních 48 hodin.',
        }
      : {
          kicker: 'JobShaman for companies',
          heroTitle: 'Stop reading 300 resumes. Start 5 quality conversations.',
          heroBody: 'JobShaman replaces mass applications with structured dialogue. Meet candidates who think about your real problem instead of optimizing a CV for ATS filters.',
          primaryCta: 'Try one role for free',
          secondaryCta: 'Show me the demo',
          tertiaryCta: 'Log in',
          heroProofs: [
            'No credit card',
            'Setup in 5 minutes',
            'First responses within 48 hours',
          ],
          painTitle: 'Hiring is broken. Both sides feel it.',
          stepsTitle: 'Hiring based on signal, not noise',
          dossierTitle: 'See how they think before you see who they are',
          dossierBody: 'Instead of another blind call, you get a response that immediately shows judgment, priorities, and the ability to solve your reality. Exactly the kind of signal that makes a team say: yes, this person is worth moving forward.',
          compareTitle: 'JobShaman vs. traditional hiring',
          pricingTitle: 'Simple pricing with no hidden fees',
          pricingBody: 'Choose the plan by active roles, live candidate capacity, and team seats. No surprises, just a clear hiring operating model.',
          faqTitle: 'Frequently asked questions',
          finalTitle: 'Stop losing time on resumes that do not tell you anything real.',
          finalBody: 'Start today with one challenge for free and see the difference in the first 48 hours.',
        }
  ), [isCsLike]);

  const painPoints = useMemo(() => (
    isCsLike
      ? [
          {
            title: 'Hromadné aplikace zabíjejí signál',
            body: 'AI generuje stovky perfektně vypadajících CV, která projdou ATS, ale neodpovídají realitě. Trávíte hodiny filtrováním lidí, kteří nikdy neměli aplikovat.',
          },
          {
            title: 'Obě strany ztrácejí čas',
            body: 'Kandidáti posílají aplikace do černé díry. Firmy slibují zpětnou vazbu, kterou nikdy nedají. Výsledek je ztráta důvěry i dobrých lidí.',
          },
          {
            title: 'Nábor podle dojmu selhává',
            body: 'Když rozhoduje hlavně CV a vibe, snadno najmete člověka, který vypadá dobře na papíře, ale po pár měsících nesedí do reality role.',
          },
        ]
      : [
          {
            title: 'Mass applications kill signal',
            body: 'AI produces polished resumes that pass ATS filters but do not reflect reality. Your team spends hours sorting people who should never have applied.',
          },
          {
            title: 'Both sides lose time',
            body: 'Candidates send applications into a black hole. Companies promise feedback they never send. The result is lower trust and weaker hiring energy.',
          },
          {
            title: 'Vibe-based hiring fails',
            body: 'When resumes and surface impressions dominate, you can easily hire someone who looks strong on paper but does not fit the actual role after a few months.',
          },
        ]
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
            title: '1. Popište reálný problém',
            body: 'Místo marketingového inzerátu sdílíte konkrétní výzvu, kterou tým opravdu řeší. AI vám pomůže převést existující job description do strukturované výzvy.',
          },
          {
            title: '2. Kandidáti odpovídají dřív, než pošlou CV',
            body: 'Místo dalšího motivačního textu ukážou, jak přemýšlejí nad situací, prioritami a řešením. Žádné šablony, žádné generické AI odpovědi.',
          },
          {
            title: '3. Hodnotíte signál, ne identitu',
            body: 'Nejdřív vidíte odpověď a způsob uvažování. Teprve potom odemykáte dovednosti, kontext a celé CV. Rozhodujete se na základě signálu, ne jména.',
          },
        ]
      : [
          {
            title: '1. Frame the real problem',
            body: 'Instead of another marketing listing, you share one concrete challenge the team is actually solving. AI helps turn an existing job description into a structured prompt.',
          },
          {
            title: '2. Candidates respond before they send a resume',
            body: 'Instead of more application fluff, they show how they think about the situation, trade-offs, and first steps. No templates. No generic AI filler.',
          },
          {
            title: '3. Evaluate signal before identity',
            body: 'You see the response and reasoning first. Skills, context, and the full resume unlock later. The first decision is based on substance, not pedigree.',
          },
        ]
  ), [isCsLike]);

  const benefits = useMemo(() => (
    isCsLike
      ? [
          {
            title: 'Ušetřete čas se screeningem',
            body: 'Místo nekonečného čtení CV procházíte omezený počet strukturovaných odpovědí, které dávají rychle smysl nebo nedávají.',
          },
          {
            title: 'Vyšší kvalita shortlistu',
            body: 'Do pohovoru zvete lidi, u kterých už víte, že umí přemýšlet nad vaší realitou, ne jen napsat správná klíčová slova.',
          },
          {
            title: 'Méně mis-hire rozhodnutí',
            body: 'Dřív odfiltrujete kandidáty, kteří působí silně na papíře, ale nesedí ve způsobu uvažování, prioritách nebo rytmu práce.',
          },
          {
            title: 'Méně biasu bez dalšího procesu',
            body: 'Progressive disclosure schová identitu v první vrstvě a nechá vyniknout odpověď, úsudek a přenositelné dovednosti.',
          },
          {
            title: 'Žádné hromadění mrtvých leadů',
            body: 'Sloty se automaticky uvolňují, takže pipeline nezůstává plná lidí, se kterými se už reálně nic nestane.',
          },
          {
            title: 'Lepší fit do reálného života',
            body: 'Kandidáti se rozhodují s větším kontextem o roli, odměně i očekáváních, takže do procesu jdou relevantnější lidé.',
          },
        ]
      : [
          {
            title: 'Save screening time',
            body: 'Instead of endless resume reading, you review a limited set of structured responses that quickly prove value or filter out noise.',
          },
          {
            title: 'Better shortlist quality',
            body: 'You invite people who already show they can think through your real challenge instead of just matching keywords.',
          },
          {
            title: 'Fewer mis-hires',
            body: 'You catch weak fit much earlier when the reasoning, priorities, or work style do not match the role reality.',
          },
          {
            title: 'Less bias without extra process',
            body: 'Progressive disclosure hides identity in the first layer and lets the response, judgment, and transferable skill signal lead.',
          },
          {
            title: 'No pipeline full of dead leads',
            body: 'Slots release automatically, so your funnel does not stay clogged with candidates who are no longer moving anywhere.',
          },
          {
            title: 'Better real-life fit',
            body: 'Candidates enter with more context about the role, compensation, and expectations, so the process starts with stronger intent.',
          },
        ]
  ), [isCsLike]);

  const slotEconomy = useMemo(() => (
    isCsLike
      ? {
          title: 'Proč omezená kapacita zvyšuje kvalitu',
          candidateTitle: 'Kandidáti mají omezený počet aktivních slotů',
          candidateBody: 'Nemohou aplikovat na všechno. Musí si vybrat role, o které mají skutečný zájem. Každý handshake je promyšlenější a dává větší smysl.',
          companyTitle: 'Firmy mají limitovanou kapacitu na pozici',
          companyBody: 'Nemůžete hromadit stovky aplikací bez odpovědi. Soustředíte se na kvalitu konverzace a rychlost rozhodnutí místo pasivního sběru.',
          resultTitle: 'Výsledek: intencionalita na obou stranách',
          resultBody: 'Tradiční nábor často generuje hromadu práce bez lepšího výsledku. JobShaman tlačí obě strany k jasnější volbě, rychlejším reakcím a lepšímu shortlistu.',
        }
      : {
          title: 'Why limited capacity increases quality',
          candidateTitle: 'Candidates have a limited number of active slots',
          candidateBody: 'They cannot apply everywhere. They choose roles they actually care about. Every handshake carries more intent and better signal.',
          companyTitle: 'Companies have limited capacity per role',
          companyBody: 'You cannot collect hundreds of applications without action. The system pushes focus toward conversation quality and decision speed.',
          resultTitle: 'Result: stronger intent on both sides',
          resultBody: 'Traditional hiring creates a lot of work without a better outcome. JobShaman pushes both sides toward clearer choices, faster action, and a stronger shortlist.',
        }
  ), [isCsLike]);

  const compareItems = useMemo(() => (
    isCsLike
      ? [
          {
            title: 'Tradiční job portály',
            points: [
              'První kontakt stojí na CV a motivačním dopisu.',
              'Počet aplikací je neomezený, takže roste šum i spam.',
              'Bias, ghosting a dlouhé screeningy jsou běžná součást procesu.',
            ],
            tone: 'border-slate-200 bg-white shadow-sm',
          },
          {
            title: 'Nábor přes JobShaman',
            points: [
              'První kontakt je strukturovaná odpověď na reálný problém z role.',
              'Slotová ekonomika tlačí obě strany ke kvalitě místo kvantity.',
              'Hodnotíte způsob uvažování dřív, než odemknete identitu a celé CV.',
            ],
            tone: 'border-slate-200 bg-white shadow-sm',
          },
        ]
      : [
          {
            title: 'Traditional job boards',
            points: [
              'The first contact is resume-first and motivation-letter-first.',
              'Applications are unlimited, so noise and spam scale up fast.',
              'Bias, ghosting, and long screening loops remain normal.',
            ],
            tone: 'border-slate-200 bg-white shadow-sm',
          },
          {
            title: 'Hiring with JobShaman',
            points: [
              'The first contact is a structured response to a real role problem.',
              'Slot economy pushes both sides toward quality instead of volume.',
              'You evaluate reasoning before identity and full resume details.',
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
            name: 'Zdarma',
            price: 'Zdarma',
            bestFor: 'Na první ověření, jestli vám skill-first nábor sedí v praxi.',
            outcome: 'Jedna aktivní výzva bez rizika a bez vstupní investice.',
            roleOpens: '1 aktivní výzva',
            dialogueSlots: '3 kandidáti v procesu',
            recruiterSeats: '1 člen týmu',
            features: ['Vyzkoušení bez rizika', 'První handshake a recruiter readout', 'Vhodné pro pilot na jedné pozici'],
          },
          {
            id: 'starter',
            name: 'Starter',
            price: '249 EUR / měsíc',
            bestFor: 'Pro menší tým, který chce systematicky přejít od CV chaosu k jasnějšímu shortlistu.',
            outcome: 'První opakovatelný hiring workflow pro klíčové role.',
            roleOpens: '3 aktivní výzvy',
            dialogueSlots: '12 kandidátů v procesu',
            recruiterSeats: '2 členové týmu',
            features: ['80 AI screeningů měsíčně', 'Praktická reakce jako první filtr', 'Silnější shortlist bez slepých telefonátů'],
          },
          {
            id: 'growth',
            name: 'Growth',
            price: '599 EUR / měsíc',
            bestFor: 'Pro firmy, které nabírají opakovaně a chtějí jasný systém místo improvizace role po roli.',
            outcome: 'Dost kapacity pro průběžný hiring napříč více pozicemi a hiring manažery.',
            roleOpens: '10 aktivních výzev',
            dialogueSlots: '40 kandidátů v procesu',
            recruiterSeats: '5 členů týmu',
            features: ['250 AI screeningů měsíčně', 'Doporučený plán pro většinu týmů', 'Silná kapacita pro shortlist i follow-up'],
            recommended: true,
          },
          {
            id: 'professional',
            name: 'Professional',
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
            bestFor: 'To validate whether skill-first hiring fits your team before rollout.',
            outcome: 'One active role with low-friction validation.',
            roleOpens: '1 active challenge',
            dialogueSlots: '3 candidates in process',
            recruiterSeats: '1 team member',
            features: ['Try it without risk', 'First handshake and recruiter readout', 'A clean pilot for one role'],
          },
          {
            id: 'starter',
            name: 'Starter',
            price: '249 EUR / month',
            bestFor: 'For smaller teams moving from CV chaos to a clearer shortlist process.',
            outcome: 'The first repeatable workflow for key roles.',
            roleOpens: '3 active challenges',
            dialogueSlots: '12 candidates in process',
            recruiterSeats: '2 team members',
            features: ['80 AI screenings per month', 'Recruiter dossier on every response', 'A stronger shortlist before blind calls'],
          },
          {
            id: 'growth',
            name: 'Growth',
            price: '599 EUR / month',
            bestFor: 'For companies hiring repeatedly and wanting a clear operating system instead of role-by-role improvisation.',
            outcome: 'Enough capacity for repeatable hiring across multiple roles and decision-makers.',
            roleOpens: '10 active challenges',
            dialogueSlots: '40 candidates in process',
            recruiterSeats: '5 team members',
            features: ['250 AI screenings per month', 'Recommended for most teams', 'Strong shortlist and follow-up capacity'],
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

  const testimonials = useMemo(() => (
    isCsLike
      ? [
          {
            quote: 'Dřív jsme strávili skoro dva týdny filtrováním CV. Tady jsme během pár dnů řešili jen odpovědi, které měly skutečný obsah a tah na branku.',
            author: 'Jan K., CTO, SaaS tým',
          },
          {
            quote: 'Největší rozdíl je v tom, že kandidáti rovnou ukážou, jak přemýšlejí. Nemusíme číst další motivační texty plné frází.',
            author: 'Petra M., HR Lead, scale-up',
          },
          {
            quote: 'JobShaman nám pomohl dostat se k lidem, kteří by přes ATS nevypadali dokonale, ale v reálném problému byli silní od první odpovědi.',
            author: 'Tomáš R., Founder, remote-first startup',
          },
        ]
      : [
          {
            quote: 'We used to lose weeks filtering resumes. Here, within days, we were only discussing responses with real substance and decision value.',
            author: 'Jan K., CTO, SaaS team',
          },
          {
            quote: 'The biggest difference is that candidates immediately show how they think. We do not need to read more empty motivation letters.',
            author: 'Petra M., HR Lead, scale-up',
          },
          {
            quote: 'JobShaman helped us reach people who would never look perfect in ATS, but were clearly strong once they responded to a real problem.',
            author: 'Tomáš R., Founder, remote-first startup',
          },
        ]
  ), [isCsLike]);

  const faqs = useMemo(() => (
    isCsLike
      ? [
          {
            question: 'Jak dlouho trvá nastavení první výzvy?',
            answer: 'Obvykle 10 až 15 minut. Můžete začít z vlastní role nebo použít AI převod z existujícího job description.',
          },
          {
            question: 'Co když nedostanu dost odpovědí?',
            answer: 'Pomůžeme vám výzvu přeformulovat tak, aby byla konkrétnější, srozumitelnější a lépe mířila na správný typ kandidáta.',
          },
          {
            question: 'Jak se to liší od LinkedIn nebo Jobs.cz?',
            answer: 'Tyto platformy maximalizují počet aplikací. JobShaman maximalizuje kvalitu prvních konverzací a rychlost shortlistu.',
          },
          {
            question: 'Mohu to používat vedle ATS?',
            answer: 'Ano. Mnoho týmů používá JobShaman pro strategické, seniorní nebo těžko obsaditelné role a ATS pro objemové hiring flow.',
          },
          {
            question: 'Co se stane, když neodpovíme včas?',
            answer: 'Systém připomene další krok a poté slot uvolní, aby pipeline nezůstávala blokovaná a kandidát nečekal donekonečna.',
          },
          {
            question: 'Jak funguje AI screening?',
            answer: 'AI pomáhá strukturovat výzvu, zvýraznit silný signál a podpořit první třídění. Konečné rozhodnutí vždy dělá tým.',
          },
        ]
      : [
          {
            question: 'How long does the first challenge take to set up?',
            answer: 'Usually 10 to 15 minutes. You can start from your own role description or use AI to convert an existing job description.',
          },
          {
            question: 'What if I do not get enough responses?',
            answer: 'We help reframe the challenge so it becomes more concrete, clearer, and better targeted to the right candidates.',
          },
          {
            question: 'How is this different from LinkedIn or job boards?',
            answer: 'Those platforms optimize for application volume. JobShaman optimizes for conversation quality and shortlist speed.',
          },
          {
            question: 'Can I use it alongside an ATS?',
            answer: 'Yes. Many teams use JobShaman for strategic, senior, or harder-to-fill roles while keeping ATS for high-volume hiring.',
          },
          {
            question: 'What happens if we do not respond in time?',
            answer: 'The system reminds your team and then releases the slot so the pipeline does not stay blocked and candidates are not left waiting forever.',
          },
          {
            question: 'How does AI screening work?',
            answer: 'AI helps structure the challenge, highlight stronger signal, and support first-pass sorting. The final decision always stays with the team.',
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
                      {isCsLike ? 'Místo 300 CV jen několik silných konverzací' : 'From 300 resumes to a handful of real conversations'}
                    </div>
                    <div className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
                      {isCsLike ? 'Méně screeningu. Víc jistoty v shortlistu.' : 'Less screening. More confidence in the shortlist.'}
                    </div>
                    <div className="mt-3 text-sm leading-7 text-slate-200">
                      {isCsLike
                        ? 'JobShaman mění první kontakt z pasivního čtení CV na aktivní rozhodnutí podle reálného signálu.'
                        : 'JobShaman turns the first contact from passive resume reading into an active decision based on real signal.'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute -left-3 top-6 hidden max-w-[220px] rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-[0_20px_48px_-32px_rgba(15,23,42,0.35)] md:block">
                <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                  {isCsLike ? 'Tradiční hiring' : 'Traditional hiring'}
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-950">
                  {isCsLike ? 'Hromada CV, hodiny screeningu a nejistota, koho má vůbec smysl oslovit.' : 'A pile of resumes, hours of screening, and no clarity on who is actually worth a call.'}
                </div>
              </div>

              <div className="absolute -right-3 bottom-8 hidden max-w-[240px] rounded-[22px] border border-cyan-200 bg-cyan-50 px-4 py-4 shadow-[0_20px_48px_-32px_rgba(14,116,144,0.35)] md:block">
                <div className="text-[11px] uppercase tracking-[0.14em] text-cyan-700">
                  {isCsLike ? 'JobShaman' : 'JobShaman'}
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-950">
                  {isCsLike ? 'Jen několik odpovědí, které opravdu ukazují úsudek a způsob práce.' : 'Only a few responses, but each one shows judgment and real working style.'}
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-700">
                  {isCsLike ? 'Méně objemu, víc relevance. Přesně proto se zvedá konverze do dalších kroků.' : 'Less volume, more relevance. That is why conversion into the next step improves.'}
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
              {isCsLike ? 'Problém' : 'The pain'}
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">
              {copy.painTitle}
            </h2>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {painPoints.map((item) => (
              <div key={item.title} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-lg font-semibold tracking-[-0.03em] text-slate-950">{item.title}</div>
                <p className="mt-3 text-sm leading-7 text-slate-700">{item.body}</p>
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

        <section className="mt-8">
          <div className="max-w-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              {isCsLike ? 'Benefity' : 'Benefits'}
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">
              {isCsLike ? 'Proč firmy přecházejí na JobShaman' : 'Why companies switch to JobShaman'}
            </h2>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {benefits.map((item) => (
              <div key={item.title} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-base font-semibold tracking-[-0.03em] text-slate-950">{item.title}</div>
                <p className="mt-3 text-sm leading-7 text-slate-700">{item.body}</p>
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
              {isCsLike ? 'Srovnání' : 'Comparison'}
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

        <section className="mt-10 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="max-w-3xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              {isCsLike ? 'Slot economy' : 'Slot economy'}
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">
              {slotEconomy.title}
            </h2>
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <div className="text-lg font-semibold tracking-[-0.03em] text-slate-950">{slotEconomy.candidateTitle}</div>
              <p className="mt-3 text-sm leading-7 text-slate-700">{slotEconomy.candidateBody}</p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <div className="text-lg font-semibold tracking-[-0.03em] text-slate-950">{slotEconomy.companyTitle}</div>
              <p className="mt-3 text-sm leading-7 text-slate-700">{slotEconomy.companyBody}</p>
            </div>
          </div>
          <div className="mt-4 rounded-[24px] border border-cyan-200 bg-cyan-50 p-5">
            <div className="text-lg font-semibold tracking-[-0.03em] text-slate-950">{slotEconomy.resultTitle}</div>
            <p className="mt-3 text-sm leading-7 text-slate-700">{slotEconomy.resultBody}</p>
          </div>
        </section>

        <section className="mt-10 overflow-hidden rounded-[34px] border border-slate-800 bg-[linear-gradient(180deg,#0f172a_0%,#111827_100%)] px-6 py-8 shadow-[0_34px_90px_-46px_rgba(15,23,42,0.58)] sm:px-8">
          <div className="max-w-3xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
              {isCsLike ? 'Ceník' : 'Pricing'}
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

        <section className="mt-10">
          <div className="max-w-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              {isCsLike ? 'Reference' : 'Social proof'}
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">
              {isCsLike ? 'Firmy, které už najímají jinak' : 'Teams already hiring differently'}
            </h2>
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {testimonials.map((item) => (
              <div key={item.author} className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm leading-7 text-slate-700">“{item.quote}”</p>
                <div className="mt-4 text-sm font-semibold text-slate-950">{item.author}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="max-w-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              {isCsLike ? 'FAQ' : 'FAQ'}
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">
              {copy.faqTitle}
            </h2>
          </div>
          <div className="mt-6 grid gap-4">
            {faqs.map((item) => (
              <div key={item.question} className="rounded-[22px] border border-slate-200 bg-slate-50 p-5">
                <div className="text-base font-semibold text-slate-950">{item.question}</div>
                <p className="mt-2 text-sm leading-7 text-slate-700">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-[28px] border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">{isCsLike ? 'Poslední krok' : 'Final CTA'}</div>
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
                {isCsLike ? 'Vytvořit první výzvu zdarma' : 'Create the first challenge for free'}
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
          <div className="mt-5 flex flex-wrap gap-3 text-xs font-medium text-slate-500">
            <span>GDPR compliant</span>
            <span>•</span>
            <span>{isCsLike ? 'Žádná kreditní karta' : 'No credit card'}</span>
            <span>•</span>
            <span>{isCsLike ? 'Podpora v CZ/EN' : 'Support in CZ/EN'}</span>
          </div>
        </section>
      </div>
    </div>
  );
};

export default CompanyLandingPage;
