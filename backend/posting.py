"""
posting.py — user-submitted posting: auto-tagging + publish to the grounding sink
=================================================================================
Implements the "Post a new message" flow (posting-specs.md). Two capabilities:

  1. suggest_tags(title, description)
       → run the Gemini tagging engine (LLM-EXTRACTION-PROMPT) over the text and
         return controlled-vocabulary tags grouped by schema section, for the
         composer's right-hand panel. Pure read, no side effects.

  2. publish_posting(title, description, tags, ...)
       → build the canonical sidecar JSON (JSON-SCHEMA-FIELD-DICTIONARY), validate
         it against the master vocab, then (a) write <case_id>.md + .json to
         gs://imm-postings-ingestion/<date>/app/, (b) documents.import it
         into DS-1 (imm-postings-datastore) so it's searchable in minutes, and
         (c) append a row to BigQuery postings.postings_metadata.

Decisions: channel = "app" (D-036/D-038 canonical — the controlled pathway token the
search boost/filters key on; the domain never goes here). The website's provenance
identity (source_system + URLs) is env-driven (APP_SOURCE_SYSTEM / APP_BASE_URL), so
registering a domain later is a config flip, not a code change. Anonymous author
(synthetic handle); direct documents.import; BigQuery row written.
"""

from __future__ import annotations

import csv
import json
import os
import re
import secrets
from datetime import datetime, timezone

from google import genai
from google.api_core.client_options import ClientOptions
from google.cloud import discoveryengine_v1 as de
from google.cloud import storage

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

CHANNEL = "app"  # controlled pathway token (channel field + case_id prefix + GCS segment) — the domain NEVER goes here
# The website's provenance identity. Env-driven so registering a domain later is a
# config flip (set APP_SOURCE_SYSTEM=<domain>, APP_BASE_URL=https://<domain>) — no code/redeploy of logic.
SOURCE_SYSTEM = os.getenv("APP_SOURCE_SYSTEM", "unclesamcalling")
APP_BASE_URL = os.getenv("APP_BASE_URL", "https://proceedings.app").rstrip("/")
_TAGS_DIR = os.path.join(os.path.dirname(__file__), "tags-cleaned")


def _project() -> str:
    return os.getenv("GCP_PROJECT_ID") or os.getenv("GCP_PROJECT", "")


def _region() -> str:
    return os.getenv("GCP_REGION") or os.getenv("GCP_GEMINI_LOCATION", "us-central1")


def _bucket_name() -> str:
    return os.getenv("GCP_BUCKET_NAME") or os.getenv("GCP_BUCKET", "imm-postings-ingestion")


def _datastore() -> str:
    return os.getenv("GCP_VERTEX_DATASTORE_ID", "imm-postings-datastore")


def _ds_location() -> str:
    return os.getenv("GCP_VERTEX_DATASTORE_LOCATION", "global")


def _gemini_model() -> str:
    return os.getenv("GCP_GEMINI_MODEL", "gemini-2.5-flash")


# ---------------------------------------------------------------------------
# Master tag vocabulary (loaded once)
# ---------------------------------------------------------------------------

def _load_col(filename: str, col: int = 0) -> list[str]:
    """Return the values of one column of a tags-cleaned CSV (header skipped)."""
    path = os.path.join(_TAGS_DIR, filename)
    out: list[str] = []
    try:
        with open(path, newline="", encoding="utf-8") as f:
            reader = csv.reader(f)
            next(reader, None)  # header
            for row in reader:
                if len(row) > col and row[col].strip():
                    out.append(row[col].strip())
    except FileNotFoundError:
        print(f"posting: vocab CSV missing: {filename}")
    return out


def _load_consulate_options() -> list[dict]:
    """Return [{code, label}] for consulates, label = 'City, Country (CODE)' or
    'Country (CODE)' so users can search by place name, not just the code."""
    path = os.path.join(_TAGS_DIR, "1.4-consulates.csv")
    out: list[dict] = []
    try:
        with open(path, newline="", encoding="utf-8") as f:
            reader = csv.reader(f)
            next(reader, None)  # header: tag,Type,Country,City
            for row in reader:
                if not row or not row[0].strip():
                    continue
                code = row[0].strip()
                country = row[2].strip() if len(row) > 2 else ""
                city = row[3].strip() if len(row) > 3 else ""
                if city:
                    label = f"{city}, {country} ({code})"
                elif country:
                    label = f"{country} ({code})"
                else:
                    label = code
                out.append({"code": code, "label": label})
    except FileNotFoundError:
        print("posting: vocab CSV missing: 1.4-consulates.csv")
    return out


def _load_consulate_tree() -> list[dict]:
    """Grouped consulates for a two-part (country → city) picker.

    Returns ``[{country, country_code, cities: [{code, city}]}]`` sorted by
    country, cities sorted by name. `country_code` is the 1.4 country-type code
    (storable on its own when the user picks a country but no specific city);
    each city `code` is the consulate code. Built from the structured CSV columns
    so it is robust to country names that contain commas."""
    path = os.path.join(_TAGS_DIR, "1.4-consulates.csv")
    country_code: dict[str, str] = {}
    cities: dict[str, list[dict]] = {}
    try:
        with open(path, newline="", encoding="utf-8") as f:
            reader = csv.reader(f)
            next(reader, None)  # header: tag,Type,Country,City
            for row in reader:
                if not row or not row[0].strip():
                    continue
                code = row[0].strip()
                typ = row[1].strip() if len(row) > 1 else ""
                country = row[2].strip() if len(row) > 2 else ""
                city = row[3].strip() if len(row) > 3 else ""
                if not country:
                    continue
                if typ == "country":
                    country_code.setdefault(country, code)
                elif typ == "city" and city:
                    cities.setdefault(country, []).append({"code": code, "city": city})
    except FileNotFoundError:
        print("posting: vocab CSV missing: 1.4-consulates.csv")
        return []
    out: list[dict] = []
    for country in sorted(set(country_code) | set(cities)):
        out.append({
            "country": country,
            "country_code": country_code.get(country, ""),
            "cities": sorted(cities.get(country, []), key=lambda c: c["city"]),
        })
    return out


def _load_pairs(filename: str, desc_col: int = 1) -> list[tuple[str, str]]:
    """Return [(tag, description)] for a tags-cleaned CSV (header skipped)."""
    path = os.path.join(_TAGS_DIR, filename)
    out: list[tuple[str, str]] = []
    try:
        with open(path, newline="", encoding="utf-8") as f:
            reader = csv.reader(f)
            next(reader, None)  # header
            for row in reader:
                if row and row[0].strip():
                    desc = row[desc_col].strip() if len(row) > desc_col else ""
                    out.append((row[0].strip(), desc))
    except FileNotFoundError:
        print(f"posting: vocab CSV missing: {filename}")
    return out


def _load_misc_options() -> list[dict]:
    """[{code, label}] for the profile 'Miscellaneous tags & topics' picker:
    1.3 abbreviations (label shows the Full Name) + 1.10 common-misc (Description).
    label = 'CODE — meaning' so the dropdown shows the description alongside the code."""
    out: list[dict] = []
    seen: set[str] = set()
    pairs = _load_pairs("1.3-abbreviations.csv", 2) + _load_pairs("1.10-common-misc.csv", 1)
    for code, desc in pairs:
        if code and code not in seen:
            seen.add(code)
            out.append({"code": code, "label": (f"{code} — {desc}" if desc else code)})
    return out


def _load_country_codes() -> list[str]:
    """1.4 codes whose Type column == 'country' (ISO-2 country codes)."""
    path = os.path.join(_TAGS_DIR, "1.4-consulates.csv")
    out: list[str] = []
    try:
        with open(path, newline="", encoding="utf-8") as f:
            reader = csv.reader(f)
            next(reader, None)
            for row in reader:
                if len(row) >= 2 and row[1].strip().lower() == "country" and row[0].strip():
                    out.append(row[0].strip())
    except FileNotFoundError:
        print("posting: vocab CSV missing: 1.4-consulates.csv")
    return out


class _Vocab:
    """Master vocabulary sets + ordered lists, lazily loaded and cached."""

    _loaded = False
    visa: set[str] = set()
    consulate: set[str] = set()
    tag: set[str] = set()           # union of 1.3,1.5,1.6,1.9,1.10
    stage_keys: set[str] = set()
    date_keys: set[str] = set()
    outcomes: set[str] = set()        # 1.9 outcomes (value domain for outcome_status / form keys)
    country: set[str] = set()         # 1.4 country-type codes (value domain for *_of_country / travel_country)
    form: set[str] = set()            # 1.5 forms (profile key_stages KEYS; value domain = outcome)
    misc: set[str] = set()            # 1.3 + 1.10 (profile 'miscellaneous tags & topics')
    profile_stage_keys: set[str] = set()  # 1.7 + 1.5 + 1.1 + 1.3 (NO 1.6) — profile key_stages keys
    # ordered lists for compact prompt blocks
    _visa_list: list[str] = []
    _consulate_list: list[str] = []
    _tag_list: list[str] = []
    _stage_list: list[str] = []
    _date_list: list[str] = []
    _outcome_list: list[str] = []
    _country_list: list[str] = []
    _form_list: list[str] = []
    _misc_list: list[str] = []
    _misc_options: list[dict] = []
    _profile_stage_list: list[str] = []
    _tag_plain_list: list[str] = []          # 1.3,1.5,1.6,1.9 names (self-explanatory)
    _misc_pairs: list[tuple[str, str]] = []   # 1.10 (tag, description) — ambiguous, needs meaning
    _consulate_opts: list[dict] = []          # [{code, label}] for the place-name dropdown
    _consulate_tree: list[dict] = []          # [{country, country_code, cities:[{code, city}]}]

    @classmethod
    def load(cls) -> None:
        if cls._loaded:
            return
        cls._visa_list = _load_col("1.1-non-immigration-visas.csv") + _load_col("1.2-greencard-categories.csv")
        cls._consulate_list = _load_col("1.4-consulates.csv")
        cls._consulate_opts = _load_consulate_options()
        cls._consulate_tree = _load_consulate_tree()
        cls._tag_plain_list = (
            _load_col("1.3-abbreviations.csv")
            + _load_col("1.5-forms.csv")
            + _load_col("1.6-visa-form-actions.csv")
            + _load_col("1.9-outcomes.csv")
        )
        cls._misc_pairs = _load_pairs("1.10-common-misc.csv")
        cls._tag_list = cls._tag_plain_list + [t for t, _ in cls._misc_pairs]
        cls._stage_list = (
            _load_col("1.7-key-stages.csv")
            + _load_col("1.1-non-immigration-visas.csv")
            + _load_col("1.3-abbreviations.csv")
            + _load_col("1.5-forms.csv")
            + _load_col("1.6-visa-form-actions.csv")
        )
        cls._date_list = _load_col("1.8-key-dates.csv")
        cls._outcome_list = _load_col("1.9-outcomes.csv")
        cls._country_list = _load_country_codes()
        cls._form_list = _load_col("1.5-forms.csv")
        cls._misc_list = _load_col("1.3-abbreviations.csv") + _load_col("1.10-common-misc.csv")
        cls._misc_options = _load_misc_options()
        # profile key_stages keys: 1.7 + visas + abbreviations + forms — NO 1.6 actions
        cls._profile_stage_list = (
            _load_col("1.7-key-stages.csv") + _load_col("1.1-non-immigration-visas.csv")
            + _load_col("1.3-abbreviations.csv") + _load_col("1.5-forms.csv")
        )
        cls.visa = set(cls._visa_list)
        cls.consulate = set(cls._consulate_list)
        cls.tag = set(cls._tag_list)
        cls.stage_keys = set(cls._stage_list)
        cls.date_keys = set(cls._date_list)
        cls.outcomes = set(cls._outcome_list)
        cls.country = set(cls._country_list)
        cls.form = set(cls._form_list)
        cls.misc = set(cls._misc_list)
        cls.profile_stage_keys = set(cls._profile_stage_list)
        cls._loaded = True


# The six tag-group fields shown in the composer's right panel, in display order.
GROUP_FIELDS = [
    "visa_applying_for",
    "current_visa_or_greencard_category",
    "primary_consulate",
    "consulates",
    "tags",
    "concerns_or_questions_tags",
]


def vocab_lists() -> dict:
    """The controlled vocabularies for the composer's add-tag autocomplete."""
    _Vocab.load()
    # de-dupe while preserving order
    def _uniq(xs: list[str]) -> list[str]:
        seen, out = set(), []
        for x in xs:
            if x not in seen:
                seen.add(x); out.append(x)
        return out
    return {
        "visa": _uniq(_Vocab._visa_list),
        "consulate": _uniq(_Vocab._consulate_list),
        "consulate_options": _Vocab._consulate_opts,
        "consulate_tree": _Vocab._consulate_tree,  # grouped country → cities (two-part picker)
        "tag": _uniq(_Vocab._tag_list),
        "stage_key": _uniq(_Vocab._stage_list),
        "date_key": _uniq(_Vocab._date_list),
        "outcome": _uniq(_Vocab._outcome_list),
        "country": _uniq(_Vocab._country_list),
        # profile-only vocabularies
        "misc": _uniq(_Vocab._misc_list),                 # 1.3 + 1.10 codes
        "misc_options": _Vocab._misc_options,             # [{code, label='CODE — meaning'}]
        "profile_stage_key": _uniq(_Vocab._profile_stage_list),  # stage keys w/o 1.6
        # key -> value-domain (incl. every form -> 'outcome')
        "stage_value_domains": stage_value_domains_map(),
    }


# key_stages_or_info keys whose VALUE must come from a sub-vocabulary (not free text).
# Forms (1.5) used as keys also constrain their value -> outcome (see stage_value_domain).
STAGE_VALUE_DOMAINS = {
    "citizen_of_country": "country", "born_in_country": "country",
    "resident_of_country": "country", "fiance_of_country": "country",
    "travel_country": "country",
    "consulate_assigned": "consulate",
    "outcome_status": "outcome",
    "visa_type": "visa",
}


def _domain_set(domain: str) -> set[str]:
    _Vocab.load()
    return {
        "country": _Vocab.country, "consulate": _Vocab.consulate,
        "visa": _Vocab.visa, "outcome": _Vocab.outcomes,
    }.get(domain, set())


def stage_value_domain(key: str) -> str | None:
    """Value-domain for a stage key, or None for free text. A FORM key (1.5) -> 'outcome'."""
    if key in STAGE_VALUE_DOMAINS:
        return STAGE_VALUE_DOMAINS[key]
    _Vocab.load()
    return "outcome" if key in _Vocab.form else None


def stage_value_ok(key: str, val: str) -> bool:
    """True if `val` is allowed for stage `key` (free text when key is unconstrained)."""
    domain = stage_value_domain(key)
    return True if not domain else (val in _domain_set(domain))


def stage_value_domains_map() -> dict:
    """Full key -> domain map (incl. every form 1.5 -> 'outcome') for the profile UI."""
    _Vocab.load()
    return {**STAGE_VALUE_DOMAINS, **{f: "outcome" for f in _Vocab._form_list}}


def clean_stages_profile(value) -> dict:
    """Profile key_stages: key in profile_stage_keys (1.7/1.5/1.1/1.3 — NO 1.6) and the
    value satisfies the key's domain (forms -> outcome; *_of_country -> country; ...)."""
    _Vocab.load()
    out: dict = {}
    if isinstance(value, dict):
        for k, v in value.items():
            k, sv = str(k).strip(), str(v).strip()
            if k in _Vocab.profile_stage_keys and sv and stage_value_ok(k, sv):
                out[k] = sv
    return out


def clean_misc_tags(value) -> list[str]:
    """Profile 'miscellaneous tags & topics' — keep only valid 1.3/1.10 codes."""
    _Vocab.load()
    out, seen = [], set()
    if isinstance(value, list):
        for t in value:
            t = str(t).strip()
            if t in _Vocab.misc and t not in seen:
                seen.add(t); out.append(t)
    return out


def _vocab_for(field: str) -> set[str]:
    _Vocab.load()
    if field in ("visa_applying_for", "current_visa_or_greencard_category"):
        return _Vocab.visa
    if field in ("primary_consulate", "consulates"):
        return _Vocab.consulate
    return _Vocab.tag  # tags, concerns_or_questions_tags


# ---------------------------------------------------------------------------
# Gemini tagging engine
# ---------------------------------------------------------------------------

def _master_tags_block() -> str:
    _Vocab.load()
    return (
        "## current_visa_or_greencard_category, visa_applying_for (sections 1.1 + 1.2)\n"
        + ", ".join(_Vocab._visa_list)
        + "\n\n## consulates, primary_consulate (section 1.4)\n"
        + ", ".join(_Vocab._consulate_list)
        + "\n\n## tags, concerns_or_questions_tags (union 1.3,1.5,1.6,1.9,1.10)\n"
        + "# Forms / abbreviations / actions / outcomes (self-explanatory — use exactly as written):\n"
        + ", ".join(_Vocab._tag_plain_list)
        + "\n# Topical / layman concerns (1.10) — pick the tag whose MEANING (after the dash) matches the poster's intent:\n"
        + "\n".join(f"{t} — {d}" if d else t for t, d in _Vocab._misc_pairs)
        + "\n\n## key_stages_or_info keys (section 1.7 + visa/abbr/form/action names)\n"
        + ", ".join(sorted(_Vocab.stage_keys))
        + "\n\n## key_dates keys (section 1.8)\n"
        + ", ".join(_Vocab._date_list)
    )


_SYSTEM_PROMPT = """You are an Immigration Tagging Engine. Read a single candidate posting \
(title + description) about U.S. immigration and return ONE JSON object following the schema. \
Use ONLY tags from the master tag list supplied. NEVER invent new tag strings.

Return ONLY a single JSON object — no prose, no Markdown fences.

# JSON keys to return (all required)
{
  "background_summary": string,                 // 1-3 sentences, factual paraphrase
  "concerns_or_questions_summary": string,      // 1-3 sentences, what is being asked
  "current_visa_or_greencard_category": string[], // present status (1.1/1.2 only)
  "visa_applying_for": string[],                // intended next status (1.1/1.2 only)
  "primary_consulate": string,                  // one 1.4 code or ""
  "consulates": string[],                       // 1.4 codes (includes primary first)
  "tags": string[],                             // background tags (1.3,1.5,1.6,1.9,1.10)
  "concerns_or_questions_tags": string[],       // the active questions (same vocab)
  "principal_country_of_chargeability": string, // ISO-2 or ""
  "employer_type": string,                      // bigtech|consulting|startup|academic|healthcare|government|nonprofit|other|unknown
  "severity": string,                           // critical|high|medium|low
  "resolution_status": string,                  // open|answered|resolved|unknown (default open)
  "derived_topic_cluster": string[],            // 1-3 kebab-case cluster labels
  "key_stages_or_info": object,                 // keys from 1.7; short string values
  "key_dates": object,                          // keys from 1.8; values YYYY-MM-DD
  "language": string,                           // ISO-639-1, default "en"
  "tagging_confidence": number,                 // 0.0..1.0
  "posting_type": string,                       // consular_visa|in_us_status|experience|general_question
  "relevant_sections": string[]                 // which tag sections genuinely apply (see below)
}

# RULES
- Visa/GC codes (H-1B, F-1, EB-2, ...) go ONLY in current_visa_or_greencard_category / visa_applying_for, NEVER in tags.
- Country/city codes (IN, DEL, MX, ...) go ONLY in consulates / primary_consulate, NEVER in tags.
- A tag string appears in at most ONE of: current_visa_or_greencard_category, consulates, tags, concerns_or_questions_tags. (visa_applying_for may share with current_visa_or_greencard_category.)
- A tag goes in concerns_or_questions_tags only if removing it would change what the user is ASKING.
- If a concept has no matching master tag, omit it from the arrays (surface only in the summaries). Do not invent tags.
- For topical/layman (1.10) tags, choose the tag whose description (the text after "—") best matches the poster's intent — not merely a tag whose NAME looks similar. e.g. use "open-for-attorney" when the poster is asking a question they want an attorney to answer; use "lawyer-recommendation" ONLY when they are asking for attorney names/referrals.
- key_dates values MUST be YYYY-MM-DD.

# RELEVANT SECTIONS (act as the immigration expert: decide which tag sections genuinely apply)
Set "posting_type" to the best fit:
  - consular_visa    : applying for / interviewing for a U.S. visa from a consulate abroad
  - in_us_status     : someone already in the USA dealing with their status/benefits
  - experience       : sharing an experience/outcome, NOT asking anything
  - general_question : a general informational question
Set "relevant_sections" to ONLY the sections that apply to THIS posting. Choose from:
  - "visa_applying_for"                     : include when applying for / seeking a visa or status
  - "consulates"                            : include ONLY when a consulate/embassy abroad is involved (consular_visa)
  - "current_visa_or_greencard_category"    : include when the person currently holds a U.S. status / is inside the USA
  - "tags"                                  : include when there are background facts/forms worth tagging
  - "concerns_or_questions_tags"            : include ONLY when the posting ASKS a question or raises a concern — NEVER for a pure experience share
Return ONLY the sections that truly apply (omit the rest). Example: a consular B1/B2 experience share → ["visa_applying_for","consulates","tags"] (no concerns); an in-US H-1B question → ["current_visa_or_greencard_category","tags","concerns_or_questions_tags"] (no consulate sections).

Always capture the applicant's visa/status in current_visa_or_greencard_category and/or visa_applying_for whenever one is discernible.
Populate key_stages_or_info with discrete outcomes/state facts (e.g. visa_status: approved, I-140: approved) and key_dates with any dates mentioned — these become their own UI sections when present.
"""


def _extract(title: str, description: str) -> dict:
    """Call Gemini → canonical (untrusted) tag JSON. Raises on hard failure."""
    user = (
        f"MASTER_TAGS:\n{_master_tags_block()}\n\n"
        f"POSTING TITLE: {title}\n\nPOSTING DESCRIPTION:\n{description}\n\n"
        "Return the JSON object now."
    )
    client = genai.Client(vertexai=True, project=_project(), location=_region())
    cfg_kwargs = dict(
        temperature=0.1,
        max_output_tokens=4096,
        response_mime_type="application/json",
    )
    # Disable "thinking" so the whole output budget goes to the JSON (2.5-flash
    # otherwise spends tokens on reasoning and can truncate the JSON mid-string).
    try:
        cfg_kwargs["thinking_config"] = genai.types.ThinkingConfig(thinking_budget=0)
    except Exception:  # noqa: BLE001 - older SDK without ThinkingConfig
        pass
    resp = client.models.generate_content(
        model=_gemini_model(),
        contents=f"{_SYSTEM_PROMPT}\n\n{user}",
        config=genai.types.GenerateContentConfig(**cfg_kwargs),
    )
    raw = (resp.text or "").strip()
    # tolerate accidental fences
    raw = re.sub(r"^```(?:json)?|```$", "", raw, flags=re.MULTILINE).strip()
    return json.loads(raw)


def _clean_group(field: str, value) -> list[str] | str:
    """Coerce a model/user value to the field's shape and drop out-of-vocab entries."""
    vocab = _vocab_for(field)
    if field == "primary_consulate":
        v = (value or "")
        if isinstance(v, list):
            v = v[0] if v else ""
        v = str(v).strip()
        return v if v in vocab else ""
    items = value if isinstance(value, list) else ([value] if value else [])
    seen: list[str] = []
    for it in items:
        s = str(it).strip()
        if s and s in vocab and s not in seen:
            seen.append(s)
    return seen


def _dedup_buckets(groups: dict) -> dict:
    """Enforce the 5-field rule: a tag appears in at most one of
    current_visa_or_greencard_category | consulates | concerns_or_questions_tags | tags.
    (visa_applying_for may share with current_visa_or_greencard_category.) Earlier
    buckets in this priority order win; the tag is removed from later ones."""
    priority = ["current_visa_or_greencard_category", "consulates",
                "concerns_or_questions_tags", "tags"]
    claimed: set[str] = set()
    for field in priority:
        kept = []
        for t in groups.get(field, []):
            if t not in claimed:
                claimed.add(t); kept.append(t)
        groups[field] = kept
    return groups


def _normalize_groups(groups: dict) -> dict:
    """primary_consulate ∈ consulates, then de-duplicate across buckets."""
    if groups.get("primary_consulate") and groups["primary_consulate"] not in groups.get("consulates", []):
        groups["consulates"] = [groups["primary_consulate"], *groups.get("consulates", [])]
    return _dedup_buckets(groups)


_POSTING_TYPES = {"consular_visa", "in_us_status", "experience", "general_question"}


# UI tag sections (primary_consulate is omitted from the UI — it's derived from
# consulates[0] at submit; consulates is the single consulate section).
_UI_TAG_SECTIONS = [f for f in GROUP_FIELDS if f != "primary_consulate"]


def _clean_stages(value) -> dict:
    """Keep only key_stages_or_info entries with a valid 1.7 key AND a value that
    satisfies the key's value-domain (country/outcome/visa/consulate; free text otherwise)."""
    _Vocab.load()
    out: dict = {}
    if isinstance(value, dict):
        for k, v in value.items():
            k, sv = str(k).strip(), str(v).strip()
            if k in _Vocab.stage_keys and sv and stage_value_ok(k, sv):
                out[k] = sv
    return out


def _clean_dates(value) -> dict:
    """Keep only key_dates entries with a valid 1.8 key and a YYYY-MM-DD value."""
    _Vocab.load()
    out: dict = {}
    if isinstance(value, dict):
        for k, v in value.items():
            k, sv = str(k).strip(), str(v).strip()
            if k in _Vocab.date_keys and _DATE_RE.match(sv):
                out[k] = sv
    return out


def _relevant_sections(extracted: dict, groups: dict) -> list[str]:
    """The model decides which tag sections apply; fall back to a sensible heuristic."""
    raw = extracted.get("relevant_sections")
    sections = [s for s in raw if s in _UI_TAG_SECTIONS] if isinstance(raw, list) else []
    if not sections:
        # Heuristic fallback: show any non-empty section; always allow background tags.
        sections = [f for f in _UI_TAG_SECTIONS if groups.get(f)]
        if "tags" not in sections:
            sections.append("tags")
    # consulate section only makes sense when a consulate is present
    if not groups.get("consulates"):
        sections = [s for s in sections if s != "consulates"]
    # keep canonical display order
    return [f for f in _UI_TAG_SECTIONS if f in sections]


def suggest_tags(title: str, description: str) -> dict:
    """Return controlled-vocab tags grouped by section, plus which sections are
    relevant to THIS posting (expert-curated), the posting type, and the
    detected stages/outcomes and key dates."""
    extracted = _extract(title, description)
    groups: dict = {f: _clean_group(f, extracted.get(f)) for f in GROUP_FIELDS}
    groups = _normalize_groups(groups)
    ptype = extracted.get("posting_type")
    if ptype not in _POSTING_TYPES:
        ptype = ""
    return {
        "groups": groups,
        "relevant_sections": _relevant_sections(extracted, groups),
        "posting_type": ptype,
        "key_stages_or_info": _clean_stages(extracted.get("key_stages_or_info")),
        "key_dates": _clean_dates(extracted.get("key_dates")),
    }


# ---------------------------------------------------------------------------
# Validation (subset of JSON-SCHEMA-FIELD-DICTIONARY §3)
# ---------------------------------------------------------------------------

_ENUM_EMPLOYER = {"bigtech", "consulting", "startup", "academic", "healthcare",
                  "government", "nonprofit", "other", "unknown"}
_ENUM_SEVERITY = {"critical", "high", "medium", "low"}
_ENUM_RESOLUTION = {"open", "answered", "resolved", "unknown"}
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def validate(c: dict) -> list[str]:
    _Vocab.load()
    errs: list[str] = []
    # A visa/status MUST be captured in at least one of the two visa fields.
    if not c.get("current_visa_or_greencard_category") and not c.get("visa_applying_for"):
        errs.append("Capture a visa/status in 'Current status' or 'Visa applying for' before submitting")
    for f in ("current_visa_or_greencard_category", "visa_applying_for"):
        for t in c.get(f, []):
            if t not in _Vocab.visa:
                errs.append(f"{f}: '{t}' not in visa vocab")
    for t in c.get("consulates", []):
        if t not in _Vocab.consulate:
            errs.append(f"consulates: '{t}' not in consulate vocab")
    pc = c.get("primary_consulate", "")
    if pc and pc not in c.get("consulates", []):
        errs.append("primary_consulate must be within consulates")
    for f in ("tags", "concerns_or_questions_tags"):
        for t in c.get(f, []):
            if t not in _Vocab.tag:
                errs.append(f"{f}: '{t}' not in tag vocab")
    # no tag in more than one of these arrays
    buckets = ["current_visa_or_greencard_category", "consulates", "tags", "concerns_or_questions_tags"]
    seen: dict[str, str] = {}
    for f in buckets:
        for t in c.get(f, []):
            if t in seen:
                errs.append(f"tag '{t}' appears in both {seen[t]} and {f}")
            seen[t] = f
    if c.get("employer_type") not in _ENUM_EMPLOYER:
        errs.append("employer_type invalid")
    if c.get("severity") not in _ENUM_SEVERITY:
        errs.append("severity invalid")
    if c.get("resolution_status") not in _ENUM_RESOLUTION:
        errs.append("resolution_status invalid")
    for k, v in (c.get("key_dates") or {}).items():
        if not _DATE_RE.match(str(v)):
            errs.append(f"key_dates['{k}'] not YYYY-MM-DD")
    return errs


# ---------------------------------------------------------------------------
# Build canonical sidecar JSON
# ---------------------------------------------------------------------------

_ADJ = ["calm", "bright", "swift", "lucky", "brave", "quiet", "eager", "kind", "bold", "wise"]
_NOUN = ["falcon", "harbor", "maple", "comet", "river", "cedar", "lark", "delta", "ember", "ridge"]


def _synthetic_handle() -> str:
    return f"{secrets.choice(_ADJ)}-{secrets.choice(_NOUN)}-{secrets.randbelow(9000) + 1000}"


def build_canonical(title: str, description: str, tags: dict,
                    key_stages: dict | None = None, key_dates: dict | None = None,
                    extracted: dict | None = None) -> dict:
    """Assemble the full sidecar JSON. `tags`/`key_stages`/`key_dates` (user-edited)
    override the model; remaining context fields come from `extracted`."""
    ex = extracted or {}
    now = datetime.now(timezone.utc)
    date_str = now.strftime("%Y-%m-%d")
    ts = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    short = secrets.token_hex(4)
    case_id = f"{CHANNEL}-{date_str}-{short}"
    prefix = f"gs://{_bucket_name()}/{date_str}/{CHANNEL}/"

    groups = {f: _clean_group(f, tags.get(f)) for f in GROUP_FIELDS}
    groups = _normalize_groups(groups)
    # primary_consulate is no longer collected in the UI — derive it from the
    # first consulate so the schema/validator stay satisfied.
    if not groups["primary_consulate"] and groups["consulates"]:
        groups["primary_consulate"] = groups["consulates"][0]

    all_tags = (
        groups["current_visa_or_greencard_category"]
        + groups["visa_applying_for"]
        + groups["consulates"]
        + groups["tags"]
        + groups["concerns_or_questions_tags"]
    )
    bg = str(ex.get("background_summary") or "").strip() or "<summary_pending_llm>"
    cq = str(ex.get("concerns_or_questions_summary") or "").strip() or title
    # Prefer the user-edited stages/dates; fall back to the model's extraction.
    stages = _clean_stages(key_stages) or _clean_stages(ex.get("key_stages_or_info"))
    dates = _clean_dates(key_dates) or _clean_dates(ex.get("key_dates"))
    embedding_text = (
        f"{title}. {bg}. {cq}. Tags: {', '.join(all_tags)}. "
        f"Stages: {', '.join(f'{k}:{v}' for k, v in stages.items())}. "
        f"Dates: {', '.join(f'{k}:{v}' for k, v in dates.items())}."
    )

    return {
        "case_id": case_id,
        # provenance
        "ingestion_method": "user_post",
        "source_system": SOURCE_SYSTEM,
        "channel": CHANNEL,
        "source_url": APP_BASE_URL,
        "source_uri": f"{APP_BASE_URL}/case/{case_id}",
        "subreddit": "",
        "author_handle": _synthetic_handle(),
        "full_url": f"{APP_BASE_URL}/case/{case_id}",
        "post_title": title,
        "language": str(ex.get("language") or "en"),
        # timestamps
        "posting_date": date_str,
        "ingestion_timestamp": ts,
        "last_updated_timestamp": ts,
        # quality
        "tagging_confidence": float(ex.get("tagging_confidence") or 0.9),
        "source_metadata": "Submitted via proceedings web composer",
        "gcs_path": prefix,
        # summaries
        "background_summary": bg,
        "concerns_or_questions_summary": cq,
        # 5 sibling tag fields (user-edited)
        "current_visa_or_greencard_category": groups["current_visa_or_greencard_category"],
        "visa_applying_for": groups["visa_applying_for"],
        "primary_consulate": groups["primary_consulate"],
        "consulates": groups["consulates"],
        "tags": groups["tags"],
        "concerns_or_questions_tags": groups["concerns_or_questions_tags"],
        # case context
        "principal_country_of_chargeability": str(ex.get("principal_country_of_chargeability") or ""),
        "employer_type": str(ex.get("employer_type") or "unknown"),
        "severity": str(ex.get("severity") or "low"),
        "resolution_status": str(ex.get("resolution_status") or "open"),
        "derived_topic_cluster": ex.get("derived_topic_cluster") if isinstance(ex.get("derived_topic_cluster"), list) else [],
        # structured kv
        "key_stages_or_info": stages,
        "key_dates": dates,
        # embedding
        "embedding_text": embedding_text,
        # provenance for analytics
        "doc_kind": "post",
        "parent_case_id": "",
        "reddit_post_id": "",
    }


def _markdown_body(title: str, description: str) -> str:
    return f"# {title}\n\n{description}\n"


# ---------------------------------------------------------------------------
# Persist: GCS sidecar → documents.import → BigQuery
# ---------------------------------------------------------------------------

def _write_gcs(canonical: dict, md_body: str) -> tuple[str, str]:
    """Write .md (first) then .json (last) to the date/channel prefix. Returns (md_uri, json_uri)."""
    bucket_name = _bucket_name()
    case_id = canonical["case_id"]
    date_str = canonical["posting_date"]
    base = f"{date_str}/{CHANNEL}/{case_id}"
    client = storage.Client(project=_project())
    bucket = client.bucket(bucket_name)
    bucket.blob(f"{base}.md").upload_from_string(md_body, content_type="text/markdown")
    bucket.blob(f"{base}.json").upload_from_string(
        json.dumps(canonical, ensure_ascii=False, indent=2), content_type="application/json"
    )
    return f"gs://{bucket_name}/{base}.md", f"gs://{bucket_name}/{base}.json"


def _import_to_datastore(canonical: dict, md_uri: str) -> None:
    """Upsert one document (struct_data + .md content) into DS-1 via documents.import."""
    project, location, datastore = _project(), _ds_location(), _datastore()
    doc_client = de.DocumentServiceClient(client_options=ClientOptions(quota_project_id=project))
    parent = (
        f"projects/{project}/locations/{location}/collections/default_collection"
        f"/dataStores/{datastore}/branches/default_branch"
    )
    document = de.Document(
        id=canonical["case_id"],
        struct_data=canonical,
        content=de.Document.Content(mime_type="text/plain", uri=md_uri),
    )
    request = de.ImportDocumentsRequest(
        parent=parent,
        inline_source=de.ImportDocumentsRequest.InlineSource(documents=[document]),
        reconciliation_mode=de.ImportDocumentsRequest.ReconciliationMode.INCREMENTAL,
    )
    op = doc_client.import_documents(request=request)
    op.result(timeout=120)


_BQ_SCHEMA_FIELDS = [
    ("case_id", "STRING"), ("source_system", "STRING"), ("source_uri", "STRING"),
    ("subreddit", "STRING"), ("full_url", "STRING"), ("post_title", "STRING"),
    ("language", "STRING"), ("posting_date", "DATE"), ("ingestion_timestamp", "TIMESTAMP"),
    ("last_updated_timestamp", "TIMESTAMP"), ("tagging_confidence", "FLOAT64"),
    ("gcs_path", "STRING"), ("background_summary", "STRING"),
    ("concerns_or_questions_summary", "STRING"),
    ("current_visa_or_greencard_category", "STRING", "REPEATED"),
    ("visa_applying_for", "STRING", "REPEATED"), ("primary_consulate", "STRING"),
    ("consulates", "STRING", "REPEATED"), ("tags", "STRING", "REPEATED"),
    ("concerns_or_questions_tags", "STRING", "REPEATED"),
    ("principal_country_of_chargeability", "STRING"), ("employer_type", "STRING"),
    ("severity", "STRING"), ("resolution_status", "STRING"),
    ("derived_topic_cluster", "STRING", "REPEATED"), ("key_stages_or_info", "JSON"),
    ("key_dates", "JSON"), ("embedding_text", "STRING"), ("doc_kind", "STRING"),
    ("parent_case_id", "STRING"), ("reddit_post_id", "STRING"), ("pipeline_run_id", "STRING"),
]


def _ensure_bq_table(client, dataset_id: str, table_id: str):
    """Create the postings dataset + postings_metadata table if they don't exist."""
    from google.cloud import bigquery
    from google.api_core.exceptions import NotFound

    try:
        client.get_dataset(dataset_id)
    except NotFound:
        ds = bigquery.Dataset(f"{client.project}.{dataset_id}")
        ds.location = "US"
        client.create_dataset(ds, exists_ok=True)
    try:
        return client.get_table(table_id)
    except NotFound:
        schema = [bigquery.SchemaField(f[0], f[1], mode=(f[2] if len(f) > 2 else "NULLABLE"))
                  for f in _BQ_SCHEMA_FIELDS]
        table = bigquery.Table(table_id, schema=schema)
        table.time_partitioning = bigquery.TimePartitioning(field="posting_date")
        return client.create_table(table, exists_ok=True)


def _pipeline_run_id() -> str:
    """Provenance marker stamped on each BQ row. Defaults to the live web
    composer. Integration tests set POSTING_PIPELINE_RUN_ID=test-e2e so their
    rows are identifiable and bulk-purgeable (see purge_test_bq_rows)."""
    return os.getenv("POSTING_PIPELINE_RUN_ID", "web-composer")


def purge_test_bq_rows(marker_prefix: str = "test-") -> int:
    """Delete BQ rows whose pipeline_run_id starts with `marker_prefix`.

    The `posting_date < CURRENT_DATE()` guard avoids BigQuery's "UPDATE/DELETE
    on recently streamed rows is not allowed" error (insert_rows_json lands rows
    in a streaming buffer for up to ~90 min): same-day test rows are purged on
    the next day's run, so the table never accrues more than one day of markers.
    Returns the affected row count (0 if BQ is unavailable / table absent)."""
    try:
        from google.cloud import bigquery
    except ImportError:
        return 0
    client = bigquery.Client(project=_project())
    table_id = f"{_project()}.postings.postings_metadata"
    sql = (f"DELETE FROM `{table_id}` "
           f"WHERE STARTS_WITH(pipeline_run_id, @marker) "
           f"AND posting_date < CURRENT_DATE()")
    cfg = bigquery.QueryJobConfig(query_parameters=[
        bigquery.ScalarQueryParameter("marker", "STRING", marker_prefix)])
    try:
        job = client.query(sql, job_config=cfg)
        job.result()
        n = job.num_dml_affected_rows or 0
        print(f"posting.purge_test_bq_rows: deleted {n} row(s) (marker={marker_prefix!r})")
        return n
    except Exception as e:  # noqa: BLE001 - cleanup is best-effort
        print(f"posting.purge_test_bq_rows: skipped ({type(e).__name__}: {e})")
        return 0


def _write_bigquery(canonical: dict) -> None:
    """Append a row to postings.postings_metadata (self-provisions dataset+table;
    non-blocking for the user if BQ is unavailable)."""
    try:
        from google.cloud import bigquery  # noqa: F401
    except ImportError:
        print("posting: google-cloud-bigquery not installed; skipping BQ row")
        return
    from google.cloud import bigquery
    client = bigquery.Client(project=_project())
    table_id = f"{_project()}.postings.postings_metadata"
    row = {
        "case_id": canonical["case_id"],
        "source_system": canonical["source_system"],
        "source_uri": canonical["source_uri"],
        "subreddit": canonical["subreddit"],
        "full_url": canonical["full_url"],
        "post_title": canonical["post_title"],
        "language": canonical["language"],
        "posting_date": canonical["posting_date"],
        "ingestion_timestamp": canonical["ingestion_timestamp"],
        "last_updated_timestamp": canonical["last_updated_timestamp"],
        "tagging_confidence": canonical["tagging_confidence"],
        "gcs_path": canonical["gcs_path"],
        "background_summary": canonical["background_summary"],
        "concerns_or_questions_summary": canonical["concerns_or_questions_summary"],
        "current_visa_or_greencard_category": canonical["current_visa_or_greencard_category"],
        "visa_applying_for": canonical["visa_applying_for"],
        "primary_consulate": canonical["primary_consulate"],
        "consulates": canonical["consulates"],
        "tags": canonical["tags"],
        "concerns_or_questions_tags": canonical["concerns_or_questions_tags"],
        "principal_country_of_chargeability": canonical["principal_country_of_chargeability"],
        "employer_type": canonical["employer_type"],
        "severity": canonical["severity"],
        "resolution_status": canonical["resolution_status"],
        "derived_topic_cluster": canonical["derived_topic_cluster"],
        "key_stages_or_info": json.dumps(canonical["key_stages_or_info"]),
        "key_dates": json.dumps(canonical["key_dates"]),
        "embedding_text": canonical["embedding_text"],
        "doc_kind": canonical["doc_kind"],
        "parent_case_id": canonical["parent_case_id"],
        "reddit_post_id": canonical["reddit_post_id"],
        "pipeline_run_id": _pipeline_run_id(),
    }
    try:
        _ensure_bq_table(client, "postings", table_id)
        errors = client.insert_rows_json(table_id, [row])
        if errors:
            print(f"posting: BQ insert errors: {errors}")
    except Exception as e:  # noqa: BLE001 - BQ is non-blocking for the user
        print(f"posting: BQ write skipped ({type(e).__name__}: {e})")


def publish_posting(title: str, description: str, tags: dict,
                    key_stages: dict | None = None, key_dates: dict | None = None) -> dict:
    """Full publish path. Returns {case_id, gcs_path, indexed, author_handle}."""
    # Redact PII (email / phone / A-number) before anything is tagged, written to
    # GCS, indexed, or sent to BigQuery — postings are read by other users, so
    # contact info must never survive into the stored content. Local import
    # avoids a module-load cycle (profile imports posting at top level).
    from profile import scrub_pii
    title = scrub_pii(title or "")
    description = scrub_pii(description or "")

    extracted = None
    try:
        extracted = _extract(title, description)  # for summaries/severity/context
    except Exception as e:  # noqa: BLE001 - fall back to placeholders if the tagger fails
        print(f"posting: extraction for context failed ({e}); using placeholders")

    canonical = build_canonical(title, description, tags, key_stages, key_dates, extracted)
    errs = validate(canonical)
    if errs:
        raise ValueError("; ".join(errs))

    md_uri, _json_uri = _write_gcs(canonical, _markdown_body(title, description))
    _import_to_datastore(canonical, md_uri)
    _write_bigquery(canonical)
    return {
        "case_id": canonical["case_id"],
        "gcs_path": canonical["gcs_path"],
        "indexed": True,
        "author_handle": canonical["author_handle"],
    }


# ---------------------------------------------------------------------------
# Phase-J: experience / connect-card documents (multi-view content; D-041)
#
# A consented profile experience is projected to its OWN searchable DS-1 sidecar
# (doc_kind="experience"), carrying facets ABOUT THE EXPERIENCE (a past event) —
# never the user's current-state tags. The live profile is NEVER imported.
# ---------------------------------------------------------------------------

# milestone label -> the 1.8 date key its date belongs under.
_MILESTONE_DATE_KEY = {
    "visa_interview": "visa_interview_date", "visa_stamping": "visa_stamp_date",
    "port_of_entry": "admission_date", "h1b_filing": "h1b_filed_date",
    "h1b_approval": "h1b_approved_date", "h1b_rfe": "rfe_date",
    "opt_application": "i765_filed_date", "perm_filing": "labor_cert_filed_date",
    "perm_approval": "perm_approved_date", "i140_approval": "i140_approved_date",
    "i485_filing": "i485_filed_date", "biometrics": "biometrics_appointment_date",
    "aos_interview": "aos_appointment_date", "ead_approval": "ead_approved_date",
    "green_card": "green_card_received_date",
    "naturalization_interview": "naturalization_interview_date",
    "oath_ceremony": "oath_ceremony_date", "consular_221g": "221g_issued_date",
}


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (s or "").strip().lower()).strip("_")[:48]


# Interview milestones (consular OR domestic) that earn `visa-interview-experience`.
_INTERVIEW_MILESTONES = {"visa_interview", "aos_interview", "naturalization_interview"}


def _pretty_milestone(m: str) -> str:
    return (m or "milestone").replace("_", " ").strip().title()


def build_experience_canonical(profile: dict, entry: dict, extracted: dict | None = None) -> dict:
    """Build a sidecar canonical for ONE profile experience (doc_kind=experience).
    Facets are extracted from the experience TEXT (about that past event), NOT from
    the user's current profile state."""
    text = str(entry.get("experience") or "").strip()
    milestone = _slug(str(entry.get("milestone") or "milestone"))
    date = normalize_date_safe(str(entry.get("date") or ""))
    title = f"{_pretty_milestone(milestone)} experience"
    if extracted is None:
        try:
            extracted = _extract(title, text)
        except Exception as e:  # noqa: BLE001
            print(f"posting: experience extraction failed ({e}); minimal facets")
            extracted = {}

    key_stages = extracted.get("key_stages_or_info")
    key_dates = dict(_clean_dates(extracted.get("key_dates")))
    dk = _MILESTONE_DATE_KEY.get(milestone)
    if dk and date:
        key_dates[dk] = date

    # Experience tagging rules (phase-J):
    #  1) every experience is tagged `past-experience` (universal) + `experience-posting`;
    #  2) add `timeline` when the experience has any date(s);
    #  3) `visa-interview-experience` for an interview milestone (consular OR domestic);
    #  4) an experience NEVER carries concerns/questions tags.
    tags = {f: extracted.get(f) for f in GROUP_FIELDS}
    tags["concerns_or_questions_tags"] = []                                  # rule 4
    base_tags = list(dict.fromkeys([*(tags.get("tags") or []),
                                    "past-experience", "experience-posting"]))  # rule 1
    if key_dates and "timeline" not in base_tags:                            # rule 2
        base_tags.append("timeline")
    if milestone in _INTERVIEW_MILESTONES and "visa-interview-experience" not in base_tags:  # rule 3
        base_tags.append("visa-interview-experience")
    tags["tags"] = base_tags

    c = build_canonical(title, text, tags, key_stages, key_dates, extracted)
    c["concerns_or_questions_tags"] = []  # belt-and-suspenders for rule 3
    # Re-key as an experience document.
    short = secrets.token_hex(4)
    c["doc_kind"] = "experience"
    c["case_id"] = f"{CHANNEL}-exp-{c['posting_date']}-{short}"
    c["full_url"] = f"https://proceedings.app/case/{c['case_id']}"
    c["post_title"] = title
    c["ingestion_method"] = "user_experience"
    c["source_metadata"] = "User milestone experience (phase-J), consent-shared"
    # Link all of an author's experiences via their synthetic handle (no PII).
    handle = str(profile.get("username") or "").strip() or c["author_handle"]
    c["author_handle"] = handle
    c["parent_case_id"] = handle
    c["derived_topic_cluster"] = list(dict.fromkeys([*(c.get("derived_topic_cluster") or []), milestone]))
    return c


def publish_experience(profile: dict, entry: dict) -> dict:
    """Project one consented experience to a searchable DS-1 sidecar. Returns its id."""
    text = str(entry.get("experience") or "").strip()
    if not text:
        raise ValueError("experience has no text")
    c = build_experience_canonical(profile, entry)
    md_uri, _ = _write_gcs(c, _markdown_body(c["post_title"], text))
    _import_to_datastore(c, md_uri)
    _write_bigquery(c)
    return {"case_id": c["case_id"], "doc_kind": "experience",
            "milestone": entry.get("milestone", ""), "gcs_path": c["gcs_path"], "indexed": True}


def publish_connect_card(profile: dict, note: str = "") -> dict:
    """Publish an explicit 'looking to connect' card (doc_kind=connect_card) from
    the user's CURRENT profile state. The user publishes it deliberately, so its
    facets are the profile's current status (this is content, not the profile doc)."""
    handle = str(profile.get("username") or "").strip() or _synthetic_handle()
    tags = {f: profile.get(f) for f in GROUP_FIELDS}
    state = ", ".join(profile.get("current_visa_or_greencard_category")
                      or profile.get("visa_applying_for") or ["immigration"])
    title = f"Looking to connect — {state}"
    body = str(note or "").strip() or f"{handle} is looking to connect with others on a similar journey ({state})."
    extracted = {
        "background_summary": str(profile.get("background_text") or "")[:400] or "User looking to connect.",
        "concerns_or_questions_summary": "Looking to connect with others in the same situation.",
        "key_stages_or_info": profile.get("key_stages_or_info") or {},
        "key_dates": profile.get("key_dates") or {},
    }
    c = build_canonical(title, body, tags, profile.get("key_stages_or_info"),
                        profile.get("key_dates"), extracted)
    short = secrets.token_hex(4)
    c["doc_kind"] = "connect_card"
    c["case_id"] = f"{CHANNEL}-connect-{c['posting_date']}-{short}"
    c["full_url"] = f"https://proceedings.app/case/{c['case_id']}"
    c["post_title"] = title
    c["ingestion_method"] = "user_connect_card"
    c["source_metadata"] = "Connect card (phase-J), user-published"
    c["author_handle"] = handle
    c["parent_case_id"] = handle
    md_uri, _ = _write_gcs(c, _markdown_body(title, body))
    _import_to_datastore(c, md_uri)
    _write_bigquery(c)
    return {"case_id": c["case_id"], "doc_kind": "connect_card", "gcs_path": c["gcs_path"], "indexed": True}


def delete_content(case_id: str) -> None:
    """Delete a published content doc (experience/connect-card/post) from the
    datastore + its GCS sidecars. Best-effort; safe to call if already gone."""
    from google.api_core.exceptions import NotFound
    project, loc, ds = _project(), _ds_location(), _datastore()
    try:
        doc_client = de.DocumentServiceClient(client_options=ClientOptions(quota_project_id=project))
        name = (f"projects/{project}/locations/{loc}/collections/default_collection"
                f"/dataStores/{ds}/branches/default_branch/documents/{case_id}")
        doc_client.delete_document(name=name)
    except NotFound:
        pass
    except Exception as e:  # noqa: BLE001
        print(f"posting.delete_content: datastore delete failed ({e})")
    m = re.search(r"(\d{4}-\d{2}-\d{2})", case_id)
    if m:
        base = f"{m.group(1)}/{CHANNEL}/{case_id}"
        try:
            bkt = storage.Client(project=project).bucket(_bucket_name())
            for ext in (".md", ".json"):
                bkt.blob(f"{base}{ext}").delete()
        except Exception as e:  # noqa: BLE001
            print(f"posting.delete_content: gcs delete best-effort ({e})")


def normalize_date_safe(value: str) -> str:
    """Best-effort YYYY-MM-DD (delegates to profile.normalize_date if importable)."""
    v = (value or "").strip()
    if _DATE_RE.match(v):
        return v
    try:
        import profile as _p
        return _p.normalize_date(v)
    except Exception:  # noqa: BLE001
        return ""
