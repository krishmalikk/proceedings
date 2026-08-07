# Timeline attribute config — runbook

The fields a Timeline group is scoped by, and the fields it collects from each
member on join, are **data, not code**. They live in a Firestore document and
change without a deploy.

    Firestore   app_config/timeline_attributes
    Loader      backend/attribute_config.py
    Defaults    backend/posting.py  →  DEFAULT_ATTRIBUTE_SPEC
    Publisher   backend/scripts/publish_attribute_config.py
    Read API    GET  /api/config/attributes
    Refresh     POST /api/config/attributes/refresh   (X-Admin-Token)

---

## 1. Change a field

```bash
cd backend
python scripts/publish_attribute_config.py --export spec.json
$EDITOR spec.json
python scripts/publish_attribute_config.py --file spec.json --validate-only
python scripts/publish_attribute_config.py --file spec.json --yes
```

Live everywhere within one TTL (60 s default). To confirm immediately:

```bash
curl -X POST -H "X-Admin-Token: $MODERATION_ADMIN_TOKEN" \
  https://<api-host>/api/config/attributes/refresh
```

**Never edit the document in the Firestore console.** The console does not run
`validate()`; the publisher does. An invalid document isn't served (the backend
rejects it and keeps last-good), but you'd only discover that from
`last_error`, having believed the change was live.

## 2. The spec

```jsonc
{
  "version": 3,
  "processing_types": [                    // the FIRST dropdown
    {"value": "EAD", "label": "EAD",
     "eligibility_categories": [           // the SECOND dropdown, per type
       {"code": "(c)(9)", "label": "Pending adjustment of status (I-485)",
        "tag": "adjustment-of-status"}
     ]}
  ],
  "period_rows":          [row, ...],          // base scope, every group
  "scope_row_extras":     {"<tag>": [row]},    // extra create-time rows
  "post_join_row_extras": {"<tag>": [row]}     // per-member join rows
}
```

A **row**:

| Field | Meaning |
|---|---|
| `kind` | `date` \| `select` \| `year` \| `checkbox` — the datatype. Drives the control *and* the server-side validation. |
| `label` | what the user sees |
| `key` | **must already exist** in `tags-cleaned/1.8-key-dates.csv` or `1.7-key-stages.csv` |
| `field` | `key_dates` \| `key_stages_or_info` — which profile map the value lands in |
| `options` | `select` only; the value domain the server enforces |
| `required` | post-join only. Any declared flag wins literally; declare none and row 0 is required. `false` on the only row = collect it, never block. |
| `name_prefix` | scope only; labels this value's segment in the generated group name |

**Scope vs post-join** is the one judgement the config can't make for you:
*does every member of the cohort share this value?* Yes → scope row. Each
member has their own → post-join row. A per-member fact in the scope gives
everybody a cohort of one.

## 3. Adding a key the vocabulary doesn't have

Validation rejects a `key` that isn't in the CSVs, because `profile.py`'s
cleaners silently drop unknown keys — the form would accept input and throw it
away. So a genuinely new field is **two** changes:

1. add the key to the right `tags-cleaned/*.csv` (a code change, needs a deploy)
2. then reference it from the config (no deploy)

Adding a field that uses an *existing* key is config-only.

## 4. Caching and propagation

| Layer | Window | Tunable by |
|---|---|---|
| Backend in-process | 60 s | `ATTR_CONFIG_TTL_SECONDS` |
| Website `/api/tag-vocab` | 60 s | `VOCAB_REVALIDATE_SECONDS` |
| Mobile | per screen mount | — |

Worst case browser propagation is roughly the sum, so ~2 minutes on defaults.
Inside the TTL there is **no** Firestore traffic; on expiry it is one document
read per instance. A failing backend is retried once per TTL, not per request.

The TTL is a staleness bound, not a correctness bound: two instances can
briefly serve different versions. That is fine for form definitions, and is
why group *names* are built from stored criteria rather than recomputed from
config.

## 5. When something looks wrong

```bash
curl https://<api-host>/api/config/attributes | jq .meta
```

`source` is the answer to "is prod running my edit?":

| `source` | Meaning | Do |
|---|---|---|
| `firestore` | serving the published document | check `version` matches what you published |
| `last-good` | the document is unreadable or **failed validation** — serving the previous good one | read `last_error`; fix and republish |
| `default` | nothing published, or nothing has ever validated — serving the spec baked into the image | publish, or check `last_error` |

**Rollback** is `--delete` (every instance reverts to the in-code default
within one TTL) or republishing the previous JSON. Keep the exported file.

## 6. Why Firestore

Already an in-process dependency — no new client, IAM or env — and strongly
consistent, so an edit is visible on the very next refresh. GCS would have
worked but is slower and needs generation-polling to detect change. Cloud Run
env vars were disqualified outright: changing one requires a new revision,
which is the exact thing this removes.

## 7. What is still code

- **The four `kind`s.** A fifth (`number`, `multiselect`) needs the validator
  plus each client's control renderer — three code changes.
- **Format/range/cross-field validation.** A `date` row accepts any string;
  there is no "approved must follow filed".
- **Conditional visibility.** No `"when": {…}` predicate; every row for a
  scope is always shown.
- **Join-time resolution is by tag, not by the dropdown pair.** If a
  processing type ever gets its own post-join rows *and* a category does too,
  the join form returns only one of them. See
  `features/timeline-attributes-6/timeline-attribute-framework.md` §5.

## 8. Tests

`backend/tests/test_attribute_config.py` — 41 checks, no GCP calls (Firestore
is stubbed):

- **V** validation accepts the shipped default and rejects unknown keys/kinds/
  fields, optionless selects, duplicates, and side-confused flags
- **F** the fallback ladder, including *invalid published config keeps
  last-good* and *unreachable Firestore keeps last-good*
- **C** cache behaviour: 50 reads → 1 fetch, TTL expiry, forced refresh, and a
  dead backend retried once per TTL rather than per request
- **P** a config edit changes `POST_JOIN_ATTRIBUTE_TEMPLATES`, the dropdown
  options, the `/api/tag-vocab` payload and server-side validation — with no
  restart and no reimport
