"""Hypothesis profiles. Default is derandomized so the gate is reproducible; use
HYPOTHESIS_PROFILE=explore for a longer randomized search."""

import os

from hypothesis import settings

settings.register_profile("default", max_examples=300, deadline=None, derandomize=True)
settings.register_profile("explore", max_examples=3000, deadline=None)
settings.load_profile(os.environ.get("HYPOTHESIS_PROFILE", "default"))
