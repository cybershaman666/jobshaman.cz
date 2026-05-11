import sys
import os

# Add backend to path so we can import app
backend_path = "/home/misha/Projekty (2)/jobshaman-new/jobshaman/backend"
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

try:
    from app.domains.identity.models import CandidateProfile
    from sqlmodel import SQLModel
    
    registry = SQLModel.metadata.naming_convention
    # Actually, SQLModel uses SQLAlchemy's registry.
    # In recent SQLAlchemy/SQLModel, it's often in a declarative base or registry object.
    
    from sqlalchemy.orm import registry as sa_registry
    
    # Let's try to find where CandidateProfile is registered.
    # In SQLModel, all models share the same registry if they inherit from SQLModel.
    
    # We can check SQLModel.metadata.tables.
    print(f"Tables in metadata: {list(SQLModel.metadata.tables.keys())}")
    
    # The error "Multiple classes found for path" comes from SQLAlchemy's registry lookup.
    # It happens when you use a string name for a relationship.
    
    # Let's see if we can find multiple classes named CandidateProfile.
    
    # In SQLAlchemy 2.0 (used by SQLModel), registry is accessible.
    # But SQLModel usually hides it.
    
    # Try to find all classes that inherit from SQLModel.
    import gc
    classes = [cls for cls in gc.get_objects() if isinstance(cls, type) and cls.__name__ == "CandidateProfile"]
    print(f"Found {len(classes)} classes named 'CandidateProfile':")
    for cls in classes:
        print(f"  - {cls.__module__}.{cls.__name__} at {hex(id(cls))}")

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
