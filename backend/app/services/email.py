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

def send_review_email(job, result):
    # Simplified version of send_review_email
    subject = f"Pracovní inzerát vyžaduje kontrolu: {job.title}"
    html = f"Inzerát od {job.company} má risk skóre {result.risk_score}."
    return send_email("admin@jobshaman.cz", subject, html)
