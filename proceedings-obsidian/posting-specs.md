# Requirements specifications for posting a new post from UI

## Overview 
Abilty for user to post a new posting 

## Specifications

### UI 
1. Remove buttons `Ask a Pro', `Forum` for now
2. Disable `AI mode` right panel in search results page for now. Create an item in `TODO` list to enable and define this functionality later
3. Create a button in UI for `Post a new message` on top, which on click should open a new page with following functionality:
- A two vertical panel page should show up
- Left panel is for user to enter posting in 2 sections. `title` and `description`
- Right panel is for managing tags from the text entered by user on left panel
4. The UI should have the capability to determine and match the title and description entered to the right valid tags as specified in [tags](../tags-cleaned)
5. If possible, derive the tags automatically from the `title` and `description` text, as and when user enters it
6. Allow the users to manage (add/remove) the tags in right panel which is derived in previous step
7. The tags on right panel should have sections based upon json schema as defined in [JSON-SCHEMA-FIELD-DICTIONARY](../docs/tagging/JSON-SCHEMA-FIELD-DICTIONARY.md)
For example, it should have tags under sections:
If applying for a visa from a consulate abroad:
- `visa_applying_for`
- `primary_consulate`
If already in USA:
- `current_visa_or_greencard_category` 
8. The tags under section - `concerns_or_questions_tags` and `tags` should be derived based upon rules already defined in [docs/tagging](../docs/tagging) 
9. Click on submit button

### Backend
9. On `submit` button the metadata side json should be created as per - in [PIPELINE-ARCHITECTURE-WORKFLOW](../docs/ingestion/PIPELINE-ARCHITECTURE-WORKFLOW.md) similar to posts when ingested from extarnal sources like reddit.com
10. The storage of the grounding of this posting should follow the flow/architecture as defined in [FINAL-ARCHITECTURE](../proceedings-obsidian/FINAL-ARCHITECTURE.md)
11. The GCS bucket location of the content and sidecar json to be used would be same `imm-postings-ingestion`. A folder under the date folder should be created with name 'ourwebsite', similar to another folder already existing for `reddit' for postings ingested from reddit.com
12. After persistence of this content and sidecar json in GCS, it should automatically gets persisted in Vertex AI Search (Discovery Engine) datastore as well

### Questions TBD
13. What would be tha latency/lag after posting by user to gets persisted in Vertex AI Search datastore
14. When can we expect this new posting will show up from search in UI after posting ?

