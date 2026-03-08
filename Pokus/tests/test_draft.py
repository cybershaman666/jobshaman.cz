from job_agent.application import build_draft
from job_agent.models import CandidateProfile, JobPosting, JobRecommendation, MatchBreakdown, Preferences


def test_build_draft_falls_back_without_llm():
    recommendation = JobRecommendation(
        job=JobPosting(
            id="1",
            source="jobshaman",
            title="Backend Developer",
            company="Acme",
            description="Python API role",
        ),
        match_score=88,
        breakdown=MatchBreakdown(),
        reasons=["Silna shoda stacku."],
    )
    profile = CandidateProfile(
        raw_resume="CV",
        summary="Senior backend engineer",
        skills=["Python"],
        highlights=["Built production APIs"],
        desired_titles=["Backend Developer"],
    )
    preferences = Preferences()

    draft = build_draft(recommendation, profile, preferences, llm=None)
    assert "Backend Developer" in draft.message
    assert draft.job_id == "1"
