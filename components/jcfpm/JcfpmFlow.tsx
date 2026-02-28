import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Save, X, Volume2, VolumeX, Sparkles, Clock, GripVertical } from 'lucide-react';
import { Reorder } from 'framer-motion';
import { JcfpmItem, JcfpmSnapshotV1, JcfpmDimensionId } from '../../types';
import { fetchJcfpmItems, submitJcfpm } from '../../services/jcfpmService';
import { clearJcfpmDraft, readJcfpmDraft, writeJcfpmDraft } from '../../services/jcfpmSessionState';
import { useSceneCapability } from '../../hooks/useSceneCapability';
import SceneShell from '../three/SceneShell';
import JcfpmElegantParticles from '../three/JcfpmElegantParticles';
import JcfpmReportPanel from './JcfpmReportPanel';
import { useTranslation } from 'react-i18next';

interface Props {
  initialSnapshot?: JcfpmSnapshotV1 | null;
  mode?: 'form' | 'report';
  section?: 'full' | 'core' | 'deep';
  userId?: string | null;
  isPremium?: boolean;
  onPersist: (snapshot: JcfpmSnapshotV1) => void | Promise<void>;
  onClose: () => void;
}

const DIMENSION_IDS: JcfpmDimensionId[] = [
  'd1_cognitive',
  'd2_social',
  'd3_motivational',
  'd4_energy',
  'd5_values',
  'd6_ai_readiness',
  'd7_cognitive_reflection',
  'd8_digital_eq',
  'd9_systems_thinking',
  'd10_ambiguity_interpretation',
  'd11_problem_decomposition',
  'd12_moral_compass',
];

const FLOW_COPY: Record<string, any> = {
  cs: {
    title: 'Career Fit & Potential',
    reportLabel: 'Report',
    questionProgress: (current: number, total: number, answered: number) => `Otázka ${current} / ${total} • ${answered} zodpovězeno`,
    phaseDeep: 'Deep Dive • Focus Mode',
    phaseStandard: 'Standard Scan',
    likertLow: 'Spíše nesouhlasím',
    likertHigh: 'Spíše souhlasím',
    missingOptions: 'Chybí data pro tuto otázku (options). Prosím zkontroluj seed v `jcfpm_items`.',
    missingOrdering: 'Chybí data pro tuto otázku (ordering). Prosím zkontroluj seed v `jcfpm_items`.',
    missingDragDrop: 'Chybí data pro tuto otázku (drag_drop). Prosím zkontroluj seed v `jcfpm_items`.',
    chatPeer: 'Kolega',
    chatYou: 'Ty',
    chatPrompt: 'Jaká je nejlepší reakce?',
    sourceLabel: 'Zdroj',
    targetLabel: 'Cíl',
    targetPlaceholder: 'Vyber cíl',
    reorderUp: 'Nahoru',
    reorderDown: 'Dolů',
    newDimension: 'Nová dimenze',
    continue: 'Pokračovat',
    timerLabel: 'Tempo',
    timerNote: 'Čas lehce ovlivňuje výsledek – hledej rovnováhu mezi rychlostí a jistotou.',
    legendLikert: '1 = Silně nesouhlasím • 4 = Neutrálně • 7 = Silně souhlasím',
    loadingQuestions: 'Načítám otázky…',
    back: 'Zpět',
    next: 'Další',
    saving: 'Ukládám...',
    finishTest: 'Dokončit test',
    finishSection: 'Dokončit sekci',
    close: 'Zavřít',
    ambientOn: 'Ambient zapnut',
    ambientOff: 'Ambient vypnut',
    soundOn: 'Zvuk zapnut',
    soundOff: 'Zvuk vypnut',
    errors: {
      premium: 'Test je dostupný pouze pro premium uživatele.',
      noAccess: 'Nemáte přístup k premium testu.',
      missingSeed: 'Test zatím není připraven – chybí seed potřebných položek v databázi.',
      missingCount: (count: number) => `Test zatím není připraven – chybí seed ${count} položek v databázi.`,
      generic: 'Nepodařilo se načíst otázky. Zkuste to prosím znovu.',
    },
    dimensions: {
      d1_cognitive: { title: 'Kognitivní styl', subtitle: 'Jak přemýšlíš a jak řešíš problémy.' },
      d2_social: { title: 'Sociální orientace', subtitle: 'Jak funguješ v týmu, komunikaci a leadershipu.' },
      d3_motivational: { title: 'Motivační profil', subtitle: 'Co tě pohání a co považuješ za odměnu.' },
      d4_energy: { title: 'Energetický pattern', subtitle: 'Tempo, intenzita a styl práce.' },
      d5_values: { title: 'Hodnotová kotvení', subtitle: 'Co musí práce přinášet, aby dávala smysl.' },
      d6_ai_readiness: { title: 'Adaptační kapacita (technologie)', subtitle: 'Jak dobře prosperuješ v měnícím se technologickém prostředí.' },
      d7_cognitive_reflection: { title: 'Reflexe a logika', subtitle: 'Schopnost zastavit automatickou odpověď a použít logiku.' },
      d8_digital_eq: { title: 'Digitální EQ', subtitle: 'Empatie a práce s emocemi v asynchronní komunikaci.' },
      d9_systems_thinking: { title: 'Systémové myšlení', subtitle: 'Jak vidíš vztahy, zpětné vazby a komplexní sítě.' },
      d10_ambiguity_interpretation: { title: 'Interpretace nejasností', subtitle: 'Jak čteš nejasné signály a rozlišuješ rizika a příležitosti.' },
      d11_problem_decomposition: { title: 'Rozklad problémů', subtitle: 'Schopnost rozsekat velký úkol na logické kroky.' },
      d12_moral_compass: { title: 'Morální kompas', subtitle: 'Rozhodování v etických dilematech a šedých zónách.' },
    },
    interludes: {
      d1_cognitive: { title: 'Kognitivní styl', body: 'Jak přemýšlíš, filtruješ informace a rozhoduješ se. Půjdeme přímo po tvém vnitřním „procesoru“.' },
      d2_social: { title: 'Sociální orientace', body: 'Kde se cítíš nejlépe mezi lidmi? Zda ti víc sedí spolupráce, vedení, nebo klidná samostatnost.' },
      d3_motivational: { title: 'Motivační profil', body: 'Co tě dlouhodobě žene kupředu a co tě naopak vyčerpává. Teď zachytíme tvé motivátory.' },
      d4_energy: { title: 'Energetický pattern', body: 'Tvé tempo, rytmus a pracovní energie. Najdeme styl, ve kterém umíš podávat nejlepší výkon.' },
      d5_values: { title: 'Hodnotová kotvení', body: 'Kdy práce opravdu dává smysl. Tady mapujeme hodnoty, bez kterých to „nesedí“.' },
      d6_ai_readiness: { title: 'Technologická adaptabilita', body: 'Jak se cítíš v proměnách a nových nástrojích. Závěrečný pohled na adaptabilitu.' },
      d7_cognitive_reflection: { title: 'Cognitive Reflection & Logic', body: 'Tvoje schopnost zastavit automatickou odpověď a zapojit hlubší logiku.' },
      d8_digital_eq: { title: 'Digitální EQ', body: 'Empatie a důvěra v asynchronní komunikaci napříč běžnými pracovními kanály.' },
      d9_systems_thinking: { title: 'Systémové myšlení', body: 'Mapování vztahů, zpětných vazeb a nelineárních dopadů.' },
      d10_ambiguity_interpretation: { title: 'Interpretace ambiguity', body: 'Jak čteš nejasné signály a co v nich vidíš jako první.' },
      d11_problem_decomposition: { title: 'Rozklad problémů', body: 'Schopnost rozsekat velký a vágní úkol na logické kroky.' },
      d12_moral_compass: { title: 'Morální & etický kompas', body: 'Jak se rozhoduješ v etických dilematech, kde není manuál.' },
    },
    stories: {
      d1_cognitive: 'Začneme tím, jak přemýšlíš, třídíš informace a rozhoduješ se.',
      d2_social: 'Teď se podíváme na to, kde se ti nejlépe pracuje s lidmi.',
      d3_motivational: 'Co tě skutečně pohání? Tady zachytíme tvé motivátory.',
      d4_energy: 'V této části mapujeme tvé tempo, rytmus a pracovní energii.',
      d5_values: 'Zachytíme, jaké hodnoty musí práce naplňovat, aby dávala smysl.',
      d6_ai_readiness: 'Na závěr zjistíme, jak se cítíš v technologických a procesních změnách.',
      d7_cognitive_reflection: 'Krátké hádanky prověří tvůj “bullshit detector” a schopnost zpomalit intuici.',
      d8_digital_eq: 'Připrav se na chatové situace a interpretaci tónu v textu.',
      d9_systems_thinking: 'Budeme mapovat vztahy a zpětné vazby v jednoduchých systémech.',
      d10_ambiguity_interpretation: 'V nejasných obrazech odhalíš, zda vidíš spíš rizika nebo příležitosti.',
      d11_problem_decomposition: 'Rozložíš velké úkoly na logické kroky.',
      d12_moral_compass: 'Etická dilemata odhalí tvůj hodnotový kompas.',
    },
  },
  en: {
    title: 'Career Fit & Potential',
    reportLabel: 'Report',
    questionProgress: (current: number, total: number, answered: number) => `Question ${current} / ${total} • ${answered} answered`,
    phaseDeep: 'Deep Dive • Focus Mode',
    phaseStandard: 'Standard Scan',
    likertLow: 'Rather disagree',
    likertHigh: 'Rather agree',
    missingOptions: 'Missing data for this question (options). Please verify the `jcfpm_items` seed.',
    missingOrdering: 'Missing data for this question (ordering). Please verify the `jcfpm_items` seed.',
    missingDragDrop: 'Missing data for this question (drag_drop). Please verify the `jcfpm_items` seed.',
    chatPeer: 'Colleague',
    chatYou: 'You',
    chatPrompt: 'What is the best response?',
    sourceLabel: 'Source',
    targetLabel: 'Target',
    targetPlaceholder: 'Select target',
    reorderUp: 'Up',
    reorderDown: 'Down',
    newDimension: 'New dimension',
    continue: 'Continue',
    timerLabel: 'Pace',
    timerNote: 'Time slightly influences the result — aim for balance between speed and certainty.',
    legendLikert: '1 = Strongly disagree • 4 = Neutral • 7 = Strongly agree',
    loadingQuestions: 'Loading questions…',
    back: 'Back',
    next: 'Next',
    saving: 'Saving...',
    finishTest: 'Finish test',
    finishSection: 'Finish section',
    close: 'Close',
    ambientOn: 'Ambient on',
    ambientOff: 'Ambient off',
    soundOn: 'Sound on',
    soundOff: 'Sound off',
    errors: {
      premium: 'This test is available only for premium users.',
      noAccess: 'You do not have access to the premium test.',
      missingSeed: 'The test is not ready yet — required seed items are missing in the database.',
      missingCount: (count: number) => `The test is not ready yet — ${count} required items are missing in the database.`,
      generic: 'Unable to load questions. Please try again.',
    },
    dimensions: {
      d1_cognitive: { title: 'Cognitive Style', subtitle: 'How you think and solve problems.' },
      d2_social: { title: 'Social Orientation', subtitle: 'How you work with people, communication, and leadership.' },
      d3_motivational: { title: 'Motivational Profile', subtitle: 'What drives you and what feels rewarding.' },
      d4_energy: { title: 'Energy Pattern', subtitle: 'Pace, intensity, and work rhythm.' },
      d5_values: { title: 'Value Anchors', subtitle: 'What work must deliver to feel meaningful.' },
      d6_ai_readiness: { title: 'Adaptive Capacity (Technology)', subtitle: 'How you thrive in changing technology environments.' },
      d7_cognitive_reflection: { title: 'Reflection & Logic', subtitle: 'Ability to pause automatic answers and apply logic.' },
      d8_digital_eq: { title: 'Digital EQ', subtitle: 'Empathy and emotional handling in async communication.' },
      d9_systems_thinking: { title: 'Systems Thinking', subtitle: 'How you see relationships, feedback loops, and complexity.' },
      d10_ambiguity_interpretation: { title: 'Ambiguity Interpretation', subtitle: 'How you read unclear signals and separate risks and opportunities.' },
      d11_problem_decomposition: { title: 'Problem Decomposition', subtitle: 'Ability to break big tasks into logical steps.' },
      d12_moral_compass: { title: 'Moral Compass', subtitle: 'Decisions in ethical dilemmas and grey zones.' },
    },
    interludes: {
      d1_cognitive: { title: 'Cognitive Style', body: 'How you think, filter information, and decide. We will go straight to your internal “processor”.' },
      d2_social: { title: 'Social Orientation', body: 'Where do you feel best among people? Collaboration, leadership, or calm autonomy.' },
      d3_motivational: { title: 'Motivational Profile', body: 'What drives you long-term and what drains you. We will capture your motivators.' },
      d4_energy: { title: 'Energy Pattern', body: 'Your pace, rhythm, and work energy. We will find the style where you deliver best.' },
      d5_values: { title: 'Value Anchors', body: 'When work truly feels meaningful. We map the values you need to feel aligned.' },
      d6_ai_readiness: { title: 'Technology adaptability', body: 'How you feel about change and new tools. A final look at adaptability.' },
      d7_cognitive_reflection: { title: 'Cognitive Reflection & Logic', body: 'Your ability to stop the automatic answer and apply deeper logic.' },
      d8_digital_eq: { title: 'Digital EQ', body: 'Empathy and trust in async communication across common work channels.' },
      d9_systems_thinking: { title: 'Systems Thinking', body: 'Mapping relationships, feedback loops, and non-linear effects.' },
      d10_ambiguity_interpretation: { title: 'Ambiguity Interpretation', body: 'How you read unclear signals and what you notice first.' },
      d11_problem_decomposition: { title: 'Problem Decomposition', body: 'Ability to break a big, vague task into logical steps.' },
      d12_moral_compass: { title: 'Moral & ethical compass', body: 'How you decide in ethical dilemmas without a manual.' },
    },
    stories: {
      d1_cognitive: 'We start with how you think, sort information, and decide.',
      d2_social: 'Now we look at where you work best with people.',
      d3_motivational: 'What truly drives you? We capture your motivators.',
      d4_energy: 'This section maps your pace, rhythm, and work energy.',
      d5_values: 'We capture which values work must fulfill to feel meaningful.',
      d6_ai_readiness: 'Finally, we see how you respond to technology and process change.',
      d7_cognitive_reflection: 'Short puzzles test your “bullshit detector” and ability to slow intuition.',
      d8_digital_eq: 'Get ready for chat scenarios and reading tone in text.',
      d9_systems_thinking: 'We will map relationships and feedback loops in simple systems.',
      d10_ambiguity_interpretation: 'In unclear visuals we see whether you notice risk or opportunity first.',
      d11_problem_decomposition: 'You will break big tasks into logical steps.',
      d12_moral_compass: 'Ethical dilemmas reveal your values compass.',
    },
  },
};

const buildDimensions = (copy: any) =>
  DIMENSION_IDS.map((id) => ({
    id,
    title: copy.dimensions[id]?.title || id,
    subtitle: copy.dimensions[id]?.subtitle || '',
  }));

const buildInterludes = (copy: any) => {
  const result: Record<JcfpmDimensionId, { title: string; body: string }> = {} as any;
  DIMENSION_IDS.forEach((id) => {
    result[id] = {
      title: copy.interludes[id]?.title || copy.dimensions[id]?.title || id,
      body: copy.interludes[id]?.body || '',
    };
  });
  return result;
};

const DEEP_DIVE_DIMENSIONS = new Set<JcfpmDimensionId>([
  'd7_cognitive_reflection',
  'd8_digital_eq',
  'd9_systems_thinking',
  'd10_ambiguity_interpretation',
  'd11_problem_decomposition',
  'd12_moral_compass',
]);

const LIKERT = [1, 2, 3, 4, 5, 6, 7];

const hashSeed = (input: string): number => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const seededShuffle = <T,>(items: T[], seed: string): T[] => {
  const next = [...items];
  let state = hashSeed(seed) || 1;
  const rand = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

const forceNonIdentityOrder = <T,>(items: T[], seed: string): T[] => {
  if (items.length <= 1) return items;
  const shuffled = seededShuffle(items, seed);
  const identical = shuffled.every((item, idx) => item === items[idx]);
  if (!identical) return shuffled;
  return [...items.slice(1), items[0]];
};


const D10_IMAGE_ASSETS = {
  // clearer icons: exclamation, arrow, question mark
  a: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cG9seWdvbiBwb2ludHM9IjUwLDEwIDkwLDkwIDEwLDkwIiBmaWxsPSIjZjg3MTcxIi8+PHRleHQgeD0iNTAiIHk9IjcwIiBmb250LXNpemU9IjUwIiBmaWxsPSIjZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtd2VpZ2h0PSJib2xkIj4hPC90ZXh0Pjwvc3ZnPg==',
  b: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cG9seWdvbiBwb2ludHM9IjUwLDEwIDkwLDgwIDYwLDgwIDYwLDkwIDQwLDkwIDQwLDgwIDEwLDgwIiBmaWxsPSIjNGFkZTgwIi8+PC9zdmc+',
  c: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0NSIgZmlsbD0iIzYwYTVmYSIvPjx0ZXh0IHg9IjUwIiB5PSI2NSIgZm9udC1zaXplPSI2MCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXdlaWdodD0iYm9sZCI+PzwvdGV4dD48L3N2Zz4=',
};

const stripVariantSuffix = (value: string): string => value.trim().replace(/_v\d+$/i, '');
const stripVariantLabelFromPrompt = (value: string): string =>
  value
    .replace(/\s*\((?:varianta|variant)\s*\d+\)\s*$/i, '')
    .trim();

const inferDimensionFromIdentity = (value: unknown): JcfpmDimensionId | undefined => {
  const raw = stripVariantSuffix(String(value || '')).toLowerCase();
  if (raw.startsWith('d1.')) return 'd1_cognitive';
  if (raw.startsWith('d2.')) return 'd2_social';
  if (raw.startsWith('d3.')) return 'd3_motivational';
  if (raw.startsWith('d4.')) return 'd4_energy';
  if (raw.startsWith('d5.')) return 'd5_values';
  if (raw.startsWith('d6.')) return 'd6_ai_readiness';
  if (raw.startsWith('d7.')) return 'd7_cognitive_reflection';
  if (raw.startsWith('d8.')) return 'd8_digital_eq';
  if (raw.startsWith('d9.')) return 'd9_systems_thinking';
  if (raw.startsWith('d10.')) return 'd10_ambiguity_interpretation';
  if (raw.startsWith('d11.')) return 'd11_problem_decomposition';
  if (raw.startsWith('d12.')) return 'd12_moral_compass';
  return undefined;
};

const LOCAL_JCFPM_PAYLOADS: Record<string, any> = {
  'D7.1': {
    options: [
      { id: 'a', label: '5 Kč' },
      { id: 'b', label: '10 Kč' },
      { id: 'c', label: '15 Kč' },
      { id: 'd', label: '20 Kč' },
    ],
    correct_id: 'a',
  },
  'D7.2': {
    options: [
      { id: 'a', label: '100' },
      { id: 'b', label: '500' },
      { id: 'c', label: '2000' },
      { id: 'd', label: '10000' },
    ],
    correct_id: 'c',
  },
  'D7.3': {
    options: [
      { id: 'a', label: 'vyšší' },
      { id: 'b', label: 'nižší' },
      { id: 'c', label: 'stejný' },
      { id: 'd', label: 'nelze určit' },
    ],
    correct_id: 'c',
  },
  'D7.4': {
    options: [
      { id: 'a', label: 'Jediná metrika může klamat, když vstupy nejsou vyvážené' },
      { id: 'b', label: 'Hlavní problém je jen nízká citlivost měření' },
      { id: 'c', label: 'Vstupní data jsou vždy spolehlivá' },
      { id: 'd', label: 'Výsledek je bez chyb' },
    ],
    correct_id: 'a',
  },
  'D7.5': {
    options: [
      { id: 'a', label: 'Po změně logo stouply prodeje, logo tedy způsobilo růst.' },
      { id: 'b', label: 'Pokud prší, je mokro. Prší, takže je mokro.' },
      { id: 'c', label: 'Všichni, koho znám, to dělají, takže je to správné.' },
      { id: 'd', label: 'Pokud A, tak B. Neplatí B, takže neplatí A.' },
    ],
    correct_id: 'a',
  },
  'D7.6': {
    options: [
      { id: 'a', label: 'A musí být pravdivé' },
      { id: 'b', label: 'A může, ale nemusí být pravdivé' },
      { id: 'c', label: 'A je určitě nepravdivé' },
      { id: 'd', label: 'Nelze nic říct o B' },
    ],
    correct_id: 'b',
  },
  'D8.1': {
    options: [
      { id: 'a', label: 'Ignoruji to, je to potvrzení.' },
      { id: 'b', label: 'Doptám se, zda je vše v pořádku nebo něco chybí.' },
      { id: 'c', label: 'Pošlu dlouhé vysvětlení bez otázky.' },
    ],
    correct_id: 'b',
  },
  'D8.2': {
    options: [
      { id: 'a', label: 'To je nespravedlivé.' },
      { id: 'b', label: 'Mrzí mě to. Můžeš upřesnit, co konkrétně nefunguje?' },
      { id: 'c', label: 'Vysvětlím, proč je to tak.' },
    ],
    correct_id: 'b',
  },
  'D8.3': {
    options: [
      { id: 'a', label: 'Počkám, až to někdo otevře.' },
      { id: 'b', label: 'Otevřu krátké check-in vlákno a nabídnu podporu.' },
      { id: 'c', label: 'Pošlu jen surová data bez kontextu.' },
    ],
    correct_id: 'b',
  },
  'D8.4': {
    options: [
      { id: 'a', label: 'Pošlu mu odkazy bez kontextu.' },
      { id: 'b', label: 'Vytvořím krátký kontext + nabídnu čas na dotazy.' },
      { id: 'c', label: 'Řeknu, ať se zeptá někoho jiného.' },
    ],
    correct_id: 'b',
  },
  'D8.5': {
    options: [
      { id: 'a', label: 'Napsat jen chybu bez kontextu.' },
      { id: 'b', label: 'Popis faktů + dopad + nabídka řešení.' },
      { id: 'c', label: 'Napsat veřejně bez předchozího ověření.' },
    ],
    correct_id: 'b',
  },
  'D8.6': {
    options: [
      { id: 'a', label: 'Ignorovat tón a pokračovat v tématu.' },
      { id: 'b', label: 'Doptat se v soukromí, zda je vše ok.' },
      { id: 'c', label: 'Reagovat stejně sarkasticky.' },
    ],
    correct_id: 'b',
  },
  'D9.1': {
    sources: [
      { id: 's1', label: 'Zvýšení ceny' },
      { id: 's2', label: 'Zkrácení doby dodání' },
      { id: 's3', label: 'Vyšší kvalita podpory' },
    ],
    targets: [
      { id: 't1', label: 'Pokles poptávky' },
      { id: 't2', label: 'Růst spokojenosti' },
      { id: 't3', label: 'Vyšší loajalita' },
    ],
    correct_pairs: [
      { source: 's1', target: 't1' },
      { source: 's2', target: 't2' },
      { source: 's3', target: 't3' },
    ],
  },
  'D9.2': {
    options: [
      { id: 'a', label: 'Zlepšení všech metrik' },
      { id: 'b', label: 'Bottleneck v navazující části' },
      { id: 'c', label: 'Snížení variability' },
      { id: 'd', label: 'Bez vlivu' },
    ],
    correct_id: 'b',
  },
  'D9.3': {
    options: [
      { id: 'o1', label: 'Vstup' },
      { id: 'o2', label: 'Zpracování' },
      { id: 'o3', label: 'Výstup' },
      { id: 'o4', label: 'Zpětná vazba' },
    ],
    correct_order: ['o1', 'o2', 'o3', 'o4'],
  },
  'D9.4': {
    sources: [
      { id: 's1', label: 'Vyšší marketingové výdaje' },
      { id: 's2', label: 'Snížení chybovosti' },
      { id: 's3', label: 'Zvýšení fluktuace' },
    ],
    targets: [
      { id: 't1', label: 'Růst poptávky' },
      { id: 't2', label: 'Nižší reklamace' },
      { id: 't3', label: 'Ztráta know-how' },
    ],
    correct_pairs: [
      { source: 's1', target: 't1' },
      { source: 's2', target: 't2' },
      { source: 's3', target: 't3' },
    ],
  },
  'D9.5': {
    options: [
      { id: 'a', label: 'Růst uživatelů zvyšuje doporučení, což zvyšuje další růst' },
      { id: 'b', label: 'Vyšší cena snižuje poptávku' },
      { id: 'c', label: 'Více testů snižuje počet chyb' },
      { id: 'd', label: 'Nižší latence zlepšuje UX' },
    ],
    correct_id: 'a',
  },
  'D9.6': {
    options: [
      { id: 'a', label: 'Jen lokální metriku' },
      { id: 'b', label: 'Dopady na navazující části a dlouhodobé efekty' },
      { id: 'c', label: 'Názor nejhlasitější osoby' },
      { id: 'd', label: 'Vůbec nic' },
    ],
    correct_id: 'b',
  },
  'D10.1': {
    options: [
      { id: 'a', label: 'Riziko', image_url: '__D10_IMAGE_A__' },
      { id: 'b', label: 'Příležitost', image_url: '__D10_IMAGE_B__' },
      { id: 'c', label: 'Nejasný signál', image_url: '__D10_IMAGE_C__' },
    ],
    correct_id: 'b',
  },
  'D10.2': {
    options: [
      { id: 'a', label: 'Nutnost brzdit', image_url: '__D10_IMAGE_A__' },
      { id: 'b', label: 'Chuť experimentovat', image_url: '__D10_IMAGE_B__' },
      { id: 'c', label: 'Vyčkávání', image_url: '__D10_IMAGE_C__' },
    ],
    correct_id: 'b',
  },
  'D10.3': {
    options: [
      { id: 'a', label: 'Ověřit rizika', image_url: '__D10_IMAGE_A__' },
      { id: 'b', label: 'Hledat příležitosti', image_url: '__D10_IMAGE_B__' },
      { id: 'c', label: 'Ignorovat', image_url: '__D10_IMAGE_C__' },
    ],
    correct_id: 'b',
  },
  'D10.4': {
    options: [
      { id: 'a', label: 'Bezpečný rámec', image_url: '__D10_IMAGE_A__' },
      { id: 'b', label: 'Rychlý průzkum', image_url: '__D10_IMAGE_B__' },
      { id: 'c', label: 'Nečinnost', image_url: '__D10_IMAGE_C__' },
    ],
    correct_id: 'b',
  },
  'D10.5': {
    options: [
      { id: 'a', label: 'Potenciální hrozba', image_url: '__D10_IMAGE_A__' },
      { id: 'b', label: 'Potenciální růst', image_url: '__D10_IMAGE_B__' },
      { id: 'c', label: 'Náhoda', image_url: '__D10_IMAGE_C__' },
    ],
    correct_id: 'b',
  },
  'D10.6': {
    options: [
      { id: 'a', label: 'Riziko', image_url: '__D10_IMAGE_A__' },
      { id: 'b', label: 'Příležitost', image_url: '__D10_IMAGE_B__' },
      { id: 'c', label: 'Šum', image_url: '__D10_IMAGE_C__' },
    ],
    correct_id: 'b',
  },
  'D11.1': {
    options: [
      { id: 'o1', label: 'Definovat cíl' },
      { id: 'o2', label: 'Stanovit hypotézy' },
      { id: 'o3', label: 'Navrhnout pilotní řešení' },
      { id: 'o4', label: 'Ověřit v praxi' },
      { id: 'o5', label: 'Iterovat' },
    ],
    correct_order: ['o1', 'o2', 'o3', 'o4', 'o5'],
  },
  'D11.2': {
    sources: [
      { id: 's1', label: 'Zmapovat potřeby uživatelů' },
      { id: 's2', label: 'Navrhnout řešení' },
      { id: 's3', label: 'Spustit pilot' },
    ],
    targets: [
      { id: 't1', label: 'Analýza' },
      { id: 't2', label: 'Návrh' },
      { id: 't3', label: 'Realizace' },
    ],
    correct_pairs: [
      { source: 's1', target: 't1' },
      { source: 's2', target: 't2' },
      { source: 's3', target: 't3' },
    ],
  },
  'D11.3': {
    options: [
      { id: 'o1', label: 'Stabilizovat provoz' },
      { id: 'o2', label: 'Diagnostikovat příčinu' },
      { id: 'o3', label: 'Opravit' },
      { id: 'o4', label: 'Vyhodnotit a poučit se' },
    ],
    correct_order: ['o1', 'o2', 'o3', 'o4'],
  },
  'D11.4': {
    options: [
      { id: 'a', label: 'Hned začít realizovat' },
      { id: 'b', label: 'Ujasnit cíl a kritéria úspěchu' },
      { id: 'c', label: 'Přidat více lidí' },
      { id: 'd', label: 'Počkat na instrukce' },
    ],
    correct_id: 'b',
  },
  'D11.5': {
    sources: [
      { id: 's1', label: 'Základní pravidla a role' },
      { id: 's2', label: 'Konkrétní požadavek' },
      { id: 's3', label: 'Kritéria hodnocení' },
    ],
    targets: [
      { id: 't1', label: 'Kontext' },
      { id: 't2', label: 'Zadání' },
      { id: 't3', label: 'Hodnocení' },
    ],
    correct_pairs: [
      { source: 's1', target: 't1' },
      { source: 's2', target: 't2' },
      { source: 's3', target: 't3' },
    ],
  },
  'D11.6': {
    options: [
      { id: 'o1', label: 'Definovat výsledek' },
      { id: 'o2', label: 'Rozdělit na části' },
      { id: 'o3', label: 'Seřadit podle dopadu' },
      { id: 'o4', label: 'Přiřadit odpovědnosti' },
    ],
    correct_order: ['o1', 'o2', 'o3', 'o4'],
  },
  'D12.1': {
    options: [
      { id: 'a', label: 'Použiji je, protože pomohou' },
      { id: 'b', label: 'Požádám o souhlas nebo data nepoužiji' },
      { id: 'c', label: 'Použiji je anonymně bez informování' },
    ],
    correct_id: 'b',
  },
  'D12.2': {
    options: [
      { id: 'a', label: 'Souhlasím, hlavně že se uzavře deal' },
      { id: 'b', label: 'Navrhnu otevřeně pojmenovat riziko a nabídnout řešení' },
      { id: 'c', label: 'Neřeším to' },
    ],
    correct_id: 'b',
  },
  'D12.3': {
    options: [
      { id: 'a', label: 'Nechám to, pokud roste výkon' },
      { id: 'b', label: 'Zastavím nasazení a hledám férovější variantu' },
      { id: 'c', label: 'Skryji metriky' },
    ],
    correct_id: 'b',
  },
  'D12.4': {
    options: [
      { id: 'a', label: 'Nechám to být' },
      { id: 'b', label: 'Nahlásím chybu' },
      { id: 'c', label: 'Počkám, jestli si toho někdo všimne' },
    ],
    correct_id: 'b',
  },
  'D12.5': {
    options: [
      { id: 'a', label: 'Vypustím to' },
      { id: 'b', label: 'Zastavím a navrhnu minimální audit' },
      { id: 'c', label: 'Přehodím odpovědnost na jiný tým' },
    ],
    correct_id: 'b',
  },
  'D12.6': {
    options: [
      { id: 'a', label: 'Ignoruji, není to moje věc' },
      { id: 'b', label: 'Zvednu téma a navrhnu nápravu' },
      { id: 'c', label: 'Pošlu to anonymně bez dalšího' },
    ],
    correct_id: 'b',
  },
};

const JcfpmFlow: React.FC<Props> = ({ initialSnapshot, mode = 'form', section = 'full', userId, isPremium = false, onPersist, onClose }) => {
  const { i18n } = useTranslation();
  const locale = (i18n.language || 'cs').split('-')[0];
  const copy = useMemo(() => FLOW_COPY[locale] || FLOW_COPY.cs, [locale]);
  const dimensions = useMemo(() => buildDimensions(copy), [copy]);
  const interludes = useMemo(() => buildInterludes(copy), [copy]);
  const draft = readJcfpmDraft(userId);
  const [items, setItems] = useState<JcfpmItem[]>([]);
  const [responses, setResponses] = useState<Record<string, any>>(() => draft?.responses || {});
  const [stepIndex, setStepIndex] = useState<number>(() => draft?.stepIndex ?? 0);
  const [variantSeed] = useState<string>(() => draft?.variantSeed || Math.random().toString(36).slice(2, 10));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'form' | 'report'>(mode);
  const [snapshot, setSnapshot] = useState<JcfpmSnapshotV1 | null>(initialSnapshot || null);
  const aiRegenAttemptedForRef = useRef<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [ambientEnabled, setAmbientEnabled] = useState(false);
  const [showInterlude, setShowInterlude] = useState(false);
  const [autoJumped, setAutoJumped] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoadingItems(true);
      setItemsError(null);
      try {
        const fetched = await fetchJcfpmItems();
        if (!mounted) return;
        const list = fetched || [];
        setItems(list);
      } catch (err: any) {
        if (!mounted) return;
        const msg = String(err?.message || '');
        if (msg.toLowerCase().includes('premium')) {
          setItemsError(copy.errors.premium);
        } else if (msg.includes('403')) {
          setItemsError(copy.errors.noAccess);
        } else if (msg.toLowerCase().includes('seed') || msg.toLowerCase().includes('items')) {
          setItemsError(copy.errors.missingSeed);
        } else {
          setItemsError(copy.errors.generic);
        }
      } finally {
        if (mounted) setIsLoadingItems(false);
      }
    })();
    return () => { mounted = false; };
  }, [copy]);

  useEffect(() => {
    if (viewMode !== 'form') return;
    writeJcfpmDraft({
      stepIndex,
      responses,
      variantSeed,
      updatedAt: new Date().toISOString(),
    }, userId);
  }, [responses, stepIndex, viewMode, userId, variantSeed]);

  const pooledItems = useMemo(() => {
    const groups = new Map<string, JcfpmItem[]>();
    const normalizeKey = (value: string) => value.trim().toUpperCase();
    items.forEach((item) => {
      const baseId = stripVariantSuffix(String(item.id || ''));
      const poolKey = stripVariantSuffix(String(item.pool_key || ''));
      // Pool key identifies logical question; variants differ by id/variant_index.
      const key = normalizeKey(poolKey || baseId || '');
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    });
    const preferBaseVariants = Boolean(draft && !draft.variantSeed);
    const hashString = (input: string) => {
      let hash = 0;
      for (let i = 0; i < input.length; i += 1) {
        hash = (hash << 5) - hash + input.charCodeAt(i);
        hash |= 0;
      }
      return Math.abs(hash);
    };
    const selected: JcfpmItem[] = [];
    groups.forEach((group, key) => {
      const getVariantIndex = (item: JcfpmItem) => {
        if (typeof item.variant_index === 'number') return item.variant_index;
        const match = String(item.id || item.pool_key || '').match(/_v(\d+)$/i);
        if (match) return Number(match[1]);
        return 1;
      };
      const ordered = [...group].sort((a, b) => {
        const aIdx = getVariantIndex(a);
        const bIdx = getVariantIndex(b);
        if (aIdx !== bIdx) return aIdx - bIdx;
        return String(a.id).localeCompare(String(b.id));
      });
      if (preferBaseVariants) {
        const base = ordered.find((item) => getVariantIndex(item) === 1) || ordered[0];
        if (base) selected.push(base);
      } else {
        const idx = ordered.length ? hashString(`${variantSeed}:${key}`) % ordered.length : 0;
        if (ordered[idx]) selected.push(ordered[idx]);
      }
    });
    return selected;
  }, [items, variantSeed, draft]);

  useEffect(() => {
    if (!items.length) return;
    const requiredCount = section === 'core' ? 72 : section === 'deep' ? 36 : 108;
    if (pooledItems.length < requiredCount) {
      setItemsError(copy.errors.missingCount(requiredCount));
    } else {
      setItemsError(null);
    }
  }, [items.length, pooledItems.length, section, copy]);

  const inferDimension = useCallback((item: JcfpmItem | undefined): JcfpmDimensionId => {
    if (!item) return 'd1_cognitive';
    const explicit = String(item.dimension || '').trim().toLowerCase();
    const inferred =
      inferDimensionFromIdentity(item.id) ||
      inferDimensionFromIdentity(item.pool_key) ||
      (DIMENSION_IDS.includes(explicit as JcfpmDimensionId) ? (explicit as JcfpmDimensionId) : undefined);
    return inferred || 'd1_cognitive';
  }, []);

  const activeDimensions = useMemo(() => {
    return dimensions.filter((dim) => {
      if (section === 'core') return !DEEP_DIVE_DIMENSIONS.has(dim.id);
      if (section === 'deep') return DEEP_DIVE_DIMENSIONS.has(dim.id);
      return true;
    });
  }, [section, dimensions]);

  const orderedItems = useMemo(() => {
    const filtered = [...pooledItems].filter((item) => {
      const dim = inferDimension(item);
      if (section === 'core') return !DEEP_DIVE_DIMENSIONS.has(dim);
      if (section === 'deep') return DEEP_DIVE_DIMENSIONS.has(dim);
      return true;
    });
    return filtered.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [pooledItems, section]);

  const sectionItemsByDimension = useMemo(() => {
    const map: Record<string, JcfpmItem[]> = {};
    orderedItems.forEach((item) => {
      const dim = inferDimension(item);
      if (!map[dim]) map[dim] = [];
      map[dim].push(item);
    });
    Object.values(map).forEach((list) => list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
    return map;
  }, [inferDimension, orderedItems]);

  useEffect(() => {
    if (!orderedItems.length) return;
    setStepIndex((prev) => Math.max(0, Math.min(prev, orderedItems.length - 1)));
  }, [orderedItems.length]);

  useEffect(() => {
    if (!orderedItems.length || autoJumped || viewMode !== 'form') return;
    const firstUnansweredIdx = orderedItems.findIndex((item) => !isAnswered(item));
    if (firstUnansweredIdx >= 0) {
      setStepIndex(firstUnansweredIdx);
    } else {
      setStepIndex(orderedItems.length - 1);
    }
    setAutoJumped(true);
  }, [autoJumped, orderedItems, viewMode, responses]);

  const currentItem = orderedItems[stepIndex];
  const currentDim = dimensions.find((dim) => dim.id === inferDimension(currentItem)) || dimensions[0];
  // disable deep dive special styling; treat all items as standard for unified layout
  const isDeepDive = false;
  const isFocusMode = false;
  const sceneCapability = useSceneCapability();
  const resolvePrompt = useCallback((item?: JcfpmItem): string => {
    if (!item) return '';
    const localized = item.prompt_i18n?.[locale] || item.prompt_i18n?.[(locale || '').toLowerCase()] || item.prompt_i18n?.[(locale || '').split('-')[0]];
    return stripVariantLabelFromPrompt(String(localized || item.prompt || ''));
  }, [locale]);
  const resolveSubdimension = useCallback((item?: JcfpmItem): string => {
    if (!item) return '';
    const localized = item.subdimension_i18n?.[locale] || item.subdimension_i18n?.[(locale || '').toLowerCase()] || item.subdimension_i18n?.[(locale || '').split('-')[0]];
    return String(localized || item.subdimension || '');
  }, [locale]);
  const mergeLocalizedPayload = useCallback((base: any, localized: any) => {
    if (!localized || typeof localized !== 'object') return base;
    const mergeList = (baseList: any[], localizedList: any[]) => {
      const localizedMap = new Map(localizedList.map((entry: any) => [String(entry?.id || entry?.key || ''), entry]));
      return baseList.map((entry: any) => {
        const key = String(entry?.id || entry?.key || '');
        const override = key ? localizedMap.get(key) : null;
        return override ? { ...entry, ...override } : entry;
      });
    };
    const merged: any = { ...base, ...localized };
    if (Array.isArray(base?.options) && Array.isArray(localized?.options)) {
      merged.options = mergeList(base.options, localized.options);
    }
    if (Array.isArray(base?.sources) && Array.isArray(localized?.sources)) {
      merged.sources = mergeList(base.sources, localized.sources);
    }
    if (Array.isArray(base?.targets) && Array.isArray(localized?.targets)) {
      merged.targets = mergeList(base.targets, localized.targets);
    }
    if (Array.isArray(base?.correct_order) && Array.isArray(localized?.correct_order)) {
      merged.correct_order = localized.correct_order;
    }
    return merged;
  }, []);
  const resolvePayload = useCallback((item?: JcfpmItem): any => {
    if (!item) return {};
    const rawKey = stripVariantSuffix(String(item.id || item.pool_key || '')).trim();
    const key = rawKey.toUpperCase();
    const applyImageAssets = (payload: any) => {
      if (!payload || typeof payload !== 'object') return payload;
      const mapImage = (maybeUrl: any) => {
        const imageUrl = String(maybeUrl || '');
        if (imageUrl === '__D10_IMAGE_A__') return D10_IMAGE_ASSETS.a;
        if (imageUrl === '__D10_IMAGE_B__') return D10_IMAGE_ASSETS.b;
        if (imageUrl === '__D10_IMAGE_C__') return D10_IMAGE_ASSETS.c;
        return maybeUrl;
      };
      const options = Array.isArray(payload.options)
        ? payload.options.map((opt: any) => ({ ...opt, image_url: mapImage(opt?.image_url) }))
        : payload.options;
      return {
        ...payload,
        image_url: mapImage(payload.image_url),
        prompt_image: mapImage(payload.prompt_image),
        options,
      };
    };
    const localizedPayload = item.payload_i18n?.[locale] || item.payload_i18n?.[(locale || '').split('-')[0]];
    if (item.payload == null) {
      return applyImageAssets(mergeLocalizedPayload(LOCAL_JCFPM_PAYLOADS[key] || {}, localizedPayload));
    }
    let value: any = item.payload;
    for (let i = 0; i < 2; i += 1) {
      if (typeof value !== 'string') break;
      try {
        value = JSON.parse(value);
      } catch {
        return {};
      }
    }
    const basePayload = value && typeof value === 'object' && Object.keys(value).length > 0 ? value : (LOCAL_JCFPM_PAYLOADS[key] || {});
    return applyImageAssets(mergeLocalizedPayload(basePayload, localizedPayload));
  }, [locale, mergeLocalizedPayload]);
  const resolveItemType = useCallback((item?: JcfpmItem): string => {
    if (!item) return 'likert';
    const explicit = String(item.item_type || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/-+/g, '_');
    const payload = resolvePayload(item);
    if (Array.isArray(payload.sources) && Array.isArray(payload.targets)) return 'drag_drop';
    if (Array.isArray(payload.correct_order)) return 'ordering';
    if (Array.isArray(payload.options)) {
      if (payload.options.some((opt: any) => opt?.image_url)) return 'image_choice';
      // even when options don't carry images, a top-level prompt image or D10 id
      // indicates we should render an abstract visual
      if (payload.image_url || payload.prompt_image) return 'image_choice';
      const id = stripVariantSuffix(String(item.id || item.pool_key || ''));
      if (/^D10\./i.test(id)) return 'image_choice';
      return 'mcq';
    }
    const id = stripVariantSuffix(String(item.id || item.pool_key || ''));
    if (/^D10\./i.test(id)) return 'image_choice';
    if (/^D8\./i.test(id) || /^D12\./i.test(id)) return 'scenario_choice';
    if (/^D7\./i.test(id)) return 'mcq';
    if (/^D9\.1$/i.test(id) || /^D9\.4$/i.test(id) || /^D11\.2$/i.test(id) || /^D11\.5$/i.test(id)) return 'drag_drop';
    if (/^D9\.3$/i.test(id) || /^D11\.1$/i.test(id) || /^D11\.3$/i.test(id) || /^D11\.6$/i.test(id)) return 'ordering';
    if (/^D9\.2$/i.test(id) || /^D9\.5$/i.test(id) || /^D9\.6$/i.test(id) || /^D11\.4$/i.test(id)) return 'mcq';
    return explicit || 'likert';
  }, [resolvePayload]);
  const isAnswered = (item: JcfpmItem | undefined) => {
    if (!item) return false;
    const value = responses[item.id];
    if (value == null) return false;
    const itemType = resolveItemType(item);
    if (itemType === 'ordering') return Array.isArray(value?.order) && value.order.length > 0;
    if (itemType === 'drag_drop') return Array.isArray(value?.pairs) && value.pairs.length > 0;
    if (itemType === 'mcq' || itemType === 'scenario_choice' || itemType === 'image_choice') return Boolean(value?.choice_id || value);
    return typeof value === 'number' || Boolean(value);
  };
  const canAdvance = isAnswered(currentItem);

  const prevDimRef = React.useRef<string | null>(null);
  const prevStepRef = React.useRef<number>(stepIndex);
  useEffect(() => {
    const currentDimId = currentItem?.dimension || null;
    const prevDimId = prevDimRef.current;
    const prevStep = prevStepRef.current;
    const movingForward = stepIndex > prevStep;
    if (movingForward && prevDimId && currentDimId && prevDimId !== currentDimId) {
      setShowInterlude(true);
    }
    prevDimRef.current = currentDimId;
    prevStepRef.current = stepIndex;
  }, [currentItem?.dimension, stepIndex]);

  const progress = viewMode === 'report'
    ? 100
    : Math.round(((stepIndex + 1) / Math.max(1, orderedItems.length)) * 100);

  const totalQuestions = orderedItems.length || (section === 'core' ? 72 : section === 'deep' ? 36 : 108);
  const answeredByDimension = useMemo(() => {
    const map: Record<string, number> = {};
    DIMENSION_IDS.forEach((dimId) => {
      const dimItems = sectionItemsByDimension[dimId] || [];
      map[dimId] = dimItems.filter((item) => responses[item.id] != null).length;
    });
    return map;
  }, [sectionItemsByDimension, responses]);
  const currentDimItems = sectionItemsByDimension[currentDim.id] || [];
  const currentDimQuestionCount = currentDimItems.length;
  const currentDimQuestionIndex = Math.max(
    0,
    currentDimItems.findIndex((item) => item.id === currentItem?.id)
  );
  const currentDimAnswered = answeredByDimension[currentDim.id] || 0;

  const handleAnswer = useCallback((itemId: string, value: any) => {
    setResponses((prev) => ({ ...prev, [itemId]: value }));
    if (soundEnabled) {
      try {
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = 528;
          gain.gain.value = 0.03;
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.08);
          osc.onended = () => ctx.close();
        }
      } catch {
        // ignore audio errors
      }
    }
  }, [soundEnabled]);

  const timingsRef = React.useRef<Record<string, number>>({});
  const startTimeRef = React.useRef<number | null>(null);
  const startItemRef = React.useRef<string | null>(null);
  const suspendTimerRef = React.useRef(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const recordTime = (itemId: string | null) => {
    if (!itemId || startTimeRef.current == null) return;
    const elapsed = Date.now() - startTimeRef.current;
    if (elapsed > 0) {
      timingsRef.current[itemId] = (timingsRef.current[itemId] || 0) + elapsed;
    }
    startTimeRef.current = Date.now();
    startItemRef.current = itemId;
  };

  useEffect(() => {
    if (!currentItem) return;
    const currentId = currentItem.id;
    if (startItemRef.current !== currentId) {
      startTimeRef.current = Date.now();
      startItemRef.current = currentId;
      setElapsedMs(0);
    }
  }, [currentItem?.id]);

  useEffect(() => {
    if (!isDeepDive || viewMode === 'report') return;
    const currentItemType = currentItem ? resolveItemType(currentItem) : null;
    if (currentItemType === 'ordering' || currentItemType === 'drag_drop') return;
    const interval = window.setInterval(() => {
      if (suspendTimerRef.current) return;
      if (startTimeRef.current == null) return;
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isDeepDive, viewMode, currentItem?.id]);

  const responsesWithTiming = () => {
    // Submit only items from the active section to avoid backend count mismatches
    // when the draft/snapshot already contains answers from another section.
    const result: Record<string, any> = {};
    orderedItems.forEach((item) => {
      const baseValue = responses[item.id];
      if (baseValue == null) return;
      const itemType = resolveItemType(item);
      if (itemType === 'likert') {
        result[item.id] = baseValue;
        return;
      }
      const timeMs = timingsRef.current[item.id];
      if (baseValue && typeof baseValue === 'object') {
        result[item.id] = timeMs == null ? baseValue : { ...baseValue, time_ms: timeMs };
      } else {
        result[item.id] = timeMs == null ? { choice_id: baseValue } : { choice_id: baseValue, time_ms: timeMs };
      }
    });
    return result;
  };

  const mergePartialSnapshot = (
    baseSnapshot: JcfpmSnapshotV1 | null,
    incomingSnapshot: JcfpmSnapshotV1,
    testedDims: Set<JcfpmDimensionId>,
  ): JcfpmSnapshotV1 => {
    if (!baseSnapshot) return incomingSnapshot;

    const byDim = new Map<JcfpmDimensionId, any>(
      (baseSnapshot.dimension_scores || []).map((row) => [row.dimension, row])
    );
    (incomingSnapshot.dimension_scores || []).forEach((row) => {
      if (testedDims.has(row.dimension)) {
        byDim.set(row.dimension, row);
      }
    });

    const mergedDimensionScores = DIMENSION_IDS
      .map((dimId) => byDim.get(dimId))
      .filter(Boolean);

    const mergedPercentiles = {
      ...(baseSnapshot.percentile_summary || {}),
    } as Record<JcfpmDimensionId, number>;
    Object.entries(incomingSnapshot.percentile_summary || {}).forEach(([dim, value]) => {
      const dimension = dim as JcfpmDimensionId;
      if (testedDims.has(dimension)) {
        mergedPercentiles[dimension] = value as number;
      }
    });

    const mergedItemIds = Array.from(
      new Set([...(baseSnapshot.item_ids || []), ...(incomingSnapshot.item_ids || [])])
    );

    return {
      ...baseSnapshot,
      completed_at: incomingSnapshot.completed_at,
      responses: {
        ...(baseSnapshot.responses || {}),
        ...(incomingSnapshot.responses || {}),
      },
      item_ids: mergedItemIds,
      variant_seed: incomingSnapshot.variant_seed || baseSnapshot.variant_seed,
      dimension_scores: mergedDimensionScores,
      percentile_summary: mergedPercentiles,
      confidence: incomingSnapshot.confidence ?? baseSnapshot.confidence,
      // Fit/AI are derived mainly from D1-D6 model; keep existing rich output unless missing.
      fit_scores: (baseSnapshot.fit_scores && baseSnapshot.fit_scores.length)
        ? baseSnapshot.fit_scores
        : incomingSnapshot.fit_scores,
      ai_report: baseSnapshot.ai_report || incomingSnapshot.ai_report || null,
    };
  };

  useEffect(() => {
    if (viewMode !== 'report' || !isPremium || !snapshot || snapshot.ai_report) return;
    const hasResponses = snapshot.responses && Object.keys(snapshot.responses).length > 0;
    if (!hasResponses) return;
    const retryKey = `${snapshot.completed_at || 'na'}:${snapshot.variant_seed || 'na'}`;
    if (aiRegenAttemptedForRef.current === retryKey) return;
    aiRegenAttemptedForRef.current = retryKey;

    let cancelled = false;
    (async () => {
      try {
        const refreshed = await submitJcfpm(
          snapshot.responses as Record<string, any>,
          snapshot.item_ids || Object.keys(snapshot.responses || {}),
          snapshot.variant_seed || variantSeed
        );
        if (!cancelled && refreshed) {
          setSnapshot((prev) => mergePartialSnapshot(prev, refreshed, new Set(DIMENSION_IDS)));
        }
      } catch {
        // keep current snapshot; report panel will still render fallback interpretation
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [viewMode, isPremium, snapshot, variantSeed]);

  const handleNext = async () => {
    if (!canAdvance) return;
    recordTime(currentItem?.id || null);
    if (stepIndex < orderedItems.length - 1) {
      if (soundEnabled) {
        try {
          const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = 640;
            gain.gain.value = 0.025;
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.12);
            osc.onended = () => ctx.close();
          }
        } catch {
          // ignore audio errors
        }
      }
      setStepIndex((prev) => prev + 1);
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await submitJcfpm(responsesWithTiming(), orderedItems.map((item) => item.id), variantSeed);
      if (result) {
        const testedDims = new Set<JcfpmDimensionId>(orderedItems.map((item) => inferDimension(item)));
        const persistedSnapshot = section === 'full'
          ? result
          : mergePartialSnapshot(snapshot || initialSnapshot || null, result, testedDims);
        clearJcfpmDraft(userId);
        setSnapshot(persistedSnapshot);
        setViewMode('report');
        await onPersist(persistedSnapshot);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  type TaskProps = {
    item: JcfpmItem;
    response: any;
    onAnswer: (value: any) => void;
  };

  const LikertTask = useMemo<React.FC<TaskProps>>(() => {
    const Component: React.FC<TaskProps> = ({ item, response, onAnswer }) => (
      <>
        <div className="mt-4 grid grid-cols-7 gap-2" role="radiogroup" aria-label={resolvePrompt(item)}>
          {LIKERT.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onAnswer(value)}
              aria-pressed={response === value}
              className={`jcfpm-likert ${response === value ? 'is-active' : ''}`}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
          <span>{copy.likertLow}</span>
          <span>{copy.likertHigh}</span>
        </div>
      </>
    );
    return Component;
  }, [copy.likertHigh, copy.likertLow, resolvePrompt]);

  const ChoiceTask = useMemo<React.FC<TaskProps>>(() => {
    const Component: React.FC<TaskProps> = ({ item, response, onAnswer }) => {
      const itemType = resolveItemType(item);
      const dim = inferDimension(item);
      const isDigitalEq = dim === 'd8_digital_eq';
      const payload = resolvePayload(item);
      const options = Array.isArray(payload.options) ? payload.options : [];
      const fallbackVisual = (seed: string) => {
        const base = seed.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
        const hueA = base % 360;
        const hueB = (base * 7) % 360;
        return `linear-gradient(135deg, hsla(${hueA}, 70%, 60%, 0.9), hsla(${hueB}, 80%, 55%, 0.85))`;
      };
      if (!options.length) {
        console.warn('[JCFPM] Missing options payload for item:', item);
        return (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {copy.missingOptions}
          </div>
        );
      }
      const promptImage =
        itemType === 'image_choice'
          ? (payload.image_url || payload.prompt_image || options.find((opt: any) => opt?.image_url)?.image_url)
          : null;
      if (itemType === 'image_choice' && /^D10\./i.test(String(item.id || ''))) {
        // eslint-disable-next-line no-console
        console.debug('[JCFPM][DEBUG] D10 resolved payload for', item.id, payload);
        // eslint-disable-next-line no-console
        console.debug('[JCFPM][DEBUG] promptImage:', promptImage);
        if (!promptImage) {
          // eslint-disable-next-line no-console
          console.warn('[JCFPM] D10 image missing for item:', item.id, { payload });
        }
      }
      const promptFallback = fallbackVisual(String(item.id || 'v'));
      const promptBackground = promptImage
        ? `url("${promptImage}"), ${promptFallback}`
        : promptFallback;
      return (
        <div className="mt-4">
          {isDigitalEq && (
            <div className="jcfpm-chat-thread mb-4">
              <div className="jcfpm-chat-bubble is-peer">{copy.chatPeer}: „{resolvePrompt(item)}“</div>
              <div className="jcfpm-chat-bubble is-you">{copy.chatYou}: {copy.chatPrompt}</div>
            </div>
          )}
          {itemType === 'image_choice' && (
            <div
              className="jcfpm-abstract-visual mb-4"
              style={{
                backgroundImage: promptBackground,
                backgroundSize: promptImage ? 'cover, cover' : 'auto',
                backgroundPosition: 'center',
              }}
            >
              {promptImage ? (
                <img
                  src={promptImage}
                  alt=""
                  aria-hidden="true"
                  className="jcfpm-abstract-img"
                  onError={(event) => {
                    (event.currentTarget as HTMLImageElement).style.display = 'none';
                    console.warn('[JCFPM] Failed to load prompt image:', promptImage);
                  }}
                />
              ) : null}
            </div>
          )}
          <div className={`grid gap-3 ${itemType === 'image_choice' ? 'grid-cols-1 md:grid-cols-3' : ''} ${isDigitalEq ? 'jcfpm-chat-options' : ''}`}>
            {options.map((option: any) => {
              const selected = response?.choice_id === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onAnswer({ choice_id: option.id })}
                  className={`jcfpm-choice-card ${selected ? 'is-active' : ''} ${isDigitalEq ? 'jcfpm-chat-choice' : ''}`}
                >
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{option.label}</div>
                  {option.desc ? <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">{option.desc}</div> : null}
                </button>
              );
            })}
          </div>
        </div>
      );
    };
    return Component;
  }, [
    copy.chatPeer,
    copy.chatPrompt,
    copy.chatYou,
    copy.missingOptions,
    inferDimension,
    resolveItemType,
    resolvePayload,
    resolvePrompt,
  ]);

  const OrderingTask = useMemo<React.FC<TaskProps>>(() => {
    const Component: React.FC<TaskProps> = ({ item, response, onAnswer }) => {
      const payload = resolvePayload(item);
      const isDecomposition = inferDimension(item) === 'd11_problem_decomposition';
      const options = Array.isArray(payload.options) ? payload.options : [];

      if (!options.length) {
        console.warn('[JCFPM] Missing ordering options payload for item:', item);
        return (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {copy.missingOrdering}
          </div>
        );
      }

      const order = Array.isArray(response?.order) ? response.order : options.map((opt: any) => opt.id);
      const orderKey = order.join('|');
      const [localOrder, setLocalOrder] = useState<string[]>(order);
      useEffect(() => {
        setLocalOrder(order);
      }, [orderKey]);

      const move = (index: number, direction: number) => {
        const next = [...order];
        const swapIndex = index + direction;
        if (swapIndex < 0 || swapIndex >= next.length) return;
        [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
        onAnswer({ order: next });
      };

      return (
        <div className={`mt-4 ${isDecomposition ? 'jcfpm-ordering-stack is-timeline' : ''}`}>
          <Reorder.Group
            axis="y"
            values={localOrder}
            onReorder={(next) => {
              setLocalOrder(next as string[]);
              onAnswer({ order: next });
            }}
            className="space-y-2"
          >
            {localOrder.map((id: string, index: number) => {
              const option = options.find((opt: any) => opt.id === id);
              return (
                <Reorder.Item
                  key={id}
                  value={id}
                  className={`jcfpm-ordering-item group ${isDecomposition ? 'jcfpm-timeline-step' : ''} touch-none`}
                  whileDrag={{ scale: 1.02, boxShadow: "0 20px 50px rgba(0,0,0,0.15)" }}
                  onDragStart={() => { suspendTimerRef.current = true; }}
                  onDragEnd={() => { suspendTimerRef.current = false; }}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-slate-400 hover:text-emerald-500 transition-colors">
                      <GripVertical size={16} />
                    </div>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200 min-w-[1.5rem]">{index + 1}.</span>
                    <span className="text-sm text-slate-700 dark:text-slate-300 flex-1">{option?.label || id}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" onClick={() => move(index, -1)} className="jcfpm-mini-btn" title={copy.reorderUp}>↑</button>
                    <button type="button" onClick={() => move(index, 1)} className="jcfpm-mini-btn" title={copy.reorderDown}>↓</button>
                  </div>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
        </div>
      );
    };
    return React.memo(Component);
  }, [copy.missingOrdering, copy.reorderDown, copy.reorderUp, inferDimension, resolvePayload, suspendTimerRef]);

  const DragDropTask = useMemo<React.FC<TaskProps>>(() => {
    const Component: React.FC<TaskProps> = ({ item, response, onAnswer }) => {
      const payload = resolvePayload(item);
      const isSystems = inferDimension(item) === 'd9_systems_thinking';
      const rawSources = Array.isArray(payload.sources) ? payload.sources : [];
      const rawTargets = Array.isArray(payload.targets) ? payload.targets : [];
      const shuffleKey = `${item.id || 'drag'}:${variantSeed}:dragdrop`;
      const sources = useMemo(
        () => forceNonIdentityOrder(rawSources, `${shuffleKey}:sources`),
        [rawSources, shuffleKey]
      );
      const targets = useMemo(
        () => forceNonIdentityOrder(rawTargets, `${shuffleKey}:targets`),
        [rawTargets, shuffleKey]
      );

      if (!sources.length || !targets.length) {
        console.warn('[JCFPM] Missing drag_drop payload for item:', item);
        return (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {copy.missingDragDrop}
          </div>
        );
      }

      const currentPairs: any[] = Array.isArray(response?.pairs)
        ? response.pairs
        : sources.map((src: any) => ({ source: src.id, target: '' }));

      const updatePair = (sourceId: string, targetId: string) => {
        const next = currentPairs.map((pair) =>
          (pair.source === sourceId ? { ...pair, target: targetId } : pair)
        );
        onAnswer({ pairs: next });
      };

      return (
        <div className={`mt-4 grid gap-4 ${isSystems ? 'jcfpm-systems-canvas' : ''}`}>
          {sources.map((src: any) => {
            const selected = currentPairs.find((pair) => pair.source === src.id)?.target || '';
            const targetLabel = targets.find((t: any) => t.id === selected)?.label || copy.targetPlaceholder;

            return (
              <div
                key={src.id}
                className={`jcfpm-drag-row relative overflow-hidden transition-all duration-300 ${selected ? 'border-emerald-500/30 bg-emerald-500/5' : ''
                  } ${isSystems ? 'is-node-link' : ''}`}
              >
                <div className="flex flex-col gap-1 min-w-[140px] flex-1">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{copy.sourceLabel}</div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{src.label}</div>
                </div>

                <div className="hidden sm:flex items-center text-slate-300">
                  <ArrowRight size={16} className={selected ? 'text-emerald-500' : ''} />
                </div>

                <div className="flex flex-col gap-1 flex-1">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{copy.targetLabel}</div>
                  <select
                    className={`jcfpm-select w-full ${selected ? 'is-filled' : ''}`}
                    value={selected}
                    onPointerDown={() => { suspendTimerRef.current = true; }}
                    onMouseDown={() => { suspendTimerRef.current = true; }}
                    onTouchStart={() => { suspendTimerRef.current = true; }}
                    onFocus={() => { suspendTimerRef.current = true; }}
                    onBlur={() => { suspendTimerRef.current = false; }}
                    onChange={(e) => updatePair(src.id, e.target.value)}
                  >
                    <option value="">{targetLabel}</option>
                    {targets.map((target: any) => (
                      <option key={target.id} value={target.id}>{target.label}</option>
                    ))}
                  </select>
                </div>

                {selected && (
                  <div className="absolute top-0 right-0 h-1 w-full bg-emerald-500 opacity-50" />
                )}
              </div>
            );
          })}
        </div>
      );
    };
    return React.memo(Component);
  }, [
    copy.missingDragDrop,
    copy.sourceLabel,
    copy.targetLabel,
    copy.targetPlaceholder,
    inferDimension,
    resolvePayload,
    suspendTimerRef,
    variantSeed,
  ]);

  const TASK_COMPONENTS = useMemo<Record<string, React.FC<TaskProps>>>(() => ({
    likert: LikertTask,
    mcq: ChoiceTask,
    scenario_choice: ChoiceTask,
    image_choice: ChoiceTask,
    ordering: OrderingTask,
    drag_drop: DragDropTask,
  }), [ChoiceTask, DragDropTask, LikertTask, OrderingTask]);

  const onAnswerCurrent = useCallback(
    (value: any) => {
      if (!currentItem) return;
      handleAnswer(currentItem.id, value);
    },
    [currentItem?.id, handleAnswer],
  );
  const currentItemType = currentItem ? resolveItemType(currentItem) : 'likert';

  const swipeStateRef = React.useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const SWIPE_THRESHOLD_PX = 56;
  const SWIPE_MAX_VERTICAL_DRIFT_PX = 72;
  const isInteractiveTouchTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest('button, input, select, textarea, a, [role="button"], [data-no-swipe="true"]')
    );
  };
  const handleQuestionTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (viewMode !== 'form' || showInterlude) return;
    if (currentItemType === 'ordering' || currentItemType === 'drag_drop') return;
    if (event.touches.length !== 1) return;
    if (isInteractiveTouchTarget(event.target)) return;
    const touch = event.touches[0];
    swipeStateRef.current = { x: touch.clientX, y: touch.clientY, active: true };
  };
  const handleQuestionTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!swipeStateRef.current.active) return;
    swipeStateRef.current.active = false;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const deltaX = touch.clientX - swipeStateRef.current.x;
    const deltaY = touch.clientY - swipeStateRef.current.y;
    if (Math.abs(deltaY) > SWIPE_MAX_VERTICAL_DRIFT_PX) return;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaY) > Math.abs(deltaX)) return;

    if (deltaX > 0) {
      if (canAdvance && !isSubmitting && !itemsError && !isLoadingItems) {
        void handleNext();
      }
      return;
    }
    if (deltaX < 0 && stepIndex > 0) {
      handleBack();
    }
  };

  const renderItemBody = () => {
    if (!currentItem) return null;
    const SelectedTask = TASK_COMPONENTS[currentItemType] || TASK_COMPONENTS.likert;
    return (
      <SelectedTask
        item={currentItem}
        response={responses[currentItem.id]}
        onAnswer={onAnswerCurrent}
      />
    );
  };

  const handleBack = () => {
    if (viewMode === 'report') {
      setViewMode('form');
      return;
    }
    recordTime(currentItem?.id || null);
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  return (
    <div className={`relative jcfpm-shell jcfpm-ambient ${ambientEnabled ? 'is-ambient-on' : ''} ${isDeepDive ? 'is-deep-dive' : 'is-standard'} ${isFocusMode ? 'is-focus-mode' : ''}`}>
      <div className={`jcfpm-particles-layer ${ambientEnabled ? 'is-on' : ''}`} aria-hidden="true">
        <SceneShell
          capability={sceneCapability}
          fallback={<div className="absolute inset-0 bg-slate-50 dark:bg-slate-900" />}
          className="jcfpm-particles-canvas"
          performanceMode={sceneCapability.qualityTier}
          glide
          glideIntensity={showInterlude ? 0.35 : 0.08}
        >
          <JcfpmElegantParticles qualityTier={sceneCapability.qualityTier} interactive={!showInterlude} dimensionId={currentDim.id} />
        </SceneShell>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-cyan-600/80">{copy.title}</div>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {viewMode === 'report'
              ? copy.reportLabel
              : `${currentDim.title} • ${copy.questionProgress(
                  currentDimQuestionCount > 0 ? currentDimQuestionIndex + 1 : stepIndex + 1,
                  currentDimQuestionCount > 0 ? currentDimQuestionCount : totalQuestions,
                  currentDimAnswered
                )}`
            }
          </p>
          {viewMode === 'form' ? (
            <div className={`jcfpm-phase-pill ${isDeepDive ? 'is-deep' : 'is-standard'} mt-2`}>
              {isDeepDive ? copy.phaseDeep : copy.phaseStandard}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {!isFocusMode ? (
            <>
              <button
                type="button"
                onClick={() => setAmbientEnabled((prev) => !prev)}
                className="jcfpm-icon-button"
                aria-label="Toggle ambient"
                title={ambientEnabled ? copy.ambientOn : copy.ambientOff}
              >
                {ambientEnabled ? <Sparkles className="h-4 w-4 text-cyan-700" /> : <Sparkles className="h-4 w-4 text-slate-400" />}
              </button>
              <button
                type="button"
                onClick={() => setSoundEnabled((prev) => !prev)}
                className="jcfpm-icon-button"
                aria-label="Toggle sound"
                title={soundEnabled ? copy.soundOn : copy.soundOff}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4 text-cyan-700" /> : <VolumeX className="h-4 w-4 text-slate-500" />}
              </button>
            </>
          ) : null}
          <button type="button" onClick={onClose} className="jcfpm-icon-button" aria-label="Close JCFPM">
            <X className="h-4 w-4 text-slate-600" />
          </button>
        </div>
      </div>

      <div className="jcfpm-progress-track mt-3 h-2 w-full overflow-hidden rounded-full font-sans">
        <div className={`jcfpm-progress-fill h-full rounded-full transition-all duration-700 ${isDeepDive ? 'is-deep-dive' : 'is-standard'}`} style={{ width: `${progress}%` }} />
      </div>

      {viewMode === 'report' && snapshot ? (
        <div className="mt-4">
          <JcfpmReportPanel
            snapshot={snapshot}
            showAdvancedReport={Boolean(isPremium || snapshot?.ai_report)}
          />
        </div>
      ) : (
        <div className="jcfpm-form-layout">
          <button
            type="button"
            onClick={handleBack}
            disabled={stepIndex === 0}
            className="jcfpm-side-nav-button is-prev disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" />
            {copy.back}
          </button>

          <div className="jcfpm-form-stage">
            <div className="mt-4 jcfpm-step" key={`jcfpm-step-${stepIndex}`}>
              {showInterlude && (
                <div className="jcfpm-interlude">
                  <div className="jcfpm-interlude-card">
                    <div className="text-xs uppercase tracking-[0.2em] text-cyan-600">{copy.newDimension}</div>
                    <div className="mt-2 jcfpm-heading text-lg font-semibold text-slate-900 dark:text-white">{interludes[currentDim.id]?.title || currentDim.title}</div>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{currentDim.subtitle}</p>
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                      {interludes[currentDim.id]?.body}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowInterlude(false)}
                      className="mt-5 jcfpm-primary-button"
                    >
                      {copy.continue}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
              <div className={`jcfpm-panel ${showInterlude ? 'is-blurred' : ''}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="jcfpm-heading text-base font-semibold text-slate-900 dark:text-white">{currentDim.title}</div>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{currentDim.subtitle}</p>
                    {!isFocusMode ? (
                      <p className="mt-2 text-sm text-slate-700 dark:text-slate-300 jcfpm-story">
                        {copy.stories[currentDim.id] || ''}
                      </p>
                    ) : null}
                    {isDeepDive && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span className="jcfpm-timer-pill">
                          <span className="jcfpm-pulse-dot" aria-hidden="true" />
                          <Clock className="h-3.5 w-3.5 text-cyan-600" />
                          <span>{copy.timerLabel}: {Math.floor(elapsedMs / 60000).toString().padStart(2, '0')}:{Math.floor((elapsedMs % 60000) / 1000).toString().padStart(2, '0')}</span>
                        </span>
                        <span className="jcfpm-timer-note dark:text-slate-400">{copy.timerNote}</span>
                      </div>
                    )}
                  </div>
                  <div className="jcfpm-dim-badge">
                    {currentDimAnswered} / {currentDimQuestionCount}
                  </div>
                </div>
                {currentItemType === 'likert' && (
                  <div className={`mt-3 jcfpm-legend ${isFocusMode ? 'hidden' : ''}`}>
                    {copy.legendLikert}
                  </div>
                )}
                {isLoadingItems ? (
                  <div className="mt-4 rounded-xl border border-cyan-100 bg-white dark:bg-slate-850 p-4 text-sm text-slate-500 shadow-sm">
                    {copy.loadingQuestions}
                  </div>
                ) : itemsError ? (
                  <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    {itemsError}
                  </div>
                ) : (
                  <div className={`mt-4 grid gap-3 ${showInterlude ? 'pointer-events-none' : ''}`}>
                    {currentItem ? (
                      <div
                        className="jcfpm-question jcfpm-question-animated"
                        onTouchStart={handleQuestionTouchStart}
                        onTouchEnd={handleQuestionTouchEnd}
                      >
                        <div className="jcfpm-question-title">{resolvePrompt(currentItem)}</div>
                        {resolveSubdimension(currentItem) ? (
                          <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">{resolveSubdimension(currentItem)}</div>
                        ) : null}
                        {renderItemBody()}
                      </div>
                    ) : null}
                  </div>
                )}
                <div className={`mt-4 jcfpm-timeline ${isFocusMode ? 'hidden' : ''}`}>
                  {activeDimensions.map((dim) => (
                    <div key={dim.id} className={`jcfpm-timeline-pill ${dim.id === currentDim.id ? 'is-active' : ''}`}>
                      <span className="font-semibold">{dim.title}</span>
                      <span className="text-[11px] text-slate-500">
                        {answeredByDimension[dim.id] || 0}/{(sectionItemsByDimension[dim.id] || []).length}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleNext}
            disabled={!canAdvance || isSubmitting || Boolean(itemsError) || isLoadingItems}
            className="jcfpm-side-nav-button is-next disabled:opacity-50"
          >
            {stepIndex === orderedItems.length - 1 ? (
              <>
                <Save className="h-4 w-4" />
                {isSubmitting
                  ? copy.saving
                  : section === 'full'
                    ? copy.finishTest
                    : copy.finishSection}
              </>
            ) : (
              <>
                {copy.next}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      )}

      {viewMode !== 'form' ? (
        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="jcfpm-primary-button"
          >
            {copy.close}
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default JcfpmFlow;
