"""
purge_test_bq_rows.py — delete integration-test rows from BigQuery
`postings.postings_metadata`.

The posting composer stamps each BQ row with a `pipeline_run_id` provenance
marker — `web-composer` for live web postings, `test-e2e` for integration-test
runs (set via POSTING_PIPELINE_RUN_ID). `delete_content` purges the datastore +
GCS sidecars but NOT BigQuery, so test publishes leave orphan rows. This script
(and `posting.purge_test_bq_rows()`, which the integration suites call at
start-of-run) removes them.

Buffer note: `insert_rows_json` lands rows in BigQuery's streaming buffer for up
to ~90 min, during which UPDATE/DELETE is rejected. The `posting_date <
CURRENT_DATE()` guard sidesteps that — same-day rows are purged on a later day.

Run:  .venv/bin/python scripts/purge_test_bq_rows.py [marker_prefix]
      (marker_prefix defaults to "test-")
Env:  GCP_PROJECT_ID
"""

import os
import sys

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

import posting  # noqa: E402  (after sys.path insert)


def main() -> int:
    if not (os.getenv("GCP_PROJECT_ID") or os.getenv("GCP_PROJECT")):
        print("GCP_PROJECT_ID must be set")
        return 2
    marker = sys.argv[1] if len(sys.argv) > 1 else "test-"
    n = posting.purge_test_bq_rows(marker)
    print(f"done — {n} row(s) purged for marker {marker!r}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
