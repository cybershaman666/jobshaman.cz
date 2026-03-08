from __future__ import annotations

from typing import Any

import requests
from requests import Response

from ..config import AppConfig
from ..models import JobPosting, Preferences


class JobShamanSource:
    def __init__(self, config: AppConfig):
        self.config = config

    def fetch_jobs(self, preferences: Preferences, limit: int) -> list[JobPosting]:
        payload: dict[str, Any] = {
            "search_term": "",
            "page": 0,
            "page_size": limit,
            # Keep source fetch broad and filter locally during ranking.
            "filter_contract_types": None,
            "filter_min_salary": None,
            "filter_language_codes": None,
            "filter_country_codes": [],
            "exclude_country_codes": [],
            "sort_mode": "newest",
            "debug": False,
        }
        response = self._post_with_fallback(
            endpoint=self.config.jobshaman_search_endpoint,
            json=payload,
            headers={"User-Agent": self.config.user_agent},
        )
        response.raise_for_status()
        data = response.json()
        jobs = data.get("jobs") or []
        return [self._to_job(job) for job in jobs]

    def apply(self, job: JobPosting, cover_letter: str, resume: str) -> tuple[dict[str, Any], dict[str, Any] | None]:
        payload = {
            "job_id": int(job.id),
            "source": "local_job_agent",
            "cover_letter": cover_letter,
            "cv_snapshot": {"raw_resume": resume[:15000]},
            "candidate_profile_snapshot": {"summary": resume[:1000]},
            "metadata": {"agent": "local_ollama_job_agent"},
        }
        if self.config.dry_run:
            return payload, None
        if not self.config.jobshaman_access_token or not self.config.jobshaman_csrf_token:
            raise RuntimeError("Missing JobShaman auth tokens.")
        response = self._post_with_fallback(
            endpoint=self.config.jobshaman_apply_endpoint,
            json=payload,
            headers={
                "Authorization": f"Bearer {self.config.jobshaman_access_token}",
                "x-csrf-token": self.config.jobshaman_csrf_token,
                "User-Agent": self.config.user_agent,
            },
        )
        response.raise_for_status()
        return payload, response.json()

    def _post_with_fallback(self, endpoint: str, json: dict[str, Any], headers: dict[str, str]) -> Response:
        last_error: Exception | None = None
        for base_url in self._candidate_bases():
            try:
                response = requests.post(
                    f"{base_url.rstrip('/')}{endpoint}",
                    json=json,
                    headers=headers,
                    timeout=45,
                    verify=self.config.jobshaman_verify_ssl,
                )
                response.raise_for_status()
                return response
            except Exception as exc:
                last_error = exc
        if last_error:
            raise last_error
        raise RuntimeError("No JobShaman API base configured.")

    def _candidate_bases(self) -> list[str]:
        bases = [self.config.jobshaman_api_base, *self.config.jobshaman_api_fallbacks]
        unique: list[str] = []
        for item in bases:
            if item and item not in unique:
                unique.append(item)
        return unique

    def _to_job(self, item: dict[str, Any]) -> JobPosting:
        return JobPosting(
            id=str(item.get("id")),
            source="jobshaman",
            title=item.get("title") or "",
            company=item.get("company") or item.get("company_name") or "",
            location=item.get("location") or item.get("city"),
            remote=bool(item.get("is_remote") or ("remote" in str(item.get("location") or "").lower())),
            url=item.get("detail_url") or item.get("url"),
            apply_url=item.get("detail_url") or item.get("url"),
            description=item.get("description") or item.get("summary") or "",
            salary_min=_to_int(item.get("salary_min") or item.get("salary_from")),
            salary_max=_to_int(item.get("salary_max") or item.get("salary_to")),
            salary_currency=item.get("salary_currency"),
            contract_type=item.get("contract_type"),
            language_code=(item.get("language_code") or item.get("language")),
            metadata=item,
        )


def _to_int(value: Any) -> int | None:
    try:
        return int(float(value))
    except Exception:
        return None
