from __future__ import annotations

from pathlib import Path

import yaml

from .models import CandidateProfile, Preferences


def load_resume(path: Path) -> CandidateProfile:
    raw = path.read_text(encoding="utf-8").strip()
    lines = [line.strip("- ").strip() for line in raw.splitlines() if line.strip()]
    summary = next((line for line in lines if len(line.split()) > 8), raw[:300])
    skills = _extract_items(lines, "skills")
    highlights = _extract_items(lines, "highlights")
    desired_titles = _extract_items(lines, "desired_titles")
    return CandidateProfile(
        raw_resume=raw,
        summary=summary,
        skills=skills,
        highlights=highlights,
        desired_titles=desired_titles,
    )


def load_preferences(path: Path) -> Preferences:
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return Preferences.model_validate(data)


def save_resume(path: Path, content: str) -> CandidateProfile:
    path.write_text(content.strip() + "\n", encoding="utf-8")
    return load_resume(path)


def save_preferences(path: Path, content: str) -> Preferences:
    data = yaml.safe_load(content) or {}
    prefs = Preferences.model_validate(data)
    path.write_text(dump_preferences(prefs), encoding="utf-8")
    return prefs


def dump_preferences(preferences: Preferences) -> str:
    return yaml.safe_dump(preferences.model_dump(mode="python"), allow_unicode=True, sort_keys=False)


def _extract_items(lines: list[str], header_name: str) -> list[str]:
    values: list[str] = []
    active = False
    header_label = header_name.lower().replace("_", " ")
    for line in lines:
        lower = line.lower().rstrip(":")
        if lower == header_label:
            active = True
            continue
        if active and line.endswith(":"):
            break
        if active:
            values.append(line)
    return values
