from __future__ import annotations

import json
from typing import Any

import requests

from .config import AppConfig
from .models import Preferences


class OllamaClient:
    def __init__(self, config: AppConfig):
        self.config = config
        self.last_error: str | None = None

    def status(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "base_url": self.config.ollama_base_url,
            "model": self.config.ollama_model,
            "reachable": False,
            "model_available": False,
            "error": self.last_error,
        }
        try:
            response = requests.get(
                f"{self.config.ollama_base_url}/api/tags",
                timeout=min(10, self.config.ollama_timeout_s),
            )
            response.raise_for_status()
            data = response.json()
            models = data.get("models") or []
            names = {item.get("name") for item in models if item.get("name")}
            payload["reachable"] = True
            payload["model_available"] = self.config.ollama_model in names
            if not payload["model_available"]:
                payload["available_models"] = sorted(names)
            self.last_error = None
            payload["error"] = None
        except Exception as exc:
            self.last_error = str(exc)
            payload["error"] = self.last_error
        return payload

    def generate_json(self, prompt: str) -> dict[str, Any]:
        response = requests.post(
            f"{self.config.ollama_base_url}/api/generate",
            json={
                "model": self.config.ollama_model,
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "options": {"temperature": 0.2},
            },
            timeout=self.config.ollama_timeout_s,
        )
        response.raise_for_status()
        self.last_error = None
        raw = response.json().get("response", "{}")
        return json.loads(raw)

    def maybe_fit_score(self, resume: str, job_text: str) -> tuple[float, list[str]]:
        prompt = (
            "Vyhodnot fit kandidata na pozici. Vrat jen JSON se schema: "
            '{"score": number 0-100, "reasons": ["..."]}. '
            "Ber v potaz prenositelnost zkusenosti, senioritu a realnou sanci na uspesnou odpoved.\n\n"
            f"CV:\n{resume}\n\nInzerat:\n{job_text[:6000]}"
        )
        try:
            payload = self.generate_json(prompt)
            score = float(payload.get("score", 0))
            reasons = [str(item) for item in payload.get("reasons", [])][:5]
            return max(0.0, min(100.0, score)), reasons
        except Exception as exc:
            self.last_error = str(exc)
            return 0.0, []

    def draft_application(self, resume: str, job_text: str, notes: list[str]) -> str:
        prompt = (
            "Napis kratkou, vecnou a presvedcivou odpoved na pracovni inzerat v cestine. "
            "Max 220 slov. Bez vaty, zadne genericke fraze. Zdůrazni konkretni relevantni zkusenosti. "
            "Pokud je vhodne, zmin ochotu dodat vice detailu nebo portfolio.\n\n"
            f"CV:\n{resume}\n\nPoznamky kandidata:\n- " + "\n- ".join(notes or ["Bez dalsich poznamek."]) +
            f"\n\nInzerat:\n{job_text[:7000]}"
        )
        try:
            response = requests.post(
                f"{self.config.ollama_base_url}/api/generate",
                json={
                    "model": self.config.ollama_model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.4},
                },
                timeout=self.config.ollama_timeout_s,
            )
            response.raise_for_status()
            self.last_error = None
            return (response.json().get("response") or "").strip()
        except Exception as exc:
            self.last_error = str(exc)
            return ""

    def suggest_preferences(self, resume: str) -> Preferences | None:
        prompt = (
            "Z tohoto CV odvod realisticke job-search preference. "
            "Vrat jen JSON odpovidajici schema Preferences. "
            "Pouzij strizlivy odhad, neprehanej senioritu ani technologie. "
            "Vypln hlavne desired_titles, required_keywords, optional_keywords, locations, "
            "remote_only, language_codes, seniority_preferences, notes_for_cover_letter, min_match_score. "
            "Pokud neco neni jiste, nech to prazdne nebo null.\n\n"
            f"CV:\n{resume[:12000]}"
        )
        try:
            payload = self.generate_json(prompt)
            return Preferences.model_validate(payload)
        except Exception as exc:
            self.last_error = str(exc)
            return None
