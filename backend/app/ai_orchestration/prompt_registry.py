from typing import Optional

from ..core.database import supabase

DEFAULT_PROMPTS = {
    "profile_generate": {
        "version": "v1",
        "system_prompt": (
            "You are a senior career strategist. Analyze the user career story and "
            "return strict JSON only, matching the required response schema."
        ),
    }
}


def get_prompt(feature: str, requested_version: Optional[str] = None) -> tuple[str, str]:
    default = DEFAULT_PROMPTS.get(feature)
    if not default:
        raise ValueError(f"Unknown prompt feature: {feature}")

    if not supabase:
        return default["version"], default["system_prompt"]

    try:
        query = supabase.table("ai_prompt_versions").select("version, system_prompt, is_active").eq("name", feature)
        if requested_version:
            query = query.eq("version", requested_version)
        else:
            query = query.eq("is_active", True)
        resp = query.order("created_at", desc=True).limit(1).execute()
        row = (resp.data or [None])[0]
        if row and row.get("system_prompt"):
            return row.get("version") or default["version"], row["system_prompt"]
    except Exception as exc:
        print(f"⚠️ [AI Prompt Registry] failed to load prompt from DB: {exc}")

    return default["version"], default["system_prompt"]
