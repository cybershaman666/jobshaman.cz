from __future__ import annotations

import html
import re
from typing import Any
from urllib.parse import urlparse
from xml.etree import ElementTree

import requests

from ..config import AppConfig
from ..models import JobPosting


class WeWorkRemotelySource:
    def __init__(self, config: AppConfig):
        self.config = config

    def fetch_jobs(self, limit: int) -> list[JobPosting]:
        candidate_urls = [
            self.config.wwr_api_url,
            "https://weworkremotely.com/categories/remote-programming-jobs.rss",
            "https://weworkremotely.com/remote-jobs.rss",
            "https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss",
            "https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss",
        ]
        seen_ids: set[str] = set()
        results: list[JobPosting] = []
        last_error: Exception | None = None
        for url in candidate_urls:
            try:
                response = requests.get(
                    url,
                    headers={"User-Agent": self.config.user_agent},
                    timeout=45,
                )
                response.raise_for_status()
                content_type = (response.headers.get("content-type") or "").lower()
                if "json" in content_type:
                    items = self._parse_json(response.json(), limit)
                else:
                    items = self._parse_rss(response.text, limit)
                for item in items:
                    if item.id in seen_ids:
                        continue
                    seen_ids.add(item.id)
                    results.append(item)
                    if len(results) >= limit:
                        return results
            except Exception as exc:
                last_error = exc
        if results:
            return results
        if last_error:
            raise last_error
        return []

    def _parse_rss(self, xml_text: str, limit: int) -> list[JobPosting]:
        root = ElementTree.fromstring(xml_text)
        items: list[JobPosting] = []
        for item in root.findall(".//item")[:limit]:
            title = _text(item, "title")
            link = _text(item, "link")
            description = _text(item, "description")
            company, role = _split_title(title)
            location = _extract_location(description)
            items.append(
                JobPosting(
                    id=link or title,
                    source="weworkremotely",
                    title=role or title,
                    company=company or _company_from_link(link),
                    location=location or "Remote",
                    remote=True,
                    url=link,
                    apply_url=link,
                    description=_strip_html(description),
                    language_code="en",
                    metadata={"rss_title": title},
                )
            )
        return items

    def _parse_json(self, data: dict[str, Any], limit: int) -> list[JobPosting]:
        raw_jobs = data.get("jobs") or data.get("remote_jobs") or []
        return [self._to_job(item) for item in raw_jobs[:limit]]

    def _to_job(self, item: dict[str, Any]) -> JobPosting:
        company = item.get("company_name") or item.get("company") or ""
        url = item.get("url") or item.get("job_url")
        apply_url = item.get("application_url") or url
        return JobPosting(
            id=str(item.get("id") or item.get("slug") or url),
            source="weworkremotely",
            title=item.get("title") or "",
            company=company,
            location=item.get("region") or item.get("location"),
            remote=True,
            url=url,
            apply_url=apply_url,
            description=item.get("description") or item.get("body") or item.get("snippet") or "",
            salary_min=_to_int(item.get("salary_min")),
            salary_max=_to_int(item.get("salary_max")),
            salary_currency=item.get("salary_currency"),
            contract_type=item.get("employment_type"),
            language_code=item.get("language"),
            metadata=item,
        )


def _to_int(value: Any) -> int | None:
    try:
        return int(float(value))
    except Exception:
        return None


def _text(node: ElementTree.Element, tag: str) -> str:
    found = node.find(tag)
    return (found.text or "").strip() if found is not None and found.text else ""


def _split_title(title: str) -> tuple[str, str]:
    parts = [part.strip() for part in title.split(": ", 1)]
    if len(parts) == 2:
        return parts[0], parts[1]
    parts = [part.strip() for part in title.split(" - ", 1)]
    if len(parts) == 2:
        return parts[0], parts[1]
    return "", title.strip()


def _strip_html(value: str) -> str:
    text = re.sub(r"<[^>]+>", " ", html.unescape(value or ""))
    return re.sub(r"\s+", " ", text).strip()


def _extract_location(description: str) -> str | None:
    plain = _strip_html(description)
    match = re.search(r"(Anywhere in the World|Europe Only|USA Only|North America Only|EMEA Only|UK Only|Canada Only)", plain, re.I)
    return match.group(1) if match else None


def _company_from_link(link: str) -> str:
    if not link:
        return ""
    parsed = urlparse(link)
    host = parsed.netloc.replace("www.", "")
    return host.split(".")[0].replace("-", " ").title()
