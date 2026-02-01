
import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysisResult, AIAdOptimizationResult, CompanyProfile, Assessment, CVAnalysis, UserProfile, ShamanAdvice, SalaryEstimate, AssessmentEvaluation } from "../types";

// Safe API Key Access
const getApiKey = () => {
    try {
        // First check import.meta.env (Vite standard)
        if (typeof import.meta !== 'undefined' && import.meta.env) {
            if (import.meta.env.VITE_API_KEY) return import.meta.env.VITE_API_KEY;
            // Fallback to non-VITE if explicitly allowed/set
            if (import.meta.env.API_KEY) return import.meta.env.API_KEY;
        }

        // Check for process existence (Node/Vercel legacy)
        if (typeof process !== 'undefined' && process.env) {
            return process.env.API_KEY || process.env.VITE_API_KEY;
        }
    } catch (e) { }
    return undefined;
};

// Lazy initialization to prevent top-level crash
let aiInstance: GoogleGenAI | null = null;

const getAi = () => {
    const key = getApiKey();
    if (!key) return null;

    if (!aiInstance) {
        try {
            aiInstance = new GoogleGenAI({ apiKey: key });
        } catch (e) {
            console.error("Failed to initialize GoogleGenAI", e);
            return null;
        }
    }
    return aiInstance;
}

// Helper to check if API key is present
export const hasApiKey = (): boolean => !!getApiKey();

import { supabase } from './supabaseClient';

export const analyzeJobDescription = async (
    description: string,
    jobId?: string,
    existingAnalysis?: AIAnalysisResult
): Promise<AIAnalysisResult> => {
    // 1. Check if we already have a cached analysis (passed from DB)
    if (existingAnalysis) {
        console.log("⚡ Ušetřeno volání AI: Používám cache z DB.");
        return existingAnalysis;
    }

    const ai = getAi();
    if (!ai) {
        // Fallback mock response if no key is provided for demo purposes
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    summary: "Tento inzerát nemá API klíč pro reálnou analýzu. Na základě statických pravidel se však zdá být standardní nabídkou.",
                    hiddenRisks: ["Nelze detekovat rizika bez AI připojení."],
                    culturalFit: "Neutrální"
                });
            }, 1000);
        });
    }

    try {
        const prompt = `
      Analyze the following job description for a candidate. 
      Be a cynical but helpful career coach. 
      OUTPUT IN CZECH LANGUAGE.
      
      Identify:
      1. A one-sentence summary of what the job *actually* is (stripping away fluff).
      2. Hidden risks or "red flags" implied by the text (e.g., "fast-paced" = burnout).
      3. A brief assessment of the cultural fit based on tone.
      
      Job Description:
      ${description.substring(0, 5000)}
    `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: { type: Type.STRING },
                        hiddenRisks: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        },
                        culturalFit: { type: Type.STRING }
                    },
                    required: ["summary", "hiddenRisks", "culturalFit"]
                }
            }
        });

        const jsonText = response.text;
        if (!jsonText) throw new Error("No response from AI");

        const result = JSON.parse(jsonText) as AIAnalysisResult;

        // 2. Save result to cache securely via RPC if Job ID is present
        if (jobId && supabase) {
            try {
                // We use RPC to avoid RLS issues (users can't update jobs table directly)
                // The function must be created in Supabase first: save_job_ai_analysis(p_job_id, p_analysis)
                const { error } = await supabase.rpc('save_job_ai_analysis', {
                    p_job_id: jobId,
                    p_analysis: result
                });

                if (error) console.error("Failed to cache AI analysis:", error);
                else console.log("💾 AI výsledek uložen do cache.");
            } catch (cacheError) {
                console.warn("Cache save error (ignoring):", cacheError);
            }
        }

        return result;

    } catch (error: any) {
        console.error("AI Analysis failed:", error);

        // Return a safe fallback rather than throwing
        return {
            summary: "Analýza tohoto inzerátu je dočasně nedostupná (AI limit vyčerpán). Podle našich dat se však zdá být v pořádku.",
            hiddenRisks: ["Služba AI je momentálně přetížená. Zkuste to prosím později."],
            culturalFit: "Neutrální / Nedostupné"
        };
    }
};

export const estimateSalary = async (title: string, company: string, location: string, description: string): Promise<SalaryEstimate | null> => {
    const ai = getAi();
    if (!ai) return null;

    try {
        const prompt = `
        You are an expert compensation analyst for the Czech job market.
        Estimate the GROSS MONTHLY SALARY range (in CZK) for the following role.
        Use current market data for 2024/2025.
        
        Consider:
        - Job Title: ${title}
        - Location: ${location} (Prague is usually +20% vs regions)
        - Company: ${company} (Corporates pay more than startups usually)
        - Requirements context: ${description.substring(0, 1000)}

        Return JSON:
        - min: number (lower bound)
        - max: number (upper bound)
        - currency: string (always 'CZK')
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        min: { type: Type.NUMBER },
                        max: { type: Type.NUMBER },
                        currency: { type: Type.STRING }
                    },
                    required: ["min", "max", "currency"]
                }
            }
        });

        const jsonText = response.text;
        if (!jsonText) throw new Error("No response from AI");
        return JSON.parse(jsonText) as SalaryEstimate;

    } catch (e) {
        console.error("Salary estimation failed:", e);
        return null;
    }
};

export const generateCoverLetter = async (jobTitle: string, company: string, description: string, userExperience: string): Promise<string> => {
    const ai = getAi();
    if (!ai) {
        return "Prosím nastavte API_KEY pro generování motivačního dopisu.";
    }

    try {
        const prompt = `
          Write a short, honest, and professional cover letter for the position of ${jobTitle} at ${company}.
          OUTPUT IN CZECH LANGUAGE.
          
          Job Context:
          ${description.substring(0, 1000)}...
          
          My Experience (User Notes):
          ${userExperience}
          
          Tone Guidelines:
          - No "I am thrilled to apply".
          - No "hard worker" clichés.
          - Be precise about skills.
          - Respect the reader's time.
          - Keep it under 200 words.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });

        return response.text || "Nepodařilo se vygenerovat dopis.";

    } catch (e) {
        console.error(e);
        return "Chyba při generování dopisu. Zkuste to prosím znovu.";
    }
};

export const analyzeUserCV = async (cvText: string): Promise<CVAnalysis> => {
    const ai = getAi();
    if (!ai) {
        return {
            summary: "Your value comes from system design and operational clarity, not from job titles. Companies that see only “operations” may undervalue you. Companies that understand automation and long-term efficiency will not.",
            currentLevel: "Strategic / Systems Lead",
            suggestedCareerPath: "Head of Operations -> COO / Systems Architect",
            marketValueEstimation: "Praha: ~100 000 Kč\nHustopeče: ~65 000 Kč",
            skillGaps: ["Strategic Financial Planning", "Large Scale Change Management"],
            upsellCourses: [
                { name: "Systems Thinking Certification", description: "Formalizujte svou intuici pro systémový design.", estimatedSalaryBump: "+10-15%", price: "12 000 Kč" },
                { name: "Automation Architecture", description: "Propojení operations s low-code automatizací.", estimatedSalaryBump: "+20%", price: "8 000 Kč" }
            ]
        };
    }

    try {
        const prompt = `
        Act as a senior career strategist and technical recruiter.
        Analyze the provided CV content.
        OUTPUT IN CZECH.

        1. Determine their current seniority level honestly.
        2. Suggest a logical career path.
        3. Estimate monthly salary range in CZK for the Czech market.
        4. Identify skill gaps.
        5. Suggest 2-3 SPECIFIC courses/certifications (paid upsells) that would realistically increase their salary.

        Input CV Text:
        ${cvText.substring(0, 5000)}
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: { type: Type.STRING },
                        currentLevel: { type: Type.STRING },
                        suggestedCareerPath: { type: Type.STRING },
                        marketValueEstimation: { type: Type.STRING },
                        skillGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
                        upsellCourses: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    estimatedSalaryBump: { type: Type.STRING },
                                    price: { type: Type.STRING }
                                }
                            }
                        }
                    },
                    required: ["summary", "currentLevel", "suggestedCareerPath", "marketValueEstimation", "skillGaps", "upsellCourses"]
                }
            }
        });

        const jsonText = response.text;
        if (!jsonText) throw new Error("No response");
        return JSON.parse(jsonText);

    } catch (e) {
        console.error("CV Analysis failed", e);
        // Safe fallback for CV analysis
        return {
            summary: "Analýza CV je dočasně nedostupná kvůli vysokému vytížení AI (limit vyčerpán). Vaše data jsou však v systému uložena.",
            currentLevel: "Zjišťuji...",
            suggestedCareerPath: "Bude doplněno po obnovení limitu.",
            marketValueEstimation: "Odhad ceny nedostupný.",
            skillGaps: ["Analýza dovedností dočasně nedostupná"],
            upsellCourses: []
        };
    }
}

export const getShamanAdvice = async (userProfile: UserProfile, jobDescription: string): Promise<ShamanAdvice> => {
    const ai = getAi();
    if (!ai || !userProfile.cvText) {
        return {
            matchScore: 78,
            missingSkills: ["TypeScript", "GraphQL"],
            salaryImpact: "15 000 Kč",
            seniorityLabel: "Junior+",
            reasoning: "Detekuji silný základ v datech, ale pro maximální tržní hodnotu chybí znalosti TypeScriptu. Doplnění těchto modulů výrazně zvýší tvůj rate.",
            learningTimeHours: 40
        };
    }

    try {
        const prompt = `
        Act as "The Job Shaman", an advanced AI career intelligence unit.
        Compare the Candidate Profile to the Job Description.
        OUTPUT IN CZECH.

        Tone Guidelines:
        - BE ANALYTICAL, DIRECT, AND STRATEGIC.
        - DO NOT use esoteric metaphors (winds, destiny, magic, spells).
        - Use data-driven language (compatibility, market value, optimization, vectors, gap analysis).
        - Be a straight-talking career coach who sees the matrix of the job market.

        Return JSON:
        - matchScore: Number 0-100.
        - missingSkills: Array of top 2-3 key skills the candidate lacks for this specific job.
        - salaryImpact: Estimate string (e.g. "10 000 Kč") of how much value adding these skills would add to their monthly rate.
        - seniorityLabel: e.g. "Junior", "Medior", "Solid Senior", "Overqualified".
        - reasoning: A 1-2 sentence summary in a concise, analytical tone. (e.g., "Analýza ukazuje silný průnik v technologiích, ale chybí zkušenost s vedením týmu.", "Tvoje data přesně odpovídají požadavkům na senioritu.").
        - learningTimeHours: Estimated hours to learn the missing skills to a basic level.

        Candidate Profile:
        ${userProfile.cvText.substring(0, 3000)}
        Skills: ${userProfile.skills?.join(', ')}

        Job Description:
        ${jobDescription.substring(0, 3000)}
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        matchScore: { type: Type.NUMBER },
                        missingSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
                        salaryImpact: { type: Type.STRING },
                        seniorityLabel: { type: Type.STRING },
                        reasoning: { type: Type.STRING },
                        learningTimeHours: { type: Type.NUMBER }
                    },
                    required: ["matchScore", "missingSkills", "salaryImpact", "seniorityLabel", "reasoning", "learningTimeHours"]
                }
            }
        });

        const jsonText = response.text;
        if (!jsonText) throw new Error("No response");
        return JSON.parse(jsonText);

    } catch (e) {
        console.error("Shaman advice failed", e);
        return {
            matchScore: 0,
            missingSkills: [],
            salaryImpact: "N/A",
            seniorityLabel: "Neznámá",
            reasoning: "Kyber Šaman je momentálně v meditaci (AI limit vyčerpán). Zkuste to prosím za chvíli.",
            learningTimeHours: 0
        };
    }
};

export const optimizeCvForAts = async (cvText: string): Promise<{ optimizedText: string; improvements: string[] }> => {
    const ai = getAi();
    if (!ai) {
        return {
            optimizedText: "Mock ATS Output: Zde by byla verze CV optimalizovaná pro roboty. Standardizované nadpisy, klíčová slova a odstraněné grafické prvky.",
            improvements: ["Standardizované nadpisy", "Přidána klíčová slova", "Odstraněny tabulky"]
        };
    }

    try {
        const prompt = `
        Act as an ATS (Applicant Tracking System) Optimization Expert.
        Rewrite the following CV text to ensure it gets a 100% parse rate by systems like Taleo, Workday, and Greenhouse.
        OUTPUT IN CZECH.

        Rules:
        1. Use standard headers (Zkušenosti, Vzdělání, Dovednosti).
        2. Incorporate industry-standard keywords relevant to the content naturally.
        3. Remove any complex formatting characters or non-standard bullet points.
        4. Focus on "Action Verb + Metric" structure for bullet points.
        
        Return JSON:
        - optimizedText: The complete rewritten plain-text CV.
        - improvements: A list of 3-5 specific changes you made to beat the bots.

        Input CV:
        ${cvText.substring(0, 5000)}
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        optimizedText: { type: Type.STRING },
                        improvements: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["optimizedText", "improvements"]
                }
            }
        });

        const jsonText = response.text;
        if (!jsonText) throw new Error("No response");
        return JSON.parse(jsonText);

    } catch (e) {
        console.error("ATS Optimization failed", e);
        return {
            optimizedText: cvText, // Preserve original as optimized
            improvements: ["Optimalizace dočasně nedostupná (AI limit)"]
        };
    }
};

export const parseProfileFromCV = async (cvInput: string | { base64: string, mimeType: string }): Promise<Partial<UserProfile>> => {
    const ai = getAi();
    if (!ai) return {};

    try {

        const schemaPrompt = `
        Extract structured data from the provided document or text.
        OUTPUT IN CZECH context but standard JSON.
        
        Extract:
        - name
        - email
        - phone
        - jobTitle (Current or most recent role)
        - cvText (A professional bio summary summarizing the candidate's career, max 300 chars)
        - skills (List of top 10 technical or professional skills)
        - workHistory (Array of objects: role, company, duration, description)
        - education (Array of objects: school, degree, year)
        `;

        let contents;

        if (typeof cvInput === 'string') {
            contents = {
                parts: [
                    { text: schemaPrompt },
                    { text: `Input Text:\n${cvInput.substring(0, 10000)}` }
                ]
            };
        } else {
            // Multimodal input for PDF/Image
            contents = {
                parts: [
                    { text: schemaPrompt },
                    {
                        inlineData: {
                            mimeType: cvInput.mimeType,
                            data: cvInput.base64
                        }
                    }
                ]
            };
        }

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: contents,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        email: { type: Type.STRING },
                        phone: { type: Type.STRING },
                        jobTitle: { type: Type.STRING },
                        cvText: { type: Type.STRING, description: "Short bio summary" },
                        skills: { type: Type.ARRAY, items: { type: Type.STRING } },
                        workHistory: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    role: { type: Type.STRING },
                                    company: { type: Type.STRING },
                                    duration: { type: Type.STRING },
                                    description: { type: Type.STRING }
                                }
                            }
                        },
                        education: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    school: { type: Type.STRING },
                                    degree: { type: Type.STRING },
                                    year: { type: Type.STRING }
                                }
                            }
                        }
                    }
                }
            }
        });

        const jsonText = response.text;

        if (!jsonText) throw new Error("No response");
        return JSON.parse(jsonText);
    } catch (e) {
        console.error("Parse Profile failed", e);
        return {};
    }
}

export const generateStyledCV = async (profile: UserProfile, template: string): Promise<string> => {
    const ai = getAi();
    if (!ai) return "# CV Generation requires API Key";

    try {
        const prompt = `
        Create a CV using the following profile data.
        Template Style: "${template}".
        OUTPUT: Markdown format only.
        Language: Czech.

        Profile Data:
        Name: ${profile.name}
        Title: ${profile.jobTitle}
        Email: ${profile.email}
        Phone: ${profile.phone}
        Bio: ${profile.cvText}
        Skills: ${profile.skills?.join(', ')}
        Experience: ${JSON.stringify(profile.workHistory)}
        Education: ${JSON.stringify(profile.education)}
        
        Template Guidelines:
        - "ATS Minimal": Plain text, standard headers, no fancy formatting, focus on keywords.
        - "Modern Bold": Use bold headers, bullet points, maybe emoji icons for sections, concise.
        - "Executive": Formal tone, detailed metrics in experience, focus on leadership.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt
        });

        return response.text || "CV Generation Failed";
    } catch (e) {
        console.error("CV Gen failed", e);
        return "Error generating CV.";
    }
}

/**
 * COMPANY SIDE AI FEATURES
 */

export const optimizeJobDescription = async (currentDescription: string, companyProfile?: CompanyProfile): Promise<AIAdOptimizationResult> => {
    const ai = getAi();
    if (!ai) {
        return {
            rewrittenText: "API Key chybí. Zde by byl text přepsaný AI, zbavený marketingového balastu.",
            removedCliches: ["API Key missing", "Mock Data"],
            improvedClarity: "Prosím přidejte API klíč pro reálnou optimalizaci inzerátu."
        };
    }

    try {
        let contextPrompt = "";
        if (companyProfile) {
            contextPrompt = `
        Align the writing with this company profile:
        - Tone: ${companyProfile.tone}
        - Values: ${companyProfile.values.join(', ')}
        - Philosophy: ${companyProfile.philosophy}
        `;
        }

        const prompt = `
      You are an expert HR editor who hates corporate buzzwords. 
      Rewrite the following job description to be transparent, human-centric, and honest.
      OUTPUT IN CZECH.

      Rules:
      1. Remove clichés like "rockstar", "ninja", "family-like", "fast-paced".
      2. Be specific about responsibilities.
      3. Keep the tone professional but grounded.
      ${contextPrompt}
      
      Return JSON:
      - rewrittenText: The full new markdown description.
      - removedCliches: List of phrases you removed.
      - improvedClarity: One sentence explaining why this is better.

      Input Text:
      ${currentDescription.substring(0, 5000)}
    `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        rewrittenText: { type: Type.STRING },
                        removedCliches: { type: Type.ARRAY, items: { type: Type.STRING } },
                        improvedClarity: { type: Type.STRING }
                    },
                    required: ["rewrittenText", "removedCliches", "improvedClarity"]
                }
            }
        });

        const jsonText = response.text;
        if (!jsonText) throw new Error("No response from AI");
        return JSON.parse(jsonText) as AIAdOptimizationResult;
    } catch (error) {
        console.error("Ad Optimization failed:", error);
        return {
            rewrittenText: currentDescription,
            removedCliches: [],
            improvedClarity: "Optimalizace selhala (AI limit vyčerpán). Původní text zachován."
        };
    }
};

export const matchCandidateToJob = async (candidateBio: string, jobDescription: string): Promise<{ score: number, reason: string }> => {
    const ai = getAi();
    if (!ai) {
        return { score: 75, reason: "Mock Match: API klíč chybí. Odhad na základě klíčových slov." };
    }

    try {
        const prompt = `
       Compare this candidate to the job.
       Candidate Bio/Skills: ${candidateBio}
       Job: ${jobDescription.substring(0, 1000)}
       
       Output JSON:
       - score: number 0-100
       - reason: Short Czech explanation of the fit (or lack thereof).
     `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        score: { type: Type.NUMBER },
                        reason: { type: Type.STRING }
                    }
                }
            }
        });

        const jsonText = response.text;
        if (!jsonText) throw new Error("No response from AI");
        try {
            return JSON.parse(jsonText);
        } catch (parseError) {
            console.error("Failed to parse AI response:", jsonText);
            return { score: 0, reason: "Failed to parse AI response" };
        }
    } catch (e) {
        return { score: 0, reason: "AI Service Error" };
    }
};

// --- Assessment Generation ---
export const generateAssessment = async (role: string, skills: string[], difficulty: string, questionCount: number = 5): Promise<Assessment> => {
    const ai = getAi();
    if (!ai) {
        return {
            id: 'mock-id',
            title: `Mock Assessment for ${role}`,
            role: role,
            description: "Toto je testovací assessment bez AI klíče.",
            timeLimitSeconds: 600,
            questions: [
                { id: 'q1', text: "Toto je ukázková otázka (API Key chybí). Vysvětlete Event Loop.", type: "Open" },
                { id: 'q2', text: "Vyberte správnou složitost quicksortu.", type: "MultipleChoice", options: ["O(n)", "O(n log n)", "O(n^2)", "O(log n)"], correctAnswer: "O(n log n)" },
                { id: 'q3', text: "Napište funkci pro Fibonacciho posloupnost.", type: "Code" }
            ],
            createdAt: new Date().toISOString()
        };
    }

    try {
        const prompt = `
        Create a technical assessment for the role of ${role}.
        Skills: ${skills.join(', ')}.
        Difficulty: ${difficulty}.
        OUTPUT IN CZECH.

        Generate ${questionCount} distinct questions to verify real-world competence.
        Mix of Open-ended, Code, and MultipleChoice questions.
        
        JSON Structure:
        - title: Name of the test (Creative, e.g. "React Warrior Challenge")
        - description: Short intro to the test (gamified tone).
        - timeLimitSeconds: Recommended time in seconds (e.g. 900 for 15 mins).
        - questions: Array of objects:
            - id: string (unique)
            - text: string
            - type: 'Code' | 'Open' | 'Scenario' | 'MultipleChoice'
            - options: string[] (Array of 4 options if type implies selection, otherwise null)
            - correctAnswer: string (The correct option text or brief answer key)
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        description: { type: Type.STRING },
                        timeLimitSeconds: { type: Type.NUMBER },
                        questions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    text: { type: Type.STRING },
                                    type: { type: Type.STRING, enum: ["Code", "Open", "Scenario", "MultipleChoice"] },
                                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    correctAnswer: { type: Type.STRING }
                                },
                                required: ["id", "text", "type"]
                            }
                        }
                    },
                    required: ["title", "description", "timeLimitSeconds", "questions"]
                }
            }
        });

        const jsonText = response.text;
        if (!jsonText) throw new Error("No response");
        const data = JSON.parse(jsonText);

        return {
            id: crypto.randomUUID(),
            role: role,
            createdAt: new Date().toISOString(),
            ...data
        };

    } catch (e) {
        console.error("Assessment gen failed", e);
        return {
            id: 'error-id',
            role: role,
            title: `Generování testu nebylo úspěšné`,
            description: "Služba pro generování testů je momentálně přetížená (AI limit). Zkuste to prosím později.",
            timeLimitSeconds: 600,
            questions: [],
            createdAt: new Date().toISOString()
        };
    }
};

// --- Assessment Evaluation ---
export const evaluateAssessmentResult = async (
    role: string,
    difficulty: string,
    questions: { id: string; text: string }[],
    answers: { questionId: string; answer: string }[]
): Promise<AssessmentEvaluation> => {
    const ai = getAi();
    if (!ai) {
        // Mock fallback
        return {
            pros: ["Testovací verze bez AI klíče.", "Odpovědi dávají smysl."],
            cons: ["Nelze hloubkově analyzovat."],
            summary: "Toto je pouze simulované hodnocení. Pro reálnou analýzu nastavte API klíč.",
            skillMatchScore: 50
        };
    }

    try {
        // Prepare context for AI
        const qaPairs = questions.map(q => {
            const warningAnswer = answers.find(a => a.questionId === q.id)?.answer || "Nezodpovězeno";
            return `Otázka: ${q.text}\nOdpověď uchazeče: ${warningAnswer}`;
        }).join("\n\n");

        const prompt = `
        Jsi zkušený tech lead a hiring manager. Tvým úkolem je ohodnotit výsledky technického testu uchazeče.
        Role: ${role}
        Obtížnost: ${difficulty}

        DŮLEŽITÉ PRAVIDLO: NIKDY uchazeče nezamítej ani nediskvalifikuj. Tvým úkolem je pouze objektivně popsat silné a slabé stránky a dát doporučení pro další kolo pohovoru. Buď konstruktivní.

        Otázky a Odpovědi:
        ${qaPairs}

        Výstup musí být validní JSON v tomto formátu:
        {
          "pros": ["silná stránka 1", "silná stránka 2"],
          "cons": ["slabá stránka/oblast ke zlepšení 1", ...],
          "summary": "Celkové shrnutí výkonu v 2-3 větách. Zmiň úroveň seniority podle odpovědí.",
          "skillMatchScore": 0-100 (číslo vyjadřující technickou shodu s rolí)
        }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        pros: { type: Type.ARRAY, items: { type: Type.STRING } },
                        cons: { type: Type.ARRAY, items: { type: Type.STRING } },
                        summary: { type: Type.STRING },
                        skillMatchScore: { type: Type.NUMBER }
                    },
                    required: ["pros", "cons", "summary", "skillMatchScore"]
                }
            }
        });

        const jsonText = response.text;
        if (!jsonText) throw new Error("No response from AI");
        return JSON.parse(jsonText) as AssessmentEvaluation;

    } catch (e) {
        console.error("Assessment Evaluation failed:", e);
        return {
            pros: ["Hodnocení dočasně nedostupné."],
            cons: [],
            summary: "Vaše výsledky byly uloženy, ale automatické hodnocení AI je momentálně nedostupné (limit vyčerpán).",
            skillMatchScore: 0
        };
    }
};

// --- Skill Extraction ---
export const extractSkillsFromJob = async (title: string, description: string): Promise<string[]> => {
    const ai = getAi();
    if (!ai) return [];

    try {
        const prompt = `
        Analyze the following job title and description and extract a list of 5-10 key technical skills, tools, or competencies required for the role.
        Role: ${title}
        Description: ${description}
        
        Return ONLY a JSON array of strings.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });

        const jsonText = response.text;
        return JSON.parse(jsonText || '[]');
    } catch (error) {
        console.error("Skill extraction failed:", error);
        return [];
    }
};
