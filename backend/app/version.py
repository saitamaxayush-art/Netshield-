"""API version reported in /api/health and in every response's meta."""

import networkx as nx

API_VERSION = "2.0.0"
ENGINE_VERSION: str = nx.__version__
