<<<<<<< HEAD
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response, HTMLResponse
from datetime import datetime, timezone
import html
import json
import re
import unicodedata
from ..core.database import supabase
from ..core.config import APP_PUBLIC_URL

router = APIRouter()

_TOPIC_PAGES = {
    "career-map": {
        "title": "Career Map",
        "headline": "Career Map shows where a role can lead next",
        "description": "Career Map turns live jobs into visible directions, adjacent moves, and realistic next steps based on how work actually connects.",
        "body": [
            "Instead of showing one flat stream of listings, Career Map helps candidates understand the shape of the market around them.",
            "It highlights nearby directions, role clusters, and bridge moves that make sense from the current profile and context.",
            "The goal is not just to browse. The goal is to see where you can realistically move next.",
        ],
    },
    "goal-navigation": {
        "title": "Goal Navigation",
        "headline": "Goal Navigation helps candidates move from profile to realistic destination",
        "description": "Goal Navigation translates a target role into a practical route with bridge roles, skill gaps, proof steps, and live opportunities.",
        "body": [
            "Candidates can enter a destination like Customer Success, Operations, or AI Product Manager and see a route instead of just a list.",
            "The route is built from current profile signals, live market demand, role adjacency, and practical next steps.",
            "This makes the market easier to act on because the question becomes how to get there, not only where to click.",
        ],
    },
    "handshake-hiring": {
        "title": "Handshake Hiring",
        "headline": "Handshake hiring starts with real interaction",
        "description": "Handshake hiring replaces one-sided filtering with short, real working interaction and stronger signals about compatibility.",
        "body": [
            "Traditional hiring optimizes selection. Handshake hiring optimizes what happens when people actually begin working together.",
            "Companies open roles through real tasks and practical situations. Candidates respond through short working moments instead of only polished documents.",
            "AI helps prepare and guide the process, but the decision stays with people.",
        ],
    },
    "mini-challenges": {
        "title": "Mini Challenges",
        "headline": "Mini Challenges create proof through short real work",
        "description": "Mini Challenges are short, scoped collaborations that help both sides see how the work feels before a bigger decision is made.",
        "body": [
            "They are useful when a candidate wants to show how they think, ask questions, and structure a problem in practice.",
            "They are useful when a company wants stronger signals than a CV or a polished interview answer can provide.",
            "That makes mini challenges a practical bridge between discovery and decision.",
        ],
    },
}


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


def _normalize_text(value: str | None) -> str:
    text = str(value or "").strip().lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^a-z0-9\s-]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _slugify(value: str | None) -> str:
    normalized = _normalize_text(value)
    return normalized.replace(" ", "-")


def _humanize_slug(value: str | None) -> str:
    slug = str(value or "").strip().replace("-", " ").replace("_", " ")
    return " ".join(part.capitalize() for part in slug.split())


def _fetch_role_taxonomy() -> list[dict]:
    if not supabase:
        return []
    try:
        resp = (
            supabase
            .table("role_taxonomy")
            .select("canonical_role, role_family, role_track, aliases")
            .order("canonical_role")
            .limit(5000)
            .execute()
        )
        return [row for row in (resp.data or []) if isinstance(row, dict)]
    except Exception:
        return []


def _fetch_recent_jobs(limit: int = 1500) -> list[dict]:
    if not supabase:
        return []
    try:
        resp = (
            supabase
            .table("jobs")
            .select("id,title,company,location,description,work_type,contract_type,salary_from,salary_to,scraped_at,posted_at,url,country_code,language_code")
            .order("scraped_at", desc=True)
            .limit(limit)
            .execute()
        )
        return [row for row in (resp.data or []) if isinstance(row, dict)]
    except Exception:
        return []


def _role_aliases(role_row: dict) -> list[str]:
    aliases = role_row.get("aliases")
    values: list[str] = []
    if isinstance(aliases, list):
        values.extend(str(item or "").strip() for item in aliases)
    canonical = str(role_row.get("canonical_role") or "").strip()
    if canonical:
        values.append(canonical)
    seen: set[str] = set()
    deduped: list[str] = []
    for value in values:
        normalized = _normalize_text(value)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(value)
    return deduped


def _job_matches_aliases(job: dict, aliases: list[str]) -> bool:
    haystack = _normalize_text(
        " ".join(
            [
                str(job.get("title") or ""),
                str(job.get("description") or ""),
                str(job.get("company") or ""),
                str(job.get("location") or ""),
            ]
        )
    )
    if not haystack:
        return False
    return any(_normalize_text(alias) in haystack for alias in aliases if _normalize_text(alias))


def _jobs_for_role(role_row: dict, jobs: list[dict], limit: int = 12) -> list[dict]:
    aliases = _role_aliases(role_row)
    matched = [job for job in jobs if _job_matches_aliases(job, aliases)]
    return matched[:limit]


def _jobs_for_family(role_rows: list[dict], jobs: list[dict], limit: int = 12) -> list[dict]:
    aliases: list[str] = []
    for row in role_rows[:12]:
        aliases.extend(_role_aliases(row)[:4])
    matched = [job for job in jobs if _job_matches_aliases(job, aliases)]
    return matched[:limit]


def _render_xml_urlset(rows: list[dict[str, str]]) -> Response:
    lines = [
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
        "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">",
    ]
    for row in rows:
        lines.append("  <url>")
        lines.append(f"    <loc>{html.escape(row['loc'])}</loc>")
        lines.append(f"    <lastmod>{html.escape(row['lastmod'])}</lastmod>")
        lines.append(f"    <changefreq>{html.escape(row['changefreq'])}</changefreq>")
        lines.append(f"    <priority>{html.escape(row['priority'])}</priority>")
        lines.append("  </url>")
    lines.append("</urlset>")
    return Response("\n".join(lines), media_type="application/xml")


def _render_sitemap_index(rows: list[str]) -> Response:
    lines = [
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
        "<sitemapindex xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">",
    ]
    for url in rows:
        lines.append("  <sitemap>")
        lines.append(f"    <loc>{html.escape(url)}</loc>")
        lines.append(f"    <lastmod>{datetime.now(timezone.utc).date().isoformat()}</lastmod>")
        lines.append("  </sitemap>")
    lines.append("</sitemapindex>")
    return Response("\n".join(lines), media_type="application/xml")


def _job_card_html(job: dict) -> str:
    title = str(job.get("title") or "Job")
    company = str(job.get("company") or "JobShaman")
    location = str(job.get("location") or "")
    salary_parts = [str(int(value)) for value in [job.get("salary_from"), job.get("salary_to")] if value]
    salary = " - ".join(salary_parts)
    salary_label = f" · {salary} CZK" if salary else ""
    return (
        f"<li><a href=\"{html.escape(f'{APP_PUBLIC_URL}/jobs/{job.get('id')}')}\">"
        f"{html.escape(title)}</a> · {html.escape(company)}"
        f"{f' · {html.escape(location)}' if location else ''}{html.escape(salary_label)}</li>"
    )


def _render_landing_page(*, title: str, description: str, canonical_url: str, heading: str, paragraphs: list[str], jobs: list[dict] | None = None, chips: list[str] | None = None, structured_data: dict | None = None) -> HTMLResponse:
    og_image = f"{APP_PUBLIC_URL}/og-image.jpg"
    chips_html = "".join(
        f"<span class=\"chip\">{html.escape(chip)}</span>"
        for chip in (chips or [])
    )
    jobs_html = ""
    if jobs:
        jobs_html = (
            "<section><h2>Live roles on JobShaman</h2>"
            "<ul>"
            + "".join(_job_card_html(job) for job in jobs[:12])
            + "</ul></section>"
        )
    ld_json_str = ""
    if structured_data:
        ld_json_str = json.dumps(structured_data, ensure_ascii=False).replace("</", "<\\/")

    html_body = f"""
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{html.escape(title)}</title>
    <meta name="description" content="{html.escape(description)}" />
    <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="{html.escape(title)}" />
    <meta property="og:description" content="{html.escape(description)}" />
    <meta property="og:image" content="{html.escape(og_image)}" />
    <meta property="og:url" content="{html.escape(canonical_url)}" />
    <meta property="og:site_name" content="JobShaman" />
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:title" content="{html.escape(title)}" />
    <meta property="twitter:description" content="{html.escape(description)}" />
    <meta property="twitter:image" content="{html.escape(og_image)}" />
    <meta name="ai-summary" content="{html.escape(description)}" />
    <link rel="canonical" href="{html.escape(canonical_url)}" />
    {f'<script type="application/ld+json">{ld_json_str}</script>' if ld_json_str else ''}
    <style>
      body {{ font-family: Arial, sans-serif; margin: 0; color: #0f172a; background: #f8fafc; }}
      main {{ max-width: 920px; margin: 0 auto; padding: 48px 24px 72px; }}
      h1 {{ font-size: 2.2rem; line-height: 1.15; margin: 0 0 16px; }}
      h2 {{ margin-top: 2rem; }}
      p {{ line-height: 1.7; color: #334155; }}
      .eyebrow {{ font-size: 0.78rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #0891b2; }}
      .chips {{ display: flex; flex-wrap: wrap; gap: 10px; margin: 20px 0 8px; }}
      .chip {{ border-radius: 999px; background: #e0f2fe; color: #0c4a6e; padding: 8px 12px; font-size: 0.85rem; font-weight: 600; }}
      .cta {{ margin-top: 28px; }}
      .cta a {{ display: inline-block; border-radius: 999px; background: #0891b2; color: white; padding: 12px 18px; text-decoration: none; font-weight: 700; }}
      ul {{ line-height: 1.8; color: #334155; }}
      a {{ color: #0f172a; }}
    </style>
  </head>
  <body>
    <main>
      <div class="eyebrow">JobShaman SEO</div>
      <h1>{html.escape(heading)}</h1>
      <p>{html.escape(description)}</p>
      <div class="chips">{chips_html}</div>
      {''.join(f'<p>{html.escape(paragraph)}</p>' for paragraph in paragraphs)}
      {jobs_html}
      <div class="cta"><a href="{html.escape(APP_PUBLIC_URL)}">Open JobShaman</a></div>
    </main>
  </body>
</html>
"""
    return HTMLResponse(content=html_body)


def _collection_structured_data(title: str, canonical_url: str, description: str, jobs: list[dict] | None = None) -> dict:
    item_list = []
    for index, job in enumerate(jobs or [], start=1):
        item_list.append(
            {
                "@type": "ListItem",
                "position": index,
                "url": f"{APP_PUBLIC_URL}/jobs/{job.get('id')}",
                "name": job.get("title") or "Job",
            }
        )
    return {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "CollectionPage",
                "name": title,
                "url": canonical_url,
                "description": description,
            },
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "JobShaman", "item": APP_PUBLIC_URL},
                    {"@type": "ListItem", "position": 2, "name": title, "item": canonical_url},
                ],
            },
            {
                "@type": "ItemList",
                "itemListElement": item_list,
            },
        ],
    }


@router.get("/sitemap.xml")
async def sitemap_index() -> Response:
    return _render_sitemap_index(
        [
            f"{APP_PUBLIC_URL}/sitemap-pages.xml",
            f"{APP_PUBLIC_URL}/sitemap-clusters.xml",
            f"{APP_PUBLIC_URL}/sitemap-jobs.xml",
        ]
    )


@router.get("/sitemap-pages.xml")
async def sitemap_pages() -> Response:
    today = datetime.now(timezone.utc).date().isoformat()
    rows = [
        {"loc": APP_PUBLIC_URL, "lastmod": today, "changefreq": "daily", "priority": "1.0"},
        {"loc": f"{APP_PUBLIC_URL}/pro-firmy", "lastmod": today, "changefreq": "weekly", "priority": "0.9"},
        {"loc": f"{APP_PUBLIC_URL}/about", "lastmod": today, "changefreq": "monthly", "priority": "0.7"},
        {"loc": f"{APP_PUBLIC_URL}/jobs", "lastmod": today, "changefreq": "hourly", "priority": "0.9"},
    ]
    for slug in _TOPIC_PAGES.keys():
        rows.append(
            {
                "loc": f"{APP_PUBLIC_URL}/seo/{slug}",
                "lastmod": today,
                "changefreq": "weekly",
                "priority": "0.8",
            }
        )
    return _render_xml_urlset(rows)


@router.get("/sitemap-clusters.xml")
async def sitemap_clusters() -> Response:
    taxonomy_rows = _fetch_role_taxonomy()
    today = datetime.now(timezone.utc).date().isoformat()
    rows: list[dict[str, str]] = []
    seen_roles: set[str] = set()
    seen_families: set[str] = set()
    for row in taxonomy_rows:
        role_slug = _slugify(row.get("canonical_role"))
        family_slug = _slugify(row.get("role_family"))
        if role_slug and role_slug not in seen_roles:
            seen_roles.add(role_slug)
            rows.append(
                {
                    "loc": f"{APP_PUBLIC_URL}/seo/roles/{role_slug}",
                    "lastmod": today,
                    "changefreq": "daily",
                    "priority": "0.7",
                }
            )
        if family_slug and family_slug not in seen_families:
            seen_families.add(family_slug)
            rows.append(
                {
                    "loc": f"{APP_PUBLIC_URL}/seo/families/{family_slug}",
                    "lastmod": today,
                    "changefreq": "weekly",
                    "priority": "0.65",
                }
            )
    return _render_xml_urlset(rows)


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


@router.get("/seo/roles/{role_slug}")
async def prerender_role_page(role_slug: str) -> HTMLResponse:
    taxonomy_rows = _fetch_role_taxonomy()
    role_row = next((row for row in taxonomy_rows if _slugify(row.get("canonical_role")) == role_slug), None)
    if not role_row:
        raise HTTPException(status_code=404, detail="Role page not found")

    recent_jobs = _fetch_recent_jobs()
    jobs = _jobs_for_role(role_row, recent_jobs)
    family_rows = [
        row for row in taxonomy_rows
        if _slugify(row.get("role_family")) == _slugify(role_row.get("role_family"))
    ]
    if not jobs and family_rows:
        jobs = _jobs_for_family(family_rows, recent_jobs)
    canonical_role = str(role_row.get("canonical_role") or _humanize_slug(role_slug))
    family_label = _humanize_slug(role_row.get("role_family"))
    description = (
        f"{canonical_role} jobs on JobShaman. Explore live roles, adjacent moves, and collaboration-first hiring signals around {canonical_role}."
    )
    canonical_url = f"{APP_PUBLIC_URL}/seo/roles/{role_slug}"
    return _render_landing_page(
        title=f"{canonical_role} jobs | JobShaman",
        description=description,
        canonical_url=canonical_url,
        heading=f"{canonical_role} roles and paths",
        paragraphs=[
            f"This page groups live opportunities connected to {canonical_role}.",
            f"It also reflects the wider {family_label} direction, so candidates can see realistic nearby moves instead of only one static title.",
            "When there are fewer exact title matches, nearby roles from the same family can still show the shape of the market around this destination.",
            "On JobShaman, listings are part of a wider system that includes Career Map, goal navigation, mini challenges, and handshake hiring.",
        ],
        jobs=jobs,
        chips=[canonical_role, family_label, "Career Map", "Goal navigation"],
        structured_data=_collection_structured_data(f"{canonical_role} jobs", canonical_url, description, jobs),
    )


@router.get("/seo/families/{family_slug}")
async def prerender_family_page(family_slug: str) -> HTMLResponse:
    taxonomy_rows = _fetch_role_taxonomy()
    family_rows = [row for row in taxonomy_rows if _slugify(row.get("role_family")) == family_slug]
    if not family_rows:
        raise HTTPException(status_code=404, detail="Family page not found")

    recent_jobs = _fetch_recent_jobs()
    jobs = _jobs_for_family(family_rows, recent_jobs)
    if not jobs:
        jobs = recent_jobs[:12]
    family_label = _humanize_slug(family_slug)
    top_roles = [str(row.get("canonical_role") or "") for row in family_rows[:6] if str(row.get("canonical_role") or "").strip()]
    description = (
        f"{family_label} jobs and adjacent paths on JobShaman. See live roles, realistic transitions, and signals around this family of work."
    )
    canonical_url = f"{APP_PUBLIC_URL}/seo/families/{family_slug}"
    return _render_landing_page(
        title=f"{family_label} jobs and paths | JobShaman",
        description=description,
        canonical_url=canonical_url,
        heading=f"{family_label} jobs, roles, and next moves",
        paragraphs=[
            f"{family_label} is bigger than one title. It usually includes nearby roles that share workflows, tools, pace, and responsibility patterns.",
            f"Common roles here include {', '.join(top_roles[:4]) if top_roles else family_label}.",
            "This makes family pages useful both for direct search intent and for candidates who are still shaping the right next move.",
        ],
        jobs=jobs,
        chips=[family_label, "Handshake hiring", "Mini challenges"],
        structured_data=_collection_structured_data(f"{family_label} jobs", canonical_url, description, jobs),
    )


@router.get("/seo/{topic_slug}")
async def prerender_topic_page(topic_slug: str) -> HTMLResponse:
    page = _TOPIC_PAGES.get(topic_slug)
    if not page:
        raise HTTPException(status_code=404, detail="SEO page not found")
    canonical_url = f"{APP_PUBLIC_URL}/seo/{topic_slug}"
    return _render_landing_page(
        title=f"{page['title']} | JobShaman",
        description=page["description"],
        canonical_url=canonical_url,
        heading=page["headline"],
        paragraphs=page["body"],
        chips=[page["title"], "JobShaman", "Collaboration-first hiring"],
        structured_data=_collection_structured_data(page["title"], canonical_url, page["description"]),
    )


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
        "@graph": [
            {
                "@type": "JobPosting",
                "title": title,
                "description": description_plain or f"{title} · {company}",
                "identifier": {
                    "@type": "PropertyValue",
                    "name": "JobShaman",
                    "value": str(job.get("id"))
                },
                "datePosted": job.get("posted_at") or job.get("scraped_at"),
                "employmentType": job.get("contract_type") or job.get("work_type") or None,
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
                "applicantLocationRequirements": {
                    "@type": "Country",
                    "name": job.get("country_code") or None
                },
                "directApply": bool(job.get("url")),
                "url": job_url
            },
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "JobShaman",
                        "item": APP_PUBLIC_URL
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": "Jobs",
                        "item": f"{APP_PUBLIC_URL}/jobs"
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": title,
                        "item": job_url
                    }
                ]
            }
        ]
    }

    if salary_from or salary_to:
        ld_json["@graph"][0]["baseSalary"] = {
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
    <meta name=\"robots\" content=\"index, follow, max-snippet:-1, max-image-preview:large\" />
    <meta property=\"og:type\" content=\"article\" />
    <meta property=\"og:title\" content=\"{html.escape(title)} | {html.escape(company)}\" />
    <meta property=\"og:description\" content=\"{html.escape(description_meta or f'{title} · {company}') }\" />
    <meta property=\"og:image\" content=\"{html.escape(og_image)}\" />
    <meta property=\"og:url\" content=\"{html.escape(job_url)}\" />
    <meta property=\"og:locale\" content=\"{html.escape(locale)}\" />
    <meta property=\"og:site_name\" content=\"JobShaman\" />
    <meta property=\"twitter:card\" content=\"summary_large_image\" />
    <meta property=\"twitter:title\" content=\"{html.escape(title)} | {html.escape(company)}\" />
    <meta property=\"twitter:description\" content=\"{html.escape(description_meta or f'{title} · {company}') }\" />
    <meta property=\"twitter:image\" content=\"{html.escape(og_image)}\" />
    <meta name=\"ai-summary\" content=\"{html.escape(description_meta or f'{title} at {company}.')}\" />
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
=======
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response, HTMLResponse
from datetime import datetime, timezone
import html
import json
import re
import unicodedata
from ..core.database import supabase
from ..core.config import APP_PUBLIC_URL

router = APIRouter()

_TOPIC_PAGES = {
    "career-map": {
        "title": "Career Map",
        "headline": "Career Map shows where a role can lead next",
        "description": "Career Map turns live jobs into visible directions, adjacent moves, and realistic next steps based on how work actually connects.",
        "body": [
            "Instead of showing one flat stream of listings, Career Map helps candidates understand the shape of the market around them.",
            "It highlights nearby directions, role clusters, and bridge moves that make sense from the current profile and context.",
            "The goal is not just to browse. The goal is to see where you can realistically move next.",
        ],
    },
    "goal-navigation": {
        "title": "Goal Navigation",
        "headline": "Goal Navigation helps candidates move from profile to realistic destination",
        "description": "Goal Navigation translates a target role into a practical route with bridge roles, skill gaps, proof steps, and live opportunities.",
        "body": [
            "Candidates can enter a destination like Customer Success, Operations, or AI Product Manager and see a route instead of just a list.",
            "The route is built from current profile signals, live market demand, role adjacency, and practical next steps.",
            "This makes the market easier to act on because the question becomes how to get there, not only where to click.",
        ],
    },
    "handshake-hiring": {
        "title": "Handshake Hiring",
        "headline": "Handshake hiring starts with real interaction",
        "description": "Handshake hiring replaces one-sided filtering with short, real working interaction and stronger signals about compatibility.",
        "body": [
            "Traditional hiring optimizes selection. Handshake hiring optimizes what happens when people actually begin working together.",
            "Companies open roles through real tasks and practical situations. Candidates respond through short working moments instead of only polished documents.",
            "AI helps prepare and guide the process, but the decision stays with people.",
        ],
    },
    "mini-challenges": {
        "title": "Mini Challenges",
        "headline": "Mini Challenges create proof through short real work",
        "description": "Mini Challenges are short, scoped collaborations that help both sides see how the work feels before a bigger decision is made.",
        "body": [
            "They are useful when a candidate wants to show how they think, ask questions, and structure a problem in practice.",
            "They are useful when a company wants stronger signals than a CV or a polished interview answer can provide.",
            "That makes mini challenges a practical bridge between discovery and decision.",
        ],
    },
}


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


def _normalize_text(value: str | None) -> str:
    text = str(value or "").strip().lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^a-z0-9\s-]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _slugify(value: str | None) -> str:
    normalized = _normalize_text(value)
    return normalized.replace(" ", "-")


def _humanize_slug(value: str | None) -> str:
    slug = str(value or "").strip().replace("-", " ").replace("_", " ")
    return " ".join(part.capitalize() for part in slug.split())


def _fetch_role_taxonomy() -> list[dict]:
    if not supabase:
        return []
    try:
        resp = (
            supabase
            .table("role_taxonomy")
            .select("canonical_role, role_family, role_track, aliases")
            .order("canonical_role")
            .limit(5000)
            .execute()
        )
        return [row for row in (resp.data or []) if isinstance(row, dict)]
    except Exception:
        return []


def _fetch_recent_jobs(limit: int = 1500) -> list[dict]:
    if not supabase:
        return []
    try:
        resp = (
            supabase
            .table("jobs")
            .select("id,title,company,location,description,work_type,contract_type,salary_from,salary_to,scraped_at,posted_at,url,country_code,language_code")
            .order("scraped_at", desc=True)
            .limit(limit)
            .execute()
        )
        return [row for row in (resp.data or []) if isinstance(row, dict)]
    except Exception:
        return []


def _role_aliases(role_row: dict) -> list[str]:
    aliases = role_row.get("aliases")
    values: list[str] = []
    if isinstance(aliases, list):
        values.extend(str(item or "").strip() for item in aliases)
    canonical = str(role_row.get("canonical_role") or "").strip()
    if canonical:
        values.append(canonical)
    seen: set[str] = set()
    deduped: list[str] = []
    for value in values:
        normalized = _normalize_text(value)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(value)
    return deduped


def _job_matches_aliases(job: dict, aliases: list[str]) -> bool:
    haystack = _normalize_text(
        " ".join(
            [
                str(job.get("title") or ""),
                str(job.get("description") or ""),
                str(job.get("company") or ""),
                str(job.get("location") or ""),
            ]
        )
    )
    if not haystack:
        return False
    return any(_normalize_text(alias) in haystack for alias in aliases if _normalize_text(alias))


def _jobs_for_role(role_row: dict, jobs: list[dict], limit: int = 12) -> list[dict]:
    aliases = _role_aliases(role_row)
    matched = [job for job in jobs if _job_matches_aliases(job, aliases)]
    return matched[:limit]


def _jobs_for_family(role_rows: list[dict], jobs: list[dict], limit: int = 12) -> list[dict]:
    aliases: list[str] = []
    for row in role_rows[:12]:
        aliases.extend(_role_aliases(row)[:4])
    matched = [job for job in jobs if _job_matches_aliases(job, aliases)]
    return matched[:limit]


def _render_xml_urlset(rows: list[dict[str, str]]) -> Response:
    lines = [
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
        "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">",
    ]
    for row in rows:
        lines.append("  <url>")
        lines.append(f"    <loc>{html.escape(row['loc'])}</loc>")
        lines.append(f"    <lastmod>{html.escape(row['lastmod'])}</lastmod>")
        lines.append(f"    <changefreq>{html.escape(row['changefreq'])}</changefreq>")
        lines.append(f"    <priority>{html.escape(row['priority'])}</priority>")
        lines.append("  </url>")
    lines.append("</urlset>")
    return Response("\n".join(lines), media_type="application/xml")


def _render_sitemap_index(rows: list[str]) -> Response:
    lines = [
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
        "<sitemapindex xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">",
    ]
    for url in rows:
        lines.append("  <sitemap>")
        lines.append(f"    <loc>{html.escape(url)}</loc>")
        lines.append(f"    <lastmod>{datetime.now(timezone.utc).date().isoformat()}</lastmod>")
        lines.append("  </sitemap>")
    lines.append("</sitemapindex>")
    return Response("\n".join(lines), media_type="application/xml")


def _job_card_html(job: dict) -> str:
    title = str(job.get("title") or "Job")
    company = str(job.get("company") or "JobShaman")
    location = str(job.get("location") or "")
    salary_parts = [str(int(value)) for value in [job.get("salary_from"), job.get("salary_to")] if value]
    salary = " - ".join(salary_parts)
    salary_label = f" · {salary} CZK" if salary else ""
    return (
        f"<li><a href=\"{html.escape(f'{APP_PUBLIC_URL}/jobs/{job.get('id')}')}\">"
        f"{html.escape(title)}</a> · {html.escape(company)}"
        f"{f' · {html.escape(location)}' if location else ''}{html.escape(salary_label)}</li>"
    )


def _render_landing_page(*, title: str, description: str, canonical_url: str, heading: str, paragraphs: list[str], jobs: list[dict] | None = None, chips: list[str] | None = None, structured_data: dict | None = None) -> HTMLResponse:
    og_image = f"{APP_PUBLIC_URL}/og-image.jpg"
    chips_html = "".join(
        f"<span class=\"chip\">{html.escape(chip)}</span>"
        for chip in (chips or [])
    )
    jobs_html = ""
    if jobs:
        jobs_html = (
            "<section><h2>Live roles on JobShaman</h2>"
            "<ul>"
            + "".join(_job_card_html(job) for job in jobs[:12])
            + "</ul></section>"
        )
    ld_json_str = ""
    if structured_data:
        ld_json_str = json.dumps(structured_data, ensure_ascii=False).replace("</", "<\\/")

    html_body = f"""
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{html.escape(title)}</title>
    <meta name="description" content="{html.escape(description)}" />
    <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="{html.escape(title)}" />
    <meta property="og:description" content="{html.escape(description)}" />
    <meta property="og:image" content="{html.escape(og_image)}" />
    <meta property="og:url" content="{html.escape(canonical_url)}" />
    <meta property="og:site_name" content="JobShaman" />
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:title" content="{html.escape(title)}" />
    <meta property="twitter:description" content="{html.escape(description)}" />
    <meta property="twitter:image" content="{html.escape(og_image)}" />
    <meta name="ai-summary" content="{html.escape(description)}" />
    <link rel="canonical" href="{html.escape(canonical_url)}" />
    {f'<script type="application/ld+json">{ld_json_str}</script>' if ld_json_str else ''}
    <style>
      body {{ font-family: Arial, sans-serif; margin: 0; color: #0f172a; background: #f8fafc; }}
      main {{ max-width: 920px; margin: 0 auto; padding: 48px 24px 72px; }}
      h1 {{ font-size: 2.2rem; line-height: 1.15; margin: 0 0 16px; }}
      h2 {{ margin-top: 2rem; }}
      p {{ line-height: 1.7; color: #334155; }}
      .eyebrow {{ font-size: 0.78rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #0891b2; }}
      .chips {{ display: flex; flex-wrap: wrap; gap: 10px; margin: 20px 0 8px; }}
      .chip {{ border-radius: 999px; background: #e0f2fe; color: #0c4a6e; padding: 8px 12px; font-size: 0.85rem; font-weight: 600; }}
      .cta {{ margin-top: 28px; }}
      .cta a {{ display: inline-block; border-radius: 999px; background: #0891b2; color: white; padding: 12px 18px; text-decoration: none; font-weight: 700; }}
      ul {{ line-height: 1.8; color: #334155; }}
      a {{ color: #0f172a; }}
    </style>
  </head>
  <body>
    <main>
      <div class="eyebrow">JobShaman SEO</div>
      <h1>{html.escape(heading)}</h1>
      <p>{html.escape(description)}</p>
      <div class="chips">{chips_html}</div>
      {''.join(f'<p>{html.escape(paragraph)}</p>' for paragraph in paragraphs)}
      {jobs_html}
      <div class="cta"><a href="{html.escape(APP_PUBLIC_URL)}">Open JobShaman</a></div>
    </main>
  </body>
</html>
"""
    return HTMLResponse(content=html_body)


def _collection_structured_data(title: str, canonical_url: str, description: str, jobs: list[dict] | None = None) -> dict:
    item_list = []
    for index, job in enumerate(jobs or [], start=1):
        item_list.append(
            {
                "@type": "ListItem",
                "position": index,
                "url": f"{APP_PUBLIC_URL}/jobs/{job.get('id')}",
                "name": job.get("title") or "Job",
            }
        )
    return {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "CollectionPage",
                "name": title,
                "url": canonical_url,
                "description": description,
            },
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "JobShaman", "item": APP_PUBLIC_URL},
                    {"@type": "ListItem", "position": 2, "name": title, "item": canonical_url},
                ],
            },
            {
                "@type": "ItemList",
                "itemListElement": item_list,
            },
        ],
    }


@router.get("/sitemap.xml")
async def sitemap_index() -> Response:
    return _render_sitemap_index(
        [
            f"{APP_PUBLIC_URL}/sitemap-pages.xml",
            f"{APP_PUBLIC_URL}/sitemap-clusters.xml",
            f"{APP_PUBLIC_URL}/sitemap-jobs.xml",
        ]
    )


@router.get("/sitemap-pages.xml")
async def sitemap_pages() -> Response:
    today = datetime.now(timezone.utc).date().isoformat()
    rows = [
        {"loc": APP_PUBLIC_URL, "lastmod": today, "changefreq": "daily", "priority": "1.0"},
        {"loc": f"{APP_PUBLIC_URL}/pro-firmy", "lastmod": today, "changefreq": "weekly", "priority": "0.9"},
        {"loc": f"{APP_PUBLIC_URL}/about", "lastmod": today, "changefreq": "monthly", "priority": "0.7"},
        {"loc": f"{APP_PUBLIC_URL}/jobs", "lastmod": today, "changefreq": "hourly", "priority": "0.9"},
    ]
    for slug in _TOPIC_PAGES.keys():
        rows.append(
            {
                "loc": f"{APP_PUBLIC_URL}/seo/{slug}",
                "lastmod": today,
                "changefreq": "weekly",
                "priority": "0.8",
            }
        )
    return _render_xml_urlset(rows)


@router.get("/sitemap-clusters.xml")
async def sitemap_clusters() -> Response:
    taxonomy_rows = _fetch_role_taxonomy()
    today = datetime.now(timezone.utc).date().isoformat()
    rows: list[dict[str, str]] = []
    seen_roles: set[str] = set()
    seen_families: set[str] = set()
    for row in taxonomy_rows:
        role_slug = _slugify(row.get("canonical_role"))
        family_slug = _slugify(row.get("role_family"))
        if role_slug and role_slug not in seen_roles:
            seen_roles.add(role_slug)
            rows.append(
                {
                    "loc": f"{APP_PUBLIC_URL}/seo/roles/{role_slug}",
                    "lastmod": today,
                    "changefreq": "daily",
                    "priority": "0.7",
                }
            )
        if family_slug and family_slug not in seen_families:
            seen_families.add(family_slug)
            rows.append(
                {
                    "loc": f"{APP_PUBLIC_URL}/seo/families/{family_slug}",
                    "lastmod": today,
                    "changefreq": "weekly",
                    "priority": "0.65",
                }
            )
    return _render_xml_urlset(rows)


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


@router.get("/seo/roles/{role_slug}")
async def prerender_role_page(role_slug: str) -> HTMLResponse:
    taxonomy_rows = _fetch_role_taxonomy()
    role_row = next((row for row in taxonomy_rows if _slugify(row.get("canonical_role")) == role_slug), None)
    if not role_row:
        raise HTTPException(status_code=404, detail="Role page not found")

    recent_jobs = _fetch_recent_jobs()
    jobs = _jobs_for_role(role_row, recent_jobs)
    family_rows = [
        row for row in taxonomy_rows
        if _slugify(row.get("role_family")) == _slugify(role_row.get("role_family"))
    ]
    if not jobs and family_rows:
        jobs = _jobs_for_family(family_rows, recent_jobs)
    canonical_role = str(role_row.get("canonical_role") or _humanize_slug(role_slug))
    family_label = _humanize_slug(role_row.get("role_family"))
    description = (
        f"{canonical_role} jobs on JobShaman. Explore live roles, adjacent moves, and collaboration-first hiring signals around {canonical_role}."
    )
    canonical_url = f"{APP_PUBLIC_URL}/seo/roles/{role_slug}"
    return _render_landing_page(
        title=f"{canonical_role} jobs | JobShaman",
        description=description,
        canonical_url=canonical_url,
        heading=f"{canonical_role} roles and paths",
        paragraphs=[
            f"This page groups live opportunities connected to {canonical_role}.",
            f"It also reflects the wider {family_label} direction, so candidates can see realistic nearby moves instead of only one static title.",
            "When there are fewer exact title matches, nearby roles from the same family can still show the shape of the market around this destination.",
            "On JobShaman, listings are part of a wider system that includes Career Map, goal navigation, mini challenges, and handshake hiring.",
        ],
        jobs=jobs,
        chips=[canonical_role, family_label, "Career Map", "Goal navigation"],
        structured_data=_collection_structured_data(f"{canonical_role} jobs", canonical_url, description, jobs),
    )


@router.get("/seo/families/{family_slug}")
async def prerender_family_page(family_slug: str) -> HTMLResponse:
    taxonomy_rows = _fetch_role_taxonomy()
    family_rows = [row for row in taxonomy_rows if _slugify(row.get("role_family")) == family_slug]
    if not family_rows:
        raise HTTPException(status_code=404, detail="Family page not found")

    recent_jobs = _fetch_recent_jobs()
    jobs = _jobs_for_family(family_rows, recent_jobs)
    if not jobs:
        jobs = recent_jobs[:12]
    family_label = _humanize_slug(family_slug)
    top_roles = [str(row.get("canonical_role") or "") for row in family_rows[:6] if str(row.get("canonical_role") or "").strip()]
    description = (
        f"{family_label} jobs and adjacent paths on JobShaman. See live roles, realistic transitions, and signals around this family of work."
    )
    canonical_url = f"{APP_PUBLIC_URL}/seo/families/{family_slug}"
    return _render_landing_page(
        title=f"{family_label} jobs and paths | JobShaman",
        description=description,
        canonical_url=canonical_url,
        heading=f"{family_label} jobs, roles, and next moves",
        paragraphs=[
            f"{family_label} is bigger than one title. It usually includes nearby roles that share workflows, tools, pace, and responsibility patterns.",
            f"Common roles here include {', '.join(top_roles[:4]) if top_roles else family_label}.",
            "This makes family pages useful both for direct search intent and for candidates who are still shaping the right next move.",
        ],
        jobs=jobs,
        chips=[family_label, "Handshake hiring", "Mini challenges"],
        structured_data=_collection_structured_data(f"{family_label} jobs", canonical_url, description, jobs),
    )


@router.get("/seo/{topic_slug}")
async def prerender_topic_page(topic_slug: str) -> HTMLResponse:
    page = _TOPIC_PAGES.get(topic_slug)
    if not page:
        raise HTTPException(status_code=404, detail="SEO page not found")
    canonical_url = f"{APP_PUBLIC_URL}/seo/{topic_slug}"
    return _render_landing_page(
        title=f"{page['title']} | JobShaman",
        description=page["description"],
        canonical_url=canonical_url,
        heading=page["headline"],
        paragraphs=page["body"],
        chips=[page["title"], "JobShaman", "Collaboration-first hiring"],
        structured_data=_collection_structured_data(page["title"], canonical_url, page["description"]),
    )


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
        "@graph": [
            {
                "@type": "JobPosting",
                "title": title,
                "description": description_plain or f"{title} · {company}",
                "identifier": {
                    "@type": "PropertyValue",
                    "name": "JobShaman",
                    "value": str(job.get("id"))
                },
                "datePosted": job.get("posted_at") or job.get("scraped_at"),
                "employmentType": job.get("contract_type") or job.get("work_type") or None,
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
                "applicantLocationRequirements": {
                    "@type": "Country",
                    "name": job.get("country_code") or None
                },
                "directApply": bool(job.get("url")),
                "url": job_url
            },
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "JobShaman",
                        "item": APP_PUBLIC_URL
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": "Jobs",
                        "item": f"{APP_PUBLIC_URL}/jobs"
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": title,
                        "item": job_url
                    }
                ]
            }
        ]
    }

    if salary_from or salary_to:
        ld_json["@graph"][0]["baseSalary"] = {
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
    <meta name=\"robots\" content=\"index, follow, max-snippet:-1, max-image-preview:large\" />
    <meta property=\"og:type\" content=\"article\" />
    <meta property=\"og:title\" content=\"{html.escape(title)} | {html.escape(company)}\" />
    <meta property=\"og:description\" content=\"{html.escape(description_meta or f'{title} · {company}') }\" />
    <meta property=\"og:image\" content=\"{html.escape(og_image)}\" />
    <meta property=\"og:url\" content=\"{html.escape(job_url)}\" />
    <meta property=\"og:locale\" content=\"{html.escape(locale)}\" />
    <meta property=\"og:site_name\" content=\"JobShaman\" />
    <meta property=\"twitter:card\" content=\"summary_large_image\" />
    <meta property=\"twitter:title\" content=\"{html.escape(title)} | {html.escape(company)}\" />
    <meta property=\"twitter:description\" content=\"{html.escape(description_meta or f'{title} · {company}') }\" />
    <meta property=\"twitter:image\" content=\"{html.escape(og_image)}\" />
    <meta name=\"ai-summary\" content=\"{html.escape(description_meta or f'{title} at {company}.')}\" />
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
>>>>>>> 4c20d82 (Jobshaman MVP 2.0: Clean repo, i18n Nordic expansion & engine optimization)
