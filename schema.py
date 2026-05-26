"""
Pydantic schema for an ingested immigration-related post record.

Matches the JSON metadata format from the Imm Specifications document.
Used for validation of labeled output from the Vertex AI Agent.
"""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Annotated, Any

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
)


# ---------- Controlled vocabularies ----------

class SourceSystem(str, Enum):
    REDDIT = "reddit"
    TWITTER = "twitter"
    QUORA = "quora"
    IMMIGRATION_FORUM = "immigration_forum"
    BLOG = "blog"
    GOVERNMENT = "government"
    LAW_FIRM = "law_firm"
    OTHER = "other"


# ISO 3166-1 alpha-3 country code
CountryCodeAlpha3 = Annotated[
    str,
    StringConstraints(min_length=3, max_length=3, pattern=r"^[A-Z]{3}$"),
]

NonEmptyStr = Annotated[str, StringConstraints(min_length=1, strip_whitespace=True)]


# ---------- Valid visa categories (from Imm Categories Excel) ----------

VALID_VISA_CATEGORIES = [
    "B-1", "B-2", "F-1", "F-2", "M-1", "J-1",
    "H-1", "H-1B", "H-1B1", "H-2A", "H-2B", "H-3", "H-4",
    "L-1", "L-1A", "L-1B", "L-2",
    "O-1", "O-1A", "O-1B", "O-2", "O-3",
    "E-1", "E-2", "E-3",
    "TN", "TN-1", "TN-2", "TD", "TD-1", "TD-2",
    "K-1", "K-3", "K-4",
    "P-1", "P-1A", "P-1B", "P-2", "P-3", "P-4",
    "R-1", "R-2",
    "C-1", "C-2", "C-3", "D",
    "A-1", "A-2", "A-3",
    "T-1", "T-2", "T-3", "T-4", "T-5", "T-6",
    "I",
    # Green card categories
    "IR-1", "IR-2", "IR-5",
    "Family-F1", "Family-F2A", "Family-F2B", "Family-F3", "Family-F4",
    "EB-1", "EB-2", "EB-3", "EB-4", "EB-5",
    "DV", "SIV",
    # General
    "GC", "EAD", "AP",
]


# ---------- Main schema ----------

class ImmigrationPost(BaseModel):
    """A single ingested immigration-related post / thread record."""

    model_config = ConfigDict(
        extra="allow",
        str_strip_whitespace=True,
        use_enum_values=True,
    )

    # --- Provenance ---
    source_system: str = Field(
        ..., description="Upstream system (reddit, blog, government, etc.)"
    )
    source_url: str = Field(
        ..., description="Base URL of the source system (e.g. https://reddit.com)"
    )
    source_uri: str = Field(
        ..., description="Relative path within the source system (e.g. 'r/h1b')"
    )
    full_url: str = Field(
        ..., description="Fully-qualified URL of the post"
    )

    # --- Applicant / case context ---
    current_visa_or_greencard_category: list[str] = Field(
        default_factory=list,
        description="Current status categories held by the poster (e.g. ['L-1A'])",
    )
    current_nationality: str = Field(
        default="UNK",
        description="ISO 3166-1 alpha-3 country code (e.g. 'IND', 'USA'). 'UNK' if unknown.",
    )
    current_resident_of_country: str = Field(
        default="UNK",
        description="ISO 3166-1 alpha-3 country code of current residence. 'UNK' if unknown.",
    )
    visa_or_greencard_applying_for: list[str] = Field(
        default_factory=list,
        description="Target visa/greencard categories (e.g. ['H-1B'])",
    )
    consulate: str | None = Field(
        default=None,
        description="Consulate/country of processing, if mentioned",
    )

    # --- Content & enrichment ---
    background_summary: str = Field(
        default="", description="LLM-generated summary of the poster's background"
    )
    tags: list[str] = Field(
        default_factory=list, description="Topical tags from Imm Categories"
    )
    concerns_or_questions_tag_list: list[str] = Field(
        default_factory=list,
        description="Tags for the concerns/questions asked",
    )
    concerns_or_questions_summary: str = Field(
        default="", description="LLM-generated summary of the concerns/questions"
    )

    key_stages_or_info: dict[str, Any] = Field(
        default_factory=dict,
        description="Case milestones and their status (e.g. {'h1b-lottery': 'approved'})",
    )
    key_dates: dict[str, str] = Field(
        default_factory=dict,
        description="Named dates (e.g. {'priority_date': '11/30/2025'})",
    )

    # --- Record timestamps & scoring ---
    posting_date: str = Field(
        default="", description="Date the post was published (YYYY-MM-DD)"
    )
    ingestion_timestamp: str = Field(
        default="", description="When this record was ingested"
    )
    confidence_score: int = Field(
        default=0,
        ge=0,
        le=100,
        description="Pipeline/LLM confidence in the extracted fields (0-100)",
    )

    # --- Storage metadata ---
    source_metadata: str | None = Field(
        default=None,
        description="Opaque metadata about the source",
    )
    gcs_path: str = Field(
        default="",
        description="Google Cloud Storage path for the raw artifact",
    )

    @field_validator(
        "current_visa_or_greencard_category",
        "visa_or_greencard_applying_for",
        "tags",
        "concerns_or_questions_tag_list",
    )
    @classmethod
    def _dedupe_preserve_order(cls, v: list[str]) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        for item in v:
            if item not in seen:
                seen.add(item)
                out.append(item)
        return out


# ---------- Quick self-test ----------

if __name__ == "__main__":
    sample = {
        "source_system": "reddit",
        "source_url": "https://reddit.com",
        "source_uri": "r/h1b",
        "full_url": "https://www.reddit.com/r/h1b/comments/1skzyek/l1a_to_h1b_cos_avoid/",
        "current_visa_or_greencard_category": ["L-1A"],
        "current_nationality": "IND",
        "current_resident_of_country": "USA",
        "visa_or_greencard_applying_for": ["H-1B"],
        "background_summary": "Poster on L-1A wants to switch to H-1B via COS",
        "consulate": "India",
        "tags": ["L-1A", "change-of-status-COS", "l1-to-h1b", "visa-transfer"],
        "concerns_or_questions_tag_list": ["change-of-status-COS"],
        "concerns_or_questions_summary": "Employer only doing COS. Can they activate H-1B COS later?",
        "key_stages_or_info": {"h1b-lottery": "approved", "I-140": "approved"},
        "key_dates": {
            "priority_date": "11/30/2025",
            "h1b_start_date": "10/01/2026",
            "visa_expire_date": "09/30/2026",
        },
        "posting_date": "2026-04-11",
        "ingestion_timestamp": "2026-04-13 14:30:05",
        "confidence_score": 92,
        "source_metadata": "reddit post score: 15, subreddit: r/h1b",
        "gcs_path": "gs://law-firm-knowledge-base/raw/2026-04-13",
    }

    post = ImmigrationPost(**sample)
    print("Validation passed!")
    print(post.model_dump_json(indent=2))
