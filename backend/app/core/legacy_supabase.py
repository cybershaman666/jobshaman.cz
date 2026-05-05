import os
from typing import Any, Dict

from supabase import create_client


def _supabase_config() -> tuple[str | None, str | None]:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
    key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_SERVICE_KEY")
        or os.environ.get("SUPABASE_KEY")
        or os.environ.get("VITE_SUPABASE_KEY")
        or os.environ.get("VITE_SUPABASE_ANON_KEY")
    )
    return url, key


def get_legacy_supabase_client():
    url, key = _supabase_config()
    if not url or not key:
        return None
    return create_client(url, key)


def _safe_row(response: Any) -> Dict[str, Any]:
    data = getattr(response, "data", None)
    return data if isinstance(data, dict) else {}


def _safe_rows(response: Any) -> list[Dict[str, Any]]:
    data = getattr(response, "data", None)
    return [row for row in data if isinstance(row, dict)] if isinstance(data, list) else []


def fetch_legacy_jcfpm_latest(supabase_id: str) -> Dict[str, Any]:
    client = get_legacy_supabase_client()
    if not client or not supabase_id:
        return {}

    try:
        rows = _safe_rows(
            client.table("jcfpm_results")
            .select("*")
            .eq("user_id", supabase_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        row = rows[0] if rows else {}
    except Exception:
        row = {}

    if not row:
        return {}

    return {
        "schema_version": row.get("version") or "jcfpm-v1",
        "completed_at": row.get("created_at") or row.get("updated_at"),
        "responses": row.get("raw_responses") or {},
        "dimension_scores": row.get("dimension_scores") or [],
        "fit_scores": row.get("fit_scores") or [],
        "ai_report": row.get("ai_report"),
        "confidence": row.get("confidence"),
    }


def fetch_legacy_user_profile(supabase_id: str) -> Dict[str, Any]:
    client = get_legacy_supabase_client()
    if not client or not supabase_id:
        return {}

    profile: Dict[str, Any] = {}
    candidate: Dict[str, Any] = {}

    try:
        profile = _safe_row(
            client.table("profiles")
            .select("*")
            .eq("id", supabase_id)
            .maybe_single()
            .execute()
        )
    except Exception:
        profile = {}

    try:
        candidate = _safe_row(
            client.table("candidate_profiles")
            .select("*")
            .eq("id", supabase_id)
            .maybe_single()
            .execute()
        )
    except Exception:
        candidate = {}

    if not profile and not candidate:
        return {}

    legacy_jcfpm = fetch_legacy_jcfpm_latest(supabase_id)

    return {
        "profile": profile,
        "candidate": candidate,
        "jcfpm": legacy_jcfpm,
    }


def fetch_legacy_company_for_user(supabase_id: str, email: str | None = None) -> Dict[str, Any]:
    client = get_legacy_supabase_client()
    if not client or not (supabase_id or email):
        return {}

    def fetch_company_rows(column: str, value: str) -> list[Dict[str, Any]]:
        try:
            return _safe_rows(
                client.table("companies")
                .select("*")
                .eq(column, value)
                .limit(1)
                .execute()
            )
        except Exception:
            return []

    candidate_user_ids = [str(supabase_id)] if supabase_id else []
    if email:
        try:
            for page in range(1, 20):
                users = client.auth.admin.list_users(page=page, per_page=1000)
                user_rows = users if isinstance(users, list) else (getattr(users, "users", None) or [])
                for user in user_rows:
                    if getattr(user, "email", None) == email:
                        user_id = str(getattr(user, "id", "") or "")
                        if user_id and user_id not in candidate_user_ids:
                            candidate_user_ids.append(user_id)
                if len(user_rows) < 1000:
                    break
        except Exception:
            pass

    company: Dict[str, Any] = {}
    for user_id in candidate_user_ids:
        for column in ("owner_id", "created_by", "id"):
            rows = fetch_company_rows(column, user_id)
            if rows:
                company = rows[0]
                break
        if company:
            break

    if not company:
        for user_id in candidate_user_ids:
            try:
                membership_rows = _safe_rows(
                    client.table("company_members")
                    .select("company_id")
                    .eq("user_id", user_id)
                    .limit(1)
                    .execute()
                )
            except Exception:
                membership_rows = []

            company_id = membership_rows[0].get("company_id") if membership_rows else None
            if company_id:
                rows = fetch_company_rows("id", str(company_id))
                if rows:
                    company = rows[0]
                    break

    if not company:
        return {}

    try:
        member_rows = _safe_rows(
            client.table("company_members")
            .select("*")
            .eq("company_id", str(company.get("id")))
            .execute()
        )
    except Exception:
        member_rows = []

    company["members"] = member_rows
    return company


def list_legacy_registered_candidates(limit: int = 100) -> list[Dict[str, Any]]:
    """
    Fetch a list of registered candidates from the legacy Supabase tables.
    This includes both basic profile info and extended candidate profile info.
    """
    client = get_legacy_supabase_client()
    if not client:
        return []

    try:
        # 1. Fetch candidate profiles (which indicates they are candidates)
        candidate_rows = _safe_rows(
            client.table("candidate_profiles")
            .select("*")
            .limit(limit)
            .execute()
        )
        if not candidate_rows:
            return []

        uids = [row["id"] for row in candidate_rows]

        # 2. Fetch corresponding basic profiles
        profile_rows = _safe_rows(
            client.table("profiles")
            .select("*")
            .in_("id", uids)
            .execute()
        )
        profile_map = {row["id"]: row for row in profile_rows}

        # 3. Assemble results
        results = []
        for cand in candidate_rows:
            uid = cand["id"]
            prof = profile_map.get(uid, {})
            results.append({
                "supabase_id": uid,
                "profile": prof,
                "candidate": cand,
            })
        return results
    except Exception as e:
        print(f"Error fetching legacy candidates: {e}")
        return []
