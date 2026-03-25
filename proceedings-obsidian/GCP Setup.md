# GCP Setup

**Location:** `/gcp_setup.sh`
**Lines:** 59

---

## Purpose

Shell script that creates and configures the GCS bucket used by all pipeline stages.

---

## What It Does

| Step | Action |
|------|--------|
| 1 | Sets active project to `proceedings-490601` |
| 2 | Creates `gs://law-firm-knowledge-base` in `us-central1` with uniform bucket-level access |
| 3 | Blocks all public access (`public-access-prevention=enforced`) |
| 4 | Enables versioning (protects against accidental overwrites) |
| 5 | Creates `labeled/.keep` placeholder for Label Studio target storage |
| 6 | Verifies bucket configuration |

---

## Configuration

| Setting | Value |
|---------|-------|
| Project ID | `proceedings-490601` |
| Bucket | `law-firm-knowledge-base` |
| Region | `us-central1` |
| Public access | Blocked |
| Versioning | Enabled |

---

## Prerequisites

- `gcloud` CLI installed
- Authenticated: `gcloud auth login`
- Project set: `gcloud config set project proceedings-490601`
