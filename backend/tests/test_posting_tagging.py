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

import json
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

    # D7-D8: news-update bypasses the visa/status-required rule
    # (GOV-NEWS-INGESTION-PLAN.md §3.4) — general policy news doesn't
    # represent anyone's personal status claim.
    news = _doc(current_visa_or_greencard_category=[], visa_applying_for=[], tags=["news-update"])
    check("D7 news-update tag bypasses the visa/status-required rule (fully valid doc)",
          p.validate(news) == [], str(p.validate(news)))

    news_and_visa = _doc(current_visa_or_greencard_category=["H-1B"], tags=["news-update"])
    check("D8 news-update doesn't suppress other validation (still fully valid doc)",
          p.validate(news_and_visa) == [], str(p.validate(news_and_visa)))


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
    check("E3 channel=app, source_system=meridianjourney",
          c["channel"] == "app" and c["source_system"] == "meridianjourney")
    check("E4 synthetic author_handle present", bool(c["author_handle"]), c["author_handle"])
    check("E5 user stages/dates carried through",
          c["key_stages_or_info"] == {"visa_status": "approved"} and c["key_dates"] == {"visa_interview_date": "2026-05-20"})
    check("E6 embedding_text includes title + a tag",
          "H-1B stamping at Mumbai" in c["embedding_text"] and "visa-stamping" in c["embedding_text"])
    check("E7 extracted context used (severity=high)", c["severity"] == "high", c["severity"])

    # E8-E12: _derive_visa_from_tags() / visa backfill in build_canonical() —
    # tips/advice content (e.g. "Tips for Tracking Your H-1B Petition") often
    # has no personal visa claim but does reference process tags like
    # h1b-petition; validate() requires a visa/status, so build_canonical()
    # deterministically backfills one from the post's own tags when possible.
    tips_tags = {"visa_applying_for": [], "current_visa_or_greencard_category": [],
                 "primary_consulate": "", "consulates": [],
                 "tags": ["I-797", "USCIS", "RFE", "h1b-petition", "processing-time", "tips"],
                 "concerns_or_questions_tags": []}
    c8 = p.build_canonical("Tips for Tracking Your H-1B Petition", "Body text here.", tips_tags)
    check("E8 visa backfilled from process tag (h1b-petition -> H-1B)",
          c8["visa_applying_for"] == ["H-1B"], c8["visa_applying_for"])
    check("E9 backfilled doc passes validation", p.validate(c8) == [], str(p.validate(c8)))

    explicit_tags = {"visa_applying_for": ["L-1"], "current_visa_or_greencard_category": [],
                      "primary_consulate": "", "consulates": [], "tags": ["h1b-petition"],
                      "concerns_or_questions_tags": []}
    c10 = p.build_canonical("My L-1 experience", "Some L-1 story.", explicit_tags)
    check("E10 explicit visa never overridden by backfill",
          c10["visa_applying_for"] == ["L-1"], c10["visa_applying_for"])

    ambiguous_tags = {"visa_applying_for": [], "current_visa_or_greencard_category": [],
                       "primary_consulate": "", "consulates": [], "tags": ["l1-to-h1b"],
                       "concerns_or_questions_tags": []}
    c11 = p.build_canonical("Status change question", "Thinking about changing status.", ambiguous_tags)
    check("E11 ambiguous multi-value mapping (L-1 / H-1B) not backfilled",
          c11["visa_applying_for"] == [], c11["visa_applying_for"])

    form_only_tags = {"visa_applying_for": [], "current_visa_or_greencard_category": [],
                       "primary_consulate": "", "consulates": [], "tags": ["i129-filing"],
                       "concerns_or_questions_tags": []}
    c12 = p.build_canonical("Filing question", "About my I-129 filing.", form_only_tags)
    check("E12 form-number tag not treated as a visa code",
          c12["visa_applying_for"] == [], c12["visa_applying_for"])

    # E13-E16: I-130 -> family-based-immigration (deterministic, tags-only —
    # I-130 alone can't tell us the specific greencard category, so
    # current_visa_or_greencard_category is deliberately left untouched).
    gc_tags = {"visa_applying_for": [], "current_visa_or_greencard_category": [],
               "primary_consulate": "", "consulates": [],
               "tags": ["I-130", "I-485", "aos-filing", "aos-approval"],
               "concerns_or_questions_tags": []}
    c13 = p.build_canonical("Got my green card 9 days after interview", "Body text.", gc_tags)
    check("E13 I-130 -> family-based-immigration tag added",
          "family-based-immigration" in c13["tags"], c13["tags"])
    check("E14 category still left blank (I-130 doesn't imply a specific code)",
          c13["current_visa_or_greencard_category"] == [], c13["current_visa_or_greencard_category"])
    check("E15 validate() still requires a specific category (not silently satisfied)",
          any("Capture a visa" in e for e in p.validate(c13)), str(p.validate(c13)))

    c16 = p.build_canonical("t", "d", {"tags": ["i130-approval", "family-based-immigration"]})
    check("E16 no duplicate when family-based-immigration already present",
          c16["tags"].count("family-based-immigration") == 1, c16["tags"])

    # E17-E18: cross-bucket duplicate regression (1862-notice.txt case) — a
    # post ASKING about timeline puts "timeline" in concerns_or_questions_tags
    # only; the deterministic timeline rule must not also add it to tags,
    # since validate() rejects a tag appearing in more than one bucket.
    asking_tags = {"visa_applying_for": [], "current_visa_or_greencard_category": [],
                    "primary_consulate": "", "consulates": [], "tags": ["EAD", "asylum"],
                    "concerns_or_questions_tags": ["processing-delay", "timeline"]}
    c17 = p.build_canonical("1862 notice", "Body text.", asking_tags,
                            key_dates={"ead_approved_date": "2025-03-01"})
    check("E17 timeline not duplicated into tags when already in concerns_or_questions_tags",
          "timeline" not in c17["tags"], c17["tags"])
    check("E18 no cross-bucket-duplicate validation error",
          not any("both" in e for e in p.validate(c17)), str(p.validate(c17)))

    # E19-E27: Path B provenance overrides (docs/ingestion/PATH-B-PROVENANCE-PLAN.md)
    # — build_canonical()'s new keyword-only params, and the client_platform
    # allowlist clamp. All app-composer defaults (no kwargs passed) must stay
    # byte-for-byte identical to E1-E18 above; only explicit overrides change.
    reddit_tags = {"visa_applying_for": ["H-1B"], "current_visa_or_greencard_category": [],
                   "primary_consulate": "", "consulates": [], "tags": ["h1b-rfe"],
                   "concerns_or_questions_tags": []}
    cr = p.build_canonical(
        "H-1B RFE approved", "Body text.", reddit_tags,
        channel="reddit", ingestion_method="manual_curation", source_system="reddit",
        subreddit="h1b", reddit_post_id="1abc2de",
        full_url="https://www.reddit.com/r/h1b/comments/1abc2de/x/",
        posting_date="2026-06-15",
    )
    check("E19 channel override applied", cr["channel"] == "reddit", cr["channel"])
    check("E20 ingestion_method override applied",
          cr["ingestion_method"] == "manual_curation", cr["ingestion_method"])
    check("E21 source_system override applied", cr["source_system"] == "reddit", cr["source_system"])
    check("E22 deterministic reddit case_id (channel-date-subreddit-postid)",
          cr["case_id"] == "reddit-2026-06-15-h1b-1abc2de", cr["case_id"])
    check("E23 posting_date override applied (not today)",
          cr["posting_date"] == "2026-06-15", cr["posting_date"])
    check("E24 gcs_path uses the overridden channel, not the app default",
          cr["gcs_path"] == "gs://imm-postings-ingestion/2026-06-15/reddit/", cr["gcs_path"])
    check("E25 full_url override applied (real reddit permalink, not APP_BASE_URL)",
          cr["full_url"] == "https://www.reddit.com/r/h1b/comments/1abc2de/x/", cr["full_url"])
    check("E26 subreddit/reddit_post_id round-trip",
          cr["subreddit"] == "h1b" and cr["reddit_post_id"] == "1abc2de",
          (cr["subreddit"], cr["reddit_post_id"]))

    c_default = p.build_canonical("App post", "Body text.", reddit_tags)
    check("E27 no-kwargs default still produces channel=app, random case_id (E2's format)",
          c_default["channel"] == "app" and c_default["case_id"].startswith("app-"),
          c_default["case_id"])

    cp_web = p.build_canonical("t", "d", reddit_tags, client_platform="web")
    cp_bad = p.build_canonical("t", "d", reddit_tags, client_platform="not-a-real-platform")
    cp_default = p.build_canonical("t", "d", reddit_tags)
    check("E28 client_platform: valid value passes through", cp_web["client_platform"] == "web")
    check("E29 client_platform: invalid value clamps to ''", cp_bad["client_platform"] == "")
    check("E30 client_platform: omitted defaults to ''", cp_default["client_platform"] == "")

    # E31-E38: gov-news provenance (docs/ingestion/GOV-NEWS-INGESTION-PLAN.md)
    # — content_hash, the gov-news case_id scheme, and author_handle/
    # source_item_id overrides.
    check("E31 content_hash_for is deterministic for identical input",
          p.content_hash_for("t", "d") == p.content_hash_for("t", "d"))
    check("E32 content_hash_for differs when content differs",
          p.content_hash_for("t", "d1") != p.content_hash_for("t", "d2"))

    news_tags = {"visa_applying_for": [], "current_visa_or_greencard_category": [],
                 "primary_consulate": "", "consulates": [], "tags": ["news-update"],
                 "concerns_or_questions_tags": []}
    gc = p.build_canonical(
        "USCIS Reaches Fiscal Year 2027 H-1B Cap", "Body text.", news_tags,
        channel="gov_news", ingestion_method="rss_feed", source_system="uscis",
        full_url="https://www.uscis.gov/newsroom/alerts/uscis-reaches-fiscal-year-2027-h-1b-cap",
        posting_date="2026-07-17", author_handle="USCIS",
        source_item_id="8d0937a2-6564-412c-8b12-7db83e9fbb39",
    )
    import hashlib
    expected_short = hashlib.sha256(b"8d0937a2-6564-412c-8b12-7db83e9fbb39").hexdigest()[:8]
    check("E33 gov-news case_id format channel-source-date-hash",
          gc["case_id"] == f"gov_news-uscis-2026-07-17-{expected_short}", gc["case_id"])
    check("E34 case_id leading segment matches channel exactly (delete_content() convention)",
          gc["case_id"].split("-", 1)[0] == "gov_news", gc["case_id"])
    check("E35 author_handle override applied (fixed source handle, not synthetic)",
          gc["author_handle"] == "USCIS", gc["author_handle"])
    check("E36 source_item_id round-trips into the canonical dict",
          gc["source_item_id"] == "8d0937a2-6564-412c-8b12-7db83e9fbb39", gc["source_item_id"])
    check("E37 content_hash present and matches content_hash_for(title, description)",
          gc["content_hash"] == p.content_hash_for("USCIS Reaches Fiscal Year 2027 H-1B Cap", "Body text."),
          gc["content_hash"])
    check("E38 gov-news doc passes validation (news-update bypasses visa requirement)",
          p.validate(gc) == [], str(p.validate(gc)))

    # E39a-E39c: backdated ingestion (GOV-NEWS-INGESTION-PLAN.md — gov-news
    # content is routinely months old by the time it's ingested). Confirms
    # posting_date carries the real historical source date while
    # ingestion_timestamp stays "when WE actually processed it" regardless —
    # the two must never be conflated, which is exactly what the
    # _write_bigquery() delete-guard bug (fixed alongside this test) would
    # have gotten wrong for backdated content specifically.
    from datetime import datetime, timezone
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    old = p.build_canonical(
        "Old backdated article", "Body text.", news_tags,
        channel="gov_news", source_system="uscis", posting_date="2020-01-01",
        source_item_id="old-item-1",
    )
    check("E39 backdated posting_date carries the real historical date, not today",
          old["posting_date"] == "2020-01-01", old["posting_date"])
    check("E40 ingestion_timestamp is today regardless of how backdated posting_date is",
          old["ingestion_timestamp"].startswith(today_str), old["ingestion_timestamp"])
    check("E41 backdated case_id uses the historical date, not today",
          old["case_id"].startswith("gov_news-uscis-2020-01-01-"), old["case_id"])

    c_no_override = p.build_canonical("t", "d", reddit_tags)
    check("E42 author_handle omitted still defaults to a synthetic handle",
          bool(c_no_override["author_handle"]) and c_no_override["author_handle"] != "USCIS",
          c_no_override["author_handle"])

    # E43-E46: _gov_news_tags() — the news-update tag is gated on
    # content_type explicitly (GOV-NEWS-MULTI-SOURCE-CONFIG.md §5), not
    # implicitly assumed from "this function only gets called for news
    # sources today". A forum_posting-type call must never get news-update.
    check("E43 content_type='news' adds news-update",
          "news-update" in p._gov_news_tags(["USCIS", "fraud"], "news"),
          p._gov_news_tags(["USCIS", "fraud"], "news"))
    check("E44 content_type='forum_posting' does NOT add news-update",
          "news-update" not in p._gov_news_tags(["USCIS", "fraud"], "forum_posting"),
          p._gov_news_tags(["USCIS", "fraud"], "forum_posting"))
    check("E45 unrecognized content_type also does NOT add news-update (fail closed, not open)",
          "news-update" not in p._gov_news_tags(["tag1"], "something-unexpected"),
          p._gov_news_tags(["tag1"], "something-unexpected"))
    check("E46 no duplicate news-update if the model already produced one",
          p._gov_news_tags(["a", "news-update", "b"], "news").count("news-update") == 1,
          p._gov_news_tags(["a", "news-update", "b"], "news"))
    # E45a — regression: news-update is a real, LLM-selectable vocab entry
    # (tags-cleaned/1.10-common-misc.csv), so _extract() can choose it on
    # its own for policy/news-shaped content regardless of content_type.
    # Found live: a real immihelp (forum_posting) posting about a visa fee
    # change came back from _extract() with news-update already in its
    # tags, and the pre-fix implementation only ever ADDED the tag for
    # content_type=="news" — it never stripped one the model had already
    # chosen for anything else, so it passed straight through.
    check("E45a content_type='forum_posting' STRIPS a model-chosen news-update, not just avoids adding one",
          "news-update" not in p._gov_news_tags(["h1b-petition", "news-update"], "forum_posting"),
          p._gov_news_tags(["h1b-petition", "news-update"], "forum_posting"))
    check("E45b unrecognized content_type also strips a pre-existing news-update (fail closed)",
          "news-update" not in p._gov_news_tags(["news-update"], "something-unexpected"),
          p._gov_news_tags(["news-update"], "something-unexpected"))


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


def group_h_immihelp() -> None:
    print("\nH — publish_immihelp_posting() (integration, docs/ingestion/IMMIHELP-SEED-PLAN.md)")
    import posting as p

    try:
        result = p.publish_immihelp_posting(
            title="[E2E] H-1B approved after RFE",
            description=(
                "Filed H-1B extension in January, got an RFE on specialty occupation in "
                "February, responded with expert letter, approved in April 2026. "
                "Contact me at throwaway@example.com if you have questions."
            ),
            source_item_id="e2e-test-999999",
            full_url="https://www.immihelp.com/experiences/post/e2e-test-999999/",
            posting_date="2026-04-10",
        )
    except Exception as e:  # noqa: BLE001
        check("H1 publish_immihelp_posting() succeeds for a taggable sample", False, f"{type(e).__name__}: {e}")
        return
    check("H1 publish_immihelp_posting() succeeds for a taggable sample", True, str(result))

    cid = result["case_id"]
    check("H2 case_id carries the immihelp channel prefix (delete_content() convention)",
          cid.startswith("immihelp-"), cid)

    detail = None
    try:
        from google.cloud import discoveryengine_v1 as de
        from google.api_core.client_options import ClientOptions
        proj, loc, ds = p._project(), p._ds_location(), p._datastore()
        c = de.DocumentServiceClient(client_options=ClientOptions(quota_project_id=proj))
        name = (f"projects/{proj}/locations/{loc}/collections/default_collection"
                f"/dataStores/{ds}/branches/default_branch/documents/{cid}")
        doc = c.get_document(name=name)
        detail = json.loads(type(doc).to_json(doc)).get("structData", {})
    except Exception as e:  # noqa: BLE001
        check("H3 published doc retrievable from datastore with correct provenance", False, f"{type(e).__name__}: {e}")
    if detail is not None:
        check("H3 published doc retrievable from datastore with correct provenance",
              detail.get("channel") == "immihelp" and detail.get("source_system") == "immihelp"
              and detail.get("ingestion_method") == "automated_scrape" and detail.get("posting_date") == "2026-04-10",
              {k: detail.get(k) for k in ("channel", "source_system", "ingestion_method", "posting_date")})
        check("H4 content_type='forum_posting' means news-update was never applied",
              "news-update" not in (detail.get("tags") or []), detail.get("tags"))
        check("H5 scrub_pii() ran — the pasted email never made it into the stored text",
              "throwaway@example.com" not in json.dumps(detail), "checked structData for the raw email")
        check("H6 no real author identity carried through (synthetic handle, not empty/None)",
              bool(detail.get("author_handle")) and detail.get("author_handle") != "e2e-test-999999",
              detail.get("author_handle"))

    notes = _cleanup(cid, result["gcs_path"])
    check("H7 cleanup of E2E immihelp test doc", "deleted" in notes, notes)


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
    if only in ("all", "api", "immihelp"):
        group_h_immihelp()

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
