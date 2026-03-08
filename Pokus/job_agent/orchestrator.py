from __future__ import annotations

import json

from .application import apply_to_job, build_draft
from .config import AppConfig, get_config
from .llm import OllamaClient
from .matching import rank_jobs
from .models import ApplicationDraft, ApplyResult, JobRecommendation, Preferences
from .profile import dump_preferences, load_preferences, load_resume, save_preferences, save_resume
from .sources import JobShamanSource, WeWorkRemotelySource


class JobAgentService:
    def __init__(self, config: AppConfig | None = None):
        self.config = config or get_config()
        self.profile = load_resume(self.config.resume_path)
        self.preferences = load_preferences(self.config.preferences_path)
        self.llm = OllamaClient(self.config)
        self.jobshaman = JobShamanSource(self.config)
        self.wwr = WeWorkRemotelySource(self.config)
        self.last_fetch_report = {"jobshaman": {"count": 0, "error": None}, "weworkremotely": {"count": 0, "error": None}}

    def get_profile_bundle(self) -> dict[str, str]:
        return {
            "resume": self.config.resume_path.read_text(encoding="utf-8"),
            "preferences": self.config.preferences_path.read_text(encoding="utf-8"),
        }

    def get_llm_status(self) -> dict:
        return self.llm.status()

    def update_profile_bundle(self, resume: str, preferences: str) -> dict[str, str]:
        self.profile = save_resume(self.config.resume_path, resume)
        self.preferences = save_preferences(self.config.preferences_path, preferences)
        return self.get_profile_bundle()

    def suggest_preferences_from_resume(self, use_llm: bool = True) -> dict[str, object]:
        suggested: Preferences | None = None
        source = "heuristic"
        if use_llm:
            suggested = self.llm.suggest_preferences(self.profile.raw_resume)
            if suggested is not None:
                source = "llm"
        if suggested is None:
            suggested = self._heuristic_preferences()
        return {"preferences": dump_preferences(suggested), "source": source, "llm": self.get_llm_status()}

    def fetch_all_jobs(self, limit: int | None = None) -> list[dict]:
        limit = limit or self.config.default_limit
        jobs = []
        self.last_fetch_report = {"jobshaman": {"count": 0, "error": None}, "weworkremotely": {"count": 0, "error": None}}
        try:
            jobshaman_jobs = self.jobshaman.fetch_jobs(self.preferences, limit)
            jobs.extend(jobshaman_jobs)
            self.last_fetch_report["jobshaman"]["count"] = len(jobshaman_jobs)
        except Exception as exc:
            self.last_fetch_report["jobshaman"]["error"] = str(exc)
        try:
            wwr_jobs = self.wwr.fetch_jobs(limit)
            jobs.extend(wwr_jobs)
            self.last_fetch_report["weworkremotely"]["count"] = len(wwr_jobs)
        except Exception as exc:
            self.last_fetch_report["weworkremotely"]["error"] = str(exc)
        if jobs:
            self._cache_jobs([job.model_dump(mode="json") for job in jobs])
        return [job.model_dump(mode="json") for job in jobs]

    def fetch_report(self) -> dict:
        return self.last_fetch_report

    def recommend(self, limit: int | None = None, use_llm: bool = True) -> list[JobRecommendation]:
        cached_jobs = self._load_cached_jobs()
        if not cached_jobs:
            self.fetch_all_jobs(limit)
            cached_jobs = self._load_cached_jobs()
        llm = self.llm if use_llm else None
        recommendations = rank_jobs(cached_jobs, self.profile, self.preferences, llm=llm)
        min_score = self.preferences.min_match_score
        return [item for item in recommendations if item.match_score >= min_score]

    def draft(self, job_id: str, use_llm: bool = True) -> ApplicationDraft:
        recommendation = self._find_recommendation(job_id, use_llm=use_llm)
        return build_draft(recommendation, self.profile, self.preferences, llm=self.llm if use_llm else None)

    def apply(self, job_id: str, use_llm: bool = True) -> ApplyResult:
        recommendation = self._find_recommendation(job_id, use_llm=use_llm)
        draft = self.draft(job_id, use_llm=use_llm)
        return apply_to_job(recommendation, draft, self.profile, self.jobshaman)

    def _find_recommendation(self, job_id: str, use_llm: bool) -> JobRecommendation:
        recommendations = self.recommend(use_llm=use_llm)
        for item in recommendations:
            if item.job.id == job_id:
                return item
        raise KeyError(f"Job {job_id} not found among recommendations.")

    def _cache_jobs(self, jobs: list[dict]) -> None:
        self.config.cache_path.write_text(json.dumps(jobs, ensure_ascii=False, indent=2), encoding="utf-8")

    def _load_cached_jobs(self):
        if not self.config.cache_path.exists():
            return []
        payload = json.loads(self.config.cache_path.read_text(encoding="utf-8"))
        from .models import JobPosting

        return [JobPosting.model_validate(item) for item in payload]

    def _heuristic_preferences(self) -> Preferences:
        skills = [skill.lower() for skill in self.profile.skills]
        desired_titles = list(dict.fromkeys(self.profile.desired_titles))
        required_keywords = []
        optional_keywords = []

        for keyword in ["python", "fastapi", "typescript", "react", "sql", "supabase", "llm", "ai", "automation"]:
            if keyword in skills or keyword in self.profile.raw_resume.lower():
                if len(required_keywords) < 4:
                    required_keywords.append(keyword)
                else:
                    optional_keywords.append(keyword)

        if not desired_titles:
            desired_titles = ["Full Stack Developer", "Backend Developer"]

        resume_lower = self.profile.raw_resume.lower()
        language_codes = []
        if any(token in resume_lower for token in ["english", "anglick", "en "]):
            language_codes.append("en")
        if any(token in resume_lower for token in ["czech", "češt", "cesk", "cz "]):
            language_codes.append("cs")
        if not language_codes:
            language_codes = ["en"]

        seniority = []
        if "senior" in resume_lower:
            seniority.append("senior")
        if "lead" in resume_lower or "staff" in resume_lower:
            seniority.append("lead")
        if not seniority:
            seniority.append("mid")

        return Preferences(
            desired_titles=desired_titles[:5],
            required_keywords=required_keywords,
            optional_keywords=optional_keywords[:8],
            excluded_keywords=["php", "onsite only"],
            locations=["remote", "europe"],
            remote_only=True,
            min_salary=self.preferences.min_salary,
            contract_types=["full-time"],
            language_codes=language_codes,
            min_match_score=self.preferences.min_match_score or 65,
            seniority_preferences=seniority,
            notes_for_cover_letter=[
                "Zdůrazni relevantní zkušenosti z CV a konkrétní dopad na produkt.",
                "Drž odpověď stručnou a věcnou.",
            ],
        )
