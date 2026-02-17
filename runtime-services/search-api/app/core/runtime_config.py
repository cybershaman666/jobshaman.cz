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
                if resp and getattr(resp, "data", None):
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


def get_scoring_model_by_version(version: str) -> Optional[Dict[str, Any]]:
    if not version:
        return None

    cache_key = f"scoring:version:{version}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    if not supabase:
        return None

    try:
        row = (
            supabase.table("scoring_model_versions")
            .select("version, alpha_skill, beta_demand, gamma_seniority, delta_salary, epsilon_geo")
            .eq("version", version)
            .limit(1)
            .execute()
        )
        data = (row.data or [None])[0]
        if not data:
            _cache_set(cache_key, None)
            return None

        out = {
            "version": data.get("version") or version,
            "weights": {
                "alpha_skill": float(data.get("alpha_skill") or 0),
                "beta_demand": float(data.get("beta_demand") or 0),
                "gamma_seniority": float(data.get("gamma_seniority") or 0),
                "delta_salary": float(data.get("delta_salary") or 0),
                "epsilon_geo": float(data.get("epsilon_geo") or 0),
            },
        }
        _cache_set(cache_key, out)
        return out
    except Exception as exc:
        print(f"⚠️ [Runtime Config] failed loading scoring version {version}: {exc}")
        return None


def resolve_scoring_model_for_user(user_id: str, feature: str = "recommendations") -> Dict[str, Any]:
    """
    Deterministic user -> scoring_version mapping using model_experiments:
      bucket = hash(f\"{experiment_key}:{user_id}\") % 100
      if bucket < traffic_percent => candidate_version else control_version
    Assignment is persisted in model_experiment_assignments.
    """
    active = get_active_scoring_model()
    if not supabase or not user_id:
        return {**active, "assignment_source": "active_default", "bucket": None, "experiment_key": None}

    try:
        exp = (
            supabase.table("model_experiments")
            .select("experiment_key, control_version, candidate_version, traffic_percent")
            .eq("subsystem", "matching")
            .eq("feature", feature)
            .eq("is_enabled", True)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        experiment = (exp.data or [None])[0]
        if not experiment:
            return {**active, "assignment_source": "active_default", "bucket": None, "experiment_key": None}

        experiment_key = experiment.get("experiment_key")
        traffic = int(experiment.get("traffic_percent") or 0)
        control_version = experiment.get("control_version") or active["version"]
        candidate_version = experiment.get("candidate_version") or active["version"]

        bucket = _stable_rollout_bucket(f"{experiment_key}:{user_id}")
        selected_version = candidate_version if bucket < traffic else control_version

        selected = get_scoring_model_by_version(selected_version) or active

        assignment_payload = {
            "experiment_key": experiment_key,
            "user_id": user_id,
            "subsystem": "matching",
            "feature": feature,
            "assigned_version": selected.get("version") or active["version"],
            "bucket": bucket,
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        try:
            supabase.table("model_experiment_assignments").upsert(
                assignment_payload,
                on_conflict="experiment_key,user_id",
            ).execute()
        except Exception as exc:
            print(f"⚠️ [Runtime Config] failed to persist model experiment assignment: {exc}")

        return {
            **selected,
            "assignment_source": "experiment",
            "bucket": bucket,
            "experiment_key": experiment_key,
        }
    except Exception as exc:
        print(f"⚠️ [Runtime Config] failed resolving scoring experiment: {exc}")
        return {**active, "assignment_source": "active_default", "bucket": None, "experiment_key": None}


def get_active_action_prediction_model(model_key: str = "job_apply_probability") -> Dict[str, Any]:
    cache_key = f"action_model:{model_key}:active"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    defaults = {
        "model_key": model_key,
        "version": "v1",
        "objective": "apply_click_probability",
        "coefficients_json": {
            "intercept": -2.15,
            "similarity_score": 1.20,
            "skill_match": 1.55,
            "salary_alignment": 0.70,
            "seniority_alignment": 0.80,
            "recency_score": 0.35,
            "location_distance_km": -0.015,
        },
        "feature_schema_json": {},
    }

    if not supabase:
        return defaults

    try:
        row = (
            supabase.table("action_prediction_models")
            .select("model_key, version, objective, coefficients_json, feature_schema_json")
            .eq("model_key", model_key)
            .eq("is_active", True)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        data = (row.data or [None])[0]
        if data:
            out = {
                "model_key": data.get("model_key") or model_key,
                "version": data.get("version") or "v1",
                "objective": data.get("objective") or "apply_click_probability",
                "coefficients_json": data.get("coefficients_json") or defaults["coefficients_json"],
                "feature_schema_json": data.get("feature_schema_json") or {},
            }
            _cache_set(cache_key, out)
            return out
    except Exception as exc:
        print(f"⚠️ [Runtime Config] failed loading action prediction model {model_key}: {exc}")

    _cache_set(cache_key, defaults)
    return defaults
