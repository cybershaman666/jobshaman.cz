import React, { useEffect, useState } from 'react';
import { ArrowLeft, Building2, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Job } from '../../types';
import { fetchJobsByCompany } from '../../services/jobService';
import { getCompanyPublicInfo } from '../../services/supabaseService';

interface PublicCompanyProfilePageProps {
  companyId: string;
  onBack: () => void;
  onOpenChallenge: (jobId: string) => void;
}

const PublicCompanyProfilePage: React.FC<PublicCompanyProfilePageProps> = ({
  companyId,
  onBack,
  onOpenChallenge
}) => {
  const { i18n } = useTranslation();
  const [company, setCompany] = useState<any | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const locale = (i18n.language || 'en').split('-')[0].toLowerCase();
  const isCsLike = locale === 'cs' || locale === 'sk';
  const copy = isCsLike
      ? {
        back: 'Zpět',
        companyPage: 'Profil firmy',
        fallbackCompany: 'Firma',
        teamChallenges: 'Týmové výzvy',
        title: 'Otevřené výzvy této firmy',
        loading: 'Načítám veřejné challenge role…',
        empty: 'Tahle firma teď nemá žádné veřejné challenge role.',
        challenge: 'Výzva',
        risk: 'Riziko'
      }
    : {
        back: 'Back',
        companyPage: 'Company page',
        fallbackCompany: 'Company',
        teamChallenges: 'Team challenges',
        title: 'Open challenges from this company',
        loading: 'Loading public challenge roles…',
        empty: 'No public challenge roles are available right now.',
        challenge: 'Challenge',
        risk: 'Risk'
      };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [companyInfo, companyJobs] = await Promise.all([
          getCompanyPublicInfo(companyId),
          fetchJobsByCompany(companyId, 20)
        ]);
        if (!cancelled) {
          const nativeJobs = companyJobs.filter((job) => job.listingKind !== 'imported');
          setCompany(companyInfo);
          setJobs(nativeJobs.length > 0 ? nativeJobs : companyJobs);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 dark:border-slate-800 dark:bg-[#111827] dark:text-slate-200 dark:hover:border-slate-700 dark:hover:text-white"
      >
        <ArrowLeft size={16} />
        {copy.back}
      </button>

      <section className="rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_28%),linear-gradient(155deg,#ffffff_0%,#f8fafc_60%,#eef2ff_100%)] p-6 text-slate-900 shadow-[0_40px_90px_-60px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_28%),linear-gradient(155deg,#111827_0%,#0f172a_60%,#0b1120_100%)] dark:text-slate-100 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              <Building2 size={12} />
              {copy.companyPage}
            </div>
            <h1 className="mt-4 text-4xl font-semibold text-slate-950 dark:text-white">{company?.name || copy.fallbackCompany}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
              {company?.website && <span>{company.website}</span>}
              {(company?.address || company?.legal_address) && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={14} />
                  {company.address || company.legal_address}
                </span>
              )}
            </div>
          </div>
          {company?.registry_info && (
            <div className="max-w-md rounded-[1.25rem] border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-950/30 dark:text-slate-300">
              {company.registry_info}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 text-slate-900 shadow-[0_20px_60px_-48px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-[#111827] dark:text-slate-100">
        <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{copy.teamChallenges}</div>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{copy.title}</h2>

        {loading ? (
          <div className="mt-6 text-sm text-slate-500 dark:text-slate-400">{copy.loading}</div>
        ) : jobs.length === 0 ? (
          <div className="mt-6 rounded-[1.4rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
            {copy.empty}
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {jobs.map((job) => (
              <button
                type="button"
                key={job.id}
                onClick={() => onOpenChallenge(job.id)}
                className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-amber-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-amber-400/40 dark:hover:bg-slate-900"
              >
                <div className="text-lg font-semibold text-slate-950 dark:text-white">{job.title}</div>
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{job.location}{job.salaryRange ? ` · ${job.salaryRange}` : ''}</div>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">{copy.challenge}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{job.challenge}</p>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">{copy.risk}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{job.risk}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default PublicCompanyProfilePage;
