"""Immigration content labeling agent for Vertex AI Agent Engine."""

from labeling_agent.agent import ImmigrationLabelingAgent
from labeling_agent.taxonomy import CATEGORIES, VALID_LABELS

__all__ = ["ImmigrationLabelingAgent", "CATEGORIES", "VALID_LABELS"]
