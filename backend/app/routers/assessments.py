import secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Request, Depends, HTTPException, Query
from ..core.limiter import limiter
from ..core.security import get_current_user, require_company_access
from ..models.requests import AssessmentInvitationRequest, AssessmentResultRequest
from ..core.database import supabase
from ..services.email import send_email
from ..utils.helpers import now_iso

router = APIRouter()

def generate_invitation_token():
    return secrets.token_urlsafe(32)

@router.post("/invitations/create")
@limiter.limit("100/minute")
async def create_assessment_invitation(invitation_req: AssessmentInvitationRequest, request: Request, user: dict = Depends(get_current_user)):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    company_id = require_company_access(user, user.get("company_id"))
    if not company_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    if not user.get("company_name"):
        raise HTTPException(status_code=403, detail="Only company admins can send invitations")
    if company_id not in user.get("authorized_ids", []):
        raise HTTPException(status_code=403, detail="Unauthorized")

    # Assessment verification
    assessment_check = supabase.table("assessments").select("id").eq("id", invitation_req.assessment_id).single().execute()
    if not assessment_check.data:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Subscription check
    tier_check = supabase.table("subscriptions").select("tier").eq("company_id", company_id).eq("status", "active").execute()
    if not tier_check.data:
        raise HTTPException(status_code=403, detail="Active subscription required")
    
    tier = tier_check.data[0].get("tier")
    if tier not in ["starter", "growth", "professional", "enterprise"]:
        raise HTTPException(status_code=403, detail="Tier not allowed to send invitations")

    invitation_token = generate_invitation_token()
    expires_at = datetime.now(timezone.utc) + timedelta(days=invitation_req.expires_in_days)

    candidate_id = invitation_req.candidate_id
    if not candidate_id and invitation_req.candidate_email:
        cand_resp = supabase.table("profiles").select("id").eq("email", invitation_req.candidate_email).execute()
        if cand_resp.data: candidate_id = cand_resp.data[0]["id"]

    invitation_response = supabase.table("assessment_invitations").insert({
        "company_id": company_id,
        "assessment_id": invitation_req.assessment_id,
        "candidate_id": candidate_id,
        "candidate_email": invitation_req.candidate_email,
        "status": "pending",
        "invitation_token": invitation_token,
        "expires_at": expires_at.isoformat(),
        "metadata": invitation_req.metadata or {},
    }).execute()

    if not invitation_response.data:
        raise HTTPException(status_code=500, detail="Failed to create invitation")

    invitation_id = invitation_response.data[0]["id"]

    # Send Email
    try:
        link = f"https://jobshaman.cz/assessment/{invitation_id}?token={invitation_token}"
        send_email(
            to_email=invitation_req.candidate_email,
            subject=f"🎯 Assessment Invitation from {user.get('company_name')}",
            html=f"<p>Hello, you have been invited to an assessment. Start here: <a href='{link}'>Link</a></p>"
        )
    except: pass

    return {"status": "success", "invitation_id": invitation_id, "invitation_token": invitation_token}

@router.get("/invitations/{invitation_id}")
async def get_invitation_details(invitation_id: str, token: str = Query(...)):
    if not supabase: raise HTTPException(status_code=503, detail="Database unavailable")
    
    inv_resp = supabase.table("assessment_invitations").select("*").eq("id", invitation_id).execute()
    if not inv_resp.data: raise HTTPException(status_code=404, detail="Invitation not found")
    
    invitation = inv_resp.data[0]
    if invitation.get("invitation_token") != token:
        raise HTTPException(status_code=404, detail="Invitation not found")

    expires_at = datetime.fromisoformat(invitation["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=410, detail="Invitation has expired")

    if invitation["status"] in ["completed", "revoked"]:
        raise HTTPException(status_code=410, detail="Invitation is no longer valid")

    comp_resp = supabase.table("companies").select("name").eq("id", invitation["company_id"]).execute()
    company_name = comp_resp.data[0]["name"] if comp_resp.data else "Company"

    return {**invitation, "company_name": company_name}

@router.post("/invitations/{invitation_id}/submit")
@limiter.limit("10/minute")
async def submit_assessment_result(request: Request, invitation_id: str, result_req: AssessmentResultRequest, token: str = Query(...)):
    inv_resp = supabase.table("assessment_invitations").select("*").eq("id", invitation_id).execute()
    if not inv_resp.data: raise HTTPException(status_code=404, detail="Invitation not found")
    
    invitation = inv_resp.data[0]
    if invitation["invitation_token"] != token:
        raise HTTPException(status_code=404, detail="Invitation not found")

    expires_at = datetime.fromisoformat(invitation["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=410, detail="Invitation has expired")

    if invitation["status"] in ["completed", "revoked"]:
        raise HTTPException(status_code=410, detail="Invitation is no longer valid")

    # Create assessment result
    result_response = supabase.table("assessment_results").insert({
        "company_id": invitation["company_id"],
        "candidate_id": invitation["candidate_id"],
        "invitation_id": invitation_id,
        "assessment_id": result_req.assessment_id,
        "role": result_req.role,
        "difficulty": result_req.difficulty,
        "questions_total": result_req.questions_total,
        "questions_correct": result_req.questions_correct,
        "score": result_req.score,
        "time_spent_seconds": result_req.time_spent_seconds,
        "answers": result_req.answers,
        "feedback": result_req.feedback,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }).execute()

    if not result_response.data:
        raise HTTPException(status_code=500, detail="Failed to save results")

    # Update invitation status
    supabase.table("assessment_invitations").update({
        "status": "completed",
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", invitation_id).execute()

    # Increment usage via RPC
    try:
        supabase.rpc("increment_assessment_usage", {"company_id": invitation["company_id"]}).execute()
    except: pass

    return {"status": "success"}

@router.get("/invitations")
async def list_invitations(user: dict = Depends(get_current_user)):
    user_id = user.get("id") or user.get("auth_id")
    is_company = bool(user.get("company_name"))
    
    if is_company:
        company_id = require_company_access(user, user.get("company_id"))
        resp = supabase.table("assessment_invitations").select("*").eq("company_id", company_id).order("created_at", desc=True).execute()
    else:
        resp = supabase.table("assessment_invitations").select("*").eq("candidate_email", user.get("email")).order("created_at", desc=True).execute()
    
    return {"invitations": resp.data or []}
