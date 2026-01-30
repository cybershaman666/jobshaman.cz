import re

def check_legality_rules(title: str, company: str, description: str):
    risk_score = 0.0
    reasons = []
    
    suspicious_patterns = [
        (r"výdělek.*bez práce", "Slibuje výdělek bez práce"),
        (r"rychlé peníze", "Slibuje podezřele rychlé peníze"),
        (r"poplatek.*předem", "Vyžaduje poplatky předem"),
        (r"žádná praxe nevyžadována.*2000.*hodinu", "Nerealistický plat pro začátečníky"),
    ]
    
    for pattern, reason in suspicious_patterns:
        if re.search(pattern, description.lower()) or re.search(pattern, title.lower()):
            risk_score += 0.5
            reasons.append(reason)
            
    is_legal = risk_score < 0.7
    needs_manual_review = 0.3 <= risk_score < 0.7
    
    return risk_score, is_legal, reasons, needs_manual_review
