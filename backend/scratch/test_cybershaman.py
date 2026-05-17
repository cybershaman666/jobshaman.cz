#!/usr/bin/env python3
import sys
from pathlib import Path

# Setup paths
CURRENT_FILE = Path(__file__).resolve()
BACKEND_DIR = CURRENT_FILE.parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv
load_dotenv(BACKEND_DIR.parent / ".env")

from app.services.cybershaman_service import build_cybershaman_reply

def main():
    print("=== Testing Cybershaman AI Prompt Safety ===")
    test_message = "zkouška"
    dummy_profile = {
        "full_name": "Testovací Kandidát",
        "location": "Praha",
        "bio": "Hledám nové výzvy v IT.",
        "skills": '["Python", "React", "FastAPI"]',
        "preferences": '{"targetRole": "Python Developer"}'
    }
    
    try:
        print(f"Sending message: '{test_message}'")
        res = build_cybershaman_reply(
            message=test_message,
            profile=dummy_profile,
            recent_messages=[]
        )
        print("✅ Cybershaman AI Replied Successfully!")
        print(f"Reply: {res['reply']}")
        print(f"Next Step: {res['next_step']}")
        print(f"Tone: {res['tone']}")
        print(f"Suggested Prompts: {res['suggested_prompts']}")
        print(f"Latency: {res['latency_ms']}ms")
        print(f"Model used: {res['model']}")
        return 0
    except Exception as e:
        print(f"❌ Error triggered: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
