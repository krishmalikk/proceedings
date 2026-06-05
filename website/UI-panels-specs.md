## Requirements specifications for UI changes

### Overview 
Rediesgn the UI so that there is more clarity on `AI mode` and `Search` mode.

### Redesign the `search/AI` page layout so that:


#### 1. On landing there is only one search bar and nothing else. There is no `AI Overview` or `slider bar` for strict search results on landing page

#### 2. User types something on search bar which could be some posting he is looking for `search` or looking for some information `AI mode`

#### 3. On return/submit of text, the screen should divide into three vertical panels

- Middle panel is strictly to show search results from postings which we have ingested in our Vertex AI grounding source.

- Left panel will now show up UI options to refine the results in middle panel. Which include:

-- A slider bar on top with `strict`, `balanced', `broad` options

-- Tags (from our system tag taxonomy in [tags](../tags-cleaned)) relevant to the information / text which user has types
For example, if a user is filing for `H-1B` extenstion then relevant tags specific to that case should be shown for user to click to refine the search even more

- Right panel will asynchronously goes into `AI mode` and will return response as a US immigration expert  AI bot would do and will not show content from our postings ingested

- User will have an option to hide `AI mode` right panel, if he chooses to do so

- Left panel is strictly to refine results

- The call to render content in middle panel and right panel will be async and not related to each other

- There will be no button of toggle of `AI Overview` anymore. On click on search the `AI mode` results will show up in right panel and user will have an option not to ask follow up questions in the right panel or hide the right panel after first results are shown

- The calls to `search` from postings and `AI mode` conversation should be async and rendered independently in respective panels