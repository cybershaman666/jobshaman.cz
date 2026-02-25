import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { generateAssessment } from '../services/geminiService';
import { BACKEND_URL, FEATURE_ASSESSMENT_COCKPIT_V2, FEATURE_ASSESSMENT_JOURNEY_EXPERIENCE_V1, FEATURE_ASSESSMENT_THREE } from '../constants';
import AssessmentExperienceRouter from '../components/AssessmentExperienceRouter';
import { useSceneCapability } from '../hooks/useSceneCapability';
import SceneShell from '../components/three/SceneShell';
import JourneyBackdropScene from '../components/three/JourneyBackdropScene';
import BiophilicCockpitScene from '../components/three/BiophilicCockpitScene';

interface InvitationDetail {
  invitation_id: string;
  assessment_id: string;
  company_id: string;
  company_name: string;
  candidate_email: string;
  status: string;
  expires_at: string;
  metadata: any;
}

const InvitationLanding: React.FC = () => {
  const { t } = useTranslation();
  const sceneCapability = useSceneCapability();
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<any | null>(null);
  const [invitationToken, setInvitationToken] = useState<string>('');
  const [journeyOptInQuery, setJourneyOptInQuery] = useState(false);
  const [showLandingScene, setShowLandingScene] = useState(FEATURE_ASSESSMENT_THREE);

  useEffect(() => {
    const path = window.location.pathname;
    const supportedLocales = ['cs', 'en', 'de', 'pl', 'sk', 'at'];
    const pathParts = path.split('/').filter(Boolean);
    if (pathParts.length > 0 && supportedLocales.includes(pathParts[0])) {
      pathParts.shift();
    }
    const normalizedPath = `/${pathParts.join('/')}`;
    const match = normalizedPath.match(/^\/assessment\/(.+)$/);
    const invitationId = match ? match[1] : null;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') || undefined;
    setInvitationToken(token || '');
    setJourneyOptInQuery(params.get('journey_v1') === '1');

    if (!invitationId || !token) {
      setError(t('invitation_landing.invalid_link'));
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/assessments/invitations/${invitationId}?token=${encodeURIComponent(token)}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || t('invitation_landing.api_error', { status: res.status }));
        }
        const data = await res.json();
        setInvitation({
          invitation_id: data.invitation_id || invitationId,
          assessment_id: data.assessment_id,
          company_id: data.company_id,
          company_name: data.company_name,
          candidate_email: data.candidate_email,
          status: data.status,
          expires_at: data.expires_at,
          metadata: data.metadata,
        });
      } catch (e: any) {
        console.error(e);
        setError(e.message || t('invitation_landing.verify_failed'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const experienceEnabled = useMemo(() => {
    if (!invitation) return FEATURE_ASSESSMENT_JOURNEY_EXPERIENCE_V1 || journeyOptInQuery;
    return Boolean(
      FEATURE_ASSESSMENT_JOURNEY_EXPERIENCE_V1 ||
      journeyOptInQuery ||
      invitation.metadata?.journey_experience_v1 === true ||
      invitation.metadata?.internal_preview === true
    );
  }, [invitation, journeyOptInQuery]);

  const roleLabel = useMemo(() => {
    if (!invitation) return t('invitation_landing.default_role');
    return invitation.metadata?.role || invitation.metadata?.job_title || invitation.assessment_id || t('invitation_landing.default_role');
  }, [invitation, t]);
  const roleMoodSceneSkin = useMemo<'cosmos' | 'garden' | 'inner' | 'skycity' | 'healing' | 'finance' | 'tech'>(() => {
    const role = (roleLabel || '').toLowerCase();
    if (/(health|medical|nurse|doctor|clinic|hospital|zdravot|léka|sestr|pece|péče|social|sociální)/.test(role)) return 'healing';
    if (/(finance|finan|bank|audit|account|controller|investment|risk|treasury|účet|dan|tax)/.test(role)) return 'finance';
    if (/(engineer|developer|software|it|data|cloud|devops|backend|frontend|tech|program|ai|ml)/.test(role)) return 'tech';
    return 'garden';
  }, [roleLabel]);

  const estimatedMinutes = useMemo(() => {
    if (!invitation) return 18;
    const raw = Number(invitation.metadata?.estimated_minutes || invitation.metadata?.duration_minutes || 18);
    if (!Number.isFinite(raw) || raw <= 0) return 18;
    return Math.min(45, Math.max(10, Math.round(raw)));
  }, [invitation]);

  const missionImpact = useMemo(() => {
    if (!invitation) return t('invitation_landing.mission_impact_default', { role: t('invitation_landing.default_role') });
    return invitation.metadata?.impact_statement || t('invitation_landing.mission_impact_default', { role: roleLabel });
  }, [invitation, roleLabel, t]);

  const missionCheckpoints = useMemo(() => [
    t('invitation_landing.checkpoint_1', { defaultValue: 'Bezpečný start a první rozhodovací signály' }),
    t('invitation_landing.checkpoint_2', { defaultValue: 'Krátké praktické mise v klíčových bodech cesty' }),
    t('invitation_landing.checkpoint_3', { defaultValue: 'Insighty o vašem stylu práce a energii' }),
    t('invitation_landing.checkpoint_4', { defaultValue: 'Souhrn, který ukáže váš potenciál pro roli' }),
  ], [t]);

  const handleStart = async () => {
    if (!invitation) return;
    setError(null);

    const role = invitation.metadata?.role || invitation.metadata?.job_title || t('invitation_landing.default_role');
    const skills: string[] = invitation.metadata?.skills || (invitation.metadata?.skill_list || '').split(',').map((s: string) => s.trim()).filter(Boolean) || [t('invitation_landing.default_skill') as string];
    const difficulty = invitation.metadata?.difficulty || 'Senior';
    try {
      const gen = await generateAssessment(role, skills, difficulty);
      setAssessment(gen);
    } catch (e: any) {
      console.error(e);
      setError(t('invitation_landing.generate_failed'));
    }
  };

  const handleAssessmentComplete = () => {
    if (!invitation) return;
    setAssessment(null);
    setInvitation({ ...invitation, status: 'completed' });
    alert(t('invitation_landing.submit_success_alert'));
  };

  if (loading) return <div className="p-6">{t('invitation_landing.loading')}</div>;
  if (error) return <div className="p-6 text-rose-600">{error}</div>;
  if (!invitation) return <div className="p-6">{t('invitation_landing.not_found')}</div>;
  if (assessment && invitation.status !== 'completed') {
    return (
      <AssessmentExperienceRouter
        assessment={assessment}
        invitationId={invitation.invitation_id}
        invitationToken={invitationToken}
        submitViaBackend
        onComplete={handleAssessmentComplete}
      />
    );
  }

  const cockpitHeroEnabled = FEATURE_ASSESSMENT_COCKPIT_V2 && experienceEnabled;
  return (
    <div className="min-h-screen app-grid-bg app-grid-bg--soft">
      <div className="max-w-5xl mx-auto p-6">
        <div className={`mb-4 rounded-2xl overflow-hidden h-44 md:h-56 relative ${cockpitHeroEnabled ? 'cockpit-panel border border-white/20 shadow-[0_22px_52px_rgba(2,18,13,0.45)]' : 'border border-slate-200/70 dark:border-slate-700/60 bg-white/72 dark:bg-slate-900/40 backdrop-blur-md shadow-[0_10px_24px_rgba(15,23,42,0.08)] dark:shadow-none'}`}>
          {FEATURE_ASSESSMENT_THREE && showLandingScene ? (
            <SceneShell
              capability={sceneCapability}
              glide
              glideIntensity={0.16}
              performanceMode={sceneCapability.qualityTier}
              className="absolute inset-0"
              fallback={<div className={`absolute inset-0 ${cockpitHeroEnabled ? 'cockpit-scene-fallback' : 'bg-[radial-gradient(circle_at_58%_24%,rgba(100,116,139,0.14),transparent_52%),linear-gradient(180deg,rgba(248,250,252,0.75),rgba(226,232,240,0.88))] dark:bg-[radial-gradient(circle_at_58%_24%,rgba(148,163,184,0.12),transparent_52%),linear-gradient(180deg,rgba(2,6,23,0.9),rgba(15,23,42,0.95))]'}`} />}
            >
              {cockpitHeroEnabled ? (
                <BiophilicCockpitScene phase={1} progress={0.2} streakCount={0} confidence={58} energy={72} culture={66} qualityTier={sceneCapability.qualityTier} />
              ) : (
                <JourneyBackdropScene mode="welcome" mood={roleMoodSceneSkin} progress={0.2} />
              )}
            </SceneShell>
          ) : (
            <div className={`absolute inset-0 ${cockpitHeroEnabled ? 'cockpit-scene-fallback' : 'bg-[radial-gradient(circle_at_58%_24%,rgba(100,116,139,0.14),transparent_52%),linear-gradient(180deg,rgba(248,250,252,0.75),rgba(226,232,240,0.88))] dark:bg-[radial-gradient(circle_at_58%_24%,rgba(148,163,184,0.12),transparent_52%),linear-gradient(180deg,rgba(2,6,23,0.9),rgba(15,23,42,0.95))]'}`} />
          )}
          {FEATURE_ASSESSMENT_THREE && (
            <button
              onClick={() => setShowLandingScene((v) => !v)}
              className="absolute top-3 right-3 z-10 rounded-lg border border-slate-300/80 dark:border-slate-600/70 bg-white/80 dark:bg-slate-900/65 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-100"
            >
              {showLandingScene
                ? t('assessment_3d.preview_on', { defaultValue: '3D Preview: ON' })
                : t('assessment_3d.preview_off', { defaultValue: '3D Preview: OFF' })}
            </button>
          )}
          <div className={`absolute inset-0 ${cockpitHeroEnabled ? 'bg-[linear-gradient(180deg,rgba(2,20,16,0.1),rgba(2,18,13,0.6))]' : 'bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(226,232,240,0.72))] dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.18),rgba(2,6,23,0.72))]'}`} />
          <div className={`absolute bottom-3 left-4 right-4 rounded-xl backdrop-blur-md px-3 py-2 text-sm ${cockpitHeroEnabled ? 'border border-white/20 bg-black/30 text-cyan-50' : 'border border-slate-300/70 dark:border-slate-700/70 bg-white/65 dark:bg-slate-900/55 text-slate-700 dark:text-slate-100'}`}>
            {t('assessment_journey.mission_tagline', { defaultValue: 'Navigace k roli, ne školní test' })}
          </div>
        </div>
        <div className="bg-white/95 dark:bg-slate-900/95 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-[0_18px_40px_rgba(15,23,42,0.12)] dark:shadow-[0_18px_40px_rgba(2,6,23,0.45)] journey-panel-enter">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('invitation_landing.title', { company: invitation.company_name })}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-300 mb-1">{t('invitation_landing.position')}: {invitation.metadata?.job_title || invitation.assessment_id}</p>
          <p className="text-sm text-slate-500 dark:text-slate-300 mb-4">{t('invitation_landing.valid_until')}: {new Date(invitation.expires_at).toLocaleString()}</p>

          {!assessment && invitation.status !== 'completed' && (
            <div className="space-y-4">
              {experienceEnabled ? (
                <>
                  <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-[radial-gradient(circle_at_12%_20%,rgba(148,163,184,0.12),transparent_38%),linear-gradient(180deg,#f8fafc,#f8fafc)] dark:bg-[linear-gradient(120deg,rgba(71,85,105,0.18),rgba(30,41,59,0.65))] p-4">
                    <div className="text-xs uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">{t('invitation_landing.mission_brief_title', { defaultValue: 'Mission Brief' })}</div>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">{t('invitation_landing.role_target', { defaultValue: 'Cesta k roli: {{role}}', role: roleLabel })}</h3>
                    <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{missionImpact}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1 text-slate-700 dark:text-slate-200">{t('invitation_landing.pace_hint', { defaultValue: 'Doporučené tempo: {{minutes}}-{{max}} min', minutes: estimatedMinutes - 4, max: estimatedMinutes + 4 })}</span>
                      <span className="rounded-full border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1 text-slate-700 dark:text-slate-200">{t('invitation_landing.return_safety', { defaultValue: 'Odpovědi se průběžně ukládají' })}</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4">
                    <div className="text-xs uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">{t('invitation_landing.what_awaits', { defaultValue: 'Co vás čeká' })}</div>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {missionCheckpoints.map((item, idx) => (
                        <div key={item} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200">
                          {idx + 1}. {item}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-800 dark:text-amber-100">
                    {t('invitation_landing.safety_copy', { defaultValue: 'Nejde o školní test. Jde o zachycení vašeho přirozeného stylu rozhodování.' })}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-200">{t('invitation_landing.start_desc')}</p>
              )}

              <div className="flex gap-2">
                <button onClick={handleStart} className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 rounded-xl font-semibold shadow-lg shadow-slate-900/20 transition-colors">
                  {experienceEnabled
                    ? t('invitation_landing.start_button_journey', { defaultValue: 'Odemknout první checkpoint' })
                    : t('invitation_landing.start_button')}
                </button>
              </div>
            </div>
          )}

          {invitation.status === 'completed' && (
            <div className="mt-4 text-sm text-green-600 dark:text-green-300">{t('invitation_landing.completed')}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvitationLanding;
