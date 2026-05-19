import asyncio
import os
import sys

# Add backend directory to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))
os.environ["AZURE_OPENAI_DEPLOYMENT_NAME"] = "gpt-5-mini"

from app.services.azure_ai_client import call_ai_json
from app.domains.reality.service import RealityDomainService

async def main():
    payload = {
        "title": "Nová výzva",
        "summary": "Potřebujeme někoho na frontend",
        "role_family": "engineering"
    }
    try:
        prompt = RealityDomainService._challenge_ai_prompt(payload, None, None)
        raw_output, model_result = call_ai_json(prompt, temperature=0.25)
        print("RAW OUTPUT:", raw_output)
    except Exception as e:
        print("ERROR:", e)

asyncio.run(main())
