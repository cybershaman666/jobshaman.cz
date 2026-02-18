import resend
from ..core.config import RESEND_API_KEY

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

def send_email(to_email: str, subject: str, html: str):
    if not RESEND_API_KEY:
        print("⚠️ Resend API key missing. Email not sent.")
        return False
    try:
        print("📧 Attempting to send email.")
        params = {
            "from": "JobShaman <noreply@jobshaman.cz>",
            "to": [to_email],
            "subject": subject,
            "html": html,
        }
        resend.Emails.send(params)
        print("✅ Email sent successfully.")
        return True
    except Exception as e:
        print(f"❌ Failed to send email: {e}")
        return False

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

    first_name = (full_name or "").strip().split(" ")[0] if full_name else ""

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
