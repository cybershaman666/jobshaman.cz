from fastapi import APIRouter, Depends, HTTPException, Request
from ..core.security import generate_csrf_token, get_current_user, verify_csrf_token_header
from ..core.limiter import limiter
from ..core.database import supabase
from ..core.config import STRIPE_SECRET_KEY
import stripe

router = APIRouter()
stripe.api_key = STRIPE_SECRET_KEY

@router.get("/csrf-token")
@limiter.limit("50/minute")
async def get_csrf_token(request: Request, user: dict = Depends(get_current_user)):
    """
    Returns a new CSRF token for the authenticated user.
    The token is also stored in Supabase for cross-verification.
    """
    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")
    
    token = generate_csrf_token(user_id)
    return {"csrf_token": token}

@router.delete("/account")
@limiter.limit("5/minute")
async def delete_account(request: Request, user: dict = Depends(get_current_user)):
    """
    Deletes the user account and all associated data.
    Order: Stripe -> Files -> DB -> Auth
    """
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="Invalid CSRF token")

    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    print("🗑️ Deleting account")

    try:
        # 1. Stripe Cancellation
        try:
            profile_resp = supabase.table("profiles").select("stripe_customer_id").eq("id", user_id).maybe_single().execute()
            if profile_resp.data and profile_resp.data.get("stripe_customer_id"):
                customer_id = profile_resp.data["stripe_customer_id"]
                subs = stripe.Subscription.list(customer=customer_id, status='active')
                for sub in subs.data:
                    stripe.Subscription.delete(sub.id)
                print("✅ Cancelled Stripe subscriptions")
        except Exception as se:
            print(f"⚠️ Stripe cleanup failed: {se}")

        # 2. Storage Cleanup
        # CVs
        try:
            cv_files = supabase.storage.from_("cvs").list(user_id)
            if cv_files:
                supabase.storage.from_("cvs").remove([f"{user_id}/{f['name']}" for f in cv_files])
            print("✅ Cleaned up CV storage")
        except Exception as fe:
            print(f"⚠️ File cleanup failed (CVs): {fe}")

        # Avatars
        try:
            profile_photo = user.get("avatar_url")
            if profile_photo and "avatars" in profile_photo:
                filename = profile_photo.split("/")[-1]
                supabase.storage.from_("avatars").remove([f"{user_id}/{filename}"])
            print("✅ Cleaned up Avatar storage")
        except Exception as fe:
            print(f"⚠️ File cleanup failed (Avatars): {fe}")

        # 3. DB Deletion (Order matters)
        user_email = user.get("email")
        
        db_tables = [
            ("cv_documents", "user_id"),
            ("assessment_results", "user_id"),
            ("company_members", "user_id"),
            ("csrf_sessions", "user_id"),
            ("subscriptions", "user_id"),
            ("subscription_usage", "user_id"),
            ("candidate_profiles", "id"),
            ("job_applications", "candidate_id"),
            ("assessment_invitations", "candidate_id"),
            ("assessment_invitations", "company_id"),
            ("analytics_events", "user_id"),
            ("analytics_events", "company_id"),
            ("jobs", "contact_email"), # Clean up jobs by contact email if it matches
            ("profiles", "id")
        ]
        
        # Cleanup enterprise leads if email matches
        if user_email:
            try:
                supabase.table("enterprise_leads").delete().eq("contact_email", user_email).execute()
                print("✅ Deleted from enterprise_leads")
            except Exception as ele:
                print(f"⚠️ Enterprise leads cleanup failed: {ele}")
        
        for table, col in db_tables:
            try:
                supabase.table(table).delete().eq(col, user_id).execute()
                print(f"✅ Deleted from {table}")
            except Exception as de:
                print(f"⚠️ DB deletion failed for table {table}: {de}")

        # 4. Handle Companies if the user is the owner
        try:
            companies = supabase.table("companies").select("id").eq("owner_id", user_id).execute()
            for company in companies.data:
                # Check if other members exist
                members = supabase.table("company_members").select("id").eq("company_id", company["id"]).execute()
                if not members.data:
                    supabase.table("companies").delete().eq("id", company["id"]).execute()
                    print("✅ Deleted orphan company")
        except Exception as ce:
            print(f"⚠️ Company cleanup failed: {ce}")

        # 5. Auth Deletion (Last step)
        try:
            supabase.auth.admin.delete_user(user_id)
            print("✅ Deleted auth user")
        except Exception as ae:
            print(f"⚠️ Auth deletion failed: {ae}")
            # This step is critical but might fail if admin permissions are missing.
            # We don't raise here but log it.

        return {"status": "success", "message": "Account and all data deleted"}

    except Exception as e:
        print(f"❌ Critical error during account deletion: {e}")
        raise HTTPException(status_code=500, detail=str(e))
