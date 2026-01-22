
import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysisResult, AIAdOptimizationResult, CompanyProfile, Assessment, CVAnalysis, UserProfile, ShamanAdvice, SalaryEstimate } from "../types";

// Safe API Key Access
const getApiKey = () => {
  try {
    // Check for process existence before accessing env
    if (typeof process !== 'undefined' && process.env) {
      return process.env.API_KEY;
    }
  } catch(e) {}
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

export const analyzeJobDescription = async (description: string): Promise<AIAnalysisResult> => {
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
    
    return JSON.parse(jsonText) as AIAnalysisResult;

  } catch (error) {
    console.error("AI Analysis failed:", error);
    throw error;
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
        throw e;
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
        throw e;
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
        throw e;
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
    throw error;
  }
};

export const matchCandidateToJob = async (candidateBio: string, jobDescription: string): Promise<{score: number, reason: string}> => {
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

export const generateAssessment = async (role: string, skills: string[], difficulty: string): Promise<Assessment> => {
    const ai = getAi();
    if (!ai) {
        return {
            id: 'mock-id',
            title: `Mock Assessment for ${role}`,
            role: role,
            questions: [
                { text: "Toto je ukázková otázka (API Key chybí). Vysvětlete Event Loop.", type: "Open" },
                { text: "Napište funkci pro Fibonacciho posloupnost.", type: "Code" }
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

        Generate 3 distinct questions to verify real-world competence, not just trivia.
        
        JSON Structure:
        - title: Name of the test
        - questions: Array of objects { text: string, type: 'Code' | 'Open' | 'Scenario' }
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
                        questions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    text: { type: Type.STRING },
                                    type: { type: Type.STRING, enum: ["Code", "Open", "Scenario"] }
                                }
                            }
                        }
                    }
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
        throw e;
    }
};
