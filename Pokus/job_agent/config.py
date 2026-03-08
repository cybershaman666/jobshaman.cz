from __future__ import annotations

import os
import shutil
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field


ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
RUNTIME_DIR = Path(os.getenv("JOB_AGENT_RUNTIME_DIR", "/tmp/job-agent"))
LEGACY_RESUME_PATH = str(DATA_DIR / "resume.md")
LEGACY_PREFERENCES_PATH = str(DATA_DIR / "preferences.yaml")
LEGACY_CACHE_PATH = str(DATA_DIR / "jobs_cache.json")

load_dotenv(ROOT_DIR / ".env")


def _seed_runtime_file(target: Path, source: Path) -> Path:
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists() and source.exists():
        shutil.copyfile(source, target)
    return target


def _resolve_runtime_path(env_name: str, runtime_target: Path, legacy_source: Path) -> Path:
    raw = os.getenv(env_name)
    legacy_value = str(legacy_source)
    if not raw or raw == legacy_value:
        return _seed_runtime_file(runtime_target, legacy_source)
    return Path(raw)


class AppConfig(BaseModel):
    ollama_base_url: str = Field(default_factory=lambda: os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434"))
    ollama_model: str = Field(default_factory=lambda: os.getenv("OLLAMA_MODEL", "glm-4.5-flash"))
    ollama_timeout_s: int = Field(default_factory=lambda: int(os.getenv("OLLAMA_TIMEOUT_S", "90")))

    jobshaman_api_base: str = Field(default_factory=lambda: os.getenv("JOBSHAMAN_API_BASE", "https://api.jobshaman.cz"))
    jobshaman_api_fallbacks: list[str] = Field(
        default_factory=lambda: [
            item.strip()
            for item in os.getenv(
                "JOBSHAMAN_API_FALLBACKS",
                "https://site--jobshaman--rb4dlj74d5kc.code.run,https://jobshaman-cz.onrender.com",
            ).split(",")
            if item.strip()
        ]
    )
    jobshaman_search_endpoint: str = Field(
        default_factory=lambda: os.getenv("JOBSHAMAN_SEARCH_ENDPOINT", "/jobs/hybrid-search-v2")
    )
    jobshaman_apply_endpoint: str = Field(
        default_factory=lambda: os.getenv("JOBSHAMAN_APPLY_ENDPOINT", "/jobs/applications")
    )
    jobshaman_access_token: str | None = Field(default_factory=lambda: os.getenv("JOBSHAMAN_ACCESS_TOKEN"))
    jobshaman_csrf_token: str | None = Field(default_factory=lambda: os.getenv("JOBSHAMAN_CSRF_TOKEN"))
    jobshaman_verify_ssl: bool = Field(
        default_factory=lambda: os.getenv("JOBSHAMAN_VERIFY_SSL", "true").lower() != "false"
    )

    wwr_api_url: str = Field(
        default_factory=lambda: os.getenv("WWR_API_URL", "https://weworkremotely.com/categories/remote-programming-jobs.rss")
    )
    user_agent: str = Field(
        default_factory=lambda: os.getenv("JOB_AGENT_USER_AGENT", "misha-local-job-agent/0.1")
    )

    default_limit: int = Field(default_factory=lambda: int(os.getenv("JOB_AGENT_LIMIT", "50")))
    dry_run: bool = Field(default_factory=lambda: os.getenv("JOB_AGENT_DRY_RUN", "true").lower() != "false")

    resume_path: Path = Field(
        default_factory=lambda: _seed_runtime_file(
            _resolve_runtime_path("RESUME_PATH", RUNTIME_DIR / "resume.md", DATA_DIR / "resume.md"),
            DATA_DIR / "resume.md",
        )
    )
    preferences_path: Path = Field(
        default_factory=lambda: _seed_runtime_file(
            _resolve_runtime_path("PREFERENCES_PATH", RUNTIME_DIR / "preferences.yaml", DATA_DIR / "preferences.yaml"),
            DATA_DIR / "preferences.yaml",
        )
    )
    cache_path: Path = Field(
        default_factory=lambda: _seed_runtime_file(
            _resolve_runtime_path("CACHE_PATH", RUNTIME_DIR / "jobs_cache.json", DATA_DIR / "jobs_cache.json"),
            DATA_DIR / "jobs_cache.json",
        )
    )


def get_config() -> AppConfig:
    return AppConfig()
