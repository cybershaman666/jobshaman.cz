def calculate_candidate_match(candidate: dict, job: dict):
    # Simplified heuristic matching
    match_score = 0
    reasons = []
    candidate_skills = [s.lower() for s in candidate.get("skills", [])]
    job_desc = job.get("description", "").lower()
    
    for skill in candidate_skills:
        if skill in job_desc:
            match_score += 10
            reasons.append(f"Odpovídá dovednost: {skill}")
            
    return min(100, match_score), reasons


def _normalize_text(value: str) -> str:
    return (value or "").lower().strip()


def calculate_job_match(candidate: dict, job: dict):
    match_score = 0
    reasons = []

    job_title = _normalize_text(job.get("title", ""))
    job_desc = _normalize_text(job.get("description", ""))
    job_location = _normalize_text(job.get("location", ""))

    # Skill match (cap 60)
    inferred = candidate.get("inferred_skills", []) or []
    strengths = candidate.get("strengths", []) or []
    leadership = candidate.get("leadership", []) or []
    combined_skills = list({s.strip().lower() for s in (candidate.get("skills", []) or []) + inferred + strengths + leadership if s})

    skill_hits = 0
    for skill in combined_skills:
        if skill and (skill in job_desc or skill in job_title):
            skill_hits += 1
            if skill_hits * 6 <= 60:
                match_score += 6
                reasons.append(f"Odpovídá dovednost: {skill}")

    # Title match
    candidate_title = _normalize_text(candidate.get("job_title", ""))
    if candidate_title and (candidate_title in job_title or job_title in candidate_title):
        match_score += 15
        reasons.append("Shoda v profesním zaměření")

    # Soft match: values / motivations (cap 10)
    soft_terms = (candidate.get("values", []) or []) + (candidate.get("motivations", []) or [])
    soft_hits = 0
    for term in soft_terms:
        t = _normalize_text(term)
        if t and (t in job_desc or t in job_title):
            soft_hits += 1
            if soft_hits * 2 <= 10:
                match_score += 2
                reasons.append(f"Hodnoty/motivace: {t}")

    # Location or remote bonus
    address = _normalize_text(candidate.get("address", ""))
    remote_flags = ["remote", "home office", "homeoffice", "hybrid", "remote-first", "work from home"]
    if job_location and address and (job_location in address or address in job_location):
        match_score += 10
        reasons.append("Lokace odpovídá")
    elif any(flag in job_desc for flag in remote_flags):
        match_score += 10
        reasons.append("Remote/hybrid režim")

    return min(100, match_score), reasons
