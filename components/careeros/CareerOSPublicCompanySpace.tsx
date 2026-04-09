import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Globe, MapPin, Sparkles } from 'lucide-react';

import type { CompanyProfile, Job } from '../../types';
import { fetchJobsByCompany } from '../../services/jobService';
import { getCompanyPublicInfo } from '../../services/supabaseService';
import { mapCompanyToCareerOSSpace } from '../../src/app/careeros/model/viewModels';

interface CareerOSPublicCompanySpaceProps {
  companyId: string;
  onBack: () => void;
  onOpenChallenge: (jobId: string) => void;
}

const CareerOSPublicCompanySpace: React.FC<CareerOSPublicCompanySpaceProps> = ({
  companyId,
  onBack,
  onOpenChallenge,
}) => {
  const [company, setCompany] = useState<Partial<CompanyProfile> | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([getCompanyPublicInfo(companyId), fetchJobsByCompany(companyId, 20)])
      .then(([companyInfo, companyJobs]) => {
        if (cancelled) return;
        const nativeJobs = companyJobs.filter((job) => job.listingKind !== 'imported');
        setCompany(companyInfo || null);
        setJobs(nativeJobs.length > 0 ? nativeJobs : companyJobs);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const workspace = useMemo(() => mapCompanyToCareerOSSpace(company, jobs), [company, jobs]);
  const selectedChallenge = useMemo(
    () => workspace.challenges.find((challenge) => challenge.id === selectedChallengeId) || workspace.challenges[0] || null,
    [selectedChallengeId, workspace.challenges],
  );

  const gallery = useMemo(() => {
    const items = Array.isArray(company?.gallery_urls)
      ? company.gallery_urls.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
    return items.slice(0, 3);
  }, [company?.gallery_urls]);

  const logoUrl = String(company?.logo_url || '').trim();
  const headerImage = gallery[0] || selectedChallenge?.coverImageUrl || null;

  return (
    <div className="min-h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="rounded-[32px] border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="px-6 py-6 sm:px-8 lg:px-10 lg:py-10">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700"
              >
                <ArrowLeft size={16} />
                Zpět
              </button>

              <div className="mt-6 flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[20px] border border-slate-200 bg-slate-100">
                  {logoUrl ? (
                    <img src={logoUrl} alt={workspace.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-slate-700">
                      {String(workspace.name || 'CO').slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-800">
                    <Sparkles size={12} />
                    Veřejný prostor firmy
                  </div>
                  <h1 className="mt-3 text-3xl font-bold tracking-[-0.05em] text-slate-950 sm:text-4xl">
                    {workspace.name}
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-700">
                    {workspace.description}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {workspace.location ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
                    <MapPin size={13} />
                    {workspace.location}
                  </span>
                ) : null}
                {workspace.website ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
                    <Globe size={13} />
                    {workspace.website}
                  </span>
                ) : null}
                {workspace.values.slice(0, 3).map((value) => (
                  <span key={value} className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-900">
                    {value}
                  </span>
                ))}
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Otevřené výzvy</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">{workspace.challenges.length}</div>
                </div>
                <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Tón firmy</div>
                  <div className="mt-2 text-sm font-semibold text-slate-950">{workspace.tone || 'Neuvedeno'}</div>
                </div>
                <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Jak působí</div>
                  <div className="mt-2 text-sm font-semibold text-slate-950">{workspace.philosophy || 'Veřejný profil firmy'}</div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 lg:border-l lg:border-t-0">
              {headerImage ? (
                <img src={headerImage} alt={workspace.name} className="h-full min-h-[320px] w-full object-cover" />
              ) : (
                <div className="flex h-full min-h-[320px] items-end bg-[linear-gradient(180deg,#e2f3fb_0%,#f8fafc_100%)] p-8">
                  <div className="max-w-sm rounded-[24px] border border-white/70 bg-white/88 p-5 shadow-sm">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-800">
                      Opravdová firma, opravdové výzvy
                    </div>
                    <div className="mt-3 text-xl font-semibold tracking-[-0.04em] text-slate-950">
                      Kandidát nemá vstupovat do anonymního inzerátu, ale do prostředí, které dává smysl.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
              Vybraná výzva
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
              {selectedChallenge?.title || 'Žádná aktivní výzva'}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              {selectedChallenge?.challengeSummary || 'Tato firma teď nemá zveřejněné žádné aktivní výzvy.'}
            </p>

            {selectedChallenge ? (
              <>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
                    {selectedChallenge.location}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
                    {selectedChallenge.salary}
                  </span>
                  <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-900">
                    {selectedChallenge.sourceLabel}
                  </span>
                </div>

                <div className="mt-5 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">První dojem z výzvy</div>
                  <div className="mt-2 text-sm leading-7 text-slate-700">
                    {selectedChallenge.firstStepPrompt}
                  </div>
                </div>

                {selectedChallenge.topTags.length > 0 ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {selectedChallenge.topTags.map((tag) => (
                      <span key={tag} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => onOpenChallenge(selectedChallenge.id)}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
                >
                  Otevřít výzvu
                  <Sparkles size={15} />
                </button>
              </>
            ) : null}
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                  Otevřené výzvy
                </div>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                  Co si u této firmy můžete rovnou projít
                </h2>
              </div>
            </div>

            {loading ? (
              <div className="mt-6 rounded-[22px] border border-dashed border-slate-200 px-5 py-8 text-sm text-slate-500">
                Načítám veřejný prostor firmy…
              </div>
            ) : workspace.challenges.length === 0 ? (
              <div className="mt-6 rounded-[22px] border border-dashed border-slate-200 px-5 py-8 text-sm text-slate-500">
                Tato firma teď nemá zveřejněné žádné aktivní výzvy.
              </div>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {workspace.challenges.map((challenge) => {
                  const active = selectedChallenge?.id === challenge.id;
                  return (
                    <button
                      key={challenge.id}
                      type="button"
                      onClick={() => setSelectedChallengeId(challenge.id)}
                      className={`rounded-[24px] border p-5 text-left transition ${active ? 'border-cyan-300 bg-cyan-50/70 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                            {challenge.sourceLabel}
                          </div>
                          <div className="mt-2 text-xl font-semibold tracking-[-0.04em] text-slate-950">
                            {challenge.title}
                          </div>
                          <div className="mt-2 text-sm text-slate-600">
                            {challenge.location} · {challenge.salary}
                          </div>
                        </div>
                        <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                          {challenge.jhiScore}
                        </div>
                      </div>

                      <p className="mt-4 text-sm leading-7 text-slate-700">{challenge.challengeSummary}</p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {challenge.topTags.slice(0, 3).map((tag) => (
                          <span key={tag} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-700">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default CareerOSPublicCompanySpace;
