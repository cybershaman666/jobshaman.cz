import type { CVDocument, UserProfile } from '../types';
import ApiService from './apiService';
import { uploadV2Asset } from './v2AssetService';

export const MAX_CV_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export type CvValidationError = 'type' | 'size';

export const validateCvFile = (file: File): CvValidationError | null => {
  const mime = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  const isPdf = mime.includes('pdf') || name.endsWith('.pdf');
  const isDoc = mime.includes('msword') || mime.includes('wordprocessingml') || name.endsWith('.doc') || name.endsWith('.docx');

  if (!isPdf && !isDoc) return 'type';
  if (file.size > MAX_CV_FILE_SIZE_BYTES) return 'size';
  return null;
};

export const parseCvDocument = async (
  cvId: string,
  options: { applyToProfile?: boolean; locale?: string } = {},
): Promise<CVDocument> => {
  const response = await ApiService.post<{ status: string; data: CVDocument }>(
    `/candidate/cv/${encodeURIComponent(cvId)}/parse`,
    {
      applyToProfile: Boolean(options.applyToProfile),
      locale: options.locale || 'cs',
    },
  );
  return response.data;
};

export const uploadAndParseCv = async (
  profile: UserProfile,
  file: File,
  _options: { isPremium: boolean; aiCvParsingEnabled?: boolean },
): Promise<{ cvUrl: string; parsedData: Partial<UserProfile> }> => {
  const uploadedAsset = await uploadV2Asset(file, {
    kind: 'candidate_document',
    usage: 'candidate_cv',
    visibility: 'private',
  });
  const cvUrl = uploadedAsset.url;
  let parsedData: Partial<UserProfile> = {
    cvUrl,
    cvText: `CV uploaded: ${file.name}`,
    cvAiText: 'CV bylo nahráno. AI parser se spouští na serveru.',
  };

  if (profile.id) {
    const created = await ApiService.post<{ status: string; data: CVDocument }>('/candidate/cv', {
      externalAssetId: uploadedAsset.id,
      fileName: file.name,
      originalName: file.name,
      fileUrl: cvUrl,
      fileSize: file.size,
      contentType: file.type || 'application/octet-stream',
      isActive: true,
      parsedData: {
        ...parsedData,
        __meta: { parseStatus: 'pending' },
      },
    });
    const docId = created?.data?.id;
    if (docId) {
      const parsedDoc = await parseCvDocument(docId, {
        applyToProfile: false,
        locale: profile.preferredLocale || 'cs',
      });
      parsedData = {
        cvUrl,
        ...(parsedDoc.parsedData || {}),
      } as Partial<UserProfile>;
    }
  }

  return { cvUrl, parsedData };
};

export const mergeProfileWithParsedCv = (
  profile: UserProfile,
  cvUrl: string,
  parsedData: Partial<UserProfile>,
): UserProfile => ({
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
  cvAiText: parsedData.cvAiText || profile.cvAiText,
});
