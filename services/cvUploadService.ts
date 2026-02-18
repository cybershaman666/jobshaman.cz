import { UserProfile } from '../types';
import { uploadCVFile } from './supabaseService';
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

export const parseCvFile = async (file: File, options: ParseCvOptions): Promise<Partial<UserProfile>> => {
    const { isPremium, aiCvParsingEnabled = true } = options;

    if (isPremium && aiCvParsingEnabled) {
        try {
            const baseline = await parseProfileFromCVWithFallback(file);
            const aiParsed = await parseProfileFromCV(baseline.cvText || '');
            if (aiParsed && Object.keys(aiParsed).length > 0) {
                return {
                    ...baseline,
                    ...aiParsed,
                    skills: (aiParsed.skills && aiParsed.skills.length > 0) ? aiParsed.skills : baseline.skills,
                    workHistory: (aiParsed.workHistory && aiParsed.workHistory.length > 0) ? aiParsed.workHistory : baseline.workHistory,
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
    const cvUrl = await uploadCVFile(profile.id || '', file);
    const parsedData = await parseCvFile(file, options);
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
