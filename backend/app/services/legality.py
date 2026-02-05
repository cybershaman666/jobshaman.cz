import re

def _infer_country(country_code: str | None, location: str | None, full_text: str) -> str | None:
    if country_code:
        return country_code.lower()
    loc = (location or "").lower()
    if any(k in loc for k in ["österreich", "austria", "wien", "vienna", "salzburg", "graz", "linz", "innsbruck"]):
        return "at"
    if any(k in loc for k in ["polska", "poland", "warszawa", "kraków", "krakow", "wroclaw", "gdańsk", "gdansk"]):
        return "pl"
    if any(k in loc for k in ["deutschland", "germany", "berlin", "münchen", "munchen", "hamburg", "köln", "koln"]):
        return "de"
    if any(k in loc for k in ["slovensko", "slovakia", "bratislava", "košice", "kosice"]):
        return "sk"
    if any(k in loc for k in ["česko", "cesko", "czech", "praha", "brno", "ostrava"]):
        return "cs"
    if "österreich" in full_text or "austria" in full_text:
        return "at"
    return None

def check_legality_rules(title: str, company: str, description: str, country_code: str | None = None, location: str | None = None):
    """
    Check job posting for illegal, scam, or suspicious content.
    Returns: (risk_score, is_legal, reasons, needs_manual_review)
    
    Risk Score Thresholds:
    - >= 1.0: Illegal (auto-reject)
    - 0.5-0.99: Needs manual review
    - < 0.5: Legal (auto-approve)
    """
    risk_score = 0.0
    reasons = []
    
    # Combine all text for checking
    full_text = f"{title} {company} {description}".lower()
    country = _infer_country(country_code, location, full_text)
    
    # CRITICAL PATTERNS - Immediate rejection (1.0+ risk each)
    critical_patterns = [
        # Scams & Fraud
        (r"(výdělek|peníze|zisk).*bez (práce|úsilí|investice)", "🚨 Slibuje výdělek bez práce - podezření na podvod", 1.0),
        (r"rychl[éý].*peníze|peníze.*rychle", "🚨 Slibuje rychlé peníze - typický scam", 1.0),
        (r"(poplatek|platba|zaplatit).*předem", "🚨 Vyžaduje platbu předem - podvod", 1.0),
        (r"garantovan[ýá].*výdělek", "🚨 Garantovaný výdělek - nereálné sliby", 1.0),
        
        # Illegal Activities
        (r"pilot.*letadlo|řidič.*letadla", "🚨 Nabídka pilota/letadla - mimo zaměření portálu", 1.0),
        (r"pašování|nelegální|černá práce", "🚨 Zmínka o nelegálních aktivitách", 1.0),
        (r"bez smlouvy|bez odvodu|na černo", "🚨 Práce na černo", 1.0),
        
        # MLM & Pyramid Schemes
        (r"(multi.*level|mlm|síťový marketing)", "🚨 MLM/Síťový marketing - podezřelý model", 1.0),
        (r"(buduj|vytvoř).*tým.*pod sebou", "🚨 Pyramidový systém", 1.0),
        (r"pasivní příjem|zisk.*spánku", "🚨 Pasivní příjem - typický MLM", 1.0),
        
        # Cryptocurrency Scams
        (r"(bitcoin|krypto|crypto).*záruka.*zisk", "🚨 Krypto scam s garantovaným ziskem", 1.0),
        (r"investice.*krypto.*bez rizika", "🚨 Podvodná krypto investice", 1.0),
    ]
    
    # HIGH RISK PATTERNS - Manual review required (0.5 risk each)
    high_risk_patterns = [
        # Unrealistic Promises
        (r"\d{4,}.*kč.*hodinu.*bez (zkušeností|praxe)", "⚠️ Nerealistický plat pro začátečníky", 0.5),
        (r"(50|60|70|80|90|100).*tisíc.*měsíc.*bez (zkušeností|praxe)", "⚠️ Podezřele vysoký plat bez požadavků", 0.5),
        (r"vydělávejte.*doma|práce.*z.*pohodlí", "⚠️ Práce z domu s podezřelými sliby", 0.4),
        
        # Suspicious Requirements
        (r"(investice|vklad|kapitál).*nutný", "⚠️ Vyžaduje investici od zaměstnance", 0.6),
        (r"kup.*produkt|zakup.*balíček", "⚠️ Vyžaduje nákup produktů", 0.6),
        (r"školení.*za.*poplatek", "⚠️ Placené školení před nástupem", 0.4),
        
        # MLM Indicators
        (r"(neomezen[ýá]|unlimited).*výdělek", "⚠️ Neomezený výdělek - typické pro MLM", 0.5),
        (r"buď.*svým.*šéfem|vlastní.*boss", "⚠️ MLM marketing fráze", 0.3),
        (r"finanční.*svoboda|time.*freedom", "⚠️ MLM marketing fráze", 0.3),
        
        # Vague or Missing Information
        (r"^.{0,50}$", "⚠️ Příliš krátký popis pozice", 0.3),  # Very short description
        (r"kontakt.*pouze.*sms|pouze.*whatsapp", "⚠️ Podezřelý způsob kontaktu", 0.4),
        
        # Gambling & Adult Content
        (r"(casino|kasino|sázky|gambling)", "⚠️ Gambling/sázky - vyžaduje revizi", 0.5),
        (r"(escort|adult|erotick)", "⚠️ Adult content - mimo zaměření", 0.6),
        
        # Suspicious Company Names
        (r"(neznámá|unknown|anonymní).*společnost", "⚠️ Neznámá nebo anonymní společnost", 0.4),
    ]
    
    # Check critical patterns first
    for pattern, reason, score in critical_patterns:
        if re.search(pattern, full_text, re.IGNORECASE):
            risk_score += score
            reasons.append(reason)
    
    # Check high risk patterns
    for pattern, reason, score in high_risk_patterns:
        if re.search(pattern, full_text, re.IGNORECASE):
            risk_score += score
            reasons.append(reason)

    # --- Country-specific rules ---
    if country == "at":
        # AT: salary disclosure is mandatory (Kollektivvertrag / Mindestgehalt)
        salary_keywords = [
            r"\b(€|eur)\b",
            r"gehalt", r"lohn", r"entgelt", r"brutto",
            r"kollektivvertrag", r"\bkv\b", r"mindestgehalt"
        ]
        has_salary_info = any(re.search(k, full_text, re.IGNORECASE) for k in salary_keywords) or re.search(r"\d{2,}\s*(€|eur)", full_text)
        if not has_salary_info:
            risk_score += 0.6
            reasons.append("⚠️ AT: Chybí povinné údaje o mzdě (Kollektivvertrag/Mindestgehalt)")

        # AT: potential Scheinselbständigkeit risk (single-client contractor)
        contractor_markers = [
            r"\bi[čc]o\b", r"\bb2b\b", r"contractor", r"self[-\s]?employed",
            r"freelanc", r"selbst[äa]ndig", r"freier\s*dienstnehmer", r"werkvertrag"
        ]
        single_client_markers = [
            r"exklusiv", r"nur\s*f[üu]r\s*uns", r"nur\s*einen\s*kunden",
            r"for\s*one\s*client", r"single\s*client", r"pro\s*jednoho\s*klienta"
        ]
        has_contractor = any(re.search(k, full_text, re.IGNORECASE) for k in contractor_markers)
        has_single_client = any(re.search(k, full_text, re.IGNORECASE) for k in single_client_markers)
        if has_contractor and has_single_client:
            risk_score += 0.6
            reasons.append("⚠️ AT: Riziko Scheinselbständigkeit (contractor + jediný klient)")
    
    # Additional checks
    
    # Check for excessive exclamation marks (spam indicator)
    exclamation_count = full_text.count('!')
    if exclamation_count > 5:
        risk_score += 0.3
        reasons.append(f"⚠️ Nadměrné použití vykřičníků ({exclamation_count}x) - spam indikátor")
    
    # Check for ALL CAPS in title (spam indicator)
    if title.isupper() and len(title) > 10:
        risk_score += 0.2
        reasons.append("⚠️ Titulek celý velkými písmeny - spam indikátor")
    
    # Check for suspicious email domains in description
    suspicious_domains = r"(gmail\.com|seznam\.cz|email\.cz).*kontakt"
    if re.search(suspicious_domains, full_text):
        risk_score += 0.2
        reasons.append("⚠️ Používá osobní email místo firemního")
    
    # Determine legality status
    is_legal = risk_score < 1.0
    needs_manual_review = 0.5 <= risk_score < 1.0
    
    # Cap risk score at reasonable maximum
    risk_score = min(risk_score, 10.0)
    
    return risk_score, is_legal, reasons, needs_manual_review
