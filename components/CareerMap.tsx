import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { CareerMapGraphModel, Job } from '../types';
import { cn, EnergyNode } from './ui/primitives';
import { getDomainAccent, getPrimaryJobDomain } from '../utils/domainAccents';

type Viewport = { x: number; y: number; scale: number };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const titleizeKey = (value: string) =>
  String(value || '')
    .trim()
    .replace(/^domain:/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());

const bucketKeyForJob = (job: Job, inferredById: Record<string, any>) => {
  const inferred = inferredById?.[job.id];
  const primaryFamily = inferred?.primary_role_family as string | undefined | null;
  if (primaryFamily) return primaryFamily;
  const domain = (job.inferredDomain || job.matchedDomains?.[0] || '').toString().trim().toLowerCase();
  if (domain) return `domain:${domain}`;
  return 'general';
};

const hashToIndex = (input: string, modulo: number) => {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return modulo <= 0 ? 0 : h % modulo;
};

const hashToUnit = (input: string) => {
  // Stable [0,1) float for small organic jitter based on a string key.
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
};

const jitter = (key: string, amount: number, axis: 'x' | 'y') => {
  const u = hashToUnit(`${key}:${axis}`);
  const sign = u > 0.5 ? 1 : -1;
  return sign * (0.35 + Math.abs(u - 0.5) * 2) * amount;
};

const organicRadius = (key: string, base: number) => {
  // Asymmetric "blob-ish" radius without SVG masks.
  const a = Math.round(jitter(key, 10, 'x'));
  const b = Math.round(jitter(key, 12, 'y'));
  const c = Math.round(jitter(key, 8, 'x'));
  const d = Math.round(jitter(key, 14, 'y'));
  const r1 = base + a;
  const r2 = base + 10 + b;
  const r3 = base + 6 + c;
  const r4 = base + 12 + d;
  const v1 = base + 10 - a;
  const v2 = base + 4 - b;
  const v3 = base + 14 - c;
  const v4 = base + 8 - d;
  return `${r1}px ${r2}px ${r3}px ${r4}px / ${v1}px ${v2}px ${v3}px ${v4}px`;
};

type MapTone = {
  label: string;
  rgbVar: string;
  solidVar: string;
  rgb?: string | null;
  hex?: string | null;
};

const tonePalette: MapTone[] = [
  { label: 'leaf', rgbVar: '--accent-green-rgb', solidVar: '--accent-green' },
  { label: 'aqua', rgbVar: '--accent-rgb', solidVar: '--accent' },
  { label: 'sky', rgbVar: '--accent-sky-rgb', solidVar: '--accent-sky' },
];

const toneFromRgb = (rgb: string, hex?: string | null): MapTone => ({
  label: 'domain',
  rgbVar: '--accent-rgb',
  solidVar: '--accent',
  rgb,
  hex: hex || null,
});

const resolveTone = (fallbackKey: string, rgb?: string | null, hex?: string | null): MapTone => {
  if (rgb) return toneFromRgb(rgb, hex);
  const fallback = tonePalette[hashToIndex(fallbackKey, tonePalette.length)] || tonePalette[0];
  return fallback;
};

const isMicroJob = (job: Job) =>
  (job as any).challenge_format === 'micro_job' ||
  Boolean((job as any).micro_job_kind) ||
  Boolean((job as any).micro_job_time_estimate);

const buildRelationMap = (relations: CareerMapGraphModel['taxonomy']['role_family_relations']) => {
  const out: Record<string, Record<string, number>> = {};
  for (const [source, targets] of Object.entries(relations || {})) {
    for (const [target, w] of Object.entries(targets || {})) {
      if (!out[source]) out[source] = {};
      out[source][target] = Math.max(out[source][target] || 0, Number(w) || 0);
      if (!out[target]) out[target] = {};
      out[target][source] = Math.max(out[target][source] || 0, Number(w) || 0);
    }
  }
  return out;
};

interface CareerMapProps {
  jobs: Job[];
  selectedJobId?: string | null;
  onSelectJob: (jobId: string | null) => void;
  graphData?: CareerMapGraphModel | null;
  loading?: boolean;
  error?: string | null;
  mode?: 'taxonomy' | 'hierarchy';
  centerNode?: { title: string; subtitle?: string | null; avatarUrl?: string | null; helper?: string | null } | null;
  className?: string;
  locale?: string;
}

const localeText = (
  language: string,
  labels: { cs: string; sk: string; de: string; pl: string; en: string }
) => {
  if (language === 'cs') return labels.cs;
  if (language === 'sk') return labels.sk;
  if (language === 'de') return labels.de;
  if (language === 'pl') return labels.pl;
  return labels.en;
};

type HierarchyLevel = 'domains' | 'companies' | 'challenges';

const normalizeKey = (value: string) => String(value || '').trim().toLowerCase();

const domainKeyForJob = (job: Job, inferredById: Record<string, any>) => {
  const inferred = inferredById?.[job.id];
  const primaryDomain = inferred?.primary_domain as string | undefined | null;
  if (primaryDomain) return normalizeKey(primaryDomain);
  const domain = (job.inferredDomain || job.matchedDomains?.[0] || '').toString().trim().toLowerCase();
  if (domain) return normalizeKey(domain);
  return 'general';
};

const simplifyText = (value: any, limit: number) => {
  const plain = String(value || '')
    .replace(/[#>*_`~[\]()!-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return '';
  if (plain.length <= limit) return plain;
  return `${plain.slice(0, Math.max(1, limit - 1)).trim()}…`;
};

const challengeLabelForJob = (job: Job) => {
  const source = String((job as any).challenge || job.aiAnalysis?.summary || job.description || job.title || '').trim();
  return simplifyText(source, 74) || simplifyText(job.title, 74) || 'Challenge';
};

const prettyDomainLabel = (key: string) => {
  const k = normalizeKey(key);
  if (!k || k === 'general') return 'General';
  return k.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
};

const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

const initialsFromLabel = (value: string) => {
  const parts = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return 'JS';
  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
};

const renderableAvatar = (value?: string | null) => {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.startsWith('data:')) return null;
  return normalized;
};

const resolveNodeCollisions = <T extends { x: number; y: number; width: number; height: number; angle?: number; minRadius?: number }>(
  input: T[],
  iterations = 22
): T[] => {
  const nodes = input.map((node) => ({ ...node }));
  for (let step = 0; step < iterations; step += 1) {
    for (let index = 0; index < nodes.length; index += 1) {
      const current = nodes[index];
      for (let inner = index + 1; inner < nodes.length; inner += 1) {
        const other = nodes[inner];
        const dx = other.x - current.x;
        const dy = other.y - current.y;
        const minX = (current.width + other.width) / 2 + 18;
        const minY = (current.height + other.height) / 2 + 18;
        if (Math.abs(dx) >= minX || Math.abs(dy) >= minY) continue;
        const overlapX = minX - Math.abs(dx);
        const overlapY = minY - Math.abs(dy);
        const pushX = overlapX / 2;
        const pushY = overlapY / 2;
        const directionX = dx === 0 ? (index % 2 === 0 ? -1 : 1) : Math.sign(dx);
        const directionY = dy === 0 ? (inner % 2 === 0 ? -1 : 1) : Math.sign(dy);
        current.x -= directionX * pushX;
        other.x += directionX * pushX;
        current.y -= directionY * pushY;
        other.y += directionY * pushY;
      }
    }
    for (const node of nodes) {
      const distance = Math.hypot(node.x, node.y) || 1;
      const targetRadius = Math.max(node.minRadius || 0, distance);
      if (distance < targetRadius) {
        const ratio = targetRadius / distance;
        node.x *= ratio;
        node.y *= ratio;
      }
      node.y *= 1.01;
    }
  }
  return nodes;
};

const CareerMapHierarchy: React.FC<CareerMapProps> = ({
  jobs,
  selectedJobId,
  onSelectJob,
  graphData,
  loading,
  error,
  centerNode,
  className,
  locale = 'en',
}) => {
  const language = String(locale || 'en').split('-')[0].toLowerCase();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({ w: 1200, h: 800 });
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startViewport: Viewport;
  } | null>(null);

  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 0.82 });
  const [level, setLevel] = useState<HierarchyLevel>('domains');
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const rect = entry.contentRect;
      setContainerSize({ w: Math.max(320, Math.round(rect.width)), h: Math.max(320, Math.round(rect.height)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const inferredById = graphData?.inferredById || {};

  const domainAgg = useMemo(() => {
    const byDomain: Record<string, { jobs: Job[]; companies: Set<string>; scores: number[] }> = {};
    for (const job of jobs || []) {
      const key = domainKeyForJob(job, inferredById);
      const row = (byDomain[key] ||= { jobs: [], companies: new Set(), scores: [] });
      row.jobs.push(job);
      row.companies.add(String(job.company || 'Unknown'));
      const s = Number(job.jhi?.score || job.priorityScore || 0);
      if (Number.isFinite(s) && s > 0) row.scores.push(s);
    }
    const nodes = Object.entries(byDomain).map(([key, row]) => {
      const mean = avg(row.scores);
      const weight = clamp(mean / 100, 0.05, 1);
      return {
        key,
        label: prettyDomainLabel(key),
        jobs: row.jobs,
        companies: row.companies,
        weight,
        avgScore: mean,
      };
    });
    nodes.sort((a, b) => (b.weight - a.weight) || (b.jobs.length - a.jobs.length));
    return nodes.slice(0, 9);
  }, [inferredById, jobs]);

  const companyAgg = useMemo(() => {
    if (!selectedDomain) return [];
    const byCompany: Record<string, { jobs: Job[]; scores: number[] }> = {};
    for (const job of jobs || []) {
      const d = domainKeyForJob(job, inferredById);
      if (d !== selectedDomain) continue;
      const company = String(job.company || 'Unknown');
      const row = (byCompany[company] ||= { jobs: [], scores: [] });
      row.jobs.push(job);
      const s = Number(job.jhi?.score || job.priorityScore || 0);
      if (Number.isFinite(s) && s > 0) row.scores.push(s);
    }
    const nodes = Object.entries(byCompany).map(([company, row]) => {
      const mean = avg(row.scores);
      const weight = clamp(mean / 100, 0.05, 1);
      return {
        key: company,
        label: company,
        jobs: row.jobs.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0)),
        weight,
        avgScore: mean,
      };
    });
    nodes.sort((a, b) => (b.weight - a.weight) || (b.jobs.length - a.jobs.length));
    return nodes.slice(0, 10);
  }, [inferredById, jobs, selectedDomain]);

  const challengeAgg = useMemo(() => {
    if (!selectedDomain || !selectedCompany) return [];
    const withinAll = (jobs || [])
      .filter((job) => domainKeyForJob(job, inferredById) === selectedDomain && String(job.company || 'Unknown') === selectedCompany)
      .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0))
      .slice(0, 16);

    const micro = withinAll.filter(isMicroJob);
    const regular = withinAll.filter((j) => !isMicroJob(j)).slice(0, 10);

    const regularNodes = regular.map((job) => {
      const score = Number(job.jhi?.score || job.priorityScore || 0);
      return {
        key: job.id,
        label: challengeLabelForJob(job),
        role: simplifyText(job.title, 52),
        job,
        weight: clamp(score / 100, 0.05, 1),
        score,
        kind: 'challenge' as const,
      };
    });
    if (micro.length === 0) return regularNodes;

    const microScore = avg(micro.map((j) => Number(j.jhi?.score || j.priorityScore || 0)).filter((s) => Number.isFinite(s)));
    return [
      ...regularNodes,
      {
        key: `micro:${selectedCompany}`,
        label: localeText(language, { cs: 'Mini projekty', sk: 'Mini projekty', de: 'Mini-Projekte', pl: 'Mini projekty', en: 'Mini projects' }),
        role: `${micro.length} ${localeText(language, { cs: 'mini výzev', sk: 'mini výziev', de: 'Mini-Challenges', pl: 'mini wyzwań', en: 'mini challenges' })}`,
        job: micro[0],
        microJobs: micro,
        weight: clamp((microScore || 58) / 100, 0.2, 1),
        score: microScore || 58,
        kind: 'micro' as const,
      }
    ];
  }, [inferredById, jobs, language, selectedCompany, selectedDomain]);

  const effectiveLevel = useMemo<HierarchyLevel>(() => {
    if (selectedCompany) return 'challenges';
    if (selectedDomain) return 'companies';
    return 'domains';
  }, [selectedCompany, selectedDomain]);

  useEffect(() => {
    setLevel(effectiveLevel);
    if (effectiveLevel === 'domains') {
      setSelectedCompany(null);
      setSelectedDomain(null);
    } else if (effectiveLevel === 'companies') {
      setSelectedCompany(null);
    }
  }, [effectiveLevel]);

  const onWheel = (event: React.WheelEvent) => {
    if (!containerRef.current) return;
    event.preventDefault();
    const delta = -event.deltaY;
    const nextScale = clamp(viewport.scale + delta * 0.0012, 0.65, 1.6);
    setViewport((prev) => ({ ...prev, scale: nextScale }));
  };

  const zoomIn = () => setViewport((prev) => ({ ...prev, scale: clamp(prev.scale + 0.12, 0.65, 1.6) }));
  const zoomOut = () => setViewport((prev) => ({ ...prev, scale: clamp(prev.scale - 0.12, 0.65, 1.6) }));
  const resetViewport = () => setViewport({ x: 0, y: 0, scale: 0.82 });

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    const el = event.target as Element | null;
    if (el && el.closest('[data-careermap-interactive="true"]')) return;
    (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startViewport: viewport,
    };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    setViewport({ ...drag.startViewport, x: drag.startViewport.x + dx, y: drag.startViewport.y + dy });
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
  };

  const rootTitle = (centerNode?.title || '').trim();
  const rootSubtitle = (centerNode?.subtitle || '').trim();
  const rootHelper = (centerNode?.helper || '').trim();
  const rootAvatar = renderableAvatar(centerNode?.avatarUrl);
  const copy = {
    map: localeText(language, { cs: 'Mapa', sk: 'Mapa', de: 'Karte', pl: 'Mapa', en: 'Map' }),
    reset: localeText(language, { cs: 'Reset', sk: 'Reset', de: 'Reset', pl: 'Reset', en: 'Reset' }),
    exploreDomains: localeText(language, {
      cs: 'Mrkni, do jakých oborů se tvoje doporučení větví.',
      sk: 'Mrkni, do akých odborov sa tvoje odporúčania vetvia.',
      de: 'Schau, in welche Bereiche sich deine Empfehlungen verzweigen.',
      pl: 'Zobacz, w jakie obszary rozchodzą się Twoje rekomendacje.',
      en: 'See which domains your recommendations branch into.',
    }),
    startFromDomains: localeText(language, {
      cs: 'Začni od oborů.',
      sk: 'Začni od odborov.',
      de: 'Starte bei den Bereichen.',
      pl: 'Zacznij od obszarów.',
      en: 'Start from domains.',
    }),
    pickCompany: localeText(language, {
      cs: 'Vyber firmu a sjeď níž ke konkrétním výzvám.',
      sk: 'Vyber firmu a prepadni sa k výzvam.',
      de: 'Wähle ein Unternehmen und gehe tiefer zu den Challenges.',
      pl: 'Wybierz firmę i zejdź do konkretnych wyzwań.',
      en: 'Pick a company to drill into challenges.',
    }),
    pickChallenge: localeText(language, {
      cs: 'Vyber výzvu a otevři, co se tam doopravdy děje.',
      sk: 'Vyber výzvu a otvor detail.',
      de: 'Wähle eine Challenge und öffne das Detail.',
      pl: 'Wybierz wyzwanie i otwórz szczegóły.',
      en: 'Pick a challenge to open details.',
    }),
    back: localeText(language, { cs: 'Zpět', sk: 'Späť', de: 'Zurück', pl: 'Wstecz', en: 'Back' }),
    loading: localeText(language, { cs: 'Načítám…', sk: 'Načítavam…', de: 'Lädt…', pl: 'Ładowanie…', en: 'Loading…' }),
    companies: localeText(language, { cs: 'firem', sk: 'firiem', de: 'Firmen', pl: 'firm', en: 'companies' }),
    roles: localeText(language, { cs: 'rolí', sk: 'rolí', de: 'Rollen', pl: 'ról', en: 'roles' }),
    avgJhi: localeText(language, { cs: 'průměr JHI', sk: 'priemer JHI', de: 'JHI-Schnitt', pl: 'średnie JHI', en: 'avg JHI' }),
    open: localeText(language, { cs: 'Otevřít detail', sk: 'Otvoriť detail', de: 'Detail öffnen', pl: 'Otwórz szczegóły', en: 'Open detail' }),
    relevance: localeText(language, { cs: 'Relevance', sk: 'Relevantnosť', de: 'Relevanz', pl: 'Trafność', en: 'Relevance' }),
    miniProjects: localeText(language, { cs: 'Mini projekty', sk: 'Mini projekty', de: 'Mini-Projekte', pl: 'Mini projekty', en: 'Mini projects' }),
    miniChallenges: localeText(language, { cs: 'mini výzev', sk: 'mini výziev', de: 'Mini-Challenges', pl: 'mini wyzwań', en: 'mini challenges' }),
    companyFallback: localeText(language, { cs: 'Firma', sk: 'Firma', de: 'Firma', pl: 'Firma', en: 'Company' }),
    you: localeText(language, { cs: 'TY', sk: 'TY', de: 'DU', pl: 'TY', en: 'YOU' }),
  };

  const centerLabel = level === 'domains'
    ? (rootTitle || copy.you)
    : (level === 'companies'
      ? prettyDomainLabel(selectedDomain || 'general')
      : (selectedCompany || copy.companyFallback));

  const orbitNodes = useMemo(() => {
    if (level === 'domains') {
      return domainAgg.map((d) => ({
        key: `domain:${d.key}`,
        label: d.label,
        weight: d.weight,
        meta: `${d.companies.size} ${copy.companies} • ${d.jobs.length} ${copy.roles}`,
        accent: getDomainAccent(d.key as any),
        onClick: () => {
          setSelectedDomain(d.key);
          setViewport((prev) => ({ ...prev, x: 0, y: 0, scale: Math.max(prev.scale, 1.05) }));
        },
      }));
    }
    if (level === 'companies') {
      return companyAgg.map((c) => ({
        key: `company:${c.key}`,
        label: c.label,
        weight: c.weight,
        meta: `${c.jobs.length} ${copy.roles} • ${copy.avgJhi} ${Math.round(c.avgScore || 0)}`,
        accent: getDomainAccent(selectedDomain as any),
        onClick: () => {
          setSelectedCompany(c.key);
          setViewport((prev) => ({ ...prev, x: 0, y: 0, scale: Math.max(prev.scale, 1.35) }));
        },
      }));
    }
    return challengeAgg.map((c: any) => ({
      key: `${c.kind === 'micro' ? 'micro' : 'challenge'}:${c.key}`,
      label: c.label,
      weight: c.weight,
      meta: c.role ? c.role : 'Open',
      kind: c.kind,
      job: c.job,
      microJobs: c.microJobs || null,
      accent: getDomainAccent(getPrimaryJobDomain(c.job) as any),
      onClick: () => onSelectJob(c.job?.id || null),
    }));
  }, [challengeAgg, companyAgg, domainAgg, level, onSelectJob, selectedDomain]);

  const orbitLayout = useMemo(() => {
    const count = orbitNodes.length || 1;
    const startAngle = -Math.PI / 2;
    const ringCapacity = level === 'challenges' ? 4 : 5;
    const availableRadius = Math.max(360, Math.min(containerSize.w * 0.44, containerSize.h * 0.43));
    const baseRadius = level === 'domains'
      ? availableRadius
      : (level === 'companies' ? availableRadius + 68 : availableRadius + 112);
    const laidOut = orbitNodes.map((item, idx) => {
      const ringIndex = count > ringCapacity ? Math.floor(idx / ringCapacity) : 0;
      const itemsInRing = count > ringCapacity
        ? Math.min(ringCapacity, count - ringIndex * ringCapacity)
        : count;
      const ringOffset = count > ringCapacity ? idx % ringCapacity : idx;
      const angle = startAngle + (ringOffset * (Math.PI * 2)) / Math.max(1, itemsInRing);
      const weight = clamp(item.weight || 0, 0, 1);
      const radius = baseRadius + ringIndex * 184 + (1 - weight) * 52;
      const ellipse = level === 'domains' ? 0.54 : 0.62;
      const horizontalStretch = level === 'domains' ? 1.22 : 1.14;
      const rawX = Math.cos(angle) * radius * horizontalStretch;
      const rawY = Math.sin(angle) * radius * ellipse;
      const kind = (item as any).kind;
      const width = Math.round((level === 'domains' ? 212 : (level === 'companies' ? 224 : (kind === 'micro' ? 228 : 240))) + weight * 14);
      const height = kind === 'micro' ? 124 : 90;
      return { ...item, x: Math.round(rawX + jitter(item.key, 12, 'x')), y: Math.round(rawY + jitter(item.key, 10, 'y')), angle, width, height, minRadius: radius };
    });
    return resolveNodeCollisions(laidOut).map(({ width, height, minRadius, ...node }) => node);
  }, [containerSize.h, containerSize.w, level, orbitNodes]);

  const highlightKey = hoveredKey;

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full h-full min-h-[600px] overflow-hidden rounded-[var(--radius-2xl)]',
        'bg-[linear-gradient(135deg,rgba(255,252,245,0.98),rgba(246,251,247,0.98)_46%,rgba(243,249,255,0.98))]',
        'dark:bg-[linear-gradient(135deg,rgba(41,30,8,0.20),rgba(13,32,30,0.82)_48%,rgba(17,24,39,0.98))]',
        'cursor-grab active:cursor-grabbing',
        className
      )}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.07] dark:opacity-[0.06]"
        style={{
          backgroundImage: 'radial-gradient(rgba(15,23,42,0.9) 1px, transparent 1px)',
          backgroundSize: '46px 46px',
        }}
      />

      <motion.div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <motion.div
          className="absolute -left-24 top-10 h-[420px] w-[420px] rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle at 30% 30%, rgba(var(--accent-sky-rgb),0.18), transparent 60%)' }}
          animate={{ x: [0, 28, 0], y: [0, -18, 0], opacity: [0.55, 0.78, 0.6] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -right-28 bottom-12 h-[520px] w-[520px] rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle at 35% 30%, rgba(var(--accent-rgb),0.16), transparent 62%)' }}
          animate={{ x: [0, -22, 0], y: [0, 20, 0], opacity: [0.45, 0.7, 0.52] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
        <svg className="w-full h-full">
          {Array.from({ length: 14 }).map((_, idx) => {
            const seed = (idx + 1) * 77;
            const x = (seed * 13) % 100;
            const y = (seed * 29) % 100;
            const r = 1.2 + ((seed * 7) % 24) / 10;
            return (
              <motion.circle
                key={`p-${idx}`}
                cx={`${x}%`}
                cy={`${y}%`}
                r={r}
                fill="rgba(var(--accent-rgb),0.12)"
                animate={{ opacity: [0.05, 0.18, 0.08], scale: [1, 1.12, 0.98] }}
                transition={{ duration: 7 + (idx % 4) * 1.7, repeat: Infinity, ease: 'easeInOut' }}
              />
            );
          })}
        </svg>
      </motion.div>

      <div
        className="absolute inset-0"
        style={{
          transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`,
          transformOrigin: '50% 50%',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          WebkitFontSmoothing: 'antialiased',
          textRendering: 'optimizeLegibility',
        }}
      >
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${containerSize.w} ${containerSize.h}`}
          preserveAspectRatio="none"
          shapeRendering="geometricPrecision"
          textRendering="geometricPrecision"
        >
          <defs>
            <linearGradient id="careermap-hlink" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(var(--accent-green-rgb),0.55)" />
              <stop offset="55%" stopColor="rgba(var(--accent-rgb),0.40)" />
              <stop offset="100%" stopColor="rgba(var(--accent-sky-rgb),0.35)" />
            </linearGradient>
            <filter id="careermap-softglow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.6" result="blur" />
              <feColorMatrix
                in="blur"
                type="matrix"
                values="
                  1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  0 0 0 0.55 0"
                result="glow"
              />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g>
            {orbitLayout.map((node) => {
              const w = clamp(node.weight || 0, 0, 1);
              const dim = highlightKey && highlightKey !== node.key;
              const opacity = dim ? 0.08 : 0.14 + w * 0.38;
              const strokeWidth = 1.2 + w * 3.2;
              const cx = containerSize.w / 2;
              const cy = containerSize.h / 2;
              const tx = cx + node.x;
              const ty = cy + node.y;
              const ox = jitter(node.key, 52, 'x');
              const oy = jitter(node.key, 48, 'y');
              const c1x = cx + node.x * 0.32 + ox;
              const c1y = cy + node.y * 0.06 + oy;
              const c2x = cx + node.x * 0.64 - ox * 0.6;
              const c2y = cy + node.y * 0.88 - oy * 0.5;
              return (
                <path
                  key={`hlink-${node.key}`}
                  d={`M ${cx} ${cy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}`}
                  fill="none"
                  stroke="url(#careermap-hlink)"
                  strokeOpacity={opacity}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  filter="url(#careermap-softglow)"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </g>
        </svg>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div
            data-careermap-interactive="true"
            className={cn(
              'relative w-[300px] sm:w-[340px] rounded-[2.4rem] border',
              'border-[rgba(var(--accent-green-rgb),0.22)]',
              'bg-[rgba(255,255,255,0.74)] dark:bg-[rgba(15,23,42,0.42)]',
              'backdrop-blur-xl shadow-[0_30px_90px_-70px_rgba(15,23,42,0.38)]'
            )}
          >
            <div className="absolute -inset-6 rounded-[3rem] blur-2xl opacity-70 pointer-events-none bg-[radial-gradient(circle_at_40%_20%,rgba(var(--accent-green-rgb),0.18),transparent_55%),radial-gradient(circle_at_75%_70%,rgba(var(--accent-rgb),0.14),transparent_60%)]" />
            <div className="relative px-6 py-6 sm:px-7 sm:py-7 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--accent-rgb),0.16)] bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)] dark:bg-white/10">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-green)]" />
                  {copy.map}
                </div>
                <button
                  type="button"
                  className="rounded-full border border-[rgba(var(--accent-rgb),0.16)] bg-white/70 px-3 py-1 text-xs font-semibold text-[var(--text-strong)] transition hover:bg-white dark:bg-white/10 dark:hover:bg-white/15"
                  onClick={resetViewport}
                >
                  {copy.reset}
                </button>
              </div>

              <div className="flex items-start gap-4">
                <div className="relative">
                  <div className="absolute -inset-3 rounded-full blur-xl opacity-60 bg-[radial-gradient(circle_at_30%_30%,rgba(var(--accent-green-rgb),0.35),transparent_65%)]" />
                  {rootAvatar ? (
                    <img
                      src={rootAvatar}
                      alt=""
                      className="relative h-14 w-14 rounded-2xl border border-[rgba(var(--accent-rgb),0.18)] object-cover shadow-sm"
                    />
                  ) : (
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(var(--accent-rgb),0.18)] bg-[linear-gradient(135deg,rgba(var(--accent-green-rgb),0.18),rgba(var(--accent-rgb),0.12))] text-base font-semibold tracking-[0.08em] text-[var(--text-strong)]">
                      {initialsFromLabel(rootTitle || centerLabel)}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-2xl sm:text-3xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
                    {centerLabel}
                  </div>
                  <div className="mt-2 text-sm text-[var(--text-muted)]">
                    {level === 'domains' ? (
                      rootSubtitle
                        ? rootSubtitle
                        : (selectedJobId ? copy.exploreDomains : copy.startFromDomains)
                    ) : (
                      level === 'companies'
                        ? copy.pickCompany
                        : copy.pickChallenge
                    )}
                  </div>
                  {level === 'domains' && rootHelper ? (
                    <div className="mt-2 text-xs font-medium text-[var(--text-faint)]">
                      {rootHelper}
                    </div>
                  ) : null}
                </div>
              </div>

              {(level !== 'domains' && (selectedDomain || selectedCompany)) ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-[rgba(var(--accent-rgb),0.16)] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[var(--text)] transition hover:bg-white dark:bg-white/10"
                    onClick={() => {
                      if (level === 'challenges') {
                        setSelectedCompany(null);
                        setViewport((prev) => ({ ...prev, scale: Math.min(prev.scale, 1.1) }));
                      } else {
                        setSelectedDomain(null);
                        setViewport((prev) => ({ ...prev, scale: 0.85 }));
                      }
                    }}
                  >
                    {copy.back}
                  </button>
                  {selectedDomain ? (
                    <span className="inline-flex items-center rounded-full border border-[rgba(var(--accent-green-rgb),0.18)] bg-[rgba(var(--accent-green-rgb),0.10)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-green)]">
                      {prettyDomainLabel(selectedDomain)}
                    </span>
                  ) : null}
                  {selectedCompany ? (
                    <span className="inline-flex items-center rounded-full border border-[rgba(var(--accent-rgb),0.14)] bg-white/60 px-3 py-1.5 text-xs font-semibold text-[var(--text)] dark:bg-white/8">
                      {selectedCompany}
                    </span>
                  ) : null}
                </div>
              ) : null}

              {loading ? (
                <div className="text-sm text-[var(--text-muted)]">{copy.loading}</div>
              ) : error ? (
                <div className="rounded-[var(--radius-xl)] border border-[rgba(var(--accent-rgb),0.18)] bg-white/55 px-4 py-3 text-sm text-[var(--text-muted)] dark:bg-white/8">
                  {error}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {orbitLayout.map((node: any) => {
          const tone = resolveTone(node.key, node.accent?.rgb, node.accent?.hex);
          const weight = clamp(node.weight || 0, 0, 1);
          const isDim = highlightKey && highlightKey !== node.key;
          const baseWidth = level === 'domains' ? 212 : (level === 'companies' ? 224 : (node.kind === 'micro' ? 228 : 240));
          const width = Math.round(baseWidth + weight * 14);
          return (
            <motion.div
              key={`hnode-${node.key}`}
              data-careermap-interactive="true"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: isDim ? 0.55 : 1, y: 0, scale: 1 }}
              transition={{ duration: 0.45 }}
              style={{
                left: `calc(50% + ${node.x}px)`,
                top: `calc(50% + ${node.y}px)`,
                width,
                transform: 'translate(-50%, -50%)',
              }}
              className="absolute"
              onMouseEnter={() => setHoveredKey(node.key)}
              onMouseLeave={() => setHoveredKey(null)}
            >
              <button
                type="button"
                onClick={node.onClick}
                className={cn(
                  'group relative w-full border px-4 py-3.5 text-left backdrop-blur-xl transition',
                  'bg-[rgba(255,255,255,0.78)] dark:bg-[rgba(15,23,42,0.38)]',
                  'border-[rgba(var(--accent-rgb),0.14)] hover:border-[rgba(var(--accent-green-rgb),0.22)]',
                  'shadow-[0_28px_90px_-76px_rgba(15,23,42,0.42)]'
                )}
                style={{
                  borderRadius: organicRadius(node.key, 26),
                  boxShadow: `0 28px 90px -76px rgba(15,23,42,0.42), 0 0 0 1px ${tone.rgb ? `rgba(${tone.rgb}, ${0.12 + weight * 0.10})` : `rgba(var(${tone.rgbVar}), ${0.10 + weight * 0.10})`} inset`,
                }}
                aria-label={node.label}
              >
                <span
                  aria-hidden
                  className="absolute -inset-6 blur-2xl opacity-70 pointer-events-none"
                  style={{
                    borderRadius: organicRadius(`${node.key}:halo`, 34),
                    background: `radial-gradient(circle at 35% 25%, ${tone.rgb ? `rgba(${tone.rgb}, ${0.20 + weight * 0.15})` : `rgba(var(${tone.rgbVar}), ${0.18 + weight * 0.15})`}, transparent 58%), radial-gradient(circle at 75% 70%, rgba(var(--accent-green-rgb), ${0.08 + weight * 0.08}), transparent 60%)`,
                  }}
                />

                <span className="relative flex items-start gap-3">
                    <span
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[rgba(var(--accent-rgb),0.16)]"
                    style={{
                      background: `linear-gradient(135deg, ${tone.rgb ? `rgba(${tone.rgb},0.22)` : `rgba(var(${tone.rgbVar}),0.18)`}, rgba(var(--accent-rgb),0.10))`,
                    }}
                  >
                    <EnergyNode size="sm" active pulse className="bg-[var(--accent)]" />
                  </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold tracking-[-0.02em] text-[var(--text-strong)]">
                        {node.label}
                      </span>
                      <span className="mt-1 block truncate text-xs font-medium text-[var(--text-muted)]">
                        {node.meta}
                      </span>
                      {node.job?.id ? (
                        <span className="mt-3 inline-flex items-center rounded-full border border-[rgba(var(--accent-green-rgb),0.18)] bg-[rgba(var(--accent-green-rgb),0.10)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-green)]">
                          {copy.open}
                        </span>
                      ) : null}
                      {node.kind === 'micro' && node.microJobs ? (
                      <span className="mt-3 flex flex-wrap gap-2">
                        {node.microJobs.slice(0, 3).map((j: Job) => (
                          <span
                            key={`microchip-${node.key}-${j.id}`}
                            className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--accent-rgb),0.14)] bg-white/60 px-3 py-1 text-[11px] font-semibold text-[var(--text)] dark:bg-white/8"
                            title={j.title}
                          >
                            <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                            {simplifyText(j.title, 22)}
                          </span>
                        ))}
                        {node.microJobs.length > 3 ? (
                          <span className="inline-flex items-center rounded-full border border-[rgba(var(--accent-rgb),0.14)] bg-white/55 px-3 py-1 text-[11px] font-semibold text-[var(--text-muted)] dark:bg-white/6">
                            +{node.microJobs.length - 3}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>

              {hoveredKey === node.key ? (
                <div
                  className="absolute left-1/2 top-full z-20 mt-3 w-[300px] -translate-x-1/2 rounded-[1.4rem] border border-[rgba(var(--accent-rgb),0.14)] bg-white/85 p-4 text-left shadow-[var(--shadow-overlay)] backdrop-blur-xl dark:bg-[rgba(15,23,42,0.82)]"
                >
                  <div className="text-sm font-semibold text-[var(--text-strong)]">{node.label}</div>
                  <div className="mt-1 text-xs font-medium text-[var(--text-muted)]">{node.meta}</div>
                  <div className="mt-3 h-px w-full bg-[var(--border-subtle)]" />
                  <div className="mt-3 flex items-center justify-between text-xs font-semibold text-[var(--text-faint)]">
                    <span>{copy.relevance}</span>
                    <span style={{ color: tone.hex || (tone.solidVar ? `var(${tone.solidVar})` : 'var(--accent)') }}>{Math.round(weight * 100)}%</span>
                  </div>
                </div>
              ) : null}
            </motion.div>
          );
        })}
      </div>

      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={zoomOut}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/82 text-[var(--text-strong)] shadow-sm backdrop-blur transition hover:bg-white dark:bg-[rgba(15,23,42,0.82)] dark:text-white dark:hover:bg-[rgba(15,23,42,0.92)]"
        >
          <Minus size={16} />
        </button>
        <button
          type="button"
          onClick={zoomIn}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/82 text-[var(--text-strong)] shadow-sm backdrop-blur transition hover:bg-white dark:bg-[rgba(15,23,42,0.82)] dark:text-white dark:hover:bg-[rgba(15,23,42,0.92)]"
        >
          <Plus size={16} />
        </button>
        <button
          type="button"
          onClick={resetViewport}
          className="inline-flex items-center gap-2 rounded-full bg-white/82 px-3 py-2 text-xs font-semibold text-[var(--text-strong)] shadow-sm backdrop-blur transition hover:bg-white dark:bg-[rgba(15,23,42,0.82)] dark:text-white dark:hover:bg-[rgba(15,23,42,0.92)]"
        >
          <RotateCcw size={14} />
          {copy.reset}
        </button>
      </div>
    </div>
  );
};

export const CareerMap: React.FC<CareerMapProps> = ({
  jobs,
  selectedJobId,
  onSelectJob,
  graphData,
  loading,
  error,
  mode = 'taxonomy',
  centerNode,
  className,
  locale = 'en',
}) => {
  const language = String(locale || 'en').split('-')[0].toLowerCase();
  const copy = {
    careerMap: localeText(language, { cs: 'Mapa práce', sk: 'Mapa práce', de: 'Jobkarte', pl: 'Mapa roboty', en: 'Work map' }),
    resetView: localeText(language, { cs: 'Reset pohledu', sk: 'Reset pohľadu', de: 'Ansicht zurücksetzen', pl: 'Reset widoku', en: 'Reset view' }),
    openCurrentDetail: localeText(language, { cs: 'Otevřít aktuální detail', sk: 'Otvoriť aktuálny detail', de: 'Aktuelles Detail öffnen', pl: 'Otwórz bieżące szczegóły', en: 'Open current detail' }),
    mapInferenceUnavailable: localeText(language, { cs: 'Mapová inference není dostupná', sk: 'Mapová inferencia nie je dostupná', de: 'Map-Inferenz ist nicht verfügbar', pl: 'Wnioskowanie mapy jest niedostępne', en: 'Map inference unavailable' }),
    buildingCareerGraph: localeText(language, { cs: 'Skládám kariérní graf…', sk: 'Skladám kariérny graf…', de: 'Karrieregraph wird erstellt…', pl: 'Buduję graf kariery…', en: 'Building career graph…' }),
    noRoles: localeText(language, { cs: 'Mapa je teď prázdná. Zkus povolit filtry nebo změnit směr hledání.', sk: 'Mapa je teraz prázdna. Skús povoliť filtre alebo zmeniť smer hľadania.', de: 'Die Karte ist gerade leer. Lockere die Filter oder ändere die Suchrichtung.', pl: 'Mapa jest teraz pusta. Poluzuj filtry albo zmień kierunek szukania.', en: 'The map is empty right now. Loosen the filters or change the search direction.' }),
    you: localeText(language, { cs: 'Ty', sk: 'Ty', de: 'Du', pl: 'Ty', en: 'You' }),
    roleSingle: localeText(language, { cs: 'role', sk: 'rola', de: 'Rolle', pl: 'rola', en: 'role' }),
    rolePlural: localeText(language, { cs: 'rolí', sk: 'rolí', de: 'Rollen', pl: 'ról', en: 'roles' }),
    inNeighborhood: localeText(language, { cs: 'v tomhle okolí', sk: 'v tomto okolí', de: 'in dieser Nachbarschaft', pl: 'w tej okolicy', en: 'in this neighborhood' }),
    domain: localeText(language, { cs: 'Obor', sk: 'Odbor', de: 'Bereich', pl: 'Obszar', en: 'Domain' }),
    openTopMatch: localeText(language, { cs: 'Vletět do top shody', sk: 'Vletieť do top zhody', de: 'In den Top-Match springen', pl: 'Wleć w top dopasowanie', en: 'Jump into the top match' }),
    reset: localeText(language, { cs: 'Reset', sk: 'Reset', de: 'Reset', pl: 'Reset', en: 'Reset' }),
    relatednessWeight: localeText(language, { cs: 'Síla vazby', sk: 'Sila väzby', de: 'Beziehungsstärke', pl: 'Siła powiązania', en: 'Relatedness weight' }),
    mini: localeText(language, { cs: 'Mini', sk: 'Mini', de: 'Mini', pl: 'Mini', en: 'Mini' }),
  };
  if (mode === 'hierarchy') {
    return (
      <CareerMapHierarchy
        jobs={jobs}
        selectedJobId={selectedJobId}
        onSelectJob={onSelectJob}
        graphData={graphData}
        loading={loading}
        error={error}
        className={className}
        mode={mode}
        centerNode={centerNode}
        locale={locale}
      />
    );
  }

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({ w: 1200, h: 800 });
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startViewport: Viewport;
  } | null>(null);

  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 0.82 });
  const [hoveredFamily, setHoveredFamily] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const rect = entry.contentRect;
      setContainerSize({ w: Math.max(320, Math.round(rect.width)), h: Math.max(320, Math.round(rect.height)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const focusJob = useMemo(() => {
    if (!jobs || jobs.length === 0) return null;
    return jobs.find((j) => j.id === selectedJobId) || jobs[0] || null;
  }, [jobs, selectedJobId]);

  const inferredById = graphData?.inferredById || {};
  const focusFamily = focusJob ? bucketKeyForJob(focusJob, inferredById) : null;
  const zoomIn = () => setViewport((prev) => ({ ...prev, scale: clamp(prev.scale + 0.12, 0.65, 1.6) }));
  const zoomOut = () => setViewport((prev) => ({ ...prev, scale: clamp(prev.scale - 0.12, 0.65, 1.6) }));
  const resetViewport = () => setViewport({ x: 0, y: 0, scale: 0.82 });
  const rootTitle = String(centerNode?.title || '').trim();
  const rootSubtitle = String(centerNode?.subtitle || '').trim();
  const rootHelper = String(centerNode?.helper || '').trim();
  const rootAvatar = renderableAvatar(centerNode?.avatarUrl);

  const familiesWithJobs = useMemo(() => {
    const buckets: Record<string, Job[]> = {};
    for (const job of jobs || []) {
      const family = bucketKeyForJob(job, inferredById);
      (buckets[family] ||= []).push(job);
    }
    for (const list of Object.values(buckets)) {
      list.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
    }
    return buckets;
  }, [jobs, inferredById]);

  const familyAccentByKey = useMemo(() => {
    const map: Record<string, ReturnType<typeof getDomainAccent>> = {};
    for (const [familyKey, familyJobs] of Object.entries(familiesWithJobs || {})) {
      const topDomain = familyJobs
        .map((job) => getPrimaryJobDomain(job))
        .find(Boolean) || null;
      map[familyKey] = getDomainAccent(topDomain as any);
    }
    return map;
  }, [familiesWithJobs]);

  const relationMap = useMemo(() => buildRelationMap(graphData?.taxonomy?.role_family_relations || {}), [graphData]);
  const orbitFamilies = useMemo(() => {
    const presentFamilies = Object.keys(familiesWithJobs || {});
    if (!focusFamily) {
      return presentFamilies.slice(0, 7).map((key) => ({ key, weight: 0.35 }));
    }
    const relations = focusFamily.startsWith('domain:') ? {} : (relationMap[focusFamily] || {});
    const candidates = presentFamilies
      .filter((k) => k !== focusFamily)
      .map((key) => ({ key, weight: Number(relations[key] || 0) }))
      .sort((a, b) => b.weight - a.weight);

    const topRelated = candidates.filter((c) => c.weight > 0).slice(0, 6);
    const includeSelf = [{ key: focusFamily, weight: 1 }];
    const fallback = candidates.filter((c) => c.weight <= 0).slice(0, Math.max(0, 6 - topRelated.length));
    return [...includeSelf, ...topRelated, ...fallback].slice(0, 8);
  }, [familiesWithJobs, focusFamily, relationMap]);

  const orbitLayout = useMemo(() => {
    const count = orbitFamilies.length || 1;
    const startAngle = -Math.PI / 2;
    const ringCapacity = 4;
    const availableRadius = Math.max(380, Math.min(containerSize.w * 0.46, containerSize.h * 0.46));
    const laidOut = orbitFamilies.map((item, idx) => {
      const ringIndex = count > ringCapacity ? Math.floor(idx / ringCapacity) : 0;
      const itemsInRing = count > ringCapacity
        ? Math.min(ringCapacity, count - ringIndex * ringCapacity)
        : count;
      const ringOffset = count > ringCapacity ? idx % ringCapacity : idx;
      const angle = startAngle + (ringOffset * (Math.PI * 2)) / Math.max(1, itemsInRing);
      const weight = clamp(item.weight || 0, 0, 1);
      const radius = availableRadius + ringIndex * 210 + (1 - weight) * 28;
      const x = Math.round(Math.cos(angle) * radius * 1.2 + jitter(item.key, 8, 'x'));
      const y = Math.round(Math.sin(angle) * radius * 0.56 + jitter(item.key, 6, 'y'));
      const width = item.key === focusFamily ? 280 : 228;
      return { ...item, x, y, width, height: 156, minRadius: radius, angle };
    });
    return resolveNodeCollisions(laidOut).map(({ width, height, minRadius, ...node }) => node);
  }, [containerSize.h, containerSize.w, orbitFamilies]);

  const onWheel = (event: React.WheelEvent) => {
    if (!containerRef.current) return;
    event.preventDefault();
    const delta = -event.deltaY;
    const nextScale = clamp(viewport.scale + delta * 0.0012, 0.65, 1.6);
    setViewport((prev) => ({ ...prev, scale: nextScale }));
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    const el = event.target as Element | null;
    if (el && el.closest('[data-careermap-interactive="true"]')) return;
    (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startViewport: viewport,
    };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    setViewport({ ...drag.startViewport, x: drag.startViewport.x + dx, y: drag.startViewport.y + dy });
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
  };

  const highlightFamily = hoveredFamily || focusFamily;

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full h-full min-h-[600px] overflow-hidden rounded-[var(--radius-2xl)]',
        'bg-[linear-gradient(135deg,rgba(255,252,245,0.98),rgba(246,251,247,0.98)_46%,rgba(243,249,255,0.98))]',
        'dark:bg-[linear-gradient(135deg,rgba(41,30,8,0.20),rgba(13,32,30,0.82)_48%,rgba(17,24,39,0.98))]',
        'cursor-grab active:cursor-grabbing',
        className
      )}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.07] dark:opacity-[0.06]"
        style={{
          backgroundImage: 'radial-gradient(rgba(15,23,42,0.9) 1px, transparent 1px)',
          backgroundSize: '46px 46px',
        }}
      />

      <motion.div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <svg className="w-full h-full">
          {Array.from({ length: 14 }).map((_, idx) => {
            const seed = (idx + 1) * 77;
            const x = (seed * 13) % 100;
            const y = (seed * 29) % 100;
            const r = 1.2 + ((seed * 7) % 24) / 10;
            return (
              <motion.circle
                key={`p-${idx}`}
                cx={`${x}%`}
                cy={`${y}%`}
                r={r}
                fill="rgba(var(--accent-rgb),0.12)"
                animate={{ opacity: [0.05, 0.18, 0.08], scale: [1, 1.12, 0.98] }}
                transition={{ duration: 7 + (idx % 4) * 1.7, repeat: Infinity, ease: 'easeInOut' }}
              />
            );
          })}
        </svg>
      </motion.div>

      <div
        className="absolute inset-0"
        style={{
          transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`,
          transformOrigin: '50% 50%',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          WebkitFontSmoothing: 'antialiased',
          textRendering: 'optimizeLegibility',
        }}
      >
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${containerSize.w} ${containerSize.h}`}
          preserveAspectRatio="none"
          shapeRendering="geometricPrecision"
          textRendering="geometricPrecision"
        >
          <defs>
            <linearGradient id="careermap-link" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(var(--accent-green-rgb),0.55)" />
              <stop offset="55%" stopColor="rgba(var(--accent-rgb),0.40)" />
              <stop offset="100%" stopColor="rgba(var(--accent-sky-rgb),0.35)" />
            </linearGradient>
          </defs>
          <title>{copy.careerMap}</title>
          <desc>{localeText(language, {
            cs: 'Organické vazby mezi rodinami rolí kolem vybrané pozice.',
            sk: 'Organické väzby medzi rodinami rolí okolo vybranej pozície.',
            de: 'Organische Verbindungen zwischen Rollenfamilien rund um die ausgewählte Position.',
            pl: 'Organiczne powiązania między rodzinami ról wokół wybranej pozycji.',
            en: 'Organic links between role families around the selected role.',
          })}</desc>
          <g>
          {focusJob
            ? orbitLayout
                .filter((node) => node.key !== focusFamily)
                .map((node) => {
                  const w = clamp(node.weight || 0, 0, 1);
                  const opacity = highlightFamily && highlightFamily !== node.key && highlightFamily !== focusFamily ? 0.06 : 0.14 + w * 0.35;
                  const strokeWidth = 1.2 + w * 2.4;
                  const cx = containerSize.w / 2;
                  const cy = containerSize.h / 2;
                  const tx = cx + node.x;
                  const ty = cy + node.y;
                  const c1x = cx + node.x * 0.35;
                  const c1y = cy + node.y * 0.1;
                  const c2x = cx + node.x * 0.65;
                  const c2y = cy + node.y * 0.85;
                  return (
                    <path
                      key={`link-${node.key}`}
                      d={`M ${cx} ${cy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}`}
                      fill="none"
                      stroke="url(#careermap-link)"
                      strokeOpacity={opacity}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })
            : null}
          </g>
        </svg>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {focusJob ? (
            <div
              data-careermap-interactive="true"
              className={cn(
                'relative w-[320px] sm:w-[360px] rounded-[2.4rem] border',
                'border-[rgba(var(--accent-green-rgb),0.22)]',
                'bg-[rgba(255,255,255,0.74)] dark:bg-[rgba(15,23,42,0.42)]',
                'backdrop-blur-xl shadow-[0_30px_90px_-70px_rgba(15,23,42,0.38)]'
              )}
              onMouseLeave={() => setHoveredFamily(null)}
            >
              <div className="absolute -inset-6 rounded-[3rem] blur-2xl opacity-70 pointer-events-none bg-[radial-gradient(circle_at_40%_20%,rgba(var(--accent-green-rgb),0.18),transparent_55%),radial-gradient(circle_at_75%_70%,rgba(var(--accent-rgb),0.14),transparent_60%)]" />
              <div className="relative px-6 py-6 sm:px-7 sm:py-7">
                <div className="flex items-center justify-between gap-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--accent-rgb),0.16)] bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)] dark:bg-white/10">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-green)]" />
                    {copy.careerMap}
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-[rgba(var(--accent-rgb),0.16)] bg-white/70 px-3 py-1 text-xs font-semibold text-[var(--text-strong)] transition hover:bg-white dark:bg-white/10 dark:hover:bg-white/15"
                    onClick={resetViewport}
                  >
                    {copy.resetView}
                  </button>
                </div>

                <div className="mt-5 flex items-start gap-4">
                  <div className="relative">
                    <div className="absolute -inset-3 rounded-full blur-xl opacity-60 bg-[radial-gradient(circle_at_30%_30%,rgba(var(--accent-green-rgb),0.35),transparent_65%)]" />
                    {rootAvatar ? (
                      <img
                        src={rootAvatar}
                        alt=""
                        className="relative h-14 w-14 rounded-2xl border border-[rgba(var(--accent-rgb),0.18)] object-cover shadow-sm"
                      />
                    ) : (
                      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(var(--accent-rgb),0.18)] bg-[linear-gradient(135deg,rgba(var(--accent-green-rgb),0.18),rgba(var(--accent-rgb),0.12))] text-base font-semibold tracking-[0.08em] text-[var(--text-strong)]">
                        {initialsFromLabel(rootTitle || copy.you)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-2xl sm:text-3xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
                      {rootTitle || copy.you}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
                      <span className="font-semibold text-[var(--text-strong)]">
                        {rootSubtitle || focusJob.title}
                      </span>
                      {rootHelper ? (
                        <>
                          <span className="h-1 w-1 rounded-full bg-[var(--border-subtle)]" />
                          <span>{rootHelper}</span>
                        </>
                      ) : focusJob.location ? (
                        <>
                          <span className="h-1 w-1 rounded-full bg-[var(--border-subtle)]" />
                          <span>{focusJob.location}</span>
                        </>
                      ) : null}
                    </div>
                    {focusFamily ? (
                      <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[rgba(var(--accent-green-rgb),0.18)] bg-[rgba(var(--accent-green-rgb),0.10)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-green)]">
                        <span className="h-2 w-2 rounded-full bg-[var(--accent-green)]" />
                        {titleizeKey(focusFamily)}
                      </div>
                    ) : null}
                    {focusJob ? (
                      <button
                        type="button"
                        className="mt-4 inline-flex items-center rounded-full border border-[rgba(var(--accent-rgb),0.14)] bg-white/75 px-3 py-1.5 text-xs font-semibold text-[var(--text-strong)] transition hover:bg-white dark:bg-white/8 dark:hover:bg-white/12"
                        onClick={() => onSelectJob(focusJob.id)}
                      >
                        {copy.openCurrentDetail}
                      </button>
                    ) : null}
                  </div>
                </div>

                {error ? (
                  <div className="mt-6 rounded-[var(--radius-xl)] border border-[rgba(var(--accent-rgb),0.18)] bg-white/55 px-4 py-3 text-sm text-[var(--text-muted)] dark:bg-white/8">
                    {copy.mapInferenceUnavailable}: {error}
                  </div>
                ) : null}

                {loading ? (
                  <div className="mt-6 rounded-[var(--radius-xl)] border border-dashed border-[rgba(var(--accent-rgb),0.22)] bg-white/55 px-4 py-3 text-sm text-[var(--text-muted)] dark:bg-white/8">
                    {copy.buildingCareerGraph}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="rounded-[var(--radius-2xl)] border border-[var(--border-subtle)] bg-white/70 px-6 py-5 text-sm text-[var(--text-muted)] dark:bg-white/5">
              {copy.noRoles}
            </div>
          )}
        </div>

        {orbitLayout.map((node) => {
          const familyKey = node.key;
          const familyJobs = familiesWithJobs[familyKey] || [];
          const accent = familyAccentByKey[familyKey];
          const tone = resolveTone(familyKey, accent?.rgb, accent?.hex);
          const isFocusFamily = !!focusFamily && familyKey === focusFamily;
          const isActive = highlightFamily ? (familyKey === highlightFamily || (isFocusFamily && highlightFamily === focusFamily)) : isFocusFamily;
          const weight = clamp(node.weight || 0, 0, 1);
          const cardWidth = familyKey === focusFamily ? 280 : 228;
          const chipCount = familyKey === focusFamily ? 3 : 2;
          const extra = Math.max(0, familyJobs.length - chipCount);
          const opacity = highlightFamily && !isActive ? 0.55 : 1;

          return (
            <motion.div
              key={`family-${familyKey}`}
              data-careermap-interactive="true"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity, y: 0, scale: 1 }}
              transition={{ duration: 0.55, delay: 0.02 }}
              className={cn(
                'absolute border backdrop-blur-xl',
                'bg-[rgba(255,255,255,0.74)] dark:bg-[rgba(15,23,42,0.36)]',
                isActive ? 'border-[rgba(var(--accent-green-rgb),0.26)]' : 'border-[rgba(var(--accent-rgb),0.14)]',
                'shadow-[0_28px_80px_-70px_rgba(15,23,42,0.44)]'
              )}
              style={{
                left: `calc(50% + ${node.x}px)`,
                top: `calc(50% + ${node.y}px)`,
                width: cardWidth,
                transform: 'translate(-50%, -50%)',
                borderRadius: organicRadius(familyKey, 30),
              }}
              onMouseEnter={() => setHoveredFamily(familyKey)}
              onMouseLeave={() => setHoveredFamily(null)}
            >
              <div
                aria-hidden
                className="absolute -inset-6 blur-2xl opacity-70 pointer-events-none"
                style={{
                  borderRadius: organicRadius(`${familyKey}:halo`, 38),
                  background: `radial-gradient(circle at 35% 25%, ${tone.rgb ? `rgba(${tone.rgb}, ${0.18 + weight * 0.15})` : `rgba(var(${tone.rgbVar}), ${0.18 + weight * 0.15})`}, transparent 58%), radial-gradient(circle at 75% 70%, rgba(var(--accent-green-rgb), ${0.10 + weight * 0.10}), transparent 60%)`,
                }}
              />

              <div className="relative px-5 py-[1.125rem]">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-[rgba(var(--accent-rgb),0.16)]"
                        style={{
                          background: `linear-gradient(135deg, ${tone.rgb ? `rgba(${tone.rgb},0.22)` : `rgba(var(${tone.rgbVar}),0.18)`}, rgba(var(--accent-rgb),0.10))`,
                        }}
                      >
                        <EnergyNode size="sm" active={isActive} pulse={isActive} className="bg-[var(--accent)]" />
                      </span>
                      <div className="truncate text-base font-semibold tracking-[-0.02em] text-[var(--text-strong)]">
                        {titleizeKey(familyKey)}
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-[var(--text-muted)]">
                      {familyJobs.length} {familyJobs.length === 1 ? copy.roleSingle : copy.rolePlural} {copy.inNeighborhood}
                    </div>
                    {familyKey.startsWith('domain:') ? (
                      <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[rgba(var(--accent-rgb),0.14)] bg-white/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)] dark:bg-white/8">
                        {copy.domain}
                      </div>
                    ) : null}
                  </div>

                    <div
                    className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold"
                    style={{
                      borderColor: 'rgba(var(--accent-rgb),0.16)',
                      background: tone.rgb
                        ? `rgba(${tone.rgb}, ${isActive ? 0.14 : 0.09})`
                        : `rgba(var(--accent-rgb), ${isActive ? 0.12 : 0.08})`,
                      color: tone.hex || (tone.solidVar ? `var(${tone.solidVar})` : 'var(--accent)'),
                    }}
                    title={copy.relatednessWeight}
                  >
                    {Math.round(weight * 100)}%
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {familyJobs[0] ? (
                    <button
                      type="button"
                      className="inline-flex items-center rounded-full border border-[rgba(var(--accent-green-rgb),0.18)] bg-[rgba(var(--accent-green-rgb),0.10)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-green)] transition hover:bg-[rgba(var(--accent-green-rgb),0.14)]"
                      onClick={() => onSelectJob(familyJobs[0].id)}
                    >
                      {copy.openTopMatch}
                    </button>
                  ) : null}
                  {familyJobs
                    .filter((job) => !isMicroJob(job))
                    .slice(0, chipCount)
                    .map((job) => {
                    const isSelected = selectedJobId === job.id;
                    return (
                      <button
                        key={`chip-${familyKey}-${job.id}`}
                        type="button"
                        className={cn(
                          'max-w-full rounded-full border px-3 py-1.5 text-left text-xs font-semibold transition',
                          'bg-white/70 dark:bg-white/8',
                          isSelected
                            ? 'border-[rgba(var(--accent-green-rgb),0.26)] text-[var(--accent-green)]'
                            : 'border-[rgba(var(--accent-rgb),0.14)] text-[var(--text)] hover:border-[rgba(var(--accent-rgb),0.22)] hover:bg-white'
                        )}
                        onClick={() => onSelectJob(job.id)}
                        title={job.title}
                      >
                        <span className="truncate">{job.title}</span>
                      </button>
                    );
                  })}

                  {familyJobs.some(isMicroJob) ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--accent-sky-rgb),0.18)] bg-[rgba(var(--accent-sky-rgb),0.10)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-sky)]">
                      <span className="h-2 w-2 rounded-full bg-[var(--accent-sky)]" />
                      {copy.mini} {familyJobs.filter(isMicroJob).length}
                    </span>
                  ) : null}
                  {extra > 0 ? (
                    <span className="inline-flex items-center rounded-full border border-[rgba(var(--accent-rgb),0.14)] bg-white/55 px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] dark:bg-white/6">
                      +{extra}
                    </span>
                  ) : null}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={zoomOut}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/82 text-[var(--text-strong)] shadow-sm backdrop-blur transition hover:bg-white dark:bg-[rgba(15,23,42,0.82)] dark:text-white dark:hover:bg-[rgba(15,23,42,0.92)]"
        >
          <Minus size={16} />
        </button>
        <button
          type="button"
          onClick={zoomIn}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/82 text-[var(--text-strong)] shadow-sm backdrop-blur transition hover:bg-white dark:bg-[rgba(15,23,42,0.82)] dark:text-white dark:hover:bg-[rgba(15,23,42,0.92)]"
        >
          <Plus size={16} />
        </button>
        <button
          type="button"
          onClick={resetViewport}
          className="inline-flex items-center gap-2 rounded-full bg-white/82 px-3 py-2 text-xs font-semibold text-[var(--text-strong)] shadow-sm backdrop-blur transition hover:bg-white dark:bg-[rgba(15,23,42,0.82)] dark:text-white dark:hover:bg-[rgba(15,23,42,0.92)]"
        >
          <RotateCcw size={14} />
          {copy.reset}
        </button>
      </div>
    </div>
  );
};

export default CareerMap;
