from .models import AIGuidedProfileResponseV2


def generate_profile_with_orchestration(*args, **kwargs):
    from .pipeline import generate_profile_with_orchestration as _generate

    return _generate(*args, **kwargs)

__all__ = [
    "AIGuidedProfileResponseV2",
    "generate_profile_with_orchestration",
]
