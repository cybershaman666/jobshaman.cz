import hashlib
import time
from typing import Any, Dict, Optional

from .database import supabase

_CACHE_TTL_SECONDS = 30
_cache: Dict[str, Dict[str, Any]] = {}


def _cache_get(key: str):
    item = _cache.get(key)
    if not item:
        return None
    if time.time() - item["ts"] > _CACHE_TTL_SECONDS:
        _cache.pop(key, None)
        return None
    return item["value"]


def _cache_set(key: str, value: Any):
    _cache[key] = {"ts": time.time(), "value": value}


def _stable_rollout_bucket(subject: str) -> int:
    if not subject:
        return 0
    digest = hashlib.sha256(subject.encode("utf-8")).hexdigest()
    return int(digest[:8], 16) % 100


def get_release_flag(flag_key: str, subject_id: Optional[str] = None, default: bool = True) -> Dict[str, Any]:
    cache_key = f"flag:{flag_key}"
    cached = _cache_get(cache_key)
    if cached is not None:
        flag = cached
    else:
        flag = {
            "flag_key": flag_key,
            "is_enabled": default,
            "rollout_percent": 100,
            "variant": None,
            "config_json": {},
        }
        if supabase:
            try:
                resp = (
                    supabase.table("release_flags")
                    .select("flag_key, is_enabled, rollout_percent, variant, config_json")
                    .eq("flag_key", flag_key)
                    .maybe_single()
                    .execute()
                )
                if resp.data:
                    flag.update(resp.data)
            except Exception as exc:
                print(f"⚠️ [Runtime Config] failed loading release flag {flag_key}: {exc}")
        _cache_set(cache_key, flag)

    rollout = int(flag.get("rollout_percent") or 0)
    enabled = bool(flag.get("is_enabled", False))
    if enabled and rollout < 100 and subject_id:
        enabled = _stable_rollout_bucket(subject_id) < rollout

    return {
        **flag,
        "effective_enabled": enabled,
    }


def get_active_model_config(subsystem: str, feature: str) -> Dict[str, Any]:
    cache_key = f"model:{subsystem}:{feature}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    defaults = {
        "version": "v1",
        "primary_model": None,
        "fallback_model": None,
        "temperature": 0,
        "top_p": 1,
        "top_k": 1,
        "config_json": {},
    }

    if not supabase:
        return defaults

    try:
        resp = (
            supabase.table("model_registry")
            .select("version, model_name, temperature, top_p, top_k, is_primary, is_fallback, config_json")
            .eq("subsystem", subsystem)
            .eq("feature", feature)
            .eq("is_active", True)
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )
        rows = resp.data or []
        if rows:
            first = rows[0]
            merged_config: Dict[str, Any] = {}
            for row in rows:
                cfg = row.get("config_json") or {}
                if isinstance(cfg, dict):
                    merged_config.update(cfg)
            out = {
                "version": first.get("version") or defaults["version"],
                "primary_model": None,
                "fallback_model": None,
                "temperature": first.get("temperature") if first.get("temperature") is not None else defaults["temperature"],
                "top_p": first.get("top_p") if first.get("top_p") is not None else defaults["top_p"],
                "top_k": first.get("top_k") if first.get("top_k") is not None else defaults["top_k"],
                "config_json": merged_config,
            }
            for row in rows:
                model_name = row.get("model_name")
                if row.get("is_primary") and model_name and not out["primary_model"]:
                    out["primary_model"] = model_name
                if row.get("is_fallback") and model_name and not out["fallback_model"]:
                    out["fallback_model"] = model_name
            if not out["primary_model"] and rows:
                out["primary_model"] = rows[0].get("model_name")
            _cache_set(cache_key, out)
            return out
    except Exception as exc:
        print(f"⚠️ [Runtime Config] failed loading model config {subsystem}/{feature}: {exc}")

    _cache_set(cache_key, defaults)
    return defaults


def get_active_scoring_model() -> Dict[str, Any]:
    cache_key = "scoring:active"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    defaults = {
        "version": "scoring-v1",
        "weights": {
            "alpha_skill": 0.35,
            "beta_demand": 0.15,
            "gamma_seniority": 0.15,
            "delta_salary": 0.15,
            "epsilon_geo": 0.20,
        },
    }

    if not supabase:
        return defaults

    try:
        row = (
            supabase.table("scoring_model_versions")
            .select(
                "version, alpha_skill, beta_demand, gamma_seniority, delta_salary, epsilon_geo"
            )
            .eq("is_active", True)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        data = (row.data or [None])[0]
        if data:
            out = {
                "version": data.get("version") or defaults["version"],
                "weights": {
                    "alpha_skill": float(data.get("alpha_skill") or defaults["weights"]["alpha_skill"]),
                    "beta_demand": float(data.get("beta_demand") or defaults["weights"]["beta_demand"]),
                    "gamma_seniority": float(data.get("gamma_seniority") or defaults["weights"]["gamma_seniority"]),
                    "delta_salary": float(data.get("delta_salary") or defaults["weights"]["delta_salary"]),
                    "epsilon_geo": float(data.get("epsilon_geo") or defaults["weights"]["epsilon_geo"]),
                },
            }
            _cache_set(cache_key, out)
            return out
    except Exception as exc:
        print(f"⚠️ [Runtime Config] failed loading scoring model: {exc}")

    _cache_set(cache_key, defaults)
    return defaults
