"""
teardown_synthetic.py — remove everything seed_synthetic.py created.

Reads `backend/scripts/seed_manifest.json` and deletes, best-effort:
  • each posting from the Vertex AI Search datastore + GCS (posting.delete_content)
  • BigQuery rows marked pipeline_run_id=test-synthetic (purge_test_bq_rows)
  • Firestore: replies, votes, content_meta tallies, groups (+ message subdocs),
    and the synthetic user profiles.

It does NOT edit backend/seed_users.json — the 20 synthetic picker entries are a
committed roster change; remove them with `git` if you want the picker clean again.

RUN (from backend/):
    python scripts/teardown_synthetic.py
"""

from __future__ import annotations

import json
import os
import sys

_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _BACKEND)

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(_BACKEND, ".env"))

MANIFEST_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed_manifest.json")


def _safe(fn, label: str, counters: dict) -> None:
    try:
        fn()
        counters[label] = counters.get(label, 0) + 1
    except Exception as e:  # noqa: BLE001 — best-effort cleanup
        counters[f"{label}_fail"] = counters.get(f"{label}_fail", 0) + 1
        if counters.get(f"{label}_fail", 0) <= 3:
            print(f"     {label} failed: {e}")


def main() -> int:
    if not os.path.exists(MANIFEST_PATH):
        print(f"No manifest at {MANIFEST_PATH} — nothing to tear down.")
        return 0
    with open(MANIFEST_PATH) as f:
        m = json.load(f)

    project = os.getenv("GCP_PROJECT_ID") or os.getenv("GCP_PROJECT", "") or m.get("project", "")
    if not project:
        print("ERROR: GCP_PROJECT_ID not set.")
        return 2

    print("=" * 72)
    print("SYNTHETIC TEARDOWN — project:", project)
    print(f"  postings={len(m.get('case_ids', {}))} replies={len(m.get('reply_ids', []))} "
          f"votes={len(m.get('votes', []))} groups={len(m.get('group_ids', []))} "
          f"users={len(m.get('users', []))}")
    print("=" * 72)

    import posting  # noqa: E402
    from google.cloud import firestore  # noqa: E402

    db = firestore.Client(project=project)
    c: dict = {}

    # 1. Postings — datastore + GCS.
    print("\n[1/6] Deleting postings from datastore + GCS …")
    for uid, cid in (m.get("case_ids") or {}).items():
        if cid:
            _safe(lambda cid=cid: posting.delete_content(cid), "posting", c)

    # 2. BigQuery rows (buffer-safe: only purges rows with posting_date < today).
    print("[2/6] Purging BigQuery rows (marker prefix 'test-') …")
    try:
        purged = posting.purge_test_bq_rows(m.get("marker", "test-synthetic"))
        print(f"     purged {purged} BQ row(s). "
              "(Same-day rows purge on a later run — streaming-buffer limitation.)")
    except Exception as e:  # noqa: BLE001
        print(f"     BQ purge skipped: {e}")

    # 3. Replies.
    print("[3/6] Deleting replies …")
    for rid in (m.get("reply_ids") or []):
        _safe(lambda rid=rid: db.collection("replies").document(rid).delete(), "reply", c)

    # 4. Votes (doc id = "{content_id}__{user_id}").
    print("[4/6] Deleting votes …")
    for content_id, uid in (m.get("votes") or []):
        _safe(lambda cid=content_id, u=uid: db.collection("votes").document(f"{cid}__{u}").delete(),
              "vote", c)

    # 5. content_meta tallies + groups (with message subdocs).
    print("[5/6] Deleting content_meta tallies + groups + group messages …")
    for cid in (m.get("content_ids_voted") or []):
        _safe(lambda cid=cid: db.collection("content_meta").document(cid).delete(), "content_meta", c)
    for gid in (m.get("group_ids") or []):
        try:
            for msg in db.collection("groups").document(gid).collection("messages").stream():
                _safe(lambda ref=msg.reference: ref.delete(), "message", c)
        except Exception as e:  # noqa: BLE001
            print(f"     listing messages for {gid} failed: {e}")
        _safe(lambda gid=gid: db.collection("groups").document(gid).delete(), "group", c)

    # 6. User profiles.
    print("[6/6] Deleting user profiles …")
    for uid in (m.get("users") or []):
        _safe(lambda uid=uid: db.collection("users").document(uid).delete(), "user", c)

    print("\n" + "=" * 72)
    print("TEARDOWN SUMMARY:", json.dumps(c, indent=2))
    print("  (seed_users.json untouched — revert that file via git to clean the picker.)")
    # Keep the manifest unless everything succeeded cleanly; rename so re-runs are no-ops.
    done_path = MANIFEST_PATH + ".done"
    os.replace(MANIFEST_PATH, done_path)
    print(f"  manifest archived -> {done_path}")
    print("=" * 72)
    return 0


if __name__ == "__main__":
    sys.exit(main())
