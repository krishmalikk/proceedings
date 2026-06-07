"""Canonical posting-metadata schema (Pydantic v2).

Single source of truth shared by the Validator Tool and the BigQuery Writer Tool.
Mirrors tagging/JSON-SCHEMA-FIELD-DICTIONARY.md (schema v2.0).

Vocabulary validation (tags must exist in tags-cleaned/*.csv) is enforced by the
Validator Tool at runtime by loading the master CSVs; this module enforces
structure, types, enums, formats, and the 5-field dedup rule.
"""

from __future__ import annotations

import re
from enum import Enum
from typing import Optional, Union

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

# --------------------------------------------------------------------------- #
# Enums
# --------------------------------------------------------------------------- #


class DocKind(str, Enum):
    post = "post"
    comment = "comment"


class EmployerType(str, Enum):
    bigtech = "bigtech"
    consulting = "consulting"
    startup = "startup"
    academic = "academic"
    healthcare = "healthcare"
    government = "government"
    nonprofit = "nonprofit"
    other = "other"
    unknown = "unknown"


class Severity(str, Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"


class ResolutionStatus(str, Enum):
    open = "open"
    answered = "answered"
    resolved = "resolved"
    quarantined = "quarantined"
    rejected = "rejected"
    unknown = "unknown"


# --------------------------------------------------------------------------- #
# Regex / constants
# --------------------------------------------------------------------------- #

# case_id is generic across channels (D-036): <channel>-<YYYY-MM-DD>-<container>-<native_id>
# The leading token is the ingestion channel (reddit | app | web | …); the old
# reddit-prefixed ids remain valid under this superset pattern.
CASE_ID_RE = re.compile(
    r"^[a-z][a-z0-9]*-\d{4}-\d{2}-\d{2}-[A-Za-z0-9_]+-[a-z0-9]+(__c_[a-z0-9]+)?$"
)
LEGACY_CASE_ID_RE = re.compile(r"^case-\d+$")  # seed corpus exemption
CHANNEL_RE = re.compile(r"^[a-z][a-z0-9]*$")  # ingestion-channel token
# gcs_path is the canonical URI of the post's `.md` file (D-027). The seed
# corpus and any legacy doc may still use the folder form ending in '/'.
GCS_PREFIX_RE = re.compile(
    r"^gs://imm-postings-ingestion/\d{4}-\d{2}-\d{2}/[a-z0-9_-]+/"
    r"([A-Za-z0-9_\-]+\.md)?$"
)
ISO_TS_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
# source_uri is a channel-native locator (D-036): reddit subreddit path `r/<sub>`,
# OR any scheme URI (e.g. `app://post/<id>`, `https://…`). Empty is allowed for
# channels that have no native locator.
SOURCE_URI_RE = re.compile(r"^(r/[A-Za-z0-9_]+|[a-z][a-z0-9+.\-]*://\S+)$")
ISO2_RE = re.compile(r"^[A-Z]{2}$")


# --------------------------------------------------------------------------- #
# Model
# --------------------------------------------------------------------------- #


class PostingMetadata(BaseModel):
    """Canonical metadata document (schema v2.0)."""

    model_config = ConfigDict(
        extra="forbid", use_enum_values=True, populate_by_name=True
    )

    # ---- Identity ----
    case_id: str
    # ingestion channel (reddit | app | web | …); == case_id prefix == GCS path
    # segment. Derived from the case_id prefix when omitted (see validator).
    channel: str = ""
    doc_kind: DocKind = DocKind.post
    parent_case_id: str = ""
    # source-native (or app-minted) item id; the dedup / idempotency key.
    # Accepts the legacy key `reddit_post_id` for back-compat (D-036).
    source_native_id: str = Field(
        default="",
        validation_alias=AliasChoices("source_native_id", "reddit_post_id"),
    )

    # ---- Source / provenance ----
    ingestion_method: str
    source_system: str
    source_url: str
    source_uri: str
    # source community / board / section / topic. Accepts the legacy key
    # `subreddit` for back-compat (D-036).
    source_container: str = Field(
        default="",
        validation_alias=AliasChoices("source_container", "subreddit"),
    )
    full_url: str
    post_title: str
    language: str = "en"

    # ---- Timestamps ----
    posting_date: str
    ingestion_timestamp: str
    last_updated_timestamp: str

    # ---- Quality metadata ----
    tagging_confidence: float = Field(ge=0.0, le=1.0)
    source_metadata: str
    gcs_path: str

    # ---- Free-text summaries ----
    background_summary: str
    concerns_or_questions_summary: str

    # ---- Status (5 sibling tag fields) ----
    current_visa_or_greencard_category: list[str] = Field(default_factory=list)
    visa_applying_for: list[str] = Field(default_factory=list)
    primary_consulate: str = ""
    consulates: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    concerns_or_questions_tags: list[str] = Field(default_factory=list)

    # ---- Case context ----
    principal_country_of_chargeability: str = ""
    employer_type: EmployerType = EmployerType.unknown
    severity: Severity = Severity.medium
    resolution_status: ResolutionStatus = ResolutionStatus.open
    derived_topic_cluster: list[str] = Field(default_factory=list)

    # ---- Structured key-value ----
    # value may be a single string or a list of strings (e.g. travel_country
    # when the post discusses multiple destinations the applicant is considering).
    key_stages_or_info: dict[str, Union[str, list[str]]] = Field(default_factory=dict)
    key_dates: dict[str, str] = Field(default_factory=dict)

    # ---- Embedding ----
    embedding_text: str

    # ---- Ingestion/index status (set by the event-driven search-importer;
    #      null until the document is imported) ----
    index_state: Optional[str] = None  # import_requested|indexed|failed

    # ------------------------------------------------------------------ #
    # Field-level validators
    # ------------------------------------------------------------------ #

    @field_validator("case_id")
    @classmethod
    def _case_id_shape(cls, v: str) -> str:
        if CASE_ID_RE.match(v) or LEGACY_CASE_ID_RE.match(v):
            return v
        raise ValueError(
            f"case_id {v!r} must match reddit-<YYYY-MM-DD>-<sub>-<post_id>"
            " (or legacy case-<int> for the seed corpus)"
        )

    @field_validator("gcs_path")
    @classmethod
    def _gcs_prefix(cls, v: str) -> str:
        if not GCS_PREFIX_RE.match(v):
            raise ValueError(
                f"gcs_path {v!r} must be gs://imm-postings-ingestion/<YYYY-MM-DD>/<channel>/"
            )
        return v

    @field_validator("ingestion_timestamp", "last_updated_timestamp")
    @classmethod
    def _iso_ts(cls, v: str) -> str:
        if not ISO_TS_RE.match(v):
            raise ValueError(f"timestamp {v!r} must be YYYY-MM-DDTHH:MM:SSZ")
        return v

    @field_validator("posting_date")
    @classmethod
    def _iso_date(cls, v: str) -> str:
        if not ISO_DATE_RE.match(v):
            raise ValueError(f"posting_date {v!r} must be YYYY-MM-DD")
        return v

    @field_validator("source_uri")
    @classmethod
    def _source_uri(cls, v: str) -> str:
        if v != "" and not SOURCE_URI_RE.match(v):
            raise ValueError(
                f"source_uri {v!r} must be r/<subreddit>, a <scheme>://… URI, or ''"
            )
        return v

    @field_validator("principal_country_of_chargeability")
    @classmethod
    def _iso2_or_empty(cls, v: str) -> str:
        if v != "" and not ISO2_RE.match(v):
            raise ValueError(f"principal_country_of_chargeability {v!r} must be ISO-2 or ''")
        return v

    @field_validator("key_dates")
    @classmethod
    def _key_dates_iso(cls, v: dict[str, str]) -> dict[str, str]:
        for k, val in v.items():
            if not ISO_DATE_RE.match(str(val)):
                raise ValueError(f"key_dates[{k}]={val!r} must be YYYY-MM-DD")
        return v

    # ------------------------------------------------------------------ #
    # Cross-field validators
    # ------------------------------------------------------------------ #

    @model_validator(mode="after")
    def _derive_and_check_channel(self) -> "PostingMetadata":
        """Derive `channel` from the case_id prefix when omitted, and ensure a
        supplied channel matches the prefix. Legacy `case-<int>` ids default to
        the `reddit` channel (the seed corpus origin)."""
        prefix = (
            "" if LEGACY_CASE_ID_RE.match(self.case_id) else self.case_id.split("-", 1)[0]
        )
        if not self.channel:
            self.channel = prefix or "reddit"
        if prefix and self.channel != prefix:
            raise ValueError(
                f"channel {self.channel!r} must match case_id prefix {prefix!r}"
            )
        if not CHANNEL_RE.match(self.channel):
            raise ValueError(f"channel {self.channel!r} must be a lowercase token")
        return self

    # ---- Back-compat read accessors (D-036): old code/consumers that read the
    #      Reddit-named fields keep working against the generic fields. ----
    @property
    def subreddit(self) -> str:
        return self.source_container

    @property
    def reddit_post_id(self) -> str:
        return self.source_native_id

    @model_validator(mode="after")
    def _comment_parent_consistency(self) -> "PostingMetadata":
        if self.doc_kind == DocKind.comment.value:
            if not self.parent_case_id:
                raise ValueError("doc_kind=comment requires non-empty parent_case_id")
        else:  # post
            if self.parent_case_id:
                raise ValueError("doc_kind=post must have empty parent_case_id")
        return self

    @model_validator(mode="after")
    def _primary_consulate_in_list(self) -> "PostingMetadata":
        if self.primary_consulate and self.primary_consulate not in self.consulates:
            raise ValueError("primary_consulate must be a member of consulates")
        return self

    @model_validator(mode="after")
    def _five_field_dedup(self) -> "PostingMetadata":
        """No tag string may appear in more than one of:
        current_visa_or_greencard_category, consulates, tags,
        concerns_or_questions_tags. (visa_applying_for may overlap with current_*.)"""
        bag: list[str] = (
            list(self.current_visa_or_greencard_category)
            + list(self.consulates)
            + list(self.tags)
            + list(self.concerns_or_questions_tags)
        )
        dupes = {t for t in bag if bag.count(t) > 1}
        if dupes:
            raise ValueError(f"dedup violation across sibling tag fields: {sorted(dupes)}")
        return self


# --------------------------------------------------------------------------- #
# BigQuery schema export helper
# --------------------------------------------------------------------------- #

BIGQUERY_SCHEMA = [
    # (name, type, mode)  — mirrors postings.postings_metadata DDL
    ("case_id", "STRING", "REQUIRED"),
    ("channel", "STRING", "NULLABLE"),
    ("doc_kind", "STRING", "NULLABLE"),
    ("parent_case_id", "STRING", "NULLABLE"),
    ("source_native_id", "STRING", "NULLABLE"),
    ("source_system", "STRING", "NULLABLE"),
    ("source_uri", "STRING", "NULLABLE"),
    ("source_container", "STRING", "NULLABLE"),
    ("full_url", "STRING", "NULLABLE"),
    ("post_title", "STRING", "NULLABLE"),
    ("language", "STRING", "NULLABLE"),
    ("posting_date", "DATE", "NULLABLE"),
    ("ingestion_timestamp", "TIMESTAMP", "NULLABLE"),
    ("last_updated_timestamp", "TIMESTAMP", "NULLABLE"),
    ("tagging_confidence", "FLOAT64", "NULLABLE"),
    ("gcs_path", "STRING", "NULLABLE"),
    ("background_summary", "STRING", "NULLABLE"),
    ("concerns_or_questions_summary", "STRING", "NULLABLE"),
    ("current_visa_or_greencard_category", "STRING", "REPEATED"),
    ("visa_applying_for", "STRING", "REPEATED"),
    ("primary_consulate", "STRING", "NULLABLE"),
    ("consulates", "STRING", "REPEATED"),
    ("tags", "STRING", "REPEATED"),
    ("concerns_or_questions_tags", "STRING", "REPEATED"),
    ("principal_country_of_chargeability", "STRING", "NULLABLE"),
    ("employer_type", "STRING", "NULLABLE"),
    ("severity", "STRING", "NULLABLE"),
    ("resolution_status", "STRING", "NULLABLE"),
    ("derived_topic_cluster", "STRING", "REPEATED"),
    ("key_stages_or_info", "JSON", "NULLABLE"),
    ("key_dates", "JSON", "NULLABLE"),
    ("embedding_text", "STRING", "NULLABLE"),
    ("index_state", "STRING", "NULLABLE"),
    ("index_state_ts", "TIMESTAMP", "NULLABLE"),
    ("pipeline_run_id", "STRING", "NULLABLE"),
]


if __name__ == "__main__":
    # Smoke test: validate the schema against a minimal post.
    sample = PostingMetadata(
        case_id="reddit-2026-05-17-h1b-1srn4ab",
        doc_kind="post",
        parent_case_id="",
        source_native_id="1srn4ab",
        ingestion_method="api_crawl",
        source_system="reddit",
        source_url="https://reddit.com",
        source_uri="r/h1b",
        source_container="h1b",
        full_url="https://www.reddit.com/r/h1b/comments/1srn4ab/x/",
        post_title="Example",
        language="en",
        posting_date="2026-05-17",
        ingestion_timestamp="2026-05-17T00:00:00Z",
        last_updated_timestamp="2026-05-17T00:00:00Z",
        tagging_confidence=0.9,
        source_metadata="",
        gcs_path="gs://imm-postings-ingestion/2026-05-17/reddit/",
        background_summary="<summary_pending_llm>",
        concerns_or_questions_summary="example",
        current_visa_or_greencard_category=["H-1B"],
        visa_applying_for=["H-1B"],
        primary_consulate="",
        consulates=[],
        tags=["I-94"],
        concerns_or_questions_tags=["overstay"],
        principal_country_of_chargeability="IN",
        employer_type="unknown",
        severity="high",
        resolution_status="open",
        derived_topic_cluster=["overstay-recovery"],
        key_stages_or_info={"spouse_status": "H-1B"},
        key_dates={"i94_expire_date": "2025-03-31"},
        embedding_text="Example. ...",
    )
    print("schema OK:", sample.case_id)
