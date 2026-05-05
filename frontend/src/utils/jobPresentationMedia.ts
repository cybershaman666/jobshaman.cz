import type { Job } from '../types';

type JobPresentationMedia = {
  coverImageUrl: string | null;
  videoUrl: string | null;
  galleryUrls: string[];
};

const JOB_MEDIA_MARKER_PATTERN = /^<!--\s*jobshaman:([a-z0-9_]+)=([\s\S]*?)-->\s*/i;

const normalizeHttpUrl = (value: unknown): string | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

const normalizeHttpUrlList = (value: unknown, limit = 8): string[] => {
  const source = Array.isArray(value)
    ? value
    : String(value || '')
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);

  return Array.from(new Set(
    source
      .map((item) => normalizeHttpUrl(item))
      .filter((item): item is string => Boolean(item))
  )).slice(0, limit);
};

export const extractJobPresentationMedia = (job: Pick<Job, 'description' | 'companyProfile'>): JobPresentationMedia => {
  const description = String(job.description || '');
  let remaining = description;
  let coverImageUrl: string | null = null;
  let videoUrl: string | null = null;
  let galleryUrls: string[] = [];

  while (remaining) {
    const match = JOB_MEDIA_MARKER_PATTERN.exec(remaining);
    if (!match) break;
    const key = String(match[1] || '').trim().toLowerCase();
    const value = String(match[2] || '').trim();

    if (key === 'media_cover') {
      coverImageUrl = normalizeHttpUrl(value) || coverImageUrl;
    } else if (key === 'media_video') {
      videoUrl = normalizeHttpUrl(value) || videoUrl;
    } else if (key === 'media_gallery') {
      galleryUrls = normalizeHttpUrlList(value, 10);
    }

    remaining = remaining.slice(match[0].length);
  }

  const companyGalleryUrls = normalizeHttpUrlList(job.companyProfile?.gallery_urls, 10);
  const companyMarketplaceCover = normalizeHttpUrl(job.companyProfile?.marketplace_media?.cover_url);
  const companyMarketplaceVideo = normalizeHttpUrl(job.companyProfile?.marketplace_media?.video_url);
  const companyMarketplaceGallery = normalizeHttpUrlList(job.companyProfile?.marketplace_media?.gallery_urls, 10);
  const mergedGallery = Array.from(new Set([
    ...galleryUrls,
    ...(coverImageUrl ? [coverImageUrl] : []),
    ...(companyMarketplaceCover ? [companyMarketplaceCover] : []),
    ...companyMarketplaceGallery,
    ...companyGalleryUrls,
  ]));

  return {
    coverImageUrl: coverImageUrl || companyMarketplaceCover || mergedGallery[0] || null,
    videoUrl: videoUrl || companyMarketplaceVideo,
    galleryUrls: mergedGallery,
  };
};
