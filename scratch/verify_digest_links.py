import sys
from typing import Dict

# Mocking the constant and function from daily_digest.py
_APP_URL = "https://jobshaman.cz"

def _build_job_detail_url(job: Dict) -> str:
    job_id = job.get("id")
    # Heuristic: curated jobs have 'native', 'challenge', or 'jobshaman' in source/kind
    source_kind = str(job.get("source_kind") or "").lower()
    source = str(job.get("source") or "").lower()
    is_curated = any(kw in source_kind for kw in ["native", "challenge", "jobshaman"]) or "jobshaman" in source
    
    prefix = "/candidate/role" if is_curated else "/candidate/imported"
    return f"{_APP_URL}{prefix}/{job_id}"

# Test cases
test_jobs = [
    {
        "id": "123",
        "source_kind": "native",
        "source": "some_source",
        "name": "Native Job"
    },
    {
        "id": "456",
        "source_kind": "imported_jobs",
        "source": "linkedin",
        "name": "Imported Job"
    },
    {
        "id": "789",
        "source_kind": None,
        "source": "JobShaman Core",
        "name": "JobShaman Source Job"
    },
    {
        "id": "abc",
        "source_kind": "challenge_format",
        "source": "external",
        "name": "Challenge Job"
    }
]

for job in test_jobs:
    url = _build_job_detail_url(job)
    print(f"Job: {job['name']} -> URL: {url}")

expected = [
    "https://jobshaman.cz/candidate/role/123",
    "https://jobshaman.cz/candidate/imported/456",
    "https://jobshaman.cz/candidate/role/789",
    "https://jobshaman.cz/candidate/role/abc"
]

actual = [_build_job_detail_url(job) for job in test_jobs]
assert actual == expected
print("\n✅ All tests passed!")
