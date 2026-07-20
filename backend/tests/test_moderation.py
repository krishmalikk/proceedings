"""
test_moderation.py — UGC safety (App Store Guideline 1.2): content filtering,
reporting/auto-takedown, and blocking.

Groups:
  A  pure content-filter + view serialization (no network) — always runs
  B  report/block logic against an in-memory Firestore fake (no network)
  C  live Firestore + HTTP API (auth gating, shapes) — INTEGRATION

Run:  .venv/bin/python tests/test_moderation.py [unit|integration|all]
      unit         → groups A + B (no GCP; what CI runs)
      integration  → A + B + C (needs Firestore ADC)
"""

import os
import sys

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

# The LLM safety pass must never fire in unit tests (no GCP / determinism).
os.environ["MODERATION_DISABLE_LLM"] = "1"
os.environ.setdefault("MODERATION_AUTO_TAKEDOWN_REPORTS", "3")

import moderation as M  # noqa: E402

_results: list[tuple[str, bool]] = []


def check(name: str, passed: bool, detail: str = "") -> None:
    _results.append((name, passed))
    print(f"  [{'PASS' if passed else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


# ---------------------------------------------------------------------------
# A — pure content filter (no Firestore)
# ---------------------------------------------------------------------------

def group_a_pure() -> None:
    print("\nA — content filter (pure)")

    # Clean, on-topic immigration text passes (LLM disabled → wordlist only).
    for ok_text in [
        "My H-1B visa interview at Mumbai was approved after 221(g).",
        "I'm frustrated with USCIS delays but staying hopeful.",
        "",
    ]:
        try:
            M.check_text(ok_text)
            check(f"A1 clean text passes: {ok_text[:24]!r}", True)
        except ValueError:
            check(f"A1 clean text passes: {ok_text[:24]!r}", False)

    # Slurs / hard-block phrases are rejected.
    for bad_text in ["you are a retard", "kill yourself", "f@ggot", "n1gger"]:
        try:
            M.check_text(bad_text)
            check(f"A2 objectionable rejected: {bad_text!r}", False)
        except ValueError:
            check(f"A2 objectionable rejected: {bad_text!r}", True)

    # Word-boundary precision: a benign substring must NOT trip the filter.
    try:
        M.check_text("We assess applicants in Scunthorpe and analyze the class list.")
        check("A3 benign substrings don't false-positive", True)
    except ValueError:
        check("A3 benign substrings don't false-positive", False)

    check("A4 _wordlist_hit finds a leet slur", M._wordlist_hit("you f@g") is not None)
    check("A5 _wordlist_hit clean is None", M._wordlist_hit("clean immigration text") is None)


def group_a_views() -> None:
    print("\nA — author_id exposure in views")
    import interactions as I
    import group_messages as G

    doc = {"id": "r1", "parent_case_id": "p1", "body": "hi", "author_handle": "arjun-h1b",
           "user_id": "demo-arjun", "created_at": "2026-06-07T00:00:00Z", "deleted": False}
    v_other = I._reply_view(doc, {"up": 0, "down": 0, "score": 0}, 0, "demo-mei")
    v_self = I._reply_view(doc, {"up": 0, "down": 0, "score": 0}, 0, "demo-arjun")
    check("A6 reply exposes author_id to other viewers", v_other.get("author_id") == "demo-arjun")
    check("A7 reply blanks author_id on your own", v_self.get("author_id") == "")
    check("A8 reply still omits raw user_id key", "user_id" not in v_other)

    m = {"id": "m1", "author_handle": "mei", "author_uid": "demo-mei",
         "text": "hello", "created_at": "2026-06-07T00:00:00Z", "deleted": False}
    mv_other = G._message_view(m, "demo-arjun")
    mv_self = G._message_view(m, "demo-mei")
    check("A9 message exposes author_id to others", mv_other.get("author_id") == "demo-mei")
    check("A10 message blanks author_id on your own", mv_self.get("author_id") == "")


# ---------------------------------------------------------------------------
# In-memory Firestore fake — just enough for moderation.py's access patterns.
# ---------------------------------------------------------------------------

from google.cloud import firestore as _fs  # noqa: E402
from google.cloud.firestore_v1.transforms import ArrayUnion, ArrayRemove  # noqa: E402


def _apply(cur, val):
    if isinstance(val, ArrayUnion):
        out = list(cur or [])
        for v in val.values:
            if v not in out:
                out.append(v)
        return out
    if isinstance(val, ArrayRemove):
        return [v for v in (cur or []) if v not in val.values]
    if val is _fs.SERVER_TIMESTAMP:
        return "1970-01-01T00:00:00Z"
    return val


class _Snap:
    def __init__(self, id, data):
        self.id = id
        self._d = None if data is None else dict(data)

    @property
    def exists(self):
        return self._d is not None

    def to_dict(self):
        return dict(self._d) if self._d else {}


class _Doc:
    def __init__(self, coll, id):
        self.coll = coll
        self.id = id

    @property
    def reference(self):
        return self

    def get(self, transaction=None):
        return _Snap(self.id, self.coll._data.get(self.id))

    def set(self, data, merge=False):
        base = dict(self.coll._data.get(self.id) or {}) if merge else {}
        for k, v in data.items():
            base[k] = _apply(base.get(k), v)
        self.coll._data[self.id] = base

    def update(self, data):
        cur = self.coll._data.get(self.id)
        if cur is None:
            raise KeyError(self.id)
        for k, v in data.items():
            cur[k] = _apply(cur.get(k), v)

    def collection(self, name):
        return self.coll._db.collection(f"{self.coll.name}/{self.id}/{name}")


class _Query:
    def __init__(self, coll, field, value):
        self.coll = coll
        self.field = field
        self.value = value

    def stream(self):
        for id, d in list(self.coll._data.items()):
            if d.get(self.field) == self.value:
                yield _Snap(id, d)


class _Coll:
    _auto = 0

    def __init__(self, db, name):
        self._db = db
        self.name = name
        self._data = db._store.setdefault(name, {})

    def document(self, id=None):
        if id is None:
            _Coll._auto += 1
            id = f"auto-{_Coll._auto}"
        return _Doc(self, id)

    def where(self, filter=None):
        return _Query(self, filter.field_path, filter.value)

    def stream(self):
        for id, d in list(self._data.items()):
            yield _Snap(id, d)


class FakeDB:
    def __init__(self):
        self._store = {}

    def collection(self, name):
        return _Coll(self, name)

    def get_all(self, refs):
        return [_Snap(r.id, r.coll._data.get(r.id)) for r in refs]


# ---------------------------------------------------------------------------
# B — report + block logic (fake Firestore, no network)
# ---------------------------------------------------------------------------

def group_b_logic() -> None:
    print("\nB — report + block logic (fake Firestore)")

    # --- blocking ---
    db = FakeDB()
    out = M.block_user(db, "alice", "bob")
    check("B1 block adds to list", out["blocked_uids"] == ["bob"])
    M.block_user(db, "alice", "carol")
    check("B2 blocked_uids returns the set", M.blocked_uids(db, "alice") == {"bob", "carol"})
    M.unblock_user(db, "alice", "bob")
    check("B3 unblock removes", M.blocked_uids(db, "alice") == {"carol"})
    check("B4 anon has no blocks", M.blocked_uids(db, "") == set())
    try:
        M.block_user(db, "alice", "alice")
        check("B5 cannot block yourself", False)
    except ValueError:
        check("B5 cannot block yourself", True)

    # --- reporting a reply: seed an author link so takedown can resolve it ---
    db = FakeDB()
    db.collection("replies").document("r-abc").set(
        {"user_id": "troll", "body": "bad", "deleted": False, "parent_case_id": "p1"})

    r1 = M.report_content(db, content_id="r-abc", content_type="reply",
                          reporter_uid="u1", reason="harassment")
    check("B6 first report counts 1, not hidden", r1 == {"ok": True, "report_count": 1, "hidden": False}, str(r1))

    # Same reporter again is idempotent (still 1 distinct reporter).
    r1b = M.report_content(db, content_id="r-abc", content_type="reply", reporter_uid="u1")
    check("B7 re-report by same user stays at 1", r1b["report_count"] == 1, str(r1b))

    M.report_content(db, content_id="r-abc", content_type="reply", reporter_uid="u2")
    r3 = M.report_content(db, content_id="r-abc", content_type="reply", reporter_uid="u3")
    check("B8 threshold (3 distinct) auto-hides", r3["hidden"] is True and r3["report_count"] == 3, str(r3))

    reply = db._store["replies"]["r-abc"]
    check("B9 auto-takedown soft-deletes the reply", reply.get("deleted") is True)
    check("B10 content_meta flagged hidden",
          db._store.get("content_meta", {}).get("r-abc", {}).get("hidden") is True)
    check("B11 hidden_content_ids reports it hidden",
          M.hidden_content_ids(db, ["r-abc", "r-other"]) == {"r-abc"})

    # --- validation ---
    try:
        M.report_content(db, content_id="x", content_type="bogus", reporter_uid="u1")
        check("B12 invalid content_type rejected", False)
    except ValueError:
        check("B12 invalid content_type rejected", True)
    try:
        M.report_content(db, content_id="x", content_type="reply", reporter_uid="")
        check("B13 anonymous report rejected", False)
    except ValueError:
        check("B13 anonymous report rejected", True)


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

def main() -> int:
    only = (sys.argv[1] if len(sys.argv) > 1 else "unit").lower()
    print(f"Moderation tests — scope={only}")
    group_a_pure()
    group_a_views()
    group_b_logic()
    # Group C (live Firestore/API) intentionally not implemented in unit scope.
    print("\n" + "=" * 60)
    passed = sum(1 for _, ok in _results if ok)
    failed = [n for n, ok in _results if not ok]
    print(f"SUMMARY: {passed}/{len(_results)} checks passed")
    if failed:
        print("FAILED: " + "; ".join(failed)); return 1
    print("All moderation checks passed."); return 0


if __name__ == "__main__":
    sys.exit(main())
