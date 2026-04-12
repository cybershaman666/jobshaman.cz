import { useCallback, useState } from 'react';
import { BACKEND_URL } from '../constants';

interface TeamInviteResult {
  status: string;
  invitation_id: string;
  token: string;
}

const getAuthToken = async (): Promise<string | null> => {
  try {
    const { supabase } = await import('../services/supabaseService');
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  } catch {
    return null;
  }
};

export const useCompanyTeamInvite = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invite = useCallback(
    async (companyId: string, email: string, name: string, role: 'recruiter' | 'admin'): Promise<TeamInviteResult | null> => {
      const token = await getAuthToken();
      if (!token) {
        setError('Not authenticated');
        return null;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${BACKEND_URL}/companies/team/invite`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ company_id: companyId, email, name, role }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || `HTTP ${res.status}`);
        }
        const data = await res.json();
        return data;
      } catch (e: any) {
        console.error('Team invite failed:', e);
        setError(e.message || 'Failed to send invitation');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { invite, loading, error };
};
