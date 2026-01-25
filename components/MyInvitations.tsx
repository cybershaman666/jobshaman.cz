import React, { useEffect, useState } from 'react';
import { authenticatedFetch } from '../services/csrfService';
import { BACKEND_URL } from '../constants';

interface Invitation {
  id: string;
  assessment_id: string;
  status: string;
  created_at: string;
  expires_at: string;
  metadata: any;
  candidate_email?: string;
  company_id?: string;
}

const MyInvitations: React.FC<{ forCompany?: boolean }> = ({ forCompany = false }) => {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await authenticatedFetch(`${BACKEND_URL}/assessments/invitations`, { method: 'GET' });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      setInvitations(data.invitations || []);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Nepodařilo se načíst pozvánky');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-bold">Pozvánky</h4>
        <button onClick={load} className="text-sm text-slate-500">Obnovit</button>
      </div>

      {loading && <div className="text-sm text-slate-500">Načítám…</div>}
      {error && <div className="text-sm text-rose-600">{error}</div>}

      {!loading && !invitations.length && (
        <div className="text-sm text-slate-500">Žádné aktivní pozvánky</div>
      )}

      <div className="space-y-3">
        {invitations.map(inv => (
          <div key={inv.id} className="p-3 border rounded bg-white dark:bg-slate-900">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-sm font-medium">Assessment: {inv.assessment_id}</div>
                <div className="text-xs text-slate-500">Status: {inv.status} • Vyprší: {new Date(inv.expires_at).toLocaleDateString()}</div>
                {inv.metadata?.job_title && <div className="text-xs text-slate-500">Pozice: {inv.metadata.job_title}</div>}
              </div>
              <div className="text-sm text-slate-500">ID: {inv.id.slice(0,8)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MyInvitations;
