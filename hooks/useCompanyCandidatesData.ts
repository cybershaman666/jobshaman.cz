import { useEffect, useState } from 'react';
import { Candidate, CandidateBenchmarkMetrics } from '../types';
import { fetchCandidateBenchmarkMetrics, fetchCompanyCandidates } from '../services/benchmarkService';
import { supabase } from '../services/supabaseService';

type TranslateFn = (key: string, options?: any) => string;

const parseDateSafe = (value: unknown): Date | null => {
  if (!value) return null;
  const dt = new Date(String(value));
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const estimateExperienceYears = (workHistory: unknown): number => {
  if (!Array.isArray(workHistory) || workHistory.length === 0) return 0;
  let months = 0;
  const now = new Date();
  for (const entry of workHistory as any[]) {
    const fromRaw = entry?.from || entry?.start || entry?.start_date;
    const toRaw = entry?.to || entry?.end || entry?.end_date;
    const start = parseDateSafe(fromRaw);
    const end = parseDateSafe(toRaw) || now;
    if (start && end >= start) {
      const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      months += Math.max(0, diffMonths);
    }
  }
  if (months <= 0) return Math.max(1, workHistory.length);
  return Math.max(1, Math.round(months / 12));
};

const normalizeSkills = (skills: unknown, workHistory: unknown, jobTitle: unknown): string[] => {
  if (Array.isArray(skills)) return skills.filter(Boolean).map((s) => String(s).trim()).filter(Boolean).slice(0, 12);
  if (typeof skills === 'string' && skills.trim()) {
    return skills.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 12);
  }
  const fromHistory = Array.isArray(workHistory)
    ? (workHistory as any[])
      .flatMap((w) => Array.isArray(w?.skills) ? w.skills : [])
      .filter(Boolean)
      .map((s) => String(s).trim())
    : [];
  if (fromHistory.length > 0) return Array.from(new Set(fromHistory)).slice(0, 12);
  const title = String(jobTitle || '').trim();
  return title ? [title] : [];
};

const fetchCompanyCandidatesFallback = async (t: TranslateFn): Promise<Candidate[]> => {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      full_name,
      email,
      role,
      created_at,
      candidate_profiles (
        job_title,
        skills,
        work_history,
        values
      )
    `)
    .eq('role', 'candidate')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    throw error;
  }

  let mapped: Candidate[] = (data || []).map((row: any) => {
    const candidateProfile = Array.isArray(row.candidate_profiles)
      ? row.candidate_profiles[0]
      : row.candidate_profiles;
    const workHistory = Array.isArray(candidateProfile?.work_history) ? candidateProfile.work_history : [];
    const skills = normalizeSkills(candidateProfile?.skills, workHistory, candidateProfile?.job_title);
    const values = Array.isArray(candidateProfile?.values) ? candidateProfile.values : [];
    const fullName = String(row.full_name || '').trim();
    const email = String(row.email || '').trim();
    const derivedName = fullName || email.split('@')[0] || 'Candidate';
    const jobTitle = String(candidateProfile?.job_title || '').trim();

    return {
      id: String(row.id),
      name: derivedName,
      role: jobTitle || t('company.candidates.role_unknown', { defaultValue: 'Uchazeč' }),
      experienceYears: estimateExperienceYears(workHistory),
      salaryExpectation: 0,
      skills,
      bio: t('company.candidates.registered_user_bio', {
        defaultValue: 'Registrovaný uchazeč na JobShaman.',
        name: derivedName
      }),
      flightRisk: 'Medium',
      values
    };
  });

  const lowDataCoverage = mapped.length > 0 && mapped.filter((c) => c.skills.length === 0 || c.experienceYears === 0).length / mapped.length > 0.6;
  if (!lowDataCoverage) {
    return mapped;
  }

  const { data: cpRows, error: cpError } = await supabase
    .from('candidate_profiles')
    .select('id,job_title,skills,work_history,values')
    .limit(500);

  if (cpError || !Array.isArray(cpRows) || cpRows.length === 0) {
    return mapped;
  }

  const ids = cpRows.map((row: any) => row.id).filter(Boolean);
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id,full_name,email,created_at')
    .in('id', ids)
    .limit(500);
  const profileMap = new Map((profileRows || []).map((row: any) => [String(row.id), row]));

  return cpRows.map((cp: any) => {
    const p = profileMap.get(String(cp.id)) || {};
    const workHistory = Array.isArray(cp?.work_history) ? cp.work_history : [];
    const jobTitle = String(cp?.job_title || '').trim();
    const fullName = String((p as any).full_name || '').trim();
    const email = String((p as any).email || '').trim();
    const derivedName = fullName || email.split('@')[0] || 'Candidate';
    return {
      id: String(cp.id),
      name: derivedName,
      role: jobTitle || t('company.candidates.role_unknown', { defaultValue: 'Uchazeč' }),
      experienceYears: estimateExperienceYears(workHistory),
      salaryExpectation: 0,
      skills: normalizeSkills(cp?.skills, workHistory, jobTitle),
      bio: t('company.candidates.registered_user_bio', {
        defaultValue: 'Registrovaný uchazeč na JobShaman.',
        name: derivedName
      }),
      flightRisk: 'Medium',
      values: Array.isArray(cp?.values) ? cp.values : []
    } as Candidate;
  });
};

export const useCompanyCandidatesData = (
  companyId: string | undefined,
  activeTab: string,
  selectedJobId: string,
  t: TranslateFn
) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateBenchmarks, setCandidateBenchmarks] = useState<CandidateBenchmarkMetrics | null>(null);
  const [isLoadingCandidateBenchmarks, setIsLoadingCandidateBenchmarks] = useState(false);
  const [lastCandidatesSyncAt, setLastCandidatesSyncAt] = useState<string | null>(null);

  const refreshCandidateBenchmarks = async () => {
    if (!companyId || (activeTab !== 'candidates' && activeTab !== 'overview')) return;
    setIsLoadingCandidateBenchmarks(true);
    try {
      const data = await fetchCandidateBenchmarkMetrics(companyId, selectedJobId || undefined);
      setCandidateBenchmarks(data);
      setLastCandidatesSyncAt(new Date().toISOString());
    } catch (error) {
      console.warn('Candidate benchmark fetch failed:', error);
      setCandidateBenchmarks(null);
    } finally {
      setIsLoadingCandidateBenchmarks(false);
    }
  };

  const refreshCandidates = async () => {
    if (!companyId || (activeTab !== 'candidates' && activeTab !== 'overview')) return;
    try {
      const backendCandidates = await fetchCompanyCandidates(companyId, 500);
      setCandidates(backendCandidates);
      setLastCandidatesSyncAt(new Date().toISOString());
    } catch (error) {
      console.warn('Candidate API loading failed, trying direct Supabase fallback:', error);
      try {
        const fallbackCandidates = await fetchCompanyCandidatesFallback(t);
        setCandidates(fallbackCandidates);
        setLastCandidatesSyncAt(new Date().toISOString());
      } catch (fallbackError) {
        console.error('Candidate fallback loading failed:', fallbackError);
        setCandidates([]);
      }
    }
  };

  useEffect(() => {
    void refreshCandidateBenchmarks();
  }, [companyId, activeTab, selectedJobId]);

  useEffect(() => {
    void refreshCandidates();
  }, [companyId, activeTab, t]);

  return {
    candidates,
    candidateBenchmarks,
    isLoadingCandidateBenchmarks,
    lastCandidatesSyncAt,
    refreshCandidates,
    refreshCandidateBenchmarks
  };
};
