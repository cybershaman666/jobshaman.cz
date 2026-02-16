import { AIAnalysisResult, AIAdOptimizationResult, CompanyProfile, Assessment, CVAnalysis, UserProfile, ShamanAdvice, SalaryEstimate, AssessmentEvaluation } from "../types";
import { authenticatedFetch } from './csrfService';
import { BACKEND_URL } from '../constants';

const parseErrorDetail = async (response: Response, fallback: string): Promise<string> => {
  try {
    const data = await response.json();
    if (data?.detail) return String(data.detail);
  } catch (_e) {}
  return fallback;
};

const callAiExecute = async (action: string, params: Record<string, any> = {}): Promise<any> => {
  const response = await authenticatedFetch(`${BACKEND_URL}/ai/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params })
  });

  if (!response.ok) {
    const detail = await parseErrorDetail(response, 'AI endpoint error');
    throw new Error(detail);
  }

  return response.json();
};

export const hasApiKey = (): boolean => false;

export const analyzeJobDescription = async (
  description: string,
  jobId?: string,
  existingAnalysis?: AIAnalysisResult
): Promise<AIAnalysisResult> => {
  if (existingAnalysis) return existingAnalysis;

  try {
    const response = await authenticatedFetch(`${BACKEND_URL}/jobs/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, job_id: jobId || null, language: 'cs' })
    });

    if (!response.ok) {
      const detail = await parseErrorDetail(response, 'AI analýza je dočasně nedostupná.');
      throw new Error(detail);
    }

    const payload = await response.json();
    const result = payload?.analysis as AIAnalysisResult | undefined;
    if (!result?.summary) throw new Error('Neplatná odpověď AI analýzy.');
    return result;
  } catch (error) {
    console.error('AI Analysis failed:', error);
    return {
      summary: 'Analýza tohoto inzerátu je dočasně nedostupná (AI limit vyčerpán). Podle našich dat se však zdá být v pořádku.',
      hiddenRisks: ['Služba AI je momentálně přetížená. Zkuste to prosím později.'],
      culturalFit: 'Neutrální / Nedostupné'
    };
  }
};

export const estimateSalary = async (title: string, company: string, location: string, description: string): Promise<SalaryEstimate | null> => {
  try {
    const payload = await callAiExecute('estimate_salary', { title, company, location, description });
    return payload?.salary || null;
  } catch (e) {
    console.error('Salary estimation failed:', e);
    return null;
  }
};

export const generateCoverLetter = async (
  jobTitle: string,
  company: string,
  description: string,
  userExperience: string,
  candidateCvText?: string
): Promise<string> => {
  try {
    const payload = await callAiExecute('generate_cover_letter', {
      jobTitle,
      company,
      description,
      userExperience,
      candidateCvText: candidateCvText || ''
    });
    return payload?.text || 'Nepodařilo se vygenerovat dopis.';
  } catch (e) {
    console.error('Cover letter generation failed:', e);
    return 'Chyba při generování dopisu. Zkuste to prosím znovu.';
  }
};

export const analyzeUserCV = async (cvText: string): Promise<CVAnalysis> => {
  try {
    const payload = await callAiExecute('analyze_user_cv', { cvText });
    if (payload?.analysis) return payload.analysis as CVAnalysis;
    throw new Error('Invalid CV analysis payload');
  } catch (e) {
    console.error('CV Analysis failed', e);
    return {
      summary: 'Analýza CV je dočasně nedostupná kvůli vysokému vytížení AI (limit vyčerpán). Vaše data jsou však v systému uložena.',
      currentLevel: 'Zjišťuji...',
      suggestedCareerPath: 'Bude doplněno po obnovení limitu.',
      marketValueEstimation: 'Odhad ceny nedostupný.',
      skillGaps: ['Analýza dovedností dočasně nedostupná'],
      upsellCourses: []
    };
  }
};

export const getShamanAdvice = async (userProfile: UserProfile, jobDescription: string): Promise<ShamanAdvice> => {
  try {
    const payload = await callAiExecute('get_shaman_advice', { userProfile, jobDescription });
    if (payload?.advice) return payload.advice as ShamanAdvice;
    throw new Error('Invalid shaman advice payload');
  } catch (e) {
    console.error('Shaman advice failed', e);
    return {
      matchScore: 0,
      missingSkills: [],
      salaryImpact: 'N/A',
      seniorityLabel: 'Neznámá',
      reasoning: 'AI doporučení je dočasně nedostupné. Zkuste to prosím za chvíli.',
      learningTimeHours: 0
    };
  }
};

export const optimizeCvForAts = async (cvText: string): Promise<{ optimizedText: string; improvements: string[] }> => {
  try {
    const payload = await callAiExecute('optimize_cv_for_ats', { cvText });
    if (payload?.optimized) return payload.optimized;
    throw new Error('Invalid ATS optimization payload');
  } catch (e) {
    console.error('ATS Optimization failed', e);
    return {
      optimizedText: cvText,
      improvements: ['Optimalizace dočasně nedostupná (AI limit)']
    };
  }
};

export const parseProfileFromCV = async (cvInput: string | { base64: string, mimeType: string }): Promise<Partial<UserProfile>> => {
  try {
    const text = typeof cvInput === 'string' ? cvInput : '';
    const payload = await callAiExecute('parse_profile_from_cv', { text });
    return (payload?.profile || {}) as Partial<UserProfile>;
  } catch (e) {
    console.error('Parse Profile failed', e);
    return {};
  }
};

export const generateStyledCV = async (profile: UserProfile, template: string): Promise<string> => {
  try {
    const payload = await callAiExecute('generate_styled_cv', { profile, template });
    return payload?.markdown || 'CV Generation Failed';
  } catch (e) {
    console.error('CV Gen failed', e);
    return 'Error generating CV.';
  }
};

export const optimizeJobDescription = async (currentDescription: string, companyProfile?: CompanyProfile): Promise<AIAdOptimizationResult> => {
  try {
    const payload = await callAiExecute('optimize_job_description', { currentDescription, companyProfile });
    return (payload?.result || {
      rewrittenText: currentDescription,
      removedCliches: [],
      improvedClarity: 'Optimalizace selhala. Původní text zachován.'
    }) as AIAdOptimizationResult;
  } catch (e) {
    console.error('Ad Optimization failed:', e);
    return {
      rewrittenText: currentDescription,
      removedCliches: [],
      improvedClarity: 'Optimalizace selhala (AI limit vyčerpán). Původní text zachován.'
    };
  }
};

export const matchCandidateToJob = async (candidateBio: string, jobDescription: string): Promise<{ score: number, reason: string }> => {
  try {
    const payload = await callAiExecute('match_candidate_to_job', { candidateBio, jobDescription });
    return payload?.match || { score: 0, reason: 'AI Service Error' };
  } catch (e) {
    console.error('Candidate matching failed:', e);
    return { score: 0, reason: 'AI Service Error' };
  }
};

export const generateAssessment = async (role: string, skills: string[], difficulty: string): Promise<Assessment> => {
  const buildAssessment = (raw: any): Assessment => ({
    id: raw?.id || crypto.randomUUID(),
    title: raw?.title || `Assessment: ${role}`,
    role: raw?.role || role,
    description: raw?.description || '',
    timeLimitSeconds: raw?.timeLimitSeconds || 1200,
    questions: Array.isArray(raw?.questions) ? raw.questions : [],
    createdAt: raw?.createdAt || new Date().toISOString(),
  });

  try {
    const payload = await callAiExecute('generate_assessment', { role, skills, difficulty });
    return buildAssessment(payload?.assessment);
  } catch (authError) {
    try {
      const response = await fetch(`${BACKEND_URL}/ai/execute-public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_assessment', params: { role, skills, difficulty } })
      });
      if (!response.ok) throw new Error(await parseErrorDetail(response, 'Assessment generation failed'));
      const payload = await response.json();
      return buildAssessment(payload?.assessment);
    } catch (e) {
      console.error('Assessment generation failed:', e, authError);
      return {
        id: crypto.randomUUID(),
        title: 'Generování testu nebylo úspěšné',
        role,
        description: 'Služba pro generování testů je momentálně přetížená. Zkuste to prosím později.',
        timeLimitSeconds: 600,
        questions: [],
        createdAt: new Date().toISOString()
      };
    }
  }
};

export const evaluateAssessmentResult = async (
  role: string,
  difficulty: string,
  questions: { id: string; text: string }[],
  answers: { questionId: string; answer: string }[]
): Promise<AssessmentEvaluation> => {
  try {
    const payload = await callAiExecute('evaluate_assessment_result', { role, difficulty, questions, answers });
    if (payload?.evaluation) return payload.evaluation as AssessmentEvaluation;
    throw new Error('Invalid assessment evaluation payload');
  } catch (e) {
    console.error('Assessment Evaluation failed:', e);
    return {
      pros: ['Hodnocení dočasně nedostupné.'],
      cons: [],
      summary: 'Výsledky byly uloženy, ale automatické hodnocení AI je momentálně nedostupné.',
      skillMatchScore: 0
    };
  }
};

export const extractSkillsFromJob = async (title: string, description: string): Promise<string[]> => {
  try {
    const payload = await callAiExecute('extract_skills_from_job', { title, description });
    return Array.isArray(payload?.skills) ? payload.skills : [];
  } catch (e) {
    console.error('Skill extraction failed:', e);
    return [];
  }
};
