import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bookmark, ChevronRight, MessageSquare, ShieldCheck, Zap } from 'lucide-react';
import { cn } from '../cn';
import type { DialogueSummary } from '../../types';
import type { Role } from '../models';

import { ShellCard } from './CandidateShellSurface';


const getApplicationScore = (application: DialogueSummary) => {
  // Try to parse candidate_score if it exists, otherwise return a default or random for demo
  const scoreStr = (application as any).status_metadata?.candidate_score;
  if (scoreStr && !isNaN(Number(scoreStr))) return Number(scoreStr);
  return 85; // Fallback
};

const companyTileClass = [
  'bg-[linear-gradient(180deg,#eef3ff,#dfe7ff)] text-[#214b98]',
  'bg-[linear-gradient(180deg,#f0ecff,#ddd7ff)] text-[#5a37c8]',
  'bg-[linear-gradient(180deg,#daf6f4,#b8ece7)] text-[#0f6a6a]',
] as const;

export const CandidateApplicationsPage: React.FC<{
  candidateApplications: DialogueSummary[];
  roleLibrary: Role[];
  savedJobIds: string[];
  onOpenRole: (id: string) => void;
  onOpenHandshake: (id: string) => void;
  onToggleSavedRole: (id: string) => void;
  t?: any;
}> = ({
  candidateApplications,
  roleLibrary,
  savedJobIds,
  onOpenRole,
  onOpenHandshake,
  onToggleSavedRole,
}) => {
  const { t } = useTranslation();
  const savedRoles = roleLibrary.filter((role) => savedJobIds.includes(String(role.id)));

  return (
    <div className="space-y-6">
      {/* Handshakes Section */}
      <section>
        <div className="mb-4 flex items-center gap-3">
          <MessageSquare className="text-[#12AFCB]" size={20} />
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {t('rebuild.applications.active_handshakes')}
          </h2>
        </div>

        {candidateApplications.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {candidateApplications.map((application, index) => {
              const roleId = String(application.job_id || '');
              const role = roleLibrary.find((r) => String(r.id) === roleId);
              const companyName = role ? role.companyName : (application as any).company_name || t('rebuild.applications.fallback_company');
              const roleTitle = role ? role.title : (application as any).job_title || t('rebuild.applications.fallback_role');
              const score = getApplicationScore(application);
              const tileClass = companyTileClass[index % companyTileClass.length];

              return (
                <button
                  key={application.id}
                  type="button"
                  onClick={() => onOpenHandshake(roleId)}
                  className="group flex flex-col justify-between overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-1 hover:shadow-xl hover:border-[#12AFCB]/30"
                >
                  <div className="flex w-full items-start justify-between gap-3">
                    <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] text-lg font-black', tileClass)}>
                      {companyName.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex items-center gap-1.5 rounded-full border border-slate-100 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                      <Zap size={12} className="text-[#12AFCB]" />
                      {t('rebuild.applications.match_label', { score })}
                    </div>
                  </div>
                  <div className="mt-5">
                    <h3 className="truncate text-lg font-semibold tracking-tight text-slate-900 group-hover:text-[#12AFCB] transition-colors">{roleTitle}</h3>
                    <p className="truncate text-sm text-slate-500">{companyName}</p>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-medium text-slate-500">
                    <span className="capitalize">{application.status.replace(/_/g, ' ')}</span>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-[#12AFCB] transition-colors group-hover:translate-x-1" />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <ShellCard className="overflow-hidden border-0 bg-[linear-gradient(145deg,#f0f4f8,#f8fafc)] shadow-inner">
            <div className="grid gap-8 p-8 md:grid-cols-[1.5fr_1fr] lg:p-12">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#12AFCB]/20 bg-[#12AFCB]/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#0f95ac]">
                  <ShieldCheck size={14} />
                  {t('rebuild.applications.handshake_badge')}
                </div>
                <h3 className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-slate-900">
                  {t('rebuild.applications.no_generic_cv')}
                </h3>
                <p className="mt-4 max-w-lg text-base leading-7 text-slate-600">
                  {t('rebuild.applications.handshake_description')}
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-bold">1</span>
                    {t('rebuild.applications.step1')}
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-bold">2</span>
                    {t('rebuild.applications.step2')}
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-bold">3</span>
                    {t('rebuild.applications.step3')}
                  </div>
                </div>
              </div>
              <div className="relative hidden items-center justify-center rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:flex">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(18,175,203,0.05),transparent_60%)]" />
                <div className="text-center relative z-10">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#12AFCB]/10 text-[#12AFCB]">
                    <MessageSquare size={28} />
                  </div>
                  <h4 className="mt-4 font-semibold text-slate-900">{t('rebuild.applications.empty_handshakes_title')}</h4>
                  <p className="mt-2 text-sm text-slate-500">{t('rebuild.applications.empty_handshakes_subtitle')}</p>
                </div>
              </div>
            </div>
          </ShellCard>
        )}
      </section>

      {/* Saved Roles Section */}
      <section className="pt-8">
        <div className="mb-4 flex items-center gap-3">
          <Bookmark className="text-amber-500" size={20} />
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {t('rebuild.applications.saved_roles')}
          </h2>
        </div>

        {savedRoles.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {savedRoles.map((role) => (
              <div
                key={role.id}
                className="group flex flex-col justify-between rounded-[20px] border border-slate-200 bg-white p-5 transition hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{role.companyName}</div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSavedRole(role.id);
                      }}
                      className="rounded-full bg-amber-50 p-1.5 text-amber-500 hover:bg-amber-100 transition"
                      title={t('rebuild.applications.remove_saved')}
                    >
                      <Bookmark size={16} className="fill-current" />
                    </button>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-900 line-clamp-2">{role.title}</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{role.location}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{role.workModel}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenRole(role.id)}
                  className="mt-6 w-full rounded-[14px] bg-slate-50 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  {t('rebuild.applications.open_detail')}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/50 px-6 py-12 text-center">
            <Bookmark size={32} className="mx-auto text-slate-300" />
            <h3 className="mt-4 font-semibold text-slate-900">{t('rebuild.applications.empty_saved_title')}</h3>
            <p className="mt-2 text-sm text-slate-500">{t('rebuild.applications.empty_saved_subtitle')}</p>
          </div>
        )}
      </section>
    </div>
  );
};
