import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Brain, CheckCircle2, MessageSquare, Shield, Sparkles, TimerReset } from 'lucide-react';
import BlogSection from './BlogSection';

interface WelcomePageProps {
  compact?: boolean;
  onTryFree?: () => void;
  onBrowseOffers?: () => void;
  onOpenDemo?: () => void;
  totalJobsCount?: number;
  todayNewJobsCount?: number;
  selectedBlogPostSlug: string | null;
  handleBlogPostSelect: (slug: string | null) => void;
}

const WelcomePage: React.FC<WelcomePageProps> = ({
  compact = false,
  onTryFree,
  onBrowseOffers,
  onOpenDemo,
  totalJobsCount = 0,
  todayNewJobsCount = 0,
  selectedBlogPostSlug,
  handleBlogPostSelect
}) => {
  const { i18n } = useTranslation();
  const locale = (i18n.language || 'en').split('-')[0].toLowerCase();
  const isCsLike = locale === 'cs' || locale === 'sk';

  const copy = isCsLike ? {
    badge: 'Reaguj na výzvu a ukaž svůj přístup',
    headline: 'Reaguj na výzvu a ukaž svůj přístup.',
    subheadline: 'Zapoj se do smysluplného dialogu místo střelby naslepo. Firma nejdřív popíše reálnou situaci v týmu a ty ukážeš, jak přemýšlíš.',
    primaryCta: 'Přihlásit se k výzvě',
    secondaryCta: 'Projít nabídky',
    activeRoles: 'Aktivní nabídky',
    freshSignals: 'Nové reakce dnes',
    previewLabel: 'Ukázka prvního kontaktu',
    previewTitle: 'Ne formulář. Ne video. Krátký úvodní dialog.',
    previewLead: 'Nejdřív dostaneš normální popis role a konkrétní výzvu týmu. Pak odpovíš jednoduše a věcně.',
    companyTruthTitle: 'Firma musí říct pravdu',
    candidateTitle: 'Ty pošleš první reakci',
    compareTitle: 'Starý svět vs JobShaman',
    oldWorld: 'Starý svět',
    newWorld: 'JobShaman',
    compareRows: [
      ['CV bez kontextu', 'Digitální první kontakt a konkrétní situace'],
      ['Hromadné odpovědi', 'Omezený počet aktivních slotů'],
      ['Sebeprezentace před kamerou', 'Textová odpověď, audio jen volitelné'],
      ['Čekání bez výsledku', 'Jasný stav a důvod uzavření']
    ],
    principlesTitle: 'Principy, které neporušujeme',
    principles: [
      {
        title: 'AI pomáhá třídit, nerozhoduje',
        body: 'AI pomůže odstranit šum, ale o člověku rozhoduje člověk.'
      },
      {
        title: 'Každý krok musí mít lidský smysl',
        body: 'Nejde o hezká slova, ale o to, jak přemýšlíš nad reálnou situací.'
      },
      {
        title: 'Bez sociálního tlaku',
        body: 'Žádné veřejné počty uchazečů a žádné povinné video.'
      },
      {
        title: 'Omezená kapacita chrání kvalitu',
        body: 'Kandidát i firma mají limit aktivních dialogů, aby měl každý prostor na odpověď.'
      }
    ],
    flowTitle: 'Jak funguje první kontakt',
    flow: [
      '1. Firma zveřejní roli, konkrétní výzvu a odpoví na dvě klíčové otázky.',
      '2. Kandidát hned vidí, co je na roli těžké a co znamená úspěch.',
      '3. Kandidát pošle první reakci textem (audio je volitelné).',
      '4. Obě strany vidí jasný stav: Otevřeno, V review, Ve výběru, Uzavřeno s důvodem.'
    ],
    promiseTitle: 'Tohle není jen další portál s inzeráty.',
    promiseBody: 'První dojem nevzniká pod tlakem, ale v krátkém a smysluplném dialogu mezi tebou a firmou.',
    promiseCta: 'Otevřít první kontakt',
    blogTitle: 'Blog a praktické tipy',
    searchCueTitle: 'Hledání začíná hned pod tímto panelem',
    searchCueBody: 'Vyhledávání, filtry a nabídky jsou hned pod tímto panelem. Tady rychle pochopíš princip a můžeš jít rovnou na věc.',
    privacyTitle: 'Soukromý a klidný první krok',
    privacyBody: 'Žádné veřejné počty uchazečů, žádné povinné video, žádné soutěžení.',
    trustTitle: 'Důvěra a bezpečí',
    trustItems: [
      'Ověřená firma jde v dialogu první',
      'Jasné stavy místo čekání bez odpovědi',
      'AI filtruje šum, ale nerozhoduje za lidi'
    ],
    candidateTrackTitle: 'Pro uchazece',
    candidateTrackItems: [
      'Místo bezhlavého posílání CV reaguješ na konkrétní situaci.',
      'Profil, CV a další materiály zůstávají podpora, ne hlavní filtr.',
      'Každý dialog má jasný stav a kapacitní limit.'
    ],
    employerTrackTitle: 'Pro firmy',
    employerTrackItems: [
      'Roli nejdřív popíšeš jako reálný kontext, ne jen inzerát.',
      'Dostaneš méně, ale kvalitnější reakce.',
      'Platíš za aktivní kapacitu a otevřené role, ne za šum.'
    ],
    instantSteps: [
      'Firma nejdřív ukáže pravdu o roli.',
      'Ty reaguješ na krátkou konkrétní situaci.',
      'Obě strany vidí jasný stav a důvod uzavření.'
    ],
    previewCompanyTab: '1 Firma',
    previewCandidateTab: '2 Kandidát',
    previewCompanyTitle: 'Firma jde první',
    previewCompanyLines: [
      'Co je na téhle roli skutečně těžké?',
      'Jaký typ člověka tady typicky selže?'
    ],
    previewCandidateTitle: 'Ty odpovíš bez zbytečného tlaku',
    previewCandidateLines: [
      'Jak bys řešil tuhle situaci v prvním týdnu?',
      'Text je hlavní. Krátké audio je jen volitelné.'
    ],
    previewFooter: 'Tohle je digitální první kontakt: krátký, soukromý a bez zbytečného tlaku.',
    compactLearnTitle: 'Pochopíš to za minutu',
    compactChallengeBadge: 'Reálná výzva týmu',
    compactChallengeTitle: 'Chaotická komunikace mezi recepcí a housekeepingem',
    compactChallengeMeta: 'ČistáPráce s.r.o. • Praha • Před 2 hodinami • 6 kandidátů',
    compactChallengeBody: 'Náš tým recepce a housekeeping si často předává nepřesné informace. Hledáme člověka, který nastaví jasná pravidla předávání směn, sníží chybovost a udrží plynulý provoz.',
    compactRoleTruthLabel: 'Největší riziko role',
    compactRoleTruth: 'Největší riziko role: nezvládnutá koordinace směn a další zmatky v provozu.',
    compactResponseLabel: 'První odpověď',
    compactResponseHint: 'Napiš první krok, jak ověříš výsledek a co bys řekl týmu.',
    companyTruthQuestions: [
      'Co je na téhle roli skutečně těžké?',
      'Jaký typ člověka tady typicky selže?'
    ],
    candidateResponsePoints: [
      'Jak bys to řešil v prvním týdnu?',
      'Text je hlavní. Audio je volitelné.',
      'Žádná veřejná soutěž, jen jasný stav dialogu.'
    ],
    microScenarioBadge: 'Moment první odpovědi',
    microScenarioTitle: 'První odpověď firmy je důkaz, že to není další černá díra.',
    microScenarioMessages: [
      { speaker: 'Firma', text: 'Co je na téhle roli opravdu těžké?' },
      { speaker: 'Kandidát', text: 'Nejdřív bych zmapoval předávání informací mezi směnami…' },
      { speaker: 'Firma', text: 'Přesně tohle je náš problém. Pojďme to probrat.' }
    ]
  } : {
    badge: 'A calmer way to change jobs',
    headline: 'Replace anonymous CV drops with a short digital first contact.',
    subheadline: 'JobShaman moves first contact into a short async dialogue. The company shows the truth about the role first, and you respond to a concrete situation without video, public pressure, or performance theatre.',
    primaryCta: 'Start a handshake',
    secondaryCta: 'Browse roles',
    activeRoles: 'Active roles',
    freshSignals: 'New handshakes today',
    previewLabel: 'Handshake preview',
    previewTitle: 'Not a form. Not a video. A short contextual dialogue.',
    previewLead: 'The company shows what is actually hard about the role. You respond by showing how you think.',
    companyTruthTitle: 'The company has to go first',
    candidateTitle: 'The candidate responds without performing',
    compareTitle: 'Old world vs JobShaman',
    oldWorld: 'Old world',
    newWorld: 'JobShaman',
    compareRows: [
      ['CVs and keyword screening', 'Digital first contact and real situations'],
      ['Public funnels and social pressure', 'Limited capacity and private dialogue'],
      ['Video and self-presentation', 'Text-first reply, audio optional'],
      ['Ghosting and "seen"', 'Explicit states and closure with a reason']
    ],
    principlesTitle: 'Principles we do not break',
    principles: [
      {
        title: 'AI filters noise, it does not decide',
        body: 'AI summarizes and highlights signal. A human still makes the decision.'
      },
      {
        title: 'Every step must matter to a human',
        body: 'We do not reward ego performance. We look for thinking and reciprocity.'
      },
      {
        title: 'No stress theatre for introverts',
        body: 'No likes, no public applicant counts, no mandatory video.'
      },
      {
        title: 'Capacity limits protect quality',
        body: 'Both sides work with limited active dialogues so each thread gets real attention.'
      }
    ],
    flowTitle: 'How the handshake works',
    flow: [
      '1. The company creates a role as a Role Canvas and answers two uncomfortable but important truth prompts.',
      '2. You see the team context, realistic scenarios, and six-month success definition before you start.',
      '3. A short thread opens and you respond in text or with short optional audio.',
      '4. Both sides always see a real state: Open, In Review, Shortlisted, or Closed with a reason.'
    ],
    promiseTitle: 'This is not a job board.',
    promiseBody: 'It is an async work matchmaking environment where the first impression is built in a structured conversation instead of a stressful funnel.',
    promiseCta: 'Open your first handshake',
    blogTitle: 'Principles and product notes',
    searchCueTitle: 'Search starts right below this panel',
    searchCueBody: 'Search, quick filters, and live roles are the next layer. This intro should add context, not compete with discovery.',
    privacyTitle: 'A private, lower-pressure first step',
    privacyBody: 'No public applicant counts, no mandatory video, no performative competition.',
    trustTitle: 'Trust & safety',
    trustItems: [
      'A verified company goes first in the dialogue',
      'Explicit states instead of ghosting or "seen"',
      'AI filters noise, but humans still decide'
    ],
    candidateTrackTitle: 'For candidates',
    candidateTrackItems: [
      'Respond to a real situation instead of dropping a CV into a funnel.',
      'Profile, CV, and supporting materials stay secondary, not the main gate.',
      'Each thread has a clear state and capacity limit.'
    ],
    employerTrackTitle: 'For employers',
    employerTrackItems: [
      'Define the role as real context, not just a posting.',
      'Get fewer but higher-quality open dialogues.',
      'Pay for active capacity and opened roles, not noise.'
    ],
    instantSteps: [
      'The company shows the truth about the role first.',
      'You respond to one short real situation.',
      'Both sides always see a clear state and closure reason.'
    ],
    previewCompanyTab: '1 Company',
    previewCandidateTab: '2 Candidate',
    previewCompanyTitle: 'The company goes first',
    previewCompanyLines: [
      'What is actually hard about this role?',
      'What kind of person usually fails here?'
    ],
    previewCandidateTitle: 'You respond without performing',
    previewCandidateLines: [
      'How would you handle this in your first week?',
      'Text is primary. Short audio is optional.'
    ],
    previewFooter: 'This is the handshake: a short, private, lower-pressure first contact.',
    compactLearnTitle: 'You should get it in a minute',
    compactChallengeBadge: 'Real team challenge',
    compactChallengeTitle: 'Chaotic communication between reception and housekeeping',
    compactChallengeMeta: 'Private thread, explicit status, no public funnel.',
    compactChallengeBody: 'The team keeps handing over incomplete information and operations slow down. The company wants to see your first step, the trade-off, and how you would verify the direction.',
    compactRoleTruthLabel: 'Role truth',
    compactRoleTruth: 'Main risk: poor shift coordination keeps creating avoidable operational confusion.',
    compactResponseLabel: 'First reply',
    compactResponseHint: 'Briefly describe your first step, the trade-off, and how you would verify the direction.',
    companyTruthQuestions: [
      'What is actually hard about this role?',
      'What kind of person usually fails here?'
    ],
    candidateResponsePoints: [
      'How would you handle X or Y?',
      'Text first. Audio optional. No camera.',
      'One thread. Clear status. No public competition.'
    ],
    microScenarioBadge: 'First response moment',
    microScenarioTitle: 'The first company reply proves this is not another black hole.',
    microScenarioMessages: [
      { speaker: 'Company', text: 'What is actually hard about this role?' },
      { speaker: 'Candidate', text: 'First I would map shift handoff gaps across the teams…' },
      { speaker: 'Company', text: 'That is exactly our issue. Let us continue.' }
    ]
  };
  const [previewStep, setPreviewStep] = useState<'company' | 'candidate'>('company');

  const handlePrimary = () => {
    if (onTryFree) {
      onTryFree();
      return;
    }
    onBrowseOffers?.();
  };

  const handleOpenDemo = () => {
    if (onOpenDemo) {
      onOpenDemo();
      return;
    }
    handlePrimary();
  };

  if (compact) {
    const previewTitle = previewStep === 'company' ? copy.previewCompanyTitle : copy.previewCandidateTitle;
    const previewLines = previewStep === 'company' ? copy.previewCompanyLines : copy.previewCandidateLines;
    const compactPrinciples = [
      isCsLike
        ? ['Skutečná výzva', 'Konkrétní výzva týmu místo obecné inzerce.']
        : ['A real problem', 'The team opens with a concrete challenge instead of a generic posting.'],
      isCsLike
        ? ['Limitovaný počet', 'Omezený počet slotů pro kandidáty i reakce firmy.']
        : ['Limited capacity', 'Both sides work with a fixed number of active threads.'],
      isCsLike
        ? ['Úvodní dialog', 'Odpovědi vedou k lidskému dialogu, ne k algoritmu.']
        : ['Opening dialogue', 'The first reply shows how you think, not how you perform.'],
      isCsLike
        ? ['Člověk dává šanci', 'Rozhodující slovo má člověk, ne počet kliknutí.']
        : ['Human stays in control', 'AI summarizes signal, but people still decide.'],
      isCsLike
        ? ['Konec ghostingu', 'Další aktivní dialog se odemkne až po reakci firmy i kandidáta. Bez reakce se vlákno uzavře.']
        : ['End of ghosting', 'A new active dialogue unlocks only after both company and candidate respond. No response closes the thread.']
    ];
    const compactPromptLabel = isCsLike ? 'Jak bys k tomu přistoupil?' : 'How would you approach it?';
    const compactReactionCta = isCsLike ? 'Reagovat' : 'Open handshake';
    const compactDemoCta = isCsLike ? 'Vyzkoušet demo' : 'Try demo';
    const compactSupportText = isCsLike
      ? 'Reakcí zahájíš dialog s tímto týmem. Podklady zůstávají volitelné. Zbývá ti 22 aktivních slotů z 25.'
      : 'Your reply opens a private dialogue with this team. Supporting documents stay optional and you still have 22 of 25 active slots left.';
    const compactIntroLine = isCsLike
      ? 'Zapojíš se do smysluplného dialogu místo střelby naslepo.'
      : 'Join a meaningful dialogue instead of firing blind applications.';

    return (
      <div className="h-full overflow-y-auto custom-scrollbar rounded-[1.2rem] border border-slate-200/80 dark:border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.10),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.08),_transparent_32%),linear-gradient(180deg,_rgba(255,255,255,0.97)_0%,_rgba(241,245,249,0.98)_100%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.10),_transparent_32%),linear-gradient(180deg,_rgba(2,6,23,0.97)_0%,_rgba(15,23,42,0.98)_100%)] p-4 shadow-[0_18px_40px_-42px_rgba(15,23,42,0.28)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/70 dark:border-sky-700/60 bg-white/80 dark:bg-slate-950/60 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">
              <Sparkles size={12} />
              {copy.badge}
            </div>
            <h2 className="mt-3 text-[2rem] lg:text-[2.4rem] font-black tracking-tight leading-[1.02] text-slate-900 dark:text-white">
              {isCsLike ? 'Reaguj na výzvu a ukaž svůj přístup.' : 'Respond to the problem and show your approach.'}
            </h2>
            <p className="mt-2 text-base text-slate-700 dark:text-slate-300 leading-relaxed">
              {compactIntroLine}
            </p>
          </div>
        </div>

            <div className="mt-4 grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
              <div className="xl:col-span-7 space-y-2.5">
            {compactPrinciples.map(([title, body], index) => (
              <div
                key={title}
                className="flex items-start gap-3 rounded-[1rem] border border-slate-200/85 dark:border-slate-800 bg-white/86 dark:bg-slate-950/46 px-3.5 py-3 shadow-[0_10px_20px_-30px_rgba(15,23,42,0.28)]"
              >
                <div className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-sm">
                  {index + 1}
                </div>
                <div>
                  <div className="text-base font-bold text-slate-900 dark:text-white">{title}</div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{body}</div>
                </div>
              </div>
            ))}

                <div className="rounded-[1rem] border border-slate-200/80 dark:border-slate-800 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(239,246,255,0.9))] dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.9),rgba(12,74,110,0.28))] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {copy.previewLabel}
                  </div>
                  <div className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                    {isCsLike ? 'Kratší, soukromý a lidský první krok.' : 'A shorter, private, human first step.'}
                  </div>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {copy.previewFooter}
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <button
                    onClick={handleOpenDemo}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300/80 dark:border-slate-700 bg-white/75 dark:bg-slate-950/35 px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200"
                  >
                    {compactDemoCta}
                  </button>
                  <button
                    onClick={handlePrimary}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white shadow-[0_16px_28px_-18px_rgba(249,115,22,0.65)] hover:bg-orange-400 transition-colors"
                  >
                    {compactReactionCta}
                    <ArrowRight size={16} />
                  </button>
                </div>
                  </div>
                </div>

                <div className="rounded-xl border border-sky-200/80 dark:border-sky-900/40 bg-sky-50/75 dark:bg-sky-950/15 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-sky-700 dark:text-sky-300">
                    {copy.microScenarioBadge}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                    {copy.microScenarioTitle}
                  </div>
                  <div className="mt-2.5 space-y-2">
                    {copy.microScenarioMessages.map((entry, index) => {
                      const isCandidate = /candidate|kandidát/i.test(entry.speaker);
                      return (
                        <div
                          key={`${entry.speaker}-${index}`}
                          className={`max-w-[95%] rounded-xl border px-2.5 py-2 text-[12px] leading-relaxed ${
                            isCandidate
                              ? 'ml-auto border-sky-200 bg-white text-slate-700 dark:border-sky-900/40 dark:bg-slate-900/75 dark:text-slate-200'
                              : 'border-emerald-200 bg-emerald-50/80 text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/25 dark:text-emerald-100'
                          }`}
                        >
                          <span className="font-semibold">{entry.speaker}: </span>
                          {entry.text}
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              <div className="xl:col-span-5">
                <div className="rounded-[1.05rem] border border-slate-200/85 dark:border-slate-800 bg-white/88 dark:bg-slate-950/48 p-4 shadow-[0_14px_24px_-28px_rgba(15,23,42,0.26)]">
                  <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-200/80 dark:border-orange-900/40 bg-orange-50/90 dark:bg-orange-950/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-orange-700 dark:text-orange-300">
                  <Sparkles size={11} />
                  {copy.compactChallengeBadge}
                </div>
                <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
                  <button
                    type="button"
                    onClick={() => setPreviewStep('company')}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      previewStep === 'company'
                        ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {copy.previewCompanyTab}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewStep('candidate')}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      previewStep === 'candidate'
                        ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {copy.previewCandidateTab}
                  </button>
                </div>
              </div>

              <div className="mt-3 rounded-[1rem] border border-slate-200/80 dark:border-slate-800 bg-[radial-gradient(circle_at_top_right,_rgba(251,146,60,0.12),_transparent_26%),linear-gradient(145deg,rgba(255,255,255,0.97),rgba(239,246,255,0.91))] dark:bg-[radial-gradient(circle_at_top_right,_rgba(251,146,60,0.10),_transparent_26%),linear-gradient(145deg,rgba(15,23,42,0.92),rgba(12,74,110,0.22))] p-4 shadow-[0_14px_22px_-22px_rgba(14,165,233,0.16)]">
                <div className="text-xl font-bold leading-snug text-slate-900 dark:text-white">{copy.compactChallengeTitle}</div>
                <div className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {copy.compactChallengeMeta}
                </div>
                <p className="mt-3 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
                  {copy.compactChallengeBody}
                </p>
                <div className="mt-3 rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/80 dark:bg-amber-950/20 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">
                    {copy.compactRoleTruthLabel}
                  </div>
                  <div className="mt-1 text-sm text-amber-950 dark:text-amber-100 leading-relaxed">
                    {copy.compactRoleTruth}
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-[1rem] border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/40 p-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{copy.compactResponseLabel}</div>
                <div className="mt-1 text-base font-bold text-slate-900 dark:text-white">{previewTitle}</div>
                <div className="mt-2.5 space-y-2">
                  {previewLines.map((line, index) => (
                    <div
                      key={line}
                      className={`max-w-[92%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                        previewStep === 'company'
                          ? index === 0
                            ? 'bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100'
                            : 'bg-amber-100/80 text-amber-950 dark:bg-amber-900/30 dark:text-amber-100'
                          : index === 0
                            ? 'ml-auto bg-sky-50 text-sky-950 dark:bg-sky-950/30 dark:text-sky-100'
                            : 'ml-auto bg-sky-100/80 text-sky-950 dark:bg-sky-900/30 dark:text-sky-100'
                      }`}
                    >
                      {line}
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">{compactPromptLabel}</div>
                <div className="mt-2 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white/80 dark:bg-slate-950/35 px-3 py-3 text-sm text-slate-500 dark:text-slate-400">
                  {copy.compactResponseHint}
                </div>
                <button
                  onClick={handlePrimary}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white shadow-[0_16px_28px_-18px_rgba(249,115,22,0.65)] hover:bg-orange-400 transition-colors"
                >
                  {compactReactionCta}
                </button>
                <button
                  onClick={handleOpenDemo}
                  className="mt-2 inline-flex w-full items-center justify-center rounded-xl border border-slate-300/80 dark:border-slate-700 bg-white/70 dark:bg-slate-950/35 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200"
                >
                  {compactDemoCta}
                </button>
                <div className="mt-2 rounded-[0.9rem] border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-950/25 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {compactSupportText}
                </div>
              </div>

              <div className="mt-2.5 grid grid-cols-1 gap-2">
                <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-2.5">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-900 dark:text-white">
                    <Shield size={14} />
                    {copy.trustTitle}
                  </div>
                  <div className="mt-1.5 grid grid-cols-1 gap-1 text-[11px] text-slate-600 dark:text-slate-300">
                    {copy.trustItems.slice(0, 2).map((item) => (
                      <div key={item} className="flex items-start gap-1.5">
                        <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-[1rem] border border-slate-200/80 dark:border-slate-800 bg-white/72 dark:bg-slate-950/35 p-3.5">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{copy.blogTitle}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">{copy.promiseBody}</p>
            </div>
            <button
              onClick={handlePrimary}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300/80 dark:border-slate-700 bg-white/70 dark:bg-slate-950/40 px-3.5 py-2 text-sm font-semibold"
            >
              {copy.promiseCta}
              <ArrowRight size={16} />
            </button>
          </div>
          <div className="mt-3">
            <BlogSection
              selectedBlogPostSlug={selectedBlogPostSlug}
              setSelectedBlogPostSlug={handleBlogPostSelect}
              showOverview={false}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.14),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_34%),linear-gradient(180deg,_#f8fafc_0%,_#ecfccb_100%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.10),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_34%),linear-gradient(180deg,_#020617_0%,_#082f49_100%)] text-slate-900 dark:text-slate-100">
      <section className="max-w-7xl mx-auto px-4 lg:px-8 pt-10 pb-8 lg:pt-16 lg:pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/70 dark:border-emerald-700/60 bg-white/80 dark:bg-slate-950/60 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300">
              <Sparkles size={14} />
              {copy.badge}
            </div>

            <h1 className="mt-5 max-w-4xl text-4xl md:text-6xl font-black tracking-tight leading-[1.04]">
              {copy.headline}
            </h1>

            <p className="mt-5 max-w-2xl text-lg text-slate-700 dark:text-slate-300 leading-relaxed">
              {copy.subheadline}
            </p>

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handlePrimary}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 dark:bg-white px-7 py-3.5 text-sm font-bold text-white dark:text-slate-950 shadow-xl shadow-slate-900/10"
              >
                {copy.primaryCta}
                <ArrowRight size={18} />
              </button>
              <button
                onClick={() => onBrowseOffers?.()}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300/80 dark:border-slate-700 px-7 py-3.5 text-sm font-semibold bg-white/70 dark:bg-slate-950/40"
              >
                {copy.secondaryCta}
              </button>
              <button
                onClick={handleOpenDemo}
                className="inline-flex items-center justify-center rounded-2xl border border-cyan-300/70 dark:border-cyan-700 bg-cyan-50/85 dark:bg-cyan-950/25 px-7 py-3.5 text-sm font-semibold text-cyan-700 dark:text-cyan-300"
              >
                {isCsLike ? 'Vyzkoušet demo inzerát' : 'Try demo listing'}
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 text-sm">
              {totalJobsCount > 0 && (
                <div className="rounded-full border border-slate-300/80 dark:border-slate-700 bg-white/85 dark:bg-slate-950/60 px-3 py-1.5 font-medium">
                  {copy.activeRoles}: {totalJobsCount}
                </div>
              )}
              {todayNewJobsCount > 0 && (
                <div className="rounded-full border border-sky-300/80 dark:border-sky-700 bg-sky-50/80 dark:bg-sky-950/30 px-3 py-1.5 font-medium text-sky-700 dark:text-sky-300">
                  {copy.freshSignals}: {todayNewJobsCount}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-[2rem] border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-950/70 p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur">
              <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                {copy.previewLabel}
              </div>
              <h2 className="mt-3 text-2xl font-bold">{copy.previewTitle}</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{copy.previewLead}</p>

              <div className="mt-5 grid gap-4">
                <div className="rounded-2xl border border-amber-200/80 dark:border-amber-900/70 bg-amber-50/80 dark:bg-amber-950/20 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
                    <Shield size={16} />
                    {copy.companyTruthTitle}
                  </div>
                  <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                    {copy.companyTruthQuestions.map((question) => (
                      <li key={question}>“{question}”</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-sky-200/80 dark:border-sky-900/70 bg-sky-50/80 dark:bg-sky-950/20 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-sky-800 dark:text-sky-300">
                    <MessageSquare size={16} />
                    {copy.candidateTitle}
                  </div>
                  <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                    {copy.candidateResponsePoints.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 lg:px-8 pb-8">
        <div className="rounded-[2rem] border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-950/60 p-6 lg:p-8 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.4)]">
          <div className="flex items-center gap-3 mb-5">
            <Brain className="text-emerald-600 dark:text-emerald-300" size={20} />
            <h2 className="text-2xl font-bold">{copy.compareTitle}</h2>
          </div>

          <div className="grid grid-cols-[1fr,1fr] gap-3 text-sm">
            <div className="rounded-2xl bg-rose-50/80 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/60 px-4 py-3 font-bold text-rose-700 dark:text-rose-300">
              {copy.oldWorld}
            </div>
            <div className="rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/60 px-4 py-3 font-bold text-emerald-700 dark:text-emerald-300">
              {copy.newWorld}
            </div>
            {copy.compareRows.map(([legacy, next]) => (
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

      <section className="max-w-7xl mx-auto px-4 lg:px-8 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {copy.principles.map((item) => (
            <div key={item.title} className="rounded-[1.6rem] border border-slate-200/80 dark:border-slate-800 bg-white/85 dark:bg-slate-950/55 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <CheckCircle2 className="text-emerald-600 dark:text-emerald-300" size={16} />
                {item.title}
              </div>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 lg:px-8 pb-8">
        <div className="rounded-[2rem] border border-slate-200/80 dark:border-slate-800 bg-slate-950 text-white p-6 lg:p-8 shadow-[0_28px_80px_-40px_rgba(2,132,199,0.45)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-sky-200">
                <TimerReset size={14} />
                {copy.flowTitle}
              </div>
              <div className="mt-4 space-y-3 text-sm text-slate-200">
                {copy.flow.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
            <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
              <h3 className="text-2xl font-bold">{copy.promiseTitle}</h3>
              <p className="mt-3 text-sm text-slate-300 leading-relaxed">{copy.promiseBody}</p>
              <button
                onClick={handlePrimary}
                className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-emerald-400 px-6 py-3 text-sm font-bold text-slate-950"
              >
                {copy.promiseCta}
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 lg:px-8 pb-16">
        <h3 className="text-lg font-semibold mb-4">{copy.blogTitle}</h3>
        <BlogSection
          selectedBlogPostSlug={selectedBlogPostSlug}
          setSelectedBlogPostSlug={handleBlogPostSelect}
          showOverview={false}
        />
      </section>
    </div>
  );
};

export default WelcomePage;
