import React from 'react';
import { cn } from '../cn';
import type { Role, Company } from '../models';
import { resolveCompany } from '../shellDomain';
import { getApplicationStatusCopy } from '../status';
import { getStockCoverCandidatesForDomain } from '../../utils/domainCoverImages';
import { panelClass } from '../ui/shellStyles';

const MARKETPLACE_IMAGE_FALLBACK = '/hero-panorama.png';
const MARKETPLACE_LOGO_FALLBACK = '/logo-alt.png';

const buildImageCandidates = (sources: Array<string | null | undefined>): string[] =>
  Array.from(new Set(sources.map((source) => String(source || '').trim()).filter(Boolean)));

export const ResilientImage: React.FC<React.ImgHTMLAttributes<HTMLImageElement> & {
  fallbackSrcs?: Array<string | null | undefined>;
}> = ({ src, fallbackSrcs = [], alt = '', onError, ...props }) => {
  const sources = React.useMemo(
    () => buildImageCandidates([src, ...fallbackSrcs]),
    [fallbackSrcs, src],
  );
  const [sourceIndex, setSourceIndex] = React.useState(0);

  React.useEffect(() => {
    setSourceIndex(0);
  }, [sources]);

  if (sources.length === 0) return null;

  return (
    <img
      {...props}
      src={sources[Math.min(sourceIndex, sources.length - 1)]}
      alt={alt}
      onError={(event) => {
        if (sourceIndex < sources.length - 1) {
          setSourceIndex((current) => Math.min(current + 1, sources.length - 1));
          return;
        }
        onError?.(event);
      }}
    />
  );
};

export const RoleCard: React.FC<{
  role: Role;
  companyLibrary: Company[];
  onOpen: () => void;
  applicationStatus?: string;
  t?: (key: string, opts: { defaultValue: string }) => string;
}> = ({ role, companyLibrary, onOpen, applicationStatus, t }) => {
  const company = resolveCompany(role, companyLibrary);
  const statusCopy = applicationStatus ? getApplicationStatusCopy(applicationStatus, t) : null;
  const coverFallbacks = buildImageCandidates([
    role.companyCoverImage,
    company.coverImage,
    ...getStockCoverCandidatesForDomain('operations', `${role.companyName}:${role.title}`),
    MARKETPLACE_IMAGE_FALLBACK,
  ]);
  const logoFallbacks = buildImageCandidates([
    role.companyLogo,
    company.logo,
    MARKETPLACE_LOGO_FALLBACK,
    '/logo.png',
  ]);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(panelClass, 'group relative overflow-hidden text-left transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_40px_110px_-52px_rgba(15,23,42,0.35)]')}
    >
      <div className="absolute inset-0">
        <ResilientImage src={role.heroImage} fallbackSrcs={coverFallbacks} alt={role.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]" loading="lazy" decoding="async" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,15,33,0.2),rgba(5,15,33,0.78)_72%,rgba(5,15,33,0.96))]" />
      </div>
      <div className="relative flex min-h-[26rem] flex-col justify-between p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <ResilientImage src={company.logo} fallbackSrcs={logoFallbacks} alt={company.name} className="h-11 w-11 rounded-2xl border border-white/12 object-cover shadow-[0_14px_32px_-20px_rgba(0,0,0,0.45)]" loading="lazy" decoding="async" />
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
              {role.source === 'curated' ? t?.('rebuild.role.full_journey', { defaultValue: 'Full Jobshaman journey' }) : t?.('rebuild.role.external_opportunity', { defaultValue: 'External opportunity' })}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {statusCopy ? <span className={cn('rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]', statusCopy.tone)}>{statusCopy.label}</span> : null}
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">{role.workModel}</span>
          </div>
        </div>
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/80">{company.name}</div>
          <h3 className="mt-3 max-w-[18rem] text-[1.9rem] font-semibold leading-[1.03] tracking-[-0.05em] text-white">{role.title}</h3>
          <div className="mt-3 text-sm text-white/80">{role.location} · {role.level}</div>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="text-xs text-white/76">{role.featuredInsights.join(' • ')}</div>
          <span className="rounded-full border border-[rgba(255,255,255,0.18)] bg-[linear-gradient(135deg,#ff8e78,#ff6f5b)] px-4 py-2 text-sm font-semibold text-white shadow-[0_20px_38px_-22px_rgba(255,111,91,0.72)] transition duration-300 group-hover:translate-y-[-1px] group-hover:shadow-[0_24px_44px_-22px_rgba(255,111,91,0.82)]">
            {applicationStatus ? t?.('rebuild.role.track_submission', { defaultValue: 'Track submission' }) : role.source === 'curated' ? t?.('rebuild.role.open_journey', { defaultValue: 'Open journey' }) : t?.('rebuild.role.open_prep', { defaultValue: 'Open prep' })}
          </span>
        </div>
      </div>
    </button>
  );
};
