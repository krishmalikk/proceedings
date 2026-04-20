"""
Pydantic schema for an ingested immigration-related post record.

Designed for Pydantic v2. Field types are inferred from the sample JSON,
with reasonable enums/validators added where the sample suggests a
controlled vocabulary (ingestion_method, source_system, nationality codes, etc.).

Notes on design choices:
- `key_dates` and `key_stages_or_info` are kept as open dicts because the sample
  shows variable, extensible keys. Values in `key_dates` are parsed as `date`
  and accept both "MM/DD/YYYY" and ISO ("YYYY-MM-DD") forms.
- `confidence_score` is constrained to 0-100 based on the sample value of 92.
- Country codes are validated as ISO 3166-1 alpha-3 (e.g. "IND", "USA").
- URLs use `HttpUrl`; `gcs_path` is validated to start with `gs://`.
- `model_config` uses `extra="forbid"` so unexpected fields raise errors early;
  switch to `"ignore"` or `"allow"` if upstream sources add fields frequently.
"""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Annotated, Any

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    StringConstraints,
    field_validator,
)


# ---------- Controlled vocabularies (extend as needed) ----------


class IngestionMethod(str, Enum):
    WEB_CRAWL = "web_crawl"
    API = "api"
    MANUAL = "manual"
    RSS = "rss"


class SourceSystem(str, Enum):
    REDDIT = "reddit"
    TWITTER = "twitter"
    QUORA = "quora"
    IMMIGRATION_FORUM = "immigration_forum"
    BLOG = "blog"
    OTHER = "other"


# ---------- Reusable constrained types ----------

# ISO 3166-1 alpha-3 country code, e.g. "IND", "USA"
CountryCodeAlpha3 = Annotated[
    str,
    StringConstraints(min_length=3, max_length=3, pattern=r"^[A-Z]{3}$"),
]

NonEmptyStr = Annotated[str, StringConstraints(min_length=1, strip_whitespace=True)]


# ---------- Main schema ----------


class ImmigrationPost(BaseModel):
    """A single ingested immigration-related post / thread record."""

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
        use_enum_values=True,
        json_schema_extra={
            "example": {
                "ingestion_method": "web_crawl",
                "source_system": "reddit",
                "source_url": "https://reddit.com",
                "source_uri": "r1/h1b",
                "full_url": "https://www.reddit.com/r/h1b/comments/1skzyek/l1a_to_h1b_cos_avoid/",
                "current_visa_or_greencard_category": ["L-1A"],
                "visa_or_greencard_applying_for": ["H-1"],
                "background_summary": "<summary_by_Gemini>",
                "consulate": "India",
                "tags": ["L-1A", "change-of-status-COS", "l1-to-h1b", "visa-transfer"],
                "concerns_or_questions_tag_list": ["change-of-status-COS"],
                "concerns_or_questions_summary": (
                    "Employer only doing COS. Activate H-1B COS later on the same approved petition ?"
                ),
                "key_stages_or_info": {"h1b-lottery": "approved", "I-140": "approved"},
                "key_dates": {
                    "priority_date": "11/30/2025",
                    "h1b_start_date": "10/01/2026",
                    "visa_expire_date": "09/30/2026",
                },
                "posting_date": "2026-04-11",
                "ingestion_timestamp": "2026-04-13 14:30:05",
                "confidence_score": 92,
                "source_metadata": "<some metadata information about source url>",
                "gcs_path": "gs://imm-ingest-firecrawl-md/2026-04-13",
            }
        },
    )

    # --- Provenance ---
    ingestion_method: IngestionMethod = Field(
        ..., description="How this record was obtained."
    )
    source_system: SourceSystem = Field(
        ..., description="Upstream system / site the post came from."
    )
    source_url: HttpUrl = Field(
        ..., description="Base URL of the source system (e.g. https://reddit.com)."
    )
    source_uri: NonEmptyStr = Field(
        ..., description="Relative path within the source system (e.g. 'r1/h1b')."
    )
    full_url: HttpUrl = Field(
        ..., description="Canonical, fully-qualified URL of the post."
    )

    # --- Applicant / case context ---
    current_visa_or_greencard_category: list[NonEmptyStr] = Field(
        default_factory=list,
        description="Current status categories held by the poster (e.g. ['L-1A']).",
    )
    current_nationality: CountryCodeAlpha3 = Field(
        ..., description="ISO 3166-1 alpha-3 country code of the poster's nationality."
    )
    current_resident_of_country: CountryCodeAlpha3 = Field(
        ..., description="ISO 3166-1 alpha-3 country code of current residence."
    )
    visa_or_greencard_applying_for: list[NonEmptyStr] = Field(
        default_factory=list,
        description="Target visa/greencard categories (e.g. ['H-1']).",
    )
    consulate: str | None = Field(
        default=None,
        description="Consulate/country of processing, if mentioned.",
    )

    # --- Content & enrichment ---
    background_summary: str = Field(
        ..., description="LLM-generated summary of the poster's background."
    )
    tags: list[NonEmptyStr] = Field(
        default_factory=list, description="Free-form topical tags."
    )
    concerns_or_questions_tag_list: list[NonEmptyStr] = Field(
        default_factory=list,
        description="Canonical tags for the concerns/questions asked.",
    )
    concerns_or_questions_summary: str = Field(
        ..., description="LLM-generated summary of the concerns/questions."
    )

    key_stages_or_info: dict[str, Any] = Field(
        default_factory=dict,
        description=(
            "Flexible map of case milestones and their status "
            "(e.g. {'h1b-lottery': 'approved', 'I-140': 'approved'})."
        ),
    )
    key_dates: dict[str, date] = Field(
        default_factory=dict,
        description=(
            "Flexible map of named dates. Values accept 'MM/DD/YYYY' or ISO 'YYYY-MM-DD'."
        ),
    )

    # --- Record timestamps & scoring ---
    posting_date: date = Field(..., description="Date the post was published.")
    ingestion_timestamp: datetime = Field(
        ..., description="When this record was ingested into the pipeline."
    )
    confidence_score: int = Field(
        ...,
        ge=0,
        le=100,
        description="Pipeline/LLM confidence in the extracted fields (0-100).",
    )

    # --- Storage metadata ---
    source_metadata: str | None = Field(
        default=None,
        description="Opaque metadata blob about the source (JSON string, HTML head, etc.).",
    )
    gcs_path: str = Field(
        ...,
        pattern=r"^gs://[^/]+(/.*)?$",
        description="Google Cloud Storage path prefix/object for the raw artifact.",
    )

    # ---------- Validators ----------

    @field_validator("key_dates", mode="before")
    @classmethod
    def _coerce_key_dates(cls, v: Any) -> Any:
        """Accept 'MM/DD/YYYY' in addition to ISO dates for each value."""
        if not isinstance(v, dict):
            return v
        coerced: dict[str, date] = {}
        for key, raw in v.items():
            if isinstance(raw, date):
                coerced[key] = raw
                continue
            if not isinstance(raw, str):
                # Let Pydantic raise a clear error on non-string, non-date values.
                coerced[key] = raw  # type: ignore[assignment]
                continue
            s = raw.strip()
            parsed: date | None = None
            for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%d/%m/%Y"):
                try:
                    parsed = datetime.strptime(s, fmt).date()
                    break
                except ValueError:
                    continue
            coerced[key] = parsed if parsed is not None else raw  # type: ignore[assignment]
        return coerced

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
    import json

    sample = {
        "ingestion_method": "web_crawl",
        "source_system": "reddit",
        "source_url": "https://reddit.com",
        "source_uri": "r1/h1b",
        "full_url": "https://www.reddit.com/r/h1b/comments/1skzyek/l1a_to_h1b_cos_avoid/",
        "current_visa_or_greencard_category": ["L-1A"],
        "current_nationality": "IND",
        "current_resident_of_country": "USA",
        "visa_or_greencard_applying_for": ["H-1"],
        "background_summary": "<summary_by_Gemini>",
        "consulate": "India",
        "tags": ["L-1A", "change-of-status-COS", "l1-to-h1b", "visa-transfer"],
        "concerns_or_questions_tag_list": ["change-of-status-COS"],
        "concerns_or_questions_summary": (
            "Employer only doing COS. Activate H-1B COS later on the same approved petition ?"
        ),
        "key_stages_or_info": {"h1b-lottery": "approved", "I-140": "approved"},
        "key_dates": {
            "priority_date": "11/30/2025",
            "h1b_start_date": "10/01/2026",
            "visa_expire_date": "09/30/2026",
        },
        "posting_date": "2026-04-11",
        "ingestion_timestamp": "2026-04-13 14:30:05",
        "confidence_score": 92,
        "source_metadata": "<some metadata information about source url>",
        "gcs_path": "gs://imm-ingest-firecrawl-md/2026-04-13",
    }

    post = ImmigrationPost.model_validate(sample)
    print(json.dumps(post.model_dump(mode="json"), indent=2, default=str))
