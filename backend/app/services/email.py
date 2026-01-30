import resend
from ..core.config import RESEND_API_KEY

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

def send_email(to_email: str, subject: str, html: str):
    if not RESEND_API_KEY:
        print(f"⚠️ Resend API key missing. Would send to {to_email}: {subject}")
        return False
    try:
        params = {
            "from": "JobShaman <noreply@jobshaman.cz>",
            "to": [to_email],
            "subject": subject,
            "html": html,
        }
        resend.Emails.send(params)
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
