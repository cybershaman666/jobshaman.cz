import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  Link as LinkIcon,
  Mail,
  MapPin,
  MoveRight,
  RefreshCw,
  Search,
  Share2,
} from 'lucide-react';

interface CandidatesTabProps {
  candidatesData: any;
}

const formatDate = (value: unknown) => {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' });
};

const getAvatarUrl = (candidate: any) =>
  candidate?.avatar_url ||
  candidate?.avatarUrl ||
  candidate?.candidate_avatar_url ||
  candidate?.photo ||
  candidate?.photo_url ||
  candidate?.image_url ||
  candidate?.profile_photo ||
  candidate?.profile?.photo ||
  candidate?.profile?.avatar_url ||
  null;

const getInitials = (value: string) =>
  String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';

const getCandidateValues = (candidate: any) =>
  Array.isArray(candidate?.values) ? candidate.values.filter(Boolean).slice(0, 4) : [];

const getCandidateSkills = (candidate: any) =>
  Array.isArray(candidate?.skills) ? candidate.skills.filter(Boolean).slice(0, 8) : [];

const getCandidateLinks = (candidate: any) =>
  [candidate?.portfolio, candidate?.portfolio_url, candidate?.linkedin, candidate?.website]
    .map((item) => String(item || '').trim())
    .filter(Boolean);

const getCandidateLocation = (candidate: any) =>
  String(candidate?.location || candidate?.location_public || '').trim() || 'Lokalita zatím není uvedena';

const getCandidateName = (candidate: any) =>
  candidate?.full_name || candidate?.name || candidate?.email || 'Neznámý kandidát';

const getCandidateHeadline = (candidate: any) =>
  candidate?.job_title || candidate?.title || candidate?.role || candidate?.headline || 'Kandidát';

const getCandidateExperienceYears = (candidate: any) => {
  const value = Number(candidate?.experienceYears || 0);
  return Number.isFinite(value) ? value : 0;
};

const getCandidateAssessmentScore = (candidate: any) => {
  const raw = Number(candidate?.assessmentScore ?? candidate?.score ?? candidate?.matchScore ?? candidate?.fitScore ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
};

const buildSkillMatrix = (candidate: any) => {
  const baseScore =
    getCandidateAssessmentScore(candidate) ??
    Math.min(94, 62 + getCandidateSkills(candidate).length * 4 + getCandidateExperienceYears(candidate) * 2);
  return getCandidateSkills(candidate)
    .slice(0, 3)
    .map((skill: string, index: number) => {
      const score = Math.max(52, Math.min(98, baseScore - index * 7));
      return {
        label: skill,
        score,
        tags: getCandidateSkills(candidate)
          .filter((entry: string) => entry !== skill)
          .slice(index, index + 3),
      };
    });
};

const buildTimelineEntries = (candidate: any) => {
  const workHistory = Array.isArray(candidate?.workHistory) ? candidate.workHistory.filter(Boolean) : [];
  if (workHistory.length > 0) {
    return workHistory.slice(0, 4).map((item: any, index: number) => ({
      id: `${candidate.id}-history-${index}`,
      period: [item.startDate || item.start_date || item.from, item.endDate || item.end_date || item.to || 'Současnost']
        .filter(Boolean)
        .join(' — '),
      title: item.title || item.role || 'Role',
      company: item.company || item.companyName || '',
      summary: item.description || item.summary || '',
      tag: Array.isArray(item.skills) ? item.skills[0] : null,
    }));
  }

  const headline = getCandidateHeadline(candidate);
  const bio = String(candidate?.bio || '').trim();
  const createdAt = candidate?.created_at ? formatDate(candidate.created_at) : 'Současnost';

  return [
    {
      id: `${candidate.id}-current`,
      period: createdAt,
      title: headline,
      company: '',
      summary: bio || 'Profil kandidáta je aktivní, ale ověřená pracovní historie ještě není kompletní.',
      tag: getCandidateSkills(candidate)[0] || null,
    },
  ];
};

const buildInternalNotes = (candidate: any) => {
  const values = getCandidateValues(candidate);
  const notes: Array<{ author: string; time: string; body: string }> = [];
  const bio = String(candidate?.bio || '').trim();
  if (bio) {
    notes.push({
      author: 'Profilový signál',
      time: candidate?.created_at ? formatDate(candidate.created_at) : 'Nedávno',
      body: bio,
    });
  }
  if (values.length > 0) {
    notes.push({
      author: 'Pracovni preference',
      time: 'Ted',
      body: `Kandidát už teď naznačuje pracovní preference kolem témat: ${values.join(', ')}.`,
    });
  }
  return notes;
};

export const CandidatesTab: React.FC<CandidatesTabProps> = ({ candidatesData }) => {
  const { t } = useTranslation();
  const candidates = candidatesData?.candidates || [];
  const loading = candidatesData?.isLoading || candidatesData?.isLoadingCandidateBenchmarks;
  const refreshCandidates = candidatesData?.refreshCandidates || (() => {});
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedCandidateId, setSelectedCandidateId] = React.useState<string | null>(null);
  const [brokenAvatars, setBrokenAvatars] = React.useState<Record<string, boolean>>({});

  const filtered = React.useMemo(() => {
    if (!searchTerm) return candidates;
    const query = searchTerm.toLowerCase();
    return candidates.filter((candidate: any) => {
      const haystack = [
        getCandidateName(candidate),
        candidate?.email,
        getCandidateHeadline(candidate),
        candidate?.headline,
        candidate?.bio,
        ...(Array.isArray(candidate?.skills) ? candidate.skills : []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [candidates, searchTerm]);

  React.useEffect(() => {
    if (filtered.length === 0) {
      setSelectedCandidateId(null);
      return;
    }
    if (!selectedCandidateId || !filtered.some((candidate: any) => String(candidate.id) === String(selectedCandidateId))) {
      setSelectedCandidateId(String(filtered[0].id));
    }
  }, [filtered, selectedCandidateId]);

  const markAvatarBroken = React.useCallback((candidateId: string) => {
    setBrokenAvatars((prev) => ({ ...prev, [candidateId]: true }));
  }, []);

  const selectedCandidate = filtered.find((candidate: any) => String(candidate.id) === String(selectedCandidateId)) || filtered[0] || null;

  if (loading && candidates.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw size={24} className="animate-spin text-slate-400" />
        <span className="ml-3 text-sm text-slate-500 dark:text-slate-400">
          {t('company.candidates.loading', { defaultValue: 'Načítám kandidáty…' })}
        </span>
      </div>
    );
  }

  if (!selectedCandidate) {
    return (
      <div className="rounded-[32px] border border-dashed border-slate-300 bg-white/75 p-14 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-400">
        {searchTerm
          ? t('company.candidates.no_match', { defaultValue: 'Zadanému hledání neodpovídá žádný kandidát.' })
          : t('company.candidates.empty', { defaultValue: 'Talent pool je zatím prázdný.' })}
      </div>
    );
  }

  const displayName = getCandidateName(selectedCandidate);
  const headline = getCandidateHeadline(selectedCandidate);
  const avatarUrl = brokenAvatars[String(selectedCandidate.id)] ? null : getAvatarUrl(selectedCandidate);
  const skills = getCandidateSkills(selectedCandidate);
  const links = getCandidateLinks(selectedCandidate);
  const values = getCandidateValues(selectedCandidate);
  const skillMatrix = buildSkillMatrix(selectedCandidate);
  const timelineEntries = buildTimelineEntries(selectedCandidate);
  const internalNotes = buildInternalNotes(selectedCandidate);
  const assessmentScore =
    getCandidateAssessmentScore(selectedCandidate) ?? Math.min(96, 64 + skills.length * 4 + getCandidateExperienceYears(selectedCandidate) * 2);
  const nextStep =
    skills.length >= 3
      ? t('company.candidates.next_step_schedule', { defaultValue: 'Naplánovat interview' })
      : t('company.candidates.next_step_signal', { defaultValue: 'Doplnit další signál' });

  return (
    <div className="space-y-5 pb-8">
      <section className="rounded-[28px] border border-slate-200 bg-white px-5 py-4 shadow-[0_20px_54px_-42px_rgba(15,23,42,0.16)] dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-sm text-slate-400 dark:text-slate-500">
              {t('company.candidates.breadcrumb', { defaultValue: 'Talent pool' })} <span className="mx-2">›</span>{' '}
              {t('company.candidates.profile', { defaultValue: 'Profil kandidáta' })}
            </div>
            <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
              {t('company.candidates.workspace_title', { defaultValue: 'Rozhodovací prostor kandidáta' })}
            </h2>
          </div>

          <div className="flex w-full max-w-2xl items-center gap-3">
            <div className="relative flex-1">
              <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t('company.candidates.search', { defaultValue: 'Hledat podle jména, e-mailu, skillů nebo role…' })}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <div className="hidden rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-600 lg:block dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
              {filtered.length} {t('company.candidates.results', { defaultValue: 'výsledků' })}
            </div>
            <button
              onClick={() => refreshCandidates()}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RefreshCw size={15} />
              {t('company.candidates.refresh', { defaultValue: 'Obnovit' })}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[292px_minmax(0,1fr)]">
        <aside className="rounded-[28px] border border-slate-200 bg-white p-3.5 shadow-[0_20px_54px_-42px_rgba(15,23,42,0.16)] dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                {t('company.candidates.list_title', { defaultValue: 'Kandidáti' })}
              </div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {filtered.length} {t('company.candidates.results', { defaultValue: 'výsledků' })}
              </div>
            </div>
          </div>

              <div className="max-h-[760px] space-y-2 overflow-y-auto pr-1">
            {filtered.map((candidate: any) => {
              const active = String(candidate.id) === String(selectedCandidateId);
              const candidateId = String(candidate.id);
              const candidateAvatarUrl = brokenAvatars[candidateId] ? null : getAvatarUrl(candidate);
              return (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => setSelectedCandidateId(String(candidate.id))}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                    active
                      ? 'border-[rgba(var(--accent-rgb),0.18)] bg-[var(--accent-soft)] shadow-sm'
                      : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800/40'
                  }`}
                >
                  <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {candidateAvatarUrl ? (
                      <img
                        src={candidateAvatarUrl}
                        alt={getCandidateName(candidate)}
                        className="h-full w-full object-cover"
                        onError={() => markAvatarBroken(candidateId)}
                      />
                    ) : (
                      getInitials(getCandidateName(candidate))
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{getCandidateName(candidate)}</div>
                    <div className="truncate text-xs text-slate-500 dark:text-slate-400">{getCandidateHeadline(candidate)}</div>
                    <div className="mt-1 truncate text-[11px] text-slate-400 dark:text-slate-500">{candidate.email || getCandidateLocation(candidate)}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="space-y-6">
          <section className="grid gap-6 xl:grid-cols-[1.65fr_0.95fr]">
            <div className="space-y-6">
              <div className="rounded-[28px] border border-slate-200 bg-white px-4 py-4 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.16)] dark:border-slate-800 dark:bg-slate-900">
                <div className="grid gap-4 xl:grid-cols-[144px_minmax(0,1fr)_auto] xl:items-center">
                  <div className="relative h-[140px] w-[120px] overflow-hidden rounded-[24px] border border-slate-200 bg-slate-100 shadow-sm dark:border-slate-800 dark:bg-slate-800">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={displayName}
                        className="h-full w-full object-cover"
                        onError={() => markAvatarBroken(String(selectedCandidate.id))}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-4xl font-semibold text-slate-500 dark:text-slate-300">
                        {getInitials(displayName)}
                      </div>
                    )}
                    <button className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-[0_18px_36px_-24px_rgba(15,155,184,0.35)]">
                      <Share2 size={16} />
                    </button>
                  </div>

                  <div>
                    <div className="inline-flex rounded-full bg-[var(--accent-soft)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                      {t('company.candidates.active', { defaultValue: 'Aktivní' })}
                    </div>
                    <h1 className="mt-3 text-[32px] font-semibold leading-[0.92] tracking-[-0.06em] text-slate-950 dark:text-white">{displayName}</h1>
                    <div className="mt-2.5 max-w-2xl text-[15px] font-medium leading-7 text-[var(--accent)]">{headline}</div>

                    <div className="mt-5 space-y-3 text-[14px] text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-3">
                        <MapPin size={16} />
                        {getCandidateLocation(selectedCandidate)}
                      </div>
                      <div className="flex items-center gap-3">
                        <Mail size={16} />
                        {selectedCandidate.email || 'E-mail zatím není uvedený'}
                      </div>
                      {links[0] ? (
                        <div className="flex items-center gap-3">
                          <LinkIcon size={16} />
                          <a href={links[0]} target="_blank" rel="noreferrer" className="truncate text-[var(--accent)] hover:underline">
                            {links[0]}
                          </a>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5 xl:items-end">
                    <button className="rounded-[18px] bg-rose-50 px-5 py-3 text-sm font-medium text-rose-700 transition hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-300">
                      {t('company.candidates.reject', { defaultValue: 'Zamitnout' })}
                    </button>
                    <button className="rounded-[18px] border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800">
                      {t('company.candidates.schedule', { defaultValue: 'Naplánovat interview' })}
                    </button>
                    <button className="rounded-[18px] bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-[0_20px_42px_-26px_rgba(15,155,184,0.35)] transition hover:bg-[var(--accent-dark)]">
                      {t('company.candidates.move_next', { defaultValue: 'Posunout do další fáze' })}
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.16)] dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-[18px] font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
                      {t('company.candidates.skill_matrix', { defaultValue: 'Matice dovednosti' })}
                    </h3>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      {t('company.candidates.skill_matrix_copy', { defaultValue: 'Porovnání ověřeného signálu s tím, co dnes ukazuje profil kandidáta.' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-6 text-[11px] font-semibold uppercase tracking-[0.16em]">
                    <span className="flex items-center gap-2 text-[var(--accent)]">
                      <span className="h-3 w-3 rounded-full bg-[var(--accent)]" />
                      {t('company.candidates.verified', { defaultValue: 'Ověřený signál' })}
                    </span>
                    <span className="flex items-center gap-2 text-slate-400">
                      <span className="h-3 w-3 rounded-full bg-slate-300" />
                      {t('company.candidates.self_reported', { defaultValue: 'Profil kandidáta' })}
                    </span>
                  </div>
                </div>

                <div className="mt-8 space-y-10">
                  {skillMatrix.length > 0 ? (
                    skillMatrix.map((item: { label: string; score: number; tags: string[] }) => (
                      <div key={item.label}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-slate-900 dark:text-white">{item.label}</div>
                          <div className="text-[15px] font-medium text-[var(--accent)]">{(item.score / 10).toFixed(1)} / 10</div>
                        </div>
                        <div className="mt-3 h-4 rounded-full bg-slate-100 dark:bg-slate-800">
                          <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${item.score}%` }} />
                        </div>
                        {item.tags.length > 0 ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {item.tags.map((tag: string) => (
                              <span key={`${item.label}-${tag}`} className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      {t('company.candidates.no_skills', { defaultValue: 'Zatím nemáme dost signálů k vyhodnocení dovedností.' })}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.16)] dark:border-slate-800 dark:bg-slate-900">
                <h3 className="text-[18px] font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
                  {t('company.candidates.skill_evolution', { defaultValue: 'Vyvoj zkusenosti' })}
                </h3>

                <div className="mt-8 space-y-8">
                  {timelineEntries.map((entry: { id: string; period: string; title: string; company: string; summary: string; tag: string | null }, index: number) => (
                    <div key={entry.id} className="relative pl-14">
                      {index !== timelineEntries.length - 1 ? <div className="absolute left-[18px] top-11 h-[calc(100%+18px)] w-px bg-slate-200 dark:bg-slate-700" /> : null}
                      <div className="absolute left-0 top-1 flex h-9 w-9 items-center justify-center rounded-full border-4 border-white bg-[var(--accent-soft)] text-[var(--accent)] shadow-sm dark:border-slate-900">
                        <MoveRight size={15} />
                      </div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">{entry.period}</div>
                      <div className="mt-2 text-[17px] font-semibold text-slate-950 dark:text-white">
                        {entry.title}
                        {entry.company ? <span className="font-normal text-slate-400"> @ {entry.company}</span> : null}
                      </div>
                      <div className="mt-3 max-w-2xl text-[15px] leading-8 text-slate-600 dark:text-slate-400">{entry.summary}</div>
                      {entry.tag ? (
                        <div className="mt-4">
                          <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-[11px] font-medium text-[var(--accent)]">+ {entry.tag}</span>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <aside className="space-y-6">
              <div className="rounded-[28px] border border-[rgba(var(--accent-rgb),0.18)] bg-[linear-gradient(180deg,var(--accent)_0%,var(--accent-dark)_100%)] px-5 py-5 text-white shadow-[0_28px_62px_-34px_rgba(15,155,184,0.35)]">
                <div className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/82">
                  {t('company.candidates.assessment_feedback', { defaultValue: 'Zpětná vazba z hodnocení' })}
                </div>
                <div className="mt-8 space-y-6">
                  <div className="flex items-center justify-between text-[15px]">
                    <span className="text-white/76">{t('company.candidates.cognitive_fit', { defaultValue: 'Kognitivni shoda' })}</span>
                    <span className="text-[18px] font-semibold">{assessmentScore}%</span>
                  </div>
                  <div className="flex items-center justify-between text-[15px]">
                    <span className="text-white/76">{t('company.candidates.tech_proficiency', { defaultValue: 'Odborna uroven' })}</span>
                    <span className="text-[18px] font-semibold">
                      {skills.length >= 4
                        ? t('company.candidates.superior', { defaultValue: 'Silna' })
                        : skills.length >= 2
                          ? t('company.candidates.strong', { defaultValue: 'Dobra' })
                          : t('company.candidates.emerging', { defaultValue: 'Rozviji se' })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[15px]">
                    <span className="text-white/76">{t('company.candidates.growth_mindset', { defaultValue: 'Rustovy potencial' })}</span>
                    <span className="text-[18px] font-semibold">★★★★★</span>
                  </div>
                </div>

                <div className="mt-8 rounded-[24px] border border-white/12 bg-white/8 px-5 py-5 backdrop-blur-sm">
                  <p className="text-[15px] leading-8 text-white/92">
                    {selectedCandidate.bio
                      ? `"${selectedCandidate.bio}"`
                      : t('company.candidates.feedback_placeholder', {
                           defaultValue: 'Profil je už teď velmi relevantní pro aktuální hiring cíl. Další nejlepší krok je ověřit úsudek a komunikaci v živém setkání.',
                        })}
                  </p>
                  <div className="mt-4 text-sm text-white/68">— {t('company.candidates.feedback_source', { defaultValue: 'Souhrn hiring signálů' })}</div>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.16)] dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[18px] font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                    {t('company.candidates.internal_notes', { defaultValue: 'Interni poznamky' })}
                  </h3>
                  <button className="text-sm font-medium text-[var(--accent)] hover:underline">
                    {t('company.candidates.add_note', { defaultValue: 'Pridat poznamku' })}
                  </button>
                </div>

                <div className="mt-5 space-y-4">
                  {internalNotes.length > 0 ? (
                    internalNotes.map((note) => (
                      <div key={`${note.author}-${note.time}`} className="rounded-[24px] bg-slate-50 px-4 py-4 dark:bg-slate-800/60">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[11px] font-semibold text-[var(--accent)]">
                              {getInitials(note.author)}
                            </div>
                            <div className="text-sm font-medium text-slate-900 dark:text-white">{note.author}</div>
                          </div>
                          <div className="text-xs text-slate-400">{note.time}</div>
                        </div>
                        <div className="mt-3 text-[15px] leading-8 text-slate-600 dark:text-slate-400">{note.body}</div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      {t('company.candidates.no_internal_notes', { defaultValue: 'Zatim tu nejsou zadne interni poznamky.' })}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50/65 px-5 py-6 text-center dark:border-slate-700 dark:bg-slate-900/60">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  <CheckCircle2 size={24} />
                </div>
                <h3 className="mt-5 text-[18px] font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
                  {t('company.candidates.next_milestone', { defaultValue: 'Další milník' })}
                </h3>
                <p className="mt-3 text-[15px] leading-8 text-slate-500 dark:text-slate-400">
                  {t('company.candidates.next_milestone_copy', {
                    defaultValue: 'Posuňte kandidáta do dalšího ověřeného kroku ve chvíli, kdy má tým ještě čerstvý kontext a rozhodování nebude stát.',
                  })}
                </p>
                <button className="mt-7 inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
                  {nextStep}
                </button>
              </div>

              {values.length > 0 ? (
                <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.16)] dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-[18px] font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                    {t('company.candidates.working_values', { defaultValue: 'Pracovni preference' })}
                  </h3>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {values.map((value: string) => (
                      <span key={value} className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-[12px] font-medium text-[var(--accent)]">
                        {value}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </aside>
          </section>
        </div>
      </section>
    </div>
  );
};
