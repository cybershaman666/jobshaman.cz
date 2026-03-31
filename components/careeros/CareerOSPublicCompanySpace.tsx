import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Globe, MapPin, Sparkles } from 'lucide-react';

import type { CompanyProfile, Job } from '../../types';
import { fetchJobsByCompany } from '../../services/jobService';
import { getCompanyPublicInfo } from '../../services/supabaseService';
import { mapCompanyToCareerOSSpace } from '../../src/app/careeros/model/viewModels';
import CompanyGalaxyMapShell from '../company/CompanyGalaxyMapShell';

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

  const challengeNodes = useMemo(() => {
    const positions = [
      { x: 22, y: 24 },
      { x: 79, y: 25 },
      { x: 85, y: 53 },
      { x: 73, y: 79 },
      { x: 28, y: 80 },
      { x: 13, y: 52 },
    ];

    return workspace.challenges.slice(0, 6).map((challenge, index) => ({
      id: challenge.id,
      label: challenge.title,
      narrative: `${challenge.location} · ${challenge.salary}`,
      count: challenge.jhiScore,
      x: positions[index].x,
      y: positions[index].y,
      accent: (index === 0 ? 'core' : 'accent') as 'core' | 'accent',
      active: selectedChallenge?.id === challenge.id,
      secondaryLabel: challenge.sourceLabel,
      onClick: () => setSelectedChallengeId(challenge.id),
    }));
  }, [selectedChallenge?.id, workspace.challenges]);

  return (
    <CompanyGalaxyMapShell
      mode="public"
      kicker="Public company space"
      title={workspace.name}
      subtitle={workspace.description}
      center={{
        name: workspace.name,
        motto: workspace.philosophy,
        tone: workspace.tone,
        logoUrl: company?.logo_url || null,
        statusLine: `${workspace.website} · ${workspace.location}`,
        values: workspace.values,
      }}
      layers={[
        { id: 'public-challenge-map', label: 'Challenge Map', active: true },
        { id: 'public-open-waves', label: 'Open Challenges', onClick: () => setSelectedChallengeId(workspace.challenges[0]?.id || null) },
      ]}
      nodes={challengeNodes}
      topActions={
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/88 px-4 py-2.5 text-sm font-medium text-[var(--text-strong)]"
        >
          <ArrowLeft size={16} />
          Back
        </button>
      }
      detailPanel={
        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
              <Sparkles size={12} />
              Public map
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[var(--text-strong)]">
              {selectedChallenge?.title || 'Open challenges'}
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
              {selectedChallenge?.challengeSummary || 'This company does not have live public challenges right now.'}
            </p>
          </div>

          {selectedChallenge ? (
            <div className="rounded-[24px] border border-white/70 bg-white/84 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                Selected challenge
              </div>
              <div className="mt-2 text-base font-semibold text-slate-950">{selectedChallenge.location}</div>
              <div className="mt-1 text-sm text-slate-600">{selectedChallenge.salary}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedChallenge.topTags.map((tag) => (
                  <span key={tag} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700">
                    {tag}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onOpenChallenge(selectedChallenge.id)}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
              >
                Open challenge
                <Sparkles size={15} />
              </button>
            </div>
          ) : null}

          <div className="rounded-[24px] border border-white/70 bg-white/84 p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              <Globe size={12} />
              Philosophy
            </div>
            <div className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{workspace.philosophy}</div>
            <div className="mt-4 flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <MapPin size={14} />
              {workspace.location}
            </div>
          </div>
        </div>
      }
      lowerContent={
        loading ? (
          <div className="p-4 text-sm text-[var(--text-muted)]">Loading company space...</div>
        ) : workspace.challenges.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[rgba(15,23,42,0.12)] p-6 text-sm text-[var(--text-muted)]">
            This company does not have live public challenges right now.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {workspace.challenges.map((challenge) => (
              <button
                key={challenge.id}
                type="button"
                onClick={() => onOpenChallenge(challenge.id)}
                className="rounded-[24px] border border-[rgba(15,23,42,0.08)] bg-white/88 p-5 text-left transition hover:-translate-y-0.5 hover:border-[rgba(var(--accent-rgb),0.26)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">{challenge.sourceLabel}</div>
                    <div className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">{challenge.title}</div>
                    <div className="mt-1 text-sm text-[var(--text-muted)]">{challenge.location} · {challenge.salary}</div>
                  </div>
                  <div className="rounded-full bg-[rgba(var(--accent-rgb),0.12)] px-3 py-1 text-sm font-semibold text-[var(--accent)]">
                    {challenge.jhiScore}
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-[var(--text)]">{challenge.challengeSummary}</p>
              </button>
            ))}
          </div>
        )
      }
    />
  );
};

export default CareerOSPublicCompanySpace;
