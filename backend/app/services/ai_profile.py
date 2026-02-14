import os
import json
from typing import Any, Dict, List, Optional

import google.generativeai as genai


def _extract_json(text: str) -> Dict[str, Any]:
    if not text:
        raise ValueError("Empty AI response")

    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        # Remove possible language hint
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()

    try:
        return json.loads(cleaned)
    except Exception:
        # Fallback: extract first JSON object
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1:
            raise
        return json.loads(cleaned[start : end + 1])


def generate_profile_from_story(
    steps: List[Dict[str, str]],
    language: str = "cs",
    existing_profile: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-1.5-flash")

    safe_steps = []
    for step in steps or []:
        step_id = (step.get("id") or "").strip()
        text = (step.get("text") or "").strip()
        if not text:
            continue
        safe_steps.append({"id": step_id, "text": text})

    combined = "\n\n".join([f"[{s['id']}] {s['text']}" for s in safe_steps])
    combined = combined[:20000]

    prompt = f"""
You are a senior career strategist. Analyze the user's narrated career story and extract structured profile data.
OUTPUT STRICT JSON (no markdown, no code fences). Use language: {language}.

Return JSON with keys:
- profileUpdates: {{ name, email, phone, jobTitle, skills, workHistory, education, cvText }}
- aiProfile: {{
    story, hobbies, volunteering, leadership, strengths, values, inferred_skills,
    awards, certifications, side_projects, motivations, work_preferences
  }}
- cv_ai_text: Full tailored CV (Markdown allowed)
- cv_summary: Short professional summary (max 300 chars)

Rules:
- Arrays must be arrays of strings.
- workHistory items: {{ role, company, duration, description }}
- education items: {{ school, degree, year }}
- Keep names and titles clean and professional.
- Highlight leadership and hidden strengths from hobbies and activities.

Existing profile context (if provided):
{json.dumps(existing_profile or {}, ensure_ascii=False)}

User story (steps):
{combined}
"""

    response = model.generate_content(prompt)
    data = _extract_json(response.text or "")

    return data
