"""
test_posting_tagging.py — phase-H "Post a new message" composer + tagging.

Covers the posting pipeline end to end:
  A  vocabulary loading + the consulate place-name options + 1.10 descriptions
  B  tag cleaning / cross-bucket dedup / stages+dates cleaning
  C  relevant-section selection (expert-curated; no primary_consulate; consulate gating)
  D  validation rules (visa required, dup buckets, bad dates, OOV tags)
  E  canonical sidecar build (primary derived, case_id, overrides, embedding_text)
  F  Gemini tagging EDGE CASES (the ones we hit by hand) — INTEGRATION, may be slow
  G  API endpoints via TestClient incl. a real publish + cleanup — INTEGRATION

Groups A–E are deterministic and need no network. F + G call Gemini / GCP (ADC).

Run:  .venv/bin/python tests/test_posting_tagging.py
"""

import os
import sys

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

PROJECT = os.getenv("GCP_PROJECT_ID") or os.getenv("GCP_PROJECT", "")

_results: list[tuple[str, bool, str]] = []


def check(name: str, passed: bool, detail: str = "") -> None:
    _results.append((name, passed, bool(detail)))
    print(f"  [{'PASS' if passed else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


# ---------------------------------------------------------------------------
# A — Vocabulary, consulate options, 1.10 descriptions (UNIT)
# ---------------------------------------------------------------------------

def group_a_vocab() -> None:
    print("\nA — Vocabulary & prompt block (unit)")
    import posting as p
    v = p.vocab_lists()
    check("A1 vocab non-empty (visa/consulate/tag/stage/date)",
          all(len(v[k]) > 0 for k in ("visa", "consulate", "tag", "stage_key", "date_key")),
          {k: len(v[k]) for k in v})

    opts = {o["code"]: o["label"] for o in v["consulate_options"]}
    check("A2 consulate city label = 'City, Country (CODE)'",
          opts.get("BOM") == "Mumbai, India (BOM)", opts.get("BOM"))
    check("A3 consulate country label = 'Country (CODE)'",
          opts.get("IN") == "India (IN)", opts.get("IN"))

    block = p._master_tags_block()
    check("A4 1.10 descriptions are sent to the model",
          "open-for-attorney — " in block and "lawyer-recommendation — " in block,
          "has '— ' description lines")
    check("A5 forms/abbreviations stay names-only (no '—' for I-129)",
          "I-129 — " not in block and "I-129" in block, "I-129 present without desc")


# ---------------------------------------------------------------------------
# B — Cleaning / dedup / stages+dates (UNIT)
# ---------------------------------------------------------------------------

def group_b_clean() -> None:
    print("\nB — Cleaning, dedup, stages/dates (unit)")
    import posting as p

    check("B1 _clean_group drops out-of-vocab visa",
          p._clean_group("visa_applying_for", ["H-1B", "NOT-A-VISA"]) == ["H-1B"])

    check("B2 primary_consulate: list coerced to first valid code",
          p._clean_group("primary_consulate", ["BOM", "DEL"]) == "BOM")
    check("B3 primary_consulate: invalid -> ''",
          p._clean_group("primary_consulate", "NOPE") == "")

    # cross-bucket dedup: a tag in both tags and concerns stays only in concerns
    groups = {"current_visa_or_greencard_category": [], "consulates": [],
              "concerns_or_questions_tags": ["RFE"], "tags": ["RFE"]}
    p._dedup_buckets(groups)
    check("B4 dedup: RFE kept in concerns, removed from tags",
          groups["tags"] == [] and groups["concerns_or_questions_tags"] == ["RFE"], str(groups))

    norm = p._normalize_groups({"primary_consulate": "BOM", "consulates": [],
                                "current_visa_or_greencard_category": [], "tags": [],
                                "concerns_or_questions_tags": []})
    check("B5 normalize: primary added into consulates", norm["consulates"] == ["BOM"], str(norm.get("consulates")))

    st = p._clean_stages({"visa_status": "approved", "bogus_key": "x"})
    check("B6 _clean_stages keeps valid 1.7 key, drops unknown",
          st.get("visa_status") == "approved" and "bogus_key" not in st, str(st))

    dt = p._clean_dates({"visa_interview_date": "2026-05-20", "visa_interview_date_bad": "05/20/2026"})
    check("B7 _clean_dates keeps YYYY-MM-DD valid key, drops bad",
          dt.get("visa_interview_date") == "2026-05-20" and len(dt) == 1, str(dt))


# ---------------------------------------------------------------------------
# C — relevant_sections (UNIT)
# ---------------------------------------------------------------------------

def group_c_sections() -> None:
    print("\nC — relevant_sections selection (unit)")
    import posting as p

    base = {f: [] for f in p.GROUP_FIELDS}
    base["primary_consulate"] = ""

    # model says primary_consulate -> must be stripped from UI output
    g = dict(base); g["consulates"] = ["BOM"]; g["primary_consulate"] = "BOM"
    secs = p._relevant_sections({"relevant_sections": ["visa_applying_for", "primary_consulate", "consulates"]}, g)
    check("C1 primary_consulate never appears in UI sections", "primary_consulate" not in secs, str(secs))
    check("C2 consulates kept when a consulate is present", "consulates" in secs, str(secs))

    # consulate gating: no consulate present -> consulates section dropped
    g2 = dict(base)
    secs2 = p._relevant_sections({"relevant_sections": ["visa_applying_for", "consulates"]}, g2)
    check("C3 consulates dropped when no consulate present", "consulates" not in secs2, str(secs2))

    # fallback heuristic when model returns nothing
    g3 = dict(base); g3["visa_applying_for"] = ["H-1B"]
    secs3 = p._relevant_sections({}, g3)
    check("C4 fallback shows non-empty section + always tags",
          "visa_applying_for" in secs3 and "tags" in secs3, str(secs3))


# ---------------------------------------------------------------------------
# D — validation (UNIT)
# ---------------------------------------------------------------------------

def _doc(**over) -> dict:
    base = {
        "current_visa_or_greencard_category": ["H-1B"], "visa_applying_for": [],
        "primary_consulate": "", "consulates": [], "tags": [], "concerns_or_questions_tags": [],
        "employer_type": "unknown", "severity": "low", "resolution_status": "open",
        "key_dates": {}, "key_stages_or_info": {},
    }
    base.update(over)
    return base


def group_d_validate() -> None:
    print("\nD — validation rules (unit)")
    import posting as p

    check("D1 valid minimal doc passes", p.validate(_doc()) == [], str(p.validate(_doc())))

    no_visa = _doc(current_visa_or_greencard_category=[], visa_applying_for=[])
    check("D2 missing visa/category -> error",
          any("Capture a visa" in e for e in p.validate(no_visa)), str(p.validate(no_visa)))

    dup = _doc(tags=["RFE"], concerns_or_questions_tags=["RFE"])
    check("D3 same tag in two buckets -> error",
          any("both" in e for e in p.validate(dup)), str(p.validate(dup)))

    badd = _doc(key_dates={"visa_interview_date": "2026/05/20"})
    check("D4 bad date format -> error",
          any("YYYY-MM-DD" in e for e in p.validate(badd)), str(p.validate(badd)))

    oov = _doc(tags=["totally-made-up-tag"])
    check("D5 out-of-vocab tag -> error",
          any("not in tag vocab" in e for e in p.validate(oov)), str(p.validate(oov)))

    badcons = _doc(primary_consulate="BOM", consulates=["DEL"])
    check("D6 primary_consulate must be within consulates",
          any("within consulates" in e for e in p.validate(badcons)), str(p.validate(badcons)))


# ---------------------------------------------------------------------------
# E — build_canonical (UNIT)
# ---------------------------------------------------------------------------

def group_e_build() -> None:
    print("\nE — canonical sidecar build (unit)")
    import re
    import posting as p

    tags = {"visa_applying_for": ["H-1B"], "current_visa_or_greencard_category": [],
            "primary_consulate": "", "consulates": ["BOM"], "tags": ["visa-stamping"],
            "concerns_or_questions_tags": []}
    c = p.build_canonical("H-1B stamping at Mumbai", "Body text here.", tags,
                          {"visa_status": "approved"}, {"visa_interview_date": "2026-05-20"},
                          {"background_summary": "bg", "severity": "high"})

    check("E1 primary_consulate derived from consulates[0]", c["primary_consulate"] == "BOM", c["primary_consulate"])
    check("E2 case_id format app-YYYY-MM-DD-xxxx",
          bool(re.match(r"^app-\d{4}-\d{2}-\d{2}-[0-9a-f]{8}$", c["case_id"])), c["case_id"])
    check("E3 channel=app, source_system=unclesamcalling",
          c["channel"] == "app" and c["source_system"] == "unclesamcalling")
    check("E4 synthetic author_handle present", bool(c["author_handle"]), c["author_handle"])
    check("E5 user stages/dates carried through",
          c["key_stages_or_info"] == {"visa_status": "approved"} and c["key_dates"] == {"visa_interview_date": "2026-05-20"})
    check("E6 embedding_text includes title + a tag",
          "H-1B stamping at Mumbai" in c["embedding_text"] and "visa-stamping" in c["embedding_text"])
    check("E7 extracted context used (severity=high)", c["severity"] == "high", c["severity"])


# ---------------------------------------------------------------------------
# F — Gemini tagging EDGE CASES (INTEGRATION, network, may be slightly flaky)
# ---------------------------------------------------------------------------

def group_f_llm() -> None:
    print("\nF — Gemini tagging edge cases (integration)")
    import posting as p

    def allt(out):  # all tag strings across the two free-tag buckets
        return set(out["groups"]["tags"]) | set(out["groups"]["concerns_or_questions_tags"])

    # F1 attorney-to-answer question
    o1 = p.suggest_tags("Need an attorney to answer: H-1B transfer while I-485 pending?",
                        "I'm on H-1B with an I-485 pending. Can an immigration attorney advise whether I can "
                        "transfer my H-1B without disturbing the pending green card? Looking for an attorney to answer.")
    check("F1 attorney question -> open-for-attorney (not lawyer-recommendation)",
          "open-for-attorney" in allt(o1) and "lawyer-recommendation" not in allt(o1), str(sorted(allt(o1))))

    # F2 referral request
    o2 = p.suggest_tags("Recommendations for a good H-1B attorney in the Bay Area?",
                        "Can anyone recommend a reliable immigration attorney or law firm for H-1B work in the SF Bay Area? "
                        "Looking for names and who you had a good experience with.")
    check("F2 referral request -> lawyer-recommendation",
          "lawyer-recommendation" in allt(o2), str(sorted(allt(o2))))

    # F3 consular experience share -> consulate section, NO concerns section
    o3 = p.suggest_tags("B1/B2 interview experience at Mumbai consulate",
                        "Sharing my experience: my B1/B2 visa interview at the Mumbai consulate was smooth, approved on the spot, no 221g. Posting to help others.")
    check("F3 consular experience: 'consulates' in sections, 'concerns_or_questions_tags' not",
          "consulates" in o3["relevant_sections"] and "concerns_or_questions_tags" not in o3["relevant_sections"],
          str(o3["relevant_sections"]))

    # F4 in-US question -> concerns section, NO consulate section
    o4 = p.suggest_tags("Can I work past my H-1B I-94 while extension is pending?",
                        "I'm in the US on H-1B. My employer filed an extension before my I-94 expired but it's still pending. "
                        "Can I keep working under the 240-day rule? Worried about falling out of status.")
    check("F4 in-US question: 'concerns_or_questions_tags' in sections, 'consulates' not",
          "concerns_or_questions_tags" in o4["relevant_sections"] and "consulates" not in o4["relevant_sections"],
          str(o4["relevant_sections"]))

    # F5 visa-abroad with outcome + date -> key_stages + key_dates populated
    o5 = p.suggest_tags("H-1B visa stamping APPROVED at Mumbai on 2026-05-20",
                        "Went for H-1B visa stamping at the Mumbai consulate, interview on 2026-05-20, approved, passport back in 5 days, no 221g.")
    check("F5 outcome -> key_stages_or_info populated", len(o5["key_stages_or_info"]) > 0, str(o5["key_stages_or_info"]))
    check("F6 date -> key_dates populated", len(o5["key_dates"]) > 0, str(o5["key_dates"]))

    # F7 green-card CATEGORY posting -> an EB/family code captured (label = "visa/category").
    # The model is occasionally non-deterministic here; a real user re-previews, so we
    # allow up to 3 attempts before declaring a miss.
    visas: set = set()
    for _ in range(3):
        o7 = p.suggest_tags("EB-2 to EB-3 downgrade for faster priority date?",
                            "I have an approved I-140 in EB-2 (India). Considering an EB-3 downgrade because the EB-3 "
                            "priority date is current. Is the EB-3 downgrade worth it for my green card category?")
        visas = set(o7["groups"]["visa_applying_for"]) | set(o7["groups"]["current_visa_or_greencard_category"])
        if any(x in visas for x in ("EB-2", "EB-3")):
            break
    check("F7 green-card category captured (EB-2/EB-3, <=3 tries)",
          any(x in visas for x in ("EB-2", "EB-3")), str(sorted(visas)))


# ---------------------------------------------------------------------------
# G — API endpoints + real publish/cleanup (INTEGRATION)
# ---------------------------------------------------------------------------

def _cleanup(case_id: str, gcs_path: str) -> str:
    """Delete the just-published doc from the datastore + GCS sidecars."""
    notes = []
    try:
        from google.cloud import discoveryengine_v1 as de
        from google.api_core.client_options import ClientOptions
        from google.api_core.exceptions import NotFound
        import posting as p
        proj, loc, ds = p._project(), p._ds_location(), p._datastore()
        c = de.DocumentServiceClient(client_options=ClientOptions(quota_project_id=proj))
        name = (f"projects/{proj}/locations/{loc}/collections/default_collection"
                f"/dataStores/{ds}/branches/default_branch/documents/{case_id}")
        try:
            c.delete_document(name=name); notes.append("datastore deleted")
        except NotFound:
            notes.append("datastore not found")
    except Exception as e:  # noqa: BLE001
        notes.append(f"datastore cleanup err: {e}")
    try:
        from google.cloud import storage
        import posting as p
        prefix = gcs_path[len("gs://"):]
        bucket_name, base = prefix.split("/", 1)
        bkt = storage.Client(project=p._project()).bucket(bucket_name)
        for ext in (".md", ".json"):
            bkt.blob(f"{base}{case_id}{ext}").delete()
        notes.append("gcs deleted")
    except Exception as e:  # noqa: BLE001
        notes.append(f"gcs cleanup err: {e}")
    return "; ".join(notes)


def group_g_api() -> None:
    print("\nG — API endpoints + publish/cleanup (integration)")
    # Mark every BQ row this run writes so it's identifiable + purgeable.
    os.environ["POSTING_PIPELINE_RUN_ID"] = "test-e2e"
    import posting as p
    p.purge_test_bq_rows()  # sweep prior runs' markers (date < today; buffer-safe)
    from fastapi.testclient import TestClient
    import api
    api.RATE_LIMIT_MAX = 100000

    with TestClient(api.app) as client:
        vocab = client.get("/api/tag-vocab").json()
        check("G1 /api/tag-vocab has consulate_options + all keys",
              all(k in vocab for k in ("visa", "consulate", "consulate_options", "tag", "stage_key", "date_key"))
              and len(vocab["consulate_options"]) > 0, str(list(vocab.keys())))

        sug = client.post("/api/tag-suggest", json={
            "title": "B1/B2 interview in Mumbai",
            "description": "I have my B1/B2 visa interview at the Mumbai consulate next month and want to know what to bring.",
        })
        sj = sug.json()
        check("G2 /api/tag-suggest shape (groups/sections/type/stages/dates)",
              sug.status_code == 200 and all(k in sj for k in
              ("groups", "relevant_sections", "posting_type", "key_stages_or_info", "key_dates")),
              f"status={sug.status_code}")

        noviza = client.post("/api/postings", json={
            "title": "[E2E] no visa case",
            "description": "Deliberately omits any visa/status to exercise the required-visa validation path.",
            "tags": {"tags": ["general-inquiry"]},
        })
        check("G3 publish without visa -> 422", noviza.status_code == 422,
              f"status={noviza.status_code} detail={noviza.json().get('detail','')[:60]}")

        pub = client.post("/api/postings", json={
            "title": "[E2E] H-1B stamping approved at Mumbai",
            "description": "Went for H-1B visa stamping at the Mumbai consulate, interview on 2026-05-20, approved.",
            "tags": {"visa_applying_for": ["H-1B"], "consulates": ["BOM"],
                     "tags": ["visa-stamping", "approved"]},
            "key_stages_or_info": {"visa_status": "approved"},
            "key_dates": {"visa_interview_date": "2026-05-20"},
        })
        pj = pub.json()
        ok_pub = pub.status_code == 200 and pj.get("case_id", "").startswith("app-")
        check("G4 publish with visa -> 200 + app case_id", ok_pub,
              f"status={pub.status_code} case_id={pj.get('case_id')}")

        if ok_pub:
            cid = pj["case_id"]
            detail = client.get(f"/api/postings/{cid}").json()
            check("G5 published doc retrievable from datastore",
                  detail.get("title", "").startswith("[E2E]") and detail.get("channel") == "app",
                  f"title={detail.get('title')}")
            notes = _cleanup(cid, pj["gcs_path"])
            check("G6 cleanup of E2E test doc", "deleted" in notes, notes)


def main() -> int:
    if not PROJECT:
        print("GCP_PROJECT_ID must be set")
        return 2
    only = sys.argv[1] if len(sys.argv) > 1 else "all"
    print(f"Posting/tagging tests — project={PROJECT}  (scope={only})")

    group_a_vocab()
    group_b_clean()
    group_c_sections()
    group_d_validate()
    group_e_build()
    if only in ("all", "llm"):
        group_f_llm()
    if only in ("all", "api"):
        group_g_api()

    print("\n" + "=" * 60)
    passed = sum(1 for _, ok, _ in _results if ok)
    failed = [n for n, ok, _ in _results if not ok]
    print(f"SUMMARY: {passed}/{len(_results)} checks passed")
    if failed:
        print("FAILED: " + "; ".join(failed))
        return 1
    print("All posting/tagging checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
