from typing import Dict, List, Optional


def _norm(s: str) -> str:
    return (s or "").strip().lower()


def _clean_list(values) -> List[str]:
    if not values:
        return []
    if isinstance(values, str):
        values = [values]
    out = []
    seen = set()
    for value in values:
        v = _norm(str(value))
        if not v or v in seen:
            continue
        seen.add(v)
        out.append(v)
    return out


def _flatten_structured_entries(values) -> List[str]:
    if not values:
        return []
    if isinstance(values, str):
        return [_norm(values)]
    out: List[str] = []
    if isinstance(values, list):
        for item in values:
            if isinstance(item, dict):
                parts = []
                for key in ("role", "company", "duration", "description", "school", "degree", "field", "year"):
                    val = item.get(key)
                    if val:
                        parts.append(str(val))
                merged = _norm(" ".join(parts))
                if merged:
                    out.append(merged)
            else:
                normalized = _norm(str(item))
                if normalized:
                    out.append(normalized)
    return out


def extract_candidate_features(candidate: Dict, intelligence: Optional[Dict] = None) -> Dict:
    skills = _clean_list(candidate.get("skills"))
    inferred = _clean_list(candidate.get("inferred_skills") or candidate.get("inferredSkills"))
    strengths = _clean_list(candidate.get("strengths"))
    leadership = _clean_list(candidate.get("leadership"))
    values = _clean_list(candidate.get("values"))
    motivations = _clean_list(candidate.get("motivations"))
    preferences = _clean_list(candidate.get("work_preferences") or candidate.get("workPreferences"))
    work_history_entries = _flatten_structured_entries(candidate.get("work_history") or candidate.get("workHistory"))
    education_entries = _flatten_structured_entries(candidate.get("education"))
    intent_roles = _clean_list((intelligence or {}).get("target_roles"))
    adjacent_roles = _clean_list((intelligence or {}).get("adjacent_roles"))
    intent_keywords = _clean_list((intelligence or {}).get("priority_keywords"))
    avoid_keywords = _clean_list((intelligence or {}).get("avoid_keywords"))
    preferred_work_modes = _clean_list((intelligence or {}).get("preferred_work_modes"))
    primary_domain = _norm((intelligence or {}).get("primary_domain"))
    secondary_domains = _clean_list((intelligence or {}).get("secondary_domains"))
    intent_seniority = _norm((intelligence or {}).get("seniority"))
    canonical_target_roles = _clean_list((intelligence or {}).get("canonical_target_roles"))
    canonical_role_families = _clean_list((intelligence or {}).get("canonical_role_families"))
    canonical_domains = _clean_list((intelligence or {}).get("canonical_domains"))
    preferred_languages = _clean_list((intelligence or {}).get("preferred_languages"))
    preferred_market = _norm((intelligence or {}).get("preferred_market"))

    text_chunks = [
        candidate.get("job_title") or candidate.get("jobTitle") or "",
        candidate.get("cv_text") or candidate.get("cvText") or "",
        candidate.get("cv_ai_text") or candidate.get("cvAiText") or "",
        candidate.get("story") or "",
        " ".join(work_history_entries),
        " ".join(education_entries),
        " ".join(skills + inferred + strengths + leadership + values + motivations + preferences),
        " ".join(intent_roles + adjacent_roles + intent_keywords + preferred_work_modes),
        " ".join(canonical_target_roles + canonical_role_families + canonical_domains + preferred_languages),
        " ".join([primary_domain, *secondary_domains]),
        preferred_market,
    ]

    return {
        "skills": skills,
        "inferred": inferred,
        "strengths": strengths,
        "leadership": leadership,
        "values": values,
        "motivations": motivations,
        "preferences": preferences,
        "title": _norm(candidate.get("job_title") or candidate.get("jobTitle") or ""),
        "address": _norm(candidate.get("address") or ""),
        "intent_roles": intent_roles,
        "adjacent_roles": adjacent_roles,
        "intent_keywords": intent_keywords,
        "avoid_keywords": avoid_keywords,
        "preferred_work_modes": preferred_work_modes,
        "primary_domain": primary_domain,
        "secondary_domains": secondary_domains,
        "intent_seniority": intent_seniority,
        "canonical_target_roles": canonical_target_roles,
        "canonical_role_families": canonical_role_families,
        "canonical_domains": canonical_domains,
        "preferred_languages": preferred_languages,
        "preferred_market": preferred_market,
        "intelligence_source": _norm((intelligence or {}).get("source")),
        "text": "\n".join([chunk for chunk in text_chunks if chunk]).strip(),
    }


def extract_job_features(job: Dict) -> Dict:
    title = _norm(job.get("title") or "")
    description = _norm(job.get("description") or "")
    location = _norm(job.get("location") or "")
    tags = _clean_list(job.get("tags"))
    benefits = _clean_list(job.get("benefits"))
    job_intelligence = job.get("job_intelligence") if isinstance(job.get("job_intelligence"), dict) else {}
    canonical_role = _norm(job_intelligence.get("canonical_role") or "")
    canonical_role_id = _norm(job_intelligence.get("canonical_role_id") or "")
    canonical_role_family = _norm(job_intelligence.get("role_family") or "")
    canonical_domain = _norm(job_intelligence.get("domain_key") or "")
    canonical_seniority = _norm(job_intelligence.get("seniority") or "")
    canonical_work_mode = _norm(job_intelligence.get("work_mode") or "")
    language_code = _norm(job_intelligence.get("language_code") or job.get("language_code") or "")
    market_code = _norm(job_intelligence.get("market_code") or "")
    cluster_key = _norm(job_intelligence.get("cluster_key") or "")
    intelligence_keywords = _clean_list(job_intelligence.get("extracted_keywords"))
    intelligence_skills = _clean_list(job_intelligence.get("extracted_skills"))

    return {
        "title": title,
        "description": description,
        "location": location,
        "country": _norm(job.get("country_code") or ""),
        "role": canonical_role or _norm(job.get("role") or title),
        "industry": _norm(job.get("industry") or ""),
        "type": _norm(job.get("type") or ""),
        "work_model": _norm(job.get("work_model") or ""),
        "canonical_role": canonical_role,
        "canonical_role_id": canonical_role_id,
        "canonical_role_family": canonical_role_family,
        "canonical_domain": canonical_domain,
        "canonical_seniority": canonical_seniority,
        "canonical_work_mode": canonical_work_mode,
        "language_code": language_code,
        "market_code": market_code,
        "cluster_key": cluster_key,
        "mapping_confidence": job_intelligence.get("mapping_confidence"),
        "mapping_source": _norm(job_intelligence.get("mapping_source") or ""),
        "intelligence_keywords": intelligence_keywords,
        "intelligence_skills": intelligence_skills,
        "salary_from": job.get("salary_from"),
        "salary_to": job.get("salary_to"),
        "currency": _norm(job.get("currency") or "czk"),
        "text": "\n".join(
            [
                title,
                description,
                location,
                canonical_role,
                canonical_role_family,
                canonical_domain,
                canonical_seniority,
                canonical_work_mode,
                language_code,
                market_code,
                _norm(job.get("type") or ""),
                _norm(job.get("work_model") or ""),
                " ".join(tags),
                " ".join(benefits),
                " ".join(intelligence_keywords),
                " ".join(intelligence_skills),
            ]
        ).strip(),
    }
