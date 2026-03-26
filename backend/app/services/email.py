from html import escape

import resend
from ..core.config import APPLICATION_NOTIFICATION_EMAIL, RESEND_API_KEY

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


_CZ_VOCATIVE_OVERRIDES = {
    "matěj": "Matěji",
    "matej": "Matěji",
    "martin": "Martine",
    "petr": "Petře",
    "jan": "Jane",
    "tomáš": "Tomáši",
    "tomas": "Tomáši",
    "lukáš": "Lukáši",
    "lukas": "Lukáši",
    "michal": "Michale",
    "ondřej": "Ondřeji",
    "ondrej": "Ondřeji",
    "vladimír": "Vladimíre",
    "vladimir": "Vladimíre",
    "jiří": "Jiří",
    "jiri": "Jiří",
    "josef": "Josefe",
    "david": "Davide",
}


def _extract_first_name(full_name: str) -> str:
    value = str(full_name or "").strip()
    if not value:
        return ""
    # Keep only first token and trim common punctuation around it.
    token = value.split()[0].strip(",.;:!?()[]{}")
    return token


def _to_czech_vocative(first_name: str) -> str:
    name = str(first_name or "").strip()
    if not name:
        return ""
    lowered = name.lower()
    overridden = _CZ_VOCATIVE_OVERRIDES.get(lowered)
    if overridden:
        return overridden

    # Safe fallback rules for common masculine patterns.
    if lowered.endswith("j"):
        return f"{name}i"
    if lowered.endswith("k"):
        return f"{name}u"
    if lowered.endswith(("n", "r", "m", "l")):
        return f"{name}e"
    return name

def send_email(to_email: str, subject: str, html: str):
    if not RESEND_API_KEY:
        print("⚠️ Resend API key missing. Email not sent.")
        return False
    try:
        params = {
            "from": "JobShaman <floki@jobshaman.cz>",
            "to": [to_email],
            "subject": subject,
            "html": html,
        }
        resend.Emails.send(params)
        return True
    except Exception:
        print("❌ Failed to send email.")
        return False


def _safe_text(value: object, max_length: int = 1000) -> str:
    text = str(value or "").strip()
    if len(text) > max_length:
        text = f"{text[: max_length - 1].rstrip()}…"
    return escape(text)


def send_application_notification_email(
    *,
    candidate_profile: dict | None,
    metadata: dict | None,
    cover_letter: str | None = None,
    cv_snapshot: dict | None = None,
) -> bool:
    target_email = str(APPLICATION_NOTIFICATION_EMAIL or "").strip()
    if not target_email:
        return False

    profile = candidate_profile if isinstance(candidate_profile, dict) else {}
    meta = metadata if isinstance(metadata, dict) else {}
    cv = cv_snapshot if isinstance(cv_snapshot, dict) else {}

    candidate_name = _safe_text(profile.get("name") or "Unknown candidate", 160)
    candidate_email = _safe_text(profile.get("email"), 320)
    candidate_phone = _safe_text(profile.get("phone"), 80)
    candidate_job_title = _safe_text(profile.get("jobTitle"), 160)
    candidate_linkedin = _safe_text(profile.get("linkedin"), 320)
    job_title = _safe_text(meta.get("job_title") or "Unknown role", 200)
    job_company = _safe_text(meta.get("job_company") or "Unknown company", 200)
    job_location = _safe_text(meta.get("job_location"), 200)
    job_url = _safe_text(meta.get("job_url"), 500)
    source = _safe_text(meta.get("job_source"), 80)
    handshake_prompts = meta.get("handshake_prompts") if isinstance(meta.get("handshake_prompts"), list) else []
    handshake_responses = meta.get("handshake_responses") if isinstance(meta.get("handshake_responses"), list) else []
    optional_note = _safe_text(meta.get("handshake_optional_note"), 2000)
    cover_letter_html = _safe_text(cover_letter, 4000)
    cv_name = _safe_text(cv.get("originalName") or cv.get("label"), 255)
    cv_url = _safe_text(cv.get("fileUrl"), 500)

    prompt_one = _safe_text(handshake_prompts[0] if len(handshake_prompts) > 0 else "", 500)
    prompt_two = _safe_text(handshake_prompts[1] if len(handshake_prompts) > 1 else "", 500)
    response_one = _safe_text(handshake_responses[0] if len(handshake_responses) > 0 else "", 3000)
    response_two = _safe_text(handshake_responses[1] if len(handshake_responses) > 1 else "", 3000)

    subject = f"Nový handshake: {candidate_name} -> {job_title}"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; background: #f8fafc;">
      <div style="background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 28px;">
        <h2 style="margin: 0 0 16px; color: #0f172a;">Nový handshake v JobShaman</h2>
        <p style="margin: 0 0 20px; color: #475569;">Do systému přišel nový první kontakt kandidáta.</p>

        <h3 style="margin: 20px 0 10px; color: #0f172a;">Role</h3>
        <p style="margin: 0; color: #334155;"><strong>{job_title}</strong> v {job_company}</p>
        <p style="margin: 6px 0 0; color: #64748b;">{job_location or 'Lokalita neuvedena'}{f' · {source}' if source else ''}</p>
        <p style="margin: 6px 0 0; color: #2563eb;">{job_url}</p>

        <h3 style="margin: 20px 0 10px; color: #0f172a;">Kandidát</h3>
        <p style="margin: 0; color: #334155;"><strong>{candidate_name}</strong></p>
        <p style="margin: 6px 0 0; color: #64748b;">{candidate_email or 'Bez e-mailu'}{f' · {candidate_phone}' if candidate_phone else ''}</p>
        <p style="margin: 6px 0 0; color: #64748b;">{candidate_job_title or 'Bez role'}{f' · {candidate_linkedin}' if candidate_linkedin else ''}</p>

        <h3 style="margin: 20px 0 10px; color: #0f172a;">První krok kandidáta</h3>
        <div style="padding: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; color: #334155;">
          <p style="margin: 0 0 8px;"><strong>{prompt_one or 'Otázka 1'}</strong></p>
          <p style="margin: 0 0 14px; white-space: pre-wrap;">{response_one or 'Bez odpovědi'}</p>
          <p style="margin: 0 0 8px;"><strong>{prompt_two or 'Otázka 2'}</strong></p>
          <p style="margin: 0; white-space: pre-wrap;">{response_two or 'Bez odpovědi'}</p>
        </div>

        <h3 style="margin: 20px 0 10px; color: #0f172a;">Další kontext</h3>
        <p style="margin: 0; color: #334155; white-space: pre-wrap;">{optional_note or 'Bez doplňující poznámky'}</p>

        <h3 style="margin: 20px 0 10px; color: #0f172a;">Podklady</h3>
        <p style="margin: 0; color: #334155;">CV: {cv_name or 'neuvedeno'}</p>
        <p style="margin: 6px 0 0; color: #2563eb;">{cv_url}</p>
        <p style="margin: 12px 0 0; color: #334155; white-space: pre-wrap;">{cover_letter_html or 'Bez doprovodného textu'}</p>
      </div>
    </div>
    """
    return send_email(target_email, subject, html)

def send_review_email(job, result, context=None):
    subject = f"🚨 { '[ZAKÁZÁNO]' if not result.is_legal else '[REVIZE]' } Inzerát: {job.title}"
    
    reasons_list = "".join([f"<li>{r}</li>" for r in result.reasons])
    
    html = f"""
    <h2>Kontrola inzerátu</h2>
    <p><b>Společnost:</b> {job.company}</p>
    <p><b>Pozice:</b> {job.title}</p>
    <p><b>ID Inzerátu:</b> {job.id}</p>
    <hr/>
    <p><b>Lokalita:</b> {job.location or 'Neuvedeno'}</p>
    <p><b>Risk Skóre:</b> {result.risk_score}</p>
    <p><b>Důvody:</b></p>
    <ul>{reasons_list if reasons_list else '<li>Žádné konkrétní vzory nedetekovány</li>'}</ul>
    <br/>
    <p><a href="https://jobshaman.cz/jobs/{job.id}">Zobrazit inzerát na webu</a></p>
    """
    return send_email("floki@jobshaman.cz", subject, html)

def send_recruiter_legality_email(recruiter_email, job_title, result):
    if not result.is_legal:
        subject = f"❌ Váš inzerát byl zamítnut: {job_title}"
        status_text = "byl bohužel zamítnut z důvodu porušení našich pravidel."
    else:
        subject = f"⚠️ Váš inzerát čeká na revizi: {job_title}"
        status_text = "vyžaduje manuální revizi naším adminem. Do té doby může být jeho viditelnost omezena."
    
    reasons_list = "".join([f"<li>{r}</li>" for r in result.reasons])
    
    html = f"""
    <h2>Aktualizace stavu inzerátu</h2>
    <p>Dobrý den,</p>
    <p>váš pracovní inzerát na pozici <b>{job_title}</b> {status_text}</p>
    <p><b>Důvody:</b></p>
    <ul>{reasons_list if reasons_list else '<li>Podezření na klamavou nabídku nebo nesplnění standardů.</li>'}</ul>
    <br/>
    <p>S pozdravem,<br/>Tým JobShaman</p>
    """
    return send_email(recruiter_email, subject, html)

def send_welcome_email(to_email: str, full_name: str = "", locale: str = "cs", app_url: str = "https://jobshaman.cz") -> bool:
    locale = (locale or "cs").lower()
    if locale.startswith("de") or locale == "at":
        lang = "de"
    elif locale.startswith("sk"):
        lang = "sk"
    elif locale.startswith("pl"):
        lang = "pl"
    elif locale.startswith("en"):
        lang = "en"
    else:
        lang = "cs"

    first_name = _extract_first_name(full_name)

    copy = {
        "cs": {
            "subject": "Vítejte v JobShaman",
            "title": f"Ahoj{f' {first_name}' if first_name else ''}!",
            "body": "Díky za registraci. Máte hotový účet a můžete začít hledat nabídky s chytrým filtrováním.",
            "cta": "Začít prohlížet nabídky",
            "footer": "Těšíme se, že vám JobShaman pomůže najít lepší práci."
        },
        "en": {
            "subject": "Welcome to JobShaman",
            "title": f"Hi{f' {first_name}' if first_name else ''}!",
            "body": "Thanks for signing up. Your account is ready, and you can start browsing offers with smart filters.",
            "cta": "Start browsing jobs",
            "footer": "We are glad to help you find a better job with JobShaman."
        },
        "de": {
            "subject": "Willkommen bei JobShaman",
            "title": f"Hallo{f' {first_name}' if first_name else ''}!",
            "body": "Danke für Ihre Registrierung. Ihr Konto ist bereit und Sie können sofort passende Angebote entdecken.",
            "cta": "Jobs ansehen",
            "footer": "Wir freuen uns, dass JobShaman bei der Jobsuche hilft."
        },
        "pl": {
            "subject": "Witamy w JobShaman",
            "title": f"Cześć{f' {first_name}' if first_name else ''}!",
            "body": "Dziękujemy za rejestrację. Konto jest gotowe — możesz od razu przeglądać oferty.",
            "cta": "Przeglądaj oferty",
            "footer": "Cieszymy się, że JobShaman pomaga w znalezieniu lepszej pracy."
        },
        "sk": {
            "subject": "Vitajte v JobShaman",
            "title": f"Ahoj{f' {first_name}' if first_name else ''}!",
            "body": "Ďakujeme za registráciu. Účet je pripravený a môžete začať prehliadať ponuky.",
            "cta": "Začať prehliadať ponuky",
            "footer": "Tešíme sa, že vám JobShaman pomôže nájsť lepšiu prácu."
        }
    }.get(lang)

    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
        <h2 style="color: #0f172a; margin-bottom: 12px;">{copy['title']}</h2>
        <p style="color: #475569; line-height: 1.6;">{copy['body']}</p>
        <div style="margin: 24px 0;">
          <a href="{app_url}" style="display: inline-block; padding: 12px 20px; background-color: #0ea5e9; color: #ffffff; border-radius: 8px; text-decoration: none; font-weight: 600;">{copy['cta']}</a>
        </div>
        <p style="color: #64748b; font-size: 14px;">{copy['footer']}</p>
      </div>
      <div style="text-align: center; margin-top: 24px; color: #94a3b8; font-size: 12px;">© 2024 JobShaman</div>
    </div>
    """

    return send_email(to_email, copy["subject"], html)


def send_daily_digest_email(
    to_email: str,
    full_name: str,
    locale: str,
    jobs,
    app_url: str,
    unsubscribe_url: str,
) -> bool:
    locale = (locale or "cs").lower()
    if locale.startswith("de") or locale == "at":
        lang = "de"
    elif locale.startswith("sk"):
        lang = "sk"
    elif locale.startswith("pl"):
        lang = "pl"
    elif locale.startswith("en"):
        lang = "en"
    else:
        lang = "cs"

    first_name = _extract_first_name(full_name)
    cs_salutation_name = _to_czech_vocative(first_name) if first_name else ""

    copy = {
        "cs": {
            "subject": "Váš denní přehled nabídek",
            "title": f"Dobrý den{f' {cs_salutation_name}' if cs_salutation_name else ''},",
            "intro": "Zde je Váš denní přehled nabídek, které odpovídají Vašemu profilu.",
            "top_title": "Vaše top shody",
            "browse_cta": "Zobrazit další nabídky",
            "summary_title": "Shrnutí",
            "summary_1": "Nalezeno {count} kvalitních příležitostí",
            "summary_2": "Shody v rozmezí {min_score}% až {max_score}%",
            "summary_3": "Čerstvé nabídky z poslední doby",
            "summary_tip": "Tip: Nejlepší nabídky se rychle plní. Doporučujeme je zkontrolovat ještě dnes.",
            "cta": "Zobrazit detail",
        },
        "en": {
            "subject": "Your daily job digest",
            "title": f"Hi{f' {first_name}' if first_name else ''}! Your digest is ready",
            "intro": "Here is your daily shortlist of roles that match your profile.",
            "top_title": "Your top matches",
            "browse_cta": "Browse more jobs",
            "summary_title": "Summary",
            "summary_1": "{count} high-quality opportunities found",
            "summary_2": "Match scores range from {min_score}% to {max_score}%",
            "summary_3": "Fresh opportunities posted recently",
            "summary_tip": "Tip: The best opportunities fill quickly. Review and apply today.",
            "cta": "View job details",
        },
        "de": {
            "subject": "Ihr täglicher Job‑Digest",
            "title": f"Hallo{f' {first_name}' if first_name else ''}! Ihr Digest ist da",
            "intro": "Hier ist Ihre tägliche Übersicht passender Angebote.",
            "top_title": "Ihre Top‑Matches",
            "browse_cta": "Weitere Jobs ansehen",
            "summary_title": "Zusammenfassung",
            "summary_1": "{count} hochwertige Chancen gefunden",
            "summary_2": "Match‑Scores zwischen {min_score}% und {max_score}%",
            "summary_3": "Frische Angebote aus den letzten Tagen",
            "summary_tip": "Tipp: Gute Stellen sind schnell weg. Jetzt ansehen und bewerben.",
            "cta": "Job ansehen",
        },
        "pl": {
            "subject": "Twój dzienny digest ofert",
            "title": f"Cześć{f' {first_name}' if first_name else ''}! Twój digest jest gotowy",
            "intro": "Oto dzienny zestaw ofert dopasowanych do Twojego profilu.",
            "top_title": "Twoje najlepsze dopasowania",
            "browse_cta": "Zobacz więcej ofert",
            "summary_title": "Podsumowanie",
            "summary_1": "Znaleziono {count} wartościowych ofert",
            "summary_2": "Dopasowanie od {min_score}% do {max_score}%",
            "summary_3": "Świeże ogłoszenia z ostatnich dni",
            "summary_tip": "Wskazówka: Najlepsze oferty szybko znikają. Sprawdź je dziś.",
            "cta": "Zobacz ofertę",
        },
        "sk": {
            "subject": "Váš denný digest ponúk",
            "title": f"Ahoj{f' {first_name}' if first_name else ''}! Máte nový digest",
            "intro": "Tu je váš denný prehľad ponúk, ktoré sa hodia k vášmu profilu.",
            "top_title": "Vaše top zhody",
            "browse_cta": "Zobraziť ďalšie ponuky",
            "summary_title": "Zhrnutie",
            "summary_1": "Nájdených {count} kvalitných príležitostí",
            "summary_2": "Zhody v rozmedzí {min_score}% až {max_score}%",
            "summary_3": "Čerstvé ponuky z poslednej doby",
            "summary_tip": "Tip: Najlepšie ponuky sa rýchlo obsadia. Odporúčame ich pozrieť dnes.",
            "cta": "Zobraziť detail",
        },
    }[lang]

    if not jobs:
        return False

    scores = [float(j.get("match_score")) for j in jobs if j.get("match_score") is not None]
    score_min = int(min(scores)) if scores else 0
    score_max = int(max(scores)) if scores else 0

    job_cards = ""
    for job in jobs:
        title = job.get("title") or "Job"
        company = job.get("company") or job.get("company_name") or ""
        location = job.get("location") or ""
        raw_match_score = job.get("match_score")
        match_line = (
            f"{int(raw_match_score)}% Match"
            if raw_match_score is not None
            else {
                "cs": "Nejnovější nabídka",
                "en": "Newest local job",
                "de": "Neueste lokale Stelle",
                "pl": "Najnowsza lokalna oferta",
                "sk": "Najnovšia lokálna ponuka",
            }[lang]
        )
        job_id = job.get("id")
        job_url = job.get("detail_url") or (f"{app_url}/jobs/{job_id}" if job_id else app_url)

        job_cards += f"""
        <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:12px;background:#ffffff;">
          <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:4px;">{title}</div>
          <div style="font-size:13px;color:#64748b;margin-bottom:6px;">{company}</div>
          <div style="font-size:13px;color:#0f172a;margin-bottom:6px;">{match_line}</div>
          <div style="font-size:13px;color:#475569;margin-bottom:10px;">{location}</div>
          <a href="{job_url}" style="display:inline-block;padding:10px 14px;background:#0ea5e9;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;">{copy['cta']}</a>
        </div>
        """

    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; background-color: #f1f5f9;">
      <div style="background-color: #ffffff; padding: 28px; border-radius: 14px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);">
        <h2 style="color: #0f172a; margin-bottom: 8px;">{copy['title']}</h2>
        <p style="color: #475569; line-height: 1.6;">{copy['intro']}</p>

        <h3 style="color:#0f172a;margin:20px 0 12px;">{copy['top_title']}</h3>
        {job_cards}
        <div style="margin: 10px 0 20px;">
          <a href="{app_url}" style="display:inline-block;padding:12px 18px;background:#0f172a;color:#ffffff;border-radius:10px;text-decoration:none;font-weight:700;font-size:13px;">{copy['browse_cta']}</a>
        </div>

        <h3 style="color:#0f172a;margin:20px 0 8px;">{copy['summary_title']}</h3>
        <ul style="color:#475569;margin:0;padding-left:18px;">
          <li>{copy['summary_1'].format(count=len(jobs))}</li>
          <li>{
              copy['summary_2'].format(min_score=score_min, max_score=score_max)
              if scores
              else {
                  "cs": "Výběr je založený na nejnovějších nabídkách ve vašem okolí",
                  "en": "Selection is based on the newest jobs in your area",
                  "de": "Auswahl basiert auf den neuesten Stellen in Ihrer Umgebung",
                  "pl": "Wybór opiera się na najnowszych ofertach w Twojej okolicy",
                  "sk": "Výber je založený na najnovších ponukách vo vašom okolí",
              }[lang]
          }</li>
          <li>{copy['summary_3']}</li>
        </ul>

        <p style="color:#64748b;margin-top:16px;font-size:13px;">{copy['summary_tip']}</p>
        <p style="color:#94a3b8;margin-top:18px;font-size:12px;">
          <a href="{unsubscribe_url}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a>
        </p>
      </div>
      <div style="text-align:center;margin-top:18px;color:#94a3b8;font-size:12px;">© 2024 JobShaman</div>
    </div>
    """

    return send_email(to_email, copy["subject"], html)


def send_signal_boost_interest_email(
    *,
    to_email: str,
    full_name: str,
    locale: str,
    company_name: str,
    job_title: str,
    role_url: str,
    signal_url: str,
) -> bool:
    locale = (locale or "cs").lower()
    if locale.startswith("de") or locale == "at":
        lang = "de"
    elif locale.startswith("sk"):
        lang = "sk"
    elif locale.startswith("pl"):
        lang = "pl"
    elif locale.startswith("en"):
        lang = "en"
    else:
        lang = "cs"

    first_name = _extract_first_name(full_name)
    cs_salutation_name = _to_czech_vocative(first_name) if first_name else ""

    copy = {
        "cs": {
            "subject": f"Někdo zareagoval na váš Signal Boost",
            "title": f"Dobrý den{f' {cs_salutation_name}' if cs_salutation_name else ''},",
            "intro": f"U vašeho Signal Boostu pro roli <b>{escape(job_title)}</b> ve firmě <b>{escape(company_name)}</b> se objevil silnější signál zájmu.",
            "body": "Někdo neudělal jen otevření odkazu, ale klikl dál. To je dobrý moment vrátit se k roli a zkontrolovat další kontext.",
            "role_cta": "Otevřít roli",
            "signal_cta": "Otevřít Signal Boost",
            "footer": "JobShaman vám dá vědět, když se z pasivního zobrazení stane skutečný zájem.",
        },
        "sk": {
            "subject": "Niekto zareagoval na váš Signal Boost",
            "title": f"Dobrý deň{f' {first_name}' if first_name else ''},",
            "intro": f"Pri vašom Signal Booste pre rolu <b>{escape(job_title)}</b> vo firme <b>{escape(company_name)}</b> sa objavil silnejší signál záujmu.",
            "body": "Niekto neurobil len otvorenie odkazu, ale klikol ďalej. To je dobrý moment vrátiť sa k role a skontrolovať ďalší kontext.",
            "role_cta": "Otvoriť rolu",
            "signal_cta": "Otvoriť Signal Boost",
            "footer": "JobShaman vám dá vedieť, keď sa z pasívneho zobrazenia stane skutočný záujem.",
        },
        "de": {
            "subject": "Jemand hat auf Ihren Signal Boost reagiert",
            "title": f"Hallo{f' {first_name}' if first_name else ''},",
            "intro": f"Bei Ihrem Signal Boost für die Rolle <b>{escape(job_title)}</b> bei <b>{escape(company_name)}</b> gab es ein stärkeres Interessenssignal.",
            "body": "Jemand hat den Link nicht nur geöffnet, sondern ist einen Schritt weitergegangen. Ein guter Moment, die Rolle und den Kontext erneut zu prüfen.",
            "role_cta": "Rolle öffnen",
            "signal_cta": "Signal Boost öffnen",
            "footer": "JobShaman informiert Sie, wenn aus einem bloßen Aufruf echtes Interesse wird.",
        },
        "pl": {
            "subject": "Ktoś zareagował na Twój Signal Boost",
            "title": f"Cześć{f' {first_name}' if first_name else ''},",
            "intro": f"Przy Twoim Signal Boost dla roli <b>{escape(job_title)}</b> w firmie <b>{escape(company_name)}</b> pojawił się mocniejszy sygnał zainteresowania.",
            "body": "Ktoś nie tylko otworzył link, ale kliknął dalej. To dobry moment, żeby wrócić do roli i sprawdzić dalszy kontekst.",
            "role_cta": "Otwórz rolę",
            "signal_cta": "Otwórz Signal Boost",
            "footer": "JobShaman daje znać, gdy z samego wyświetlenia robi się realne zainteresowanie.",
        },
        "en": {
            "subject": "Someone reacted to your Signal Boost",
            "title": f"Hi{f' {first_name}' if first_name else ''},",
            "intro": f"Your Signal Boost for <b>{escape(job_title)}</b> at <b>{escape(company_name)}</b> just showed a stronger sign of interest.",
            "body": "Someone did not just open the link. They clicked further. That is a good moment to jump back into the role and check the next context.",
            "role_cta": "Open role",
            "signal_cta": "Open Signal Boost",
            "footer": "JobShaman lets you know when passive viewing turns into real interest.",
        },
    }[lang]

    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; background-color: #f1f5f9;">
      <div style="background-color: #ffffff; padding: 28px; border-radius: 14px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);">
        <h2 style="color: #0f172a; margin-bottom: 8px;">{copy['title']}</h2>
        <p style="color: #475569; line-height: 1.6;">{copy['intro']}</p>
        <p style="color: #475569; line-height: 1.6;">{copy['body']}</p>
        <div style="margin: 22px 0 10px; display:flex; gap:12px; flex-wrap:wrap;">
          <a href="{escape(role_url)}" style="display:inline-block;padding:12px 18px;background:#0f172a;color:#ffffff;border-radius:10px;text-decoration:none;font-weight:700;font-size:13px;">{copy['role_cta']}</a>
          <a href="{escape(signal_url)}" style="display:inline-block;padding:12px 18px;background:#0ea5e9;color:#ffffff;border-radius:10px;text-decoration:none;font-weight:700;font-size:13px;">{copy['signal_cta']}</a>
        </div>
        <p style="color: #64748b; font-size: 14px; margin-top: 20px;">{copy['footer']}</p>
      </div>
    </div>
    """
    return send_email(to_email, copy["subject"], html)
