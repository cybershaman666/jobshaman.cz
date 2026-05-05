import json
import uuid
import asyncio
import hashlib
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlmodel import select

from app.core.database import engine
from app.core.legacy_supabase import fetch_legacy_company_for_user
from app.domains.identity.models import User
from app.domains.reality.models import Company, CompanyUser, Job
from app.services.mistral_client import MistralClientError, call_mistral_json


def _safe_json_loads(value: Optional[str], fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


def _safe_json_value(value: Any, fallback: Any) -> Any:
    if value is None:
        return fallback
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        return _safe_json_loads(value, fallback)
    return fallback


def _clean_text(value: Any, limit: int = 3000) -> str:
    if value is None:
        return ""
    return " ".join(str(value).strip().split())[:limit]


def _slug_key(value: str) -> str:
    return "".join(ch.lower() if ch.isalnum() else "_" for ch in value).strip("_") or "task"


def _string_list(value: Any, limit: int = 20) -> List[str]:
    raw = value if isinstance(value, list) else str(value or "").replace("|", ",").split(",")
    result: List[str] = []
    for item in raw:
        text_value = _clean_text(item, 80)
        if text_value and text_value.lower() not in {existing.lower() for existing in result}:
            result.append(text_value)
    return result[:limit]


def _json_hash(value: Any, prefix: str = "") -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)
    return f"{prefix}{hashlib.sha256(raw.encode('utf-8')).hexdigest()}"


def _normalize_member_profiles(payload: Dict[str, Any]) -> list[dict[str, Any]]:
    members = payload.get("members")
    if isinstance(members, list):
        return [member for member in members if isinstance(member, dict)]
    return []


class RealityDomainService:
    @staticmethod
    async def _company_for_user_in_session(session: AsyncSession, user_id: str) -> Optional[Company]:
        result = await session.execute(
            select(CompanyUser).where(CompanyUser.user_id == uuid.UUID(user_id)).limit(1)
        )
        membership = result.scalar_one_or_none()
        if not membership:
            return None
        company_result = await session.execute(select(Company).where(Company.id == membership.company_id))
        return company_result.scalar_one_or_none()

    @staticmethod
    async def _has_company_access(session: AsyncSession, user_id: str, company_id: uuid.UUID) -> bool:
        result = await session.execute(
            select(CompanyUser).where(
                CompanyUser.user_id == uuid.UUID(user_id),
                CompanyUser.company_id == company_id,
            ).limit(1)
        )
        return result.scalar_one_or_none() is not None

    @staticmethod
    def _default_assessment_tasks(title: str, summary: str, role_family: str = "operations") -> List[Dict[str, Any]]:
        task_title = title or "Praktická výzva"
        problem = summary or f"Popište, jak byste postupovali v první reálné situaci pro {task_title}."
        return [
            {
                "id": "briefing",
                "type": "text_response",
                "phase": "briefing",
                "title": "Porozumění výzvě",
                "prompt": "Shrňte vlastními slovy, co je podle vás hlavní problém a první riziko.",
                "instructions": "Buďte konkrétní. Stačí krátká odpověď, která ukáže úsudek.",
                "timebox_minutes": 8,
                "required": True,
                "rubric": [
                    {"id": "clarity", "label": "Jasnost porozumění", "weight": 35},
                    {"id": "context", "label": "Práce s kontextem", "weight": 30},
                    {"id": "risk", "label": "První riziko", "weight": 35},
                ],
            },
            {
                "id": "task",
                "type": "workspace",
                "phase": "task",
                "title": task_title,
                "prompt": problem,
                "instructions": "Navrhněte první praktický postup, trade-off a způsob ověření.",
                "timebox_minutes": 45,
                "required": True,
                "rubric": [
                    {"id": "decision_quality", "label": "Kvalita rozhodnutí", "weight": 35},
                    {"id": "execution", "label": "Proveditelnost", "weight": 35},
                    {"id": "reflection", "label": "Reflexe trade-offů", "weight": 30},
                ],
                "workspace": {
                    "language": "plain_text",
                    "starter": "1. První krok:\n2. Proč tento postup:\n3. Co bych ověřil/a:\n4. Riziko nebo trade-off:",
                },
            },
            {
                "id": "external_link",
                "type": "external_link",
                "phase": "task",
                "title": "Externí podklad nebo výstup",
                "prompt": "Pokud pracujete v Notion, Canva, Figmě, Google Docs nebo jiném nástroji, vložte odkaz na výstup.",
                "instructions": "Odkaz musí být přístupný pro review. Bez OAuth, pouze bezpečný link/embed kontrakt.",
                "timebox_minutes": 5,
                "required": False,
                "providers": ["notion", "canva", "figma", "google_docs", "miro", "other"],
                "expected_submission": "URL + krátký komentář, co má reviewer otevřít.",
                "evidence_required": True,
            },
            {
                "id": "schedule",
                "type": "scheduler",
                "phase": "dialogue",
                "title": "Navázání dialogu",
                "prompt": "Vyberte preferovaný čas pro další lidský krok.",
                "instructions": "Termín je žádost, firma jej potvrdí po review.",
                "timebox_minutes": 2,
                "required": False,
            },
        ]

    @staticmethod
    def _default_blueprint(title: str, tasks: List[Dict[str, Any]], role_family: str = "operations") -> Dict[str, Any]:
        steps = [
            {"id": "identity", "type": "identity", "title": "Identity", "prompt": "Kdo jste a proč vás výzva zajímá?", "required": True},
            {"id": "motivation", "type": "motivation", "title": "Motivation", "prompt": "Co vás na této výzvě táhne právě teď?", "required": True},
            *[
                {
                    "id": task.get("id"),
                    "type": task.get("type"),
                    "title": task.get("title"),
                    "prompt": task.get("prompt"),
                    "required": bool(task.get("required")),
                    "phase": task.get("phase"),
                }
                for task in tasks
            ],
            {"id": "review", "type": "results_summary", "title": "Review", "prompt": "Souhrn signálu pro firmu.", "required": True},
        ]
        return {
            "schema_version": "handshake-blueprint-v1",
            "name": f"{title} - assessment",
            "role_family": role_family,
            "phases": ["briefing", "identity", "motivation", "task", "review", "dialogue"],
            "steps": steps,
            "review_policy": {
                "minimum_score": 65,
                "human_confirmation_required": True,
                "jcfpm_required_if_missing": True,
            },
        }

    @staticmethod
    def _challenge_ai_prompt(payload: Dict[str, Any], company: Optional[Company] = None, job: Optional[Job] = None) -> str:
        context = {
            "company": {
                "name": company.name if company else None,
                "industry": getattr(company, "industry", None) if company else None,
            },
            "draft": {
                "title": payload.get("title") or (job.title if job else ""),
                "summary": payload.get("summary") or payload.get("problem_statement") or (job.summary if job else ""),
                "candidate_task": payload.get("first_reply_prompt") or payload.get("candidate_task") or payload.get("task_brief"),
                "role_family": payload.get("role_family") or _safe_json_value(job.editor_state, {}).get("role_family") if job else payload.get("role_family"),
                "work_model": payload.get("work_model") or (job.work_model if job else ""),
                "location": payload.get("location") or (job.location if job else ""),
                "skills": payload.get("skills") or payload.get("skills_required") or _safe_json_value(job.skills_required, []) if job else payload.get("skills"),
            },
        }
        return (
            "Jsi senior HR assessment designer pro Jobshaman V2. Pomoz recruiterovi definovat kvalitni vyzvu "
            "a assessment flow. Vrat VZDY pouze validni JSON bez markdownu. Jazyk: cestina.\n\n"
            "JSON schema:\n"
            "{\n"
            '  "title": "kratky nazev vyzvy",\n'
            '  "problem_statement": "proc je vyzva dulezita a jaky dopad ma mit",\n'
            '  "candidate_task": "co ma kandidat dodat nebo dokazat",\n'
            '  "skills": ["dovednost"],\n'
            '  "assessment_tasks": [{"id":"task","type":"workspace|text_response|external_link","phase":"task","title":"","prompt":"","instructions":"","timebox_minutes":45,"required":true,"rubric":[{"id":"","label":"","weight":30}]}],\n'
            '  "suggested_tools": ["notion","canva","figma","google_docs","miro"],\n'
            '  "review_questions": ["otazka pro hodnotitele"],\n'
            '  "quality_score": 0-100,\n'
            '  "quality_checks": [{"id":"","label":"","status":"pass|warning","advice":""}],\n'
            '  "jcfpm_policy": {"include_in_results": true, "required_if_missing": true, "reuse_existing": true}\n'
            "}\n\n"
            "Pravidla: AI nesmi publikovat automaticky; vystup je draft pro lidske potvrzeni. "
            "Assessment musi zahrnout prakticky ukol, volitelny external_link kontrakt a vysledky musi vyuzit JCFPM. "
            "Pokud kandidat JCFPM ma, pouzije se existujici. Pokud nema, bude soucasti handshake.\n\n"
            f"Vstup:\n{json.dumps(context, ensure_ascii=False)}"
        )

    @staticmethod
    def _normalize_ai_output(raw: Dict[str, Any], title: str, summary: str, role_family: str) -> Dict[str, Any]:
        output_title = _clean_text(raw.get("title"), 180) or title or "Nová výzva"
        problem = _clean_text(raw.get("problem_statement") or raw.get("summary"), 1800) or summary
        candidate_task = _clean_text(raw.get("candidate_task") or raw.get("task_brief"), 1800) or problem
        tasks = _safe_list(raw.get("assessment_tasks"))
        if not tasks:
            tasks = RealityDomainService._default_assessment_tasks(output_title, candidate_task, role_family)
        has_external = any(str(task.get("type")) == "external_link" for task in tasks if isinstance(task, dict))
        if not has_external:
            tasks.append(RealityDomainService._default_assessment_tasks(output_title, candidate_task, role_family)[2])
        blueprint = RealityDomainService._default_blueprint(output_title, tasks, role_family)
        blueprint["jcfpm_policy"] = {"include_in_results": True, "required_if_missing": True, "reuse_existing": True}
        return {
            "schema_version": "challenge-ai-assist-v1",
            "title": output_title,
            "problem_statement": problem,
            "task_brief": candidate_task,
            "assessment_tasks": tasks,
            "handshake_blueprint_v1": blueprint,
            "suggested_tools": _string_list(raw.get("suggested_tools") or ["notion", "canva", "figma", "google_docs", "miro"], 8),
            "review_questions": _string_list(raw.get("review_questions"), 8) or [
                "Jak konkrétní byl první krok?",
                "Pojmenoval kandidát trade-off?",
                "Umí výstup ověřit v realitě?",
            ],
            "quality_score": int(max(0, min(100, raw.get("quality_score") or 72))),
            "quality_checks": _safe_list(raw.get("quality_checks"))[:8],
            "jcfpm_policy": {"include_in_results": True, "required_if_missing": True, "reuse_existing": True},
            "human_confirmation_required": True,
            "generated_at": datetime.utcnow().isoformat(),
            "provider": "mistral",
        }

    @staticmethod
    def _serialize_opportunity(job: Job, company: Optional[Company] = None) -> Dict[str, Any]:
        skills = _safe_json_value(job.skills_required, [])
        assessment_tasks = _safe_json_value(job.assessment_tasks, [])
        handshake_blueprint = _safe_json_value(job.handshake_blueprint_v1, {})
        capacity_policy = _safe_json_value(job.capacity_policy, {})
        editor_state = _safe_json_value(job.editor_state, {})
        company_name = company.name if company else "Jobshaman company"
        return {
            "id": str(job.id),
            "legacy_job_id": str(job.id),
            "company_id": str(job.company_id),
            "company_name": company_name,
            "company": company_name,
            "title": job.title,
            "summary": job.summary or "",
            "description": job.description or job.summary or "",
            "role_summary": job.summary,
            "benefits": [],
            "tags": skills if isinstance(skills, list) else [],
            "skills_required": skills if isinstance(skills, list) else [],
            "salary_from": job.salary_from,
            "salary_to": job.salary_to,
            "currency": job.currency,
            "salary_currency": job.currency,
            "work_model": job.work_model,
            "work_type": job.work_model,
            "location": job.location,
            "source": "jobshaman_native",
            "source_kind": job.source_kind or "native_challenge",
            "status": job.status,
            "is_active": job.is_active,
            "challenge_format": job.challenge_format,
            "assessment_tasks": assessment_tasks,
            "handshake_blueprint_v1": handshake_blueprint,
            "capacity_policy": capacity_policy,
            "editor_state": editor_state,
            "payload_json": {
                "listing_kind": "challenge",
                "assessment_tasks": assessment_tasks,
                "handshake_blueprint_v1": handshake_blueprint,
                "capacity_policy": capacity_policy,
                "company_goal": editor_state.get("company_goal"),
                "first_reply_prompt": editor_state.get("first_reply_prompt"),
            },
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "updated_at": job.updated_at.isoformat() if job.updated_at else None,
            "published_at": job.published_at.isoformat() if job.published_at else None,
        }

    @staticmethod
    async def list_active_jobs(limit: int = 200) -> List[Dict[str, Any]]:
        clamped_limit = max(1, min(int(limit or 200), 1500))
        async with AsyncSession(engine) as session:
            native_result = await session.execute(
                select(Job, Company)
                .join(Company, Company.id == Job.company_id)
                .where(Job.is_active == True, Job.status == "published")
                .order_by(Job.published_at.desc().nullslast(), Job.updated_at.desc())
                .limit(clamped_limit)
            )
            native_items = [
                RealityDomainService._serialize_opportunity(job, company)
                for job, company in native_result.all()
            ]
            statement = text(
                """
                SELECT
                  id,
                  company_id,
                  title,
                  company,
                  location,
                  description,
                  role_summary,
                  benefits,
                  tags,
                  contract_type,
                  salary_from,
                  salary_to,
                  salary_timeframe,
                  currency,
                  salary_currency,
                  work_type,
                  work_model,
                  source,
                  source_kind,
                  url,
                  education_level,
                  lat,
                  lng,
                  country_code,
                  language_code,
                  legality_status,
                  verification_notes,
                  ai_analysis,
                  status,
                  is_active,
                  challenge_format,
                  payload_json,
                  created_at,
                  scraped_at,
                  updated_at
                FROM jobs_nf
                WHERE COALESCE(is_active, true) = true
                  AND COALESCE(status, 'active') NOT IN ('archived', 'deleted', 'inactive')
                ORDER BY COALESCE(scraped_at, updated_at, created_at) DESC NULLS LAST
                LIMIT :limit
                """
            )
            result = await session.execute(statement, {"limit": clamped_limit})
            rows = result.fetchall()
            
            seen_content = set()
            items = []
            for row in rows:
                item = RealityDomainService._serialize_jobs_nf_row(row._mapping)
                content_key = f"{str(item.get('title')).lower()}|{str(item.get('company_name')).lower()}|{str(item.get('location')).lower()}"
                if content_key in seen_content:
                    continue
                seen_content.add(content_key)
                items.append(item)
            return [*native_items, *items][:clamped_limit]

    @staticmethod
    async def list_active_jobs_page(
        limit: int = 500,
        offset: int = 0,
        country: Optional[str] = None,
        query: Optional[str] = None,
        city: Optional[str] = None,
        min_salary: Optional[int] = None,
        benefits: Optional[List[str]] = None,
        work_arrangement: Optional[str] = None,
    ) -> Dict[str, Any]:
        clamped_limit = max(1, min(int(limit or 500), 1000))
        clamped_offset = max(0, int(offset or 0))
        country_filter = str(country or "").strip().lower()
        query_filter = _clean_text(query, 200).lower()
        city_filter = _clean_text(city, 120).lower()
        benefit_filters = [_clean_text(item, 80).lower() for item in (benefits or []) if _clean_text(item, 80)]
        min_salary_filter = int(min_salary or 0)
        work_filter = str(work_arrangement or "").strip().lower()
        country_condition = ""
        params: Dict[str, Any] = {"limit": clamped_limit, "offset": clamped_offset}
        if country_filter:
            country_condition = """
              AND (
                LOWER(COALESCE(country_code, payload_json->>'country_code', payload_json->>'country', '')) = :country
                OR (:country = 'cz' AND LOWER(COALESCE(country_code, payload_json->>'country_code', payload_json->>'country', '')) IN ('czechia', 'czech republic', ''))
              )
            """
            params["country"] = country_filter
        extra_conditions: List[str] = []
        if query_filter:
            extra_conditions.append(
                """
                AND (
                  LOWER(COALESCE(title, '')) LIKE :query_like
                  OR LOWER(COALESCE(company, '')) LIKE :query_like
                  OR LOWER(COALESCE(location, '')) LIKE :query_like
                  OR LOWER(COALESCE(role_summary, '')) LIKE :query_like
                  OR LOWER(COALESCE(description, '')) LIKE :query_like
                  OR LOWER(COALESCE(tags::text, '')) LIKE :query_like
                )
                """
            )
            params["query_like"] = f"%{query_filter}%"
        if city_filter:
            extra_conditions.append("AND LOWER(COALESCE(location, payload_json->>'location', '')) LIKE :city_like")
            params["city_like"] = f"%{city_filter}%"
        if min_salary_filter > 0:
            extra_conditions.append("AND COALESCE(salary_to, salary_from, 0) >= :min_salary")
            params["min_salary"] = min_salary_filter
        if benefit_filters:
            for index, benefit in enumerate(benefit_filters[:12]):
                key = f"benefit_{index}"
                extra_conditions.append(f"AND LOWER(COALESCE(benefits::text, '') || ' ' || COALESCE(ai_analysis::text, '')) LIKE :{key}")
                params[key] = f"%{benefit}%"
        if work_filter in {"remote", "hybrid", "onsite"}:
            if work_filter == "onsite":
                extra_conditions.append(
                    """
                    AND LOWER(COALESCE(work_model, work_type, contract_type, location, description, '')) NOT LIKE '%remote%'
                    AND LOWER(COALESCE(work_model, work_type, contract_type, location, description, '')) NOT LIKE '%hybrid%'
                    """
                )
            else:
                extra_conditions.append("AND LOWER(COALESCE(work_model, work_type, contract_type, location, description, '')) LIKE :work_like")
                params["work_like"] = f"%{work_filter}%"
        extra_condition_sql = "\n".join(extra_conditions)

        columns = """
          id,
          company_id,
          title,
          company,
          location,
          description,
          role_summary,
          benefits,
          tags,
          contract_type,
          salary_from,
          salary_to,
          salary_timeframe,
          currency,
          salary_currency,
          work_type,
          work_model,
          source,
          source_kind,
          url,
          education_level,
          lat,
          lng,
          country_code,
          language_code,
          legality_status,
          verification_notes,
          ai_analysis,
          status,
          is_active,
          challenge_format,
          payload_json,
          created_at,
          scraped_at,
          updated_at
        """
        base_where = f"""
          WHERE COALESCE(is_active, true) = true
            AND COALESCE(status, 'active') NOT IN ('archived', 'deleted', 'inactive')
            {country_condition}
            {extra_condition_sql}
        """

        async with AsyncSession(engine) as session:
            native_items: List[Dict[str, Any]] = []
            if clamped_offset == 0:
                native_result = await session.execute(
                    select(Job, Company)
                    .join(Company, Company.id == Job.company_id)
                    .where(Job.is_active == True, Job.status == "published")
                    .order_by(Job.published_at.desc().nullslast(), Job.updated_at.desc())
                    .limit(clamped_limit)
                )
                native_items = [
                    RealityDomainService._serialize_opportunity(job, company)
                    for job, company in native_result.all()
                ]

            count_statement = text(f"SELECT COUNT(*) FROM jobs_nf {base_where}")
            count_result = await session.execute(count_statement, params)
            total_count = int(count_result.scalar_one() or 0)

            statement = text(
                f"""
                SELECT {columns}
                FROM jobs_nf
                {base_where}
                ORDER BY COALESCE(scraped_at, updated_at, created_at) DESC NULLS LAST
                LIMIT :limit OFFSET :offset
                """
            )
            result = await session.execute(statement, params)
            rows = result.fetchall()
            
            seen_content = set()
            items = []
            for row in rows:
                item = RealityDomainService._serialize_jobs_nf_row(row._mapping)
                content_key = f"{str(item.get('title')).lower()}|{str(item.get('company_name')).lower()}|{str(item.get('location')).lower()}"
                if content_key in seen_content:
                    continue
                seen_content.add(content_key)
                items.append(item)
            
            merged_items = [*native_items, *items]
            return {
                "items": merged_items[:clamped_limit],
                "total_count": total_count + len(native_items),
                "limit": clamped_limit,
                "offset": clamped_offset,
                "has_more": clamped_offset + len(items) < total_count,
            }

    @staticmethod
    async def list_recommendation_candidate_jobs(domestic_country: str = "CZ", domestic_limit: int = 350, foreign_limit: int = 450) -> List[Dict[str, Any]]:
        country = str(domestic_country or "CZ").lower()
        domestic_limit = max(1, min(int(domestic_limit or 350), 1200))
        foreign_limit = max(1, min(int(foreign_limit or 450), 1000))
        columns = """
          id,
          company_id,
          title,
          company,
          location,
          description,
          role_summary,
          benefits,
          tags,
          contract_type,
          salary_from,
          salary_to,
          salary_timeframe,
          currency,
          salary_currency,
          work_type,
          work_model,
          source,
          source_kind,
          url,
          education_level,
          lat,
          lng,
          country_code,
          language_code,
          legality_status,
          verification_notes,
          ai_analysis,
          status,
          is_active,
          challenge_format,
          payload_json,
          created_at,
          scraped_at,
          updated_at
        """
        async with AsyncSession(engine) as session:
            domestic_statement = text(
                f"""
                SELECT {columns}
                FROM jobs_nf
                WHERE COALESCE(is_active, true) = true
                  AND COALESCE(status, 'active') NOT IN ('archived', 'deleted', 'inactive')
                  AND (
                    LOWER(COALESCE(country_code, payload_json->>'country_code', payload_json->>'country', '')) = :domestic_country
                    OR (:domestic_country = 'cz' AND LOWER(COALESCE(country_code, payload_json->>'country_code', payload_json->>'country', '')) IN ('czechia', 'czech republic', ''))
                  )
                LIMIT :domestic_limit
                """
            )
            recent_statement = text(
                f"""
                SELECT {columns}
                FROM jobs_nf
                WHERE COALESCE(is_active, true) = true
                  AND COALESCE(status, 'active') NOT IN ('archived', 'deleted', 'inactive')
                ORDER BY COALESCE(scraped_at, updated_at, created_at) DESC NULLS LAST
                LIMIT :foreign_limit
                """
            )
            domestic_result = await session.execute(
                domestic_statement,
                {
                    "domestic_country": country,
                    "domestic_limit": domestic_limit,
                },
            )
            recent_result = await session.execute(recent_statement, {"foreign_limit": foreign_limit})
            rows = [*domestic_result.fetchall(), *recent_result.fetchall()]
            seen = set()
            serialized = []
            for row in rows:
                item = RealityDomainService._serialize_jobs_nf_row(row._mapping)
                item_id = str(item.get("id"))
                if item_id in seen:
                    continue
                seen.add(item_id)
                serialized.append(item)
            return serialized

    @staticmethod
    async def get_job_details(job_id: str) -> Optional[Dict[str, Any]]:
        async with AsyncSession(engine) as session:
            try:
                native_result = await session.execute(
                    select(Job, Company)
                    .join(Company, Company.id == Job.company_id)
                    .where(Job.id == uuid.UUID(str(job_id)))
                    .limit(1)
                )
                native_row = native_result.first()
                if native_row:
                    job, company = native_row
                    return RealityDomainService._serialize_opportunity(job, company)
            except (ValueError, TypeError):
                pass

            statement = text(
                """
                SELECT
                  id,
                  company_id,
                  title,
                  company,
                  location,
                  description,
                  role_summary,
                  benefits,
                  tags,
                  contract_type,
                  salary_from,
                  salary_to,
                  salary_timeframe,
                  currency,
                  salary_currency,
                  work_type,
                  work_model,
                  source,
                  source_kind,
                  url,
                  education_level,
                  lat,
                  lng,
                  country_code,
                  language_code,
                  legality_status,
                  verification_notes,
                  ai_analysis,
                  status,
                  is_active,
                  challenge_format,
                  payload_json,
                  created_at,
                  scraped_at,
                  updated_at
                FROM jobs_nf
                WHERE id = :job_id
                LIMIT 1
                """
            )
            result = await session.execute(statement, {"job_id": job_id})
            row = result.fetchone()
            return RealityDomainService._serialize_jobs_nf_row(row._mapping) if row else None

    @staticmethod
    def _serialize_jobs_nf_row(row: Dict[str, Any]) -> Dict[str, Any]:
        benefits = row.get("benefits") if isinstance(row.get("benefits"), list) else []
        tags = row.get("tags") if isinstance(row.get("tags"), list) else []
        ai_analysis = row.get("ai_analysis") if isinstance(row.get("ai_analysis"), dict) else {}
        payload = row.get("payload_json") if isinstance(row.get("payload_json"), dict) else {}
        return {
            "id": row.get("id"),
            "legacy_job_id": row.get("id"),
            "company_id": row.get("company_id"),
            "company_name": row.get("company") or payload.get("company") or "Neznámá firma",
            "title": row.get("title") or "Untitled role",
            "summary": row.get("role_summary") or ai_analysis.get("summary") or "",
            "description": row.get("description") or row.get("role_summary") or "",
            "role_summary": row.get("role_summary"),
            "benefits": benefits,
            "tags": tags,
            "contract_type": row.get("contract_type"),
            "salary_from": row.get("salary_from"),
            "salary_to": row.get("salary_to"),
            "salary_timeframe": row.get("salary_timeframe"),
            "currency": row.get("salary_currency") or row.get("currency"),
            "work_type": row.get("work_type"),
            "work_model": row.get("work_model") or row.get("work_type"),
            "source": row.get("source"),
            "source_kind": row.get("source_kind") or "jobs_nf",
            "url": row.get("url"),
            "education_level": row.get("education_level"),
            "lat": row.get("lat"),
            "lng": row.get("lng"),
            "country_code": row.get("country_code"),
            "language_code": row.get("language_code"),
            "legality_status": row.get("legality_status"),
            "verification_notes": row.get("verification_notes"),
            "ai_analysis": ai_analysis,
            "status": row.get("status"),
            "is_active": row.get("is_active"),
            "challenge_format": row.get("challenge_format"),
            "payload_json": payload,
            "created_at": row.get("created_at").isoformat() if row.get("created_at") else None,
            "scraped_at": row.get("scraped_at").isoformat() if row.get("scraped_at") else None,
            "updated_at": row.get("updated_at").isoformat() if row.get("updated_at") else None,
        }

    @staticmethod
    async def create_company(name: str, domain: str = None) -> str:
        async with AsyncSession(engine) as session:
            company = Company(name=name, domain=domain)
            session.add(company)
            await session.commit()
            await session.refresh(company)
            return str(company.id)

    @staticmethod
    def _serialize_company(company: Company) -> Dict[str, Any]:
        profile_data = _safe_json_loads(company.profile_data, {})
        values = _safe_json_loads(company.values_json, [])
        gallery_urls = profile_data.get("gallery_urls") or []
        marketplace_media = profile_data.get("marketplace_media") or {}
        if company.hero_image and not marketplace_media.get("cover_url"):
            marketplace_media["cover_url"] = company.hero_image
        members = profile_data.get("members") or []
        handshake_materials = profile_data.get("handshake_materials") or profile_data.get("brand_assets", {}).get("handshake_materials") or []
        brand_assets = profile_data.get("brand_assets") or {}
        return {
            "id": str(company.id),
            "name": company.name,
            "industry": company.industry or company.domain or "",
            "tone": company.tone or "",
            "values": values if isinstance(values, list) else [],
            "philosophy": company.philosophy or "",
            "gallery_urls": gallery_urls if isinstance(gallery_urls, list) else [],
            "marketplace_media": marketplace_media if isinstance(marketplace_media, dict) else {},
            "address": company.address,
            "legal_address": company.legal_address,
            "website": company.website_url,
            "description": company.narrative,
            "logo_url": company.logo_url,
            "members": members if isinstance(members, list) else [],
            "team_member_profiles": profile_data.get("team_member_profiles"),
            "brand_assets": brand_assets if isinstance(brand_assets, dict) else {},
            "handshake_materials": handshake_materials if isinstance(handshake_materials, list) else [],
        }

    @staticmethod
    def _legacy_company_payload(legacy: Dict[str, Any]) -> Dict[str, Any]:
        members = legacy.get("members") if isinstance(legacy.get("members"), list) else []
        brand_assets = legacy.get("brand_assets") if isinstance(legacy.get("brand_assets"), dict) else {}
        gallery_urls = legacy.get("gallery_urls") if isinstance(legacy.get("gallery_urls"), list) else []
        marketplace_media = legacy.get("marketplace_media") if isinstance(legacy.get("marketplace_media"), dict) else {}
        return {
            "name": legacy.get("name") or legacy.get("company_name") or "Firma",
            "domain": legacy.get("domain"),
            "industry": legacy.get("industry") or legacy.get("sector") or "",
            "tone": legacy.get("tone") or "",
            "values": legacy.get("values") if isinstance(legacy.get("values"), list) else [],
            "philosophy": legacy.get("philosophy") or "",
            "address": legacy.get("address"),
            "legal_address": legacy.get("legal_address"),
            "description": legacy.get("description") or legacy.get("narrative") or "",
            "logo_url": legacy.get("logo_url") or legacy.get("logo"),
            "hero_image": legacy.get("hero_image") or legacy.get("cover_url"),
            "website": legacy.get("website") or legacy.get("website_url"),
            "gallery_urls": gallery_urls,
            "members": members,
            "brand_assets": brand_assets,
            "handshake_materials": legacy.get("handshake_materials") if isinstance(legacy.get("handshake_materials"), list) else [],
            "marketplace_media": marketplace_media,
            "team_member_profiles": legacy.get("team_member_profiles"),
            "legacy_supabase": {
                "company_id": str(legacy.get("id")) if legacy.get("id") else None,
                "owner_id": str(legacy.get("owner_id")) if legacy.get("owner_id") else None,
                "created_by": str(legacy.get("created_by")) if legacy.get("created_by") else None,
                "backfilled_at": datetime.utcnow().isoformat(),
            },
        }

    @staticmethod
    def _apply_company_payload(company: Company, payload: Dict[str, Any]) -> None:
        profile_data = _safe_json_loads(company.profile_data, {})

        for attr, keys in {
            "name": ["name"],
            "domain": ["domain"],
            "industry": ["industry"],
            "tone": ["tone"],
            "philosophy": ["philosophy"],
            "address": ["address"],
            "legal_address": ["legal_address", "legalAddress"],
            "logo_url": ["logo_url", "logoUrl"],
            "hero_image": ["hero_image", "heroImage"],
            "narrative": ["description", "narrative"],
            "website_url": ["website", "website_url"],
        }.items():
            for key in keys:
                if key in payload:
                    setattr(company, attr, payload.get(key))
                    break

        if "marketplace_media" in payload and isinstance(payload.get("marketplace_media"), dict):
            profile_data["marketplace_media"] = payload.get("marketplace_media")
            cover_url = payload["marketplace_media"].get("cover_url")
            if cover_url:
                company.hero_image = cover_url
        elif company.hero_image:
            marketplace_media = profile_data.get("marketplace_media") if isinstance(profile_data.get("marketplace_media"), dict) else {}
            marketplace_media["cover_url"] = company.hero_image
            profile_data["marketplace_media"] = marketplace_media

        if "gallery_urls" in payload and isinstance(payload.get("gallery_urls"), list):
            profile_data["gallery_urls"] = payload.get("gallery_urls")

        if "members" in payload:
            profile_data["members"] = _normalize_member_profiles(payload)

        if "team_member_profiles" in payload:
            profile_data["team_member_profiles"] = payload.get("team_member_profiles")

        if "brand_assets" in payload and isinstance(payload.get("brand_assets"), dict):
            profile_data["brand_assets"] = payload.get("brand_assets")

        if "handshake_materials" in payload and isinstance(payload.get("handshake_materials"), list):
            profile_data["handshake_materials"] = payload.get("handshake_materials")

        if "legacy_supabase" in payload and isinstance(payload.get("legacy_supabase"), dict):
            profile_data["legacy_supabase"] = payload.get("legacy_supabase")

        if "values" in payload:
            values = payload.get("values")
            company.values_json = json.dumps(values if isinstance(values, list) else [], ensure_ascii=False)

        company.profile_data = json.dumps(profile_data, ensure_ascii=False)

    @staticmethod
    async def get_company_for_user(user_id: str) -> Optional[Dict[str, Any]]:
        async with AsyncSession(engine) as session:
            user_uuid = uuid.UUID(user_id)
            statement = select(CompanyUser).where(CompanyUser.user_id == user_uuid).limit(1)
            membership_result = await session.execute(statement)
            membership = membership_result.scalar_one_or_none()
            if membership:
                company_result = await session.execute(select(Company).where(Company.id == membership.company_id))
                company = company_result.scalar_one_or_none()
                return RealityDomainService._serialize_company(company) if company else None

            user = await session.get(User, user_uuid)
            if not user or not user.supabase_id:
                return None

            legacy = await asyncio.to_thread(fetch_legacy_company_for_user, str(user.supabase_id), user.email)
            if not legacy:
                return None

            legacy_company_id = str(legacy.get("id")) if legacy.get("id") else ""
            company = None
            if legacy_company_id:
                existing_statement = text(
                    """
                    SELECT *
                    FROM companies
                    WHERE profile_data::jsonb -> 'legacy_supabase' ->> 'company_id' = :legacy_company_id
                    LIMIT 1
                    """
                )
                existing_result = await session.execute(existing_statement, {"legacy_company_id": legacy_company_id})
                existing_row = existing_result.mappings().first()
                if existing_row:
                    company = await session.get(Company, existing_row["id"])

            if not company:
                company = Company(name=legacy.get("name") or legacy.get("company_name") or "Firma")
                RealityDomainService._apply_company_payload(company, RealityDomainService._legacy_company_payload(legacy))
                session.add(company)
                try:
                    await session.flush()
                except IntegrityError:
                    await session.rollback()
                    company = None
                    if legacy.get("domain"):
                        retry_result = await session.execute(select(Company).where(Company.domain == legacy.get("domain")).limit(1))
                        company = retry_result.scalar_one_or_none()
                    if not company:
                        raise

            session.add(CompanyUser(user_id=user_uuid, company_id=company.id, role="owner"))
            if user.role != "recruiter":
                user.role = "recruiter"
            await session.commit()
            await session.refresh(company)
            return RealityDomainService._serialize_company(company) if company else None

    @staticmethod
    async def create_company_for_user(user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        async with AsyncSession(engine) as session:
            company = Company(name=payload.get("name") or "New company")
            RealityDomainService._apply_company_payload(company, payload)
            session.add(company)
            await session.flush()
            membership = CompanyUser(user_id=uuid.UUID(user_id), company_id=company.id, role="owner")
            session.add(membership)
            await session.commit()
            await session.refresh(company)
            return RealityDomainService._serialize_company(company)

    @staticmethod
    async def update_company_for_user(user_id: str, company_id: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        async with AsyncSession(engine) as session:
            membership_statement = select(CompanyUser).where(
                CompanyUser.user_id == uuid.UUID(user_id),
                CompanyUser.company_id == uuid.UUID(company_id),
            )
            membership_result = await session.execute(membership_statement)
            if not membership_result.scalar_one_or_none():
                return None

            company_result = await session.execute(select(Company).where(Company.id == uuid.UUID(company_id)))
            company = company_result.scalar_one_or_none()
            if not company:
                return None

            RealityDomainService._apply_company_payload(company, payload)
            await session.commit()
            await session.refresh(company)
            return RealityDomainService._serialize_company(company)

    @staticmethod
    async def list_company_challenges(user_id: str) -> List[Dict[str, Any]]:
        async with AsyncSession(engine) as session:
            company = await RealityDomainService._company_for_user_in_session(session, user_id)
            if not company:
                return []
            result = await session.execute(
                select(Job)
                .where(Job.company_id == company.id, Job.source_kind == "native_challenge")
                .order_by(Job.updated_at.desc())
            )
            return [RealityDomainService._serialize_opportunity(job, company) for job in result.scalars().all()]

    @staticmethod
    async def create_company_challenge(user_id: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        async with AsyncSession(engine) as session:
            company = await RealityDomainService._company_for_user_in_session(session, user_id)
            if not company:
                return None
            title = _clean_text(payload.get("title"), 180) or "Nová výzva"
            summary = _clean_text(payload.get("summary") or payload.get("role_summary"), 1200)
            role_family = _clean_text(payload.get("role_family") or payload.get("roleFamily") or "operations", 80)
            skills = _string_list(payload.get("skills") or payload.get("skills_required"))
            tasks = _safe_json_value(payload.get("assessment_tasks"), [])
            if not tasks:
                tasks = RealityDomainService._default_assessment_tasks(title, summary, role_family)
            blueprint = _safe_json_value(payload.get("handshake_blueprint_v1"), {})
            if not blueprint:
                blueprint = RealityDomainService._default_blueprint(title, tasks, role_family)
            capacity = _safe_json_value(payload.get("capacity_policy"), {})
            if not capacity:
                capacity = {"candidate_slots_required": 1, "company_slots_total": 25, "max_active_handshakes": 25}
            editor_state = _safe_json_value(payload.get("editor_state"), {})
            editor_state.update({
                "company_goal": _clean_text(payload.get("company_goal") or summary, 1200),
                "first_reply_prompt": _clean_text(payload.get("first_reply_prompt") or payload.get("firstStep") or "", 1200),
                "role_family": role_family,
                "ai_confirmed": bool(editor_state.get("ai_confirmed", False)),
            })
            job = Job(
                company_id=company.id,
                title=title,
                summary=summary,
                description=_clean_text(payload.get("description") or summary, 5000),
                salary_from=payload.get("salary_from"),
                salary_to=payload.get("salary_to"),
                currency=_clean_text(payload.get("currency") or payload.get("salary_currency") or "CZK", 12) or "CZK",
                work_model=_clean_text(payload.get("work_model") or "Hybrid", 40) or "Hybrid",
                location=_clean_text(payload.get("location") or payload.get("location_public") or company.address or "", 240),
                skills_required=json.dumps(skills, ensure_ascii=False),
                is_active=False,
                status="draft",
                source_kind="native_challenge",
                challenge_format=_clean_text(payload.get("challenge_format") or "standard", 40) or "standard",
                assessment_tasks=tasks,
                handshake_blueprint_v1=blueprint,
                capacity_policy=capacity,
                editor_state=editor_state,
                created_by=uuid.UUID(user_id),
                updated_by=uuid.UUID(user_id),
            )
            session.add(job)
            await session.commit()
            await session.refresh(job)
            return RealityDomainService._serialize_opportunity(job, company)

    @staticmethod
    async def update_company_challenge(user_id: str, challenge_id: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        async with AsyncSession(engine) as session:
            result = await session.execute(select(Job).where(Job.id == uuid.UUID(challenge_id)))
            job = result.scalar_one_or_none()
            if not job or not await RealityDomainService._has_company_access(session, user_id, job.company_id):
                return None
            company = await session.get(Company, job.company_id)
            if job.status == "published" and payload.get("status") != "archived":
                raise ValueError("Published challenges can only be archived or edited via a new draft.")
            if "title" in payload:
                job.title = _clean_text(payload.get("title"), 180) or job.title
            if "summary" in payload or "role_summary" in payload:
                job.summary = _clean_text(payload.get("summary") or payload.get("role_summary"), 1200)
            if "description" in payload:
                job.description = _clean_text(payload.get("description"), 5000)
            if "salary_from" in payload:
                job.salary_from = payload.get("salary_from")
            if "salary_to" in payload:
                job.salary_to = payload.get("salary_to")
            if "currency" in payload or "salary_currency" in payload:
                job.currency = _clean_text(payload.get("currency") or payload.get("salary_currency"), 12) or job.currency
            if "work_model" in payload:
                job.work_model = _clean_text(payload.get("work_model"), 40) or job.work_model
            if "location" in payload or "location_public" in payload:
                job.location = _clean_text(payload.get("location") or payload.get("location_public"), 240)
            if "skills" in payload or "skills_required" in payload:
                job.skills_required = json.dumps(_string_list(payload.get("skills") or payload.get("skills_required")), ensure_ascii=False)
            if "assessment_tasks" in payload:
                job.assessment_tasks = _safe_json_value(payload.get("assessment_tasks"), [])
            if "handshake_blueprint_v1" in payload:
                job.handshake_blueprint_v1 = _safe_json_value(payload.get("handshake_blueprint_v1"), {})
            if "capacity_policy" in payload:
                job.capacity_policy = _safe_json_value(payload.get("capacity_policy"), {})
            if "status" in payload and payload.get("status") in {"draft", "ready_for_publish", "archived"}:
                job.status = payload.get("status")
                job.is_active = False
            editor_state = dict(_safe_json_value(job.editor_state, {}))
            editor_state.update(_safe_json_value(payload.get("editor_state"), {}))
            for key in ("company_goal", "first_reply_prompt"):
                if key in payload:
                    editor_state[key] = _clean_text(payload.get(key), 1200)
            job.editor_state = editor_state
            job.updated_by = uuid.UUID(user_id)
            job.updated_at = datetime.utcnow()
            await session.commit()
            await session.refresh(job)
            return RealityDomainService._serialize_opportunity(job, company)

    @staticmethod
    async def ai_assist_company_challenge(user_id: str, challenge_id: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        async with AsyncSession(engine) as session:
            result = await session.execute(select(Job).where(Job.id == uuid.UUID(challenge_id)))
            job = result.scalar_one_or_none()
            if not job or not await RealityDomainService._has_company_access(session, user_id, job.company_id):
                return None
            company = await session.get(Company, job.company_id)
            role_family = _clean_text(_safe_json_value(job.editor_state, {}).get("role_family") or payload.get("role_family") or "operations", 80)
            problem = _clean_text(payload.get("problem_statement") or job.summary or job.description, 1200)
            try:
                raw_output, model_result = await asyncio.to_thread(
                    call_mistral_json,
                    RealityDomainService._challenge_ai_prompt(payload, company, job),
                    temperature=0.2,
                )
                ai_output = RealityDomainService._normalize_ai_output(raw_output, job.title, problem, role_family)
                ai_output["model"] = model_result.model_name
                ai_output["latency_ms"] = model_result.latency_ms
            except (MistralClientError, Exception) as exc:
                tasks = RealityDomainService._default_assessment_tasks(job.title, problem, role_family)
                ai_output = {
                    "schema_version": "challenge-ai-assist-v1",
                    "title": job.title,
                    "problem_statement": problem,
                    "task_brief": tasks[1]["prompt"],
                    "assessment_tasks": tasks,
                    "handshake_blueprint_v1": RealityDomainService._default_blueprint(job.title, tasks, role_family),
                    "suggested_tools": ["notion", "canva", "figma", "google_docs", "miro"],
                    "review_questions": ["Jak konkrétní byl první krok?", "Pojmenoval kandidát trade-off?", "Umí výstup ověřit v realitě?"],
                    "quality_score": 68,
                    "quality_checks": [{"id": "mistral_unavailable", "label": "Mistral nedostupný", "status": "warning", "advice": str(exc)[:180]}],
                    "jcfpm_policy": {"include_in_results": True, "required_if_missing": True, "reuse_existing": True},
                    "human_confirmation_required": True,
                    "generated_at": datetime.utcnow().isoformat(),
                    "provider": "deterministic_fallback",
                }
            tasks = _safe_list(ai_output.get("assessment_tasks"))
            blueprint = _safe_json_value(ai_output.get("handshake_blueprint_v1"), RealityDomainService._default_blueprint(job.title, tasks, role_family))
            editor_state = dict(_safe_json_value(job.editor_state, {}))
            editor_state.update({
                "ai_assist": ai_output,
                "ai_confirmed": False,
                "ai_assist_generated_at": ai_output["generated_at"],
                "first_reply_prompt": ai_output.get("task_brief") or editor_state.get("first_reply_prompt"),
                "jcfpm_policy": ai_output.get("jcfpm_policy"),
            })
            job.title = _clean_text(ai_output.get("title"), 180) or job.title
            job.summary = _clean_text(ai_output.get("problem_statement"), 1800) or job.summary
            job.assessment_tasks = tasks
            job.handshake_blueprint_v1 = blueprint
            job.editor_state = editor_state
            job.status = "ai_assisted"
            job.updated_by = uuid.UUID(user_id)
            job.updated_at = datetime.utcnow()
            session.add(job)
            await session.commit()
            await session.refresh(job)
            await RealityDomainService._log_ai_assist(user_id, str(job.id), ai_output)
            return {
                "challenge": RealityDomainService._serialize_opportunity(job, company),
                "ai_output": ai_output,
            }

    @staticmethod
    async def ai_draft_company_challenge(user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        async with AsyncSession(engine) as session:
            company = await RealityDomainService._company_for_user_in_session(session, user_id)
        role_family = _clean_text(payload.get("role_family") or "operations", 80)
        title = _clean_text(payload.get("title"), 180) or "Nová výzva"
        summary = _clean_text(payload.get("summary") or payload.get("problem_statement"), 1800)
        try:
            raw_output, model_result = await asyncio.to_thread(
                call_mistral_json,
                RealityDomainService._challenge_ai_prompt(payload, company, None),
                temperature=0.25,
            )
            ai_output = RealityDomainService._normalize_ai_output(raw_output, title, summary, role_family)
            ai_output["model"] = model_result.model_name
            ai_output["latency_ms"] = model_result.latency_ms
        except (MistralClientError, Exception) as exc:
            tasks = RealityDomainService._default_assessment_tasks(title, summary, role_family)
            ai_output = {
                "schema_version": "challenge-ai-assist-v1",
                "title": title,
                "problem_statement": summary or f"Popište, proč je výzva {title} důležitá a jaký výsledek má přinést.",
                "task_brief": tasks[1]["prompt"],
                "assessment_tasks": tasks,
                "handshake_blueprint_v1": RealityDomainService._default_blueprint(title, tasks, role_family),
                "suggested_tools": ["notion", "canva", "figma", "google_docs", "miro"],
                "quality_score": 62,
                "quality_checks": [{"id": "mistral_unavailable", "label": "Mistral nedostupný", "status": "warning", "advice": str(exc)[:180]}],
                "jcfpm_policy": {"include_in_results": True, "required_if_missing": True, "reuse_existing": True},
                "human_confirmation_required": True,
                "generated_at": datetime.utcnow().isoformat(),
                "provider": "deterministic_fallback",
            }
        await RealityDomainService._log_ai_assist(user_id, None, ai_output, job_type="challenge_ai_draft")
        return {"ai_output": ai_output}

    @staticmethod
    async def publish_company_challenge(user_id: str, challenge_id: str, human_confirmed: bool = False) -> Optional[Dict[str, Any]]:
        async with AsyncSession(engine) as session:
            result = await session.execute(select(Job).where(Job.id == uuid.UUID(challenge_id)))
            job = result.scalar_one_or_none()
            if not job or not await RealityDomainService._has_company_access(session, user_id, job.company_id):
                return None
            if not human_confirmed:
                raise ValueError("Human confirmation is required before publishing AI-assisted challenges.")
            if not _safe_json_value(job.assessment_tasks, []):
                job.assessment_tasks = RealityDomainService._default_assessment_tasks(job.title, job.summary or job.description or "")
            if not _safe_json_value(job.handshake_blueprint_v1, {}):
                job.handshake_blueprint_v1 = RealityDomainService._default_blueprint(job.title, _safe_json_value(job.assessment_tasks, []))
            editor_state = dict(_safe_json_value(job.editor_state, {}))
            editor_state["ai_confirmed"] = True
            editor_state["published_by"] = user_id
            job.editor_state = editor_state
            job.status = "published"
            job.is_active = True
            job.published_at = datetime.utcnow()
            job.updated_at = datetime.utcnow()
            job.updated_by = uuid.UUID(user_id)
            session.add(job)
            await session.commit()
            await session.refresh(job)
            company = await session.get(Company, job.company_id)
            return RealityDomainService._serialize_opportunity(job, company)

    @staticmethod
    async def get_company_challenge_preview(user_id: str, challenge_id: str) -> Optional[Dict[str, Any]]:
        async with AsyncSession(engine) as session:
            result = await session.execute(select(Job).where(Job.id == uuid.UUID(challenge_id)))
            job = result.scalar_one_or_none()
            if not job or not await RealityDomainService._has_company_access(session, user_id, job.company_id):
                return None
            company = await session.get(Company, job.company_id)
            challenge = RealityDomainService._serialize_opportunity(job, company)
            return {
                "challenge": challenge,
                "candidate_session_preview": {
                    "schema_version": "handshake-session-v1",
                    "source": "company_preview",
                    "job_id": str(job.id),
                    "company_id": str(job.company_id),
                    "assignment": {
                        "assessment_tasks": challenge["assessment_tasks"],
                        "handshake_blueprint_v1": challenge["handshake_blueprint_v1"],
                        "external_tools": ["notion", "canva", "figma", "google_docs", "miro", "other"],
                    },
                },
            }

    @staticmethod
    async def _log_ai_assist(user_id: str, challenge_id: Optional[str], output: Dict[str, Any], job_type: str = "challenge_ai_assist") -> None:
        try:
            async with AsyncSession(engine) as session:
                job_id = uuid.uuid4()
                await session.execute(
                    text(
                        """
                        INSERT INTO ai_interpretation_jobs
                          (id, user_id, opportunity_id, job_type, status, input_hash, completed_at)
                        VALUES
                          (:id, :user_id, :opportunity_id, :job_type, 'completed', :input_hash, now())
                        """
                    ),
                    {
                        "id": job_id,
                        "user_id": uuid.UUID(user_id),
                        "opportunity_id": uuid.UUID(challenge_id) if challenge_id else None,
                        "job_type": job_type,
                        "input_hash": _json_hash(output, f"{job_type}:"),
                    },
                )
                await session.execute(
                    text(
                        """
                        INSERT INTO ai_outputs
                          (interpretation_job_id, user_id, opportunity_id, output_type, output_payload, allowed_use, confidence, prompt_version, input_hash)
                        VALUES
                          (:job_id, :user_id, :opportunity_id, :output_type, :output_payload, 'draft_requires_human_confirmation', 0.820, 'mistral-v2-assist', :input_hash)
                        """
                    ),
                    {
                        "job_id": job_id,
                        "user_id": uuid.UUID(user_id),
                        "opportunity_id": uuid.UUID(challenge_id) if challenge_id else None,
                        "output_type": job_type,
                        "output_payload": json.dumps(output, ensure_ascii=False),
                        "input_hash": _json_hash(output, f"{job_type}:"),
                    },
                )
                await session.commit()
        except Exception:
            return

    @staticmethod
    async def create_company_for_user(user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        async with AsyncSession(engine) as session:
            company = Company(name=payload.get("name") or "New company")
            RealityDomainService._apply_company_payload(company, payload)
            session.add(company)
            await session.flush()
            membership = CompanyUser(user_id=uuid.UUID(user_id), company_id=company.id, role="owner")
            session.add(membership)
            await session.commit()
            await session.refresh(company)
            return RealityDomainService._serialize_company(company)

    @staticmethod
    async def update_company_for_user(user_id: str, company_id: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        async with AsyncSession(engine) as session:
            membership_statement = select(CompanyUser).where(
                CompanyUser.user_id == uuid.UUID(user_id),
                CompanyUser.company_id == uuid.UUID(company_id),
            )
            membership_result = await session.execute(membership_statement)
            if not membership_result.scalar_one_or_none():
                return None

            company_result = await session.execute(select(Company).where(Company.id == uuid.UUID(company_id)))
            company = company_result.scalar_one_or_none()
            if not company:
                return None

            RealityDomainService._apply_company_payload(company, payload)
            await session.commit()
            await session.refresh(company)
            return RealityDomainService._serialize_company(company)
