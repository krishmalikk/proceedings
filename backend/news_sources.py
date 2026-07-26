"""
news_sources.py — Firestore-backed, deploy-free registry of government/
law-firm news sources.

See docs/ingestion/GOV-NEWS-INGESTION-PLAN.md §4 for the original design,
and docs/ingestion/GOV-NEWS-MULTI-SOURCE-CONFIG.md for why this moved from
a hardcoded Python dict to Firestore.

Sources live in the `news_sources` Firestore collection (one document per
source, document id = slug) — NOT in this file. Adding a new source is a
Firestore write (via scripts/curation/manage_news_sources.py), not a code
change and not a deploy: gov_news_poll.py's poll_all() calls
get_enabled_sources() fresh at the start of every run, so a newly-added
source is picked up automatically the next time the scheduled job fires.

`content_license` is the one field that must never be assumed — see §4.2 of
the plan doc. `public_domain` (federal government works, 17 U.S.C. § 105)
must be independently confirmed per source, not inherited from any other
entry. A `copyrighted` source needs the Reddit-style paraphrase posture
(D-017), which this pipeline does not implement yet — get_enabled_sources()
deliberately excludes (with a loud warning, not a silent skip) any source
whose content_license isn't "public_domain", so a misconfigured entry can
never silently start verbatim-storing copyrighted content.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

REQUIRED_FIELDS = {
    "display_name", "site_url", "fetch_method", "feed_url",
    "source_category", "content_license", "channel",
}

# The only content_license this pipeline is actually safe to run
# unattended for — see the module docstring and GOV-NEWS-INGESTION-PLAN.md
# §4.2. Anything else is excluded from get_enabled_sources() regardless of
# its `enabled` flag.
_SAFE_TO_AUTOMATE_LICENSE = "public_domain"

_COLLECTION = "news_sources"


def _db():
    from google.cloud import firestore
    project = os.getenv("GCP_PROJECT_ID") or os.getenv("GCP_PROJECT", "")
    return firestore.Client(project=project)


def list_all_sources() -> dict[str, dict]:
    """Every configured source, including disabled ones and any with a
    content_license this pipeline can't safely automate yet — for the
    management CLI's listing. Use get_enabled_sources() for the poll job."""
    docs = _db().collection(_COLLECTION).stream()
    return {d.id: d.to_dict() for d in docs}


def get_enabled_sources() -> dict[str, dict]:
    """Sources the poll job should actually process this run: `enabled` is
    not False, all required fields present, and content_license is
    "public_domain" — the one license this pipeline is safe to automate
    without a human review step. Read fresh from Firestore on every call
    (no caching), so a config change is visible on the very next poll run,
    scheduled or manual, with no restart or redeploy needed."""
    out: dict[str, dict] = {}
    for slug, cfg in list_all_sources().items():
        if cfg.get("enabled") is False:
            continue
        missing = REQUIRED_FIELDS - set(cfg)
        if missing:
            print(f"news_sources: skipping {slug!r} — missing required field(s): {sorted(missing)}")
            continue
        if cfg.get("content_license") != _SAFE_TO_AUTOMATE_LICENSE:
            print(f"news_sources: skipping {slug!r} — content_license={cfg.get('content_license')!r} "
                  f"is not automatable yet (only {_SAFE_TO_AUTOMATE_LICENSE!r} is); "
                  f"see GOV-NEWS-INGESTION-PLAN.md §4.2")
            continue
        out[slug] = cfg
    return out


def get_source(slug: str) -> dict | None:
    snap = _db().collection(_COLLECTION).document(slug).get()
    return snap.to_dict() if snap.exists else None


def upsert_source(slug: str, **fields) -> None:
    """Create or update a source. Only touches the fields passed — an
    upsert, not a full replace, so e.g. `set_enabled()` doesn't clobber
    everything else. Stamps created_at (once) / updated_at (always)."""
    now = datetime.now(timezone.utc).isoformat()
    ref = _db().collection(_COLLECTION).document(slug)
    existing = ref.get()
    payload = dict(fields)
    payload["updated_at"] = now
    if not existing.exists:
        payload["created_at"] = now
    ref.set(payload, merge=True)


def set_enabled(slug: str, enabled: bool) -> None:
    upsert_source(slug, enabled=enabled)


def remove_source(slug: str) -> bool:
    """Hard delete. Returns False if the slug didn't exist."""
    ref = _db().collection(_COLLECTION).document(slug)
    if not ref.get().exists:
        return False
    ref.delete()
    return True
