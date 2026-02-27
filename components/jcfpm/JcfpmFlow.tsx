import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Save, X, Volume2, VolumeX, Sparkles, Clock } from 'lucide-react';
import { JcfpmItem, JcfpmSnapshotV1, JcfpmDimensionId } from '../../types';
import { fetchJcfpmItems, submitJcfpm } from '../../services/jcfpmService';
import { clearJcfpmDraft, readJcfpmDraft, writeJcfpmDraft } from '../../services/jcfpmSessionState';
import JcfpmReportPanel from './JcfpmReportPanel';

interface Props {
  initialSnapshot?: JcfpmSnapshotV1 | null;
  mode?: 'form' | 'report';
  section?: 'full' | 'core' | 'deep';
  userId?: string | null;
  onPersist: (snapshot: JcfpmSnapshotV1) => void | Promise<void>;
  onClose: () => void;
}

const DIMENSIONS: { id: JcfpmDimensionId; title: string; subtitle: string }[] = [
  {
    id: 'd1_cognitive',
    title: 'Kognitivní styl',
    subtitle: 'Jak přemýšlíš a jak řešíš problémy.'
  },
  {
    id: 'd2_social',
    title: 'Sociální orientace',
    subtitle: 'Jak funguješ v týmu, komunikaci a leadershipu.'
  },
  {
    id: 'd3_motivational',
    title: 'Motivační profil',
    subtitle: 'Co tě pohání a co považuješ za odměnu.'
  },
  {
    id: 'd4_energy',
    title: 'Energetický pattern',
    subtitle: 'Tempo, intenzita a styl práce.'
  },
  {
    id: 'd5_values',
    title: 'Hodnotová kotvení',
    subtitle: 'Co musí práce přinášet, aby dávala smysl.'
  },
  {
    id: 'd6_ai_readiness',
    title: 'Adaptační kapacita (AI Readiness)',
    subtitle: 'Jak dobře prosperuješ v měnícím se tech prostředí.'
  },
  {
    id: 'd7_cognitive_reflection',
    title: 'Cognitive Reflection & Logic',
    subtitle: 'Schopnost odhalit chybnou intuici a přepnout do logiky.'
  },
  {
    id: 'd8_digital_eq',
    title: 'Digitální EQ',
    subtitle: 'Empatie a práce s emocemi v asynchronní komunikaci.'
  },
  {
    id: 'd9_systems_thinking',
    title: 'Systémové myšlení',
    subtitle: 'Jak vidíš vztahy, zpětné vazby a komplexní sítě.'
  },
  {
    id: 'd10_ambiguity_interpretation',
    title: 'Interpretace ambiguity',
    subtitle: 'Jak čteš nejasné signály a vnímáš rizika vs. příležitosti.'
  },
  {
    id: 'd11_problem_decomposition',
    title: 'Rozklad problémů',
    subtitle: 'Schopnost rozsekat velký úkol na logické kroky.'
  },
  {
    id: 'd12_moral_compass',
    title: 'Morální & etický kompas',
    subtitle: 'Rozhodování v etických dilematech a šedých zónách.'
  },
];

const DEEP_DIVE_DIMENSIONS = new Set<JcfpmDimensionId>([
  'd7_cognitive_reflection',
  'd8_digital_eq',
  'd9_systems_thinking',
  'd10_ambiguity_interpretation',
  'd11_problem_decomposition',
  'd12_moral_compass',
]);

const LIKERT = [1, 2, 3, 4, 5, 6, 7];

const INTERLUDES: Record<JcfpmDimensionId, { title: string; body: string }> = {
  d1_cognitive: {
    title: 'Kognitivní styl',
    body: 'Jak přemýšlíš, filtruješ informace a rozhoduješ se. Půjdeme přímo po tvém vnitřním „procesoru“.',
  },
  d2_social: {
    title: 'Sociální orientace',
    body: 'Kde se cítíš nejlépe mezi lidmi? Zda ti víc sedí spolupráce, vedení, nebo klidná samostatnost.',
  },
  d3_motivational: {
    title: 'Motivační profil',
    body: 'Co tě dlouhodobě žene kupředu a co tě naopak vyčerpává. Teď zachytíme tvé motivátory.',
  },
  d4_energy: {
    title: 'Energetický pattern',
    body: 'Tvé tempo, rytmus a pracovní energie. Najdeme styl, ve kterém umíš podávat nejlepší výkon.',
  },
  d5_values: {
    title: 'Hodnotová kotvení',
    body: 'Kdy práce opravdu dává smysl. Tady mapujeme hodnoty, bez kterých to „nesedí“.',
  },
  d6_ai_readiness: {
    title: 'AI readiness',
    body: 'Jak se cítíš v proměnách a nových technologiích. Závěrečný pohled na adaptabilitu.',
  },
  d7_cognitive_reflection: {
    title: 'Cognitive Reflection & Logic',
    body: 'Tvoje schopnost zastavit automatickou odpověď a zapojit hlubší logiku.',
  },
  d8_digital_eq: {
    title: 'Digitální EQ',
    body: 'Empatie a důvěra v asynchronní komunikaci – Slack, e-mail, chat.',
  },
  d9_systems_thinking: {
    title: 'Systémové myšlení',
    body: 'Mapování vztahů, zpětných vazeb a nelineárních dopadů.',
  },
  d10_ambiguity_interpretation: {
    title: 'Interpretace ambiguity',
    body: 'Jak čteš nejasné signály a co v nich vidíš jako první.',
  },
  d11_problem_decomposition: {
    title: 'Rozklad problémů',
    body: 'Schopnost rozsekat velký a vágní úkol na logické kroky.',
  },
  d12_moral_compass: {
    title: 'Morální & etický kompas',
    body: 'Jak se rozhoduješ v etických dilematech, kde není manuál.',
  },
};

const D10_IMAGE_ASSETS = {
  a: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc2NDAnIGhlaWdodD0nNDAwJyB2aWV3Qm94PScwIDAgNjQwIDQwMCc+CjxkZWZzPgogIDxsaW5lYXJHcmFkaWVudCBpZD0nZycgeDE9JzAnIHkxPScwJyB4Mj0nMScgeTI9JzEnPgogICAgPHN0b3Agb2Zmc2V0PScwJScgc3RvcC1jb2xvcj0nIzBlYTVlOScvPgogICAgPHN0b3Agb2Zmc2V0PScxMDAlJyBzdG9wLWNvbG9yPScjMjJjNTVlJy8+CiAgPC9saW5lYXJHcmFkaWVudD4KPC9kZWZzPgo8cmVjdCB3aWR0aD0nNjQwJyBoZWlnaHQ9JzQwMCcgZmlsbD0ndXJsKCNnKScvPgo8Y2lyY2xlIGN4PScxNDAnIGN5PScxMTAnIHI9JzgwJyBmaWxsPSdyZ2JhKDI1NSwyNTUsMjU1LDAuMzUpJy8+CjxjaXJjbGUgY3g9JzUyMCcgY3k9JzMwMCcgcj0nMTIwJyBmaWxsPSdyZ2JhKDE1LDIzLDQyLDAuMjIpJy8+Cjwvc3ZnPg==',
  b: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc2NDAnIGhlaWdodD0nNDAwJyB2aWV3Qm94PScwIDAgNjQwIDQwMCc+CjxkZWZzPgogIDxsaW5lYXJHcmFkaWVudCBpZD0nZycgeDE9JzEnIHkxPScwJyB4Mj0nMCcgeTI9JzEnPgogICAgPHN0b3Agb2Zmc2V0PScwJScgc3RvcC1jb2xvcj0nI2E4NTVmNycvPgogICAgPHN0b3Agb2Zmc2V0PScxMDAlJyBzdG9wLWNvbG9yPScjZjk3MzE2Jy8+CiAgPC9saW5lYXJHcmFkaWVudD4KPC9kZWZzPgo8cmVjdCB3aWR0aD0nNjQwJyBoZWlnaHQ9JzQwMCcgZmlsbD0ndXJsKCNnKScvPgo8cGF0aCBkPSdNMCwzMDAgQzEyMCwyNjAgMjAwLDM2MCAzMjAsMzIwIEM0NDAsMjgwIDUyMCwyMDAgNjQwLDIyMCBMNjQwLDQwMCBMMCw0MDAgWicgZmlsbD0ncmdiYSgyNTUsMjU1LDI1NSwwLjM1KScvPgo8L3N2Zz4=',
  c: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc2NDAnIGhlaWdodD0nNDAwJyB2aWV3Qm94PScwIDAgNjQwIDQwMCc+CjxkZWZzPgogIDxsaW5lYXJHcmFkaWVudCBpZD0nZycgeDE9JzAnIHkxPScxJyB4Mj0nMScgeTI9JzAnPgogICAgPHN0b3Agb2Zmc2V0PScwJScgc3RvcC1jb2xvcj0nIzE0YjhhNicvPgogICAgPHN0b3Agb2Zmc2V0PScxMDAlJyBzdG9wLWNvbG9yPScjZjQzZjVlJy8+CiAgPC9saW5lYXJHcmFkaWVudD4KPC9kZWZzPgo8cmVjdCB3aWR0aD0nNjQwJyBoZWlnaHQ9JzQwMCcgZmlsbD0ndXJsKCNnKScvPgo8cmVjdCB4PSc4MCcgeT0nODAnIHdpZHRoPScxODAnIGhlaWdodD0nMTgwJyByeD0nMzYnIGZpbGw9J3JnYmEoMjU1LDI1NSwyNTUsMC4zNSknLz4KPHJlY3QgeD0nMzYwJyB5PScxNDAnIHdpZHRoPScyMDAnIGhlaWdodD0nMTQwJyByeD0nMjgnIGZpbGw9J3JnYmEoMTUsMjMsNDIsMC4yNSknLz4KPC9zdmc+',
};

const stripVariantSuffix = (value: string): string => value.trim().replace(/_v\d+$/i, '');

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
      { id: 'a', label: 'Přesnost je zavádějící kvůli nevyváženým třídám' },
      { id: 'b', label: 'Model má příliš nízký recall' },
      { id: 'c', label: 'Data jsou vždy kvalitní' },
      { id: 'd', label: 'Model je perfektní' },
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
      { id: 'c', label: 'Pošlu technické logy bez komentáře.' },
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
      { id: 'c', label: 'Napsat veřejně do kanálu.' },
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
      { id: 'o3', label: 'Postavit prototyp' },
      { id: 'o4', label: 'Otestovat' },
      { id: 'o5', label: 'Iterovat' },
    ],
    correct_order: ['o1', 'o2', 'o3', 'o4', 'o5'],
  },
  'D11.2': {
    sources: [
      { id: 's1', label: 'Zmapovat potřeby uživatelů' },
      { id: 's2', label: 'Navrhnout řešení' },
      { id: 's3', label: 'Nasadit MVP' },
    ],
    targets: [
      { id: 't1', label: 'Discovery' },
      { id: 't2', label: 'Design' },
      { id: 't3', label: 'Build' },
    ],
    correct_pairs: [
      { source: 's1', target: 't1' },
      { source: 's2', target: 't2' },
      { source: 's3', target: 't3' },
    ],
  },
  'D11.3': {
    options: [
      { id: 'o1', label: 'Stabilizovat službu' },
      { id: 'o2', label: 'Diagnostikovat příčinu' },
      { id: 'o3', label: 'Opravit' },
      { id: 'o4', label: 'Post-mortem' },
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
      { id: 't1', label: 'System' },
      { id: 't2', label: 'User' },
      { id: 't3', label: 'Evaluation' },
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

const JcfpmFlow: React.FC<Props> = ({ initialSnapshot, mode = 'form', section = 'full', userId, onPersist, onClose }) => {
  const draft = readJcfpmDraft(userId);
  const [items, setItems] = useState<JcfpmItem[]>([]);
  const [responses, setResponses] = useState<Record<string, any>>(() => draft?.responses || initialSnapshot?.responses || {});
  const [stepIndex, setStepIndex] = useState<number>(() => draft?.stepIndex ?? 0);
  const [variantSeed] = useState<string>(() => draft?.variantSeed || Math.random().toString(36).slice(2, 10));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'form' | 'report'>(mode);
  const [snapshot, setSnapshot] = useState<JcfpmSnapshotV1 | null>(initialSnapshot || null);
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
          setItemsError('Test je dostupný pouze pro premium uživatele.');
        } else if (msg.includes('403')) {
          setItemsError('Nemáte přístup k premium testu.');
        } else if (msg.toLowerCase().includes('seed') || msg.toLowerCase().includes('items')) {
          setItemsError('Test zatím není připraven – chybí seed 108 položek v databázi.');
        } else {
          setItemsError('Nepodařilo se načíst otázky. Zkuste to prosím znovu.');
        }
      } finally {
        if (mounted) setIsLoadingItems(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

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
      const key = normalizeKey(baseId || poolKey || '');
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
        const match = String(item.id || '').match(/_v(\d+)$/i);
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
      setItemsError(`Test zatím není připraven – chybí seed ${requiredCount} položek v databázi.`);
    } else {
      setItemsError(null);
    }
  }, [items.length, pooledItems.length, section]);

  const inferDimension = (item: JcfpmItem | undefined): JcfpmDimensionId => {
    if (!item) return 'd1_cognitive';
    const explicit = String(item.dimension || '').trim().toLowerCase();
    const inferred =
      inferDimensionFromIdentity(item.id) ||
      inferDimensionFromIdentity(item.pool_key) ||
      (DIMENSIONS.some((dim) => dim.id === explicit) ? (explicit as JcfpmDimensionId) : undefined);
    return inferred || 'd1_cognitive';
  };

  const itemsByDimension = useMemo(() => {
    const map: Record<string, JcfpmItem[]> = {};
    pooledItems.forEach((item) => {
      const dim = inferDimension(item);
      if (!map[dim]) map[dim] = [];
      map[dim].push(item);
    });
    Object.values(map).forEach((list) => list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
    return map;
  }, [pooledItems]);

  const activeDimensions = useMemo(() => {
    return DIMENSIONS.filter((dim) => {
      if (section === 'core') return !DEEP_DIVE_DIMENSIONS.has(dim.id);
      if (section === 'deep') return DEEP_DIVE_DIMENSIONS.has(dim.id);
      return true;
    });
  }, [section]);

  const orderedItems = useMemo(() => {
    const filtered = [...pooledItems].filter((item) => {
      const dim = inferDimension(item);
      if (section === 'core') return !DEEP_DIVE_DIMENSIONS.has(dim);
      if (section === 'deep') return DEEP_DIVE_DIMENSIONS.has(dim);
      return true;
    });
    return filtered.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [pooledItems, section]);

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
  const currentDim = DIMENSIONS.find((dim) => dim.id === inferDimension(currentItem)) || DIMENSIONS[0];
  const isDeepDive = Boolean(currentItem && DEEP_DIVE_DIMENSIONS.has(inferDimension(currentItem)));
  const isFocusMode = viewMode === 'form' && isDeepDive;
  const resolvePayload = (item?: JcfpmItem): any => {
    if (!item) return {};
    const rawKey = stripVariantSuffix(String(item.id || item.pool_key || '')).trim();
    const key = rawKey.toUpperCase();
    const applyImageAssets = (payload: any) => {
      if (!payload || typeof payload !== 'object') return payload;
      if (!Array.isArray(payload.options)) return payload;
      return {
        ...payload,
        options: payload.options.map((opt: any) => {
          const imageUrl = String(opt?.image_url || '');
          if (imageUrl === '__D10_IMAGE_A__') return { ...opt, image_url: D10_IMAGE_ASSETS.a };
          if (imageUrl === '__D10_IMAGE_B__') return { ...opt, image_url: D10_IMAGE_ASSETS.b };
          if (imageUrl === '__D10_IMAGE_C__') return { ...opt, image_url: D10_IMAGE_ASSETS.c };
          return opt;
        }),
      };
    };
    if (item.payload == null) return applyImageAssets(LOCAL_JCFPM_PAYLOADS[key] || {});
    let value: any = item.payload;
    for (let i = 0; i < 2; i += 1) {
      if (typeof value !== 'string') break;
      try {
        value = JSON.parse(value);
      } catch {
        return {};
      }
    }
    if (value && typeof value === 'object' && Object.keys(value).length > 0) return applyImageAssets(value);
    return applyImageAssets(LOCAL_JCFPM_PAYLOADS[key] || {});
  };
  const resolveItemType = (item?: JcfpmItem): string => {
    if (!item) return 'likert';
    const explicit = String(item.item_type || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/-+/g, '_');
    const payload = resolvePayload(item);
    if (Array.isArray(payload.sources) && Array.isArray(payload.targets)) return 'drag_drop';
    if (Array.isArray(payload.correct_order)) return 'ordering';
    if (Array.isArray(payload.options)) {
      if (payload.options.some((opt: any) => opt?.image_url)) return 'image_choice';
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
  };
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

  const totalAnswered = useMemo(() => {
    const ids = new Set(orderedItems.map((item) => item.id));
    return Object.keys(responses).filter((id) => ids.has(id)).length;
  }, [responses, orderedItems]);
  const totalQuestions = orderedItems.length || 108;
  const answeredByDimension = useMemo(() => {
    const map: Record<string, number> = {};
    DIMENSIONS.forEach((dim) => {
      const dimItems = itemsByDimension[dim.id] || [];
      map[dim.id] = dimItems.filter((item) => responses[item.id] != null).length;
    });
    return map;
  }, [itemsByDimension, responses]);

  const handleAnswer = (itemId: string, value: any) => {
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
  };

  const timingsRef = React.useRef<Record<string, number>>({});
  const startTimeRef = React.useRef<number | null>(null);
  const startItemRef = React.useRef<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [suspendTimer, setSuspendTimer] = useState(false);

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
    const interval = window.setInterval(() => {
      if (suspendTimer) return;
      if (startTimeRef.current == null) return;
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isDeepDive, viewMode, currentItem?.id, suspendTimer]);

  const responsesWithTiming = () => {
    const result: Record<string, any> = { ...responses };
    orderedItems.forEach((item) => {
      const itemType = resolveItemType(item);
      if (itemType === 'likert') return;
      const timeMs = timingsRef.current[item.id];
      if (timeMs == null) return;
      const value = result[item.id];
      if (value && typeof value === 'object') {
        result[item.id] = { ...value, time_ms: timeMs };
      } else if (value != null) {
        result[item.id] = { choice_id: value, time_ms: timeMs };
      }
    });
    return result;
  };

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
    if (section !== 'full') {
      onClose();
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await submitJcfpm(responsesWithTiming(), orderedItems.map((item) => item.id), variantSeed);
      if (result) {
        clearJcfpmDraft(userId);
        setSnapshot(result);
        setViewMode('report');
        await onPersist(result);
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

  const LikertTask: React.FC<TaskProps> = ({ item, response, onAnswer }) => (
    <>
      <div className="mt-4 grid grid-cols-7 gap-2" role="radiogroup" aria-label={item.prompt}>
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
      <div className="mt-4 flex items-center justify-between text-xs text-slate-600">
        <span>Spíše nesouhlasím</span>
        <span>Spíše souhlasím</span>
      </div>
    </>
  );

  const ChoiceTask: React.FC<TaskProps> = ({ item, response, onAnswer }) => {
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
          Chybí data pro tuto otázku (options). Prosím zkontroluj seed v `jcfpm_items`.
        </div>
      );
    }
    const promptImage =
      itemType === 'image_choice'
        ? (payload.image_url || payload.prompt_image || options.find((opt: any) => opt?.image_url)?.image_url)
        : null;
    const promptFallback = fallbackVisual(String(item.id || 'v'));
    const promptBackground = promptImage
      ? `url("${promptImage}"), ${promptFallback}`
      : promptFallback;
    return (
      <div className="mt-4">
        {isDigitalEq && (
          <div className="jcfpm-chat-thread mb-4">
            <div className="jcfpm-chat-bubble is-peer">Kolega: „{item.prompt}“</div>
            <div className="jcfpm-chat-bubble is-you">Ty: Jaká je nejlepší reakce?</div>
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
                <div className="text-sm font-semibold text-slate-900">{option.label}</div>
                {option.desc ? <div className="mt-1 text-xs text-slate-600">{option.desc}</div> : null}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const OrderingTask: React.FC<TaskProps> = ({ item, response, onAnswer }) => {
    const payload = resolvePayload(item);
    const isDecomposition = inferDimension(item) === 'd11_problem_decomposition';
    const options = Array.isArray(payload.options) ? payload.options : [];
    if (!options.length) {
      console.warn('[JCFPM] Missing ordering options payload for item:', item);
      return (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          Chybí data pro tuto otázku (ordering). Prosím zkontroluj seed v `jcfpm_items`.
        </div>
      );
    }
    const order = Array.isArray(response?.order) ? response.order : options.map((opt: any) => opt.id);
    const move = (index: number, direction: number) => {
      const next = [...order];
      const swapIndex = index + direction;
      if (swapIndex < 0 || swapIndex >= next.length) return;
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      onAnswer({ order: next });
    };
    return (
      <div className={`mt-4 space-y-2 ${isDecomposition ? 'jcfpm-ordering-stack is-timeline' : ''}`}>
        {order.map((id: string, index: number) => {
          const option = options.find((opt: any) => opt.id === id);
          return (
            <div key={id} className={`jcfpm-ordering-item ${isDecomposition ? 'jcfpm-timeline-step' : ''}`}>
              <span className="text-sm font-semibold text-slate-800">{index + 1}.</span>
              <span className="text-sm text-slate-700 flex-1">{option?.label || id}</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => move(index, -1)} className="jcfpm-mini-btn">↑</button>
                <button type="button" onClick={() => move(index, 1)} className="jcfpm-mini-btn">↓</button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const DragDropTask: React.FC<TaskProps> = ({ item, response, onAnswer }) => {
    const payload = resolvePayload(item);
    const isSystems = inferDimension(item) === 'd9_systems_thinking';
    const sources = Array.isArray(payload.sources) ? payload.sources : [];
    const targets = Array.isArray(payload.targets) ? payload.targets : [];
    if (!sources.length || !targets.length) {
      console.warn('[JCFPM] Missing drag_drop payload for item:', item);
      return (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          Chybí data pro tuto otázku (drag_drop). Prosím zkontroluj seed v `jcfpm_items`.
        </div>
      );
    }
    const currentPairs: any[] = Array.isArray(response?.pairs) ? response.pairs : sources.map((src: any) => ({ source: src.id, target: '' }));
    const updatePair = (sourceId: string, targetId: string) => {
      const next = currentPairs.map((pair) => (pair.source === sourceId ? { ...pair, target: targetId } : pair));
      onAnswer({ pairs: next });
    };
    return (
      <div className={`mt-4 grid gap-3 ${isSystems ? 'jcfpm-systems-canvas' : ''}`}>
        {sources.map((src: any) => {
          const selected = currentPairs.find((pair) => pair.source === src.id)?.target || '';
          return (
            <div key={src.id} className={`jcfpm-drag-row ${isSystems ? 'is-node-link' : ''}`}>
              <div className="text-sm font-semibold text-slate-800">{src.label}</div>
              <select
                className="jcfpm-select"
                value={selected}
                onFocus={() => setSuspendTimer(true)}
                onBlur={() => setSuspendTimer(false)}
                onChange={(e) => updatePair(src.id, e.target.value)}
              >
                <option value="">Vyber cíl</option>
                {targets.map((target: any) => (
                  <option key={target.id} value={target.id}>{target.label}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    );
  };

  const TASK_COMPONENTS: Record<string, React.FC<TaskProps>> = {
    likert: LikertTask,
    mcq: ChoiceTask,
    scenario_choice: ChoiceTask,
    image_choice: ChoiceTask,
    ordering: OrderingTask,
    drag_drop: DragDropTask,
  };

  const renderItemBody = () => {
    if (!currentItem) return null;
    const itemType = resolveItemType(currentItem);
    const SelectedTask = TASK_COMPONENTS[itemType] || TASK_COMPONENTS.likert;
    return (
      <SelectedTask
        item={currentItem}
        response={responses[currentItem.id]}
        onAnswer={(value) => handleAnswer(currentItem.id, value)}
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-emerald-600/80">Career Fit & Potential</div>
          <p className="mt-1 text-xs text-slate-600">
            {viewMode === 'report'
              ? 'Report'
              : `Otázka ${stepIndex + 1} / ${totalQuestions} • ${totalAnswered} zodpovězeno`}
          </p>
          {viewMode === 'form' ? (
            <div className={`jcfpm-phase-pill ${isDeepDive ? 'is-deep' : 'is-standard'} mt-2`}>
              {isDeepDive ? 'Deep Dive • Focus Mode' : 'Standard Scan'}
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
                title={ambientEnabled ? 'Ambient zapnut' : 'Ambient vypnut'}
              >
                {ambientEnabled ? <Sparkles className="h-4 w-4 text-emerald-700" /> : <Sparkles className="h-4 w-4 text-slate-400" />}
              </button>
              <button
                type="button"
                onClick={() => setSoundEnabled((prev) => !prev)}
                className="jcfpm-icon-button"
                aria-label="Toggle sound"
                title={soundEnabled ? 'Zvuk zapnut' : 'Zvuk vypnut'}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4 text-emerald-700" /> : <VolumeX className="h-4 w-4 text-slate-500" />}
              </button>
            </>
          ) : null}
          <button type="button" onClick={onClose} className="jcfpm-icon-button" aria-label="Close JCFPM">
            <X className="h-4 w-4 text-slate-600" />
          </button>
        </div>
      </div>

      <div className="jcfpm-progress-track mt-3 h-2 w-full overflow-hidden rounded-full">
        <div className={`jcfpm-progress-fill h-full rounded-full transition-all duration-700 ${isDeepDive ? 'is-deep-dive' : 'is-standard'}`} style={{ width: `${progress}%` }} />
      </div>

      {viewMode === 'report' && snapshot ? (
        <div className="mt-4">
          <JcfpmReportPanel snapshot={snapshot} />
        </div>
      ) : (
        <div className="mt-4 jcfpm-step" key={`jcfpm-step-${stepIndex}`}>
          {showInterlude && (
            <div className="jcfpm-interlude">
              <div className="jcfpm-interlude-card">
                <div className="text-xs uppercase tracking-[0.2em] text-emerald-600">Nová dimenze</div>
                <div className="mt-2 jcfpm-heading text-lg font-semibold text-slate-900">{INTERLUDES[currentDim.id]?.title || currentDim.title}</div>
                <p className="mt-2 text-sm text-slate-600">{currentDim.subtitle}</p>
                <p className="mt-3 text-sm text-slate-600">
                  {INTERLUDES[currentDim.id]?.body}
                </p>
                <button
                  type="button"
                  onClick={() => setShowInterlude(false)}
                  className="mt-5 jcfpm-primary-button"
                >
                  Pokračovat
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          <div className={`jcfpm-panel ${showInterlude ? 'is-blurred' : ''}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="jcfpm-heading text-base font-semibold text-slate-900">{currentDim.title}</div>
                <p className="mt-1 text-sm text-slate-600">{currentDim.subtitle}</p>
                {!isFocusMode ? (
                  <p className="mt-2 text-sm text-slate-700 jcfpm-story">
                  {currentDim.id === 'd1_cognitive' && 'Začneme tím, jak přemýšlíš, třídíš informace a rozhoduješ se.'}
                  {currentDim.id === 'd2_social' && 'Teď se podíváme na to, kde se ti nejlépe pracuje s lidmi.'}
                  {currentDim.id === 'd3_motivational' && 'Co tě skutečně pohání? Tady zachytíme tvé motivátory.'}
                  {currentDim.id === 'd4_energy' && 'V této části mapujeme tvé tempo, rytmus a pracovní energii.'}
                  {currentDim.id === 'd5_values' && 'Zachytíme, jaké hodnoty musí práce naplňovat, aby dávala smysl.'}
                  {currentDim.id === 'd6_ai_readiness' && 'Na závěr zjistíme, jak se cítíš v AI a tech změnách.'}
                  {currentDim.id === 'd7_cognitive_reflection' && 'Krátké hádanky prověří tvůj “bullshit detector” a schopnost zpomalit intuici.'}
                  {currentDim.id === 'd8_digital_eq' && 'Připrav se na chatové situace a interpretaci tónu v textu.'}
                  {currentDim.id === 'd9_systems_thinking' && 'Budeme mapovat vztahy a zpětné vazby v jednoduchých systémech.'}
                  {currentDim.id === 'd10_ambiguity_interpretation' && 'V nejasných obrazech odhalíš, zda vidíš spíš rizika nebo příležitosti.'}
                  {currentDim.id === 'd11_problem_decomposition' && 'Rozložíš velké úkoly na logické kroky.'}
                  {currentDim.id === 'd12_moral_compass' && 'Etická dilemata odhalí tvůj hodnotový kompas.'}
                  </p>
                ) : null}
                {isDeepDive && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className="jcfpm-timer-pill">
                      <span className="jcfpm-pulse-dot" aria-hidden="true" />
                      <Clock className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Tempo: {Math.floor(elapsedMs / 60000).toString().padStart(2, '0')}:{Math.floor((elapsedMs % 60000) / 1000).toString().padStart(2, '0')}</span>
                    </span>
                    <span className="jcfpm-timer-note">Čas lehce ovlivňuje výsledek – hledej rovnováhu mezi rychlostí a jistotou.</span>
                  </div>
                )}
              </div>
              <div className="jcfpm-dim-badge">
                {answeredByDimension[currentDim.id] || 0} / {(itemsByDimension[currentDim.id] || []).length}
              </div>
            </div>
            {(currentItem?.item_type || 'likert') === 'likert' && (
              <div className={`mt-3 jcfpm-legend ${isFocusMode ? 'hidden' : ''}`}>
                1 = Silně nesouhlasím • 4 = Neutrálně • 7 = Silně souhlasím
              </div>
            )}
            <div className={`mt-4 jcfpm-timeline ${isFocusMode ? 'hidden' : ''}`}>
              {activeDimensions.map((dim) => (
                <div key={dim.id} className={`jcfpm-timeline-pill ${dim.id === currentDim.id ? 'is-active' : ''}`}>
                  <span className="font-semibold">{dim.title}</span>
                  <span className="text-[11px] text-slate-500">
                    {answeredByDimension[dim.id] || 0}/{(itemsByDimension[dim.id] || []).length}
                  </span>
                </div>
              ))}
            </div>
            {isLoadingItems ? (
              <div className="mt-4 rounded-xl border border-emerald-100 bg-white p-4 text-sm text-slate-500 shadow-sm">
                Načítám otázky…
              </div>
            ) : itemsError ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {itemsError}
              </div>
            ) : (
              <div className={`mt-4 grid gap-3 ${showInterlude ? 'pointer-events-none' : ''}`}>
                {currentItem ? (
                  <div className="jcfpm-question jcfpm-question-animated">
                    <div className="jcfpm-question-title">{currentItem.prompt}</div>
                    {currentItem.subdimension ? (
                      <div className="mt-1 text-[11px] text-slate-600">{currentItem.subdimension}</div>
                    ) : null}
                    {renderItemBody()}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleBack}
          disabled={viewMode === 'form' && stepIndex === 0}
          className="jcfpm-secondary-button disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </button>

        {viewMode === 'form' ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={!canAdvance || isSubmitting || Boolean(itemsError) || isLoadingItems}
            className="jcfpm-primary-button disabled:opacity-60"
          >
            {stepIndex === orderedItems.length - 1 ? (
              <>
                <Save className="h-4 w-4" />
                {isSubmitting
                  ? 'Ukládám...'
                  : section === 'full'
                    ? 'Dokončit test'
                    : 'Dokončit sekci'}
              </>
            ) : (
              <>
                Další otázka
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="jcfpm-primary-button"
          >
            Zavřít
          </button>
        )}
      </div>
    </div>
  );
};

export default JcfpmFlow;
