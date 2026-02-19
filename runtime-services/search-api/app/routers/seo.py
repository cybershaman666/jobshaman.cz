from fastapi import APIRouter, HTTPException
from fastapi.responses import Response, HTMLResponse
from datetime import datetime, timezone
import html
import json
from ..core.database import supabase
from ..core.config import APP_PUBLIC_URL

router = APIRouter()


def _normalize_job_id(job_id: str):
    return int(job_id) if str(job_id).isdigit() else job_id


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def _job_description_plain(text: str) -> str:
    if not text:
        return ""
    cleaned = text
    cleaned = cleaned.replace("\n", " ")
    return " ".join(cleaned.split()).strip()


@router.get("/sitemap-jobs.xml")
async def sitemap_jobs() -> Response:
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase client not configured")

    try:
        resp = (
            supabase
            .table("jobs")
            .select("id, scraped_at, updated_at, posted_at")
            .order("scraped_at", desc=True)
            .limit(50000)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load jobs: {exc}")

    jobs = resp.data or []
    today = datetime.now(timezone.utc).date().isoformat()
    xml_lines = [
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
        "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\" xmlns:xhtml=\"http://www.w3.org/1999/xhtml\">"
    ]

    for job in jobs:
        job_id = job.get("id")
        if job_id is None:
            continue
        lastmod = (
            _parse_dt(job.get("updated_at"))
            or _parse_dt(job.get("scraped_at"))
            or _parse_dt(job.get("posted_at"))
        )
        lastmod_str = lastmod.date().isoformat() if lastmod else today
        url = f"{APP_PUBLIC_URL}/seo/jobs/{job_id}"
        xml_lines.append("  <url>")
        xml_lines.append(f"    <loc>{html.escape(url)}</loc>")
        xml_lines.append(f"    <lastmod>{lastmod_str}</lastmod>")
        xml_lines.append("    <changefreq>daily</changefreq>")
        xml_lines.append("    <priority>0.8</priority>")
        xml_lines.append("  </url>")

    xml_lines.append("</urlset>")
    xml_body = "\n".join(xml_lines)
    return Response(content=xml_body, media_type="application/xml")


@router.get("/seo/jobs/{job_id}")
async def prerender_job(job_id: str) -> HTMLResponse:
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase client not configured")

    job_id_norm = _normalize_job_id(job_id)
    job_resp = (
        supabase
        .table("jobs")
        .select(
            "id, title, company, location, description, work_type, contract_type, salary_from, salary_to, scraped_at, posted_at, url, country_code, language_code"
        )
        .eq("id", job_id_norm)
        .maybe_single()
        .execute()
    )

    job = job_resp.data
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    title = str(job.get("title") or "Job")
    company = str(job.get("company") or "JobShaman")
    location = str(job.get("location") or "")
    description_raw = str(job.get("description") or "")
    description_plain = _job_description_plain(description_raw)
    description_meta = (description_plain[:180].rstrip() + "…") if len(description_plain) > 180 else description_plain
    job_url = f"{APP_PUBLIC_URL}/jobs/{job.get('id')}"
    og_image = "https://jobshaman.cz/og-image.jpg"
    language = (job.get("language_code") or "cs")
    locale_map = {"cs": "cs_CZ", "sk": "sk_SK", "en": "en_US", "de": "de_DE", "pl": "pl_PL"}
    locale = locale_map.get(language, "cs_CZ")
    work_type = str(job.get("work_type") or "").lower()
    is_remote = "remote" in work_type or "hybrid" in work_type
    salary_from = job.get("salary_from")
    salary_to = job.get("salary_to")

    ld_json = {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "title": title,
        "description": description_plain or f"{title} · {company}",
        "identifier": {
            "@type": "PropertyValue",
            "name": "JobShaman",
            "value": str(job.get("id"))
        },
        "datePosted": job.get("posted_at") or job.get("scraped_at"),
        "hiringOrganization": {
            "@type": "Organization",
            "name": company
        },
        "jobLocation": None if is_remote else {
            "@type": "Place",
            "address": {
                "@type": "PostalAddress",
                "addressLocality": location or None,
                "addressCountry": job.get("country_code") or None
            }
        },
        "jobLocationType": "TELECOMMUTE" if is_remote else None,
        "url": job_url
    }

    if salary_from or salary_to:
        ld_json["baseSalary"] = {
            "@type": "MonetaryAmount",
            "currency": "CZK",
            "value": {
                "@type": "QuantitativeValue",
                "minValue": salary_from or None,
                "maxValue": salary_to or None,
                "unitText": "MONTH"
            }
        }

    ld_json_str = json.dumps(ld_json, ensure_ascii=False)
    ld_json_str = ld_json_str.replace("</", "<\\/")

    html_body = f"""
<!DOCTYPE html>
<html lang=\"{html.escape(language)}\">
  <head>
    <meta charset=\"UTF-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
    <title>{html.escape(title)} | {html.escape(company)} | JobShaman</title>
    <meta name=\"description\" content=\"{html.escape(description_meta or f'{title} · {company}') }\" />
    <meta property=\"og:type\" content=\"article\" />
    <meta property=\"og:title\" content=\"{html.escape(title)} | {html.escape(company)}\" />
    <meta property=\"og:description\" content=\"{html.escape(description_meta or f'{title} · {company}') }\" />
    <meta property=\"og:image\" content=\"{html.escape(og_image)}\" />
    <meta property=\"og:url\" content=\"{html.escape(job_url)}\" />
    <meta property=\"og:locale\" content=\"{html.escape(locale)}\" />
    <meta property=\"twitter:card\" content=\"summary_large_image\" />
    <meta property=\"twitter:title\" content=\"{html.escape(title)} | {html.escape(company)}\" />
    <meta property=\"twitter:description\" content=\"{html.escape(description_meta or f'{title} · {company}') }\" />
    <meta property=\"twitter:image\" content=\"{html.escape(og_image)}\" />
    <link rel=\"canonical\" href=\"{html.escape(job_url)}\" />
    <script type=\"application/ld+json\">{ld_json_str}</script>
    <style>
      body {{ font-family: Arial, sans-serif; margin: 2rem; color: #0f172a; }}
      header {{ margin-bottom: 1.5rem; }}
      h1 {{ font-size: 2rem; margin: 0 0 0.5rem 0; }}
      .meta {{ color: #475569; font-size: 0.95rem; }}
      .desc {{ white-space: pre-wrap; line-height: 1.6; }}
      .cta {{ margin-top: 2rem; }}
      .cta a {{ color: #0f172a; font-weight: 600; text-decoration: none; }}
    </style>
  </head>
  <body>
    <header>
      <h1>{html.escape(title)}</h1>
      <div class=\"meta\">{html.escape(company)}{f" · {html.escape(location)}" if location else ""}</div>
    </header>
    <section class=\"desc\">{html.escape(description_raw) if description_raw else html.escape(description_plain)}</section>
    <div class=\"cta\"><a href=\"{html.escape(job_url)}\">Zobrazit nabídku na JobShaman</a></div>
  </body>
</html>
"""

    return HTMLResponse(content=html_body)
