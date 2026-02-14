from typing import Dict, List


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


def extract_candidate_features(candidate: Dict) -> Dict:
    skills = _clean_list(candidate.get("skills"))
    inferred = _clean_list(candidate.get("inferred_skills") or candidate.get("inferredSkills"))
    strengths = _clean_list(candidate.get("strengths"))
    leadership = _clean_list(candidate.get("leadership"))
    values = _clean_list(candidate.get("values"))
    motivations = _clean_list(candidate.get("motivations"))
    preferences = _clean_list(candidate.get("work_preferences") or candidate.get("workPreferences"))

    text_chunks = [
        candidate.get("job_title") or candidate.get("jobTitle") or "",
        candidate.get("cv_text") or candidate.get("cvText") or "",
        candidate.get("cv_ai_text") or candidate.get("cvAiText") or "",
        candidate.get("story") or "",
        " ".join(skills + inferred + strengths + leadership + values + motivations + preferences),
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
        "text": "\n".join([chunk for chunk in text_chunks if chunk]).strip(),
    }


def extract_job_features(job: Dict) -> Dict:
    title = _norm(job.get("title") or "")
    description = _norm(job.get("description") or "")
    location = _norm(job.get("location") or "")
    tags = _clean_list(job.get("tags"))
    benefits = _clean_list(job.get("benefits"))

    return {
        "title": title,
        "description": description,
        "location": location,
        "country": _norm(job.get("country_code") or ""),
        "role": _norm(job.get("role") or title),
        "industry": _norm(job.get("industry") or ""),
        "salary_from": job.get("salary_from"),
        "salary_to": job.get("salary_to"),
        "currency": _norm(job.get("currency") or "czk"),
        "text": "\n".join([title, description, " ".join(tags), " ".join(benefits)]).strip(),
    }
