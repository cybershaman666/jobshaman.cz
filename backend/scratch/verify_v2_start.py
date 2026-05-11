import os
import sys
import asyncio

# Add backend to sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

async def test_app_init():
    print("Testing FastAPI app initialization...")
    try:
        # Set dummy environment variables to prevent validation errors
        os.environ["DATABASE_URL"] = "postgresql://user:pass@localhost/db"
        os.environ["EXTERNAL_POSTGRES_URI"] = os.environ["DATABASE_URL"]
        os.environ["SUPABASE_URL"] = "http://localhost"
        os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "key"
        os.environ["SUPABASE_JWT_SECRET"] = "secret"
        os.environ["V2_ENV"] = "test"

        # Import main app
        from app.main import app
        print("FastAPI app instance created successfully.")

        # Check registry
        from sqlmodel import SQLModel
        print(f"Registered models in metadata: {list(SQLModel.metadata.tables.keys())}")
        
        # Check registry
        from sqlalchemy.orm import class_mapper
        from app.domains.identity.models import CandidateProfile
        try:
            mapper = class_mapper(CandidateProfile)
            print(f"CandidateProfile mapper found: {mapper}")
        except Exception as mapper_err:
            print(f"CandidateProfile mapper NOT found: {mapper_err}")
            raise

        print("Initialization test PASSED.")
    except Exception as e:
        print(f"Initialization test FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(test_app_init())
