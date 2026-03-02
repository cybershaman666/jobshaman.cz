import React, { useState, useMemo, useEffect, useRef } from 'react';
import { getDimensionMeta, getBridgePairs, scoreMax, normalizeTo100, describeScore, longNarrative } from './JcfpmReportData';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Users,
  Flame,
  Zap,
  Heart,
  Cpu,
  Target,
  Compass,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Printer,
  Info,
  AlertTriangle,
  MessageCircle,
  Activity,
  CheckCircle2,
  TrendingUp,
  Award,
  Lightbulb,
  MapPin,
  Crosshair,
  Map as MapIcon,
  ShieldCheck,
  Rocket,
  Share2,
  UserPlus,
  FileText,
  BarChart3
} from 'lucide-react';
import { JcfpmSnapshotV1, JcfpmDimensionId, JcfpmAIReport } from '../../types';
import { computeJcfpmTraitsLocal, computeArchetype } from '../../services/jcfpmService';
import { useTranslation } from 'react-i18next';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1 }
};

const DIM_ICONS: Record<string, React.ReactNode> = {
  d1_cognitive: <Brain className="w-5 h-5 text-cyan-500" />,
  d2_social: <Users className="w-5 h-5 text-teal-500" />,
  d3_motivational: <Flame className="w-5 h-5 text-orange-500" />,
  d4_energy: <Zap className="w-5 h-5 text-amber-500" />,
  d5_values: <Heart className="w-5 h-5 text-rose-500" />,
  d6_ai_readiness: <Cpu className="w-5 h-5 text-cyan-600" />,
  d7_cognitive_reflection: <Target className="w-5 h-5 text-cyan-600" />,
  d8_digital_eq: <MessageCircle className="w-5 h-5 text-teal-500" />,
  d9_systems_thinking: <Compass className="w-5 h-5 text-cyan-500" />,
  d10_ambiguity_interpretation: <AlertTriangle className="w-5 h-5 text-amber-500" />,
  d11_problem_decomposition: <Activity className="w-5 h-5 text-teal-500" />,
  d12_moral_compass: <CheckCircle2 className="w-5 h-5 text-slate-700 dark:text-slate-300" />
};

const REPORT_UI_COPY: Record<string, any> = {
  cs: {
    shortSummary: 'Stručné shrnutí',
    detailView: 'Detailní pohled',
    dimensionDefinition: 'Definice dimenze',
    dimensionSubdims: 'Subdimenze',
    percentileLabel: 'percentil',
    bandLabels: { high: 'vysoké', mid: 'střední', low: 'nízké' },
    shareTitle: 'Moje výsledky JCFPM testu',
    shareText: 'Podívejte se na mou analýzu kognitivních, sociálních a technologických dovedností.',
    inviteTitle: 'Pozvánka k JCFPM testu',
    inviteText: 'Zkus si taky JCFPM test a zjisti svůj profil práce v měnícím se prostředí.',
    shareTooltip: 'Odkaz zkopírován!',
    shareButtonTitle: 'Sdílet výsledky',
    inviteButtonTitle: 'Pozvat ostatní',
    exportPdf: 'Export PDF',
    print: 'Tisk',
    reportTitle: 'Career Fit & Potential Report',
    completedLabel: 'Dokončeno',
    archetypeTitle: 'Tvůj Job Shaman Archetyp',
    profileSummary: 'Shrnutí tvého profilu',
    strengths: 'Silné stránky',
    idealEnvironment: 'Ideální prostředí',
    developmentAreas: 'Rozvojové oblasti',
    aiReadinessTitle: 'Technologická adaptabilita',
    nextSteps: 'Další kroky',
    temperamentBigFive: 'Temperament & Big Five (projekce)',
    temperamentTitle: 'Temperament',
    bigFiveNote: 'Projekce vychází z pod-dimenzí JCFPM. Pro klinicky validní Big Five použij samostatný standardizovaný test.',
    temperamentUnavailable: 'Temperament není možné spočítat – chybí data z pod‑dimenzí.',
    dominanceLabel: 'Dominance',
    reactivityLabel: 'Reaktivita',
    topRoles: 'Nejvhodnější role (Kde zazáříš)',
    roleFallback: 'Role se skvěle hodí k tvému kognitivnímu a sociálnímu profilu.',
    radarTitle: 'Radarový profil dovedností',
    radarSubtitle: 'Porovnání základního profilu (modrá) a praktických dovedností (zelená).',
    radarAria: 'Radar dovedností',
    baseProfile: 'Základní profil',
    practicalSkills: 'Praktické dovednosti',
    alignmentTitle: 'Ukazatel souladu',
    alignmentSubtitle: 'Rozdíly mezi tím, jak se hodnotíš a jak jednáš.',
    skillToDevelop: 'Dovednost k rozvoji:',
    detailedAnalysis: 'Detailní analýza dimenzí',
    howToRead: 'Jak číst tyto výsledky?',
    howToReadPercentilesTitle: 'Jak číst percentily',
    howToReadPercentilesBody: 'Percentil ukazuje, jak jste dopadli v porovnání s ostatními uživateli. Např. 80. percentil znamená, že máte v dané dovednosti vyšší skóre než 80 % populace.',
    scoreInterpretationTitle: 'Hodnocení skóre',
    scoreInterpretationBody: 'Dimenze D1–D6 mívají maximální hodnotu 7 (nejde o výkon, ale o preference). Dimenze D7–D12 se měří na škále 0-100 a hodnotí reálné interaktivní dovednosti z ukázkových scénářů JCFPM.',
    bigFiveLabels: ['Otevřenost', 'Svědomitost', 'Extroverze', 'Přívětivost', 'Neuroticismus'],
    temperamentLabels: {
      cholerik: 'Cholerik',
      sangvinik: 'Sangvinik',
      melancholik: 'Melancholik',
      flegmatik: 'Flegmatik',
    },
    temperamentDescriptions: {
      cholerik: 'Cholerik: vysoká dominance a rychlá reakce. Silný tah na branku, potřeba vědomě hlídat tón a trpělivost.',
      sangvinik: 'Sangvinik: vysoká dominance, nižší reaktivita. Přirozený lídr, který drží stabilní tempo i v tlaku.',
      melancholik: 'Melancholik: nižší dominance a vyšší reaktivita. Citlivost na detaily, důraz na kvalitu a hlubší zpracování.',
      flegmatik: 'Flegmatik: nižší dominance i reaktivita. Klid, stabilita, trpělivé dotahování bez výkyvů.',
    },
    strengthHints: {
      d10_ambiguity_interpretation: 'V nejistotě se nezastavíš a umíš rychle najít směr.',
      d12_moral_compass: 'I pod tlakem držíš férovost a důvěryhodné rozhodování.',
      d8_digital_eq: 'V textové komunikaci dobře čteš tón i emoce druhých.',
      d9_systems_thinking: 'Přirozeně vidíš souvislosti a vedlejší dopady rozhodnutí.',
      d11_problem_decomposition: 'Umíš velké zadání rozdělit na srozumitelné a zvládnutelné kroky.',
      d7_cognitive_reflection: 'Nejedeš jen na první dojem, umíš si odpověď ověřit.',
    },
    developmentHints: {
      d1_cognitive: 'Pomůže ti vědomě oddělit fakta, domněnky a závěr před finálním rozhodnutím.',
      d7_cognitive_reflection: 'Před důležitým krokem si dej krátkou kontrolu: „Jaký je důkaz?“',
      d9_systems_thinking: 'Před změnou si napiš, koho ovlivní a co se může stát za 1–3 měsíce.',
      d11_problem_decomposition: 'Používej jednoduchou osnovu: cíl → kroky → rizika → termín.',
      d8_digital_eq: 'U citlivých zpráv ověř porozumění jednou krátkou doplňující otázkou.',
    },
    habitPlans: {
      d1_cognitive: 'Před každým důležitým rozhodnutím sepiš 3 fakta, 1 riziko a 1 alternativu.',
      d7_cognitive_reflection: 'Každý den vyber 1 rozhodnutí a napiš si, proč je správné.',
      d8_digital_eq: 'U dvou zpráv denně vědomě uprav tón tak, aby byl jasný a respektující.',
      d9_systems_thinking: 'Jednou denně zmapuj u změny „co to zlepší“ a „co to může zhoršit“.',
      d11_problem_decomposition: 'Každý větší úkol rozděl do 3–5 malých kroků s termínem.',
      d10_ambiguity_interpretation: 'V nejasné situaci napiš 2 rizika a 2 příležitosti, pak rozhodni.',
    },
    strengthFallback: 'Tato oblast je nyní tvoje silná stránka.',
    developmentFallback: 'Tady máš aktuálně největší prostor pro růst.',
    topStrengthFallback: 'aktuální profil',
    roleUseCaseByDim: {
      d8_digital_eq: 'komunikaci s klienty a zvládání citlivých situací v textu',
      d9_systems_thinking: 'návrhu procesů a hlídání vedlejších dopadů změn',
      d11_problem_decomposition: 'plánování kroků, prioritizaci a dotahování úkolů',
      d7_cognitive_reflection: 'ověřování rozhodnutí a snižování chybných zkratek',
      d10_ambiguity_interpretation: 'rozhodování i ve chvíli, kdy nejsou kompletní data',
      d12_moral_compass: 'udržení důvěry při náročných rozhodnutích pod tlakem',
    },
    roleUseCaseFallback: 'praktickém rozhodování a spolupráci',
    roleAiImpactLabel: 'Dopad automatizace v roli',
    roleRemoteLabel: 'Vhodnost práce na dálku',
    roleReason: (fit: number, firstTitle: string, firstScore: number | null, secondTitle: string, secondScore: number | null, roleUseCase: string, aiImpact?: string, workMode?: string) => {
      const first = `${firstTitle}${firstScore !== null ? ` (${firstScore}/100)` : ''}`;
      const second = secondTitle ? ` a ${secondTitle}${secondScore !== null ? ` (${secondScore}/100)` : ''}` : '';
      const ai = aiImpact ? ` ${aiImpact}` : '';
      const remote = workMode ? ` ${workMode}` : '';
      return `Shoda ${fit} %. Sedí díky silné oblasti ${first}${second}. V této roli to využiješ hlavně při ${roleUseCase}.${ai}${remote}`.trim();
    },
    vsLabel: 'vs',
    gapText: (gap: number) => `rozdíl ${gap} bodů`,
    aiReadinessSummary: (aiReadiness: number, ambiguity: number) =>
      `Technologickou adaptabilitu máš na ${Math.round(aiReadiness)}/100 a práci s nejasností na ${Math.round(ambiguity)}/100. Silné skóre znamená dobrý základ, další posun uděláš pravidelným tréninkem v praxi.`,
    environment: {
      socialHigh: 'Spolupracující tým s pravidelnou zpětnou vazbou a jasnou domluvou.',
      socialLow: 'Klidnější prostředí s delšími bloky na soustředěnou práci.',
      energyHigh: 'Práce s vyšším tempem a různorodými úkoly.',
      energyLow: 'Stabilnější rytmus práce s menším množstvím náhlých změn.',
      aiHigh: 'Prostředí, kde se nové nástroje používají běžně a prakticky.',
      aiLow: 'Prostředí, kde se nové nástroje zavádějí postupně a s podporou.',
    },
    skillToLearnTitleFallback: 'Výkonová dimenze',
    skillToLearnFallback: 'Nebylo možné určit nejslabší výkonovou oblast.',
    skillToLearnTemplate: (title: string, score: number) =>
      `${title}: ${score}/100. Je to aktuálně nejslabší výkonová oblast v tomto běhu testu. Fokus na 2 týdny: 1 konkrétní mikro‑návyk, 2 měřitelné výstupy týdně a krátké vyhodnocení pokroku.`,
    behaviorGapFallback: 'Rozdíl mezi sebehodnocením a výkonem nebylo možné spočítat.',
    behaviorDirection: {
      selfHigher: 'Sebehodnocení je vyšší než výkon.',
      perfHigher: 'Výkon je vyšší než sebehodnocení.',
      aligned: 'Sebehodnocení a výkon jsou vyrovnané.',
    },
    behaviorAction: {
      selfHigher: 'Doporučení: před důležitým rozhodnutím použij krátký kontrolní seznam (kritérium úspěchu + 1 ověření).',
      perfHigher: 'Doporučení: slaď sebehodnocení s praxí a zapisuj si 3 konkrétní situace týdně.',
      aligned: 'Doporučení: drž současný režim a průběžně monitoruj odchylku.',
    },
    weakFragments: ['na základě profilových dimenzí', 'nastav měřitelný návyk', 'baseline', 'fixní limit'],
    radarAxes: ['Logic', 'Sociální', 'Realizace', 'Systémy', 'Etika', 'Nejistota'],
  },
  en: {
    shortSummary: 'Summary',
    detailView: 'Detailed view',
    dimensionDefinition: 'Dimension definition',
    dimensionSubdims: 'Sub-dimensions',
    percentileLabel: 'percentile',
    bandLabels: { high: 'high', mid: 'mid', low: 'low' },
    shareTitle: 'My JCFPM results',
    shareText: 'Take a look at my analysis of cognitive, social, and technology-related strengths.',
    inviteTitle: 'JCFPM test invitation',
    inviteText: 'Try the JCFPM test and see your profile for work in changing environments.',
    shareTooltip: 'Link copied!',
    shareButtonTitle: 'Share results',
    inviteButtonTitle: 'Invite others',
    exportPdf: 'Export PDF',
    print: 'Print',
    reportTitle: 'Career Fit & Potential Report',
    completedLabel: 'Completed',
    archetypeTitle: 'Your Job Shaman Archetype',
    profileSummary: 'Profile summary',
    strengths: 'Strengths',
    idealEnvironment: 'Ideal environment',
    developmentAreas: 'Growth areas',
    aiReadinessTitle: 'Technology adaptability',
    nextSteps: 'Next steps',
    temperamentBigFive: 'Temperament & Big Five (projection)',
    temperamentTitle: 'Temperament',
    bigFiveNote: 'Projection is derived from JCFPM sub-dimensions. For clinically validated Big Five, use a separate standardized test.',
    temperamentUnavailable: 'Temperament cannot be computed — missing sub-dimension data.',
    dominanceLabel: 'Dominance',
    reactivityLabel: 'Reactivity',
    topRoles: 'Best-fit roles (Where you shine)',
    roleFallback: 'This role aligns well with your cognitive and social profile.',
    radarTitle: 'Skills radar profile',
    radarSubtitle: 'Comparison of base profile (blue) and practical skills (green).',
    radarAria: 'Skills radar',
    baseProfile: 'Base profile',
    practicalSkills: 'Practical skills',
    alignmentTitle: 'Alignment indicator',
    alignmentSubtitle: 'Differences between how you rate yourself and how you perform.',
    skillToDevelop: 'Skill to develop:',
    detailedAnalysis: 'Detailed dimension analysis',
    howToRead: 'How to read these results?',
    howToReadPercentilesTitle: 'How to read percentiles',
    howToReadPercentilesBody: 'Percentile shows how you compare to other users. For example, the 80th percentile means your score is higher than 80% of the population.',
    scoreInterpretationTitle: 'Score interpretation',
    scoreInterpretationBody: 'Dimensions D1–D6 have a maximum of 7 (preferences, not performance). Dimensions D7–D12 are on a 0–100 scale and measure interactive skills from JCFPM scenarios.',
    bigFiveLabels: ['Openness', 'Conscientiousness', 'Extraversion', 'Agreeableness', 'Neuroticism'],
    temperamentLabels: {
      cholerik: 'Choleric',
      sangvinik: 'Sanguine',
      melancholik: 'Melancholic',
      flegmatik: 'Phlegmatic',
    },
    temperamentDescriptions: {
      cholerik: 'Choleric: high dominance and fast reactivity. Strong drive; watch tone and patience.',
      sangvinik: 'Sanguine: high dominance, lower reactivity. Natural leader with steady pace under pressure.',
      melancholik: 'Melancholic: lower dominance, higher reactivity. Detail‑sensitive, quality‑focused, deeper processing.',
      flegmatik: 'Phlegmatic: lower dominance and reactivity. Calm, stable, patient follow‑through.',
    },
    strengthHints: {
      d10_ambiguity_interpretation: 'In uncertainty you keep moving and quickly find direction.',
      d12_moral_compass: 'Under pressure you keep fairness and trustworthy decisions.',
      d8_digital_eq: 'In text communication you read tone and emotions well.',
      d9_systems_thinking: 'You naturally see connections and side effects of decisions.',
      d11_problem_decomposition: 'You can break big briefs into clear, manageable steps.',
      d7_cognitive_reflection: 'You don’t run only on first impressions; you verify your answer.',
    },
    developmentHints: {
      d1_cognitive: 'Separate facts, assumptions, and conclusion before the final decision.',
      d7_cognitive_reflection: 'Before an important step, do a quick check: “What is the evidence?”',
      d9_systems_thinking: 'Before a change, write who it affects and what may happen in 1–3 months.',
      d11_problem_decomposition: 'Use a simple outline: goal → steps → risks → deadline.',
      d8_digital_eq: 'For sensitive messages, confirm understanding with one short follow‑up question.',
    },
    habitPlans: {
      d1_cognitive: 'Before each important decision, write 3 facts, 1 risk, and 1 alternative.',
      d7_cognitive_reflection: 'Each day choose one decision and write why it is correct.',
      d8_digital_eq: 'For two messages per day, adjust tone to be clear and respectful.',
      d9_systems_thinking: 'Once a day, map for a change “what it improves” and “what it could worsen”.',
      d11_problem_decomposition: 'Break each larger task into 3–5 small steps with a deadline.',
      d10_ambiguity_interpretation: 'In an unclear situation, list 2 risks and 2 opportunities, then decide.',
    },
    strengthFallback: 'This area is currently a strength.',
    developmentFallback: 'This is currently your biggest growth opportunity.',
    topStrengthFallback: 'current profile',
    roleUseCaseByDim: {
      d8_digital_eq: 'client communication and handling sensitive situations in text',
      d9_systems_thinking: 'process design and monitoring side effects of changes',
      d11_problem_decomposition: 'planning steps, prioritizing, and closing tasks',
      d7_cognitive_reflection: 'decision verification and reducing faulty shortcuts',
      d10_ambiguity_interpretation: 'decisions even when data is incomplete',
      d12_moral_compass: 'maintaining trust under high‑pressure decisions',
    },
    roleUseCaseFallback: 'practical decision‑making and collaboration',
    roleAiImpactLabel: 'Role automation impact',
    roleRemoteLabel: 'Remote suitability',
    roleReason: (fit: number, firstTitle: string, firstScore: number | null, secondTitle: string, secondScore: number | null, roleUseCase: string, aiImpact?: string, workMode?: string) => {
      const first = `${firstTitle}${firstScore !== null ? ` (${firstScore}/100)` : ''}`;
      const second = secondTitle ? ` and ${secondTitle}${secondScore !== null ? ` (${secondScore}/100)` : ''}` : '';
      const ai = aiImpact ? ` ${aiImpact}` : '';
      const remote = workMode ? ` ${workMode}` : '';
      return `Match ${fit}%. Fits due to the strong area ${first}${second}. You will use it mainly in ${roleUseCase}.${ai}${remote}`.trim();
    },
    vsLabel: 'vs',
    gapText: (gap: number) => `gap ${gap} points`,
    aiReadinessSummary: (aiReadiness: number, ambiguity: number) =>
      `Your technology adaptability is ${Math.round(aiReadiness)}/100 and ambiguity handling is ${Math.round(ambiguity)}/100. A strong score means a solid base; you will move further with regular practice.`,
    environment: {
      socialHigh: 'Collaborative team with regular feedback and clear alignment.',
      socialLow: 'Calmer environment with longer focus blocks.',
      energyHigh: 'Work with higher pace and varied tasks.',
      energyLow: 'More stable work rhythm with fewer sudden changes.',
      aiHigh: 'Environment where new tools are used routinely and practically.',
      aiLow: 'Environment where new tools are introduced gradually with support.',
    },
    skillToLearnTitleFallback: 'Performance dimension',
    skillToLearnFallback: 'It was not possible to determine the weakest performance area.',
    skillToLearnTemplate: (title: string, score: number) =>
      `${title}: ${score}/100. This is currently the weakest performance area in this test run. Focus for 2 weeks: 1 concrete micro‑habit, 2 measurable outputs per week, and a short progress review.`,
    behaviorGapFallback: 'The gap between self‑assessment and performance could not be calculated.',
    behaviorDirection: {
      selfHigher: 'Self‑assessment is higher than performance.',
      perfHigher: 'Performance is higher than self‑assessment.',
      aligned: 'Self‑assessment and performance are aligned.',
    },
    behaviorAction: {
      selfHigher: 'Recommendation: before important decisions use a short checklist (success criterion + 1 verification).',
      perfHigher: 'Recommendation: align self‑assessment with practice and log 3 concrete situations per week.',
      aligned: 'Recommendation: keep the current regime and monitor deviation over time.',
    },
    weakFragments: ['based on profile dimensions', 'set a measurable habit', 'baseline', 'fixed limit'],
    radarAxes: ['Logic', 'Social', 'Execution', 'Systems', 'Ethics', 'Ambiguity'],
  },
};

const getReportUiCopy = (locale: string) => REPORT_UI_COPY[locale] || REPORT_UI_COPY.cs;

const buildExtendedDimensionNarrative = (
  locale: string,
  dimension: JcfpmDimensionId,
  normalized: number,
  title: string
): string => {
  const isCs = locale === 'cs';
  const band = normalized >= 70 ? 'high' : normalized >= 45 ? 'mid' : 'low';
  const scenarioByDim: Record<JcfpmDimensionId, { high: string; mid: string; low: string }> = {
    d1_cognitive: {
      high: isCs ? 'V praxi to bývá výhoda u rozhodnutí s více proměnnými (prioritizace, trade-offy, návrh postupu).' : 'In practice this helps with decisions that have many variables (prioritization, trade-offs, process design).',
      mid: isCs ? 'V praxi dobře funguješ tam, kde je potřeba rychle přepínat mezi daty a intuicí.' : 'In practice you perform well where switching between data and intuition is required.',
      low: isCs ? 'V praxi je to silné v rychlých situacích, ale u zásadních rozhodnutí pomůže krátké datové ověření.' : 'In practice this is strong in fast situations, but major decisions benefit from a short data check.',
    },
    d2_social: {
      high: isCs ? 'V praxi se to projeví v facilitaci týmu, vyjednávání a držení společného směru.' : 'In practice this appears in team facilitation, negotiation, and shared direction.',
      mid: isCs ? 'V praxi umíš plynule střídat samostatnou práci a týmovou koordinaci.' : 'In practice you can switch smoothly between solo work and team coordination.',
      low: isCs ? 'V praxi podáš nejlepší výkon při jasném zadání a menším počtu synchronních meetingů.' : 'In practice your best performance appears with clear scope and fewer synchronous meetings.',
    },
    d3_motivational: {
      high: isCs ? 'V praxi tě posouvají projekty s růstem odpovědnosti a viditelným dopadem.' : 'In practice, projects with growing ownership and visible impact move you forward.',
      mid: isCs ? 'V praxi dobře funguje mix autonomie a jasně měřených cílů.' : 'In practice, a mix of autonomy and clear measurable goals works well.',
      low: isCs ? 'V praxi pomáhá transparentní cíl, metrika úspěchu a pravidelný feedback.' : 'In practice, transparent goals, success metrics, and regular feedback help most.',
    },
    d4_energy: {
      high: isCs ? 'V praxi zvládáš intenzivní sprinty; klíčové je plánovat vědomou regeneraci.' : 'In practice you handle intense sprints; planned recovery remains essential.',
      mid: isCs ? 'V praxi držíš stabilní výkon napříč různými režimy práce.' : 'In practice you maintain stable output across different work modes.',
      low: isCs ? 'V praxi tě nejvíc podpoří predikovatelné tempo a chráněné focus bloky.' : 'In practice, predictable pace and protected focus blocks support you most.',
    },
    d5_values: {
      high: isCs ? 'V praxi potřebuješ vidět smysl, etiku a dlouhodobý dopad práce.' : 'In practice you need visible meaning, ethics, and long-term impact.',
      mid: isCs ? 'V praxi se rychle adaptuješ na různé kultury, když jsou role a očekávání jasné.' : 'In practice you adapt quickly to different cultures when roles and expectations are clear.',
      low: isCs ? 'V praxi se opíráš o stabilitu, jistotu a předvídatelné prostředí.' : 'In practice you rely on stability, certainty, and predictable environments.',
    },
    d6_ai_readiness: {
      high: isCs ? 'V praxi máš potenciál být early adopter a zrychlovat práci přes nové nástroje.' : 'In practice you can be an early adopter and accelerate work using new tools.',
      mid: isCs ? 'V praxi funguje postupné zavádění nových nástrojů s jasnými use-cases a pravidly.' : 'In practice, gradual adoption of new tools with clear use-cases and rules works well.',
      low: isCs ? 'V praxi pomůže učit se nové nástroje po malých krocích na konkrétních opakovatelných úkolech.' : 'In practice, learning new tools in small steps on specific repetitive tasks is most effective.',
    },
    d7_cognitive_reflection: {
      high: isCs ? 'V praxi to snižuje riziko chybných zkratek u důležitých rozhodnutí.' : 'In practice this lowers shortcut mistakes in important decisions.',
      mid: isCs ? 'V praxi stačí držet jednoduchý check před finálním rozhodnutím.' : 'In practice, a simple pre-decision check is enough.',
      low: isCs ? 'V praxi pomáhá pravidlo „zastav-se-ověř“ u všech rozhodnutí s vyšším dopadem.' : 'In practice, a “pause-and-verify” rule helps for higher-impact decisions.',
    },
    d8_digital_eq: {
      high: isCs ? 'V praxi je to velká výhoda v asynchronní komunikaci a řešení citlivých témat.' : 'In practice this is a major advantage in async communication and sensitive topics.',
      mid: isCs ? 'V praxi pomáhá průběžně parafrázovat porozumění a potvrdit očekávání.' : 'In practice, paraphrasing and confirming expectations helps.',
      low: isCs ? 'V praxi pomůže standard „kontext → sdělení → další krok“ v důležitých zprávách.' : 'In practice, a “context → message → next step” standard helps in key messages.',
    },
    d9_systems_thinking: {
      high: isCs ? 'V praxi to zvyšuje kvalitu rozhodnutí v komplexních procesech a změnách.' : 'In practice this improves decision quality in complex processes and changes.',
      mid: isCs ? 'V praxi funguje krátká mapa dopadů před větší změnou.' : 'In practice, a short impact map before bigger changes works well.',
      low: isCs ? 'V praxi pomáhá vizualizovat vazby mezi týmy a odhadnout vedlejší efekty.' : 'In practice, visualizing cross-team dependencies helps estimate side effects.',
    },
    d10_ambiguity_interpretation: {
      high: isCs ? 'V praxi se hodíš do prostředí s nejistotou, kde je nutné rychle tvořit směr.' : 'In practice you fit uncertain environments where direction must be created quickly.',
      mid: isCs ? 'V praxi máš dobrý balanc mezi opatrností a průzkumem nových možností.' : 'In practice you keep a strong balance between caution and exploration.',
      low: isCs ? 'V praxi pomáhá řízený experiment s předem daným limitem rizika.' : 'In practice, controlled experiments with predefined risk limits help.',
    },
    d11_problem_decomposition: {
      high: isCs ? 'V praxi umíš převést strategii do akčních kroků a priorit.' : 'In practice you can translate strategy into actionable steps and priorities.',
      mid: isCs ? 'V praxi pomůže držet jednotnou šablonu pro rozpad úkolů napříč týmem.' : 'In practice, using one decomposition template across the team helps.',
      low: isCs ? 'V praxi pomůže „3 kroky + 1 riziko + 1 deadline“ pro každý větší úkol.' : 'In practice, “3 steps + 1 risk + 1 deadline” helps for each larger task.',
    },
    d12_moral_compass: {
      high: isCs ? 'V praxi posiluješ důvěru týmu i stakeholderů při složitých rozhodnutích.' : 'In practice you strengthen team and stakeholder trust in complex decisions.',
      mid: isCs ? 'V praxi funguje explicitně pojmenovat hranice, které se v rozhodnutí nepřekročí.' : 'In practice, explicitly naming non-negotiable boundaries works well.',
      low: isCs ? 'V praxi pomůže předem definovaný etický rámec a transparentní rozhodovací logika.' : 'In practice, a predefined ethical frame and transparent decision logic help.',
    },
  };
  const actionByBand = {
    high: isCs ? `Doporučení: využij sílu „${title}“ jako mentoringový nebo procesní asset pro tým.` : `Recommendation: use “${title}” as a mentoring/process asset for the team.`,
    mid: isCs ? `Doporučení: drž tuto oblast stabilní přes jednoduchý týdenní review rytmus.` : `Recommendation: keep this area stable with a simple weekly review rhythm.`,
    low: isCs ? `Doporučení: nastav na 14 dní jeden konkrétní mikro-návyk a sleduj měřitelný posun.` : `Recommendation: set one concrete micro-habit for 14 days and track measurable progress.`,
  } as const;
  return `${scenarioByDim[dimension]?.[band] || ''} ${actionByBand[band]}`.trim();
};

const DimensionAccordionRow = ({ row, normalized, dimMeta, shortDesc, longDesc, maxItemScore, labels }: any) => {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`jcfpm-avoid-break bg-white dark:bg-slate-900 rounded-xl border shadow-sm transition-all mb-3 print:!border-slate-200 print:!shadow-none print:!ring-0 ${open ? 'border-cyan-300 dark:border-cyan-800 ring-2 ring-cyan-50 dark:ring-cyan-500/10' : 'border-slate-200 dark:border-slate-800 hover:border-cyan-200 dark:hover:border-cyan-900/50'}`}
    >
      <div
        onClick={() => setOpen(!open)}
        className="px-5 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-between print:cursor-default"
      >
        <div className="flex items-center gap-4 w-full sm:w-auto flex-1">
          <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 hidden sm:block shrink-0 print:!block">
            {DIM_ICONS[row.dimension] || <Brain className="w-5 h-5 text-slate-500" />}
          </div>
          <div className="flex-1">
            <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm md:text-base">{dimMeta.title}</div>
            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] sm:text-xs">
              <span className="bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 px-2 py-0.5 rounded font-medium border border-cyan-100 dark:border-cyan-900/30 print:!bg-white print:!text-slate-900 print:!border-slate-300">{row.raw_score} / {maxItemScore}</span>
              <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded font-medium border border-slate-200 dark:border-slate-700 print:!bg-white print:!text-slate-900 print:!border-slate-300">{row.percentile}. {labels.percentileLabel}</span>
              <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500 px-2 py-0.5 rounded uppercase tracking-wider border border-slate-200 dark:border-slate-800 print:!bg-white print:!text-slate-900 print:!border-slate-300">{labels.bandLabels?.[row.percentile_band] || row.percentile_band}</span>
            </div>
          </div>
        </div>
        <div className="w-1/4 px-4 hidden md:block shrink-0 print:!hidden">
          <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-500 rounded-full transition-all duration-1000" style={{ width: `${normalized}%` }} />
          </div>
        </div>
        <div className="text-slate-400 pl-4 sm:border-l border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-end print:hidden">
          {open ? <ChevronUp size={20} className="text-cyan-500" /> : <ChevronDown size={20} />}
        </div>
      </div>
      <div
        className="jcfpm-accordion-content border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 print:!bg-white print:!block print:!opacity-100 print:!h-auto print:!overflow-visible"
        style={{ display: open ? 'block' : undefined }}
      >
        <div className="p-5 text-sm text-slate-700 dark:text-slate-300 space-y-4 print:p-2">
          <div className="flex gap-3 items-start">
            <div className="mt-0.5 shrink-0 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 p-1.5 rounded-md print:hidden"><Info size={16} /></div>
            <p className="leading-relaxed"><span className="font-semibold text-slate-800 dark:text-slate-100 block mb-1">{labels.shortSummary}</span>{shortDesc}</p>
          </div>
          <div className="flex gap-3 items-start">
            <div className="mt-0.5 shrink-0 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 p-1.5 rounded-md print:hidden"><Brain size={16} /></div>
            <p className="leading-relaxed"><span className="font-semibold text-slate-800 dark:text-slate-100 block mb-1">{labels.detailView}</span>{longDesc}</p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-800 text-[13px] text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row gap-4 print:mt-2 print:pt-2">
            <div className="flex-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-0.5 print:text-slate-900">{labels.dimensionDefinition}: </span>{dimMeta.definition}
            </div>
            <div className="flex-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-0.5 print:text-slate-900">{labels.dimensionSubdims}: </span>{dimMeta.subdims}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface Props {
  snapshot: JcfpmSnapshotV1;
  showAdvancedReport?: boolean;
}

const JcfpmReportPanel: React.FC<Props> = ({ snapshot, showAdvancedReport = true }) => {
  const { i18n } = useTranslation();
  const locale = (i18n.language || 'cs').split('-')[0];
  const labels = useMemo(() => getReportUiCopy(locale), [locale]);
  const dimensionMeta = useMemo(() => getDimensionMeta(locale), [locale]);
  const bridgePairs = useMemo(() => getBridgePairs(locale), [locale]);
  const { dimension_scores, fit_scores, ai_report } = snapshot;
  const reportRef = useRef<HTMLDivElement | null>(null);
  const [mergedScores, setMergedScores] = useState(dimension_scores || []);
  const archetype = useMemo(() => computeArchetype(mergedScores), [mergedScores]);
  const [showHowToRead, setShowHowToRead] = useState(false);
  const [shareTooltip, setShareTooltip] = useState(false);

  // Add print-specific style to document head when component mounts
  useEffect(() => {
    const styleId = 'jcfpm-print-fix';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        @media print {
          /* 1. RESET LAYOUT FOR A4 */
          html, body, #root, #__next, .app-container, main, [class*="layout"], [class*="wrapper"], [class*="container"] {
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            position: static !important;
            display: block !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          
          /* 2. HIDE EVERYTHING EXCEPT THE REPORT */
          header, nav, aside, footer, .AppHeader, .sidebar, .sidebar-root, .no-print, [class*="Header"], [class*="Sidebar"], [class*="Nav"] {
            display: none !important;
          }

          /* 3. REPORT CONTAINER TUNING */
          .jcfpm-report-container {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
            overflow: visible !important;
            position: relative !important;
            font-size: 12pt !important;
            color: black !important;
            font-family: 'Inter', 'Fraunces', system-ui, sans-serif !important;
          }

          /* 4. PAGINATION & FLOW CONTROL */
          .jcfpm-report-container > div,
          .jcfpm-report-container section {
            break-inside: auto !important;
            page-break-inside: auto !important;
            margin-bottom: 16pt !important;
          }

          .jcfpm-avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .jcfpm-page-break-before {
            page-break-before: always !important;
            break-before: page !important;
          }

          /* 5. FORCE ACCORDIONS OPEN */
          .jcfpm-accordion-content {
            display: block !important;
            height: auto !important;
            opacity: 1 !important;
            visibility: visible !important;
            overflow: visible !important;
            padding: 10pt !important;
          }

          .print\\:hidden, button, .cursor-pointer svg {
            display: none !important;
          }

          /* 6. TYPOGRAPHY & SPACING FOR PRINT */
          .jcfpm-print-header {
            display: block !important;
            margin-bottom: 14pt !important;
            padding-bottom: 10pt !important;
            border-bottom: 1px solid #e2e8f0 !important;
          }

          .jcfpm-print-header .brand-title {
            font-family: 'Fraunces', 'Inter', system-ui, sans-serif !important;
            letter-spacing: 0.06em !important;
            text-transform: uppercase !important;
            font-size: 9pt !important;
            color: #0891b2 !important;
          }

          .jcfpm-print-header .report-title {
            font-size: 18pt !important;
            font-weight: 700 !important;
            color: #0f172a !important;
          }

          .jcfpm-report-container .p-6 { padding: 12pt !important; }
          .jcfpm-report-container .p-5 { padding: 10pt !important; }
          .jcfpm-report-container .p-4 { padding: 8pt !important; }
          .jcfpm-report-container .mt-8 { margin-top: 12pt !important; }
          .jcfpm-report-container .gap-6 { gap: 12pt !important; }

          h2 { font-size: 18pt !important; margin-bottom: 10pt !important; color: #0891b2 !important; }
          h3 { font-size: 14pt !important; margin-bottom: 8pt !important; }
          p, li { font-size: 11pt !important; line-height: 1.4 !important; }

          .jcfpm-roles-grid {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 10pt !important;
          }

          .jcfpm-report-container .bg-gradient-to-r,
          .jcfpm-report-container .bg-gradient-to-br {
            background: #f8fafc !important;
          }

          .jcfpm-report-container .overflow-hidden {
            overflow: visible !important;
          }

          .jcfpm-report-container .line-clamp-2 {
            -webkit-line-clamp: unset !important;
            display: block !important;
            overflow: visible !important;
          }
          
          .h-2.w-full.bg-slate-100 {
            border: 1px solid #cbd5e1 !important;
            height: 10pt !important;
          }

          /* 7. PAGE SETUP */
          @page {
            margin: 14mm 14mm 16mm 14mm;
            size: A4 portrait;
          }
          
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            transition: none !important;
            animation: none !important;
            transform: none !important;
            filter: none !important;
            backdrop-filter: none !important;
            will-change: auto !important;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const handleShare = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    const shareUrl = window.location.href;
    const shareTitle = labels.shareTitle;
    const shareText = labels.shareText;

    try {
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl
        });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setShareTooltip(true);
      setTimeout(() => setShareTooltip(false), 2000);
    } catch (err) {
      console.error('Failed to share:', err);
    }
  };

  const handleInvite = (e?: React.MouseEvent) => {
    e?.preventDefault();
    const inviteUrl = `${window.location.origin}/jcfpm`;
    if (navigator.share) {
      navigator.share({
        title: labels.inviteTitle,
        text: labels.inviteText,
        url: inviteUrl
      }).catch(() => { });
    } else {
      window.open(inviteUrl, '_blank');
    }
  };

  const uniqueFitScores = useMemo(() => {
    const seen = new Set<string>();
    const items = (fit_scores || []).filter((role) => {
      const titleKey = (role.title || '').toString().trim().toLowerCase();
      const key = titleKey || (role.role_id || '').toString();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return items;
  }, [fit_scores]);

  const completedAt = useMemo(() => new Date(snapshot.completed_at), [snapshot.completed_at]);
  const completedAtLabel = useMemo(() => {
    if (Number.isNaN(completedAt.getTime())) return '';
    return completedAt.toLocaleDateString();
  }, [completedAt]);
  const fileDateStamp = useMemo(() => {
    if (Number.isNaN(completedAt.getTime())) return 'report';
    return completedAt.toISOString().slice(0, 10);
  }, [completedAt]);

  const collectPrintStyles = () => {
    let cssText = '';
    Array.from(document.styleSheets).forEach((sheet) => {
      try {
        const styleSheet = sheet as CSSStyleSheet;
        if (!styleSheet.cssRules) return;
        cssText += Array.from(styleSheet.cssRules).map((rule) => rule.cssText).join('\n');
        cssText += '\n';
      } catch {
        // Ignore cross-origin or inaccessible stylesheets.
      }
    });
    return cssText;
  };

  const sanitizePrintClone = (root: HTMLElement) => {
    root.querySelectorAll<HTMLElement>('*').forEach((el) => {
      el.style.transform = 'none';
      el.style.transition = 'none';
      el.style.animation = 'none';
      if (el.style.opacity === '0') {
        el.style.opacity = '1';
      }
    });
  };

  const openPrintWindow = (title: string) => {
    const reportNode = reportRef.current;
    if (!reportNode) {
      window.print();
      return;
    }
    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) {
      window.print();
      return;
    }

    const styles = collectPrintStyles();
    const clone = reportNode.cloneNode(true) as HTMLElement;
    sanitizePrintClone(clone);

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>${styles}</style>
        </head>
        <body style="background: white; margin: 0; padding: 0;"></body>
      </html>
    `);
    printWindow.document.close();
    printWindow.document.body.appendChild(clone);

    const finalize = () => {
      printWindow.focus();
      printWindow.print();
    };
    const fontsReady = (printWindow.document as any).fonts?.ready;
    if (fontsReady && typeof fontsReady.then === 'function') {
      fontsReady.then(() => setTimeout(finalize, 150));
    } else {
      setTimeout(finalize, 300);
    }
  };

  const extendedDims = useMemo(
    () => new Set<JcfpmDimensionId>([
      'd7_cognitive_reflection',
      'd8_digital_eq',
      'd9_systems_thinking',
      'd10_ambiguity_interpretation',
      'd11_problem_decomposition',
      'd12_moral_compass',
    ]),
    [],
  );

  useEffect(() => {
    if (!dimension_scores && snapshot) {
      setMergedScores(dimension_scores || []);
    }
  }, [dimension_scores, snapshot]);

  const normalizedScoreMap = useMemo(() => {
    const map = new Map<JcfpmDimensionId, number>();
    mergedScores.forEach((row: any) => {
      map.set(row.dimension, Math.max(0, Math.min(100, normalizeTo100(row.dimension, row.raw_score, extendedDims))));
    });
    return map;
  }, [mergedScores, extendedDims]);

  const radarAxes = useMemo(
    () =>
      [
        { standard: 'd1_cognitive' as JcfpmDimensionId, deep: 'd7_cognitive_reflection' as JcfpmDimensionId, label: labels.radarAxes[0] },
        { standard: 'd2_social' as JcfpmDimensionId, deep: 'd8_digital_eq' as JcfpmDimensionId, label: labels.radarAxes[1] },
        { standard: 'd3_motivational' as JcfpmDimensionId, deep: 'd11_problem_decomposition' as JcfpmDimensionId, label: labels.radarAxes[2] },
        { standard: 'd4_energy' as JcfpmDimensionId, deep: 'd9_systems_thinking' as JcfpmDimensionId, label: labels.radarAxes[3] },
        { standard: 'd5_values' as JcfpmDimensionId, deep: 'd12_moral_compass' as JcfpmDimensionId, label: labels.radarAxes[4] },
        { standard: 'd6_ai_readiness' as JcfpmDimensionId, deep: 'd10_ambiguity_interpretation' as JcfpmDimensionId, label: labels.radarAxes[5] },
      ],
    [labels],
  );

  const radarGeometry = useMemo(() => {
    const cx = 150;
    const cy = 150;
    const radius = 112;
    const toPoint = (idx: number, value: number, total: number) => {
      const angle = ((Math.PI * 2) / total) * idx - Math.PI / 2;
      const dist = (Math.max(0, Math.min(100, value)) / 100) * radius;
      return `${cx + Math.cos(angle) * dist},${cy + Math.sin(angle) * dist}`;
    };
    const standardPoints = radarAxes.map((axis, idx) => toPoint(idx, normalizedScoreMap.get(axis.standard) || 0, radarAxes.length)).join(' ');
    const deepPoints = radarAxes.map((axis, idx) => toPoint(idx, normalizedScoreMap.get(axis.deep) || 0, radarAxes.length)).join(' ');
    const axes = radarAxes.map((axis, idx) => {
      const angle = ((Math.PI * 2) / radarAxes.length) * idx - Math.PI / 2;
      const x2 = cx + Math.cos(angle) * radius;
      const y2 = cy + Math.sin(angle) * radius;
      const labelX = cx + Math.cos(angle) * (radius + 20);
      const labelY = cy + Math.sin(angle) * (radius + 20);
      return { ...axis, x2, y2, labelX, labelY };
    });
    return { cx, cy, radius, standardPoints, deepPoints, axes };
  }, [normalizedScoreMap, radarAxes]);

  const alignmentBars = useMemo(() => {
    return bridgePairs
      .map((pair: any) => {
        const selfScore = normalizedScoreMap.get(pair.self as JcfpmDimensionId);
        const perfScore = normalizedScoreMap.get(pair.perf as JcfpmDimensionId);
        if (selfScore == null || perfScore == null) return null;
        const diff = Math.round(perfScore - selfScore);
        const offsetPct = Math.max(-100, Math.min(100, diff));
        return {
          ...pair,
          diff,
          offsetPct,
          status: diff > 10 ? 'hidden_talent' : diff < -10 ? 'overestimation' : 'aligned',
          selfScore: Math.round(selfScore),
          perfScore: Math.round(perfScore),
        };
      })
      .filter(Boolean) as Array<{
        self: JcfpmDimensionId;
        perf: JcfpmDimensionId;
        label: string;
        diff: number;
        offsetPct: number;
        status: 'hidden_talent' | 'overestimation' | 'aligned';
        selfScore: number;
        perfScore: number;
      }>;
  }, [normalizedScoreMap, bridgePairs]);

  const aiReportResolved = useMemo<JcfpmAIReport>(() => {
    const weakFragments = (labels.weakFragments || []) as string[];
    const isWeakText = (value?: string) => {
      const normalized = (value || '').trim().toLowerCase();
      if (!normalized) return true;
      if (normalized.length < 40) return true;
      return weakFragments.some((fragment: string) => normalized.includes(fragment));
    };

    const hasServerReport =
      ai_report &&
      (
        (ai_report.strengths && ai_report.strengths.length > 0) ||
        (ai_report.ideal_environment && ai_report.ideal_environment.length > 0) ||
        (ai_report.top_roles && ai_report.top_roles.length > 0) ||
        (ai_report.development_areas && ai_report.development_areas.length > 0) ||
        (ai_report.next_steps && ai_report.next_steps.length > 0) ||
        Boolean(ai_report.ai_readiness)
      );

    const serverLooksWeak = !ai_report || (
      (ai_report.strengths || []).slice(0, 3).some((item) => isWeakText(item))
      || (ai_report.development_areas || []).slice(0, 2).some((item) => isWeakText(item))
      || (ai_report.next_steps || []).slice(0, 2).some((item) => isWeakText(item))
      || isWeakText(ai_report.ai_readiness || '')
      || (ai_report.top_roles || []).slice(0, 2).some((role) => isWeakText(role?.reason))
    );

    if (hasServerReport && !serverLooksWeak) {
      return ai_report as JcfpmAIReport;
    }

    const ranked = [...mergedScores]
      .map((row) => ({
        ...row,
        normalized: Math.round(normalizeTo100(row.dimension, row.raw_score, extendedDims)),
      }))
      .sort((a, b) => b.normalized - a.normalized);

    const strongest = ranked.slice(0, 3);
    const weakest = [...ranked].reverse().slice(0, 2).reverse();
    const aiReadiness = normalizedScoreMap.get('d6_ai_readiness') || 0;
    const ambiguity = normalizedScoreMap.get('d10_ambiguity_interpretation') || 0;
    const socialScore = normalizedScoreMap.get('d2_social') || 0;
    const energyScore = normalizedScoreMap.get('d4_energy') || 0;

    const strengthHints: Record<string, string> = labels.strengthHints || {};
    const developmentHints: Record<string, string> = labels.developmentHints || {};
    const habitPlans: Record<string, string> = labels.habitPlans || {};

    const strengths = strongest.map((row) => {
      const title = dimensionMeta[row.dimension]?.title || row.dimension;
      const hint = strengthHints[row.dimension] || labels.strengthFallback;
      return `${title} (${row.normalized}/100): ${hint}`;
    });

    const developmentAreas = weakest.map((row) => {
      const title = dimensionMeta[row.dimension]?.title || row.dimension;
      const hint = developmentHints[row.dimension] || labels.developmentFallback;
      return `${title} (${row.normalized}/100): ${hint}`;
    });

    const topStrengthNames = strongest
      .slice(0, 2)
      .map((row) => dimensionMeta[row.dimension]?.title || row.dimension)
      .join(' + ') || labels.topStrengthFallback;
    const roleUseCaseByDim: Record<string, string> = labels.roleUseCaseByDim || {};
    const primaryStrength = strongest[0];
    const secondaryStrength = strongest[1];
    const roleUseCase = roleUseCaseByDim[primaryStrength?.dimension || ''] || labels.roleUseCaseFallback;

    const topRoles = uniqueFitScores.slice(0, 3).map((role) => {
      const fit = Math.round(Number(role.fit_score) || 0);
      const firstStrengthTitle = dimensionMeta[primaryStrength?.dimension || '']?.title || topStrengthNames;
      const firstStrengthScore = primaryStrength?.normalized ?? null;
      const secondStrengthTitle = dimensionMeta[secondaryStrength?.dimension || '']?.title || '';
      const secondStrengthScore = secondaryStrength?.normalized ?? null;
      const aiImpact = role.ai_impact ? `${labels.roleAiImpactLabel}: ${role.ai_impact}.` : '';
      const workMode = role.remote_friendly ? `${labels.roleRemoteLabel}: ${role.remote_friendly}.` : '';
      return {
        title: role.title,
        reason: labels.roleReason(
          fit,
          firstStrengthTitle,
          firstStrengthScore,
          secondStrengthTitle,
          secondStrengthScore,
          roleUseCase,
          aiImpact ? ` ${aiImpact}` : '',
          workMode ? ` ${workMode}` : '',
        ),
      };
    });

    const nextSteps = weakest.map((row, index) => {
      const title = dimensionMeta[row.dimension]?.title || row.dimension;
      const plan = habitPlans[row.dimension] || `Pick a small daily habit for \"${title}\" and review progress after a week.`;
      return locale === 'cs' ? `Týden ${index + 1}: ${plan}` : `Week ${index + 1}: ${plan}`;
    });

    return {
      strengths,
      ideal_environment: [
        socialScore >= 60 ? labels.environment.socialHigh : labels.environment.socialLow,
        energyScore >= 65 ? labels.environment.energyHigh : labels.environment.energyLow,
        aiReadiness >= 60 ? labels.environment.aiHigh : labels.environment.aiLow,
      ],
      top_roles: topRoles,
      development_areas: developmentAreas,
      next_steps: nextSteps,
      ai_readiness: labels.aiReadinessSummary(aiReadiness, ambiguity),
    };
  }, [ai_report, mergedScores, extendedDims, normalizedScoreMap, uniqueFitScores, labels, dimensionMeta, locale]);

  const traits = useMemo(() => {
    if (snapshot.traits) return snapshot.traits;
    return computeJcfpmTraitsLocal(snapshot.dimension_scores || [], snapshot.subdimension_scores || []);
  }, [snapshot]);
  const bigFive = traits?.big_five;
  const temperament = traits?.temperament;

  const buildBridge = () => {
    type BridgePair = { self: JcfpmDimensionId; perf: JcfpmDimensionId; label: string };
    const byDim = new Map(mergedScores.map((row) => [row.dimension, row]));
    const perfDims = bridgePairs
      .map((pair: BridgePair) => ({ pair, row: byDim.get(pair.perf) }))
      .filter((entry) => entry.row);
    const weakestPerf = perfDims
      .map((entry) => ({ ...entry, score: normalizeTo100(entry.pair.perf, entry.row!.raw_score, extendedDims) }))
      .sort((a, b) => a.score - b.score)[0];

    const gaps = bridgePairs
      .map((pair: BridgePair) => {
        const selfRow = byDim.get(pair.self);
        const perfRow = byDim.get(pair.perf);
        if (!selfRow || !perfRow) return null;
        const selfScore = normalizeTo100(pair.self, selfRow.raw_score, extendedDims);
        const perfScore = normalizeTo100(pair.perf, perfRow.raw_score, extendedDims);
        return { pair, selfRow, perfRow, gap: selfScore - perfScore, selfScore, perfScore };
      })
      .filter(Boolean) as Array<{
        pair: { self: JcfpmDimensionId; perf: JcfpmDimensionId; label: string };
        selfRow: any;
        perfRow: any;
        gap: number;
        selfScore: number;
        perfScore: number;
      }>;

    const biggestGap = gaps.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))[0];

    const skillToLearnTitle = weakestPerf
      ? (dimensionMeta[weakestPerf.pair.perf]?.title || weakestPerf.pair.label)
      : labels.skillToLearnTitleFallback;
    const skillToLearnScore = weakestPerf ? Math.round(weakestPerf.score) : null;
    const skillToLearn = weakestPerf
      ? labels.skillToLearnTemplate(skillToLearnTitle, skillToLearnScore || 0)
      : labels.skillToLearnFallback;

    const behaviorToChange = biggestGap
      ? (() => {
        const selfTitle = dimensionMeta[biggestGap.pair.self]?.title || biggestGap.pair.self;
        const perfTitle = dimensionMeta[biggestGap.pair.perf]?.title || biggestGap.pair.perf;
        const selfRounded = Math.round(biggestGap.selfScore);
        const perfRounded = Math.round(biggestGap.perfScore);
        const absGap = Math.round(Math.abs(biggestGap.gap));
        const direction = biggestGap.gap > 0
          ? labels.behaviorDirection.selfHigher
          : biggestGap.gap < 0
            ? labels.behaviorDirection.perfHigher
            : labels.behaviorDirection.aligned;
        const action = biggestGap.gap > 10
          ? labels.behaviorAction.selfHigher
          : biggestGap.gap < -10
            ? labels.behaviorAction.perfHigher
            : labels.behaviorAction.aligned;
        return `${selfTitle} (${selfRounded}/100) ${labels.vsLabel} ${perfTitle} (${perfRounded}/100), ${labels.gapText(absGap)}. ${direction} ${action}`;
      })()
      : labels.behaviorGapFallback;

    return { skillToLearn, behaviorToChange };
  };

  const bridge = buildBridge();
  const topDimensionsBasic = useMemo(() => {
    const scored = [...mergedScores]
      .map((row) => ({
        row,
        normalized: Math.round(normalizeTo100(row.dimension, row.raw_score, extendedDims)),
      }));
    const coreTop = scored
      .filter(({ row }) => ['d1_cognitive', 'd2_social', 'd3_motivational', 'd4_energy', 'd5_values', 'd6_ai_readiness'].includes(row.dimension))
      .sort((a, b) => b.normalized - a.normalized)
      .slice(0, 3);
    const deepTop = scored
      .filter(({ row }) => ['d7_cognitive_reflection', 'd8_digital_eq', 'd9_systems_thinking', 'd10_ambiguity_interpretation', 'd11_problem_decomposition', 'd12_moral_compass'].includes(row.dimension))
      .sort((a, b) => b.normalized - a.normalized)
      .slice(0, 3);
    return [...coreTop, ...deepTop];
  }, [extendedDims, mergedScores]);

  const printReport = () => {
    openPrintWindow(`JCFPM-report-${fileDateStamp}`);
  };

  const exportPdf = () => {
    openPrintWindow(`JCFPM-report-${fileDateStamp}`);
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      ref={reportRef}
      className="max-w-6xl mx-auto space-y-6 pb-24 jcfpm-report-container print:space-y-4 print:pb-0"
    >
      <div className="jcfpm-print-header hidden print:block">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="JobShaman" className="h-10 w-auto object-contain" />
            <div>
              <div className="brand-title">JobShaman</div>
              <div className="report-title">{labels.reportTitle}</div>
            </div>
          </div>
          <div className="text-xs text-slate-500">
            <div>JCFPM v1</div>
            {completedAtLabel && <div>{labels.completedLabel}: {completedAtLabel}</div>}
          </div>
        </div>
      </div>
      {!showAdvancedReport && (
        <motion.div variants={itemVariants} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mt-6">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-slate-800 dark:to-slate-900">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {({ cs: 'Základní výstup (free)', en: 'Basic results (free)', de: 'Basis-Ergebnis (free)', at: 'Basis-Ergebnis (free)', pl: 'Wynik podstawowy (free)', sk: 'Základný výsledok (free)' } as Record<string, string>)[locale] || 'Basic results (free)'}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {({
                cs: 'Rychlý přehled toho nejdůležitějšího. Podrobný rozbor a hlubší interpretace jsou v Premium.',
                en: 'A quick summary of the essentials. The full breakdown and deeper interpretation are available in Premium.',
                de: 'Ein schneller Überblick über das Wichtigste. Die vollständige Auswertung und tiefere Interpretation gibt es in Premium.',
                at: 'Ein schneller Überblick über das Wichtigste. Die vollständige Auswertung und tiefere Interpretation gibt es in Premium.',
                pl: 'Szybki podgląd najważniejszych wyników. Pełny rozkład i głębsza interpretacja są dostępne w Premium.',
                sk: 'Rýchly prehľad najdôležitejších výsledkov. Plný rozbor a hlbšia interpretácia sú dostupné v Premium.',
              } as Record<string, string>)[locale] || 'A quick summary of the essentials. The full breakdown and deeper interpretation are available in Premium.'}
            </p>
          </div>
          <div className="p-6 grid gap-3">
            {topDimensionsBasic.map(({ row, normalized }) => (
              <div key={row.dimension} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {dimensionMeta[row.dimension]?.title || row.dimension}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  {normalized}/100 · {row.percentile}. {labels.percentileLabel}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
      {showAdvancedReport && (
        <>
          {/* 🔮 Archetype Hero Section */}
          <motion.div
            variants={itemVariants}
            className="relative overflow-hidden rounded-[2.5rem] border border-white/20 shadow-2xl bg-white/5 backdrop-blur-xl group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-teal-500/10 opacity-50 group-hover:opacity-70 transition-opacity duration-700" />
            <div className="relative p-8 md:p-12 flex flex-col md:flex-row items-center gap-8 md:gap-12">
              <div className="shrink-0 relative">
                <div className="absolute inset-0 bg-cyan-500/20 blur-3xl rounded-full" />
                <div className="relative w-32 h-32 md:w-40 md:h-40 bg-white/10 backdrop-blur-2xl rounded-[2rem] border border-white/30 flex items-center justify-center shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-500">
                  {React.createElement(
                    (DIM_ICONS as any)[archetype.icon.toLowerCase()] ||
                    (archetype.icon === 'Rocket' ? Rocket :
                      archetype.icon === 'Brain' ? Brain :
                        archetype.icon === 'Target' ? Target :
                          archetype.icon === 'Users' ? Users :
                            archetype.icon === 'Activity' ? Activity :
                              archetype.icon === 'Compass' ? Compass :
                                archetype.icon === 'ShieldCheck' ? ShieldCheck : Rocket),
                    { className: "w-16 h-16 md:w-20 md:h-20 text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]" }
                  )}
                </div>
              </div>
              <div className="flex-1 text-center md:text-left space-y-4">
                <div className="inline-flex px-4 py-1.5 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-bold uppercase tracking-widest animate-pulse">
                  {labels.archetypeTitle}
                </div>
                <h1 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                  {locale === 'en' ? archetype.title_en : archetype.title}
                </h1>
                <p className="text-lg md:text-xl text-white/70 font-medium leading-relaxed max-w-2xl">
                  {locale === 'en' ? archetype.description_en : archetype.description}
                </p>
              </div>
            </div>
          </motion.div>

          {/* 🚀 AI Interpretation Cards */}
          <motion.div variants={itemVariants} className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 shadow-xl overflow-hidden mt-6 print:mt-0 print:border-none print:shadow-none">
            <div className="bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-slate-800 dark:to-slate-850 px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between print:bg-none print:border-b-2 print:border-slate-900">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-600 text-white rounded-lg shadow-sm print:bg-black">
                  <Rocket className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100 print:text-black">{labels.profileSummary}</h2>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <div className="relative">
                  <button
                    type="button"
                    onClick={handleShare}
                    className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                    title={labels.shareButtonTitle}
                  >
                    <Share2 size={16} />
                  </button>
                  {shareTooltip && (
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shadow-lg z-50">
                      {labels.shareTooltip}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleInvite}
                  className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                  title={labels.inviteButtonTitle}
                >
                  <UserPlus size={16} />
                </button>
                <button
                  type="button"
                  onClick={exportPdf}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                >
                  <FileText size={16} /> {labels.exportPdf}
                </button>
                <button
                  type="button"
                  onClick={printReport}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                >
                  <Printer size={16} /> {labels.print}
                </button>
              </div>
            </div>
            <div className="p-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-400 font-semibold mb-3 print:text-black">
                  <Award className="w-5 h-5" /> {labels.strengths}
                </div>
                <ul className="space-y-3">
                  {aiReportResolved.strengths.map((item, idx) => (
                    <li key={`str-${idx}`} className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed flex items-start gap-2 bg-cyan-50/50 dark:bg-cyan-500/5 p-2.5 rounded-lg border border-cyan-100/50 dark:border-cyan-500/10 print:bg-none print:border-none print:p-0">
                      <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5 print:bg-black"></span> {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-semibold mb-3 print:text-black">
                  <MapIcon className="w-5 h-5" /> {labels.idealEnvironment}
                </div>
                <ul className="space-y-3">
                  {aiReportResolved.ideal_environment.map((item, idx) => (
                    <li key={`env-${idx}`} className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed flex items-start gap-2 bg-teal-50/50 dark:bg-teal-500/5 p-2.5 rounded-lg border border-teal-100/50 dark:border-teal-500/10 print:bg-none print:border-none print:p-0">
                      <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 print:bg-black"></span> {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-semibold mb-3 print:text-black">
                  <TrendingUp className="w-5 h-5" /> {labels.developmentAreas}
                </div>
                <ul className="space-y-3">
                  {aiReportResolved.development_areas.map((item, idx) => (
                    <li key={`dev-${idx}`} className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed flex items-start gap-2 bg-rose-50/50 dark:bg-rose-500/5 p-2.5 rounded-lg border border-rose-100/50 dark:border-rose-500/10 print:bg-none print:border-none print:p-0">
                      <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 print:bg-black"></span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-6 flex flex-col md:flex-row gap-6 print:bg-none print:border-none">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-400 font-semibold mb-2 print:text-black">
                  <Lightbulb className="w-5 h-5" /> {labels.aiReadinessTitle}
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed print:text-black">{aiReportResolved.ai_readiness}</p>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-semibold mb-2 print:text-black">
                  <MapPin className="w-5 h-5" /> {labels.nextSteps}
                </div>
                <ul className="space-y-1.5">
                  {aiReportResolved.next_steps.map((item, idx) => (
                    <li key={`next-${idx}`} className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2 print:text-black">
                      <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5 print:text-black" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>

          {(bigFive || temperament) && (
            <motion.div variants={itemVariants} className="mt-8 bg-white/5 backdrop-blur-xl rounded-[2.5rem] border border-white/10 p-8 shadow-2xl jcfpm-avoid-break print:border-slate-300 print:shadow-none text-white">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-lg print:text-black">
                  <BarChart3 className="w-5 h-5 text-cyan-500 print:text-black" />
                  {labels.temperamentBigFive}
                </div>
                {temperament && (
                  <div className="px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide bg-cyan-50 text-cyan-700 border border-cyan-100 print:bg-white print:text-black print:border-slate-300">
                    {labels.temperamentLabels?.[temperament.label] || temperament.label}
                  </div>
                )}
              </div>

              <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-3">
                  {(bigFive ? [
                    { label: labels.bigFiveLabels[0], value: bigFive.openness, color: 'bg-cyan-500' },
                    { label: labels.bigFiveLabels[1], value: bigFive.conscientiousness, color: 'bg-emerald-500' },
                    { label: labels.bigFiveLabels[2], value: bigFive.extraversion, color: 'bg-teal-500' },
                    { label: labels.bigFiveLabels[3], value: bigFive.agreeableness, color: 'bg-sky-500' },
                    { label: labels.bigFiveLabels[4], value: bigFive.neuroticism, color: 'bg-rose-500' },
                  ] : []).map((row) => (
                    <div key={row.label} className="flex items-center gap-3">
                      <div className="w-28 text-xs font-semibold text-slate-600 dark:text-slate-300 print:text-black">{row.label}</div>
                      <div className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200 dark:border-slate-700 print:border-slate-300">
                        <div className={`h-full ${row.color}`} style={{ width: `${Math.round(row.value)}%` }} />
                      </div>
                      <div className="w-10 text-xs font-semibold text-slate-600 dark:text-slate-300 text-right print:text-black">{Math.round(row.value)}</div>
                    </div>
                  ))}
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 print:text-slate-500">
                    {labels.bigFiveNote}
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-700 dark:text-slate-300 print:bg-white print:border-slate-300 print:text-black">
                  <div className="font-semibold text-slate-800 dark:text-slate-100 mb-2 print:text-black">{labels.temperamentTitle}</div>
                  {temperament ? (
                    <div className="space-y-2">
                      <div>
                        {labels.temperamentDescriptions?.[temperament.label] || temperament.label}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 print:text-slate-500">
                        {labels.dominanceLabel}: {Math.round(temperament.dominance)}/100 · {labels.reactivityLabel}: {Math.round(temperament.reactivity)}/100
                      </div>
                    </div>
                  ) : (
                    <div>{labels.temperamentUnavailable}</div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          <motion.div variants={itemVariants} className="mt-8 jcfpm-page-break-before">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2 print:text-black">
              <Briefcase className="w-5 h-5 text-cyan-500 print:text-black" />
              {labels.topRoles}
            </h3>
            <div className="jcfpm-roles-grid grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {uniqueFitScores.slice(0, 6).map((role, idx) => {
                const fitScore = Math.max(0, Math.min(100, Number(role.fit_score) || 0));
                return (
                  <motion.div
                    whileHover={{ y: -8, scale: 1.02 }}
                    key={`${role.title}-${idx}`}
                    className="jcfpm-avoid-break bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 p-6 shadow-xl transition-all flex flex-col h-full print:border-slate-300 print:shadow-none group overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10 h-full flex flex-col">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 line-clamp-2 leading-tight print:text-black">{role.title}</h4>
                        <div className="shrink-0 flex items-center justify-center w-12 h-12 rounded-full border-4 border-cyan-100 dark:border-cyan-900/30 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 font-bold text-sm print:border-slate-200 print:text-black">
                          {fitScore}%
                        </div>
                      </div>

                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mb-4 overflow-hidden print:border print:border-slate-200">
                        <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${fitScore}%` }} />
                      </div>

                      <div className="flex flex-wrap gap-2 mb-4">
                        {role.ai_impact && <span className="bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border border-cyan-100 dark:border-cyan-900/30 print:border-slate-300 print:text-black">AI: {role.ai_impact}</span>}
                        {role.remote_friendly && <span className="bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border border-teal-100 dark:border-teal-900/30 print:border-slate-300 print:text-black">Remote: {role.remote_friendly}</span>}
                      </div>

                      <div className="text-xs text-slate-400 mt-auto pt-3 border-t border-white/5 print:border-slate-200 print:text-black">
                        {aiReportResolved.top_roles.find(tr => tr.title === role.title)?.reason || labels.roleFallback}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>

          {/* 🕸 Radar & Bridge section */}
          <motion.div variants={itemVariants} className="mt-8 grid lg:grid-cols-[1.2fr_1fr] gap-8 print:grid-cols-1 jcfpm-page-break-before">
            <div className="jcfpm-avoid-break bg-white/5 backdrop-blur-xl rounded-[2.5rem] border border-white/10 p-8 shadow-2xl print:border-slate-300 print:shadow-none text-white">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2 print:text-black">
                <Activity className="w-5 h-5 text-cyan-500 print:text-black" />
                {labels.radarTitle}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 print:text-black">{labels.radarSubtitle}</p>

              <div className="flex justify-center items-center py-4">
                <svg viewBox="0 0 300 300" className="w-full max-w-[340px] drop-shadow-sm print:drop-shadow-none" role="img" aria-label={labels.radarAria}>
                  <circle cx={radarGeometry.cx} cy={radarGeometry.cy} r={radarGeometry.radius} fill="none" stroke="currentColor" className="text-slate-200 dark:text-slate-800 print:text-slate-300" strokeWidth="1" />
                  <circle cx={radarGeometry.cx} cy={radarGeometry.cy} r={radarGeometry.radius * 0.66} fill="none" stroke="currentColor" className="text-slate-200 dark:text-slate-800 print:text-slate-200" strokeWidth="1" strokeDasharray="4 4" />
                  <circle cx={radarGeometry.cx} cy={radarGeometry.cy} r={radarGeometry.radius * 0.33} fill="none" stroke="currentColor" className="text-slate-200 dark:text-slate-800 print:text-slate-200" strokeWidth="1" strokeDasharray="4 4" />
                  {radarGeometry.axes.map((axis) => (
                    <g key={axis.label}>
                      <line x1={radarGeometry.cx} y1={radarGeometry.cy} x2={axis.x2} y2={axis.y2} stroke="currentColor" className="text-slate-200 dark:text-slate-700 print:text-slate-300" strokeWidth="1" />
                      <text x={axis.labelX} y={axis.labelY} fill="currentColor" className="text-slate-500 dark:text-slate-400 print:text-slate-900" fontSize="10px" fontWeight="600" textAnchor="middle" transform={`translate(0, 4)`}>{axis.label}</text>
                    </g>
                  ))}
                  <polygon points={radarGeometry.standardPoints} fill="rgba(6, 182, 212, 0.15)" stroke="#0891b2" strokeWidth="2" className="transition-all duration-1000" />
                  <polygon points={radarGeometry.deepPoints} fill="rgba(20, 184, 166, 0.15)" stroke="#0d9488" strokeWidth="2" className="transition-all duration-1000" />
                </svg>
              </div>

              <div className="mt-4 flex justify-center items-center gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 px-3 py-1.5 rounded-full border border-cyan-100 dark:border-cyan-900/30 print:text-black print:border-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 print:bg-black"></span> {labels.baseProfile}
                </span>
                <span className="flex items-center gap-1.5 text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 px-3 py-1.5 rounded-full border border-teal-100 dark:border-teal-900/30 print:text-black print:border-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-500 print:bg-black"></span> {labels.practicalSkills}
                </span>
              </div>
            </div>

            <div className="jcfpm-avoid-break bg-white/5 backdrop-blur-xl rounded-[2.5rem] border border-white/10 p-8 shadow-2xl flex flex-col print:border-slate-300 print:shadow-none print:mt-6 text-white">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2 print:text-black">
                <ShieldCheck className="w-5 h-5 text-cyan-500 print:text-black" />
                {labels.alignmentTitle}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 print:text-black">{labels.alignmentSubtitle}</p>

              <div className="space-y-5 flex-1 p-2">
                {alignmentBars.map((bar) => (
                  <div key={bar.label} className="relative">
                    <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 mb-2 print:text-black">
                      <span>{bar.label}</span>
                      <span className="text-slate-500 dark:text-slate-500">{bar.selfScore} <span className="text-slate-300 dark:text-slate-700 print:text-slate-300">→</span> {bar.perfScore}</span>
                    </div>
                    <div className="relative h-2 rounded-full border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-rose-50 via-slate-100 to-teal-50 dark:from-rose-500/5 dark:via-slate-800 dark:to-teal-500/5 print:from-slate-100 print:to-slate-100">
                      <span className="absolute left-1/2 top-[-4px] bottom-[-4px] w-[1px] bg-slate-300 dark:bg-slate-700 z-10" />
                      <motion.span
                        initial={{ left: '50%' }}
                        animate={{ left: `${50 + bar.offsetPct * 0.45}%` }}
                        transition={{ duration: 1, delay: 0.2 }}
                        className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 shadow-sm z-20 ${bar.status === 'hidden_talent' ? 'bg-teal-500' :
                          bar.status === 'overestimation' ? 'bg-rose-500' : 'bg-cyan-500'
                          } print:border-black`}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 print:border-slate-300">
                <div className="text-sm">
                  <span className="font-semibold text-slate-700 dark:text-slate-200 block mb-1 print:text-black">{labels.skillToDevelop}</span>
                  <span className="text-slate-600 dark:text-slate-400 leading-relaxed text-xs print:text-black">{bridge.skillToLearn}</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 📚 Detailed Analysis Accordion List */}
          <motion.div variants={itemVariants} className="mt-8 jcfpm-page-break-before px-2">
            <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-3 print:text-black">
              <Crosshair className="w-6 h-6 text-cyan-400 print:text-black" />
              {labels.detailedAnalysis}
            </h3>
            <motion.div variants={containerVariants}>
              {mergedScores.map((row) => {
                const maxScore = scoreMax(row.dimension, extendedDims);
                const normalized = normalizeTo100(row.dimension, row.raw_score, extendedDims);
                const dimMeta = dimensionMeta[row.dimension] || { title: row.dimension, definition: '', subdims: '' };
                const shortDesc = describeScore(locale, row.dimension, row.raw_score, row.percentile, extendedDims);
                const longDescBase = longNarrative(locale, row.dimension, row.raw_score, row.percentile, extendedDims);
                const longDescExtension = buildExtendedDimensionNarrative(
                  locale,
                  row.dimension,
                  Math.round(normalizeTo100(row.dimension, row.raw_score, extendedDims)),
                  dimMeta.title
                );
                const longDesc = `${longDescBase} ${longDescExtension}`.trim();

                return (
                  <DimensionAccordionRow
                    key={row.dimension}
                    row={row}
                    normalized={normalized}
                    maxItemScore={maxScore}
                    dimMeta={dimMeta}
                    shortDesc={shortDesc}
                    longDesc={longDesc}
                    labels={labels}
                  />
                )
              })}
            </motion.div>
          </motion.div>

          {/* 💡 How to Read Results Info Box */}
          <motion.div variants={itemVariants} className="mt-6 print:hidden">
            <button onClick={() => setShowHowToRead(!showHowToRead)} className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors bg-white dark:bg-slate-900 px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
              <Info size={16} /> {labels.howToRead} {showHowToRead ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            <AnimatePresence>
              {showHowToRead && (
                <motion.div
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  className="mt-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-5 border border-slate-200 dark:border-slate-800 overflow-hidden"
                >
                  <div className="grid md:grid-cols-2 gap-6 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    <div>
                      <strong className="text-slate-800 dark:text-slate-200 block mb-2">{labels.howToReadPercentilesTitle}</strong>
                      {labels.howToReadPercentilesBody}
                    </div>
                    <div>
                      <strong className="text-slate-800 dark:text-slate-200 block mb-2">{labels.scoreInterpretationTitle}</strong>
                      {labels.scoreInterpretationBody}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}

    </motion.div>
  );
};

export default JcfpmReportPanel;
