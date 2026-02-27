import React from 'react';
import { computeJcfpmScoresLocal, fetchJcfpmItems } from '../../services/jcfpmService';
import { JcfpmSnapshotV1, JcfpmDimensionId, JcfpmAIReport } from '../../types';

interface Props {
  snapshot: JcfpmSnapshotV1;
}

const DIMENSION_META: Record<string, { title: string; definition: string; subdims: string }> = {
  d1_cognitive: {
    title: 'Kognitivní styl',
    definition: 'Způsob zpracování informací a řešení problémů.',
    subdims: 'Analytické vs. intuitivní • Struktura vs. improvizace • Detail vs. celek',
  },
  d2_social: {
    title: 'Sociální orientace',
    definition: 'Preferovaný způsob interakce s lidmi a týmové dynamiky.',
    subdims: 'Samostatnost vs. tým • Chuť vést lidi • Vnější vs. interní komunikace',
  },
  d3_motivational: {
    title: 'Motivační profil',
    definition: 'Co tě pohání a co považuješ za odměnu.',
    subdims: 'Autonomie vs. struktura • Rozvoj vs. výkon • Vnitřní vs. vnější motivace',
  },
  d4_energy: {
    title: 'Energetický styl',
    definition: 'Tempo, intenzita a styl práce.',
    subdims: 'Sprint vs. stabilní tempo • Přepínání úkolů vs. hluboká práce • Naléhavost vs. stabilita',
  },
  d5_values: {
    title: 'Hodnotová kotvení',
    definition: 'Co musí práce přinášet, aby dávala smysl.',
    subdims: 'Dopad vs. osobní růst • Inovace vs. stabilita • Vztahy vs. výkon',
  },
  d6_ai_readiness: {
    title: 'Připravenost na práci s AI',
    definition: 'Jak dobře prosperuješ v rychle se měnícím technologickém prostředí.',
    subdims: 'Učení nového • Tolerance nejistoty • Aktivní práce s AI',
  },
  d7_cognitive_reflection: {
    title: 'Kognitivní reflexe a logika',
    definition: 'Schopnost zastavit první intuici a ověřit ji logikou.',
    subdims: 'Intuice vs. ověření • Logické pasti • Odhalování nesmyslů',
  },
  d8_digital_eq: {
    title: 'Digitální EQ',
    definition: 'Citlivost na emoce, tón a důvěru v textové komunikaci.',
    subdims: 'Empatie v textu • Konflikt v chatu • Důvěryhodnost',
  },
  d9_systems_thinking: {
    title: 'Systémové myšlení',
    definition: 'Jak dobře čteš vztahy, zpětné vazby a vedlejší efekty.',
    subdims: 'Příčina a následek • Zpětné vazby • Zpožděné dopady',
  },
  d10_ambiguity_interpretation: {
    title: 'Interpretace nejasností',
    definition: 'Jak čteš nejasné situace – rizika vs. příležitosti.',
    subdims: 'Opatrnost vs. průzkum • Hrozby vs. růst',
  },
  d11_problem_decomposition: {
    title: 'Rozklad problémů',
    definition: 'Schopnost rozsekat velký problém na jasné kroky.',
    subdims: 'Struktura • Prioritizace • Architektura řešení',
  },
  d12_moral_compass: {
    title: 'Morální & etický kompas',
    definition: 'Stabilita hodnot v dilematech a tlakových situacích.',
    subdims: 'Integrita • Důvěra • Dlouhodobé dopady',
  },
};

const DIMENSIONS: { id: JcfpmDimensionId }[] = [
  { id: 'd1_cognitive' },
  { id: 'd2_social' },
  { id: 'd3_motivational' },
  { id: 'd4_energy' },
  { id: 'd5_values' },
  { id: 'd6_ai_readiness' },
  { id: 'd7_cognitive_reflection' },
  { id: 'd8_digital_eq' },
  { id: 'd9_systems_thinking' },
  { id: 'd10_ambiguity_interpretation' },
  { id: 'd11_problem_decomposition' },
  { id: 'd12_moral_compass' },
];

const JcfpmReportPanel: React.FC<Props> = ({ snapshot }) => {
  const { dimension_scores, fit_scores, ai_report } = snapshot;
  const [mergedScores, setMergedScores] = React.useState(dimension_scores || []);
  const uniqueFitScores = React.useMemo(() => {
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

  const extendedDims = React.useMemo(
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

  React.useEffect(() => {
    let mounted = true;
    const existing = new Set((dimension_scores || []).map((row) => row.dimension));
    const missingExtended = Array.from(extendedDims).some((dim) => !existing.has(dim));
    if (!missingExtended || !snapshot?.responses) {
      setMergedScores(dimension_scores || []);
      return () => { mounted = false; };
    }
    (async () => {
      try {
        const items = await fetchJcfpmItems();
        if (!items.length) return;
        const itemIds = snapshot.item_ids && snapshot.item_ids.length ? snapshot.item_ids : Object.keys(snapshot.responses || {});
        const selected = itemIds.length ? items.filter((item) => itemIds.includes(item.id)) : items;
        if (!selected.length) return;
        const recomputed = computeJcfpmScoresLocal(selected, snapshot.responses as Record<string, any>);
        if (!mounted) return;
        const byDim = new Map(recomputed.map((row) => [row.dimension, row]));
        const merged = (dimension_scores || []).map((row) => byDim.get(row.dimension) || row);
        const missingDims = DIMENSIONS.filter((dim) => !merged.some((row) => row.dimension === dim.id));
        missingDims.forEach((dim) => {
          const row = byDim.get(dim.id);
          if (row) merged.push(row);
        });
        merged.sort((a, b) => {
          const ai = DIMENSIONS.findIndex((d) => d.id === a.dimension);
          const bi = DIMENSIONS.findIndex((d) => d.id === b.dimension);
          return ai - bi;
        });
        setMergedScores(merged);
      } catch {
        setMergedScores(dimension_scores || []);
      }
    })();
    return () => { mounted = false; };
  }, [dimension_scores, extendedDims, snapshot]);

  const scoreMax = (dim: JcfpmDimensionId) => (extendedDims.has(dim) ? 100 : 7);

  const normalizeTo100 = (dim: JcfpmDimensionId, raw: number) => (extendedDims.has(dim) ? raw : (raw / 7) * 100);

  const bridgePairs: { self: JcfpmDimensionId; perf: JcfpmDimensionId; label: string }[] = [
    { self: 'd1_cognitive', perf: 'd7_cognitive_reflection', label: 'Analytika vs. logika' },
    { self: 'd2_social', perf: 'd8_digital_eq', label: 'Sociální styl vs. digitální EQ' },
    { self: 'd3_motivational', perf: 'd11_problem_decomposition', label: 'Motivace vs. rozklad problémů' },
    { self: 'd4_energy', perf: 'd9_systems_thinking', label: 'Tempo vs. systémové myšlení' },
    { self: 'd5_values', perf: 'd12_moral_compass', label: 'Hodnoty vs. etika v praxi' },
    { self: 'd6_ai_readiness', perf: 'd10_ambiguity_interpretation', label: 'Připravenost na AI vs. práce s nejistotou' },
  ];

  const normalizedScoreMap = React.useMemo(() => {
    const map = new Map<JcfpmDimensionId, number>();
    mergedScores.forEach((row) => {
      map.set(row.dimension, Math.max(0, Math.min(100, normalizeTo100(row.dimension, row.raw_score))));
    });
    return map;
  }, [mergedScores]);

  const radarAxes = React.useMemo(
    () =>
      [
        { standard: 'd1_cognitive' as JcfpmDimensionId, deep: 'd7_cognitive_reflection' as JcfpmDimensionId, label: 'Logic' },
        { standard: 'd2_social' as JcfpmDimensionId, deep: 'd8_digital_eq' as JcfpmDimensionId, label: 'Sociální' },
        { standard: 'd3_motivational' as JcfpmDimensionId, deep: 'd11_problem_decomposition' as JcfpmDimensionId, label: 'Realizace' },
        { standard: 'd4_energy' as JcfpmDimensionId, deep: 'd9_systems_thinking' as JcfpmDimensionId, label: 'Systémy' },
        { standard: 'd5_values' as JcfpmDimensionId, deep: 'd12_moral_compass' as JcfpmDimensionId, label: 'Etika' },
        { standard: 'd6_ai_readiness' as JcfpmDimensionId, deep: 'd10_ambiguity_interpretation' as JcfpmDimensionId, label: 'Nejistota' },
      ],
    [],
  );

  const radarGeometry = React.useMemo(() => {
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

  const alignmentBars = React.useMemo(() => {
    return bridgePairs
      .map((pair) => {
        const selfScore = normalizedScoreMap.get(pair.self);
        const perfScore = normalizedScoreMap.get(pair.perf);
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
  }, [bridgePairs, normalizedScoreMap]);

  const aiReportResolved = React.useMemo<JcfpmAIReport>(() => {
    const weakFragments = [
      'na základě profilových dimenzí',
      'nastav měřitelný návyk',
      'baseline',
      'fixní limit',
    ];
    const isWeakText = (value?: string) => {
      const normalized = (value || '').trim().toLowerCase();
      if (!normalized) return true;
      if (normalized.length < 40) return true;
      return weakFragments.some((fragment) => normalized.includes(fragment));
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
        normalized: Math.round(normalizeTo100(row.dimension, row.raw_score)),
      }))
      .sort((a, b) => b.normalized - a.normalized);

    const strongest = ranked.slice(0, 3);
    const weakest = [...ranked].reverse().slice(0, 2).reverse();
    const aiReadiness = normalizedScoreMap.get('d6_ai_readiness') || 0;
    const ambiguity = normalizedScoreMap.get('d10_ambiguity_interpretation') || 0;
    const socialScore = normalizedScoreMap.get('d2_social') || 0;
    const energyScore = normalizedScoreMap.get('d4_energy') || 0;

    const strengthHints: Record<string, string> = {
      d10_ambiguity_interpretation: 'V nejistotě se nezastavíš a umíš rychle najít směr.',
      d12_moral_compass: 'I pod tlakem držíš férovost a důvěryhodné rozhodování.',
      d8_digital_eq: 'V textové komunikaci dobře čteš tón i emoce druhých.',
      d9_systems_thinking: 'Přirozeně vidíš souvislosti a vedlejší dopady rozhodnutí.',
      d11_problem_decomposition: 'Umíš velké zadání rozdělit na srozumitelné a zvládnutelné kroky.',
      d7_cognitive_reflection: 'Nejedeš jen na první dojem, umíš si odpověď ověřit.',
    };

    const developmentHints: Record<string, string> = {
      d1_cognitive: 'Pomůže ti vědomě oddělit fakta, domněnky a závěr před finálním rozhodnutím.',
      d7_cognitive_reflection: 'Před důležitým krokem si dej krátkou kontrolu: „Jaký je důkaz?“',
      d9_systems_thinking: 'Před změnou si napiš, koho ovlivní a co se může stát za 1–3 měsíce.',
      d11_problem_decomposition: 'Používej jednoduchou osnovu: cíl → kroky → rizika → termín.',
      d8_digital_eq: 'U citlivých zpráv ověř porozumění jednou krátkou doplňující otázkou.',
    };

    const habitPlans: Record<string, string> = {
      d1_cognitive: 'Před každým důležitým rozhodnutím sepiš 3 fakta, 1 riziko a 1 alternativu.',
      d7_cognitive_reflection: 'Každý den vyber 1 rozhodnutí a napiš si, proč je správné.',
      d8_digital_eq: 'U dvou zpráv denně vědomě uprav tón tak, aby byl jasný a respektující.',
      d9_systems_thinking: 'Jednou denně zmapuj u změny „co to zlepší“ a „co to může zhoršit“.',
      d11_problem_decomposition: 'Každý větší úkol rozděl do 3–5 malých kroků s termínem.',
      d10_ambiguity_interpretation: 'V nejasné situaci napiš 2 rizika a 2 příležitosti, pak rozhodni.',
    };

    const strengths = strongest.map((row) => {
      const title = DIMENSION_META[row.dimension]?.title || row.dimension;
      const hint = strengthHints[row.dimension] || 'Tato oblast je nyní tvoje silná stránka.';
      return `${title} (${row.normalized}/100): ${hint}`;
    });

    const developmentAreas = weakest.map((row) => {
      const title = DIMENSION_META[row.dimension]?.title || row.dimension;
      const hint = developmentHints[row.dimension] || 'Tady máš aktuálně největší prostor pro růst.';
      return `${title} (${row.normalized}/100): ${hint}`;
    });

    const topStrengthNames = strongest
      .slice(0, 2)
      .map((row) => DIMENSION_META[row.dimension]?.title || row.dimension)
      .join(' + ') || 'aktuální profil';
    const roleUseCaseByDim: Record<string, string> = {
      d8_digital_eq: 'komunikaci s klienty a zvládání citlivých situací v textu',
      d9_systems_thinking: 'návrhu procesů a hlídání vedlejších dopadů změn',
      d11_problem_decomposition: 'plánování kroků, prioritizaci a dotahování úkolů',
      d7_cognitive_reflection: 'ověřování rozhodnutí a snižování chybných zkratek',
      d10_ambiguity_interpretation: 'rozhodování i ve chvíli, kdy nejsou kompletní data',
      d12_moral_compass: 'udržení důvěry při náročných rozhodnutích pod tlakem',
    };
    const primaryStrength = strongest[0];
    const secondaryStrength = strongest[1];
    const roleUseCase = roleUseCaseByDim[primaryStrength?.dimension || ''] || 'praktickém rozhodování a spolupráci';

    const topRoles = uniqueFitScores.slice(0, 3).map((role) => {
      const fit = Math.round(Number(role.fit_score) || 0);
      const firstStrengthTitle = DIMENSION_META[primaryStrength?.dimension || '']?.title || topStrengthNames;
      const firstStrengthScore = primaryStrength?.normalized ?? null;
      const secondStrengthTitle = DIMENSION_META[secondaryStrength?.dimension || '']?.title || '';
      const secondStrengthScore = secondaryStrength?.normalized ?? null;
      const aiImpact = role.ai_impact ? ` AI dopad role: ${role.ai_impact}.` : '';
      const workMode = role.remote_friendly ? ` Vhodnost práce na dálku: ${role.remote_friendly}.` : '';
      return {
        title: role.title,
        reason:
          `Shoda ${fit} %. Sedí díky silné oblasti ${firstStrengthTitle}${firstStrengthScore !== null ? ` (${firstStrengthScore}/100)` : ''}` +
          `${secondStrengthTitle ? ` a ${secondStrengthTitle}${secondStrengthScore !== null ? ` (${secondStrengthScore}/100)` : ''}` : ''}. ` +
          `V této roli to využiješ hlavně při ${roleUseCase}.${aiImpact}${workMode}`.trim(),
      };
    });

    const nextSteps = weakest.map((row, index) => {
      const title = DIMENSION_META[row.dimension]?.title || row.dimension;
      const plan = habitPlans[row.dimension] || `Zvol malý denní návyk pro oblast "${title}" a po týdnu vyhodnoť posun.`;
      return `Týden ${index + 1}: ${plan}`;
    });

    return {
      strengths,
      ideal_environment: [
        socialScore >= 60
          ? 'Spolupracující tým s pravidelnou zpětnou vazbou a jasnou domluvou.'
          : 'Klidnější prostředí s delšími bloky na soustředěnou práci.',
        energyScore >= 65
          ? 'Práce s vyšším tempem a různorodými úkoly.'
          : 'Stabilnější rytmus práce s menším množstvím náhlých změn.',
        aiReadiness >= 60
          ? 'Prostředí, kde se AI nástroje používají běžně a prakticky.'
          : 'Prostředí, kde se nové nástroje zavádějí postupně a s podporou.',
      ],
      top_roles: topRoles,
      development_areas: developmentAreas,
      next_steps: nextSteps,
      ai_readiness:
        `Připravenost na AI máš na ${Math.round(aiReadiness)}/100 a práci s nejasností na ${Math.round(ambiguity)}/100. ` +
        'Silné skóre znamená dobrý základ, další posun uděláš pravidelným tréninkem v praxi.',
    };
  }, [ai_report, mergedScores, normalizeTo100, normalizedScoreMap, uniqueFitScores]);

  const buildBridge = () => {
    const byDim = new Map(mergedScores.map((row) => [row.dimension, row]));
    const perfDims = bridgePairs
      .map((pair) => ({ pair, row: byDim.get(pair.perf) }))
      .filter((entry) => entry.row);
    const weakestPerf = perfDims
      .map((entry) => ({ ...entry, score: normalizeTo100(entry.pair.perf, entry.row!.raw_score) }))
      .sort((a, b) => a.score - b.score)[0];

    const gaps = bridgePairs
      .map((pair) => {
        const selfRow = byDim.get(pair.self);
        const perfRow = byDim.get(pair.perf);
        if (!selfRow || !perfRow) return null;
        const selfScore = normalizeTo100(pair.self, selfRow.raw_score);
        const perfScore = normalizeTo100(pair.perf, perfRow.raw_score);
        return { pair, selfRow, perfRow, gap: selfScore - perfScore, selfScore, perfScore };
      })
      .filter(Boolean) as Array<{
      pair: { self: string; perf: string; label: string };
      selfRow: any;
      perfRow: any;
      gap: number;
      selfScore: number;
      perfScore: number;
    }>;

    const biggestGap = gaps.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))[0];

    const skillToLearnTitle = weakestPerf
      ? (DIMENSION_META[weakestPerf.pair.perf]?.title || weakestPerf.pair.label)
      : 'Výkonová dimenze';
    const skillToLearnScore = weakestPerf ? Math.round(weakestPerf.score) : null;
    const skillToLearn = weakestPerf
      ? `${skillToLearnTitle}: ${skillToLearnScore}/100. ` +
        `Je to aktuálně nejslabší výkonová oblast v tomto běhu testu. ` +
        `Fokus na 2 týdny: 1 konkrétní mikro‑návyk, 2 měřitelné výstupy týdně a krátké vyhodnocení pokroku.`
      : 'Nebylo možné určit nejslabší výkonovou oblast.';

    const behaviorToChange = biggestGap
      ? (() => {
          const selfTitle = DIMENSION_META[biggestGap.pair.self]?.title || biggestGap.pair.self;
          const perfTitle = DIMENSION_META[biggestGap.pair.perf]?.title || biggestGap.pair.perf;
          const selfRounded = Math.round(biggestGap.selfScore);
          const perfRounded = Math.round(biggestGap.perfScore);
          const absGap = Math.round(Math.abs(biggestGap.gap));
          const direction = biggestGap.gap > 0
            ? 'Sebehodnocení je vyšší než výkon.'
            : biggestGap.gap < 0
              ? 'Výkon je vyšší než sebehodnocení.'
              : 'Sebehodnocení a výkon jsou vyrovnané.';
          const action = biggestGap.gap > 10
            ? 'Doporučení: před důležitým rozhodnutím použij krátký kontrolní seznam (kritérium úspěchu + 1 ověření).'
            : biggestGap.gap < -10
              ? 'Doporučení: slaď sebehodnocení s praxí a zapisuj si 3 konkrétní situace týdně.'
              : 'Doporučení: drž současný režim a průběžně monitoruj odchylku.';
          return `${selfTitle} (${selfRounded}/100) vs ${perfTitle} (${perfRounded}/100), rozdíl ${absGap} bodů. ${direction} ${action}`;
        })()
      : 'Rozdíl mezi sebehodnocením a výkonem nebylo možné spočítat.';

    return { skillToLearn, behaviorToChange };
  };

  const bridge = buildBridge();

  const describeScore = (dim: JcfpmDimensionId, raw: number, percentile: number) => {
    const rounded = Math.round(raw * 10) / 10;
    const maxScore = scoreMax(dim);
    const isExtended = extendedDims.has(dim);
    const band = isExtended ? (raw >= 80 ? 'high' : raw >= 40 ? 'mid' : 'low') : percentile >= 85 ? 'high' : percentile >= 50 ? 'mid' : 'low';
    const lookup: Record<string, { high: string; mid: string; low: string }> = {
      d1_cognitive: {
        high: `Analytické myšlení je u tebe výrazně silné (${rounded}/7). Skvěle rozkládáš problémy, hledáš vzorce a děláš rozhodnutí na základě logiky.`,
        mid: `Kognitivní styl je vyvážený (${rounded}/7). Umíš kombinovat analytiku i intuici podle situace.`,
        low: `Více se opíráš o intuici a celkový dojem (${rounded}/7). Daří se ti v situacích, kde není dost dat a je potřeba cit.`,
      },
      d2_social: {
        high: `Silná sociální orientace (${rounded}/7). Přirozeně tě baví spolupráce, vedení a práce s lidmi.`,
        mid: `Sociální orientace je vyvážená (${rounded}/7). Dokážeš fungovat v týmu i samostatně.`,
        low: `Preferuješ samostatnost (${rounded}/7). Nejvíc ti vyhovuje klid a soustředění bez častých interakcí.`,
      },
      d3_motivational: {
        high: `Vysoká vnitřní motivace (${rounded}/7). Tlačí tě smysl, autonomie a osobní růst.`,
        mid: `Motivace je vyvážená (${rounded}/7). Umíš fungovat v různých stylech odměn a vedení.`,
        low: `Silněji reaguješ na vnější motivátory (${rounded}/7). Jasná pravidla, cíle a odměny tě drží v tempu.`,
      },
      d4_energy: {
        high: `Zvládáš vysoké tempo (${rounded}/7). Umíš fungovat v intenzivních a dynamických situacích.`,
        mid: `Energetický styl je stabilní (${rounded}/7). Umíš si tempo přizpůsobit, když je potřeba.`,
        low: `Preferuješ klidnější tempo (${rounded}/7). Dlouhodobě ti sedí stabilní rytmus bez neustálých změn.`,
      },
      d5_values: {
        high: `Silné hodnotové ukotvení v impactu a inovacích (${rounded}/7). Potřebuješ smysl a přesah.`,
        mid: `Hodnoty máš vyvážené (${rounded}/7). Dokážeš fungovat v různých typech kultur.`,
        low: `Spíše tě drží stabilita a praktické jistoty (${rounded}/7). V prostředí chaosu bys mohl/a trpět.`,
      },
      d6_ai_readiness: {
        high: `Vysoká připravenost na AI (${rounded}/7). Rychle se učíš nové nástroje a změny tě spíš posilují.`,
        mid: `Připravenost na AI je vyvážená (${rounded}/7). Nové technologie zvládáš, když je dobré vedení.`,
        low: `AI změny pro tebe nejsou přirozené (${rounded}/7). Potřebuješ stabilitu a jasný rámec.`,
      },
      d7_cognitive_reflection: {
        high: `Silná kognitivní reflexe (${rounded}/${maxScore}). Dokážeš zastavit intuitivní odpověď a ověřit ji logikou.`,
        mid: `Vyvážená kognitivní reflexe (${rounded}/${maxScore}). Často ověřuješ intuici, ale umíš se rozhodnout i rychle.`,
        low: `Rychlá intuice dominuje (${rounded}/${maxScore}). V nejasných situacích můžeš potřebovat vědomé ověření.`,
      },
      d8_digital_eq: {
        high: `Vysoká digitální empatie (${rounded}/${maxScore}). Umíš číst tón, emoce i podtext v textové komunikaci.`,
        mid: `Vyvážené digitální EQ (${rounded}/${maxScore}). Většinu nuancí zachytíš, občas pomůže explicitní ověření.`,
        low: `Nižší citlivost na tón v textu (${rounded}/${maxScore}). Pomůže jasná struktura komunikace.`,
      },
      d9_systems_thinking: {
        high: `Silné systémové myšlení (${rounded}/${maxScore}). Vnímáš zpětné vazby a vedlejší efekty.`,
        mid: `Vyvážený systémový pohled (${rounded}/${maxScore}). Umíš kombinovat lineární a síťové uvažování.`,
        low: `Spíše lineární uvažování (${rounded}/${maxScore}). Pomůže mapování širších dopadů.`,
      },
      d10_ambiguity_interpretation: {
        high: `Silná orientace na příležitosti (${rounded}/${maxScore}). V nejasnosti vidíš potenciál růstu.`,
        mid: `Vyvážené vnímání rizik a příležitostí (${rounded}/${maxScore}). Umíš držet opatrnost i odvahu.`,
        low: `Spíše orientace na rizika (${rounded}/${maxScore}). V nejistotě preferuješ bezpečný rámec.`,
      },
      d11_problem_decomposition: {
        high: `Silný rozklad problémů (${rounded}/${maxScore}). Umíš rychle vytvořit jasnou strukturu kroků.`,
        mid: `Vyvážený rozklad problémů (${rounded}/${maxScore}). Struktura ti jde, ale pomáhá rámec.`,
        low: `Rozklad velkých úkolů je náročnější (${rounded}/${maxScore}). Pomohou kontrolní seznamy a šablony.`,
      },
      d12_moral_compass: {
        high: `Silný morální kompas (${rounded}/${maxScore}). Integrita a dlouhodobá důvěra jsou pro tebe klíčové.`,
        mid: `Vyvážený etický kompas (${rounded}/${maxScore}). Umíš kombinovat výkon a principy.`,
        low: `Pragmatická orientace na výkon (${rounded}/${maxScore}). Dlouhodobě pomáhá jasné hodnotové ukotvení.`,
      },
    };
    return lookup[dim]?.[band] || `Skóre ${rounded}/${maxScore}.`;
  };

  const longNarrative = (dim: JcfpmDimensionId, raw: number, percentile: number) => {
    const rounded = Math.round(raw * 10) / 10;
    const maxScore = scoreMax(dim);
    const isExtended = extendedDims.has(dim);
    const band = isExtended ? (raw >= 80 ? 'high' : raw >= 40 ? 'mid' : 'low') : percentile >= 85 ? 'high' : percentile >= 50 ? 'mid' : 'low';
    const paragraphs: Record<string, { high: string; mid: string; low: string }> = {
      d1_cognitive: {
        high:
          `Tvůj kognitivní styl je výrazně analytický (${rounded}/7). To znamená, že v hlavě přirozeně rozkládáš složité situace na menší části, hledáš vzorce a preferuješ logiku nad odhadem. Tato síla se velmi dobře uplatní v rolích, kde je potřeba strukturovat chaos – data, strategie, procesní optimalizace, architektura řešení nebo rozhodování s velkým množstvím vstupů. V praxi to znamená, že se nenecháš snadno strhnout emocí nebo tlakem a dokážeš být ten/ta, kdo dodá racionální rámec. Pozor však na jednu věc: někdy se můžeš příliš dlouho „zaseknout“ ve fázi analýzy a odkládat rozhodnutí, které by v dané situaci stačilo udělat rychle. Pomáhá si nastavit časové limity nebo testovat malé experimenty místo hledání perfektního řešení. Ve spolupráci s kreativnějšími kolegy tvoříš skvělý stabilizační pilíř.`,
        mid:
          `Tvůj kognitivní styl je vyvážený (${rounded}/7). Umíš kombinovat analytiku s intuicí podle toho, co situace vyžaduje. Když jsou data, pracuješ racionálně; když chybí, dokážeš se opřít o zkušenost a rychlý odhad. Tato flexibilita je cenná v rolích, kde se mění kontext – produkt, projektové řízení, vedení lidí, konzultace nebo kreativní strategie. V praxi to znamená, že zvládáš jak strukturované, tak „nejasné“ úkoly, a umíš přepínat mezi detailním a „celkovým“ pohledem. Rizikem může být, že bez jasného rámce ztratíš prioritu – pomáhá pracovat s krátkými kontrolní seznamy nebo „rozhodovací pravidla“. Celkově jde o velmi adaptivní profil, který dobře funguje v rychle se měnícím prostředí.`,
        low:
          `Tvůj kognitivní styl je spíše intuitivní (${rounded}/7). Přirozeně se opíráš o celkový dojem, zkušenost a cit pro situaci. To je obrovská výhoda v prostředích, kde je málo dat, vysoká nejistota a je potřeba rychle vnímat nuance – například v komunikaci s lidmi, kreativitě, designu, obchodu nebo v rolích, kde rozhoduje timing. V praxi to znamená, že často „cítíš“, co je správné, ještě než to lze tvrdě dokázat. Můžeš ale narazit na prostředí, které vyžaduje rigorózní analytické zdůvodnění každého kroku – tam je vhodné se opřít o kolegy nebo jednoduché rámce (např. 2–3 klíčové metriky). Tvé rozhodování bývá rychlé a odvážné, ale pozor na to, aby nebylo příliš impulzivní v situacích s velkou odpovědností.`,
      },
      d2_social: {
        high:
          `Sociální orientace je u tebe velmi silná (${rounded}/7). Energii ti dává práce s lidmi, spolupráce a často i vedení lidí. Umíš číst atmosféru, zapojovat druhé a posouvat tým dopředu. To je skvělé pro role typu vedoucí týmu, produktový manažer, péče o klienty, HR nebo facilitace. V praxi to znamená, že se cítíš dobře v prostředí, kde můžeš budovat vztahy a ovlivňovat směr. Rizikem může být únava z přílišného „řízení lidí“ nebo potřeba potěšit všechny – pomáhá jasné vymezení odpovědnosti a hranic. Tvoje síla je schopnost vytvářet kohezivní tým a zvyšovat motivaci lidí kolem sebe.`,
        mid:
          `Sociální orientace je vyvážená (${rounded}/7). Umíš fungovat jak v týmu, tak samostatně. Tato flexibilita je velmi praktická, protože ti umožňuje přizpůsobit se typu práce i kultuře firmy. V praxi zvládáš komunikaci, ale zároveň nepotřebuješ neustálou interakci, abys podal/a dobrý výkon. Silně ti bude vyhovovat prostředí, kde máš autonomii, ale zároveň možnost spolupráce, když to dává smysl. Rizikem může být, že se někdy „rozplyneš“ mezi rolí člena týmu a lídra – pomáhá vědomě přepínat podle situace a jasně si určit, kdy vedeš a kdy podporuješ.`,
        low:
          `Preferuješ samostatnost (${rounded}/7). Nejlépe funguješ v prostředí, kde se můžeš soustředit bez častých interakcí a hluku. To je velká výhoda v rolích, které vyžadují hluboké soustředění, expertizu nebo individuální výkon. V praxi to znamená, že umíš být nezávislý/á, ale můžeš se cítit přetížený/á v neustálém „režimu schůzek“. Pomáhá jasná struktura spolupráce – domluvit si pravidelné, ale omezené synchronizace. Tvůj přínos je stabilita, preciznost a schopnost dotahovat věci bez vnějšího tlaku.`,
      },
      d3_motivational: {
        high:
          `Tvůj motivační profil je silně vnitřní (${rounded}/7). Pohání tě smysl, autonomie a možnost růstu, ne jen odměna nebo status. V praxi to znamená, že podáváš nejlepší výkon v prostředí, kde máš prostor rozhodovat a cítíš, že práce něco znamená. To je skvělé pro inovativní týmy, startupy, výzkum nebo role, kde můžeš tvořit. Rizikem může být frustrace v rigidních strukturách nebo přílišná idealizace práce – pomáhá si nastavit realistické cíle a najít „drobné smysly“ i v rutinních úkolech. Tvoje síla je schopnost dlouhodobě držet tah bez vnější kontroly.`,
        mid:
          `Motivace je u tebe vyvážená (${rounded}/7). Dokážeš fungovat jak na základě vnitřního smyslu, tak i jasných vnějších cílů. To je velmi adaptivní – zvládáš prostředí s měřitelnými cíli i kreativnější prostředí. V praxi to znamená, že se umíš přizpůsobit tomu, co firma nebo tým potřebuje, a neztrácíš výkon, když se mění podmínky. Rizikem může být rozptýlení mezi více typy motivátorů – pomáhá si ujasnit, co je v dané fázi nejdůležitější (např. růst vs. stabilita).`,
        low:
          `Silněji reaguješ na vnější motivátory (${rounded}/7). Jasné cíle, pravidla a odměny ti dávají stabilitu a výkon. V praxi to znamená, že umíš být velmi efektivní, když máš měřitelné výsledky a jasně daný rámec. To je skvělé pro role s měřitelnými cíli, procesy a systémem (obchod, provoz, výkon). Rizikem může být vyhoření, pokud odměny dlouhodobě nepřicházejí nebo nejsou férové – proto je důležité mít transparentní očekávání. Tvoje síla je disciplína a schopnost doručovat výsledky.`,
      },
      d4_energy: {
        high:
          `Energetický styl je u tebe vysoký (${rounded}/7). Umíš fungovat v rychlém tempu, zvládat tlak a přepínat mezi úkoly. To je silná výhoda v dynamických rolích a rychle se měnícím prostředí. V praxi to znamená, že se dokážeš „rozjet“ a doručit výkon, když je třeba. Rizikem je přetížení nebo dlouhodobé vyčerpání – pomáhá vědomě plánovat odpočinek a regeneraci. Tvoje síla je vysoká výkonnost v krizových situacích.`,
        mid:
          `Tvůj energetický styl je vyvážený (${rounded}/7). Zvládáš stabilní tempo i nárazové zrychlení, což ti dává flexibilitu. V praxi se umíš adaptovat na různé režimy práce. Rizikem může být rozostření hranic mezi prací a odpočinkem – pomáhá vědomě plánovat rytmus dne. Tvoje síla je stabilita v různorodých podmínkách.`,
        low:
          `Preferuješ klidnější a stabilní tempo (${rounded}/7). V praxi to znamená, že podáváš nejlepší výkon, když máš čas na soustředění a méně nárazových změn. To je výhoda pro role vyžadující preciznost a konzistenci. Rizikem je přehlcení v prostředí s chaosem a častými změnami – pomáhá nastavit jasné priority a chránit si časové bloky.`,
      },
      d5_values: {
        high:
          `Hodnotové kotvení je u tebe silné (${rounded}/7). Hledáš smysl, dopad a inovace. V praxi to znamená, že potřebuješ vidět, že práce něco zlepšuje nebo posouvá. Když to cítíš, výkon roste; když ne, motivace klesá. To je skvělé pro role s misí, inovací nebo viditelným dopadem. Rizikem může být frustrace v prostředí, které je čistě procesní nebo krátkodobě orientované. Pomáhá si uvědomit, že i malé zlepšení může být smysluplné. Tvoje síla je schopnost dávat práci hlubší význam.`,
        mid:
          `Hodnoty máš vyvážené (${rounded}/7). Umíš fungovat v různých typech kultur a prostředí, protože nejsi extrémně vyhraněný/á. V praxi to znamená, že se dokážeš přizpůsobit firmám s různými prioritami. Rizikem může být, že ti bude chybět „silný tah“, pokud prostředí nebude jasně definovat směr. Pomáhá si vědomě vybrat, co je pro tebe v dané fázi nejdůležitější.`,
        low:
          `Spíše preferuješ stabilitu, jistotu a praktický užitek (${rounded}/7). V praxi to znamená, že ti vyhovuje jasně strukturované prostředí, kde jsou věci „předvídatelné“. To je výhoda v rolích s procesy, souladem s pravidly nebo stabilním výstupem. Rizikem může být frustrace v chaotickém, experimentálním prostředí. Tvoje síla je spolehlivost a stabilní výkon.`,
      },
      d6_ai_readiness: {
        high:
          `Tvoje připravenost na AI je velmi vysoká (${rounded}/7). Rychle se učíš nové nástroje a změny tě spíš posilují než stresují. V praxi to znamená, že často patříš mezi první, kdo zavádí nové postupy. Tato schopnost tě předurčuje k rolím s výraznou technologickou složkou, kde je potřeba zkoušet nové přístupy. Rizikem může být nuda v prostředí, kde se nic nemění. Pomáhá hledat projekty s inovací. Tvoje síla je přizpůsobivost a technologická odvaha.`,
        mid:
          `Připravenost na AI je vyvážená (${rounded}/7). Nové technologie zvládáš, když je k tomu dobré vedení a jasný smysl. V praxi to znamená, že se umíš přizpůsobit, ale nepotřebuješ být vždy první. To je vhodné pro role, kde se AI používá, ale není hlavní náplní práce. Rizikem je, že při příliš rychlé změně můžeš potřebovat víc podpory – pomáhá průběžné vzdělávání.`,
        low:
          `AI změny pro tebe nejsou přirozené (${rounded}/7). Potřebuješ stabilitu a jasný rámec, abys mohl/a podávat dobrý výkon. To neznamená, že se AI nemůžeš naučit – jen to vyžaduje více času a podpory. V praxi ti budou sedět role, kde je technologie spíš nástroj než hlavní obsah práce. Tvoje síla je schopnost držet konzistentní výkon v ustáleném prostředí.`,
      },
      d7_cognitive_reflection: {
        high:
          `Tvoje kognitivní reflexe je velmi silná (${rounded}/${maxScore}). Dokážeš zachytit moment, kdy tě intuice táhne k rychlé, ale chybné odpovědi, a umíš ji zastavit ověřením. To je zásadní výhoda v rolích, kde je kvalita rozhodnutí kritická: analýza dat, výzkum, strategie, architektura systémů nebo kontrola kvality AI výstupů. V praxi to znamená, že jsi schopný/á dělat „druhé čtení“ – hledat slabiny argumentů, odhalovat logické pasti a ověřovat předpoklady. Lidé s tímto profilem často fungují jako bezpečnostní brzda týmu: zajišťují, že se neudělá unáhlené rozhodnutí. Rizikem může být přehnaná opatrnost a zbytečně dlouhé ověřování i tam, kde by stačilo rychlé rozhodnutí. Pomáhá time‑boxing a pravidlo „ověř jen klíčové věci“. Celkově je to vysoká mentální kvalita, která chrání tým před chybami a zvyšuje důvěryhodnost.`,
        mid:
          `Tvoje kognitivní reflexe je vyvážená (${rounded}/${maxScore}). Umíš kombinovat rychlou intuici s logickým ověřením, což je praktické v reálných pracovních podmínkách, kde není čas na perfektní analýzu. V praxi často uděláš první odhad a poté si ho ověříš jednoduchou rychlou kontrolou smysluplnosti. To ti umožňuje fungovat v dynamických rolích, kde je potřeba rozhodovat rychle, ale nechceš dělat zásadní chyby. Rizikem může být, že v hodně komplexních problémech občas neuděláš druhou vrstvu ověření. Pomáhá vytvořit si osobní kontrolní seznam (např. „Mám data? Nezáměňuji korelaci za kauzalitu? Co by vyvrátilo můj předpoklad?“). Tvoje síla je adaptabilita – umíš přepnout mezi rychlostí a kvalitou podle důležitosti situace.`,
        low:
          `Tvoje kognitivní reflexe je spíše nízká (${rounded}/${maxScore}), což znamená, že rozhodnutí děláš rychle a silně se opíráš o intuici. To je velká výhoda v prostředích, kde je potřeba rychle reagovat, improvizovat a „cítit“ správnou cestu. V praxi můžeš být ten/ta, kdo se nebojí rozhodnout, i když není dost dat. Rizikem je vyšší náchylnost k logickým pastem a chybným zkratkám, zejména v technických nebo analytických úlohách. Pomůže ti, když si vytvoříš jednoduchý zvyk ověření u důležitých rozhodnutí: krátký zápis „proč“ + „co by to mohlo zpochybnit“. Když tento krok přidáš, získáš spolehlivost bez ztráty rychlosti.`,
      },
      d8_digital_eq: {
        high:
          `Tvoje digitální EQ je velmi vysoké (${rounded}/${maxScore}). V textové komunikaci umíš číst nuance, zachytit emoce i nepřímé signály a dokážeš reagovat tak, že druhá strana cítí respekt a bezpečí. To je obrovská výhoda v době asynchronních týmů – umíš budovat důvěru bez fyzické přítomnosti. V praxi to znamená, že dokážeš zklidnit napjatou situaci v chatu, správně formulovat citlivé zpětné vazby a zároveň držet výkon. Silně ti sedí role s mezitýmovou spoluprací, vedením lidí nebo komunikací s klienty. Rizikem je, že můžeš trávit příliš času „laděním“ vztahů, když je potřeba rychle doručit výsledek. Pomáhá jasně nastavit očekávání a strukturu komunikace. Tvoje síla je schopnost držet tým pohromadě i na dálku.`,
        mid:
          `Digitální EQ máš vyvážené (${rounded}/${maxScore}). Většinu tónu a emocí v textu zachytíš, ale občas můžeš některé nuance přehlédnout – zvlášť v rychlé nebo chaotické komunikaci. V praxi to znamená, že funguješ dobře v běžném týmovém provozu, ale při konfliktu ti pomůže ověřování („Rozumím správně, že…?“). Silně ti sedí prostředí, kde jsou jasná pravidla komunikace a kde je v pořádku se doptat. Tvoje výhoda je schopnost soustředit se na obsah a výkon, přičemž si zároveň držíš lidský přístup. Když k tomu přidáš vědomé ověřování tónu, zvedneš svou důvěryhodnost i v náročných situacích.`,
        low:
          `Digitální EQ máš spíše nižší (${rounded}/${maxScore}). Textovou komunikaci vnímáš hlavně jako přenos informací, takže ti mohou unikat jemné signály v tónu a emočním podtextu. To je v pořádku v technických nebo jasně strukturovaných rolích, ale může to narážet v týmech, kde je důležitá vztahová rovina. V praxi se může stát, že tvůj stručný styl bude působit tvrději, než zamýšlíš. Pomáhá používat jednoduché „zjemňující formulace“ (např. krátké uznání, potvrzení) a občas se doptat, jak byl tvůj výstup pochopen. Když si tyto návyky osvojíš, výrazně snížíš tření a zlepšíš spolupráci.`,
      },
      d9_systems_thinking: {
        high:
          `Tvoje systémové myšlení je silné (${rounded}/${maxScore}). Vidíš, jak se jednotlivé části systému ovlivňují, vnímáš zpětné vazby, zpoždění a vedlejší efekty. To je zásadní dovednost pro architekturu procesů, produktové strategie, AI workflow nebo řízení komplexních projektů. V praxi to znamená, že umíš předvídat, jak se změna v jedné části projeví jinde – a vyhneš se „neviditelným“ problémům. Lidé s tímto profilem často včas identifikují rizika, která ostatním unikají. Rizikem může být přehnaná komplexita a příliš dlouhé modelování. Pomáhá si stanovit hranice systému a začít s „nejpravděpodobnějším“ modelem, který se postupně zpřesňuje. Tvoje síla je schopnost vidět celek a navrhovat stabilní řešení.`,
        mid:
          `Tvoje systémové myšlení je vyvážené (${rounded}/${maxScore}). Umíš vidět souvislosti, ale zároveň se neztrácíš v detailu. To je praktická kombinace: dokážeš přemýšlet o širším dopadu, ale umíš rozhodnout a posunout se dál. V praxi se ti bude dařit v rolích, kde je potřeba „rozumná komplexita“ – produkt, provoz, projektové řízení, konzultace. Rizikem může být, že někdy podceníš dlouhodobé vedlejší efekty. Pomáhá krátké mapování dopadů (např. „Kdo další je ovlivněn?“ „Co se stane za 3 měsíce?“). Tvoje síla je schopnost držet rovnováhu mezi detailním a systémovým pohledem.`,
        low:
          `Systémové myšlení je u tebe spíše nižší (${rounded}/${maxScore}). Přirozeně uvažuješ lineárně: problém → řešení. To je efektivní v jasně definovaných úlohách, ale u komplexních systémů můžeš přehlédnout vedlejší efekty. V praxi se může stát, že změna, která „vypadá dobře“, vytvoří problém jinde. Pomáhá pracovat s jednoduchými mapami vztahů nebo s mapou dopadů (co ovlivňuji přímo a nepřímo). Když si tuto dovednost postupně vybuduješ, budeš schopný/á dělat stabilnější a udržitelnější rozhodnutí.`,
      },
      d10_ambiguity_interpretation: {
        high:
          `Interpretace nejasností je u tebe silně orientovaná na příležitosti (${rounded}/${maxScore}). V nejasných situacích vidíš potenciál, experimentuješ a hledáš nové cesty. To je klíčové pro inovace, rozvoj byznysu, produktové experimenty nebo kreativní strategie. V praxi to znamená, že se nebojíš udělat první krok, i když není všechno jasné. Tvoje síla je schopnost „odkrývat“ nové možnosti tam, kde ostatní vidí jen riziko. Rizikem může být přehlížení varovných signálů nebo zbytečně vysoké riziko. Pomáhá si nastavit bezpečné experimenty (malé sázky, rychlé validace). Celkově jsi růstově orientovaný/á průzkumník.`,
        mid:
          `Vnímání nejasnosti máš vyvážené (${rounded}/${maxScore}). Dokážeš držet opatrnost i odvahu – nejdeš bezhlavě, ale ani nezamrzáš. V praxi to znamená, že umíš rozhodovat v nejasnosti, když máš alespoň základní rámec a kontrolní body. To je ideální pro role, které kombinují kreativitu s odpovědností (produkt, vedení projektu, uživatelská zkušenost, poradenství). Rizikem může být váhání v situacích s vysokou nejistotou. Pomáhá nastavit „kritéria pokračování“ a mít plán B. Tvoje síla je stabilita v nejistém prostředí.`,
        low:
          `Interpretace nejasností je u tebe spíše opatrná (${rounded}/${maxScore}). Když věci nejsou jasné, přirozeně hledáš rizika a chceš mít pevný rámec. To je velká výhoda v rolích, kde je důležitá bezpečnost, soulad s pravidly nebo minimalizace chyb. V praxi to znamená, že chráníš tým před unáhlenými rozhodnutími. Rizikem je, že v inovativních nebo rychle se měnících prostředích můžeš působit příliš konzervativně. Pomáhá pracovat s malými experimenty, které snižují nejistotu bez velkého rizika.`,
      },
      d11_problem_decomposition: {
        high:
          `Rozklad problémů je u tebe velmi silný (${rounded}/${maxScore}). Když dostaneš velký a nejasný úkol, rychle ho rozsekáš na logické kroky a určíš priority. To je extrémně cenné v technologicky orientovaných rolích, produktovém řízení, konzultacích i vedení lidí. V praxi to znamená, že umíš „postavit mapu“ a ostatním tím ulehčit práci. Tvoje síla je schopnost vytvářet strukturu tam, kde je chaos. Rizikem může být, že se příliš zaměříš na strukturu a ztratíš kreativitu nebo rychlost. Pomáhá ponechat prostor pro iteraci a průběžnou korekci plánu.`,
        mid:
          `Schopnost rozkladu problémů je u tebe vyvážená (${rounded}/${maxScore}). Umíš vytvořit základní strukturu, ale nejlepší výkon podáváš, když máš jasný rámec nebo vzor. V praxi se ti bude dařit v prostředí s dobře definovaným zadáním, kde můžeš přidat vlastní úpravy. Rizikem je, že u extrémně nejasných úkolů můžeš ztratit směr. Pomáhá používat jednoduché šablony (např. „cíl → kroky → rizika → metriky“). Tvoje síla je spolehlivé doručení, když máš definovaný start.`,
        low:
          `Rozklad problémů je u tebe náročnější (${rounded}/${maxScore}). Velké úkoly mohou působit jako chaos, protože chybí jasná struktura. To není slabost, ale signál, že potřebuješ více rámců. V praxi se ti bude dařit v rolích, kde jsou jasné postupy nebo silné vedení. Pokud chceš tuto oblast posílit, pomůže kontrolní seznam, myšlenková mapa nebo práce v malých „milnících“. I malé zlepšení v této dovednosti výrazně zvyšuje tvoji schopnost pracovat s komplexními zadáními.`,
      },
      d12_moral_compass: {
        high:
          `Tvůj morální a etický kompas je velmi silný (${rounded}/${maxScore}). V dilematech dokážeš držet integritu, i když je to náročné nebo krátkodobě nevýhodné. V praxi to znamená, že lidé ti důvěřují, protože jsi konzistentní a předvídatelný/á. Tato stabilita je cenná ve vedení lidí, HR, souladu s pravidly, bezpečnosti i v AI produktech, kde etické otázky nejsou „jen doplněk“, ale klíčové riziko. Rizikem může být, že v prostředí s tlakem na výkon můžeš působit jako „brzda“ – pomáhá umět své hodnoty jasně vysvětlit a ukázat dlouhodobý přínos. Tvoje síla je schopnost budovat důvěru a udržitelnost.`,
        mid:
          `Morální kompas máš vyvážený (${rounded}/${maxScore}). Umíš kombinovat výkon a principy, což je praktické v reálném byznysu. V praxi dokážeš hledat kompromisy, které zachovávají integritu, ale zároveň posouvají výsledky. To je vhodné pro role, kde se často řeší šedé zóny. Rizikem je, že bez jasného rámce můžeš občas sklouznout k pragmatismu. Pomáhá mít osobní hranice a etická „pravidla“, která tě podrží v tlaku. Tvoje síla je schopnost rozhodovat s rozumem i svědomím.`,
        low:
          `Morální kompas je u tebe spíše pragmatický (${rounded}/${maxScore}). V rozhodování tě víc vede výkon, efektivita a krátkodobý výsledek. To může být výhoda v prostředích s vysokým tlakem na výsledky, ale dlouhodobě to může poškodit důvěru. V praxi ti pomůže mít jasné hranice a vědomě si ujasnit, co už je „za čarou“. I malý posun v této oblasti může výrazně zlepšit reputaci a stabilitu vztahů. Tvoje síla je schopnost doručovat, když je potřeba rychlý výsledek.`,
      },
    };
    return paragraphs[dim]?.[band] || `Skóre ${rounded}/${maxScore}.`;
  };

  const printReport = () => {
    const bridge = buildBridge();
    const dimCards = (mergedScores || [])
      .map((row) => {
        const meta = DIMENSION_META[row.dimension] || { title: row.dimension, definition: '', subdims: '' };
        return `
          <div class="card">
            <div class="eyebrow">${meta.title}</div>
            <div class="metrics">
              <div class="metric"><div class="label">Skóre</div><div class="value">${row.raw_score} / ${scoreMax(row.dimension)}</div></div>
              <div class="metric"><div class="label">Percentil</div><div class="value">${row.percentile}</div><div class="sub">(${row.percentile_band})</div></div>
              <div class="chip"><div class="label">Výsledek</div><div class="value">${row.label}</div></div>
            </div>
            <div class="definition">${meta.definition}</div>
            <div class="subdims">${meta.subdims}</div>
            <div class="short">${describeScore(row.dimension, row.raw_score, row.percentile)}</div>
            <div class="long">${longNarrative(row.dimension, row.raw_score, row.percentile)}</div>
          </div>
        `;
      })
      .join('');

    const roles = uniqueFitScores
      .slice(0, 10)
      .map((role) => `
        <div class="card">
          <div class="role-title">${role.title}</div>
          <div class="badges">
            <span class="badge">Shoda: ${role.fit_score}%</span>
            ${role.ai_impact ? `<span class="badge alt">AI: ${role.ai_impact}</span>` : ''}
            ${role.remote_friendly ? `<span class="badge alt">Na dálku: ${role.remote_friendly}</span>` : ''}
          </div>
          <div class="meta">${role.salary_range ? `Plat: ${role.salary_range}` : 'Plat: —'}${role.salary_range && role.growth_potential ? ' • ' : ''}${role.growth_potential ? `Růst: ${role.growth_potential}` : ''}</div>
          <div class="meta">AI dopad: ${role.ai_impact || '—'} • Práce na dálku: ${role.remote_friendly || '—'}</div>
        </div>
      `)
      .join('');

    const ai = aiReportResolved;
    const aiBlock = `
      <div class="section">
        <h2>AI interpretace</h2>
        <div class="grid">
          <div class="card">
            <div class="eyebrow">Silné stránky</div>
            <ul>${ai.strengths.map((s: string) => `<li>${s}</li>`).join('')}</ul>
          </div>
          <div class="card">
            <div class="eyebrow">Ideální prostředí</div>
            <ul>${ai.ideal_environment.map((s: string) => `<li>${s}</li>`).join('')}</ul>
          </div>
        </div>
        <div class="card">
          <div class="eyebrow">Nejvhodnější role (AI)</div>
          <ul>${ai.top_roles.map((r: any) => `<li><strong>${r.title}</strong>: ${r.reason}</li>`).join('')}</ul>
        </div>
        <div class="grid">
          <div class="card">
            <div class="eyebrow">Rozvojové oblasti</div>
            <ul>${ai.development_areas.map((s: string) => `<li>${s}</li>`).join('')}</ul>
          </div>
          <div class="card">
            <div class="eyebrow">Další kroky</div>
            <ul>${ai.next_steps.map((s: string) => `<li>${s}</li>`).join('')}</ul>
          </div>
        </div>
        <div class="card">
          <div class="eyebrow">Připravenost na AI</div>
          <p>${ai.ai_readiness}</p>
        </div>
      </div>
    `;

    const radarSvg = `
      <div class="card radar-card">
        <svg viewBox="0 0 300 300" class="radar-svg" role="img" aria-label="Radar dovedností">
          <circle cx="${radarGeometry.cx}" cy="${radarGeometry.cy}" r="${radarGeometry.radius}" class="radar-ring"></circle>
          <circle cx="${radarGeometry.cx}" cy="${radarGeometry.cy}" r="${radarGeometry.radius * 0.66}" class="radar-ring"></circle>
          <circle cx="${radarGeometry.cx}" cy="${radarGeometry.cy}" r="${radarGeometry.radius * 0.33}" class="radar-ring"></circle>
          ${radarGeometry.axes
            .map(
              (axis) => `
                <g>
                  <line x1="${radarGeometry.cx}" y1="${radarGeometry.cy}" x2="${axis.x2}" y2="${axis.y2}" class="radar-axis"></line>
                  <text x="${axis.labelX}" y="${axis.labelY}" class="radar-label" text-anchor="middle">${axis.label}</text>
                </g>
              `,
            )
            .join('')}
          <polygon points="${radarGeometry.standardPoints}" class="radar-standard"></polygon>
          <polygon points="${radarGeometry.deepPoints}" class="radar-deep"></polygon>
        </svg>
        <div class="legend">
          <span class="legend-pill standard">Základní profil</span>
          <span class="legend-pill deep">Praktické dovednosti</span>
        </div>
      </div>
    `;

    const alignmentRows = alignmentBars
      .map((bar) => {
        const dotLeft = 50 + bar.offsetPct / 2;
        const statusLabel = bar.status === 'hidden_talent'
          ? 'Skrytý výkon'
          : bar.status === 'overestimation'
            ? 'Přestřelené sebehodnocení'
            : 'Zarovnané';
        return `
          <div class="align-row">
            <div class="align-head">
              <div>${bar.label}</div>
              <div class="align-meta">${bar.selfScore} → ${bar.perfScore} (${bar.diff >= 0 ? '+' : ''}${bar.diff})</div>
            </div>
            <div class="align-track">
              <div class="align-zero"></div>
              <div class="align-dot ${bar.status}" style="left: ${dotLeft}%;"></div>
            </div>
            <div class="align-note">${statusLabel}</div>
          </div>
        `;
      })
      .join('');

    const synthesisBlock = `
      <div class="section">
        <h2>Souhrn</h2>
        <div class="meta">Porovnání základního profilu (D1–D6) a praktických dovedností (D7–D12).</div>
        <div class="grid">
          ${radarSvg}
          <div class="card">
            <div class="eyebrow">Ukazatel souladu</div>
            ${alignmentRows || '<div class="meta">Data pro vyhodnocení souladu nejsou dostupná.</div>'}
          </div>
        </div>
      </div>
    `;

    const html = `
      <html>
        <head>
          <title>JCFPM Report</title>
          <style>
            body { font-family: Inter, Arial, sans-serif; color: #0b1220; padding: 28px; background: #f8fafc; }
            h1 { font-family: Fraunces, serif; margin-bottom: 8px; }
            h2 { font-size: 18px; margin: 24px 0 12px; }
            .brand { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
            .brand-left { display: flex; align-items: center; gap: 12px; }
            .logo { width: 44px; height: 44px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #22d3ee, #38bdf8); color: white; font-weight: 800; font-size: 18px; letter-spacing: 0.04em; }
            .brand-title { font-weight: 800; font-size: 16px; letter-spacing: 0.08em; text-transform: uppercase; color: #0e7490; }
            .brand-sub { font-size: 12px; color: #64748b; }
            .section { margin-top: 18px; }
            .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
            .card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08); margin-bottom: 12px; }
            .eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: 0.16em; color: #0e7490; margin-bottom: 6px; font-weight: 700; }
            .metrics { display: flex; gap: 10px; flex-wrap: wrap; }
            .metric { border: 1px solid #bae6fd; background: #e0f2fe; border-radius: 10px; padding: 8px 10px; min-width: 110px; }
            .metric .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: #0e7490; }
            .metric .value { font-size: 16px; font-weight: 700; }
            .metric .sub { font-size: 11px; color: #475569; }
            .chip { border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 999px; padding: 6px 12px; }
            .chip .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: #64748b; }
            .chip .value { font-size: 12px; font-weight: 700; }
            .definition { font-size: 12px; color: #334155; margin-top: 8px; }
            .subdims { font-size: 11px; color: #64748b; margin-top: 4px; }
            .short { font-size: 12px; color: #334155; margin-top: 8px; }
            .long { font-size: 13px; color: #0f172a; margin-top: 8px; line-height: 1.5; }
            .role-title { font-weight: 700; font-size: 14px; }
            .badges { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
            .badge { border: 1px solid #bae6fd; background: #e0f2fe; color: #0e7490; border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 700; }
            .badge.alt { border-color: #c7d2fe; background: #eef2ff; color: #1d4ed8; }
            .meta { font-size: 12px; color: #475569; margin-top: 6px; }
            .radar-card { display: flex; flex-direction: column; gap: 10px; }
            .radar-svg { width: 100%; max-width: 340px; margin: 0 auto; display: block; }
            .radar-ring { fill: none; stroke: #cbd5e1; stroke-width: 1; }
            .radar-axis { stroke: #94a3b8; stroke-width: 1; }
            .radar-label { fill: #475569; font-size: 10px; }
            .radar-standard { fill: rgba(14, 165, 233, 0.22); stroke: #0284c7; stroke-width: 2; }
            .radar-deep { fill: rgba(34, 197, 94, 0.2); stroke: #16a34a; stroke-width: 2; }
            .legend { display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; }
            .legend-pill { border-radius: 999px; padding: 4px 10px; font-size: 11px; font-weight: 700; }
            .legend-pill.standard { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
            .legend-pill.deep { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
            .align-row { margin-top: 10px; }
            .align-head { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; font-weight: 600; color: #0f172a; }
            .align-track { position: relative; height: 12px; margin-top: 6px; border-radius: 999px; background: linear-gradient(90deg, #fef2f2 0%, #f8fafc 50%, #ecfdf5 100%); border: 1px solid #e2e8f0; }
            .align-zero { position: absolute; left: 50%; top: -3px; bottom: -3px; width: 1px; background: #64748b; }
            .align-dot { position: absolute; top: 50%; transform: translate(-50%, -50%); width: 10px; height: 10px; border-radius: 999px; border: 2px solid #ffffff; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.25); }
            .align-dot.hidden_talent { background: #16a34a; }
            .align-dot.overestimation { background: #dc2626; }
            .align-dot.aligned { background: #0284c7; }
            .align-note { font-size: 11px; color: #475569; margin-top: 4px; }
            .align-meta { font-size: 11px; color: #475569; font-weight: 500; }
            ul { padding-left: 18px; margin: 6px 0 0; }
            li { margin-bottom: 6px; }
            @media print {
              body { background: #ffffff; }
              .card { box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="brand">
            <div class="brand-left">
              <div class="logo">JS</div>
              <div>
                <div class="brand-title">JobShaman</div>
                <div class="brand-sub">Career Fit & Potential Model (JCFPM v1)</div>
              </div>
            </div>
            <div class="brand-sub">Datum: ${snapshot.completed_at}</div>
          </div>
          <h1>JCFPM Report</h1>
          <div class="section">
            <h2>Dimenze</h2>
            ${dimCards}
          </div>
          ${synthesisBlock}
          <div class="section">
            <h2>Nejvhodnější role podle skóre shody</h2>
            ${roles}
          </div>
          ${aiBlock}
          <div class="section">
            <h2>Propojení sebehodnocení a výkonu</h2>
            <div class="card">
              <div class="eyebrow">Dovednost k rozvoji</div>
              <div class="long">${bridge.skillToLearn}</div>
            </div>
            <div class="card">
              <div class="eyebrow">Návyk ke změně</div>
              <div class="long">${bridge.behaviorToChange}</div>
            </div>
          </div>
        </body>
      </html>
    `;
    const win = window.open('', '_blank', 'width=900,height=800');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="jcfpm-report-root space-y-4">
      <div className="jcfpm-report-card jcfpm-report-section">
        <div className="jcfpm-heading text-sm font-semibold">Jak číst výsledky</div>
        <div className="mt-2 text-xs text-slate-600">
          D1–D6 jsou průměr 12 položek (1–7). D7–D12 jsou interaktivní dovednosti na škále 0–100.
          Percentil ukazuje, jak jsi na škále vůči ostatním.
        </div>
        <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
          <div className="jcfpm-metric-pill">1.0–2.5 → 0–15 (nízké)</div>
          <div className="jcfpm-metric-pill">2.5–4.5 → 15–50 (nižší)</div>
          <div className="jcfpm-metric-pill">4.5–5.5 → 50–85 (vyvážené)</div>
          <div className="jcfpm-metric-pill">5.5–7.0 → 85–100 (vysoké)</div>
          <div className="jcfpm-metric-pill">0–39 → nízké (D7–D12)</div>
          <div className="jcfpm-metric-pill">40–79 → vyvážené (D7–D12)</div>
          <div className="jcfpm-metric-pill">80–100 → vysoké (D7–D12)</div>
        </div>
        <div className="mt-3 text-xs text-slate-600">
          Skóre shody (0–100) vyjadřuje, jak moc sedí tvůj profil k dané roli. Čím vyšší číslo, tím lepší shoda.
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={printReport} className="jcfpm-secondary-button">Tisk / PDF</button>
        </div>
        <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
          <div className="jcfpm-info-card">
            <div className="font-semibold text-slate-700">Jak číst percentily</div>
            <div className="mt-1">Např. 80. percentil znamená, že jsi výše než 80 % lidí v dané dimenzi.</div>
          </div>
          <div className="jcfpm-info-card">
            <div className="font-semibold text-slate-700">Jak číst skóre shody</div>
            <div className="mt-1">70–85 = dobrá shoda, 85+ = velmi silná shoda.</div>
          </div>
        </div>
      </div>

      <div className="jcfpm-report-card jcfpm-report-section">
        <div className="flex items-center justify-between gap-2">
          <h4 className="jcfpm-heading text-lg font-semibold">Přehled výsledků</h4>
          <span className="jcfpm-report-tag">
            Percentily a interpretace
          </span>
        </div>
        {/* Quick overview with percentiles and interpretation */}
        <div className="mt-4 space-y-3">
          {mergedScores.map((row) => {
            const normalized = normalizeTo100(row.dimension, row.raw_score);
            const dimTitle = DIMENSION_META[row.dimension]?.title || row.dimension;
            const shortDesc = describeScore(row.dimension, row.raw_score, row.percentile);
            return (
              <div key={row.dimension} className="jcfpm-report-card-lite">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-sm text-slate-800">{dimTitle}</div>
                  <div className="flex gap-2 text-xs">
                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded font-medium">{row.raw_score}/{scoreMax(row.dimension)}</span>
                    <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-medium">{row.percentile}. percentil</span>
                    <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-[11px] font-medium uppercase tracking-wider">{row.percentile_band}</span>
                  </div>
                </div>
                <div className="mt-2 h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-500"
                    style={{ width: `${normalized}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-slate-600 leading-relaxed">
                  {shortDesc}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="jcfpm-report-card jcfpm-report-section">
        <div className="mt-6 border-t border-slate-200 pt-4">
          <h5 className="jcfpm-heading text-sm font-semibold mb-3">Detailní analýza</h5>
        <div className="grid gap-3 md:grid-cols-2">
          {mergedScores.map((row) => (
            <div key={row.dimension} className="jcfpm-report-card-lite jcfpm-report-dimension">
              <div className="jcfpm-report-eyebrow">
                {DIMENSION_META[row.dimension]?.title || row.dimension}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="jcfpm-score-chip">
                  <div className="jcfpm-report-eyebrow text-[10px]">Skóre</div>
                  <div className="text-lg font-semibold text-slate-900">{row.raw_score} / {scoreMax(row.dimension)}</div>
                </div>
                <div className="jcfpm-score-chip jcfpm-score-chip-alt">
                  <div className="jcfpm-report-eyebrow text-[10px]">Percentil</div>
                  <div className="text-lg font-semibold text-slate-900">{row.percentile}</div>
                  <div className="text-[11px] text-slate-600">({row.percentile_band})</div>
                </div>
                <div className="jcfpm-label-chip">
                  <span className="text-[10px] uppercase tracking-wider">Výsledek</span>
                  <span className="text-sm font-semibold">{row.label}</span>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-700">{DIMENSION_META[row.dimension]?.definition}</div>
              <div className="mt-1 text-[11px] text-slate-600">{DIMENSION_META[row.dimension]?.subdims}</div>
              <div className="mt-3 text-xs text-slate-700">{describeScore(row.dimension, row.raw_score, row.percentile)}</div>

              {/* inline bar graph for this dimension */}
              <div className="mt-2 jcfpm-results-graph">
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-300 transition-all duration-500"
                    style={{ width: `${normalizeTo100(row.dimension, row.raw_score)}%` }}
                  />
                </div>
              </div>

              <div className="mt-3 text-sm text-slate-700 leading-relaxed">
                {longNarrative(row.dimension, row.raw_score, row.percentile)}
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>

      <div className="jcfpm-report-card jcfpm-report-section">
        <div className="jcfpm-heading text-sm font-semibold">Souhrn</div>
        <div className="mt-1 text-xs text-slate-600">Porovnání základního profilu (D1–D6) a praktických dovedností (D7–D12).</div>
        <div className="mt-3 grid gap-4 lg:grid-cols-[340px_1fr]">
          <div className="jcfpm-report-card-lite jcfpm-radar-panel">
            <svg viewBox="0 0 300 300" className="jcfpm-radar-svg" role="img" aria-label="Radar dovedností">
              <circle cx={radarGeometry.cx} cy={radarGeometry.cy} r={radarGeometry.radius} className="jcfpm-radar-ring" />
              <circle cx={radarGeometry.cx} cy={radarGeometry.cy} r={radarGeometry.radius * 0.66} className="jcfpm-radar-ring" />
              <circle cx={radarGeometry.cx} cy={radarGeometry.cy} r={radarGeometry.radius * 0.33} className="jcfpm-radar-ring" />
              {radarGeometry.axes.map((axis) => (
                <g key={axis.label}>
                  <line x1={radarGeometry.cx} y1={radarGeometry.cy} x2={axis.x2} y2={axis.y2} className="jcfpm-radar-axis" />
                  <text x={axis.labelX} y={axis.labelY} className="jcfpm-radar-label" textAnchor="middle">{axis.label}</text>
                </g>
              ))}
              <polygon points={radarGeometry.standardPoints} className="jcfpm-radar-standard" />
              <polygon points={radarGeometry.deepPoints} className="jcfpm-radar-deep" />
            </svg>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="jcfpm-radar-pill standard">Základní profil</span>
              <span className="jcfpm-radar-pill deep">Praktické dovednosti</span>
            </div>
          </div>
          <div className="jcfpm-report-card-lite">
            <div className="jcfpm-report-eyebrow">Ukazatel souladu</div>
            <div className="mt-3 space-y-3">
              {alignmentBars.map((bar) => (
                <div key={bar.label} className="jcfpm-align-row">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">{bar.label}</span>
                    <span>{bar.selfScore} → {bar.perfScore}</span>
                  </div>
                  <div className="jcfpm-align-track">
                    <span className="jcfpm-align-zero" />
                    <span className={`jcfpm-align-indicator ${bar.status}`} style={{ left: `${50 + bar.offsetPct * 0.45}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="jcfpm-report-card jcfpm-report-section">
        <div className="jcfpm-heading text-sm font-semibold">Nejvhodnější role podle skóre shody</div>
        <div className="mt-1 text-xs text-slate-600">
          Skóre shody je vypočtené podle vzdálenosti od ideálního profilu role (0–100).
        </div>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          {uniqueFitScores.slice(0, 10).map((role, idx) => (
            <div key={`${role.title}-${idx}`} className="jcfpm-report-card-lite jcfpm-report-role">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-800">{role.title}</div>
                <div
                  className="jcfpm-compat-ring"
                  style={{ '--fit': `${Math.max(0, Math.min(100, Number(role.fit_score) || 0))}` } as React.CSSProperties}
                >
                  <span>{Math.round(Number(role.fit_score) || 0)}%</span>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="jcfpm-score-badge">Shoda: {role.fit_score}%</span>
                {role.ai_impact ? <span className="jcfpm-score-badge jcfpm-score-badge-alt">AI: {role.ai_impact}</span> : null}
                {role.remote_friendly ? <span className="jcfpm-score-badge jcfpm-score-badge-alt">Na dálku: {role.remote_friendly}</span> : null}
              </div>
              <div className="mt-2 text-xs text-slate-600">
                {role.salary_range ? `Plat: ${role.salary_range}` : null}
                {role.salary_range && role.growth_potential ? ' • ' : null}
                {role.growth_potential ? `Růst: ${role.growth_potential}` : null}
              </div>
              <div className="mt-1 text-xs text-slate-600">
                {role.ai_impact ? `AI dopad: ${role.ai_impact}` : 'AI dopad: —'}
                {' • '}
                {role.remote_friendly ? `Práce na dálku: ${role.remote_friendly}` : 'Práce na dálku: —'}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="jcfpm-report-card jcfpm-report-section">
          <div className="jcfpm-heading text-sm font-semibold">AI interpretace</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="jcfpm-report-card-lite">
              <div className="jcfpm-report-eyebrow">Silné stránky</div>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {aiReportResolved.strengths.map((item, idx) => (
                  <li key={`strength-${idx}`}>- {item}</li>
                ))}
              </ul>
            </div>
            <div className="jcfpm-report-card-lite">
              <div className="jcfpm-report-eyebrow">Ideální prostředí</div>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {aiReportResolved.ideal_environment.map((item, idx) => (
                  <li key={`env-${idx}`}>- {item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="jcfpm-report-card-lite mt-3">
            <div className="jcfpm-report-eyebrow">Nejvhodnější role (AI)</div>
            <ul className="mt-2 space-y-2 text-sm text-slate-600">
              {aiReportResolved.top_roles.map((role, idx) => (
                <li key={`ai-role-${idx}`}>- {role.title}: {role.reason}</li>
              ))}
            </ul>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="jcfpm-report-card-lite">
              <div className="jcfpm-report-eyebrow">Rozvojové oblasti</div>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {aiReportResolved.development_areas.map((item, idx) => (
                  <li key={`dev-${idx}`}>- {item}</li>
                ))}
              </ul>
            </div>
            <div className="jcfpm-report-card-lite">
              <div className="jcfpm-report-eyebrow">Další kroky</div>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {aiReportResolved.next_steps.map((item, idx) => (
                  <li key={`next-${idx}`}>- {item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="jcfpm-report-card-lite mt-3 text-sm text-slate-600">
            <span className="jcfpm-report-eyebrow">Připravenost na AI</span>
            <div className="mt-2">{aiReportResolved.ai_readiness}</div>
          </div>
        </div>

      <div className="jcfpm-report-card jcfpm-report-section">
        <div className="jcfpm-heading text-sm font-semibold">Propojení sebehodnocení a výkonu</div>
        <div className="mt-1 text-xs text-slate-600">
          Porovnání toho, co si o sobě myslíš (D1–D6), s tím, jak to prokazuješ v praxi (D7–D12).
        </div>
        {/* simple bridge summary without IIFE */}
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="jcfpm-report-card-lite">
            <div className="jcfpm-report-eyebrow">Dovednost k rozvoji</div>
            <div className="mt-2 text-sm text-slate-700">{bridge.skillToLearn}</div>
          </div>
          <div className="jcfpm-report-card-lite">
            <div className="jcfpm-report-eyebrow">Návyk ke změně</div>
            <div className="mt-2 text-sm text-slate-700">{bridge.behaviorToChange}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JcfpmReportPanel;
