from job_agent.matching import rank_jobs
from job_agent.models import CandidateProfile, JobPosting, Preferences


def test_rank_jobs_prefers_keyword_overlap():
    profile = CandidateProfile(
        raw_resume="Python FastAPI React",
        summary="Backend engineer",
        skills=["Python", "FastAPI", "React"],
        highlights=["Built APIs"],
        desired_titles=["Backend Developer"],
    )
    preferences = Preferences(
        desired_titles=["Backend Developer"],
        required_keywords=["python", "fastapi"],
        optional_keywords=["react"],
        remote_only=True,
        min_match_score=0,
    )
    jobs = [
        JobPosting(
            id="1",
            source="jobshaman",
            title="Backend Developer",
            company="A",
            location="Remote Europe",
            remote=True,
            description="Python FastAPI role building APIs",
        ),
        JobPosting(
            id="2",
            source="jobshaman",
            title="PHP Developer",
            company="B",
            location="Prague",
            remote=False,
            description="Legacy PHP maintenance",
        ),
    ]

    ranked = rank_jobs(jobs, profile, preferences, llm=None)
    assert ranked[0].job.id == "1"
    assert ranked[0].match_score > ranked[1].match_score

