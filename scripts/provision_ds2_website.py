"""
provision_ds2_website.py — Phase 1.5: stand up DS-2, the public-reference
website data store (D-039 tier 3).

Creates a **basic** Vertex AI Search PUBLIC_WEBSITE data store (no domain
verification required — works for third-party gov/law-firm sites we do not own),
adds INCLUDE target sites for the curated public domains, and creates a search
engine over it so the BFF/api can call the Search/Answer API.

This is the "no ingestion" public-grounding tier: Google crawls/indexes the
sites; we run no scraper/chunk/embed pipeline.

Idempotent: re-running tolerates already-existing resources.

Run:  .venv/bin/python scripts/provision_ds2_website.py
Env:  GCP_PROJECT_ID, GCP_VERTEX_DATASTORE_LOCATION (default global)
"""

import os

from dotenv import load_dotenv
from google.api_core.client_options import ClientOptions
from google.api_core.exceptions import AlreadyExists, GoogleAPICallError
from google.cloud import discoveryengine_v1 as de

# Curated public reference domains (the originally-configured crawl sources):
# three government sites + two immigration law-firm/guide sites.
PUBLIC_DOMAINS = [
    "uscis.gov",
    "travel.state.gov",
    "dol.gov",
    "boundless.com",
    "immigrationdirect.com",
]

DATA_STORE_ID = "imm-public-reference-datastore"
ENGINE_ID = "imm-public-reference-search-app"
DISPLAY = "IMM Public Reference (website)"


def _opts(project_id: str, location: str) -> ClientOptions:
    if location != "global":
        return ClientOptions(
            api_endpoint=f"{location}-discoveryengine.googleapis.com",
            quota_project_id=project_id,
        )
    return ClientOptions(quota_project_id=project_id)


def create_data_store(project_id: str, location: str) -> str:
    client = de.DataStoreServiceClient(client_options=_opts(project_id, location))
    parent = f"projects/{project_id}/locations/{location}/collections/default_collection"
    ds = de.DataStore(
        display_name=DISPLAY,
        industry_vertical=de.IndustryVertical.GENERIC,
        solution_types=[de.SolutionType.SOLUTION_TYPE_SEARCH],
        content_config=de.DataStore.ContentConfig.PUBLIC_WEBSITE,
    )
    try:
        op = client.create_data_store(
            request=de.CreateDataStoreRequest(
                parent=parent,
                data_store=ds,
                data_store_id=DATA_STORE_ID,
                create_advanced_site_search=False,  # basic: no domain verification
            )
        )
        op.result(timeout=300)
        print(f"[data store] created: {DATA_STORE_ID}")
    except AlreadyExists:
        print(f"[data store] already exists: {DATA_STORE_ID}")
    return f"{parent}/dataStores/{DATA_STORE_ID}"


def add_target_sites(project_id: str, location: str, data_store: str) -> None:
    client = de.SiteSearchEngineServiceClient(client_options=_opts(project_id, location))
    parent = f"{data_store}/siteSearchEngine"
    for domain in PUBLIC_DOMAINS:
        try:
            op = client.create_target_site(
                request=de.CreateTargetSiteRequest(
                    parent=parent,
                    target_site=de.TargetSite(
                        provided_uri_pattern=f"{domain}/*",
                        type_=de.TargetSite.Type.INCLUDE,
                    ),
                )
            )
            op.result(timeout=120)
            print(f"[target site] INCLUDE {domain}/*")
        except AlreadyExists:
            print(f"[target site] already present: {domain}/*")
        except GoogleAPICallError as e:
            print(f"[target site] FAILED {domain}/*: {type(e).__name__}: {str(e)[:160]}")


def create_engine(project_id: str, location: str) -> None:
    client = de.EngineServiceClient(client_options=_opts(project_id, location))
    parent = f"projects/{project_id}/locations/{location}/collections/default_collection"
    engine = de.Engine(
        display_name=DISPLAY,
        solution_type=de.SolutionType.SOLUTION_TYPE_SEARCH,
        industry_vertical=de.IndustryVertical.GENERIC,
        data_store_ids=[DATA_STORE_ID],
        search_engine_config=de.Engine.SearchEngineConfig(
            search_tier=de.SearchTier.SEARCH_TIER_ENTERPRISE,
        ),
    )
    try:
        op = client.create_engine(
            request=de.CreateEngineRequest(parent=parent, engine=engine, engine_id=ENGINE_ID)
        )
        op.result(timeout=300)
        print(f"[engine] created: {ENGINE_ID}")
    except AlreadyExists:
        print(f"[engine] already exists: {ENGINE_ID}")


def report_indexing(project_id: str, location: str, data_store: str) -> None:
    client = de.SiteSearchEngineServiceClient(client_options=_opts(project_id, location))
    parent = f"{data_store}/siteSearchEngine"
    print("\nTarget-site indexing status:")
    try:
        for ts in client.list_target_sites(parent=parent):
            print(f"  - {ts.provided_uri_pattern:32s} {ts.indexing_status.name}")
    except GoogleAPICallError as e:
        print(f"  (could not list: {type(e).__name__}: {str(e)[:160]})")


def main() -> None:
    load_dotenv()
    project_id = os.getenv("GCP_PROJECT_ID") or os.getenv("GCP_PROJECT", "")
    location = os.getenv("GCP_VERTEX_DATASTORE_LOCATION", "global")
    if not project_id:
        raise SystemExit("GCP_PROJECT_ID must be set")

    print(f"Provisioning DS-2 in {project_id}/{location} for: {', '.join(PUBLIC_DOMAINS)}\n")
    data_store = create_data_store(project_id, location)
    add_target_sites(project_id, location, data_store)
    create_engine(project_id, location)
    report_indexing(project_id, location, data_store)
    print(
        f"\nDone. Engine: {ENGINE_ID}\n"
        "Website indexing runs asynchronously (basic crawl can take time to populate).\n"
        "Once target sites read SUCCEEDED, set GCP_VERTEX_PUBLIC_ENGINE_ID="
        f"{ENGINE_ID} to enable the tier-3 fallback in the API."
    )


if __name__ == "__main__":
    main()
