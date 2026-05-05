import type { UserProfile } from '../types';
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

const inferProfileFromFileName = (file: File): Partial<UserProfile> => {
  const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return {
    cvText: `CV uploaded: ${file.name}`,
    cvAiText: 'CV metadata was stored. Full parsing will run once the V2 document parser endpoint is available.',
    name: baseName.length > 2 ? baseName : undefined,
  };
};

export const uploadAndParseCv = async (
  profile: UserProfile,
  file: File,
  _options: { isPremium: boolean; aiCvParsingEnabled?: boolean },
): Promise<{ cvUrl: string; parsedData: Partial<UserProfile> }> => {
  const parsedData = inferProfileFromFileName(file);
  const uploadedAsset = await uploadV2Asset(file, {
    kind: 'candidate_document',
    usage: 'candidate_cv',
    visibility: 'private',
  });
  const cvUrl = uploadedAsset.url;

  if (profile.id) {
    await ApiService.post('/candidate/cv', {
      externalAssetId: uploadedAsset.id,
      fileName: file.name,
      originalName: file.name,
      fileUrl: cvUrl,
      fileSize: file.size,
      contentType: file.type || 'application/octet-stream',
      isActive: true,
      parsedData,
    });
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
