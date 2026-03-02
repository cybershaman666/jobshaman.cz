import json
import secrets
from datetime import datetime, timedelta, timezone
from statistics import mean
from typing import Any, Dict, List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from ..core.database import supabase
from ..core.limiter import limiter
from ..core.security import get_current_user, require_company_access
from ..models.requests import (
    AssessmentCultureResonanceRequest,
    AssessmentGalaxyEvaluateNodeRequest,
    AssessmentInvitationRequest,
    AssessmentJourneyAnalyzeAnswerRequest,
    AssessmentJourneyFinalizeRequest,
    AssessmentLibraryStatusUpdateRequest,
    AssessmentRealtimeSignalsRequest,
    AssessmentResultRequest,
)
from ..services.email import send_email

router = APIRouter()


def _is_missing_column_error(exc: Exception, column_name: str) -> bool:
    msg = str(exc).lower()
    return column_name.lower() in msg and ("does not exist" in msg or "column" in msg)


def _safe_assessment_job_id(value: Any) -> int | None:
    try:
        if value is None or value == "":
            return None
        return int(value)
    except Exception:
        return None


def _find_existing_assessment_result(invitation_id: str) -> dict | None:
    try:
        response = (
            supabase
            .table('assessment_results')
            .select('id,invitation_id,completed_at')
            .eq('invitation_id', invitation_id)
            .limit(1)
            .execute()
        )
    except Exception:
        return None
    rows = response.data or []
    if isinstance(rows, list) and rows:
        return rows[0]
    return None


def _parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def _is_active_subscription(sub: Dict[str, Any] | None) -> bool:
    if not sub:
        return False
    status = str(sub.get("status") or "").lower()
    if status not in {"active", "trialing"}:
        return False
    expires_at = _parse_iso_datetime(sub.get("current_period_end"))
    if not expires_at:
        return True
    return datetime.now(timezone.utc) <= expires_at


_COMPANY_TIER_ASSESSMENT_LIMITS: Dict[str, int] = {
    "free": 0,
    "trial": 0,
    "starter": 15,
    "growth": 60,
    "professional": 150,
    "enterprise": 999999,
}


def _get_latest_company_subscription(company_id: str) -> Dict[str, Any] | None:
    if not supabase or not company_id:
        return None
    try:
        resp = (
            supabase
            .table("subscriptions")
            .select("*")
            .eq("company_id", company_id)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        return resp.data[0] if resp.data else None
    except Exception:
        return None


def _get_latest_usage_for_subscription(subscription_id: str) -> Dict[str, Any] | None:
    if not supabase or not subscription_id:
        return None
    try:
        resp = (
            supabase
            .table("subscription_usage")
            .select("*")
            .eq("subscription_id", subscription_id)
            .order("period_end", desc=True)
            .limit(1)
            .execute()
        )
        return resp.data[0] if resp.data else None
    except Exception:
        return None


def _require_company_assessment_capacity(company_id: str) -> str:
    sub = _get_latest_company_subscription(company_id)
    if not _is_active_subscription(sub):
        raise HTTPException(status_code=403, detail="Active subscription required")

    tier = str((sub or {}).get("tier") or "free").lower()
    if tier not in {"starter", "growth", "professional", "enterprise"}:
        raise HTTPException(status_code=403, detail="Current plan does not include assessment invites")

    usage = _get_latest_usage_for_subscription(str((sub or {}).get("id") or ""))
    used = int((usage or {}).get("ai_assessments_used") or 0)
    limit = _COMPANY_TIER_ASSESSMENT_LIMITS.get(tier, 0)
    if used >= limit:
        raise HTTPException(status_code=403, detail="Assessment limit reached for the current billing period")
    return tier


def generate_invitation_token() -> str:
    return secrets.token_urlsafe(32)


def _marker_hits(text: str, markers: List[str]) -> int:
    low = (text or '').lower()
    return sum(1 for m in markers if m in low)


def _sentences(text: str) -> List[str]:
    return [x.strip() for x in text.replace('?', '.').replace('!', '.').split('.') if x.strip()]


def _analyze_decision_pattern(answers: List[str]) -> Dict[str, Any]:
    joined = ' '.join(answers).lower()
    sentences = max(1, len(_sentences(joined)))
    words = len([w for w in joined.split() if w])
    avg_sentence_len = words / max(1, sentences)

    priority_hits = _marker_hits(joined, ['first', 'priorit', 'nejdriv', 'urgent', 'krok'])
    risk_hits = _marker_hits(joined, ['risk', 'trade-off', 'fallback', 'experiment'])
    stakeholder_hits = _marker_hits(joined, ['stakeholder', 'team', 'tym', 'klient', 'customer'])
    sequential_hits = _marker_hits(joined, ['then', 'next', 'potom', 'následne'])
    uncertainty_markers = [m for m in ['maybe', 'perhaps', 'asi', 'mozna', 'nevim', 'idk'] if m in joined]

    def _c(n: float) -> int:
        return max(0, min(100, round(n)))

    return {
        'structured_vs_improv': _c(45 + priority_hits * 12 + (8 if avg_sentence_len > 13 else -3)),
        'risk_tolerance': _c(50 + risk_hits * 10 - len(uncertainty_markers) * 4),
        'sequential_vs_parallel': _c(50 + sequential_hits * 10 - _marker_hits(joined, ['parallel', 'soubez']) * 8),
        'stakeholder_orientation': _c(35 + stakeholder_hits * 12),
        'uncertainty_markers': sorted(set(uncertainty_markers)),
    }


def _analyze_consistency(answers: List[str]) -> Dict[str, Any]:
    joined = ' '.join(answers).lower()
    motifs: List[str] = []
    if any(k in joined for k in ['plan', 'step', 'krok', 'framework']):
        motifs.append('V odpovědích se opakuje motiv strukturovaného postupu.')
    if any(k in joined for k in ['risk', 'fallback', 'trade-off']):
        motifs.append('V odpovědích se opakuje práce s rizikem a fallbackem.')
    if any(k in joined for k in ['feedback', 'transparent', 'otevren']):
        motifs.append('V odpovědích se opakuje důraz na transparentní komunikaci.')

    tensions: List[str] = []
    if 'autonomy' in joined and ('strict process' in joined or 'pevny proces' in joined):
        tensions.append('Objevuje se napětí mezi autonomií a pevným procesem.')

    consistency_pairs = [
        'Deklarovaná preference se objevuje i ve scénářových odpovědích.',
        'Prioritizace se opakuje napříč více odpověďmi.',
    ] if motifs else ['Začíná se formovat stabilní vzorec rozhodování.']

    return {
        'recurring_motifs': motifs[:3],
        'consistency_pairs': consistency_pairs[:2],
        'preference_scenario_tensions': tensions[:2],
    }


def _analyze_energy_balance(answers: List[str]) -> Dict[str, Any]:
    joined = ' '.join(answers).lower()
    must_hits = _marker_hits(joined, ['musim', 'musíme', 'must', 'have to'])
    want_hits = max(1, _marker_hits(joined, ['chci', 'chceme', 'want', 'prefer']))
    enthusiasm = [m for m in ['growth', 'learn', 'impact', 'tesi', 'chci rust'] if m in joined]
    exhaustion = [m for m in ['burnout', 'vycerp', 'chaos', 'pretlak', 'exhaust'] if m in joined]
    internal = _marker_hits(joined, ['rozhodnu', 'zvladnu', 'plan', 'choose', 'decide'])
    external = _marker_hits(joined, ['nemuzu ovlivnit', 'manager said', 'they told'])

    locus = 'mixed'
    if internal > external:
        locus = 'internal'
    elif external > internal:
        locus = 'external'

    monthly_energy_hours_left = max(18, 110 - must_hits * 8 + want_hits * 5 - len(exhaustion) * 6)

    return {
        'enthusiasm_markers': enthusiasm[:6],
        'exhaustion_markers': exhaustion[:6],
        'must_vs_want_ratio': round(must_hits / max(1, want_hits), 2),
        'locus_of_control': locus,
        'monthly_energy_hours_left': monthly_energy_hours_left,
    }


def _analyze_culture(answers: List[str]) -> Dict[str, str]:
    joined = ' '.join(answers).lower()
    return {
        'transparency': 'Vysoká preference otevřené zpětné vazby.' if any(k in joined for k in ['feedback', 'transparent', 'otevren']) else 'Spíše opatrnější preference zpětné vazby.',
        'conflict_response': 'Spíše přímá konfrontace problému.' if any(k in joined for k in ['confront', 'naprimo', 'otevrene']) else 'Spíše zprostředkované řešení konfliktu.',
        'hierarchy_vs_autonomy': 'Vyšší orientace na autonomii.' if any(k in joined for k in ['autonomy', 'samostat']) else 'Vyšší orientace na jasnou hierarchii.',
        'process_vs_outcome': 'Důraz na procesní kvalitu i výsledek.' if any(k in joined for k in ['process', 'postup', 'framework']) else 'Důraz primárně na výsledek.',
        'stability_vs_dynamics': 'Směr k dynamickému prostředí a iteraci.' if any(k in joined for k in ['iter', 'zmena', 'change']) else 'Směr ke stabilnímu prostředí.',
    }


def _build_final_profile(decision: Dict[str, Any], energy: Dict[str, Any], culture: Dict[str, str]) -> Dict[str, Any]:
    return {
        'transferable_strengths': [
            'Strukturované rozhodování v nejistotě' if decision.get('structured_vs_improv', 50) >= 55 else 'Adaptivní improvizace v proměnlivém kontextu',
            'Stakeholder communication' if decision.get('stakeholder_orientation', 50) >= 60 else 'Samostatná exekuce',
            'Vysoká subjektivní kontrola nad výsledkem' if energy.get('locus_of_control') == 'internal' else 'Silná reakce na externí signály',
        ],
        'risk_zones': [
            'Dlouhodobý tlak povinností může snižovat energii.' if float(energy.get('must_vs_want_ratio') or 1.0) > 1.4 else 'Riziko není dominantní v energetické rovině.',
        ],
        'amplify_environments': [
            culture.get('transparency', ''),
            culture.get('hierarchy_vs_autonomy', ''),
        ],
        'drain_environments': [
            'Nízká transparentnost rozhodování.',
            'Dlouhodobě vysoký operativní tlak bez prostoru na obnovu.' if int(energy.get('monthly_energy_hours_left') or 80) < 40 else 'Nekonzistentní prioritizace bez jasného vlastnictví.',
        ],
    }


def _journey_quality_index(journey_payload: Dict[str, Any]) -> float:
    decision = journey_payload.get('decision_pattern') or {}
    energy = journey_payload.get('energy_balance') or {}
    culture = journey_payload.get('cultural_orientation') or {}

    decision_score = mean([
        float(decision.get('structured_vs_improv') or 50),
        float(decision.get('risk_tolerance') or 50),
        float(decision.get('sequential_vs_parallel') or 50),
        float(decision.get('stakeholder_orientation') or 50),
    ])
    energy_left = min(100.0, float(energy.get('monthly_energy_hours_left') or 80))
    culture_coverage = sum(1 for key in ['transparency', 'conflict_response', 'hierarchy_vs_autonomy', 'process_vs_outcome', 'stability_vs_dynamics'] if (culture.get(key) or '').strip())
    culture_score = min(100.0, culture_coverage * 20.0)

    return round((decision_score * 0.5) + (energy_left * 0.3) + (culture_score * 0.2), 2)


@router.post('/journey/analyze-answer')
@limiter.limit('120/minute')
async def journey_analyze_answer(payload: AssessmentJourneyAnalyzeAnswerRequest, request: Request):
    answers = [a for a in payload.answers_so_far if str(a).strip()]
    answer = (payload.answer or '').strip()
    if answer:
        answers.append(answer)

    decision = _analyze_decision_pattern(answers)
    consistency = _analyze_consistency(answers)
    energy = _analyze_energy_balance(answers)
    culture = _analyze_culture(answers)

    micro_insight = consistency['recurring_motifs'][0] if consistency['recurring_motifs'] else 'Začíná se rýsovat váš rozhodovací styl.'
    return {
        'micro_insight': micro_insight,
        'insight_type': 'pattern_reflection',
        'decision_pattern': decision,
        'behavioral_consistency': consistency,
        'energy_balance': energy,
        'cultural_orientation': culture,
    }


@router.post('/journey/finalize')
@limiter.limit('60/minute')
async def journey_finalize(payload: AssessmentJourneyFinalizeRequest, request: Request):
    answers = [a for a in payload.answers if str(a).strip()]
    decision = _analyze_decision_pattern(answers)
    consistency = _analyze_consistency(answers)
    energy = _analyze_energy_balance(answers)
    culture = _analyze_culture(answers)
    final_profile = _build_final_profile(decision, energy, culture)

    return {
        'decision_pattern': decision,
        'behavioral_consistency': consistency,
        'energy_balance': energy,
        'cultural_orientation': culture,
        'final_profile': final_profile,
    }


@router.post('/realtime-signals')
@limiter.limit('60/minute')
async def realtime_signals(payload: AssessmentRealtimeSignalsRequest, request: Request):
    return {
        'deprecated': True,
        'message': 'Endpoint deprecated. Use /assessments/journey/analyze-answer.',
    }


@router.post('/culture-resonance')
@limiter.limit('60/minute')
async def culture_resonance(payload: AssessmentCultureResonanceRequest, request: Request):
    return {
        'deprecated': True,
        'message': 'Endpoint deprecated. Use /assessments/journey/finalize.',
    }


@router.post('/galaxy/evaluate-node')
@limiter.limit('120/minute')
async def evaluate_galaxy_node(payload: AssessmentGalaxyEvaluateNodeRequest, request: Request):
    return {
        'deprecated': True,
        'message': 'Endpoint deprecated. Journey V1 no longer uses node scoring.',
    }


@router.post('/invitations/create')
@limiter.limit('100/minute')
async def create_assessment_invitation(invitation_req: AssessmentInvitationRequest, request: Request, user: dict = Depends(get_current_user)):
    if not supabase:
        raise HTTPException(status_code=503, detail='Database unavailable')

    company_id = require_company_access(user, user.get('company_id'))
    if not company_id:
        raise HTTPException(status_code=401, detail='User not authenticated')

    if not user.get('company_name'):
        raise HTTPException(status_code=403, detail='Only company admins can send invitations')
    if company_id not in user.get('authorized_ids', []):
        raise HTTPException(status_code=403, detail='Unauthorized')

    assessment_check = supabase.table('assessments').select('id').eq('id', invitation_req.assessment_id).single().execute()
    if not assessment_check.data:
        raise HTTPException(status_code=404, detail='Assessment not found')

    _require_company_assessment_capacity(company_id)

    invitation_token = generate_invitation_token()
    expires_at = datetime.now(timezone.utc) + timedelta(days=invitation_req.expires_in_days)

    candidate_id = invitation_req.candidate_id
    if not candidate_id and invitation_req.candidate_email:
        cand_resp = supabase.table('profiles').select('id').eq('email', invitation_req.candidate_email).execute()
        if cand_resp.data:
            candidate_id = cand_resp.data[0]['id']

    base_payload = {
        'company_id': company_id,
        'assessment_id': invitation_req.assessment_id,
        'candidate_id': candidate_id,
        'candidate_email': invitation_req.candidate_email,
        'status': 'pending',
        'invitation_token': invitation_token,
        'expires_at': expires_at.isoformat(),
        'metadata': invitation_req.metadata or {},
        'application_id': invitation_req.application_id,
        'job_id': invitation_req.job_id,
    }

    try:
        invitation_response = supabase.table('assessment_invitations').insert(base_payload).execute()
    except Exception as exc:
        if _is_missing_column_error(exc, 'application_id') or _is_missing_column_error(exc, 'job_id'):
            fallback_payload = dict(base_payload)
            fallback_payload.pop('application_id', None)
            fallback_payload.pop('job_id', None)
            invitation_response = supabase.table('assessment_invitations').insert(fallback_payload).execute()
        else:
            raise

    if not invitation_response.data:
        raise HTTPException(status_code=500, detail='Failed to create invitation')

    invitation_id = invitation_response.data[0]['id']

    try:
        link = f'https://jobshaman.cz/assessment/{invitation_id}?token={invitation_token}'
        send_email(
            to_email=invitation_req.candidate_email,
            subject=f"🎯 Assessment Invitation from {user.get('company_name')}",
            html=f"<p>Hello, you have been invited to an assessment. Start here: <a href='{link}'>Link</a></p>",
        )
    except Exception:
        pass

    return {'status': 'success', 'invitation_id': invitation_id, 'invitation_token': invitation_token}


@router.get('/company-library')
@limiter.limit('60/minute')
async def list_company_assessment_library(request: Request, user: dict = Depends(get_current_user)):
    if not supabase:
        raise HTTPException(status_code=503, detail='Database unavailable')

    company_id = require_company_access(user, user.get('company_id'))
    if not company_id:
        raise HTTPException(status_code=401, detail='User not authenticated')

    rows: List[Dict[str, Any]] = []
    try:
        resp = (
            supabase
            .table('assessments')
            .select('*')
            .eq('company_id', company_id)
            .order('createdAt', desc=True)
            .limit(50)
            .execute()
        )
        rows = resp.data or []
    except Exception as exc:
        if not _is_missing_column_error(exc, 'company_id'):
            raise HTTPException(status_code=500, detail=f'Failed to list company assessments: {exc}')

        known_ids: List[str] = []
        try:
            inv_resp = (
                supabase
                .table('assessment_invitations')
                .select('assessment_id')
                .eq('company_id', company_id)
                .order('created_at', desc=True)
                .limit(50)
                .execute()
            )
            for row in inv_resp.data or []:
                assessment_id = str((row or {}).get('assessment_id') or '').strip()
                if assessment_id and assessment_id not in known_ids:
                    known_ids.append(assessment_id)
        except Exception:
            pass

        try:
            result_resp = (
                supabase
                .table('assessment_results')
                .select('assessment_id')
                .eq('company_id', company_id)
                .order('completed_at', desc=True)
                .limit(50)
                .execute()
            )
            for row in result_resp.data or []:
                assessment_id = str((row or {}).get('assessment_id') or '').strip()
                if assessment_id and assessment_id not in known_ids:
                    known_ids.append(assessment_id)
        except Exception:
            pass

        if known_ids:
            lib_resp = (
                supabase
                .table('assessments')
                .select('*')
                .in_('id', known_ids[:50])
                .execute()
            )
            rows = lib_resp.data or []

    return {'assessments': rows}


@router.post('/company-library/{assessment_id}/duplicate')
@limiter.limit('60/minute')
async def duplicate_company_assessment(
    assessment_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
):
    if not supabase:
        raise HTTPException(status_code=503, detail='Database unavailable')

    company_id = require_company_access(user, user.get('company_id'))
    if not company_id:
        raise HTTPException(status_code=401, detail='User not authenticated')

    source_row = None
    try:
        resp = (
            supabase
            .table('assessments')
            .select('*')
            .eq('id', assessment_id)
            .eq('company_id', company_id)
            .maybe_single()
            .execute()
        )
        source_row = resp.data if resp else None
    except Exception as exc:
        if not _is_missing_column_error(exc, 'company_id'):
            raise HTTPException(status_code=500, detail=f'Failed to load assessment: {exc}')
        resp = (
            supabase
            .table('assessments')
            .select('*')
            .eq('id', assessment_id)
            .maybe_single()
            .execute()
        )
        source_row = resp.data if resp else None

    if not source_row:
        raise HTTPException(status_code=404, detail='Assessment not found')

    copy_payload = {k: v for k, v in source_row.items() if k not in {'id'}}
    copy_payload['id'] = str(uuid4())
    copy_payload['title'] = f"{str(source_row.get('title') or source_row.get('role') or 'Assessment')} (Copy)"
    copy_payload['createdAt'] = datetime.now(timezone.utc).isoformat()
    copy_payload['company_id'] = company_id
    copy_payload['status'] = 'active'
    copy_payload['updated_at'] = datetime.now(timezone.utc).isoformat()

    try:
        insert_resp = supabase.table('assessments').insert(copy_payload).execute()
    except Exception as exc:
        if _is_missing_column_error(exc, 'company_id') or _is_missing_column_error(exc, 'status') or _is_missing_column_error(exc, 'updated_at'):
            fallback_payload = {k: v for k, v in copy_payload.items() if k not in {'company_id', 'status', 'updated_at', 'source_job_id'}}
            insert_resp = supabase.table('assessments').insert(fallback_payload).execute()
        else:
            raise HTTPException(status_code=500, detail=f'Failed to duplicate assessment: {exc}')

    if not insert_resp.data:
        raise HTTPException(status_code=500, detail='Failed to duplicate assessment')

    return {'assessment': insert_resp.data[0]}


@router.patch('/company-library/{assessment_id}/status')
@limiter.limit('60/minute')
async def update_company_assessment_status(
    assessment_id: str,
    payload: AssessmentLibraryStatusUpdateRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    if not supabase:
        raise HTTPException(status_code=503, detail='Database unavailable')

    company_id = require_company_access(user, user.get('company_id'))
    if not company_id:
        raise HTTPException(status_code=401, detail='User not authenticated')

    try:
        (
            supabase
            .table('assessments')
            .update({'status': payload.status, 'updated_at': datetime.now(timezone.utc).isoformat()})
            .eq('id', assessment_id)
            .eq('company_id', company_id)
            .execute()
        )
    except Exception as exc:
        if _is_missing_column_error(exc, 'status') or _is_missing_column_error(exc, 'updated_at') or _is_missing_column_error(exc, 'company_id'):
            raise HTTPException(status_code=409, detail='Assessment library schema upgrade required')
        raise HTTPException(status_code=500, detail=f'Failed to update assessment status: {exc}')

    return {'status': 'success'}


@router.get('/invitations/{invitation_id}')
async def get_invitation_details(invitation_id: str, token: str = Query(...)):
    if not supabase:
        raise HTTPException(status_code=503, detail='Database unavailable')

    inv_resp = supabase.table('assessment_invitations').select('*').eq('id', invitation_id).execute()
    if not inv_resp.data:
        raise HTTPException(status_code=404, detail='Invitation not found')

    invitation = inv_resp.data[0]
    if invitation.get('invitation_token') != token:
        raise HTTPException(status_code=404, detail='Invitation not found')

    expires_at = datetime.fromisoformat(invitation['expires_at'].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=410, detail='Invitation has expired')

    if invitation['status'] == 'completed':
        existing_result = _find_existing_assessment_result(invitation_id)
        if existing_result:
            return {'status': 'success', 'result_id': existing_result.get('id'), 'deduplicated': True}
        raise HTTPException(status_code=410, detail='Invitation is no longer valid')

    if invitation['status'] == 'revoked':
        raise HTTPException(status_code=410, detail='Invitation is no longer valid')

    comp_resp = supabase.table('companies').select('name').eq('id', invitation['company_id']).execute()
    company_name = comp_resp.data[0]['name'] if comp_resp.data else 'Company'

    return {**invitation, 'company_name': company_name}


@router.post('/invitations/{invitation_id}/submit')
@limiter.limit('10/minute')
async def submit_assessment_result(request: Request, invitation_id: str, result_req: AssessmentResultRequest, token: str = Query(...)):
    inv_resp = supabase.table('assessment_invitations').select('*').eq('id', invitation_id).execute()
    if not inv_resp.data:
        raise HTTPException(status_code=404, detail='Invitation not found')

    invitation = inv_resp.data[0]
    if invitation['invitation_token'] != token:
        raise HTTPException(status_code=404, detail='Invitation not found')

    expires_at = datetime.fromisoformat(invitation['expires_at'].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=410, detail='Invitation has expired')

    if invitation['status'] == 'completed':
        existing_result = _find_existing_assessment_result(invitation_id)
        if existing_result:
            return {'status': 'success', 'result_id': existing_result.get('id'), 'deduplicated': True}
        raise HTTPException(status_code=410, detail='Invitation is no longer valid')

    if invitation['status'] == 'revoked':
        raise HTTPException(status_code=410, detail='Invitation is no longer valid')

    answers = result_req.answers if isinstance(result_req.answers, dict) else {}
    journey_payload = answers if isinstance(answers.get('decision_pattern'), dict) else {}

    if not journey_payload:
        feedback_payload: Dict[str, Any] = {}
        try:
            feedback_payload = json.loads(result_req.feedback or '{}') if result_req.feedback else {}
        except Exception:
            feedback_payload = {'raw_feedback': result_req.feedback}
        embedded_payload = feedback_payload.get('assessment_payload') if isinstance(feedback_payload, dict) else None
        if isinstance(embedded_payload, dict):
            journey_payload = embedded_payload

    if not journey_payload:
        text_parts = []
        technical = answers.get('technical') if isinstance(answers.get('technical'), dict) else {}
        text_parts.extend(str(v) for v in technical.values())
        derived_decision = _analyze_decision_pattern(text_parts)
        derived_energy = _analyze_energy_balance(text_parts)
        derived_culture = _analyze_culture(text_parts)
        journey_payload = {
            'journey_version': 'journey-v1',
            'technical': technical,
            'psychometric': answers.get('psychometric') if isinstance(answers.get('psychometric'), dict) else {},
            'decision_pattern': derived_decision,
            'behavioral_consistency': _analyze_consistency(text_parts),
            'energy_balance': derived_energy,
            'cultural_orientation': derived_culture,
            'journey_trace': {'phase_events': [], 'micro_insights': [], 'mode_switches': []},
            'final_profile': _build_final_profile(derived_decision, derived_energy, derived_culture),
            'ai_disclaimer': {'text': 'AI poskytuje interpretaci vzorců. Rozhodnutí je na vás.', 'shown_at_phase': [1, 2, 3, 4, 5]},
            'assessment_mode_used': 'classic',
            'mode_switch_count': 0,
            'mode_switch_timestamps': [],
        }

    quality_index = _journey_quality_index(journey_payload)
    invitation_metadata = invitation.get('metadata') if isinstance(invitation.get('metadata'), dict) else {}
    application_id = invitation.get('application_id') or invitation_metadata.get('application_id')
    job_id = invitation.get('job_id')
    if job_id is None:
        job_id = _safe_assessment_job_id(invitation_metadata.get('job_id'))

    base_row = {
        'company_id': invitation['company_id'],
        'candidate_id': invitation['candidate_id'],
        'invitation_id': invitation_id,
        'application_id': application_id,
        'job_id': job_id,
        'assessment_id': result_req.assessment_id,
        'role': result_req.role,
        'difficulty': result_req.difficulty,
        'questions_total': result_req.questions_total,
        'questions_correct': 0,
        'score': quality_index,
        'score_percent': quality_index,
        'time_spent_seconds': result_req.time_spent_seconds,
        'feedback': result_req.feedback,
        'completed_at': datetime.now(timezone.utc).isoformat(),
        'answers': journey_payload,
        'journey_version': 'journey-v1',
        'journey_payload': journey_payload,
        'decision_pattern': journey_payload.get('decision_pattern') or {},
        'energy_balance': journey_payload.get('energy_balance') or {},
        'cultural_orientation': journey_payload.get('cultural_orientation') or {},
        'transferable_strengths': (journey_payload.get('final_profile') or {}).get('transferable_strengths') or [],
        'risk_zones': (journey_payload.get('final_profile') or {}).get('risk_zones') or [],
        'amplify_environments': (journey_payload.get('final_profile') or {}).get('amplify_environments') or [],
        'drain_environments': (journey_payload.get('final_profile') or {}).get('drain_environments') or [],
        'legacy_mapped': not bool(answers.get('decision_pattern')),
        'journey_quality_index': quality_index,
    }

    existing_result = _find_existing_assessment_result(invitation_id)
    wrote_new_result = existing_result is None

    if existing_result and existing_result.get('id'):
        update_payload = dict(base_row)
        update_payload.pop('invitation_id', None)
        try:
            result_response = (
                supabase
                .table('assessment_results')
                .update(update_payload)
                .eq('id', existing_result['id'])
                .execute()
            )
        except Exception as exc:
            if _is_missing_column_error(exc, 'application_id') or _is_missing_column_error(exc, 'job_id'):
                fallback_payload = dict(update_payload)
                fallback_payload.pop('application_id', None)
                fallback_payload.pop('job_id', None)
                result_response = (
                    supabase
                    .table('assessment_results')
                    .update(fallback_payload)
                    .eq('id', existing_result['id'])
                    .execute()
                )
            else:
                raise
    else:
        try:
            result_response = supabase.table('assessment_results').insert(base_row).execute()
        except Exception as exc:
            if _is_missing_column_error(exc, 'application_id') or _is_missing_column_error(exc, 'job_id'):
                fallback_row = dict(base_row)
                fallback_row.pop('application_id', None)
                fallback_row.pop('job_id', None)
                result_response = supabase.table('assessment_results').insert(fallback_row).execute()
            else:
                raise
    if not result_response.data:
        raise HTTPException(status_code=500, detail='Failed to save results')

    supabase.table('assessment_invitations').update({
        'status': 'completed',
        'completed_at': datetime.now(timezone.utc).isoformat(),
    }).eq('id', invitation_id).execute()

    if wrote_new_result:
        try:
            supabase.rpc('increment_assessment_usage', {'company_id': invitation['company_id']}).execute()
        except Exception:
            pass

    result_id = None
    if isinstance(result_response.data, list) and result_response.data:
        result_id = result_response.data[0].get('id')

    return {'status': 'success', 'result_id': result_id, 'deduplicated': not wrote_new_result}


@router.get('/invitations')
async def list_invitations(user: dict = Depends(get_current_user)):
    is_company = bool(user.get('company_name'))

    if is_company:
        company_id = require_company_access(user, user.get('company_id'))
        resp = supabase.table('assessment_invitations').select('*').eq('company_id', company_id).order('created_at', desc=True).execute()
    else:
        resp = supabase.table('assessment_invitations').select('*').eq('candidate_email', user.get('email')).order('created_at', desc=True).execute()

    return {'invitations': resp.data or []}
