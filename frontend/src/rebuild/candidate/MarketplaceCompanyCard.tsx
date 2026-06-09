import React from 'react';
import { ArrowRight, Bookmark, MapPin, MessageSquare, Play } from 'lucide-react';
import { Role } from '../models';
import { cn } from '../cn';

export const MarketplaceCompanyCard: React.FC<{
  role: Role;
  distanceLabel: string;
  onOpen: () => void;
  saved?: boolean;
  onToggleSaved?: () => void;
  t: (key: string, options?: { defaultValue?: string } & Record<string, any>) => string;
}> = ({ role, distanceLabel, onOpen, saved, onToggleSaved, t }) => {
  const mediaUrl = role.companyCoverImage || role.heroImage || role.companyGallery?.[0]?.url || '/handshake.png';

  return (
    <article className="group overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-[0_12px_32px_-28px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_-28px_rgba(15,23,42,0.42)]">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[13px] font-black text-slate-700">
            {role.companyLogo ? <img src={role.companyLogo} alt="" className="h-full w-full rounded-xl object-contain" /> : <span>{role.companyName?.slice(0, 2)?.toUpperCase() || 'JS'}</span>}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-black text-slate-950">{role.companyName}</div>
            <div className="truncate text-[11px] font-semibold text-slate-500">{role.companyReviewer?.name || role.team}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleSaved}
          disabled={!onToggleSaved}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-default"
          aria-pressed={saved}
          aria-label={saved ? t('rebuild.marketplace.saved_role', { defaultValue: 'Uložená nabídka' }) : t('rebuild.marketplace.save_role', { defaultValue: 'Uložit nabídku' })}
        >
          <Bookmark size={15} className={saved ? 'fill-slate-900 text-slate-900' : ''} />
        </button>
      </div>
      <div className="relative mt-3 h-32 overflow-hidden bg-slate-100">
        <img src={mediaUrl} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent" />
        <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-black text-emerald-700 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {role.matchScore ? `${role.matchScore}% Match` : t('rebuild.marketplace.new', { defaultValue: 'Nové' })}
        </div>
        <div className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/92 text-slate-700 shadow-sm">
          <Play size={16} />
        </div>
      </div>
      <div className="space-y-2 p-4">
        <div className="text-[15px] font-black text-slate-950">{role.title}</div>
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500">
          <MapPin size={12} />
          <span>{distanceLabel}</span>
        </div>
        <p className="line-clamp-2 text-[12px] leading-5 text-slate-600">{role.summary || role.description}</p>
        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-500">
            <MessageSquare size={13} className="text-slate-400" />
            {t('rebuild.marketplace.open_handshake', { defaultValue: 'Otevřít handshake' })}
          </div>
          <button type="button" onClick={onOpen} className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-[#0f95ac] px-3.5 text-[12px] font-black text-white shadow-[0_10px_22px_-14px_rgba(15,149,172,0.8)] transition hover:bg-[#087f95]">
            {t('rebuild.marketplace.view', { defaultValue: 'Zobrazit' })}
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </article>
  );
};
