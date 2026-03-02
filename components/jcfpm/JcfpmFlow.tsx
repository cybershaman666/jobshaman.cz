import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  HelpCircle,
  Volume2,
  VolumeX,
  Zap,
  Shield,
  Brain,
  Layers,
  Search,
  Activity,
  Compass,
  Sparkles,
  Users,
  Target,
  MessageSquare
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import confetti from 'canvas-confetti';
import { JcfpmItem } from '../../types';
import {
  fetchJcfpmItems,
  sampleJcfpmItems
} from '../../services/jcfpmService';

// --- Local Utilities ---

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

// --- Constants & Types ---

type JcfpmDimension =
  | 'd1_cognitive'
  | 'd2_social'
  | 'd3_motivational'
  | 'd4_energy'
  | 'd5_values'
  | 'd6_ai_readiness'
  | 'd7_cognitive_reflection'
  | 'd8_digital_eq'
  | 'd9_systems_thinking'
  | 'd10_ambiguity_interpretation'
  | 'd11_problem_decomposition'
  | 'd12_moral_compass';

interface DimensionTheme {
  bg: string;
  accent: string;
  particleColor: string;
  icon?: React.ReactNode;
}

const DIMENSION_THEMES: Record<JcfpmDimension, DimensionTheme> = {
  d1_cognitive: {
    bg: 'from-blue-900 via-indigo-900 to-slate-900',
    accent: 'text-blue-400',
    particleColor: '#60a5fa',
    icon: <Brain className="w-6 h-6" />
  },
  d2_social: {
    bg: 'from-emerald-900 via-teal-900 to-slate-900',
    accent: 'text-emerald-400',
    particleColor: '#34d399',
    icon: <Users className="w-6 h-6" />
  },
  d3_motivational: {
    bg: 'from-orange-900 via-amber-900 to-slate-900',
    accent: 'text-orange-400',
    particleColor: '#fb923c',
    icon: <Zap className="w-6 h-6" />
  },
  d4_energy: {
    bg: 'from-rose-900 via-red-900 to-slate-900',
    accent: 'text-rose-400',
    particleColor: '#fb7185',
    icon: <Activity className="w-6 h-6" />
  },
  d5_values: {
    bg: 'from-violet-900 via-purple-900 to-slate-900',
    accent: 'text-violet-400',
    particleColor: '#a78bfa',
    icon: <Shield className="w-6 h-6" />
  },
  d6_ai_readiness: {
    bg: 'from-cyan-900 via-sky-900 to-slate-900',
    accent: 'text-cyan-400',
    particleColor: '#22d3ee',
    icon: <Sparkles className="w-6 h-6" />
  },
  d7_cognitive_reflection: {
    bg: 'from-blue-950 to-slate-950',
    accent: 'text-blue-300',
    particleColor: '#93c5fd',
    icon: <HelpCircle className="w-6 h-6" />
  },
  d8_digital_eq: {
    bg: 'from-teal-950 to-slate-950',
    accent: 'text-teal-300',
    particleColor: '#5eead4',
    icon: <MessageSquare className="w-6 h-6" />
  },
  d9_systems_thinking: {
    bg: 'from-indigo-950 to-slate-950',
    accent: 'text-indigo-300',
    particleColor: '#a5b4fc',
    icon: <Layers className="w-6 h-6" />
  },
  d10_ambiguity_interpretation: {
    bg: 'from-amber-950 to-slate-950',
    accent: 'text-amber-300',
    particleColor: '#fcd34d',
    icon: <Search className="w-6 h-6" />
  },
  d11_problem_decomposition: {
    bg: 'from-slate-900 to-black',
    accent: 'text-slate-300',
    particleColor: '#cbd5e1',
    icon: <Target className="w-6 h-6" />
  },
  d12_moral_compass: {
    bg: 'from-rose-950 to-slate-950',
    accent: 'text-rose-300',
    particleColor: '#fda4af',
    icon: <Compass className="w-6 h-6" />
  },
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const isLowPowerDevice = () => {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    hardwareConcurrency?: number;
    connection?: { saveData?: boolean };
  };
  if (window.innerWidth < 768) return true;
  if (nav.connection?.saveData) return true;
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4) return true;
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4) return true;
  return false;
};

const FLOW_COPY: any = {
  cs: {
    reportLabel: 'Report',
    questionProgress: (current: number, total: number, answered: number) => `Otázka ${current} / ${total} • ${answered} zodpovězeno`,
    phaseDeep: 'Hloubkový ponor • Soustředěný režim',
    phaseStandard: 'Standardní sken',
    likertLow: 'Spíše nesouhlasím',
    likertHigh: 'Spíše souhlasím',
    missingOptions: 'Chybí data pro tuto otázku (možnosti). Ověřte prosím seed `jcfpm_items`.',
    missingOrdering: 'Chybí data pro tuto otázku (řazení). Ověřte prosím seed `jcfpm_items`.',
    missingDragDrop: 'Chybí data pro tuto otázku (drag_drop). Ověřte prosím seed `jcfpm_items`.',
    chatPeer: 'Kolega',
    chatYou: 'Vy',
    chatPrompt: 'Jaká je nejlepší odpověď?',
    sourceLabel: 'Zdroj',
    targetLabel: 'Cíl',
    targetPlaceholder: 'Vyberte cíl',
    reorderUp: 'Nahoru',
    reorderDown: 'Dolů',
    newDimension: 'Nová dimenze',
    continue: 'Pokračovat',
    timerLabel: 'Tempo',
    timerNote: 'Čas mírně ovlivňuje výsledek – hledejte rovnováhu mezi rychlostí a jistotou.',
    legendLikert: '1 = Vůbec nesouhlasím • 4 = Neutrální • 7 = Naprosto souhlasím',
    loadingQuestions: 'Načítám otázky…',
    back: 'Zpět',
    next: 'Další',
    saving: 'Ukládám...',
    finishTest: 'Dokončit test',
    finishSection: 'Ukončit sekci',
    close: 'Zavřít',
    ambientOn: 'Atmosféra zapnuta',
    ambientOff: 'Atmosféra vypnuta',
    soundOn: 'Zvuk zapnut',
    soundOff: 'Zvuk vypnut',
    errors: {
      premium: 'Tento test je dostupný pouze pro prémiové uživatele.',
      noAccess: 'Nemáte přístup k prémiovému testu.',
      missingSeed: 'Test zatím není připraven – v databázi chybí potřebné seed položky.',
      missingCount: (count: number) => `Test zatím není připraven – v databázi chybí ${count} potřebných položek.`,
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
      d2_social: { title: 'Sociální orientace', body: 'Tvůj styl interakce. Jsi vlk samotář, nebo lepidlo, které drží tým pohromadě?' },
      d3_motivational: { title: 'Motivační profil', body: 'Co tě ráno vytáhne z postele a co tě v práci skutečně naplňuje.' },
      d4_energy: { title: 'Energetický pattern', body: 'Máš tah na branku jako maratonec, nebo pálíš jako blesk v krátkých sprintech?' },
      d5_values: { title: 'Hodnotová kotvení', body: 'Tvoje kotvy. Co musí práce splňovat, abys měl čisté svědomí a pocit smyslu.' },
      d6_ai_readiness: { title: 'Adaptační kapacita', body: 'Jak moc jsi ready na digitální tsunami a spolupráci s AI.' },
      d7_cognitive_reflection: { title: 'Reflexe a logika', body: 'Dokážeš se zastavit a přemýšlet, nebo jedeš na autopilota?' },
      d8_digital_eq: { title: 'Digitální EQ', body: 'Empatie přes obrazovku. Jak čteš emoce tam, kde nejsou vidět.' },
      d9_systems_thinking: { title: 'Systémové myšlení', body: 'Vidíš les, nebo jen jednotlivé stromy? Jak chápeš souvislosti.' },
      d10_ambiguity_interpretation: { title: 'Interpretace nejasností', body: 'V chaosu vidíš hrozbu, nebo příležitost?' },
      d11_problem_decomposition: { title: 'Rozklad problémů', body: 'Umíš rozbít velký balvan na malé kamínky, se kterými se dá pracovat.' },
      d12_moral_compass: { title: 'Morální kompas', body: 'Tvoje vnitřní severka v eticky složitých situacích.' },
    },
    stories: {
      d1_cognitive: 'Začneme tím, jak přemýšlíš, třídíš informace a rozhoduješ se.',
      d2_social: 'Teď se podíváme na to, kde se ti nejlépe pracuje s lidmi.',
      d3_motivational: 'Co tě skutečně pohání? Tady zachytíme tvé motivátory.',
      d4_energy: 'V této části mapujeme tvé tempo, rytmus a pracovní energie.',
      d5_values: 'Zachytíme, jaké hodnoty musí práce naplňovat, aby dávala smysl.',
      d6_ai_readiness: 'Na závěr zjistíme, jak se cítíš v technologických a procesních změnách.',
      d7_cognitive_reflection: 'Krátké hádanky prověří tvůj “bullshit detector” and schopnost zpomalit intuici.',
      d8_digital_eq: 'Připrav se na chatové situace a interpretaci tónu v textu.',
      d9_systems_thinking: 'Budeme mapovat vztahy a zpětné vazby v jednoduchých systémech.',
      d10_ambiguity_interpretation: 'V nejasných obrazech odhalíš, zda vidíš spíš rizika nebo příležitosti.',
      d11_problem_decomposition: 'Rozložíš velké úkoly na logické kroky.',
      d12_moral_compass: 'Etická dilemata odhalí tvůj hodnotový kompas.',
    },
  },
  en: {
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
      d7_cognitive_reflection: { title: 'Reflection & Logic', subtitle: 'Ability to stop an automatic response and use logic.' },
      d8_digital_eq: { title: 'Digital EQ', subtitle: 'Empathy and emotional intelligence in asynchronous communication.' },
      d9_systems_thinking: { title: 'Systems Thinking', subtitle: 'How you see relationships, feedback loops, and complex networks.' },
      d10_ambiguity_interpretation: { title: 'Ambiguity Interpretation', subtitle: 'How you read unclear signals and distinguish risk vs opportunity.' },
      d11_problem_decomposition: { title: 'Problem Decomposition', subtitle: 'Ability to break down a large task into logical steps.' },
      d12_moral_compass: { title: 'Moral Compass', subtitle: 'Decision making in ethical dilemmas and gray areas.' },
    },
    interludes: {
      d1_cognitive: { title: 'Cognitive Style', body: 'How you think, filter information and make decisions. We are going straight for your internal "processor".' },
      d2_social: { title: 'Social Orientation', body: 'Your style of interaction. Are you a lone wolf, or the glue that holds the team together?' },
      d3_motivational: { title: 'Motivational Profile', body: 'What gets you out of bed in the morning and what truly fulfills you at work.' },
      d4_energy: { title: 'Energy Pattern', body: 'Do you have the drive of a marathon runner, or do you burn like a bolt of lightning in short sprints?' },
      d5_values: { title: 'Value Anchors', body: 'Your anchors. What work must satisfy for you to have a clear conscience and a sense of meaning.' },
      d6_ai_readiness: { title: 'Adaptive Capacity', body: 'How ready you are for the digital tsunami and collaboration with AI.' },
      d7_cognitive_reflection: { title: 'Reflection & Logic', body: 'Can you stop and think, or do you run on autopilot?' },
      d8_digital_eq: { title: 'Digital EQ', body: 'Empathy through the screen. How you read emotions where they are not visible.' },
      d9_systems_thinking: { title: 'Systems Thinking', body: 'Do you see the forest, or just individual trees? How you understand connections.' },
      d10_ambiguity_interpretation: { title: 'Ambiguity Interpretation', body: 'In chaos, do you see a threat or an opportunity?' },
      d11_problem_decomposition: { title: 'Problem Decomposition', body: 'Can you break a large boulder into small stones that can be worked with.' },
      d12_moral_compass: { title: 'Moral Compass', body: 'Your internal north star in ethically complex situations.' },
    },
    stories: {
      d1_cognitive: 'We start with how you think, categorize information, and make decisions.',
      d2_social: 'Now we look at where you work best with people.',
      d3_motivational: 'What truly drives you? Here we capture your motivators.',
      d4_energy: 'In this part, we map your pace, rhythm, and work energy.',
      d5_values: 'We capture what values work must fulfill to make sense.',
      d6_ai_readiness: 'Finally, we find out how you feel in technological and process changes.',
      d7_cognitive_reflection: 'Short puzzles will test your "bullshit detector" and ability to slow down your intuition.',
      d8_digital_eq: 'Prepare for chat situations and interpretation of tone in text.',
      d9_systems_thinking: 'We will map relationships and feedback loops in simple systems.',
      d10_ambiguity_interpretation: 'In unclear images, you will reveal whether you see risks or opportunities.',
      d11_problem_decomposition: 'You break down large tasks into logical steps.',
      d12_moral_compass: 'Ethical dilemmas will reveal your value compass.',
    },
  },
  de: {
    reportLabel: 'Bericht',
    questionProgress: (current: number, total: number, answered: number) => `Frage ${current} / ${total} • ${answered} beantwortet`,
    phaseDeep: 'Vertiefung • Fokusmodus',
    phaseStandard: 'Standard-Scan',
    likertLow: 'Stimme eher nicht zu',
    likertHigh: 'Stimme eher zu',
    missingOptions: 'Fehlende Daten für diese Frage (Optionen). Bitte überprüfen Sie den Seed `jcfpm_items`.',
    missingOrdering: 'Fehlende Daten für diese Frage (Reihenfolge). Bitte überprüfen Sie den Seed `jcfpm_items`.',
    missingDragDrop: 'Fehlende Daten für diese Frage (Drag & Drop). Bitte überprüfen Sie den Seed `jcfpm_items`.',
    chatPeer: 'Kollege',
    chatYou: 'Du',
    chatPrompt: 'Was ist die beste Antwort?',
    sourceLabel: 'Quelle',
    targetLabel: 'Ziel',
    targetPlaceholder: 'Ziel auswählen',
    reorderUp: 'Hoch',
    reorderDown: 'Runter',
    newDimension: 'Neue Dimension',
    continue: 'Weiter',
    timerLabel: 'Tempo',
    timerNote: 'Zeit beeinflusst das Ergebnis leicht – suchen Sie nach einem Gleichgewicht zwischen Geschwindigkeit und Sicherheit.',
    legendLikert: '1 = Stimme überhaupt nicht zu • 4 = Neutral • 7 = Stimme voll und ganz zu',
    loadingQuestions: 'Fragen werden geladen…',
    back: 'Zurück',
    next: 'Weiter',
    saving: 'Speichern...',
    finishTest: 'Test abschließen',
    finishSection: 'Abschnitt beenden',
    close: 'Schließen',
    ambientOn: 'Atmosphäre an',
    ambientOff: 'Atmosphäre aus',
    soundOn: 'Ton an',
    soundOff: 'Ton aus',
    errors: {
      premium: 'Dieser Test ist nur für Premium-Benutzer verfügbar.',
      noAccess: 'Sie haben keinen Zugriff auf den Premium-Test.',
      missingSeed: 'Der Test ist noch nicht bereit – erforderliche Seed-Elemente fehlen in der Datenbank.',
      missingCount: (count: number) => `Der Test ist noch nicht bereit – ${count} erforderliche Elemente fehlen in der Datenbank.`,
      generic: 'Fragen konnten nicht geladen werden. Bitte versuchen Sie es erneut.',
    },
    dimensions: {
      d1_cognitive: { title: 'Kognitiver Stil', subtitle: 'Wie du denkst und Probleme löst.' },
      d2_social: { title: 'Soziale Orientierung', subtitle: 'Wie du im Team, in der Kommunikation und Führung funktionierst.' },
      d3_motivational: { title: 'Motivationsprofil', subtitle: 'Was dich antreibt und what du als Belohnung betrachtest.' },
      d4_energy: { title: 'Energie-Muster', subtitle: 'Tempo, Intensität und Arbeitsstil.' },
      d5_values: { title: 'Werteverankerung', subtitle: 'Was Arbeit bieten muss, damit sie sinnvoll ist.' },
      d6_ai_readiness: { title: 'Anpassungsfähigkeit (Technologie)', subtitle: 'Wie gut du in einer sich verändernden technologischen Umgebung gedeihst.' },
      d7_cognitive_reflection: { title: 'Reflexion & Logik', subtitle: 'Fähigkeit, eine automatische Antwort zu stoppen und Logik anzuwenden.' },
      d8_digital_eq: { title: 'Digitaler EQ', subtitle: 'Empathie und emotionale Intelligenz in asynchroner Kommunikation.' },
      d9_systems_thinking: { title: 'Systemdenken', subtitle: 'Wie du Beziehungen, Rückkopplungsschleifen und komplexe Netzwerke siehst.' },
      d10_ambiguity_interpretation: { title: 'Ambiguitätsinterpretation', subtitle: 'Wie du unklare Signale liest und zwischen Risiko und Chance unterscheidest.' },
      d11_problem_decomposition: { title: 'Problemzerlegung', subtitle: 'Fähigkeit, eine große Aufgabe in logische Schritte zu zerlegen.' },
      d12_moral_compass: { title: 'Moralischer Kompass', subtitle: 'Entscheidungsfindung in ethischen Dilemmata und Grauzonen.' },
    },
    interludes: {
      d1_cognitive: { title: 'Kognitiver Stil', body: 'Wie du denkst, Informationen filterst und Entscheidungen triffst. Wir gehen direkt zu deinem internen "Prozessor".' },
      d2_social: { title: 'Soziale Orientierung', body: 'Dein Interaktionsstil. Bist du ein einsamer Wolf oder der Klebstoff, der das Team zusammenhält?' },
      d3_motivational: { title: 'Motivationsprofil', body: 'Was dich morgens aus dem Bett holt und was dich bei der Arbeit wirklich erfüllt.' },
      d4_energy: { title: 'Energie-Muster', body: 'Hast du den Drive eines Marathonläufers oder brennst du wie ein Blitz in kurzen Sprints?' },
      d5_values: { title: 'Werteverankerung', body: 'Deine Anker. Was Arbeit erfüllen muss, damit du ein reines Gewissen und ein Gefühl von Sinn hast.' },
      d6_ai_readiness: { title: 'Anpassungsfähigkeit', body: 'Wie bereit du für den digitalen Tsunami und die Zusammenarbeit mit KI bist.' },
      d7_cognitive_reflection: { title: 'Reflexion & Logik', body: 'Kannst du innehalten und nachdenken, oder läufst du auf Autopilot?' },
      d8_digital_eq: { title: 'Digitaler EQ', body: 'Empathie durch den Bildschirm. Wie du Emotionen dort liest, wo sie nicht sichtbar sind.' },
      d9_systems_thinking: { title: 'Systemdenken', body: 'Siehst du den Wald oder nur einzelne Bäume? Wie du Zusammenhänge verstehst.' },
      d10_ambiguity_interpretation: { title: 'Ambiguitätsinterpretation', body: 'Siehst du im Chaos eine Bedrohung oder eine Chance?' },
      d11_problem_decomposition: { title: 'Problemzerlegung', body: 'Kannst du einen großen Felsen in kleine Steine zerlegen, mit denen man arbeiten kann.' },
      d12_moral_compass: { title: 'Moralischer Kompass', body: 'Dein interner Nordstern in ethisch komplexen Situationen.' },
    },
    stories: {
      d1_cognitive: 'Wir beginnen damit, wie du denkst, Informationen kategorisierst und Entscheidungen triffst.',
      d2_social: 'Jetzt schauen wir uns an, wo du am besten mit Menschen zusammenarbeitest.',
      d3_motivational: 'Was treibt dich wirklich an? Hier erfassen wir deine Motivatoren.',
      d4_energy: 'In diesem Teil bilden wir dein Tempo, deinen Rhythmus und deine Arbeitsenergie ab.',
      d5_values: 'Wir erfassen, welche Werte die Arbeit erfüllen muss, damit sie Sinn macht.',
      d6_ai_readiness: 'Schließlich finden wir heraus, wie du dich bei technologischen und prozessualen Veränderungen fühlst.',
      d7_cognitive_reflection: 'Kurze Rätsel testen deinen „Bullshit-Detektor“ und deine Fähigkeit, deine Intuition zu verlangsamen.',
      d8_digital_eq: 'Bereite dich auf Chat-Situationen und die Interpretation des Tonfalls in Texten vor.',
      d9_systems_thinking: 'Wir werden Beziehungen und Rückkopplungsschleifen in einfachen Systemen abbilden.',
      d10_ambiguity_interpretation: 'In unklaren Bildern wirst du verraten, ob du eher Risiken oder Chancen siehst.',
      d11_problem_decomposition: 'Du zerlegst große Aufgaben in logische Schritte.',
      d12_moral_compass: 'Ethische Dilemmata werden deinen Wertekompass offenbaren.',
    },
  },
};

const buildDimensions = (copy: any) => ({
  d1_cognitive: { title: copy.dimensions.d1_cognitive.title, subtitle: copy.dimensions.d1_cognitive.subtitle },
  d2_social: { title: copy.dimensions.d2_social.title, subtitle: copy.dimensions.d2_social.subtitle },
  d3_motivational: { title: copy.dimensions.d3_motivational.title, subtitle: copy.dimensions.d3_motivational.subtitle },
  d4_energy: { title: copy.dimensions.d4_energy.title, subtitle: copy.dimensions.d4_energy.subtitle },
  d5_values: { title: copy.dimensions.d5_values.title, subtitle: copy.dimensions.d5_values.subtitle },
  d6_ai_readiness: { title: copy.dimensions.d6_ai_readiness.title, subtitle: copy.dimensions.d6_ai_readiness.subtitle },
  d7_cognitive_reflection: { title: copy.dimensions.d7_cognitive_reflection.title, subtitle: copy.dimensions.d7_cognitive_reflection.subtitle },
  d8_digital_eq: { title: copy.dimensions.d8_digital_eq.title, subtitle: copy.dimensions.d8_digital_eq.subtitle },
  d9_systems_thinking: { title: copy.dimensions.d9_systems_thinking.title, subtitle: copy.dimensions.d9_systems_thinking.subtitle },
  d10_ambiguity_interpretation: { title: copy.dimensions.d10_ambiguity_interpretation.title, subtitle: copy.dimensions.d10_ambiguity_interpretation.subtitle },
  d11_problem_decomposition: { title: copy.dimensions.d11_problem_decomposition.title, subtitle: copy.dimensions.d11_problem_decomposition.subtitle },
  d12_moral_compass: { title: copy.dimensions.d12_moral_compass.title, subtitle: copy.dimensions.d12_moral_compass.subtitle },
});

const buildInterludes = (copy: any) => ({
  d1_cognitive: { title: copy.interludes.d1_cognitive.title, body: copy.interludes.d1_cognitive.body, story: copy.stories.d1_cognitive },
  d2_social: { title: copy.interludes.d2_social.title, body: copy.interludes.d2_social.body, story: copy.stories.d2_social },
  d3_motivational: { title: copy.interludes.d3_motivational.title, body: copy.interludes.d3_motivational.body, story: copy.stories.d3_motivational },
  d4_energy: { title: copy.interludes.d4_energy.title, body: copy.interludes.d4_energy.body, story: copy.stories.d4_energy },
  d5_values: { title: copy.interludes.d5_values.title, body: copy.interludes.d5_values.body, story: copy.stories.d5_values },
  d6_ai_readiness: { title: copy.interludes.d6_ai_readiness.title, body: copy.interludes.d6_ai_readiness.body, story: copy.stories.d6_ai_readiness },
  d7_cognitive_reflection: { title: copy.interludes.d7_cognitive_reflection.title, body: copy.interludes.d7_cognitive_reflection.body, story: copy.stories.d7_cognitive_reflection },
  d8_digital_eq: { title: copy.interludes.d8_digital_eq.title, body: copy.interludes.d8_digital_eq.body, story: copy.stories.d8_digital_eq },
  d9_systems_thinking: { title: copy.interludes.d9_systems_thinking.title, body: copy.interludes.d9_systems_thinking.body, story: copy.stories.d9_systems_thinking },
  d10_ambiguity_interpretation: { title: copy.interludes.d10_ambiguity_interpretation.title, body: copy.interludes.d10_ambiguity_interpretation.body, story: copy.stories.d10_ambiguity_interpretation },
  d11_problem_decomposition: { title: copy.interludes.d11_problem_decomposition.title, body: copy.interludes.d11_problem_decomposition.body, story: copy.stories.d11_problem_decomposition },
  d12_moral_compass: { title: copy.interludes.d12_moral_compass.title, body: copy.interludes.d12_moral_compass.body, story: copy.stories.d12_moral_compass },
});


interface JcfpmFlowProps {
  userId: string;
  isPremium: boolean;
  section: string;
  theme: 'light' | 'dark';
  onPersist: (snapshot: any) => Promise<void>;
  onClose: () => void;
}

export default function JcfpmFlow({
  userId,
  isPremium,
  section,
  theme: appTheme,
  onPersist,
  onClose
}: JcfpmFlowProps) {
  const { i18n } = useTranslation();
  const language = (i18n.language || 'cs') as string;
  const copy = FLOW_COPY[language] || FLOW_COPY.cs;
  const dimensions = buildDimensions(copy);
  const interludes = buildInterludes(copy);
  const effectiveSection = isPremium ? section : 'basic';

  // State
  const [items, setItems] = useState<JcfpmItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [status, setStatus] = useState<'loading' | 'intro' | 'interlude' | 'question' | 'saving' | 'error' | 'premium_check' | 'finished'>('premium_check');
  const [error, setError] = useState<string | null>(null);
  const [showSound, setShowSound] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const confettiRef = useRef<ReturnType<typeof confetti.create> | null>(null);
  const celebrationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const celebrationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialization
  useEffect(() => {
    if (!prefersReducedMotion()) {
      try {
        confettiRef.current = confetti.create(undefined, {
          resize: true,
          useWorker: true,
        });
      } catch {
        confettiRef.current = null;
      }
    }
    fetchQuestions();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current);
      if (celebrationIntervalRef.current) clearInterval(celebrationIntervalRef.current);
    };
  }, []);

  const launchConfetti = (options: Parameters<typeof confetti>[0]) => {
    if (prefersReducedMotion()) return;
    const fire = confettiRef.current || confetti;
    fire(options);
  };
  const lowPowerMode = isLowPowerDevice();

  const fetchQuestions = async () => {
    try {
      setStatus('loading');
      const data = await fetchJcfpmItems();

      if (!data || data.length === 0) {
        setStatus('error');
        setError(copy.errors.missingSeed || 'No test items found.');
        return;
      }

      // 1. Get seen pools from session/localStorage
      const storageKey = `jcfpm_seen_pools_${effectiveSection || 'standard'}`;
      let seenKeys: string[] = [];
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) seenKeys = JSON.parse(stored);
      } catch (e) {
        console.warn('Failed to parse seen keys', e);
      }

      // 2. Sample items with exclusion support
      const itemsPerDim = effectiveSection === 'deep_dive' ? 5 : 3;
      const sampled = sampleJcfpmItems(data, itemsPerDim, effectiveSection, seenKeys);

      // 3. Update seen keys (keep a moving window of ~30-50 keys to eventually repeat but not soon)
      const sampledKeys = sampled.map(i => i.pool_key || i.id).filter(Boolean);
      const nextSeen = [...new Set([...sampledKeys, ...seenKeys])].slice(0, 48);
      try {
        localStorage.setItem(storageKey, JSON.stringify(nextSeen));
      } catch (e) {
        // Ignored
      }

      setItems(sampled);
      setStatus('intro');
    } catch (err: any) {
      console.error('JCFPM Fetch Error:', err);
      setStatus('error');
      setError(err.message);
    }
  };

  const handleStart = () => {
    setStatus('question');
    startTimer();
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => prev + 1);
    }, 1000);
  };

  const handleAnswer = (value: any) => {
    const currentItem = items[currentIndex];
    // Use .id instead of ._id as it's normalized in the service
    setAnswers(prev => ({ ...prev, [currentItem.id]: value }));
    nextStep();
  };

  const nextStep = () => {
    if (currentIndex < items.length - 1) {
      const currentDim = items[currentIndex].dimension;
      const nextDim = items[currentIndex + 1].dimension;

      if (currentDim !== nextDim) {
        // Dimension completed - use CSS-only celebration in the interlude card.
        if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current);
        celebrationTimeoutRef.current = setTimeout(() => {
          setStatus('interlude');
        }, 300);
      } else {
        setCurrentIndex(prev => prev + 1);
        setStatus('question');
      }
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    setStatus('saving');

    try {
      // Create a snapshot of the results
      const snapshot = {
        userId,
        answers,
        completedAt: new Date().toISOString(),
        timeSpentSeconds: timeLeft,
        schema_version: '1.0',
        confidence: 0.95 // Placeholder for now
      };

      // Call the parent's onPersist handler
      if (onPersist) {
        await onPersist(snapshot);
      }

      if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current);
      celebrationTimeoutRef.current = setTimeout(() => {
        // Test finished - smoother, lower-cost celebration.
        const duration = 1.4 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = {
          startVelocity: lowPowerMode ? 18 : 24,
          spread: lowPowerMode ? 90 : 120,
          ticks: lowPowerMode ? 52 : 70,
          scalar: lowPowerMode ? 0.72 : 0.9,
          zIndex: 0,
        };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        if (celebrationIntervalRef.current) clearInterval(celebrationIntervalRef.current);
        celebrationIntervalRef.current = setInterval(function () {
          const timeLeft = animationEnd - Date.now();
          if (timeLeft <= 0) {
            if (celebrationIntervalRef.current) {
              clearInterval(celebrationIntervalRef.current);
              celebrationIntervalRef.current = null;
            }
            return;
          }

          const particleCount = Math.max(lowPowerMode ? 4 : 6, Math.round((lowPowerMode ? 10 : 18) * (timeLeft / duration)));
          launchConfetti({ ...defaults, particleCount, origin: { x: randomInRange(0.18, 0.34), y: 0.08 } });
          if (!lowPowerMode) {
            launchConfetti({ ...defaults, particleCount, origin: { x: randomInRange(0.66, 0.82), y: 0.08 } });
          }
        }, lowPowerMode ? 420 : 320);

        setStatus('finished');
      }, 1500);
    } catch (err: any) {
      setStatus('error');
      setError(err.message || copy.errors.generic);
    }
  };

  // Check premium access
  // Rendering helpers
  const currentItem = items[currentIndex];
  const currentDimension = currentItem?.dimension as JcfpmDimension;
  const theme = DIMENSION_THEMES[currentDimension] || DIMENSION_THEMES.d1_cognitive;

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] space-y-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Brain className="w-12 h-12 text-blue-500" />
        </motion.div>
        <p className="text-slate-400 animate-pulse">{copy.loadingQuestions}</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] text-center px-4 max-w-md mx-auto">
        <AlertCircle className="w-16 h-16 text-rose-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">Ups!</h2>
        <p className="text-slate-400 mb-6">{error || copy.errors.generic}</p>
        <button
          onClick={fetchQuestions}
          className="px-6 py-2 border border-slate-700 rounded-xl text-slate-300 hover:bg-slate-800 transition-colors"
        >
          Zkusit znovu
        </button>
      </div>
    );
  }

  if (status === 'intro') {
    return (
      <div className={cn(
        "relative min-h-[800px] w-full max-w-5xl mx-auto rounded-3xl overflow-hidden shadow-2xl transition-colors duration-1000 bg-gradient-to-br",
        DIMENSION_THEMES.d1_cognitive.bg
      )}>
        <div className="relative z-10 flex flex-col items-center justify-center min-h-[800px] p-8 text-center space-y-8">
          <div className="p-6 rounded-full bg-white/10 backdrop-blur-xl">
            <Brain className="w-16 h-16 text-blue-400" />
          </div>
          <h1 className="text-5xl font-black text-white leading-tight uppercase tracking-tighter">
            JCFPM Test
          </h1>
          <p className="text-xl text-white/70 max-w-lg leading-relaxed">
            Vítejte v hloubkové analýze vašeho kognitivního stylu a pracovního potenciálu.
            Dokončení testu zabere přibližně 15-20 minut.
          </p>
          <button
            onClick={handleStart}
            className="px-12 py-4 bg-white text-blue-900 text-xl font-bold rounded-2xl hover:scale-105 transition-transform shadow-xl"
          >
            Spustit test
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "relative min-h-[800px] w-full max-w-5xl mx-auto rounded-3xl overflow-hidden shadow-2xl transition-colors duration-1000 bg-gradient-to-br",
      theme.bg,
      appTheme === 'dark' ? 'dark' : ''
    )}>
      {/* Background Particles Decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              backgroundColor: theme.particleColor,
              width: Math.random() * 20 + 5,
              height: Math.random() * 20 + 5,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, Math.random() * 100 - 50],
              x: [0, Math.random() * 100 - 50],
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{
              duration: Math.random() * 10 + 10,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        ))}
      </div>

      {/* Header UI */}
      <div className="relative z-10 p-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={cn("p-2 rounded-xl bg-white/10 backdrop-blur-md shadow-lg", theme.accent)}>
            {theme.icon}
          </div>
          <div>
            <h3 className="font-bold text-white text-lg">{dimensions[currentDimension]?.title}</h3>
            <p className="text-white/60 text-sm hidden sm:block">{dimensions[currentDimension]?.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-white/40 text-[10px] uppercase tracking-widest">{copy.timerLabel}</span>
            <span className="text-white font-mono text-sm">
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </span>
          </div>
          <button
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            onClick={() => setShowSound(!showSound)}
          >
            {showSound ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>

          {/* Close button */}
          <button
            className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            onClick={onClose}
            title={copy.close}
          >
            <AlertCircle className="rotate-45" size={20} />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative z-10 px-6 mb-8">
        <div className="flex justify-between items-end mb-2">
          <span className="text-white/40 text-xs font-medium">
            {copy.questionProgress(currentIndex + 1, items.length, Object.keys(answers).length)}
          </span>
          <span className="text-white/60 text-xs font-bold">
            {Math.round(((currentIndex + 1) / items.length) * 100)}%
          </span>
        </div>
        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden backdrop-blur-sm">
          <motion.div
            className={cn("h-full transition-all duration-500 ease-out", theme.accent.replace('text-', 'bg-'))}
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex + 1) / items.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 p-6 pb-24 min-h-[500px] flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {status === 'question' && currentItem && (
            <motion.div
              key={currentItem.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-12"
            >
              <div className="text-center space-y-4 max-w-2xl mx-auto">
                <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                  {currentItem.prompt_i18n?.[language] || currentItem.prompt}
                </h2>
                {(currentItem.subdimension_i18n?.[language] || currentItem.subdimension) && (
                  <p className="text-white/50 italic text-sm">
                    {currentItem.subdimension_i18n?.[language] || currentItem.subdimension}
                  </p>
                )}
              </div>

              <div className="max-w-3xl mx-auto">
                {(currentItem.item_type === 'likert' || !currentItem.item_type) && (
                  <div className="space-y-10">
                    <div className="flex justify-between items-center px-2">
                      {[1, 2, 3, 4, 5, 6, 7].map((val) => (
                        <motion.button
                          key={val}
                          whileHover={{ scale: 1.15, y: -5 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleAnswer(val)}
                          className={cn(
                            "group relative flex flex-col items-center justify-center",
                            "w-10 h-10 sm:w-14 sm:h-14 rounded-full border-2 transition-all duration-300",
                            "bg-white/5 backdrop-blur-md",
                            val === 4 ? "border-white/20" : "border-white/10",
                            "hover:border-white/40 hover:bg-white/10"
                          )}
                        >
                          <span className="text-lg sm:text-xl font-bold text-white">{val}</span>
                          <div className={cn(
                            "absolute -top-1 -right-1 w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity",
                            theme.particleColor === '#60a5fa' ? 'bg-blue-400' :
                              theme.particleColor === '#34d399' ? 'bg-emerald-400' :
                                theme.particleColor === '#fb923c' ? 'bg-orange-400' :
                                  theme.particleColor === '#fb7185' ? 'bg-rose-400' : 'bg-white'
                          )} />
                        </motion.button>
                      ))}
                    </div>
                    <div className="flex justify-between px-4">
                      <span className="text-white/30 text-[10px] sm:text-xs uppercase tracking-widest font-bold">{copy.likertLow}</span>
                      <span className="text-white/30 text-[10px] sm:text-xs uppercase tracking-widest font-bold">{copy.likertHigh}</span>
                    </div>
                  </div>
                )}

                {/* Basic support for MCQ / Scenarios if they slip in */}
                {(currentItem.item_type === 'mcq' || currentItem.item_type === 'scenario_choice') && (
                  <div className="grid grid-cols-1 gap-4">
                    {(currentItem.payload?.options as any[] | undefined)?.map((opt: any) => (
                      <button
                        key={opt.id || opt.text}
                        onClick={() => handleAnswer(opt.id || opt.text)}
                        className="p-4 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/10 text-white text-left transition-all"
                      >
                        {opt.text_i18n?.[language] || opt.text || opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {status === 'interlude' && currentDimension && (
            <motion.div
              key={`inter-${currentDimension}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="jcfpm-interlude-burst max-w-2xl mx-auto text-center space-y-8"
              style={{ ['--jcfpm-burst-color' as any]: theme.particleColor || '#ffffff' }}
            >
              <div className="jcfpm-burst-layer" aria-hidden="true">
                {Array.from({ length: lowPowerMode ? 8 : 14 }).map((_, idx) => (
                  <span
                    key={idx}
                    className="jcfpm-burst-dot"
                    style={{
                      ['--burst-x' as any]: `${Math.cos((idx / (lowPowerMode ? 8 : 14)) * Math.PI * 2) * (lowPowerMode ? 54 : 76)}px`,
                      ['--burst-y' as any]: `${Math.sin((idx / (lowPowerMode ? 8 : 14)) * Math.PI * 2) * (lowPowerMode ? 38 : 58)}px`,
                      animationDelay: `${idx * 24}ms`,
                    }}
                  />
                ))}
              </div>
              <div className={cn("inline-flex p-5 rounded-3xl bg-white/10 backdrop-blur-xl shadow-2xl", theme.accent)}>
                {React.cloneElement(theme.icon as React.ReactElement, { className: "w-12 h-12" })}
              </div>
              <div className="space-y-4">
                <h2 className="text-3xl sm:text-4xl font-black text-white">{interludes[currentDimension]?.title}</h2>
                <p className="text-white/70 text-lg leading-relaxed">{interludes[currentDimension]?.body}</p>
                <div className="text-white/40 italic mt-6 bg-black/20 p-4 rounded-xl">
                  "{interludes[currentDimension]?.story}"
                </div>
              </div>
              <button
                onClick={() => {
                  setCurrentIndex(prev => prev + 1);
                  setStatus('question');
                }}
                className={cn(
                  "inline-flex items-center h-14 px-10 text-lg font-bold rounded-2xl transition-all duration-300 transform group",
                  "bg-white text-slate-900 hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                )}
              >
                {copy.continue}
                <ChevronRight className="ml-2 group-hover:translate-x-1" />
              </button>
            </motion.div>
          )}

          {status === 'finished' && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-xl mx-auto text-center space-y-8"
            >
              <div className="p-8 bg-white/10 backdrop-blur-2xl rounded-[3rem] border border-white/20 shadow-2xl">
                <div className="w-24 h-24 bg-emerald-500/20 border-4 border-emerald-500/50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_50px_rgba(16,185,129,0.3)]">
                  <Check className="w-12 h-12 text-emerald-400" />
                </div>
                <h2 className="text-4xl font-black text-white mb-4 italic uppercase tracking-tighter">Máš hotovo!</h2>
                <p className="text-white/60 text-lg leading-relaxed mb-10">
                  Právě jsi dokončil JCFPM ponor do své vnitřní logiky, hodnot a stylu práce. Generujeme tvůj unikátní report...
                </p>
                <button
                  className="w-full h-16 inline-flex items-center justify-center text-xl font-bold bg-white text-slate-900 rounded-3xl hover:bg-slate-100 group transition-all"
                  onClick={onClose}
                >
                  Zobrazit můj profil
                  <ChevronRight className="ml-2 group-hover:translate-x-2 transition-transform" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Navigation (only for question mode) */}
      {status === 'question' && (
        <div className="absolute bottom-0 left-0 right-0 p-6 flex justify-between items-center border-t border-white/5 bg-gradient-to-t from-black/40 to-transparent backdrop-blur-sm z-20">
          <button
            className="inline-flex items-center text-white/40 hover:text-white disabled:opacity-30 transition-colors"
            onClick={() => currentIndex > 0 && setCurrentIndex(prev => prev - 1)}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="mr-2" />
            {copy.back}
          </button>

          <div className="hidden md:flex items-center text-white/30 text-[10px] uppercase tracking-widest font-black gap-2">
            <HelpCircle size={12} />
            {copy.legendLikert}
          </div>

          <button
            className="inline-flex items-center text-white/40 hover:text-white disabled:opacity-30 transition-colors"
            onClick={() => currentIndex < items.length - 1 && nextStep()}
            disabled={currentIndex === items.length - 1}
          >
            {copy.next}
            <ChevronRight className="ml-2" />
          </button>
        </div>
      )}
    </div>
  );
}
