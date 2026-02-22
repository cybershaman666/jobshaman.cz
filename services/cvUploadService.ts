import { UserProfile } from '../types';
import { updateCVDocumentParsedData, updateUserCVSelection, uploadCVDocument, uploadCVFile } from './supabaseService';
import { parseProfileFromCVWithFallback } from './cvParserService';
import { parseProfileFromCV } from './geminiService';

export const MAX_CV_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export type CvValidationError = 'type' | 'size';

export const validateCvFile = (file: File): CvValidationError | null => {
    const mime = (file.type || '').toLowerCase();
    const name = (file.name || '').toLowerCase();
    const isPdf = mime.includes('pdf') || name.endsWith('.pdf');
    const isDoc = mime.includes('msword') || mime.includes('wordprocessingml') || name.endsWith('.doc') || name.endsWith('.docx');

    if (!isPdf && !isDoc) {
        return 'type';
    }

    if (file.size > MAX_CV_FILE_SIZE_BYTES) {
        return 'size';
    }

    return null;
};

type ParseCvOptions = {
    isPremium: boolean;
    aiCvParsingEnabled?: boolean;
};

const normalizeExperienceKey = (entry: any): string => {
    const company = String(entry?.company || '').trim().toLowerCase();
    const role = String(entry?.role || '').trim().toLowerCase();
    const duration = String(entry?.duration || '').trim().toLowerCase();
    return `${company}|${role}|${duration}`;
};

const mergeWorkHistory = (aiWorkHistory: any, baselineWorkHistory: any): any[] | undefined => {
    const ai = Array.isArray(aiWorkHistory) ? aiWorkHistory.filter(Boolean) : [];
    const baseline = Array.isArray(baselineWorkHistory) ? baselineWorkHistory.filter(Boolean) : [];

    if (ai.length === 0 && baseline.length === 0) return undefined;
    if (ai.length === 0) return baseline;
    if (baseline.length === 0) return ai;

    const merged: any[] = [];
    const seen = new Set<string>();

    for (const item of ai) {
        const key = normalizeExperienceKey(item);
        if (!seen.has(key)) {
            merged.push(item);
            seen.add(key);
        }
    }
    for (const item of baseline) {
        const key = normalizeExperienceKey(item);
        if (!seen.has(key)) {
            merged.push(item);
            seen.add(key);
        }
    }

    return merged;
};

export const parseCvFile = async (file: File, options: ParseCvOptions): Promise<Partial<UserProfile>> => {
    const { isPremium, aiCvParsingEnabled = true } = options;

    if (isPremium && aiCvParsingEnabled) {
        try {
            const baseline = await parseProfileFromCVWithFallback(file);
            const aiParsed = await parseProfileFromCV(baseline.cvText || '');
            const mergedWorkHistory = mergeWorkHistory(aiParsed?.workHistory, baseline?.workHistory);
            if (aiParsed && Object.keys(aiParsed).length > 0) {
                return {
                    ...baseline,
                    ...aiParsed,
                    skills: (aiParsed.skills && aiParsed.skills.length > 0) ? aiParsed.skills : baseline.skills,
                    workHistory: mergedWorkHistory,
                    education: (aiParsed.education && aiParsed.education.length > 0) ? aiParsed.education : baseline.education,
                    cvText: aiParsed.cvText || baseline.cvText,
                    cvAiText: aiParsed.cvAiText || baseline.cvAiText
                };
            }
        } catch (aiError) {
            console.warn('AI CV parsing failed, falling back to standard parser:', aiError);
        }
    }

    return await parseProfileFromCVWithFallback(file);
};

export const uploadAndParseCv = async (
    profile: UserProfile,
    file: File,
    options: ParseCvOptions
): Promise<{ cvUrl: string; parsedData: Partial<UserProfile> }> => {
    const parsedData = await parseCvFile(file, options);

    if (profile.id) {
        try {
            const doc = await uploadCVDocument(profile.id, file);
            if (doc) {
                await updateCVDocumentParsedData(profile.id, doc.id, parsedData || {});
                await updateUserCVSelection(profile.id, doc.id);
                return { cvUrl: doc.fileUrl, parsedData };
            }
        } catch (docError) {
            console.warn('Failed to persist CV in cv_documents, falling back to direct upload:', docError);
        }
    }

    const cvUrl = await uploadCVFile(profile.id || '', file);
    return { cvUrl, parsedData };
};

export const mergeProfileWithParsedCv = (
    profile: UserProfile,
    cvUrl: string,
    parsedData: Partial<UserProfile>
): UserProfile => {
    return {
        ...profile,
        cvUrl,
        name: parsedData.name || profile.name,
        email: parsedData.email || profile.email,
        phone: parsedData.phone || profile.phone,
        jobTitle: parsedData.jobTitle || profile.jobTitle,
        skills: parsedData.skills && parsedData.skills.length > 0 ? parsedData.skills : profile.skills,
        workHistory: parsedData.workHistory && parsedData.workHistory.length > 0 ? parsedData.workHistory : profile.workHistory,
        education: parsedData.education && parsedData.education.length > 0 ? parsedData.education : profile.education,
        cvText: parsedData.cvText || profile.cvText,
        cvAiText: parsedData.cvAiText || profile.cvAiText
    };
};
