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
