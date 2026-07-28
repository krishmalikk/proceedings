# Visa-vocab gaps and curation blockers — found via the 072826 batch

**Status:** Findings + proposed next steps, not yet resolved (except §1, applied).
**Context:** A 37-file manual-curation batch (`~/curated/072826/`) run through `tag-suggest-batch.sh` → `publish-batch.sh` had 17 failures, all `"Posting failed validation: Capture a visa/status in 'Current status' or 'Visa applying for' before submitting"`. Investigated each individually against the source text and `tags-cleaned/1.1`/`1.2`/`1.6` vocab. This doc is the writeup: what's fixed, what's a one-off content issue, and what's a real vocabulary gap worth a deliberate decision.

---

## 1. Fixed — `_derive_visa_from_tags()`'s over-strict "/" handling

**Status: fixed and published** (`posting.py`, `_derive_visa_from_tags()`).

The deterministic backfill that infers `visa_applying_for` from a process tag (e.g. `h1b-petition` → `H-1B`) refused to touch *any* 1.6 mapping containing `/`, to avoid guessing at genuinely ambiguous change-of-status pairs (`l1-to-h1b` → `"L-1 / H-1B"`). But `opt-application`/`opt-extension`/`stem-opt-extension`/`cpt-application` all map to `"OPT / F-1"` / `"CPT / F-1"` — and `"OPT"`/`"CPT"` are benefit names, not selectable vocab codes at all, so there was never any real ambiguity there. The fix: only treat a `/`-joined mapping as ambiguous when *more than one* side is itself a valid `1.1`/`1.2` code. Verified this doesn't change behavior for any genuinely ambiguous mapping (`l1-to-h1b`, `f1-to-h1b`, `h1b-to-f1`, `f1-to-h4`, `j1-to-h1b`, `h1b-to-l1`, `b1b2-to-h1b` — all still correctly skipped) or any fully-unmappable one (`aos-filing`, `ead-filing`, `ap-filing` — neither side is a real vocab code, still correctly skipped). Bonus: also fixes `niw-petition` (`"NIW / EB-2"` → `EB-2`), same reasoning.

Tests: `test_posting_tagging.py` E12a–E12d.

## 2. Fixed — `travels-ggestion.txt`'s file formatting

**Status: fixed and published** (`app-2026-07-28-aed6f2ad`).

Not a tagging issue at all: this file was 2 lines (title + content, no blank separator), but every curation script assumes `title \n blank \n description...` and reads the description via `tail -n +3`. With no line 3+, the description sent to `/api/tag-suggest` was empty, which is why its `.tags.json` held a stale `422 string_too_short` error body instead of a real tags draft — indistinguishable from a normal "empty visa fields" failure without opening the file. Fixed by inserting the missing blank line 2. Once fixed, `tag-suggest.sh` correctly derived `current_visa_or_greencard_category: ["F-1"]` directly from context (recent grad + "Initial OPT EAD card") — §1's fix wasn't even needed for this specific file, though it remains a real, tested defense for future OPT/CPT posts phrased differently.

**Follow-up worth doing:** audit the rest of the batch (and future batches) for this same 2-line-file shape before assuming every failure is a vocab issue — a quick `awk 'NR==2{if($0!="")print FILENAME}' *.txt` catches it in one pass.

---

## 3. One-off content issues — need a human's judgment, not a vocab fix

These have *no* vocab gap — a real code exists — but the source text itself doesn't specify enough to pick the right one confidently. Guessing risks publishing incorrect legal-category data.

| File | What's missing |
|---|---|
| `changed-my-mind.txt` | "overstayed my visa" — visa type never named anywhere in the text |
| `different-name-ssn-gc.txt` | AOS approved, but the underlying petition basis (family/employment/other) isn't stated |
| `dont-know-what-to-think.txt` | I-485 pending, `employment-based-immigration` tag present, but no EB-1/2/3/4/5 level stated |
| `duplicate-status-updates.txt` | No visa/case-type information at all |
| `i130-approval.txt` | A *general discussion question* ("for those who filed 130 and 485...") with no personal relationship stated — could be spouse, parent, child, or sibling |
| `i539-approved.txt` | I-539 (extend/change nonimmigrant status) approved, but the underlying nonimmigrant category (F-1? H-4? B-2?) isn't named |
| `traffic-ticket.txt` | I-485 pending, concerned about a traffic misdemeanor affecting the green card — underlying category (family/employment/other) never stated |
| `uscis-reps.txt` | I-765/EAD delay — underlying status basis for the EAD not stated |
| `usps-ead-delivery.txt` | EAD delivery issue — underlying status basis not stated |

**Two files with a *probable* answer, still worth a quick confirm rather than a silent guess** — both hinge on whether the petitioning spouse is a U.S. citizen (`IR-1`) or a green-card holder (`F2A-FAMILY`), which the text doesn't say:

| File | Likely code | Why not certain |
|---|---|---|
| `i130.txt` | `IR-1` | "the attorney told my husband..." implies a spousal case, but citizen-vs-LPR petitioner status is never stated |
| `i751-eveidence.txt` | `IR-1` | I-751 implies a prior marriage-based conditional green card, same citizen-vs-LPR ambiguity |

**Proposed next step:** confirm these 11 with whoever curated the batch (do they know the missing detail from the original source thread?), then patch each `.tags.json` directly and publish — same mechanism as `congressional-inquiry.txt` in this batch. Doesn't need a code change.

---

## 4. Real vocabulary gaps — no valid code exists, regardless of wording

Checked `1.1-non-immigration-visas.csv` and `1.2-greencard-categories.csv` in full; neither has anything for these two case types.

### 4a. Asylum / refugee (`unlawful-presence.txt`)
The post is clearly asylum-based (`I-589`, `I-730` referenced directly), and `asylum`/`refugee` already exist as general **tags** (`1.10-common-misc.csv`) — but there is no selectable `visa_applying_for`/`current_visa_or_greencard_category` code for "asylee" or "asylum-based adjustment" anywhere in `1.1`/`1.2`. USCIS's own site has a whole "Political Asylum Based" greencard category (referenced in `GOV-NEWS-MULTI-SOURCE-CONFIG.md`'s § on `travel.state.gov`/other sources) that this vocab doesn't mirror.

### 4b. Naturalization / citizenship (`n400-after-divorce.txt`, `n400-interview.txt`, `n400-update.txt` — 3 of the 17 failures)
Same shape of gap: no N-400/citizenship code exists. By definition, an N-400 applicant is *already* a green-card holder — so `current_visa_or_greencard_category` should really reflect the **original** GC category (family/employment/diversity/asylum-based) that got them the green card in the first place. But naturalization narratives, unsurprisingly, don't restate that origin story — none of these 3 posts mention it. This is a **systemic** pattern (3/17 in a single batch), not a one-off.

### Proposed next steps for §4 (needs a product/vocab decision, not a code patch)
This is exactly the kind of gap `docs/ingestion/TAG-LIFECYCLE.md`'s new-tag-proposal process exists for (currently DRAFT/unbuilt — see that doc), so two options, not mutually exclusive:

1. **Add real vocab entries** — e.g. `ASYLUM-GC` to `1.2-greencard-categories.csv` for asylum-based adjustment, and either an `N-400`/naturalization entry or an explicit convention ("if posting_type is about naturalization and no original GC category is stated, prompt the curator to look it up") . Requires deciding the actual code name/shape — a vocab-owner call, not something to invent unilaterally here.
2. **Change `validate()`'s rule for these specific cases** — e.g. don't require a visa/GC code when a deterministic asylum/naturalization signal is already present (mirroring the existing `news-update` exception in `validate()`), if the vocab-entry route is judged not worth it for a rarer content type.

Until one of these is decided, the 4 affected files in this batch (`unlawful-presence.txt` + 3 N-400 files) can't be published without *either* a vocab change *or* stretching an existing code to fit (not recommended — e.g. forcing `IR-1` onto an asylum case would be factually wrong).

---

## Summary table

| Category | Count | Files | Next step |
|---|---|---|---|
| Fixed this session | 2 | `congressional-inquiry.txt`, `travels-ggestion.txt` | Published |
| Needs human confirmation, no vocab gap | 11 | see §3 | Confirm missing detail, patch `.tags.json`, publish |
| Real vocab gap (asylum) | 1 | `unlawful-presence.txt` | Vocab-owner decision (§4) |
| Real vocab gap (naturalization) | 3 | `n400-*.txt` | Vocab-owner decision (§4) |
| **Total** | **17** | | matches all 17 original batch failures |
