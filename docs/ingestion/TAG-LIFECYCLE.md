# Master Tag Lifecycle — Adding New Tags from Live Postings

**Status**: DRAFT for review
**Companion to**: [QUARANTINE-PROCESS.md](QUARANTINE-PROCESS.md), [PIPELINE-ARCHITECTURE-WORKFLOW.md](PIPELINE-ARCHITECTURE-WORKFLOW.md)
**Answers**: §12.5 — the process for adding a new tag to the master list as new concepts appear in postings, and how it connects to the Label Studio quarantine flow.

---

## 1. Why a controlled process

The master tag list (`tags-cleaned/1.1 … 1.10`) is a **closed vocabulary**: the Validator rejects any tag not present in it, and the LLM prompt forbids inventing tags. This guarantees clean Vertex AI Search facets — but it also means genuinely new immigration concepts (a new visa rule, a new fee, a new policy like the FIFA-World-Cup surge) will, by design, **fail validation and land in quarantine** until the vocabulary is extended.

So new-tag creation is not ad hoc — it is a governed lifecycle that is *triggered by* the quarantine queue and *gated by* human approval, exactly so the closed-vocabulary guarantee is preserved.

---

## 2. The trigger: a "missing vocabulary" quarantine

From [QUARANTINE-PROCESS.md](QUARANTINE-PROCESS.md) §3 step 2, when a reviewer reads a quarantined document they classify the cause. One class is **"missing vocabulary"**: the *correct* tag for this posting does not exist in any `tags-cleaned/*.csv`.

Concretely the reviewer sees this when:
- the Validator error is `tags invalid: <x>` or `concerns invalid: <x>` **and**
- no existing master tag adequately captures the concept (Label Studio autocomplete, sourced from the live master CSVs, returns nothing suitable).

This is the **only** sanctioned entry point for proposing a new tag. New tags are never created from intuition divorced from a real posting — every tag must be justified by ≥ 1 concrete document.

---

## 3. The new-tag lifecycle (states)

```
 PROPOSED ──review──► APPROVED ──apply──► ACTIVE ──(rarely)──► DEPRECATED
     │                                       
     └────────────reject───────────► DISCARDED
```

| State | Where it lives | Who moves it |
|---|---|---|
| **PROPOSED** | `tag_proposals` BigQuery table (one row per proposed tag) | Reviewer, from Label Studio |
| **APPROVED** | same row, `status=approved` | Tag owner (you) — batched review |
| **ACTIVE** | committed row in the relevant `tags-cleaned/1.x-*.csv` | Tag owner (git commit) |
| **DISCARDED** | `tag_proposals`, `status=discarded` + reason | Tag owner |
| **DEPRECATED** | still in CSV but flagged; not produced for new docs | Tag owner (governance, rare) |

---

## 4. End-to-end flow (connected to Label Studio quarantine)

```
1. Document quarantines with "tags invalid: <concept>"
        │
2. Reviewer in Label Studio judges: "no existing master tag fits"
        │
3. Reviewer clicks "Propose new tag" (custom Label Studio action) and fills:
     - proposed_tag (kebab-case / UPPERCASE per the target section's convention)
     - target_section (1.1 … 1.10)
     - description (one line, matches the section's column format)
     - justifying_case_id (auto-filled from the current task)
     - example_phrase (the span in the post that motivated it)
        │  webhook → propose-fn (Cloud Run)
        ▼
4. propose-fn inserts a PROPOSED row into BigQuery `tag_proposals`
   and sets this quarantine task to DEFER (QUARANTINE-PROCESS.md §4),
   so the document waits — it is NOT yet promoted or rejected.
        │
5. Tag owner reviews PROPOSED rows (batched, e.g. daily/weekly):
     - dedup against existing tags + other proposals
     - check naming convention vs us_immigration_tag_specification.md
     - decide section placement (or "compose from existing tags instead")
        │
   ┌────┴───────────────┐
   ▼                    ▼
 APPROVE               DISCARD (e.g. "use H-1B + existing concurrent-h1b instead")
   │                    │ propose-fn marks DISCARDED(reason);
   │                    │ reviewer is notified; the deferred doc is re-reviewed
   │                    │ and resolved with the suggested existing tags
   ▼
6. Apply APPROVED tag:
     - append row to tags-cleaned/<section>.csv  (git commit, reviewed)
     - bump a TAG_VOCAB_VERSION marker (date + git sha)
     - propose-fn flips row to ACTIVE
        │
7. Propagate the new vocabulary (no model retrain needed):
     - Validator Tool reloads master CSVs (on deploy or via a watched config);
       if cached in the prompt, refresh the prompt cache (PIPELINE-ARCHITECTURE-WORKFLOW.md)
     - the deferred quarantine doc(s) are re-opened in Label Studio; the new
       tag now appears in autocomplete; reviewer resolves them normally
        │
8. Resolution feeds self-learning exactly as any resolved item:
     gold example → Vertex AI Example Store (QUARANTINE-PROCESS.md §5.1)
     so future postings with this concept are tagged with the new tag
     automatically on first pass.
```

---

## 5. `tag_proposals` table (BigQuery)

```sql
CREATE TABLE IF NOT EXISTS postings.tag_proposals (
  proposal_id        STRING NOT NULL,      -- uuid
  proposed_tag       STRING NOT NULL,
  target_section     STRING NOT NULL,      -- "1.1" .. "1.10"
  description        STRING,
  justifying_case_id STRING NOT NULL,      -- the quarantined doc
  example_phrase     STRING,
  proposed_by        STRING,               -- reviewer identity
  proposed_at        TIMESTAMP,
  status             STRING,               -- proposed|approved|active|discarded|deprecated
  decided_by         STRING,
  decided_at         TIMESTAMP,
  decision_reason    STRING,
  applied_git_sha    STRING                -- commit that added it to the CSV
)
PARTITION BY DATE(proposed_at);
```

This table is the audit trail: every master-tag addition is traceable to the posting and reviewer that justified it.

---

## 6. Governance rules

1. **One justifying document minimum.** No tag enters PROPOSED without a real `justifying_case_id`.
2. **Naming convention enforced.** The proposed tag must obey the target section's convention in [tagging/us_immigration_tag_specification.md](../tagging/us_immigration_tag_specification.md) (e.g. 1.1/1.2 UPPERCASE visa codes, 1.10 kebab-case). `propose-fn` runs a regex precheck and rejects malformed proposals at step 4.
3. **Prefer composition over new tags.** Before approving, the owner asks: "can existing tags compose this?" (e.g. `RFE` + `I-140` instead of a new `i140-rfe`). This mirrors the earlier decision that the §1.6 RFE-per-form tags were unnecessary. Discard with that reason when true.
4. **Batch approvals.** New tags are applied in reviewed git commits, not live edits, so the closed vocabulary stays auditable and the change set is reviewable.
5. **Versioned vocabulary.** Each applied batch bumps `TAG_VOCAB_VERSION`. The Validator and the LLM prompt cache key off this version so propagation is observable and rollback-able.
6. **No silent removals.** Tags are DEPRECATED (kept, flagged, not emitted for new docs) rather than deleted, so historical documents stay valid.
7. **Seed corpus untouched.** Adding a tag never triggers a rewrite of existing documents; the validator allows the corpus to use a subset of the master vocabulary.

---

## 7. Why this is connected to quarantine (not a separate workflow)

- The closed vocabulary intentionally **forces** novel concepts through quarantine — that is the detector for "the world changed and our taxonomy hasn't yet."
- The reviewer already has the document open in Label Studio with the failing error; proposing the tag there (rather than in a disconnected backlog) keeps the justification, the example phrase, and the resolution in one place.
- The deferred document becomes the **first training example** for the new tag the moment it's approved — so the vocabulary extension and the model's ability to *use* it arrive together via the Example Store, with zero model retraining.

---

## 8. Phase 1 vs Phase 2

Authoritative phase definitions: [PIPELINE-ARCHITECTURE-WORKFLOW.md §18](PIPELINE-ARCHITECTURE-WORKFLOW.md).

| Aspect | Phase 1 (Pilot) | Phase 2 (Production) |
|---|---|---|
| Proposal volume | Low — 3 subreddits, forward-only; new concepts surface slowly | Higher — broader subreddits + one-time backfill can surface many new concepts at once (especially during the backfill window) |
| Owner PROPOSED-review cadence | **Daily** (tight loop while the vocabulary is still settling) | **Weekly** at steady state (batch approvals) |
| Apply mechanism | `propose-fn` opens a git PR with the CSV row; reviewed merge | Same |
| Vocabulary propagation | New tag becomes usable on the next run (Validator + prompt cache keyed by `TAG_VOCAB_VERSION`); deferred docs re-opened and resolved via the **daily auto-sync** | Same, but resolved docs reach search in **minutes** via event-driven import |
| Backfill consideration | N/A (no backfill in Phase 1) | Run backfill **after** the vocabulary has stabilised in Phase 1, so historical posts are tagged against a mature tag set and generate fewer new-tag proposals |

The lifecycle states, `tag_proposals` table, governance rules, and quarantine linkage are **identical in both phases** — only proposal volume and review cadence change.

## 9. Open items

- Confirm cadence for the owner's PROPOSED review (recommend daily during pilot, weekly at steady state).
- Decide whether `propose-fn` auto-opens a git PR with the CSV row (recommended — keeps humans in the merge loop) vs. writing the CSV directly.
- Define SLA for a deferred document waiting on a tag decision (recommend ≤ 3 business days, else resolve with best-available existing tags and revisit).
