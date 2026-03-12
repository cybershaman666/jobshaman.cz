import { BACKEND_URL } from '../constants';
import { PublicActivityFeedPayload } from '../types';

export const fetchPublicActivityFeed = async (
  language: string,
  limit = 5
): Promise<PublicActivityFeedPayload | null> => {
  const url = `${BACKEND_URL}/activity/public?lang=${encodeURIComponent(language || 'en')}&limit=${Math.max(1, Math.min(limit, 10))}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to load public activity feed: ${response.status}`);
  }
  const payload = await response.json() as PublicActivityFeedPayload;
  if (!payload || !Array.isArray(payload.events)) {
    return null;
  }
  return payload;
};
