import React from 'react';

import type { CompanyProfile, Job, JobDraft } from '../../../types';
import { companyMapText, resolveCompanyMapLocale } from '../companyMapLocale';
import CompanyJobEditor from '../../CompanyJobEditor';

interface CompanyOpenWaveLayerProps {
  companyProfile: CompanyProfile;
  jobs: Job[];
  userEmail?: string;
  seedJobId?: string | null;
  createDraftSignal?: number;
  draftSeedPayload?: Partial<JobDraft> | null;
  onDraftSeedConsumed?: () => void;
  onSeedConsumed?: () => void;
  onJobLifecycleChange?: (
    jobId: string | number,
    status: 'active' | 'paused' | 'closed' | 'archived',
    options?: { skipAudit?: boolean; refreshJobs?: boolean }
  ) => void;
  locale?: string;
}

const CompanyOpenWaveLayer: React.FC<CompanyOpenWaveLayerProps> = ({
  companyProfile,
  jobs,
  userEmail,
  seedJobId,
  createDraftSignal,
  draftSeedPayload,
  onDraftSeedConsumed,
  onSeedConsumed,
  onJobLifecycleChange,
  locale: localeInput,
}) => {
  const locale = resolveCompanyMapLocale(localeInput);
  const text = (variants: Parameters<typeof companyMapText>[1]) => companyMapText(locale, variants);

  return (
    <div className="space-y-4">
      <div className="rounded-[26px] border border-slate-200/80 bg-white/84 px-5 py-5">
        <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
          {text({
            cs: 'Vrstva Open Challenge',
            sk: 'Vrstva Open Challenge',
            en: 'Open Challenge layer',
            de: 'Ebene Open Challenge',
            pl: 'Warstwa Open Challenge',
          })}
        </div>
        <div className="mt-3 text-2xl font-semibold text-slate-950">
          {text({
            cs: 'Tvorba nové výzvy',
            sk: 'Tvorba novej výzvy',
            en: 'Create a new challenge',
            de: 'Neue Challenge erstellen',
            pl: 'Utwórz nowe wyzwanie',
          })}
        </div>
        <div className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
          {text({
            cs: 'Tahle vrstva už patří do nové mapy, ale samotný editor role je zatím ještě napojený na stávající draft engine. Až bude nový challenge editor hotový, vyměníme i ten.',
            sk: 'Táto vrstva už patrí do novej mapy, ale samotný editor roly je zatiaľ ešte napojený na existujúci draft engine. Keď bude nový challenge editor hotový, vymeníme aj ten.',
            en: 'This layer already belongs to the new map, while the role editor still uses the current draft engine underneath. Once the new challenge editor is ready, we will swap that too.',
            de: 'Diese Ebene gehört bereits zur neuen Karte, während der Rollen-Editor darunter noch den aktuellen Draft-Engine nutzt. Sobald der neue Challenge-Editor fertig ist, tauschen wir auch diesen aus.',
            pl: 'Ta warstwa należy już do nowej mapy, ale sam edytor roli nadal korzysta z obecnego silnika draftów. Gdy nowy edytor challenge będzie gotowy, wymienimy również jego.',
          })}
        </div>
      </div>

      <CompanyJobEditor
        companyProfile={companyProfile}
        jobs={jobs}
        userEmail={userEmail}
        seedJobId={seedJobId}
        createDraftSignal={createDraftSignal}
        draftSeedPayload={draftSeedPayload}
        onDraftSeedConsumed={onDraftSeedConsumed}
        onSeedConsumed={onSeedConsumed}
        onJobLifecycleChange={onJobLifecycleChange}
      />
    </div>
  );
};

export default CompanyOpenWaveLayer;
