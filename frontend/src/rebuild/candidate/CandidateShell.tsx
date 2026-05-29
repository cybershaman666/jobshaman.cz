import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Building2,
  CheckCircle2,
  Clock3,
  Coins,
  Compass,
  ExternalLink,
  GripVertical,
  Loader2,
  MapPin,
  Sparkles,
  Star,
  Target,
  Users,
  X,
} from 'lucide-react';

import type { DialogueSummary, StoredAsset } from '../../types';
import { computeArchetype, fetchJcfpmItems, hasJcfpmAnswer, scoreJcfpmAnswer, submitJcfpm } from '../../services/v2JcfpmService';
import { clearJcfpmDraft, readJcfpmDraft, writeJcfpmDraft } from '../../services/jcfpmSessionState';
import { fetchHandshakeAvailability } from '../../services/v2HandshakeService';
import { roleMatchesDiscovery } from '../intelligence';
import type {
  CandidatePreferenceProfile,
  Company,
  HandshakeBlueprint,
  JcfpmQuestion,
  JCFPMSession,
  MarketplaceFilters,
  Role,
} from '../models';
import { resolveCompany } from '../shellDomain';
import { getApplicationStatusCopy } from '../status';
import {
  panelClass,
  pillEyebrowClass,
  primaryButtonClass,
  secondaryButtonClass,
  shellPageClass,
} from '../ui/shellStyles';
import { cn } from '../cn';
import { getStockCoverCandidatesForDomain } from '../../utils/domainCoverImages';
import {
  CandidateShellSurface,
  CompactActionButton,
  SectionEyebrow,
  ShellCard,
} from './CandidateShellSurface';
import {
  MarketplaceFilterPanel,
  MarketplaceActiveFilters,
  MarketplaceSearchPanel
} from './MarketplaceFilters';
import { RoleRealityBoard } from './RoleRealityBoard';
import { formatRoleCompensation } from './roleFormatting';
import { RecommendationFitPanel } from './RecommendationFitPanel';
import { ResilientImage, RoleCard } from './RoleCard';
import { DetailMetaPill, HeroStatCard, DetailSection } from './CandidateShellComponents';
import { getRoleInsight, type RoleInsightReply } from '../../services/v2MentorService';
import { MarkdownContent } from '../shared/MarkdownContent';

const MARKETPLACE_IMAGE_FALLBACK = '/hero-panorama.png';
const MARKETPLACE_LOGO_FALLBACK = '/logo-alt.png';
const JCFPM_DRAFT_SCOPE = 'candidate-profile';
const PINNED_MARKETPLACE_BENEFITS = [
  'Accommodation',
  'Dog-friendly office',
  'Child-friendly office',
] as const;

const normalizeBenefitToken = (value: string) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/children/g, 'child')
    .replace(/kids/g, 'child')
    .replace(/friendly/g, 'friendly')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const benefitFilterAliases = (value: string): string[] => {
  const normalized = normalizeBenefitToken(value);
  if (!normalized) return [];
  if (normalized.includes('accommodation') || normalized.includes('ubytovani') || normalized.includes('ubytovanie')) {
    return ['accommodation', 'housing', 'relocation support', 'relocation package', 'ubytovani', 'ubytovanie'];
  }
  if (normalized.includes('dog') && normalized.includes('friendly')) {
    return ['dog friendly office', 'dogfriendly office', 'dog friendly', 'dogfriendly'];
  }
  if (normalized.includes('child') && normalized.includes('friendly')) {
    return [
      'child friendly office',
      'childfriendly office',
      'children friendly office',
      'childrenfriendly office',
      'child friendly',
      'children friendly',
      'kid friendly office',
      'kids friendly office',
      'kid friendly',
      'kids friendly',
      'family friendly office',
    ];
  }
  return [normalized];
};

const buildImageCandidates = (sources: Array<string | null | undefined>): string[] =>
  Array.from(new Set(sources.map((source) => String(source || '').trim()).filter(Boolean)));

const cleanRoleDetailText = (value?: string | null): string =>
  String(value || '')
    .replace(/\s*First step:\s*undefined\.?/gi, '')
    .replace(/\bundefined\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

const cleanMarkdownDetailText = (value?: string | null): string =>
  String(value || '')
    .replace(/\s*First step:\s*undefined\.?/gi, '')
    .replace(/\bundefined\b/gi, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

type CompanyHeroMediaItem = {
  id: string;
  url: string;
  title: string;
  caption?: string | null;
  type: 'image' | 'video';
};

const isVideoUrl = (url: string): boolean => /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);

const isVideoAsset = (asset: StoredAsset): boolean => {
  const mime = String(asset.mime_type || asset.content_type || '').toLowerCase();
  return mime.startsWith('video/') || isVideoUrl(asset.url);
};

const buildCompanyHeroMedia = (company: Company, role: Role): CompanyHeroMediaItem[] => {
  const items: CompanyHeroMediaItem[] = [];
  const seen = new Set<string>();
  const addItem = (item: CompanyHeroMediaItem) => {
    const url = String(item.url || '').trim();
    if (!url || seen.has(url)) return;
    seen.add(url);
    items.push({ ...item, url });
  };

  addItem({
    id: 'cover',
    url: company.coverImage || role.companyCoverImage || role.heroImage,
    title: company.name,
    caption: company.tagline,
    type: isVideoUrl(company.coverImage || '') ? 'video' : 'image',
  });

  if (company.marketplaceVideoUrl) {
    addItem({
      id: 'marketplace-video',
      url: company.marketplaceVideoUrl,
      title: company.name,
      caption: role.title,
      type: 'video',
    });
  }

  company.gallery.forEach((asset, index) => {
    addItem({
      id: asset.id || `gallery-${index}`,
      url: asset.url,
      title: asset.title || asset.name || `${company.name} ${index + 1}`,
      caption: asset.caption,
      type: isVideoAsset(asset) ? 'video' : 'image',
    });
  });

  return items;
};

const CompanyHeroMediaStage: React.FC<{
  company: Company;
  role: Role;
  fallbackSrcs: string[];
  t: any;
}> = ({ company, role, fallbackSrcs, t }) => {
  const media = React.useMemo(() => buildCompanyHeroMedia(company, role), [company, role]);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const active = media[activeIndex] || media[0];
  const hasMultiple = media.length > 1;

  React.useEffect(() => {
    setActiveIndex(0);
  }, [role.id, media.length]);

  React.useEffect(() => {
    if (!hasMultiple) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % media.length);
    }, active?.type === 'video' ? 9000 : 5200);
    return () => window.clearInterval(timer);
  }, [active?.type, hasMultiple, media.length]);

  if (!active) {
    return (
      <ResilientImage
        src={role.heroImage}
        fallbackSrcs={fallbackSrcs}
        alt={company.name}
        className="h-full min-h-[18rem] w-full object-cover"
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <div className="group relative h-full min-h-[18rem] overflow-hidden bg-slate-950">
      {active.type === 'video' ? (
        <video
          key={active.url}
          src={active.url}
          className="h-full min-h-[18rem] w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          controls
        />
      ) : (
        <ResilientImage
          key={active.url}
          src={active.url}
          fallbackSrcs={fallbackSrcs}
          alt={active.title}
          className="h-full min-h-[18rem] w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950/45 via-slate-950/10 to-transparent" />
      <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-end justify-between gap-3 text-white">
        <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-white/40 bg-white/90 p-2 shadow-sm backdrop-blur-md">
          <ResilientImage
            src={company.logo}
            fallbackSrcs={fallbackSrcs}
            alt={company.name}
            className="h-full w-full object-contain"
            loading="lazy"
            decoding="async"
          />
        </div>
        {hasMultiple ? (
          <div className="flex items-center gap-2 rounded-full bg-white/14 px-2 py-1 backdrop-blur-md">
            {media.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={t('rebuild.briefing.show_media_slide', { defaultValue: 'Zobrazit médium {{n}}', n: index + 1 })}
                className={cn(
                  'h-2.5 rounded-full transition',
                  index === activeIndex ? 'w-7 bg-white' : 'w-2.5 bg-white/48 hover:bg-white/80',
                )}
              />
            ))}
          </div>
        ) : null}
      </div>
      {hasMultiple ? (
        <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-3 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            onClick={() => setActiveIndex((current) => (current - 1 + media.length) % media.length)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/86 text-slate-900 shadow-sm backdrop-blur-md transition hover:bg-white"
            aria-label={t('rebuild.briefing.previous_media', { defaultValue: 'Předchozí médium' })}
          >
            <ArrowLeft size={17} />
          </button>
          <button
            type="button"
            onClick={() => setActiveIndex((current) => (current + 1) % media.length)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/86 text-slate-900 shadow-sm backdrop-blur-md transition hover:bg-white"
            aria-label={t('rebuild.briefing.next_media', { defaultValue: 'Další médium' })}
          >
            <ArrowRight size={17} />
          </button>
        </div>
      ) : null}
    </div>
  );
};

const normalizeRoleDetailText = (value?: string | null): string =>
  cleanRoleDetailText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const firstUniqueRoleText = (...values: Array<string | null | undefined>): string => {
  const seen = new Set<string>();
  for (const value of values) {
    const cleaned = cleanMarkdownDetailText(value);
    const normalized = normalizeRoleDetailText(cleaned);
    if (!cleaned || !normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    return cleaned;
  }
  return '';
};

// Components extracted to separate files

// Components extracted to separate files (RecommendationFitPanel, JhiNetGraph, RoleRealityBoard)

// ─── ShamiGuidePanel ────────────────────────────────────────────────────────
const ShamiGuidePanel: React.FC<{
  role: Role;
  blueprint: HandshakeBlueprint;
  company: Company;
  t: any;
}> = ({ role, blueprint, company, t }) => {
  const { i18n } = useTranslation();
  const [insight, setInsight] = React.useState<RoleInsightReply | null>(null);
  const [loadingInsight, setLoadingInsight] = React.useState(false);

  const hints: { id: string; icon: React.ReactNode; label: string; text: string }[] = [];

  if (role.firstStep) {
    hints.push({
      id: 'first_step',
      icon: <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[#0f95ac]" />,
      label: t('rebuild.shami.hint_first_step', { defaultValue: 'První signál' }),
      text: role.firstStep,
    });
  }
  if (blueprint.overview) {
    hints.push({
      id: 'blueprint',
      icon: <Compass size={14} className="mt-0.5 shrink-0 text-[#0f95ac]" />,
      label: t('rebuild.shami.hint_journey', { defaultValue: 'Jak probíhá výběr' }),
      text: blueprint.overview,
    });
  }
  const reviewerIntro = company.reviewer?.intro || role.companyNarrative || '';
  if (reviewerIntro) {
    hints.push({
      id: 'reviewer',
      icon: <Users size={14} className="mt-0.5 shrink-0 text-[#0f95ac]" />,
      label: t('rebuild.shami.hint_context', { defaultValue: 'Kontext týmu' }),
      text: reviewerIntro,
    });
  }

  const companyName = company.name || role.companyName || '';
  const aiSignals = insight?.signals?.length ? insight.signals.slice(0, 3).map((signal, index) => ({
    id: `${signal.label}-${index}`,
    icon: index === 0
      ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[#0f95ac]" />
      : index === 1
        ? <Compass size={14} className="mt-0.5 shrink-0 text-[#0f95ac]" />
        : <Users size={14} className="mt-0.5 shrink-0 text-[#0f95ac]" />,
    label: signal.label,
    text: signal.text,
  })) : [];
  const visibleSignals = aiSignals.length ? aiSignals : hints;

  React.useEffect(() => {
    let cancelled = false;
    setLoadingInsight(true);
    void getRoleInsight(role, blueprint, i18n.language || 'en')
      .then((next) => {
        if (!cancelled) setInsight(next);
      })
      .catch(() => {
        if (!cancelled) setInsight(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingInsight(false);
      });
    return () => {
      cancelled = true;
    };
  }, [role.id, blueprint.id, i18n.language]);

  return (
    <ShellCard className="overflow-hidden">
      <div className="bg-[linear-gradient(135deg,rgba(18,175,203,0.08),rgba(255,255,255,0.84)_44%,rgba(248,250,252,0.9))] p-5 md:p-6">
        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.45fr] xl:items-start">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#0f95ac] shadow-[0_12px_24px_-18px_rgba(15,149,172,0.7)]">
              <Sparkles size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#0f95ac]">Shami</div>
              <h3 className="mt-1 text-lg font-semibold tracking-normal text-slate-900">
                {insight?.headline || (companyName
                  ? t('rebuild.shami.guide_title_company', { defaultValue: `Co chce ${companyName} pochopit o tobe`, company: companyName })
                  : t('rebuild.shami.guide_title', { defaultValue: 'Co chce firma pochopit o tobe' }))}
              </h3>
              <p className="mt-1.5 max-w-xl text-sm leading-6 text-slate-600">
                {insight?.summary || (loadingInsight
                  ? t('rebuild.shami.guide_loading', { defaultValue: 'Shami cte roli, realitu a tvuj profil...' })
                  : t('rebuild.shami.guide_subtitle', { defaultValue: 'Handshake neposuzuje CV keywordy. Hleda zpusob uvazovani, trade-offy a schopnost popsat prvni prakticky krok.' }))}
              </p>
            </div>
          </div>
          {visibleSignals.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-3">
              {visibleSignals.slice(0, 3).map((hint) => (
                <div key={hint.id} className="rounded-lg border border-[rgba(18,175,203,0.14)] bg-white/86 p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#0f95ac]">
                    {hint.icon}
                    {hint.label}
                  </div>
                  <p className="mt-2 break-words text-sm leading-6 text-slate-600">{hint.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-[rgba(18,175,203,0.14)] bg-white/86 p-4 text-sm leading-6 text-slate-600">
              {t('rebuild.shami.guide_fallback', { defaultValue: 'Prečti výzvu jako realnou praci. Silna odpoved ukaze, ze rozumis problemu, ne jen ze mas zajem.' })}
            </div>
          )}
        </div>
        {(insight?.watch_out || insight?.suggested_first_move) ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {insight.watch_out ? (
              <div className="break-words rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-sm leading-6 text-amber-900">
                <span className="font-semibold">{t('rebuild.shami.watch_out', { defaultValue: 'Na co si dát pozor' })}: </span>{insight.watch_out}
              </div>
            ) : null}
            {insight.suggested_first_move ? (
              <div className="break-words rounded-lg border border-[rgba(18,175,203,0.18)] bg-white/80 p-3 text-sm leading-6 text-slate-700">
                <span className="font-semibold text-slate-900">{t('rebuild.shami.first_move', { defaultValue: 'První krok' })}: </span>{insight.suggested_first_move}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </ShellCard>
  );
};

// ────────────────────────────────────────────────────────────────────────────

const CompanyEncounterPanel: React.FC<{
  role: Role;
  company?: Company | null;
  companyStory?: string;
  t: any;
}> = ({ role, company, companyStory, t }) => {
  if (!company) {
    return (
      <ShellCard className="p-6">
        <SectionEyebrow><Building2 size={12} />{t('rebuild.detail.external_source_title', { defaultValue: 'Offer source' })}</SectionEyebrow>
        <div className="mt-5 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100">
            {role.companyLogo ? (
              <img src={role.companyLogo} alt="" className="h-full w-full object-contain p-2" />
            ) : (
              <Building2 size={24} className="text-slate-300" />
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold tracking-[-0.03em] text-slate-900">{role.companyName || t('rebuild.detail.external_source', { defaultValue: 'External source' })}</div>
            <div className="text-sm text-slate-500 uppercase tracking-wider font-bold text-[10px]">{t('rebuild.detail.imported_label', { defaultValue: 'Imported' })}</div>
          </div>
        </div>
      </ShellCard>
    );
  }

  const reviewerName = company.reviewer.name;
  const reviewerRole = company.reviewer.role;
  const intro = company.reviewer.intro || role.companyNarrative || role.importedNote || '';
  const logoFallbacks = buildImageCandidates([company.logo, role.companyLogo, MARKETPLACE_LOGO_FALLBACK, '/logo.png']);

  return (
    <ShellCard className="p-6">
      <SectionEyebrow><Users size={12} />{t('rebuild.detail.encounter_title', { defaultValue: 'Who you will meet' })}</SectionEyebrow>
      <div className="mt-5 flex items-center gap-4">
        <ResilientImage src={company.reviewer.avatarUrl || company.logo} fallbackSrcs={logoFallbacks} alt={reviewerName} className="h-16 w-16 rounded-2xl object-cover" loading="lazy" decoding="async" />
        <div>
          <div className="text-lg font-semibold tracking-[-0.03em] text-slate-900">{reviewerName}</div>
          <div className="text-sm text-slate-500">{reviewerRole}</div>
        </div>
      </div>
      {intro ? <p className="mt-5 text-sm leading-7 text-slate-600">{intro}</p> : null}
      {companyStory ? (
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            <Building2 size={12} />
            {t('rebuild.briefing.company_story', { defaultValue: 'Příběh společnosti' })}
          </div>
          <MarkdownContent value={companyStory} className="text-sm text-slate-600 prose-p:leading-7 prose-li:leading-6" />
        </div>
      ) : null}
      <div className="mt-5 grid gap-3">
        <DetailMetaPill label={t('rebuild.detail.company', { defaultValue: 'Company' })} value={company.name} />
        <DetailMetaPill label={t('rebuild.detail.source', { defaultValue: 'Source' })} value={t('rebuild.detail.native', { defaultValue: 'Jobshaman native' })} />
      </div>
    </ShellCard>
  );
};

const SkillSignalCard: React.FC<{
  title: string;
  body: React.ReactNode;
  icon: React.ReactNode;
  tone?: 'default' | 'accent';
}> = ({ title, body, icon, tone = 'default' }) => (
  <div className={cn(
    'rounded-lg border p-4',
    tone === 'accent'
      ? 'border-[rgba(18,175,203,0.2)] bg-[rgba(18,175,203,0.06)]'
      : 'border-slate-200 bg-slate-50/80',
  )}>
    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
      <span className="text-[#0f95ac]">{icon}</span>
      {title}
    </div>
    <div className="mt-3 text-sm leading-7 text-slate-600">{body}</div>
  </div>
);

const DetailActionPanel: React.FC<{
  role: Role;
  sourceLink?: string;
  existingApplication?: DialogueSummary | null;
  isSaved: boolean;
  onToggleSaved: () => void;
  navigate: (path: string) => void;
  sticky?: boolean;
  className?: string;
  t: any;
}> = ({ role, sourceLink, existingApplication, isSaved, onToggleSaved, navigate, sticky = true, className, t }) => {
  const { i18n } = useTranslation();
  const [availability, setAvailability] = React.useState(role.slotAvailability || null);
  React.useEffect(() => {
    let cancelled = false;
    if (role.source !== 'curated') return;
    void fetchHandshakeAvailability(role.id).then((next) => {
      if (!cancelled && next) setAvailability(next);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [role.id, role.source]);
  const blocked = Boolean(availability && !availability.available && !availability.existingHandshakeId && !existingApplication);
  const compensation = formatRoleCompensation(role, t('rebuild.prep.compensation_unknown', { defaultValue: 'Neuvedeno' }), i18n?.language);
  return (
    <ShellCard className={cn(sticky ? 'sticky top-6' : '', 'overflow-hidden p-5 md:p-6', className)}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#12AFCB] via-cyan-300 to-emerald-300" />
      <SectionEyebrow>{role.source === 'curated' ? t('rebuild.briefing.next_step', { defaultValue: 'Dalsi krok' }) : t('rebuild.detail.external_source_title', { defaultValue: 'External source' })}</SectionEyebrow>
      <h3 className="mt-3 text-xl font-semibold tracking-normal text-slate-900">
        {role.source === 'curated'
          ? existingApplication
            ? t('rebuild.briefing.open_journey', { defaultValue: 'Otevrit rozpracovany handshake' })
            : t('rebuild.briefing.start_journey', { defaultValue: 'Zacit odpovidat' })
          : t('rebuild.prep.open_listing_title', { defaultValue: 'Original listing' })}
      </h3>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        {role.source === 'curated'
          ? role.firstStep
          : t('rebuild.prep.source_warning_body', { defaultValue: 'The imported offer may have changed terms. Before responding, open the original site and verify current text, validity, and contact.' })}
      </p>
      <div className="mt-5 grid gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <MapPin size={16} className="shrink-0 text-slate-400" />
          <span className="font-medium">{role.location}</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <Clock3 size={16} className="shrink-0 text-slate-400" />
          <span className="font-medium">{role.workModel}</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <Coins size={16} className="shrink-0 text-slate-400" />
          <span className="font-medium">{compensation}</span>
        </div>
      </div>
      {availability?.companyChallenge ? (
        <div className="mt-4 rounded-lg border border-[#12AFCB]/20 bg-[#12AFCB]/7 px-4 py-3 text-sm text-slate-700">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#0f95ac]">{t('rebuild.briefing.slots_available', { defaultValue: 'Handshake sloty' })}</div>
          <div className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">
            {availability.companyChallenge.remaining} <span className="text-sm font-medium text-slate-500">/ {availability.companyChallenge.limit}</span>
          </div>
        </div>
      ) : null}
      {blocked ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {availability?.reason === 'candidate_slots_full'
            ? t('rebuild.briefing.candidate_slots_full', { defaultValue: 'Your active handshake slots are full.' })
            : t('rebuild.briefing.company_slots_full', { defaultValue: 'This challenge is currently full.' })}
        </div>
      ) : null}
      <div className="mt-5 flex flex-col gap-3">
        {role.source === 'curated' ? (
          <button type="button" disabled={blocked} onClick={() => navigate(`/candidate/journey/${role.id}`)} className={cn(primaryButtonClass, blocked ? 'cursor-not-allowed opacity-60' : '')}>
            {existingApplication || availability?.existingHandshakeId ? t('rebuild.briefing.open_journey', { defaultValue: 'Otevrit handshake' }) : t('rebuild.briefing.start_journey', { defaultValue: 'Zacit odpovidat' })} <ArrowRight size={16} />
          </button>
        ) : sourceLink ? (
          <a href={sourceLink} target="_blank" rel="noreferrer" className={primaryButtonClass}>{t('rebuild.prep.open_listing', { defaultValue: 'Open source listing' })} <ExternalLink size={16} /></a>
        ) : (
          <button type="button" className={cn(primaryButtonClass, 'cursor-not-allowed opacity-60')} disabled>{t('rebuild.prep.source_missing', { defaultValue: 'Source not available' })}</button>
        )}
        <button type="button" onClick={onToggleSaved} className={secondaryButtonClass}><Star size={16} className={isSaved ? 'fill-current text-amber-500' : ''} />{isSaved ? t('rebuild.briefing.saved_role', { defaultValue: 'Saved role' }) : t('rebuild.briefing.save_role', { defaultValue: 'Save role' })}</button>
      </div>
    </ShellCard>
  );
};

const MobileSwipeMarketplace: React.FC<{
  roles: Role[];
  companyLibrary: Company[];
  savedRoleIds: string[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onRoleInteraction: (roleId: string, eventType: 'swipe_left' | 'swipe_right' | 'save' | 'unsave') => void;
  navigate: (path: string) => void;
  t: any;
}> = ({ roles, companyLibrary, savedRoleIds, hasMore, loadingMore, onLoadMore, onRoleInteraction, navigate, t }) => {
  const [index, setIndex] = React.useState(0);
  const [dragX, setDragX] = React.useState(0);
  const touchStartX = React.useRef<number | null>(null);

  React.useEffect(() => {
    setIndex((current) => Math.min(current, Math.max(roles.length - 1, 0)));
  }, [roles.length]);

  const currentRole = roles[index] || null;
  const nextRole = roles[index + 1] || null;

  const commitSwipe = React.useCallback((direction: 'left' | 'right') => {
    if (!currentRole) return;
    onRoleInteraction(currentRole.id, direction === 'left' ? 'swipe_left' : 'swipe_right');
    setDragX(0);
    setIndex((current) => current + 1);
  }, [currentRole, onRoleInteraction]);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current == null) return;
    setDragX((event.touches[0]?.clientX ?? 0) - touchStartX.current);
  };

  const handleTouchEnd = () => {
    if (Math.abs(dragX) > 110) {
      commitSwipe(dragX < 0 ? 'left' : 'right');
    } else {
      setDragX(0);
    }
    touchStartX.current = null;
  };

  if (!currentRole) {
    return (
      <div className="md:hidden -mx-4 min-h-[calc(100dvh-8rem)] bg-[linear-gradient(180deg,#f8fafc,#eef6f8)] px-4 py-8">
        <div className="flex h-full items-center justify-center rounded-[32px] border border-slate-200 bg-white/88 p-8 text-center shadow-[0_30px_80px_-42px_rgba(15,23,42,0.16)]">
          <div>
            <div className="text-lg font-semibold text-slate-900">{hasMore ? t('rebuild.marketplace.loading_more', { defaultValue: 'More offers are waiting.' }) : t('rebuild.marketplace.no_more_roles', { defaultValue: 'That\'s all for now.' })}</div>
            <div className="mt-3 text-sm leading-7 text-slate-500">{hasMore ? t('rebuild.marketplace.load_more_copy', { defaultValue: 'Load the next batch and continue in swipe mode.' }) : t('rebuild.marketplace.no_more_roles_copy', { defaultValue: 'Try adjusting filters or come back later for more offers.' })}</div>
            {hasMore ? (
              <button type="button" onClick={onLoadMore} disabled={loadingMore} className={cn(primaryButtonClass, 'mt-5')}>
                {loadingMore ? <Loader2 size={16} className="animate-spin" /> : null}
                {t('rebuild.marketplace.load_more', { defaultValue: 'Load more' })}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const company = resolveCompany(currentRole, companyLibrary);
  const isSaved = savedRoleIds.includes(String(currentRole.id));
  const coverFallbacks = buildImageCandidates([
    currentRole.companyCoverImage,
    company.coverImage,
    ...getStockCoverCandidatesForDomain('operations', `${currentRole.companyName}:${currentRole.title}`),
    MARKETPLACE_IMAGE_FALLBACK,
  ]);
  const logoFallbacks = buildImageCandidates([
    currentRole.companyLogo,
    company.logo,
    MARKETPLACE_LOGO_FALLBACK,
    '/logo.png',
  ]);

  return (
    <div className="md:hidden -mx-4 min-h-[calc(100dvh-8rem)] bg-[linear-gradient(180deg,#f8fafc,#eef6f8)] px-4 py-2">
      <div className="mb-3 flex items-center justify-between px-1">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t('rebuild.marketplace.mobile_swipe_label', { defaultValue: 'Swipe mode' })}</div>
          <div className="mt-1 text-sm font-medium text-slate-600">{index + 1} / {roles.length}</div>
        </div>
        <button type="button" onClick={() => navigate(currentRole.source === 'curated' ? `/candidate/role/${currentRole.id}` : `/candidate/imported/${currentRole.id}`)} className={secondaryButtonClass}>
          {t('rebuild.marketplace.open_detail', { defaultValue: 'Open detail' })}
        </button>
      </div>
      <div className="relative mx-auto max-w-md">
        {nextRole ? (
          <div className="absolute inset-x-4 top-4 h-full rounded-[30px] bg-slate-200/70 shadow-[0_24px_48px_-38px_rgba(15,23,42,0.3)]" />
        ) : null}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="relative overflow-hidden rounded-[34px] border border-slate-200 bg-slate-900 shadow-[0_42px_100px_-52px_rgba(15,23,42,0.5)] transition"
          style={{ transform: `translateX(${dragX}px) rotate(${dragX / 18}deg)` }}
        >
          <div className="absolute inset-0">
            <ResilientImage src={currentRole.heroImage} fallbackSrcs={coverFallbacks} alt={currentRole.title} className="h-full w-full object-cover" loading="lazy" decoding="async" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,15,33,0.08),rgba(5,15,33,0.7)_62%,rgba(5,15,33,0.94))]" />
          </div>
          <div className="relative flex min-h-[calc(100dvh-14rem)] flex-col justify-between p-5 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]">
                {currentRole.source === 'curated' ? t('rebuild.marketplace.curated_roles_title', { defaultValue: 'Curated roles' }) : t('rebuild.marketplace.imported_title', { defaultValue: 'Imported opportunities' })}
              </div>
              {isSaved ? <div className="rounded-full bg-amber-400/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-950">{t('rebuild.briefing.saved_role', { defaultValue: 'Saved role' })}</div> : null}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <ResilientImage src={company.logo} fallbackSrcs={logoFallbacks} alt={company.name} className="h-12 w-12 rounded-2xl border border-white/15 object-cover" loading="lazy" decoding="async" />
                <div>
                  <div className="text-sm font-medium text-white/72">{company.name}</div>
                  <div className="text-sm text-white/62">{currentRole.location}</div>
                </div>
              </div>
              <h2 className="mt-5 text-[2rem] font-semibold leading-[0.98] tracking-[-0.06em]">{currentRole.title}</h2>
              <div className="mt-5 flex flex-wrap gap-2">
                {currentRole.benefits.slice(0, 3).map((benefit) => (
                  <span key={benefit} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/86">{benefit}</span>
                ))}
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
                <div className="rounded-[22px] border border-white/10 bg-white/8 px-4 py-3">{currentRole.workModel}</div>
                <div className="rounded-[22px] border border-white/10 bg-white/8 px-4 py-3">{currentRole.level}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-center gap-4">
        <button type="button" onClick={() => commitSwipe('left')} className="flex h-14 w-14 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 shadow-[0_18px_38px_-24px_rgba(244,63,94,0.35)]">
          <X size={22} />
        </button>
        <button type="button" onClick={() => navigate(currentRole.source === 'curated' ? `/candidate/role/${currentRole.id}` : `/candidate/imported/${currentRole.id}`)} className="rounded-full border border-[rgba(255,255,255,0.18)] bg-[linear-gradient(135deg,#ff8e78,#ff6f5b)] px-5 py-3 text-sm font-semibold text-white shadow-[0_20px_38px_-22px_rgba(255,111,91,0.72)] transition hover:translate-y-[-1px] hover:shadow-[0_24px_44px_-22px_rgba(255,111,91,0.82)]">
          {t('rebuild.marketplace.open_detail', { defaultValue: 'Open detail' })}
        </button>
        <button type="button" onClick={() => commitSwipe('right')} className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-600 shadow-[0_18px_38px_-24px_rgba(16,185,129,0.35)]">
          <Star size={22} className="fill-current" />
        </button>
      </div>
      <div className="mt-3 flex items-center justify-center gap-5 text-xs font-medium text-slate-500">
        <span>{t('rebuild.marketplace.swipe_left_hint', { defaultValue: 'Swipe left = not for me' })}</span>
        <span>{t('rebuild.marketplace.swipe_right_hint', { defaultValue: 'Swipe right = save for later' })}</span>
      </div>
    </div>
  );
};

export const MarketplacePage: React.FC<{
  roles: Role[];
  loading: boolean;
  totalRoleCount: number;
  databaseRoleCount: number;
  hasMore: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  filters: MarketplaceFilters;
  preferences: CandidatePreferenceProfile;
  companyLibrary: Company[];
  candidateApplicationsByRoleId: Record<string, DialogueSummary>;
  savedRoleIds: string[];
  onFiltersChange: (updater: React.SetStateAction<MarketplaceFilters>) => void;
  onResetFilters: () => void;
  onLoadMore: () => void;
  onRoleInteraction: (roleId: string, eventType: 'swipe_left' | 'swipe_right' | 'save' | 'unsave') => void;
  navigate: (path: string) => void;
  t: any;
}> = ({ roles, loading, totalRoleCount, databaseRoleCount, hasMore, searchValue, onSearchChange, filters, preferences, companyLibrary, candidateApplicationsByRoleId, savedRoleIds, onFiltersChange, onResetFilters, onLoadMore, onRoleInteraction, navigate, t }) => {
  const [showScrollTop, setShowScrollTop] = React.useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);
  const loadMoreSentinelRef = React.useRef<HTMLDivElement | null>(null);
  const listingsStartRef = React.useRef<HTMLDivElement | null>(null);
  const autoLoadStateRef = React.useRef({ loading: false, hasMore: false, requestedForCount: -1 });
  const hasTextSearch = searchValue.trim().length > 0;
  const isSearchExpanding = hasTextSearch && (hasMore || (loading && roles.length > 0));
  const visibleRoles = React.useMemo(() => {
    const toRadians = (value: number) => value * (Math.PI / 180);
    const distanceKm = (latA: number, lonA: number, latB: number, lonB: number) => {
      const earthRadiusKm = 6371;
      const dLat = toRadians(latB - latA);
      const dLon = toRadians(lonB - lonA);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2)
        + Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    };
    const normalizedCity = filters.city.trim().toLowerCase();
    const domesticCountryCode = preferences.taxProfile.countryCode;

    return roles.filter((role) => {
      if (!roleMatchesDiscovery(role, preferences, searchValue, filters.curatedOnly)) return false;
      if (filters.roleFamily !== 'all' && role.roleFamily !== filters.roleFamily) return false;
      if (!filters.crossBorder && role.countryCode !== domesticCountryCode) return false;
      if (filters.remoteOnly && role.workModel !== 'Remote') return false;
      if (!filters.remoteOnly && filters.workArrangement !== 'all') {
        const normalizedWorkModel = role.workModel.toLowerCase();
        if (filters.workArrangement === 'hybrid' && normalizedWorkModel !== 'hybrid') return false;
        if (filters.workArrangement === 'onsite' && normalizedWorkModel !== 'on-site') return false;
      }
      if (normalizedCity) {
        const haystack = [role.location, role.companyName, role.team, role.title].join(' ').toLowerCase();
        if (!haystack.includes(normalizedCity)) return false;
      }
      if (filters.benefits.length > 0) {
        const normalizedBenefits = role.benefits.map((benefit) => normalizeBenefitToken(benefit)).filter(Boolean);
        const hasBenefitMatch = filters.benefits.every((benefit) => {
          const aliases = benefitFilterAliases(benefit);
          return normalizedBenefits.some((item) => aliases.some((alias) => item.includes(alias) || alias.includes(item)));
        });
        if (!hasBenefitMatch) return false;
      }
      if (!hasTextSearch && role.workModel !== 'Remote' && filters.radiusKm > 0) {
        const candidateLat = preferences.coordinates.lat;
        const candidateLon = preferences.coordinates.lon;
        if (Number.isFinite(candidateLat) && Number.isFinite(candidateLon)) {
          const distance = distanceKm(candidateLat, candidateLon, role.coordinates.lat, role.coordinates.lng);
          if (distance > filters.radiusKm) return false;
        }
      }
      return true;
    });
  }, [filters.benefits, filters.city, filters.crossBorder, filters.curatedOnly, filters.radiusKm, filters.remoteOnly, filters.roleFamily, filters.workArrangement, hasTextSearch, preferences, roles, searchValue]);
  const curatedRoles = visibleRoles.filter((role) => role.source === 'curated');
  const importedRoles = visibleRoles.filter((role) => role.source === 'imported');
  const hasVisibleRoles = visibleRoles.length > 0;
  const benefitOptions = React.useMemo(() => {
    const counts = new Map<string, number>();
    roles.forEach((role) => {
      role.benefits.forEach((benefit) => {
        const normalized = String(benefit || '').trim();
        if (!normalized) return;
        counts.set(normalized, (counts.get(normalized) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([benefit]) => benefit)
      .reduce<string[]>((acc, benefit) => {
        if (!acc.some((item) => normalizeBenefitToken(item) === normalizeBenefitToken(benefit))) {
          acc.push(benefit);
        }
        return acc;
      }, [...PINNED_MARKETPLACE_BENEFITS])
      .slice(0, 12);
  }, [roles]);
  const catalogRoleCount = databaseRoleCount > 0 ? databaseRoleCount : Math.max(totalRoleCount, roles.length);
  const heroPulse = React.useMemo(() => {
    const minute = new Date().getMinutes();
    return {
      onlineUsers: 36 + (minute % 11),
      liveApplications: Math.max(8, Object.keys(candidateApplicationsByRoleId).length + curatedRoles.length + (minute % 4)),
    };
  }, [candidateApplicationsByRoleId, curatedRoles.length]);
  const activeFilterCount = [
    searchValue.trim(),
    filters.city.trim(),
    filters.roleFamily !== 'all' ? filters.roleFamily : '',
    filters.workArrangement !== 'all' ? filters.workArrangement : '',
    filters.remoteOnly ? 'remote' : '',
    filters.crossBorder !== preferences.borderSearchEnabled ? 'crossBorder' : '',
    filters.radiusKm !== preferences.searchRadiusKm ? String(filters.radiusKm) : '',
    filters.benefits.length > 0 ? filters.benefits.join(',') : '',
    filters.curatedOnly ? 'curatedOnly' : '',
  ].filter(Boolean).length;

  React.useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 480);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  React.useEffect(() => {
    autoLoadStateRef.current.loading = loading;
    autoLoadStateRef.current.hasMore = hasMore;
    if (!hasMore) {
      autoLoadStateRef.current.requestedForCount = -1;
    }
  }, [hasMore, loading]);

  React.useEffect(() => {
    if (typeof window === 'undefined' || window.innerWidth < 768) return;
    const node = loadMoreSentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry?.isIntersecting) return;
      if (!autoLoadStateRef.current.hasMore || autoLoadStateRef.current.loading) return;
      if (autoLoadStateRef.current.requestedForCount === visibleRoles.length) return;
      autoLoadStateRef.current.requestedForCount = visibleRoles.length;
      onLoadMore();
    }, {
      rootMargin: '900px 0px 240px 0px',
      threshold: 0.01,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, visibleRoles.length]);

  return (
    <div className={shellPageClass}>
      <section className="space-y-5 md:hidden">
        <div className={cn(panelClass, 'overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(232,242,248,0.96))]')}>
          <div className="grid gap-5 px-6 py-6 md:px-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] lg:items-center">
            <div className="max-w-3xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#0f95ac]">{t('rebuild.marketplace.hero_kicker', { defaultValue: 'Opportunity ecosystem' })}</div>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 md:text-[15px]">
                {t('rebuild.marketplace.hero_copy', { defaultValue: 'Explore teams through real roles, clear signals and stronger fit context before you spend energy on applying.' })}
              </p>
              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => listingsStartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className={primaryButtonClass}
                >
                  {t('rebuild.marketplace.hero_cta', { defaultValue: 'Try the first challenge free →' })}
                </button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:w-[27rem] lg:self-start">
              <HeroStatCard
                label={t('rebuild.marketplace.roles_database', { defaultValue: 'Roles in database' })}
                value={catalogRoleCount.toLocaleString(t === undefined ? 'cs-CZ' : (t('rebuild.locale', { defaultValue: 'en-GB' }) === 'cs-CZ' ? 'cs-CZ' : 'en-GB'))}
                accent="bg-white/92"
              />
              <HeroStatCard
                label={t('rebuild.marketplace.users_online', { defaultValue: 'Users online' })}
                value={heroPulse.onlineUsers.toLocaleString(t === undefined ? 'cs-CZ' : (t('rebuild.locale', { defaultValue: 'en-GB' }) === 'cs-CZ' ? 'cs-CZ' : 'en-GB'))}
                accent="bg-[rgba(18,175,203,0.12)]"
              />
              {curatedRoles.length > 0 ? (
                <HeroStatCard
                  label={t('rebuild.marketplace.curated_roles_title', { defaultValue: 'Curated roles' })}
                  value={curatedRoles.length.toLocaleString('cs-CZ')}
                  accent="bg-white/88"
                />
              ) : null}
            </div>
          </div>
        </div>
        <div className={cn(panelClass, 'p-4 md:p-5')}>
          <div className="flex flex-col gap-4">
            <MarketplaceSearchPanel searchValue={searchValue} loading={loading} onSearchChange={onSearchChange} t={t} className="border-0 bg-none p-0 shadow-none before:hidden" />
            <div className="flex items-center justify-between gap-3 md:hidden">
              <MarketplaceActiveFilters filters={filters} activeFilterCount={activeFilterCount} t={t} />
              <button type="button" onClick={() => setMobileFiltersOpen((current) => !current)} className={secondaryButtonClass}>
                {t('rebuild.marketplace.filters_button', { defaultValue: 'Filters' })}
                {activeFilterCount > 0 ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{activeFilterCount}</span> : null}
              </button>
            </div>
            <div className={cn('grid transition-all duration-300 md:hidden', mobileFiltersOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
              <div className="overflow-hidden">
                <MarketplaceFilterPanel
                  filters={filters}
                  onFiltersChange={onFiltersChange}
                  onResetFilters={onResetFilters}
                  navigate={navigate}
                  benefitOptions={benefitOptions}
                  t={t}
                  className="bg-[image:var(--shell-panel-bg)]"
                  compact={false}
                />
              </div>
            </div>
            <div className="hidden md:block">
              <MarketplaceActiveFilters filters={filters} activeFilterCount={activeFilterCount} t={t} />
            </div>
          </div>
        </div>
      </section>
      {isSearchExpanding ? (
        <div className={cn(panelClass, 'flex items-start gap-3 p-4 text-sm text-slate-600')}>
          <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin text-[#0f95ac]" />
          <div>
            <div className="font-semibold text-slate-900">{t('rebuild.marketplace.search_expanding_title', { defaultValue: 'First relevant results are already here.' })}</div>
            <div className="mt-1 leading-6">{t('rebuild.marketplace.search_expanding_copy', { defaultValue: 'Finding more matches across the database. You can start browsing the first batch, and more positions will be added continuously.' })}</div>
          </div>
        </div>
      ) : null}
      <MobileSwipeMarketplace
        roles={visibleRoles}
        companyLibrary={companyLibrary}
        savedRoleIds={savedRoleIds}
        hasMore={hasMore}
        loadingMore={loading}
        onLoadMore={onLoadMore}
        onRoleInteraction={onRoleInteraction}
        navigate={navigate}
        t={t}
      />
      <div className="hidden md:grid md:grid-cols-[320px_minmax(0,1fr)] md:items-start md:gap-8 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="sticky top-24 self-start">
          <div className={cn(panelClass, 'flex max-h-[calc(100vh-8rem)] flex-col overflow-hidden p-4 pr-3')}>
            <MarketplaceSearchPanel searchValue={searchValue} loading={loading} onSearchChange={onSearchChange} t={t} className="border-0 bg-none p-0 shadow-none before:hidden" />
            <div className="mt-4 h-px shrink-0 bg-[color:var(--shell-button-secondary-border)]" />
            <div className="mt-4 overflow-y-auto pr-1">
              <MarketplaceFilterPanel
                filters={filters}
                onFiltersChange={onFiltersChange}
                onResetFilters={onResetFilters}
                navigate={navigate}
                benefitOptions={benefitOptions}
                t={t}
                className="border-0 bg-none p-0 shadow-none before:hidden"
                compact
              />
            </div>
          </div>
        </aside>
        <div className="min-w-0 pr-2">
          <div ref={listingsStartRef} className="space-y-8 min-w-0">
            <section className="space-y-5">
              <div className={cn(panelClass, 'overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(232,242,248,0.96))]')}>
                <div className="grid gap-5 px-6 py-6 md:px-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] xl:items-center">
                  <div className="max-w-3xl">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#0f95ac]">{t('rebuild.marketplace.hero_kicker', { defaultValue: 'Opportunity ecosystem' })}</div>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 md:text-[15px]">
                      {t('rebuild.marketplace.hero_copy', { defaultValue: 'Explore teams through real roles, clear signals and stronger fit context before you spend energy on applying.' })}
                    </p>
                    <div className="mt-5">
                      <button
                        type="button"
                        onClick={() => listingsStartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        className={primaryButtonClass}
                      >
                        {t('rebuild.marketplace.hero_cta', { defaultValue: 'Try the first challenge free →' })}
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:w-[27rem] xl:self-start">
                    <HeroStatCard
                      label={t('rebuild.marketplace.roles_database', { defaultValue: 'Roles in database' })}
                      value={catalogRoleCount.toLocaleString('cs-CZ')}
                      accent="bg-white/92"
                    />
                    <HeroStatCard
                      label={t('rebuild.marketplace.users_online', { defaultValue: 'Users online' })}
                      value={heroPulse.onlineUsers.toLocaleString('cs-CZ')}
                      accent="bg-[rgba(18,175,203,0.12)]"
                    />
                    {curatedRoles.length > 0 ? (
                      <HeroStatCard
                        label={t('rebuild.marketplace.curated_roles_title', { defaultValue: 'Curated roles' })}
                        value={curatedRoles.length.toLocaleString(t('rebuild.locale', { defaultValue: 'en-GB' }) === 'cs-CZ' ? 'cs-CZ' : 'en-GB')}
                        accent="bg-white/88"
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            </section>
            {loading ? <div className={cn(panelClass, 'flex items-center gap-3 p-5 text-sm text-slate-500')}><Loader2 size={16} className="animate-spin" />{t('rebuild.marketplace.loading', { defaultValue: 'Loading current offers.' })}</div> : null}
            <div className="space-y-8">
              {curatedRoles.length > 0 ? (
                <section className="space-y-4">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t('rebuild.marketplace.curated_roles_title', { defaultValue: 'Curated roles' })}</div>
                      <h2 className="mt-2 font-display text-[2rem] font-semibold tracking-[-0.04em] text-slate-900">{t('rebuild.marketplace.curated_desc', { defaultValue: 'Full company-branded handshake journeys' })}</h2>
                    </div>
                    <div className="text-sm text-slate-500">{curatedRoles.length} {t('rebuild.marketplace.roles_label', { defaultValue: 'roles' })}</div>
                  </div>
                  <div className="grid gap-5 xl:grid-cols-2">
                    {curatedRoles.map((role) => <RoleCard key={role.id} role={role} companyLibrary={companyLibrary} applicationStatus={candidateApplicationsByRoleId[role.id]?.status} onOpen={() => navigate(`/candidate/role/${role.id}`)} t={t} />)}
                  </div>
                </section>
              ) : null}
              {importedRoles.length > 0 ? (
                <section className="space-y-4">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t('rebuild.marketplace.imported_title', { defaultValue: 'Imported opportunities' })}</div>
                      <h2 className="mt-2 font-display text-[2rem] font-semibold tracking-[-0.04em] text-slate-900">{t('rebuild.marketplace.imported_desc', { defaultValue: 'External roles with intelligence-first prep' })}</h2>
                    </div>
                    <div className="text-sm text-slate-500">{importedRoles.length} {t('rebuild.marketplace.roles_label', { defaultValue: 'roles' })}</div>
                  </div>
                  <div className="grid gap-5 xl:grid-cols-2">
                    {importedRoles.map((role) => <RoleCard key={role.id} role={role} companyLibrary={companyLibrary} applicationStatus={candidateApplicationsByRoleId[role.id]?.status} onOpen={() => navigate(`/candidate/imported/${role.id}`)} t={t} />)}
                  </div>
                </section>
              ) : null}
              {!hasVisibleRoles ? (
                <div className={cn(panelClass, 'p-8')}>
                  <div className={pillEyebrowClass}>{t('rebuild.marketplace.no_results_label', { defaultValue: 'No matches' })}</div>
                  <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.04em] text-slate-900">{t('rebuild.marketplace.no_results_title', { defaultValue: 'No roles match the current filters.' })}</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{t('rebuild.marketplace.no_results_copy', { defaultValue: 'Try a wider radius, remove a few filters, or switch back to all role types.' })}</p>
                  <div className="mt-5">
                    <button type="button" onClick={onResetFilters} className={primaryButtonClass}>
                      {t('rebuild.marketplace.reset_filters', { defaultValue: 'Reset filters' })}
                    </button>
                  </div>
                </div>
              ) : null}
              {hasMore ? (
                <div
                  ref={loadMoreSentinelRef}
                  className={cn(panelClass, 'flex items-center justify-between gap-4 p-5')}
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {loading
                        ? t('rebuild.marketplace.loading_more', { defaultValue: 'Loading more offers.' })
                        : t('rebuild.marketplace.load_more_ready', { defaultValue: 'More offers are ready.' })}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {loading
                        ? t('rebuild.marketplace.loading_more_copy', { defaultValue: 'As soon as the next page arrives, the list will expand smoothly.' })
                        : t('rebuild.marketplace.load_more_copy', { defaultValue: 'Load the next batch and continue browsing.' })}
                    </div>
                  </div>
                  <button type="button" onClick={onLoadMore} disabled={loading} className={primaryButtonClass}>
                    {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                    {loading
                      ? t('rebuild.marketplace.loading_more', { defaultValue: 'Loading more offers.' })
                      : t('rebuild.marketplace.load_more', { defaultValue: 'Load more' })}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      {loading ? <div className={cn(panelClass, 'flex items-center gap-3 p-5 text-sm text-slate-500 md:hidden')}><Loader2 size={16} className="animate-spin" />{t('rebuild.marketplace.loading', { defaultValue: 'Loading current offers.' })}</div> : null}
      {showScrollTop ? (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-[0_22px_44px_-24px_rgba(15,23,42,0.55)] transition hover:bg-slate-800"
          aria-label={t('rebuild.marketplace.back_to_top', { defaultValue: 'Back to top' })}
        >
          <ArrowUp size={18} />
        </button>
      ) : null}
    </div>
  );
};

const JobPostingSchema: React.FC<{ role: Role }> = ({ role }) => {
  const schema = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    "title": role.title,
    "description": role.summary || role.description,
    "datePosted": new Date().toISOString(),
    "employmentType": role.contractType === 'Full-time' ? 'FULL_TIME' : 'PART_TIME',
    "hiringOrganization": {
      "@type": "Organization",
      "name": role.companyName,
      "logo": role.companyLogo
    },
    "jobLocation": {
      "@type": "Place",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": role.location,
        "addressCountry": "CZ"
      }
    },
    "baseSalary": role.salaryFrom ? {
      "@type": "MonetaryAmount",
      "currency": role.currency,
      "value": {
        "@type": "QuantitativeValue",
        "minValue": role.salaryFrom,
        "maxValue": role.salaryTo,
        "unitText": "MONTH"
      }
    } : undefined
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
};

export const CandidateRoleBriefingPage: React.FC<{
  role: Role;
  blueprint: HandshakeBlueprint;
  preferences: CandidatePreferenceProfile;
  companyLibrary: Company[];
  existingApplication?: DialogueSummary | null;
  isSaved: boolean;
  onToggleSaved: () => void;
  navigate: (path: string) => void;
  t: any;
}> = ({ role, blueprint, preferences, companyLibrary, existingApplication, isSaved, onToggleSaved, navigate, t }) => {
  const company = resolveCompany(role, companyLibrary);
  const applicationStatus = existingApplication ? getApplicationStatusCopy(existingApplication.status, t) : null;
  const coverFallbacks = buildImageCandidates([
    role.heroImage,
    role.companyCoverImage,
    ...getStockCoverCandidatesForDomain('operations', `${role.companyName}:${role.title}`),
    MARKETPLACE_IMAGE_FALLBACK,
  ]);
  const compensation = formatRoleCompensation(role, t('rebuild.briefing.compensation_unknown', { defaultValue: 'Compensation not specified' }));
  const overviewCopy = firstUniqueRoleText(role.description, role.challenge, role.roleSummary, role.summary, role.mission);
  const companyStoryCopy = cleanMarkdownDetailText(company.narrative);
  const truthSections = [
    { title: t('rebuild.briefing.hard_truth', { defaultValue: 'Narocna realita role' }), body: cleanRoleDetailText(role.companyTruthHard) },
    { title: t('rebuild.briefing.failure_truth', { defaultValue: 'Co znamena neuspech' }), body: cleanRoleDetailText(role.companyTruthFail) },
  ].filter((item) => item.body.trim());
  return (
    <CandidateShellSurface
      variant="role"
      className={shellPageClass}
      eyebrow={<SectionEyebrow>{t('rebuild.briefing.role_briefing', { defaultValue: 'Briefing role' })}</SectionEyebrow>}
      actions={(
        <CompactActionButton tone="secondary" onClick={() => navigate('/candidate/marketplace')}>
          <ArrowLeft size={16} /> {t('rebuild.briefing.back_marketplace', { defaultValue: 'Back to marketplace' })}
        </CompactActionButton>
      )}
    >
      <JobPostingSchema role={role} />
      <ShellCard className="overflow-hidden">
        <div className="bg-white">
          <div className="relative aspect-[16/7] min-h-[18rem] border-b border-slate-200 lg:aspect-[21/8]">
            <CompanyHeroMediaStage company={company} role={role} fallbackSrcs={coverFallbacks} t={t} />
          </div>
          <div className="p-6 md:p-8 lg:p-10">
            <div className="max-w-5xl">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{company.name}</span>
                {company.gallery.length > 0 || company.marketplaceVideoUrl ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#e6fbff] px-3 py-1 text-[11px] font-bold text-[#0f95ac]">
                    {t('rebuild.briefing.company_media_count', { defaultValue: '{{count}} médií v profilu', count: company.gallery.length + (company.marketplaceVideoUrl ? 1 : 0) })}
                  </span>
                ) : null}
              </div>
              <h1 className="mt-4 text-[clamp(2.2rem,5vw,4.35rem)] font-semibold leading-[0.98] tracking-normal text-slate-950">{role.title}</h1>
              <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
                <div className="min-w-0">
                  {overviewCopy ? <MarkdownContent value={overviewCopy} className="max-w-4xl text-base text-slate-600" /> : null}
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <DetailMetaPill label={t('rebuild.briefing.compensation', { defaultValue: 'Odmena' })} value={compensation} />
                    <DetailMetaPill label={t('rebuild.briefing.work_model', { defaultValue: 'Rezim' })} value={role.workModel} />
                    <DetailMetaPill label={t('rebuild.briefing.location', { defaultValue: 'Misto' })} value={role.location} />
                  </div>
                </div>
                <DetailActionPanel
                  role={role}
                  existingApplication={existingApplication}
                  isSaved={isSaved}
                  onToggleSaved={onToggleSaved}
                  navigate={navigate}
                  sticky={false}
                  className="self-start"
                  t={t}
                />
              </div>
            </div>
          </div>
        </div>
      </ShellCard>
      <ShamiGuidePanel role={role} blueprint={blueprint} company={company} t={t} />
      <RoleRealityBoard role={role} preferences={preferences} t={t} />
      <RecommendationFitPanel role={role} t={t} />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <ShellCard className="p-6">
            <SectionEyebrow><Target size={12} />{t('rebuild.briefing.title', { defaultValue: 'Skill-first briefing' })}</SectionEyebrow>
            <h2 className="mt-3 text-2xl font-semibold tracking-normal text-slate-900">{t('rebuild.briefing.native_heading', { defaultValue: 'Nejdřív pracovní realita, potom CV.' })}</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <SkillSignalCard
                tone="accent"
                icon={<CheckCircle2 size={16} />}
                title={t('rebuild.briefing.signal_desc', { defaultValue: 'Co bude dulezite hned na zacatku' })}
                body={role.firstStep}
              />
              <SkillSignalCard
                icon={<Compass size={16} />}
                title={t('rebuild.briefing.blueprint', { defaultValue: 'Jak vypada vyberove rizeni' })}
                body={blueprint.overview}
              />
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <DetailMetaPill label={t('rebuild.briefing.contract', { defaultValue: 'Typ uvazku' })} value={role.contractType || t('rebuild.briefing.contract_unknown', { defaultValue: 'Neuvedeno' })} />
              <DetailMetaPill label={t('rebuild.detail.source', { defaultValue: 'Zdroj' })} value={t('rebuild.detail.native', { defaultValue: 'Jobshaman native' })} />
            </div>
            {role.hoursPerWeek ? (
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <DetailMetaPill label={t('rebuild.editor.hours_per_week', { defaultValue: 'Hours per Week' })} value={`${role.hoursPerWeek} h/week`} />
                {role.employmentType ? (
                  <DetailMetaPill
                    label={t('rebuild.editor.employment_type', { defaultValue: 'Employment Type' })}
                    value={t(`rebuild.editor.employment_${role.employmentType}`, { defaultValue: role.employmentType })}
                  />
                ) : null}
              </div>
            ) : null}
            {role.benefits.length > 0 ? (
              <div className="mt-6">
                <div className="text-sm font-semibold text-slate-900">{t('rebuild.briefing.benefits', { defaultValue: 'Benefity a podminky' })}</div>
                <div className="mt-3 flex flex-wrap gap-2">{role.benefits.map((benefit) => <span key={benefit} className="rounded-full bg-[#12AFCB]/8 px-3 py-1.5 text-xs font-medium text-[#0f95ac]">{benefit}</span>)}</div>
              </div>
            ) : null}
            {role.workPerks && role.workPerks.length > 0 ? (
              <div className="mt-6">
                <div className="text-sm font-semibold text-slate-900">{t('rebuild.editor.work_perks', { defaultValue: 'Work Perks' })}</div>
                <div className="mt-3 flex flex-wrap gap-2">{role.workPerks.map((perk) => <span key={perk} className="rounded-full bg-[#12AFCB]/8 px-3 py-1.5 text-xs font-medium text-[#0f95ac]">{perk}</span>)}</div>
              </div>
            ) : null}
            <div className="mt-6">
              <div className="text-sm font-semibold text-slate-900">{t('rebuild.briefing.skills', { defaultValue: 'Klicove dovednosti' })}</div>
              <div className="mt-3 flex flex-wrap gap-2">{role.skills.map((skill) => <span key={skill} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">{skill}</span>)}</div>
            </div>
            {truthSections.length > 0 ? (
              <div className="mt-6 space-y-4">
                {truthSections.map((section) => <DetailSection key={section.title} title={section.title} body={section.body} />)}
              </div>
            ) : null}
            {company.gallery.length > 0 ? (
              <div className="mt-6">
                <div className="text-sm font-semibold text-slate-900">{t('rebuild.briefing.company_gallery', { defaultValue: 'Company gallery' })}</div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {company.gallery.slice(0, 4).map((asset) => (
                    <div key={asset.id} className="overflow-hidden rounded-[20px] border border-slate-200 bg-slate-50">
                      {isVideoAsset(asset) ? (
                        <video src={asset.url} className="h-36 w-full object-cover" controls muted playsInline />
                      ) : (
                        <img src={asset.url} alt={asset.title || asset.name} className="h-36 w-full object-cover" loading="lazy" />
                      )}
                      <div className="px-4 py-3 text-sm text-slate-600">{asset.caption || asset.title || asset.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {company.handshakeMaterials.length > 0 ? (
              <div className="mt-6">
                <div className="text-sm font-semibold text-slate-900">{t('rebuild.briefing.handshake_materials', { defaultValue: 'Materials for the handshake' })}</div>
                <div className="mt-3 space-y-2">
                  {company.handshakeMaterials.map((asset) => (
                    <a
                      key={asset.id}
                      href={asset.download_url || asset.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition hover:border-[#255DAB] hover:text-[#255DAB]"
                    >
                      <span className="min-w-0 truncate">{asset.title || asset.name}</span>
                      <ExternalLink size={16} className="shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
            {existingApplication ? (
              <div className="mt-6 rounded-[22px] border border-[#12AFCB]/12 bg-[#12AFCB]/5 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={cn('rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em]', applicationStatus?.tone || 'bg-[#12AFCB]/10 text-[#0f95ac]')}>{applicationStatus?.label || t('rebuild.briefing.submitted', { defaultValue: 'Submitted' })}</span>
                  <span className="text-sm text-slate-500">{t('rebuild.briefing.submitted_on', { defaultValue: 'Submitted' })} {existingApplication.submitted_at ? new Date(existingApplication.submitted_at).toLocaleDateString('cs-CZ') : t('rebuild.briefing.recently', { defaultValue: 'recently' })}</span>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">{t('rebuild.briefing.submission_in_flight', { defaultValue: 'This role already has a draft or submitted response. Open the application detail to check the next step.' })}</p>
              </div>
            ) : null}
          </ShellCard>
        </div>
        <div className="space-y-6">
          <CompanyEncounterPanel role={role} company={company} companyStory={companyStoryCopy} t={t} />
        </div>
      </div>
    </CandidateShellSurface>
  );
};

export const ImportedPrepPage: React.FC<{
  role: Role;
  preferences: CandidatePreferenceProfile;
  isSaved: boolean;
  onToggleSaved: () => void;
  navigate: (path: string) => void;
  t: any;
}> = ({ role, preferences, isSaved, onToggleSaved, navigate, t }) => {
  const sourceLink = role.outboundUrl || role.sourceUrl || '';
  const coverFallbacks = buildImageCandidates([
    role.heroImage,
    ...getStockCoverCandidatesForDomain('operations', `${role.companyName}:${role.title}:${role.location}`),
    MARKETPLACE_IMAGE_FALLBACK,
  ]);

  return (
    <CandidateShellSurface
      variant="role"
      className={shellPageClass}
      eyebrow={<SectionEyebrow><ExternalLink size={12} />{t('rebuild.prep.title', { defaultValue: 'External outbound prep' })}</SectionEyebrow>}
      actions={(
        <CompactActionButton tone="secondary" onClick={() => navigate('/candidate/marketplace')}>
          <ArrowLeft size={16} /> {t('rebuild.briefing.back_marketplace', { defaultValue: 'Back to marketplace' })}
        </CompactActionButton>
      )}
    >
      <JobPostingSchema role={role} />
      <ShellCard className="overflow-hidden">
        <div className="grid min-h-[22rem] bg-white lg:grid-cols-[1fr_0.78fr]">
          <div className="flex items-center p-6 md:p-8">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                <ExternalLink size={12} /> {role.companyName || t('rebuild.prep.external_source', { defaultValue: 'External listing' })}
              </div>
              <h1 className="mt-4 max-w-4xl text-[clamp(2.2rem,5vw,4.6rem)] font-semibold leading-[0.95] tracking-[-0.06em] text-slate-950">{role.title}</h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">{role.roleSummary || role.summary || role.importedNote}</p>
            </div>
          </div>
          <div className="min-h-[16rem] border-t border-slate-200 lg:border-l lg:border-t-0">
            <ResilientImage src={role.heroImage} fallbackSrcs={coverFallbacks} alt={role.title} className="h-full min-h-[16rem] w-full object-cover" loading="lazy" decoding="async" />
          </div>
        </div>
      </ShellCard>

      <RoleRealityBoard role={role} preferences={preferences} t={t} />
      <RecommendationFitPanel role={role} t={t} />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <ShellCard className="p-6">
            <SectionEyebrow><Sparkles size={12} />{t('rebuild.prep.decision_room', { defaultValue: 'Decision detail' })}</SectionEyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-900">{role.challenge || t('rebuild.prep.imported_challenge', { defaultValue: 'Reality first, external response later.' })}</h2>
            <p className="mt-4 text-base leading-8 text-slate-600">{role.mission || role.description}</p>
            <div className="mt-6">
              <DetailMetaPill label={t('rebuild.prep.contract', { defaultValue: 'Contract' })} value={role.contractType || t('rebuild.prep.contract_unknown', { defaultValue: 'Not specified' })} />
            </div>
            <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">{t('rebuild.prep.prepare', { defaultValue: 'What to prepare' })}</div>
              <p className="mt-3 text-sm leading-7 text-slate-600">{role.firstStep}</p>
            </div>
            {role.skills.length > 0 ? (
              <div className="mt-6">
                <div className="text-sm font-semibold text-slate-900">{t('rebuild.briefing.skills', { defaultValue: 'Key skills' })}</div>
                <div className="mt-3 flex flex-wrap gap-2">{role.skills.map((skill) => <span key={skill} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">{skill}</span>)}</div>
              </div>
            ) : null}
            {role.benefits.length > 0 ? (
              <div className="mt-6">
                <div className="text-sm font-semibold text-slate-900">{t('rebuild.prep.benefits', { defaultValue: 'Benefits' })}</div>
                <div className="mt-3 flex flex-wrap gap-2">{role.benefits.map((benefit) => <span key={benefit} className="rounded-full bg-[#12AFCB]/8 px-3 py-1.5 text-xs font-medium text-[#0f95ac]">{benefit}</span>)}</div>
              </div>
            ) : null}
            <div className="mt-6 space-y-4">
              <DetailSection title={t('rebuild.prep.hard_truth', { defaultValue: 'Hard truth of the role' })} body={role.companyTruthHard || ''} />
              <DetailSection title={t('rebuild.prep.failure_truth', { defaultValue: 'What failure looks like' })} body={role.companyTruthFail || ''} />
            </div>
          </ShellCard>
        </div>
        <div className="space-y-6">
          <CompanyEncounterPanel role={role} company={null} t={t} />
          <DetailActionPanel role={role} sourceLink={sourceLink} isSaved={isSaved} onToggleSaved={onToggleSaved} navigate={navigate} t={t} />
        </div>
      </div>
    </CandidateShellSurface>
  );
};

export const CandidateJcfpmPage: React.FC<{
  t: (key: string, options?: { defaultValue?: string } & Record<string, any>) => string;
  locale?: string;
}> = ({ t, locale = 'cs' }) => {
  const draft = React.useMemo(() => readJcfpmDraft(JCFPM_DRAFT_SCOPE), []);
  const [questions, setQuestions] = React.useState<JcfpmQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = React.useState(true);
  const [questionsError, setQuestionsError] = React.useState('');
  const [submitState, setSubmitState] = React.useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const submittedSignatureRef = React.useRef('');
  const [session, setSession] = React.useState<JCFPMSession>(() => ({
    answers: draft?.responses || {},
  }));
  const [currentGroupIndex, setCurrentGroupIndex] = React.useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0);
  const [wizardStep, setWizardStep] = React.useState<'welcome' | 'questions' | 'results'>('welcome');
  const [snapshot, setSnapshot] = React.useState<any>(null);
  // Local ordering state: keyed by question.id, holds the current drag/arrow order
  // before the candidate confirms. This prevents arrow clicks from skipping to next question.
  const [localOrderMap, setLocalOrderMap] = React.useState<Record<string, string[]>>({});

  const dimensionOrder = React.useMemo(
    () =>
      [
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
        'i1_love',
        'i2_good_at',
        'i3_world_needs',
        'i4_paid_for',
      ] as const,
    [],
  );

  React.useEffect(() => {
    let active = true;

    const loadQuestions = async () => {
      setQuestionsLoading(true);
      setQuestionsError('');
      try {
        const items = await fetchJcfpmItems(locale);
        if (!active) return;

        const localeChain = [locale.toLowerCase(), locale.toLowerCase().split('-')[0], 'cs', 'en'];
        const stableItems = [...(items as any[])].sort((left, right) => {
          const sortDelta = Number(left?.sort_order || 0) - Number(right?.sort_order || 0);
          if (sortDelta !== 0) return sortDelta;
          return String(left?.id || '').localeCompare(String(right?.id || ''));
        });

        const selected = dimensionOrder
          .flatMap((dimension) => {
            const dimItems = stableItems.filter((item: any) => item.dimension === dimension);
            const seenPools = new Set<string>();
            const uniquePoolItems = dimItems.filter((item: any) => {
              const key = String(item?.pool_key || item?.id || '');
              if (seenPools.has(key)) return false;
              seenPools.add(key);
              return true;
            });
            return uniquePoolItems.slice(0, 6).map((item: any) => {
              const localizedPrompt = localeChain
                .map((key) => item?.prompt_i18n?.[key])
                .find((value) => typeof value === 'string' && value.trim().length > 0);

              const localizedPayload = localeChain
                .map((key) => item?.payload_i18n?.[key])
                .find((value) => value && typeof value === 'object');

              // Merge payload: start with item.payload (has options/sources/images for skill items),
              // then overlay any localized text fields from localizedPayload
              const mergedPayload = item?.payload ? { ...item.payload } : {};
              if (localizedPayload && typeof localizedPayload === 'object') {
                for (const key of ['question', 'helper_text', 'instructions', 'title', 'description']) {
                  if (key in localizedPayload && localizedPayload[key]) {
                    mergedPayload[key] = localizedPayload[key];
                  }
                }
                // If localized payload has localized options/sources, use them
                if (Array.isArray(localizedPayload.options) && localizedPayload.options.length > 0) {
                  mergedPayload.options = localizedPayload.options;
                }
                if (Array.isArray(localizedPayload.sources) && localizedPayload.sources.length > 0) {
                  mergedPayload.sources = localizedPayload.sources;
                }
                if (Array.isArray(localizedPayload.targets) && localizedPayload.targets.length > 0) {
                  mergedPayload.targets = localizedPayload.targets;
                }
              }
              const rawItemType = String(item?.item_type || '').trim().toLowerCase();
              const resolvedItemType =
                rawItemType && rawItemType !== 'likert'
                  ? rawItemType
                  : Array.isArray(mergedPayload.correct_order)
                    ? 'ordering'
                    : Array.isArray(mergedPayload.correct_pairs)
                      ? 'drag_drop'
                      : Array.isArray(mergedPayload.options)
                        ? (mergedPayload.options.some((opt: any) => opt?.image_url || opt?.imageUrl || opt?.image) ? 'image_choice' : 'mcq')
                        : rawItemType || 'likert';

              return {
                id: String(item?.id || ''),
                dimension: (item?.dimension || 'd1_cognitive') as JcfpmQuestion['dimension'],
                prompt: localizedPrompt || String(item?.prompt || ''),
                item_type: resolvedItemType,
                payload: mergedPayload,
                section: item?.section || 'psychometric',
                scale_min: item?.scale_min ?? 1,
                scale_max: item?.scale_max ?? 7,
                reverse_scoring: Boolean(item?.reverse_scoring),
                locale_used: item?.locale_used,
                translation_status: item?.translation_status,
              } satisfies JcfpmQuestion;
            });
          })
          .filter((item) => item.id && item.prompt);

        setQuestions(selected);
      } catch (error) {
        if (!active) return;
        setQuestions([]);
        setQuestionsError(error instanceof Error ? error.message : t('rebuild.jcfpm.load_failed', { defaultValue: 'Failed to load JCFPM questions.' }));
      } finally {
        if (active) setQuestionsLoading(false);
      }
    };

    void loadQuestions();

    return () => {
      active = false;
    };
  }, [dimensionOrder, locale, t]);

  React.useEffect(() => {
    writeJcfpmDraft({ stepIndex: 0, responses: session.answers, updatedAt: new Date().toISOString() }, JCFPM_DRAFT_SCOPE);
  }, [session.answers]);

  const dimensionGroups = React.useMemo(() => {
    return dimensionOrder
      .map((dim) => ({
        dimension: dim,
        questions: questions.filter((q) => q.dimension === dim),
      }))
      .filter((group) => group.questions.length > 0);
  }, [dimensionOrder, questions]);

  const dimensionScores = React.useMemo(() => {
    const grouped = new Map<string, number[]>();
    questions.forEach((question) => {
      const current = grouped.get(question.dimension) || [];
      const val = scoreJcfpmAnswer(question, session.answers[question.id]);
      if (val !== null) current.push(val);
      grouped.set(question.dimension, current);
    });
    return Array.from(grouped.entries()).map(([dimension, values]) => ({
      dimension,
      raw_score: Number((values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)).toFixed(2)),
      percentile: Math.max(0, Math.min(100, Math.round((((values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)) - 1) / 6) * 100))),
    }));
  }, [questions, session.answers]);

  const archetype = React.useMemo(() => computeArchetype(dimensionScores as never), [dimensionScores]);
  const isQuestionComplete = React.useCallback((question: JcfpmQuestion) => {
    const answer = session.answers[question.id];
    if (question.item_type === 'ordering') {
      const optionCount = ((question.payload?.options as any[]) || []).length;
      const order = Array.isArray((answer as any)?.order) ? (answer as any).order : Array.isArray(answer) ? answer : [];
      return order.length >= Math.max(1, optionCount);
    }
    if (question.item_type === 'drag_drop') {
      const sourceCount = ((question.payload?.sources as any[]) || []).length;
      const pairs = Array.isArray((answer as any)?.pairs) ? (answer as any).pairs : [];
      const uniqueSources = new Set(pairs.map((pair: any) => String(pair?.source || '')).filter(Boolean));
      return uniqueSources.size >= Math.max(1, sourceCount);
    }
    return hasJcfpmAnswer(answer);
  }, [session.answers]);
  const completed = questions.length > 0 && questions.every((question) => isQuestionComplete(question));
  const dimensionLabels = React.useMemo<Record<string, string>>(() => ({
    d1_cognitive: t('rebuild.jcfpm.dimensions.d1_cognitive', { defaultValue: 'Analytical thinking' }),
    d2_social: t('rebuild.jcfpm.dimensions.d2_social', { defaultValue: 'People collaboration' }),
    d3_motivational: t('rebuild.jcfpm.dimensions.d3_motivational', { defaultValue: 'Intrinsic motivation' }),
    d4_energy: t('rebuild.jcfpm.dimensions.d4_energy', { defaultValue: 'Work pace and energy' }),
    d5_values: t('rebuild.jcfpm.dimensions.d5_values', { defaultValue: 'Value setting' }),
    d6_ai_readiness: t('rebuild.jcfpm.dimensions.d6_ai_readiness', { defaultValue: 'AI tool usage' }),
    d7_cognitive_reflection: t('rebuild.jcfpm.dimensions.d7_cognitive_reflection', { defaultValue: 'Self-reflection in decisions' }),
    d8_digital_eq: t('rebuild.jcfpm.dimensions.d8_digital_eq', { defaultValue: 'Digital maturity' }),
    d9_systems_thinking: t('rebuild.jcfpm.dimensions.d9_systems_thinking', { defaultValue: 'Systems thinking' }),
    d10_ambiguity_interpretation: t('rebuild.jcfpm.dimensions.d10_ambiguity_interpretation', { defaultValue: 'Ambiguity navigation' }),
    d11_problem_decomposition: t('rebuild.jcfpm.dimensions.d11_problem_decomposition', { defaultValue: 'Problem decomposition' }),
    d12_moral_compass: t('rebuild.jcfpm.dimensions.d12_moral_compass', { defaultValue: 'Ethical judgment' }),
    i1_love: t('rebuild.jcfpm.dimensions.i1_love', { defaultValue: 'What you love' }),
    i2_good_at: t('rebuild.jcfpm.dimensions.i2_good_at', { defaultValue: 'What you are good at' }),
    i3_world_needs: t('rebuild.jcfpm.dimensions.i3_world_needs', { defaultValue: 'What the world needs' }),
    i4_paid_for: t('rebuild.jcfpm.dimensions.i4_paid_for', { defaultValue: 'What the market values' }),
  }), [t]);

  const dimensionReport = React.useMemo<Record<string, { summary: string; high: string; balanced: string; low: string; development: string; environment: string }>>(() => ({
    d1_cognitive: {
      summary: 'Způsob zpracování informací a řešení problémů.',
      high: 'Přirozeně si rovnáš fakta, souvislosti a dopady. Vynikáš tam, kde je potřeba oddělit šum od podstaty.',
      balanced: 'Umíš kombinovat analýzu s praktickou intuicí. Nejlépe funguješ, když máš dost signálů, ale nezasekneš se v detailu.',
      low: 'Více se opíráš o intuici a celkový dojem. U důležitých rozhodnutí pomůže krátká kontrola faktů.',
      development: 'Před důležitým rozhodnutím si sepiš 3 fakta, 1 riziko a 1 alternativu.',
      environment: 'Role s jasným kontextem, možností analyzovat problém a převádět ho do rozhodnutí.',
    },
    d2_social: {
      summary: 'Preferovaný způsob interakce s lidmi a týmové dynamiky.',
      high: 'Umíš držet důvěru, domluvu a společný směr. Tvoje síla je číst lidi bez ztráty věcnosti.',
      balanced: 'Sociální orientace je vyvážená. Dokážeš fungovat v týmu i samostatně podle potřeby.',
      low: 'Pravděpodobně preferuješ samostatnou práci a menší množství sociální koordinace.',
      development: 'Před schůzkou si pojmenuj očekávaný výsledek a po ní jeden jasný další krok.',
      environment: 'Tým se srozumitelnou komunikací, pravidelnou zpětnou vazbou a rozumnou mírou autonomie.',
    },
    d3_motivational: {
      summary: 'Co tě pohání a co považuješ za odměnu.',
      high: 'Silně tě táhne smysl, dopad a růst odpovědnosti. Potřebuješ chápat proč, ne jen co.',
      balanced: 'Zvládáš jak vnitřní smysl, tak jasné cíle a odměny. Pomáhá ujasnit si aktuální prioritu.',
      low: 'Motivace může víc stát na konkrétní odměně, stabilitě nebo jasně zadaném výsledku.',
      development: 'U každého většího úkolu si napiš, komu pomáhá a podle čeho poznáš dobrý výsledek.',
      environment: 'Projekty s viditelným dopadem, férovou odpovědností a prostorem něco zlepšovat.',
    },
    d4_energy: {
      summary: 'Tempo, intenzita a styl práce.',
      high: 'Zvládáš vyšší tempo a dynamické situace. Klíčové je plánovat regeneraci, aby výkon zůstal udržitelný.',
      balanced: 'Umíš přepínat mezi sprintem a stabilním tempem. Dobře funguje rytmus s jasnými prioritami.',
      low: 'Spíš potřebuješ stabilnější tempo, méně přepínání a chráněný prostor pro soustředění.',
      development: 'Na 14 dní si nastav rytmus sprint, pauza, review: co bere energii a co ji vrací.',
      environment: 'Práce s realistickými prioritami, možností chránit hlubokou práci a domluvenými sprinty.',
    },
    d5_values: {
      summary: 'Co musí práce přinášet, aby dávala smysl.',
      high: 'Hodnoty jsou silná kotva. Integrita, důvěra a dlouhodobý dopad pro tebe nejsou dekorace.',
      balanced: 'Hodnoty máš vyvážené a umíš se přizpůsobit různým kulturám, pokud víš, co je důležité.',
      low: 'Můžeš snáze tolerovat různá prostředí, ale vyplatí se vědomě pojmenovat vlastní hranice.',
      development: 'Sepiš si 3 pracovní situace, které jsou pro tebe nepřekročitelné, a proč.',
      environment: 'Kultura s férovostí, transparentností a prostorem mluvit o dopadech rozhodnutí.',
    },
    d6_ai_readiness: {
      summary: 'Jak dobře prosperuješ v rychle se měnícím technologickém prostředí.',
      high: 'Technologická adaptabilita je silná stránka. Rychle testuješ nové nástroje a hledáš praktickou hodnotu.',
      balanced: 'Nové nástroje umíš použít, když dávají smysl. Nejlépe funguje praktické učení na reálném úkolu.',
      low: 'Změna nástrojů může stát víc energie. Pomůže bezpečný trénink na malých pracovních případech.',
      development: 'Vyber jeden opakovaný úkol a zkus na něm AI použít třikrát s krátkým vyhodnocením.',
      environment: 'Prostředí, kde se nové nástroje používají běžně, ale s jasným lidským úsudkem.',
    },
    d7_cognitive_reflection: {
      summary: 'Schopnost zastavit první intuici a ověřit ji logikou.',
      high: 'Umíš brzdit první závěr a ověřovat důkazy. To zvyšuje kvalitu rozhodnutí s vyšším dopadem.',
      balanced: 'Intuici umíš doplnit kontrolou. Pomáhá jednoduchý rozhodovací rituál u větších kroků.',
      low: 'Rychlá intuice může dominovat. U důležitých věcí přidej krátké zastav-se-ověř.',
      development: 'Před rozhodnutím si polož otázku: Jaký je důkaz a co by mě přesvědčilo o opaku?',
      environment: 'Role, kde je čas na review rozhodnutí a chyby se používají jako učení, ne jako trest.',
    },
    d8_digital_eq: {
      summary: 'Citlivost na emoce, tón a důvěru v textové komunikaci.',
      high: 'V textu dobře čteš tón, podtext i důvěru. To je silné v asynchronní spolupráci a citlivých tématech.',
      balanced: 'Digitální komunikaci zvládáš prakticky. Pomáhá vědomě volit mezi zprávou a hovorem.',
      low: 'V textu může snáz vzniknout nedorozumění. Pomůže kratší zpráva, jasný záměr a ověření dopadu.',
      development: 'U náročné zprávy napiš nejdřív záměr, potom fakta a nakonec konkrétní prosbu.',
      environment: 'Hybridní nebo remote tým s jasnou komunikační hygienou a bezpečným prostorem pro otázky.',
    },
    d9_systems_thinking: {
      summary: 'Jak dobře čteš vztahy, zpětné vazby a vedlejší efekty.',
      high: 'Silné systémové myšlení. Vidíš vztahy, zpožděné dopady a místa, kde se problém vrací.',
      balanced: 'Umíš sledovat širší souvislosti, když máš jasně vymezený rámec problému.',
      low: 'Může být užitečné vědomě mapovat příčiny, následky a závislosti místo řešení izolovaného symptomu.',
      development: 'U jednoho problému nakresli mapu: příčina, dopad, zpětná vazba, skrytý náklad.',
      environment: 'Procesní, produktové nebo provozní role, kde se zlepšují celé systémy, ne jen jednotlivé úkoly.',
    },
    d10_ambiguity_interpretation: {
      summary: 'Jak čteš nejasné situace: rizika vs. příležitosti.',
      high: 'V nejistotě vidíš směr a příležitosti. Umíš začít, i když zadání ještě není dokonalé.',
      balanced: 'Nejasnost zvládáš, pokud máš možnost postupně ověřovat další kroky.',
      low: 'Nejasné zadání může brzdit energii. Pomůže definovat minimální další signál a první bezpečný krok.',
      development: 'U nejasného úkolu si napiš: co vím, co nevím, co ověřím do 48 hodin.',
      environment: 'Prostředí s proměnlivými zadáními, ale dobrou oporou v prioritách a rozhodovacích právech.',
    },
    d11_problem_decomposition: {
      summary: 'Schopnost rozsekat velký problém na jasné kroky.',
      high: 'Umíš rychle vytvořit strukturu kroků. Silné pro strategii, delivery, provozní změny i komplexní projekty.',
      balanced: 'Dokážeš problém rozložit, když máš jasný cíl a dost kontextu.',
      low: 'Velký problém může působit zahlcujícím dojmem. Pomůže jeden malý experiment a jednoduché priority.',
      development: 'Každý větší problém rozděl na blokátor, první krok a měřitelný výstup týdne.',
      environment: 'Role, kde se strategie převádí do priorit, experimentů a praktického doručení.',
    },
    d12_moral_compass: {
      summary: 'Stabilita hodnot v dilematech a tlakových situacích.',
      high: 'Silný morální kompas. V tlaku držíš integritu, důvěru a dlouhodobé dopady.',
      balanced: 'Etické dopady bereš v úvahu, zejména když jsou jasně pojmenované.',
      low: 'V tlaku může být těžší otevřít nepohodlné téma. Pomůže předem daný princip rozhodování.',
      development: 'U dilemat si napiš: koho to ovlivní, co se stane později a co bych obhájil/a nahlas.',
      environment: 'Organizace, která bere vážně důvěru, odpovědnost a transparentní rozhodování.',
    },
    i1_love: {
      summary: 'Co tě přirozeně vtahuje a nabíjí.',
      high: 'Máš silný signál vnitřního zájmu. Hledej role, kde se tato energie používá často, ne jen okrajově.',
      balanced: 'Zájem se probouzí v konkrétních situacích. Vyplatí se sledovat, kdy energie roste.',
      low: 'Zatím není jasné, co tě pracovně opravdu vtahuje. Pomůže mapovat aktivity, u kterých mizí čas.',
      development: 'Týden si zapisuj 3 momenty, kdy práce energii přidala nebo vzala.',
      environment: 'Práce s prostorem pro ponor, tvorbu nebo problém, který tě osobně zajímá.',
    },
    i2_good_at: {
      summary: 'V čem máš opakovaně použitelnou sílu.',
      high: 'Silně vnímáš své schopnosti a umíš je převést do přínosu pro ostatní.',
      balanced: 'Některé silné stránky už znáš, další se ukážou přes konkrétní pracovní důkazy.',
      low: 'Můžeš podceňovat, v čem jsi dobrý/á. Hledej opakované žádosti o pomoc a výsledky.',
      development: 'Sepiš 5 situací, kdy jsi někomu pomohl/a, a najdi společnou schopnost.',
      environment: 'Role, kde se tvoje silné schopnosti používají pravidelně a jsou viditelné ve výsledku.',
    },
    i3_world_needs: {
      summary: 'Jak moc potřebuješ vidět užitek pro lidi nebo svět.',
      high: 'Dopad na konkrétní lidi je pro tebe důležitý zdroj smyslu a výdrže.',
      balanced: 'Smysl a užitek jsou důležité, ale nemusí být jediným zdrojem motivace.',
      low: 'Práce může dávat smysl i bez výrazného společenského dopadu, pokud sedí role, tým nebo odměna.',
      development: 'U nabídky práce si ověř, komu výsledek pomáhá a jak se to pozná.',
      environment: 'Produkty, služby nebo provozy, kde je vidět reálný užitek práce.',
    },
    i4_paid_for: {
      summary: 'Jak propojuješ smysl, schopnosti a ekonomickou hodnotu.',
      high: 'Dobře přemýšlíš o hodnotě své práce pro trh. To pomáhá volit udržitelné směřování.',
      balanced: 'Ekonomickou hodnotu bereš v úvahu, ale bude dobré ji zpřesnit konkrétními důkazy.',
      low: 'Může být potřeba víc přeložit schopnosti do řeči hodnoty pro firmu nebo zákazníka.',
      development: 'Ke každé silné stránce napiš jeden měřitelný přínos pro tým, zákazníka nebo firmu.',
      environment: 'Role, kde je jasné, jak tvoje práce vytváří hodnotu a férovou odměnu.',
    },
  }), []);

  const interpretedScores = React.useMemo(() => {
    const withLabels = dimensionScores.map((score) => ({
      ...score,
      label: dimensionLabels[score.dimension] || score.dimension.replace(/_/g, ' '),
      report: dimensionReport[score.dimension],
    }));
    return {
      all: withLabels,
      strengths: [...withLabels].filter((score) => !String(score.dimension).startsWith('i')).sort((left, right) => right.percentile - left.percentile).slice(0, 3),
      growth: [...withLabels].filter((score) => !String(score.dimension).startsWith('i')).sort((left, right) => left.percentile - right.percentile).slice(0, 2),
      ikigai: withLabels.filter((score) => String(score.dimension).startsWith('i')).sort((left, right) => right.percentile - left.percentile),
    };
  }, [dimensionLabels, dimensionReport, dimensionScores]);

  const scoreBand = React.useCallback((score: number, report?: { high: string; balanced: string; low: string }) => {
    if (!report) return '';
    if (score >= 85) return report.high;
    if (score >= 50) return report.balanced;
    return report.low;
  }, []);

  const reportLead = React.useMemo(() => {
    const top = interpretedScores.strengths[0];
    const second = interpretedScores.strengths[1];
    const growth = interpretedScores.growth[0];
    if (!top) return '';
    return `Tvůj profil nejvíc stojí na oblasti ${top.label} (${top.percentile}/100)${second ? ` a ${second.label} (${second.percentile}/100)` : ''}. To ukazuje, kde se budeš nejspíš učit rychle, přinášet hodnotu a cítit pracovní tah. Nejbližší růstová páka je ${growth?.label || top.label}: tam stačí jeden konkrétní návyk, aby se profil zpřesnil a byl praktičtější pro výběr rolí.`;
  }, [interpretedScores.growth, interpretedScores.strengths]);

  const environmentRecommendations = React.useMemo(() =>
    interpretedScores.strengths
      .map((score) => score.report?.environment)
      .filter((value): value is string => Boolean(value))
      .slice(0, 3),
    [interpretedScores.strengths]);

  React.useEffect(() => {
    if (!completed) return;
    setSession((current) => ({ ...current, archetypeTitle: archetype.title, summary: archetype.description, completedAt: new Date().toISOString() }));
  }, [archetype.description, archetype.title, completed]);

  React.useEffect(() => {
    if (!completed) {
      setSubmitState('idle');
      return;
    }

    const itemIds = questions.map((question) => question.id);
    const signature = JSON.stringify({ itemIds, answers: session.answers });
    if (submittedSignatureRef.current === signature) return;
    submittedSignatureRef.current = signature;
    setSubmitState('saving');

    void submitJcfpm(session.answers, itemIds, `rebuild-${locale}`, locale, questions)
      .then((res) => {
        if (!res) {
          setSubmitState('failed');
          return;
        }
        setSnapshot(res);
        clearJcfpmDraft(JCFPM_DRAFT_SCOPE);
        setSubmitState('saved');
      })
      .catch(() => {
        submittedSignatureRef.current = '';
        setSubmitState('failed');
      });
  }, [completed, locale, questions, session.answers]);

  React.useEffect(() => {
    if (!questionsLoading && dimensionGroups.length > 0) {
      if (completed) {
        setWizardStep('results');
      } else {
        const currentGroup = dimensionGroups[currentGroupIndex];
        const groupComplete = currentGroup?.questions.every((q) => isQuestionComplete(q));
        if (groupComplete && currentGroupIndex < dimensionGroups.length - 1) {
          // Auto advance group? Or let user click? Let's auto advance for now but maybe better with button
        }
      }
    }
  }, [questionsLoading, dimensionGroups, completed, isQuestionComplete, currentGroupIndex]);

  React.useEffect(() => {
    const group = dimensionGroups[currentGroupIndex];
    if (!group) return;
    const firstIncomplete = group.questions.findIndex((question) => !isQuestionComplete(question));
    setCurrentQuestionIndex(firstIncomplete >= 0 ? firstIncomplete : Math.max(0, group.questions.length - 1));
  }, [currentGroupIndex, dimensionGroups, isQuestionComplete]);

  const optionId = React.useCallback((option: any) => String(option?.id ?? option?.value ?? option), []);

  const optionLabel = React.useCallback((option: any) => String(option?.label ?? option?.text ?? option?.title ?? option), []);

  const optionImage = React.useCallback((option: any) => String(option?.image_url ?? option?.imageUrl ?? option?.image ?? ''), []);

  const syntheticChoiceImage = React.useCallback((question: JcfpmQuestion, option: any, index: number) => {
    const seed = `${question.id}-${optionId(option)}-${optionLabel(option)}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    const palettes = [
      ['#eff6ff', '#2563eb', '#0f766e', '#f59e0b'],
      ['#f8fafc', '#475569', '#0284c7', '#14b8a6'],
      ['#f0fdf4', '#15803d', '#0f766e', '#64748b'],
    ];
    const palette = palettes[Math.abs(hash) % palettes.length];
    const x = 18 + (Math.abs(hash) % 28);
    const y = 18 + (Math.abs(hash >> 3) % 24);
    const tilt = (Math.abs(hash >> 5) % 32) - 16;
    const density = index + 2;
    const shapes = Array.from({ length: density }).map((_, shapeIndex) => {
      const sx = 18 + ((Math.abs(hash >> shapeIndex) + shapeIndex * 19) % 72);
      const sy = 24 + ((Math.abs(hash >> (shapeIndex + 2)) + shapeIndex * 13) % 58);
      const size = 12 + ((Math.abs(hash >> (shapeIndex + 4)) + shapeIndex * 5) % 18);
      return `<rect x="${sx}" y="${sy}" width="${size}" height="${size}" rx="4" fill="${palette[(shapeIndex % 3) + 1]}" opacity="${0.18 + shapeIndex * 0.11}" transform="rotate(${tilt}, ${sx + size / 2}, ${sy + size / 2})"/>`;
    }).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 112" role="img" aria-label="${optionLabel(option).replace(/"/g, '&quot;')}"><rect width="160" height="112" rx="10" fill="${palette[0]}"/><path d="M14 86 C42 ${y}, 58 ${104 - y}, 90 72 S126 42 146 58" fill="none" stroke="${palette[2]}" stroke-width="3" opacity=".35"/><circle cx="${x}" cy="${y}" r="18" fill="${palette[1]}" opacity=".18"/><circle cx="${122 - index * 12}" cy="${30 + index * 12}" r="${12 + index * 3}" fill="${palette[3]}" opacity=".22"/>${shapes}<path d="M24 24h36M24 34h24M104 84h34M114 94h24" stroke="#0f172a" stroke-width="3" stroke-linecap="round" opacity=".16"/></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }, [optionId, optionLabel]);

  const handleAnswer = (
    questionId: string,
    value: number | string | string[] | { choice_id?: string; order?: string[]; pairs?: Array<{ source: string; target: string }>; selectedSource?: string; time_ms?: number },
  ) => {
    setSession((current) => ({ ...current, answers: { ...current.answers, [questionId]: value } }));
  };

  const handleSingleChoiceAnswer = (
    question: JcfpmQuestion,
    value: number | string | { choice_id?: string; order?: string[]; pairs?: Array<{ source: string; target: string }>; selectedSource?: string; time_ms?: number },
  ) => {
    handleAnswer(question.id, value);
    window.setTimeout(() => {
      const group = dimensionGroups[currentGroupIndex];
      if (!group) return;
      const nextIndex = currentQuestionIndex + 1;
      if (nextIndex < group.questions.length) {
        setCurrentQuestionIndex(nextIndex);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        handleNextGroup();
      }
    }, 240);
  };

  const handleNextGroup = () => {
    if (currentGroupIndex < dimensionGroups.length - 1) {
      setCurrentGroupIndex((prev) => prev + 1);
      setCurrentQuestionIndex(0);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (completed) {
      setWizardStep('results');
    }
  };

  const handleReset = () => {
    setSession({ answers: {} });
    clearJcfpmDraft(JCFPM_DRAFT_SCOPE);
    submittedSignatureRef.current = '';
    setSubmitState('idle');
    setCurrentGroupIndex(0);
    setCurrentQuestionIndex(0);
    setWizardStep('welcome');
    setSnapshot(null);
  };

  return (
    <CandidateShellSurface
      variant="profile"
      className={shellPageClass}
      eyebrow={<SectionEyebrow>{t('rebuild.jcfpm.title', { defaultValue: 'JCFPM profil' })}</SectionEyebrow>}
      title={t('rebuild.jcfpm.subtitle', { defaultValue: 'Work preference profile' })}
      subtitle={t('rebuild.jcfpm.copy', { defaultValue: 'Vypln kratky profil a rychleji poznas, jake nabidky ti opravdu sednou.' })}
    >
      {questionsLoading ? (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <Loader2 size={32} className="animate-spin" />
        </div>
      ) : questionsError ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-5 text-sm leading-7 text-rose-700">
          {questionsError}
        </div>
      ) : wizardStep === 'welcome' ? (
        <ShellCard className="mx-auto max-w-2xl p-10 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#255DAB]/10 text-[#255DAB]">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 14 4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" /></svg>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">{t('rebuild.jcfpm.welcome_title', { defaultValue: 'Psychometric and skill profile' })}</h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            {t('rebuild.jcfpm.welcome_desc', { defaultValue: '16 blocks await you: psychometric work profile, cognitive and skill tasks, and a basic Ikigai layer. The result is saved to your profile and helps us recommend roles and handshakes that fit you better than a traditional CV.' })}
          </p>
          <button
            type="button"
            onClick={() => setWizardStep('questions')}
            className={cn(primaryButtonClass, 'mt-10 w-full max-w-sm rounded-[16px] py-4 text-lg')}
          >
            {t('rebuild.jcfpm.start_test', { defaultValue: 'Start JCFPM test' })}
          </button>
        </ShellCard>
      ) : wizardStep === 'questions' ? (
        <div className="mx-auto max-w-3xl">
          <div className="mb-8">
            <div className="mb-2 flex items-center justify-between text-sm font-medium text-slate-500">
              <span>{t('rebuild.assessment.group_progress', { defaultValue: 'Blok {{current}} z {{total}}', current: currentGroupIndex + 1, total: dimensionGroups.length })}</span>
              <span>{Math.round(((currentGroupIndex + 1) / dimensionGroups.length) * 100)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-[#255DAB] transition-all duration-500 ease-out"
                style={{ width: `${((currentGroupIndex + 1) / dimensionGroups.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="mb-6 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {currentGroupIndex < 6
                ? t('rebuild.jcfpm.psych_profile', { defaultValue: 'Psychological profile' })
                : currentGroupIndex < 12
                  ? t('rebuild.jcfpm.skill_profile', { defaultValue: 'Cognitive and skill prerequisites' })
                  : t('rebuild.jcfpm.ikigai_profile', { defaultValue: 'Ikigai profile' })} • {dimensionLabels[dimensionGroups[currentGroupIndex].dimension]}
            </div>

            {(() => {
              const group = dimensionGroups[currentGroupIndex];
              const question = group.questions[Math.min(currentQuestionIndex, group.questions.length - 1)];
              const isLikert = !question.item_type || question.item_type === 'likert';
              const isOrdering = question.item_type === 'ordering';
              const isPairing = question.item_type === 'drag_drop';
              const isImageChoice = question.item_type === 'image_choice';
              const options = ((question.payload?.options as any[]) || []).filter(Boolean);
              const sources = ((question.payload?.sources as any[]) || options).filter(Boolean);
              const targets = ((question.payload?.targets as any[]) || []).filter(Boolean);
              const answer = session.answers[question.id] as any;
              // Use localOrderMap for in-progress reordering; fall back to saved answer or default option order
              const savedOrder = Array.isArray(answer?.order) ? answer.order.map(String) : options.map(optionId);
              const order = localOrderMap[question.id] ?? savedOrder;
              const pairs = Array.isArray(answer?.pairs) ? answer.pairs : [];
              const selectedSource = typeof answer?.selectedSource === 'string' ? answer.selectedSource : '';
              const interactionLabel = isPairing
                ? t('rebuild.jcfpm.interaction_pairing', { defaultValue: 'Párování' })
                : isOrdering
                  ? t('rebuild.jcfpm.interaction_sequence', { defaultValue: 'Pořadí' })
                  : isImageChoice
                    ? t('rebuild.jcfpm.interaction_visual_choice', { defaultValue: 'Vizuální volba' })
                    : isLikert
                      ? t('rebuild.jcfpm.interaction_scale', { defaultValue: 'Škála' })
                      : t('rebuild.jcfpm.interaction_choice', { defaultValue: 'Volba' });
              const interactionHint = isPairing
                ? t('rebuild.jcfpm.hint_pairing', { defaultValue: 'Propoj každou položku vlevo s nejpravděpodobnějším důsledkem vpravo. Funguje přetažení i kliknutí: nejdřív zdroj, potom cíl.' })
                : isOrdering
                  ? t('rebuild.jcfpm.hint_ordering', { defaultValue: 'Seřaď kroky od prvního po poslední. Položky můžeš přetáhnout nebo posouvat šipkami.' })
                  : isImageChoice
                    ? t('rebuild.jcfpm.hint_visual_choice', { defaultValue: 'Vyber interpretaci, která nejlépe odpovídá zobrazenému signálu.' })
                    : '';

              // setLocalOrder: only updates the visual order on screen (does NOT submit answer)
              const setLocalOrder = (nextOrder: string[]) =>
                setLocalOrderMap((prev) => ({ ...prev, [question.id]: nextOrder }));
              // confirmOrder: called when candidate clicks "Potvrdit zobrazené pořadí"
              const confirmOrder = () => {
                handleAnswer(question.id, { order: order });
              };
              const setPair = (source: string, target: string) => {
                const nextPairs = [...pairs.filter((pair: any) => pair.source !== source && pair.target !== target), { source, target }];
                handleAnswer(question.id, { pairs: nextPairs });
              };
              const markSource = (source: string) => handleAnswer(question.id, { pairs, selectedSource: source });

              return (
                <ShellCard key={question.id} className="p-6 md:p-8">
                  <div className="mb-5 flex items-center justify-between gap-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    <span>{t('rebuild.jcfpm.item_progress', { defaultValue: 'Úloha {{current}} / {{total}}', current: currentQuestionIndex + 1, total: group.questions.length })}</span>
                    <span>{interactionLabel}</span>
                  </div>
                  <h3 className="text-xl font-semibold leading-relaxed text-slate-950">{question.prompt || question.payload?.question}</h3>
                  {question.payload?.helper_text ? <p className="mt-3 text-sm leading-6 text-slate-500">{question.payload.helper_text}</p> : null}
                  {interactionHint ? <p className="mt-3 text-sm leading-6 text-slate-500">{interactionHint}</p> : null}

                  {isLikert ? (
                    <div className="mt-8">
                      <div className="grid grid-cols-7 gap-2">
                        {[1, 2, 3, 4, 5, 6, 7].map((value) => {
                          const active = Number(session.answers[question.id] || 0) === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => handleSingleChoiceAnswer(question, value)}
                              className={cn(
                                'flex aspect-square min-h-12 flex-col items-center justify-center rounded-[8px] border text-base font-bold transition-all duration-200',
                                active ? 'border-[#255DAB] bg-[#255DAB] text-white shadow-lg' : 'border-slate-200 bg-white text-slate-600 hover:border-[#255DAB]/40 hover:bg-slate-50'
                              )}
                            >
                              {value}
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-3 flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <span>{t('rebuild.jcfpm.disagree', { defaultValue: 'Disagree' })}</span>
                        <span>{t('rebuild.jcfpm.agree', { defaultValue: 'Agree' })}</span>
                      </div>
                    </div>
                  ) : isOrdering ? (
                    <div className="mt-7 space-y-3">
                      <button
                          type="button"
                          onClick={confirmOrder}
                          className="mb-2 rounded-[8px] border border-[#255DAB]/30 bg-[#255DAB]/5 px-4 py-2 text-sm font-semibold text-[#255DAB]"
                        >
                          {t('rebuild.jcfpm.confirm_visible_order', { defaultValue: 'Potvrdit zobrazené pořadí' })}
                        </button>
                      {order.map((id: string, index: number) => {
                        const opt = options.find((item) => optionId(item) === id) || { id, label: id };
                        return (
                          <div
                            key={id}
                            draggable
                            onDragStart={(event) => event.dataTransfer.setData('text/plain', id)}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => {
                              event.preventDefault();
                              const dragged = event.dataTransfer.getData('text/plain');
                              if (!dragged || dragged === id) return;
                              const next = order.filter((item: string) => item !== dragged);
                              next.splice(index, 0, dragged);
                              setLocalOrder(next);
                            }}
                            className="flex items-center gap-3 rounded-[8px] border border-slate-200 bg-white p-3 shadow-sm"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-slate-900 text-sm font-bold text-white">{index + 1}</div>
                            <GripVertical size={18} className="shrink-0 text-slate-300" />
                            <span className="min-w-0 flex-1 text-sm font-semibold leading-6 text-slate-700">{optionLabel(opt)}</span>
                            <div className="flex shrink-0 gap-1">
                              <button type="button" disabled={index === 0} onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const next = [...order];
                                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                setLocalOrder(next);
                              }} className="rounded-[8px] border border-slate-200 p-2 text-slate-500 disabled:opacity-30">
                                <ArrowUp size={14} />
                              </button>
                              <button type="button" disabled={index === order.length - 1} onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const next = [...order];
                                [next[index + 1], next[index]] = [next[index], next[index + 1]];
                                setLocalOrder(next);
                              }} className="rounded-[8px] border border-slate-200 p-2 text-slate-500 disabled:opacity-30">
                                <ArrowRight size={14} className="rotate-90" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : isPairing ? (
                    <div className="mt-7 grid gap-4 md:grid-cols-2">
                      <div className="space-y-3">
                        {sources.map((source) => {
                          const id = optionId(source);
                          const paired = pairs.find((pair: any) => pair.source === id);
                          return (
                            <button
                              key={id}
                              type="button"
                              draggable
                              onDragStart={(event) => event.dataTransfer.setData('text/plain', id)}
                              onClick={() => markSource(id)}
                              className={cn(
                                'flex w-full items-center justify-between gap-3 rounded-[8px] border p-4 text-left transition-all',
                                selectedSource === id ? 'border-[#255DAB] bg-[#255DAB]/5 text-[#255DAB]' : 'border-slate-200 bg-white text-slate-700 hover:border-[#255DAB]/40'
                              )}
                            >
                              <span className="text-sm font-semibold leading-6">{optionLabel(source)}</span>
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500">{paired ? targets.find((target) => optionId(target) === paired.target)?.label || paired.target : 'vyber'}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="space-y-3">
                        {targets.map((target) => {
                          const id = optionId(target);
                          const paired = pairs.find((pair: any) => pair.target === id);
                          return (
                            <button
                              key={id}
                              type="button"
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) => {
                                event.preventDefault();
                                const sourceId = event.dataTransfer.getData('text/plain');
                                if (sourceId) setPair(sourceId, id);
                              }}
                              onClick={() => selectedSource && setPair(selectedSource, id)}
                              className={cn(
                                'min-h-16 w-full rounded-[8px] border border-dashed p-4 text-left transition-all',
                                paired ? 'border-[#255DAB] bg-[#255DAB]/5' : 'border-slate-300 bg-slate-50 hover:border-[#255DAB]/50'
                              )}
                            >
                              <div className="text-sm font-semibold text-slate-900">{optionLabel(target)}</div>
                              <div className="mt-1 text-xs font-medium text-slate-500">{paired ? sources.find((source) => optionId(source) === paired.source)?.label || paired.source : 'Sem přetáhni nebo přiřaď příčinu'}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className={cn('mt-6 grid gap-3', isImageChoice ? 'md:grid-cols-3' : '')}>
                      {options.map((opt) => {
                        const id = optionId(opt);
                        const selected = String((answer?.choice_id ?? answer) || '') === id;
                        const image = optionImage(opt) || (isImageChoice ? syntheticChoiceImage(question, opt, options.findIndex((item) => optionId(item) === id)) : '');
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => handleSingleChoiceAnswer(question, { choice_id: id })}
                            className={cn(
                              'w-full overflow-hidden rounded-[8px] border text-left transition-all',
                              selected ? 'border-[#255DAB] bg-[#255DAB]/5 text-[#255DAB]' : 'border-slate-200 bg-white text-slate-700 hover:border-[#255DAB]/40'
                            )}
                          >
                            {isImageChoice ? (
                              image ? (
                                <img src={image} alt="" className="h-32 w-full object-cover" loading="lazy" />
                              ) : (
                                <div className="h-32 w-full bg-[radial-gradient(circle_at_25%_30%,rgba(37,93,171,0.28),transparent_30%),linear-gradient(135deg,#f8fafc,#dbeafe_48%,#ecfeff)]">
                                  <div className="grid h-full grid-cols-3 gap-2 p-4 opacity-80">
                                    <span className="rounded-[8px] bg-white/70 shadow-sm" />
                                    <span className="rounded-full border-2 border-white/80 bg-[#255DAB]/20" />
                                    <span className="rounded-[8px] bg-white/50 shadow-sm" />
                                  </div>
                                </div>
                              )
                            ) : null}
                            <div className="flex items-center gap-3 p-4">
                              <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2', selected ? 'border-[#255DAB] bg-[#255DAB]' : 'border-slate-200')}>
                                {selected ? <div className="h-2 w-2 rounded-full bg-white" /> : null}
                              </div>
                              <span className="text-sm font-semibold leading-6">{optionLabel(opt)}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </ShellCard>
              );
            })()}
          </div>

          <div className="mt-10 flex flex-col items-center gap-6">
            <button
              type="button"
              disabled={!isQuestionComplete(dimensionGroups[currentGroupIndex].questions[Math.min(currentQuestionIndex, dimensionGroups[currentGroupIndex].questions.length - 1)])}
              onClick={() => {
                const group = dimensionGroups[currentGroupIndex];
                if (currentQuestionIndex < group.questions.length - 1) {
                  setCurrentQuestionIndex((prev) => prev + 1);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  return;
                }
                handleNextGroup();
              }}
              className={cn(primaryButtonClass, 'w-full max-w-sm rounded-[16px] py-4 text-lg disabled:opacity-50 disabled:grayscale')}
            >
              {currentQuestionIndex < dimensionGroups[currentGroupIndex].questions.length - 1
                ? t('rebuild.jcfpm.next_item', { defaultValue: 'Další úloha' })
                : currentGroupIndex < dimensionGroups.length - 1 ? t('rebuild.jcfpm.next_block', { defaultValue: 'Continue to next block' }) : t('rebuild.jcfpm.finish', { defaultValue: 'Finish and show results' })}
            </button>
            <button type="button" onClick={handleReset} className="text-sm font-medium text-slate-400 hover:text-slate-600">
              {t('rebuild.jcfpm.abort', { defaultValue: 'Interrupt and start again' })}
            </button>
          </div>
        </div>
      ) : (
        <ShellCard className="grid gap-6 p-6 xl:grid-cols-[1fr_340px]">
          <div className="flex flex-col">
            <div className="flex-1 space-y-6">
              <div className="rounded-[28px] bg-[linear-gradient(145deg,#103d46,#1f6c74_48%,#d18a45_140%)] p-8 text-white shadow-[0_30px_80px_-42px_rgba(18,89,100,0.56)]">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/72">{t('rebuild.jcfpm.archetype', { defaultValue: 'Archetyp' })}</div>
                <div className="mt-4 text-4xl font-bold tracking-[-0.05em]">{archetype.title}</div>
                <p className="mt-6 max-w-2xl text-base leading-8 text-white/90">{archetype.description}</p>
              </div>

              <div className={cn(panelClass, 'p-7')}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0f95ac]">
                  {t('rebuild.jcfpm.report_readout', { defaultValue: 'Interpretace profilu' })}
                </div>
                <h4 className="mt-3 text-2xl font-bold tracking-[-0.03em] text-slate-900">
                  {t('rebuild.jcfpm.report_title', { defaultValue: 'Co z výsledků opravdu plyne' })}
                </h4>
                <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-600">{reportLead}</p>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  {interpretedScores.strengths.map((score) => (
                    <div key={`strength-${score.dimension}`} className="rounded-[20px] border border-[#d8edf2] bg-[#f5fbfc] p-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0f95ac]">{score.label}</div>
                      <div className="mt-2 text-2xl font-black text-slate-900">{score.percentile}/100</div>
                      <p className="mt-3 text-[13px] leading-6 text-slate-600">{scoreBand(score.percentile, score.report)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                <div className={cn(panelClass, 'p-7')}>
                  <h4 className="text-lg font-bold text-slate-900">{t('rebuild.jcfpm.work_environment_title', { defaultValue: 'Kde bude profil nejspíš fungovat' })}</h4>
                  <div className="mt-5 space-y-3">
                    {environmentRecommendations.map((recommendation, index) => (
                      <div key={`environment-${index}`} className="flex gap-3 rounded-[18px] bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#0f95ac]" />
                        <span>{recommendation}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={cn(panelClass, 'p-7')}>
                  <h4 className="text-lg font-bold text-slate-900">{t('rebuild.jcfpm.growth_focus_title', { defaultValue: 'Nejbližší růstový fokus' })}</h4>
                  <div className="mt-5 space-y-4">
                    {interpretedScores.growth.map((score) => (
                      <div key={`growth-${score.dimension}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-bold text-slate-900">{score.label}</div>
                          <div className="text-xs font-bold text-slate-400">{score.percentile}/100</div>
                        </div>
                        <p className="mt-2 text-[13px] leading-6 text-slate-600">{score.report?.development}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {interpretedScores.ikigai.length > 0 ? (
                <div className={cn(panelClass, 'p-7')}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                        {t('rebuild.jcfpm.ikigai_profile', { defaultValue: 'Ikigai profile' })}
                      </div>
                      <h4 className="mt-2 text-lg font-bold text-slate-900">{t('rebuild.jcfpm.ikigai_title', { defaultValue: 'Smysl, síla, potřeba a tržní hodnota' })}</h4>
                    </div>
                    <div className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-amber-700">
                      {t('rebuild.jcfpm.v3_layer', { defaultValue: 'JCFPM v3' })}
                    </div>
                  </div>
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    {interpretedScores.ikigai.map((score) => (
                      <div key={`ikigai-${score.dimension}`} className="rounded-[20px] border border-amber-100 bg-[#fffaf1] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-bold text-slate-900">{score.label}</div>
                          <div className="text-xs font-black text-amber-700">{score.percentile}/100</div>
                        </div>
                        <p className="mt-3 text-[13px] leading-6 text-slate-600">{scoreBand(score.percentile, score.report)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {snapshot?.traits?.big_five && (
                <div className={cn(panelClass, 'p-8')}>
                  <h4 className="text-lg font-bold text-slate-900">{t('rebuild.jcfpm.psych_report_title', { defaultValue: 'Psychometric report (Big 5)' })}</h4>
                  <p className="mt-2 text-sm text-slate-500">{t('rebuild.jcfpm.psych_report_desc', { defaultValue: 'This report compares your internal setting with cognitive prerequisites.' })}</p>
                  <div className="mt-8 grid gap-8 md:grid-cols-2">
                    {[
                      { key: 'openness', label: t('rebuild.jcfpm.big5.openness', { defaultValue: 'Openness' }), color: 'bg-emerald-500' },
                      { key: 'conscientiousness', label: t('rebuild.jcfpm.big5.conscientiousness', { defaultValue: 'Conscientiousness' }), color: 'bg-blue-500' },
                      { key: 'extraversion', label: t('rebuild.jcfpm.big5.extraversion', { defaultValue: 'Extraversion' }), color: 'bg-amber-500' },
                      { key: 'agreeableness', label: t('rebuild.jcfpm.big5.agreeableness', { defaultValue: 'Agreeableness' }), color: 'bg-rose-500' },
                      { key: 'neuroticism', label: t('rebuild.jcfpm.big5.neuroticism', { defaultValue: 'Emotional reactivity' }), color: 'bg-indigo-500' },
                    ].map((trait) => (
                      <div key={trait.key}>
                        <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-400">
                          <span>{trait.label}</span>
                          <span>{Math.round(snapshot.traits.big_five[trait.key])}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className={cn('h-full transition-all duration-1000', trait.color)} style={{ width: `${snapshot.traits.big_five[trait.key]}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {snapshot?.traits?.temperament && (
                <div className={cn(panelClass, 'p-8')}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-lg font-bold text-slate-900">{t('rebuild.jcfpm.temperament_title', { defaultValue: 'Temperament profile' })}</h4>
                      <div className="mt-2 text-2xl font-bold capitalize text-[#255DAB]">{snapshot.traits.temperament.label}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('rebuild.jcfpm.confidence', { defaultValue: 'Estimation confidence' })}</div>
                      <div className="text-xl font-bold text-slate-700">{snapshot.traits.temperament.confidence}%</div>
                    </div>
                  </div>
                  <div className="mt-6 grid gap-6 md:grid-cols-2">
                    <div>
                      <div className="mb-2 text-xs font-semibold text-slate-500">{t('rebuild.jcfpm.dominance', { defaultValue: 'Dominance' })}</div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full bg-slate-400" style={{ width: `${snapshot.traits.temperament.dominance}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 text-xs font-semibold text-slate-500">{t('rebuild.jcfpm.reactivity', { defaultValue: 'Reactivity' })}</div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full bg-slate-400" style={{ width: `${snapshot.traits.temperament.reactivity}%` }} />
                      </div>
                    </div>
                  </div>
                  {snapshot.traits.temperament.notes?.length > 0 && (
                    <div className="mt-6 space-y-2">
                      {snapshot.traits.temperament.notes.map((note: string, idx: number) => (
                        <div key={idx} className="flex gap-2 text-sm leading-6 text-slate-600">
                          <span className="text-[#255DAB]">•</span>
                          <span>{note}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500">
                  {submitState === 'saving' ? t('rebuild.jcfpm.saving', { defaultValue: 'Saving JCFPM...' }) : submitState === 'saved' ? t('rebuild.jcfpm.saved', { defaultValue: 'JCFPM saved to profile' }) : submitState === 'failed' ? t('rebuild.jcfpm.save_failed', { defaultValue: 'Failed to save JCFPM' }) : null}
                </div>
              </div>
              <button type="button" onClick={handleReset} className={secondaryButtonClass}>{t('rebuild.jcfpm.reset', { defaultValue: 'Try again' })}</button>
            </div>
          </div>
          <div className="space-y-5">
            <div className={cn(panelClass, 'p-5')}>
              <div className="text-sm font-semibold text-slate-900">{t('rebuild.jcfpm.response_quality_title', { defaultValue: 'Kvalita měření' })}</div>
              <div className="mt-4 flex items-end justify-between gap-4">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{t('rebuild.jcfpm.confidence', { defaultValue: 'Estimation confidence' })}</div>
                  <div className="mt-1 text-3xl font-black text-slate-900">{snapshot?.confidence ?? Math.round((questions.filter((question) => isQuestionComplete(question)).length / Math.max(1, questions.length)) * 100)}%</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{t('rebuild.jcfpm.coverage', { defaultValue: 'Pokrytí' })}</div>
                  <div className="mt-1 text-lg font-bold text-[#255DAB]">{snapshot?.response_quality?.coverage ?? 100}%</div>
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                {snapshot?.response_quality?.flags?.length
                  ? t('rebuild.jcfpm.response_quality_flagged', { defaultValue: 'Výsledek je uložen, ale některé odpovědní vzorce snižují jistotu interpretace.' })
                  : t('rebuild.jcfpm.response_quality_clean', { defaultValue: 'Odpovědi mají dostatečné rozlišení pro základní interpretaci profilu.' })}
              </p>
            </div>
            <div className={cn(panelClass, 'p-5')}>
              <div className="text-sm font-semibold text-slate-900">{t('rebuild.jcfpm.dimension_map', { defaultValue: 'Dimension overview' })}</div>
              <div className="mt-5 space-y-4">
                {dimensionScores.map((item) => (
                  <div key={item.dimension}>
                    <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                      <span>{dimensionLabels[item.dimension] || item.dimension.replace(/_/g, ' ')}</span>
                      <span>{item.percentile}%</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-[#255DAB]" style={{ width: `${item.percentile}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ShellCard>
      )}
    </CandidateShellSurface>
  );
};
