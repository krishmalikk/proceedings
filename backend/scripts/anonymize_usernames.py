"""
anonymize_usernames.py — one-time migration: replace legacy real-name/email
usernames with random Reddit-style handles, and scrub the old handle everywhere
it was frozen into already-published content at publish time.

Background
----------
Historically a new user's profile `username` was seeded from their Firebase
display name / email prefix (real name). That username string then got copied,
at publish time, into published content as `author_handle` (and, for experiences
& connect cards, also `parent_case_id`). Regular postings were always anonymous
(synthetic `_synthetic_handle()`), so they need no scrub.

This migration, per user whose `username` is NOT already an anonymous handle
(see `profile.is_anonymous_handle`):

  1. users/{uid}.username            → a fresh unique handle
  2. Firestore `replies`  (user_id == uid)                 .author_handle → new
  3. Firestore `groups/*/messages` (author_uid == uid)     .author_handle → new
  4. Vertex datastore experience + connect_card docs        author_handle
     AND parent_case_id → new   (+ rewrite the GCS .json sidecar, and the .md
     body when it embedded the handle), then re-import (idempotent upsert on
     the stable case_id — INCREMENTAL reconciliation overwrites in place).
  5. BigQuery postings_metadata.parent_case_id → new for those docs.

Steps 2 and 3 join by the stable uid (unambiguous). Steps 4/5 can only join the
datastore/BQ rows by the handle STRING (those docs carry no uid) — with one
exception: experiences are also linked from users/{uid}.journey[].experience_case_id,
so we rewrite those by exact case_id (unambiguous, even under a handle clash).
Connect cards have no such back-link: if two legacy real names were identical we
cannot tell their cards apart, so we skip those and log them for manual review.

Idempotent: already-anonymous usernames are skipped, and the datastore upsert is
keyed by case_id, so re-running is a no-op / safe.

RUN (from backend/):
    python scripts/anonymize_usernames.py --dry-run    # log planned changes only
    python scripts/anonymize_usernames.py              # apply
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict

_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _BACKEND)

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(_BACKEND, ".env"))

import posting  # noqa: E402
import profile as profile_mod  # noqa: E402
import search_client  # noqa: E402
from google.cloud import discoveryengine_v1 as de  # noqa: E402
from google.cloud import firestore  # noqa: E402
from google.cloud import storage  # noqa: E402
from google.cloud.firestore_v1.base_query import FieldFilter  # noqa: E402

_SCRUB_DOC_KINDS = {"experience", "connect_card"}


def _safe(fn, label: str, counters: dict):
    """Run fn best-effort; tally success/failure. Returns fn()'s value or None."""
    try:
        val = fn()
        counters[label] = counters.get(label, 0) + 1
        return val
    except Exception as e:  # noqa: BLE001 — a single-doc failure must not abort the sweep
        counters[f"{label}_fail"] = counters.get(f"{label}_fail", 0) + 1
        if counters.get(f"{label}_fail", 0) <= 5:
            print(f"     ! {label} failed: {e}")
        return None


# ---------------------------------------------------------------------------
# Plan: which users get renamed, to what
# ---------------------------------------------------------------------------

def _plan_renames(db) -> tuple[list[dict], dict]:
    """Return (renames, old_to_new). Each rename: {uid, old, new, exp_case_ids}.
    `old_to_new[old]` is the set of new handles it maps to (>1 ⇒ ambiguous)."""
    used: set[str] = set()  # new handles minted this run (avoid intra-run clashes)
    renames: list[dict] = []
    old_to_new: dict[str, set[str]] = defaultdict(set)

    for snap in db.collection("users").stream():
        uid = snap.id
        data = snap.to_dict() or {}
        old = str(data.get("username") or "").strip()
        if profile_mod.is_anonymous_handle(old):
            continue  # already an anonymous / seed-roster handle
        # Mint a fresh handle unique against existing users AND this run's picks.
        new = profile_mod.random_username(db)
        while new in used:
            new = profile_mod.random_username(db)
        used.add(new)
        exp_ids = [str(e.get("experience_case_id") or "").strip()
                   for e in (data.get("journey") or [])
                   if str(e.get("experience_case_id") or "").strip()]
        renames.append({"uid": uid, "old": old, "new": new, "exp_case_ids": exp_ids})
        old_to_new[old].add(new)

    return renames, old_to_new


# ---------------------------------------------------------------------------
# Firestore: replies + group messages (join by uid — unambiguous)
# ---------------------------------------------------------------------------

def _rewrite_replies(db, uid: str, new: str, dry: bool, counters: dict):
    q = db.collection("replies").where(filter=FieldFilter("user_id", "==", uid))
    for d in q.stream():
        if (d.to_dict() or {}).get("author_handle") == new:
            continue
        if dry:
            counters["reply"] = counters.get("reply", 0) + 1
            continue
        _safe(lambda ref=d.reference: ref.update({"author_handle": new}), "reply", counters)


def _rewrite_messages(db, uid: str, new: str, dry: bool, counters: dict):
    for group in db.collection("groups").stream():
        msgs = (db.collection("groups").document(group.id).collection("messages")
                .where(filter=FieldFilter("author_uid", "==", uid)))
        for d in msgs.stream():
            if (d.to_dict() or {}).get("author_handle") == new:
                continue
            if dry:
                counters["message"] = counters.get("message", 0) + 1
                continue
            _safe(lambda ref=d.reference: ref.update({"author_handle": new}), "message", counters)


# ---------------------------------------------------------------------------
# Vertex datastore + GCS sidecars (join by handle string / exact case_id)
# ---------------------------------------------------------------------------

def _scan_datastore(project, location, datastore) -> dict:
    """One pass over the branch. Returns case_id → {handle, doc_kind, uri, struct}
    for every experience/connect_card doc that carries an author_handle."""
    dc = de.DocumentServiceClient(
        client_options=search_client.ClientOptions(quota_project_id=project))
    parent = (f"projects/{project}/locations/{location}/collections/default_collection"
              f"/dataStores/{datastore}/branches/default_branch")
    out: dict[str, dict] = {}
    for doc in dc.list_documents(request=de.ListDocumentsRequest(parent=parent, page_size=100)):
        meta = search_client._struct_to_dict(doc.struct_data)
        if str(meta.get("doc_kind") or "") not in _SCRUB_DOC_KINDS:
            continue
        handle = str(meta.get("author_handle") or "").strip()
        if not handle:
            continue
        out[doc.id] = {"handle": handle, "doc_kind": meta.get("doc_kind"),
                       "uri": doc.content.uri or meta.get("gcs_path") or "", "struct": meta}
    return out, dc, parent


def _rewrite_ds_doc(entry: dict, case_id: str, new: str, old: str,
                    bucket, project: str, dry: bool, counters: dict):
    canonical = dict(entry["struct"])
    canonical["author_handle"] = new
    if str(canonical.get("parent_case_id") or "") == old:
        canonical["parent_case_id"] = new
    # The .md body embeds the handle only for connect cards; rewrite it when so.
    new_md = None
    uri = entry["uri"]
    if uri.startswith("gs://"):
        try:
            bkt_name, blob_path = uri[len("gs://"):].split("/", 1)
            body = storage.Client(project=project).bucket(bkt_name).blob(blob_path).download_as_text()
            if old and old in body:
                new_md = body.replace(old, new)
        except Exception as e:  # noqa: BLE001 — body rewrite is best-effort
            print(f"     ! body read {case_id}: {e}")
    if dry:
        kind = entry["doc_kind"]
        counters[f"ds_{kind}"] = counters.get(f"ds_{kind}", 0) + 1
        return

    def _apply():
        base = f"{canonical['posting_date']}/{posting.CHANNEL}/{case_id}"
        blob_base = bucket.blob(f"{base}.json")
        blob_base.upload_from_string(
            json.dumps(canonical, ensure_ascii=False, indent=2), content_type="application/json")
        md_uri = uri or f"gs://{bucket.name}/{base}.md"
        if new_md is not None:
            bucket.blob(f"{base}.md").upload_from_string(new_md, content_type="text/markdown")
        posting._import_to_datastore(canonical, md_uri)

    _safe(_apply, f"ds_{entry['doc_kind']}", counters)


# ---------------------------------------------------------------------------
# BigQuery: postings_metadata.parent_case_id
# ---------------------------------------------------------------------------

def _bq_update(project: str, *, old: str | None = None, new: str = "",
               case_ids: list[str] | None = None, dry: bool, counters: dict):
    """Set parent_case_id=new either WHERE parent_case_id=old (unambiguous handle)
    or WHERE case_id IN case_ids (precise, for ambiguous handles)."""
    if dry:
        counters["bq_update"] = counters.get("bq_update", 0) + 1
        return
    try:
        from google.cloud import bigquery
    except ImportError:
        return
    table = f"{project}.postings.postings_metadata"
    if case_ids:
        sql = (f"UPDATE `{table}` SET parent_case_id=@new "
               f"WHERE case_id IN UNNEST(@ids) AND posting_date < CURRENT_DATE()")
        params = [bigquery.ArrayQueryParameter("ids", "STRING", case_ids),
                  bigquery.ScalarQueryParameter("new", "STRING", new)]
    else:
        sql = (f"UPDATE `{table}` SET parent_case_id=@new "
               f"WHERE parent_case_id=@old AND doc_kind IN ('experience','connect_card') "
               f"AND posting_date < CURRENT_DATE()")
        params = [bigquery.ScalarQueryParameter("old", "STRING", old),
                  bigquery.ScalarQueryParameter("new", "STRING", new)]

    def _run():
        client = bigquery.Client(project=project)
        client.query(sql, job_config=bigquery.QueryJobConfig(query_parameters=params)).result()

    _safe(_run, "bq_update", counters)


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser(description="Anonymize legacy real-name usernames.")
    ap.add_argument("--dry-run", action="store_true", help="log planned changes; write nothing")
    args = ap.parse_args()
    dry = args.dry_run

    project = posting._project()
    location, datastore = posting._ds_location(), posting._datastore()
    db = firestore.Client(project=project)
    counters: dict = {}

    mode = "DRY-RUN (no writes)" if dry else "APPLY"
    print(f"anonymize_usernames — {mode} — project={project}\n")

    renames, old_to_new = _plan_renames(db)
    if not renames:
        print("No legacy usernames found — every profile already uses an anonymous handle.")
        return 0

    ambiguous = {old for old, news in old_to_new.items() if len(news) > 1}
    for old in sorted(ambiguous):
        print(f"  ⚠ ambiguous handle {old!r} maps to {len(old_to_new[old])} users — "
              f"connect cards for it will be SKIPPED (manual review).")

    print(f"\nRenaming {len(renames)} user(s):")
    for r in renames:
        print(f"  {r['uid']}: {r['old']!r} → {r['new']}")

    # Datastore scan once (skip entirely in the rare all-BQ-unavailable case is fine —
    # errors are caught per doc).
    ds_index: dict = {}
    dc = parent = None
    try:
        ds_index, dc, parent = _scan_datastore(project, location, datastore)
        print(f"\nDatastore: {len(ds_index)} experience/connect doc(s) in scope.")
    except Exception as e:  # noqa: BLE001
        print(f"\n! datastore scan failed ({e}); Firestore steps still proceed.")

    bucket = storage.Client(project=project).bucket(posting._bucket_name())

    for r in renames:
        uid, old, new, exp_ids = r["uid"], r["old"], r["new"], r["exp_case_ids"]

        # 1. Profile username
        if not dry:
            _safe(lambda: db.collection("users").document(uid).update(
                {"username": new, "updated_at": firestore.SERVER_TIMESTAMP}), "user", counters)
        else:
            counters["user"] = counters.get("user", 0) + 1

        # 2 + 3. Firestore replies + group messages (by uid — always safe)
        _rewrite_replies(db, uid, new, dry, counters)
        _rewrite_messages(db, uid, new, dry, counters)

        # 4. Datastore docs.
        #    (a) Experiences by exact case_id from the journey (unambiguous).
        rewritten: set[str] = set()
        for cid in exp_ids:
            entry = ds_index.get(cid)
            if entry:
                _rewrite_ds_doc(entry, cid, new, old, bucket, project, dry, counters)
                rewritten.add(cid)
        #    (b) Remaining docs (connect cards + stray experiences) by handle string,
        #        only when the old handle is unambiguous.
        if old not in ambiguous:
            for cid, entry in ds_index.items():
                if cid in rewritten or entry["handle"] != old:
                    continue
                _rewrite_ds_doc(entry, cid, new, old, bucket, project, dry, counters)
                rewritten.add(cid)

        # 5. BigQuery parent_case_id.
        if old not in ambiguous:
            _bq_update(project, old=old, new=new, dry=dry, counters=counters)
        elif exp_ids:
            # Ambiguous handle: only the precisely-identified experiences.
            _bq_update(project, new=new, case_ids=exp_ids, dry=dry, counters=counters)

    print("\nSummary:")
    for k in sorted(counters):
        print(f"  {k}: {counters[k]}")
    if dry:
        print("\n(dry-run — nothing was written)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
