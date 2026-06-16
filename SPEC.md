# AssessTask "Link to Existing Definition" Path Specification

## Status

- Draft v1.0

## Purpose

This document defines the intended behaviour for the final path in the AssessTask
wizard modal: **linking a Google Classroom assignment to an existing
`AssignmentDefinition`** when the auto-matcher returns no-match. The link writes the
Google Classroom assignment's title to the chosen definition's `alternateTitles`
array and, when present, the Google Classroom assignment's topic name to its
`alternateTopics` array; the assessment run is then auto-started against the linked
definition. The same matcher relaxation that supports the link also makes future
Google Classroom assignments with case- or whitespace-different titles or topic
names drive the wizard's happy path without any further user action.

The feature will be used to:

- let a teacher map a slightly-rephrased Google Classroom assignment to an existing
  reusable definition in a single click, instead of either creating a duplicate or
  rephrasing the Google Classroom title;
- make future occurrences of the same Google Classroom title (or a title that
  differs only by case or whitespace) match the happy path automatically;
- make future occurrences of the same Google Classroom topic name (or a topic name
  that differs only by case or whitespace) match the happy path automatically, via
  the new `alternateTopics` lookup.

This feature is **not** intended to:

- change the existing "Create New Definition" wizard path;
- introduce a fuzzy-match library or new ranking algorithm **for the
  matcher's binary decision** — the matcher uses case-insensitive
  trimmed equality per Decision 7. (Fuzzy ranking is used for the
  picker's _display order_ per Decision 9, which is a separate concern
  from the matcher's match/no-match decision.);
- allow linking more than one definition per Google Classroom assignment — the
  user confirmed single-selection;
- merge alternate titles across multiple existing definitions for a single
  Google Classroom assignment;
- delete or rename any existing alternate title, alternate topic, primary title,
  or primary topic on a definition that the user did not explicitly pick in the
  picker.

## Agreed product decisions

1. **Single-selection picker.** The teacher picks exactly one
   `AssignmentDefinition` to link to. The link adds the Google Classroom title to
   that one definition's `alternateTitles` and the Google Classroom topic name to
   its `alternateTopics`, then the assessment run is auto-started using that
   definition's `definitionKey`.
2. **Picker list filter.** The picker shows only definitions whose
   `yearGroupKey` matches the current class's `yearGroupKey`. This guarantees
   that the link is useful: the matcher requires the definition's year group to
   match the class's year group, so any link to a definition outside the class's
   year group would never be auto-matched in the future.
3. **Picker list sort.** The picker is ordered primarily by **fuzzy title
   rank** (the `fuse.js` score between the Google Classroom assignment's
   `title` and each definition's `primaryTitle`) and secondarily by
   `updatedAt` descending as a tie-breaker. The user originally proposed
   "most recently created first" but accepted the planner's recommendation
   to use fuzzy ranking with `updatedAt` as tie-breaker, because fuzzy
   ranking is a strict UX improvement over most-recent-first for the
   realistic case (a teacher with many definitions). See Decision 9 for
   the `fuse.js` integration details.
4. **Picker list contents.** Each row shows `primaryTitle` as the main label and
   `<primaryTopic> · <yearGroupLabel>` as a subtitle. The user explicitly
   approved this richer row content (the request said "list of titles" but the
   secondary text is a small UX improvement and does not change the contract).
5. **Already-linked definitions are shown but disabled.** A definition is
   considered "already linked" when any of the following are true (compared
   case-insensitive trimmed):
   - `partial.primaryTitle` equals the Google Classroom assignment's title;
   - `partial.alternateTitles` contains the Google Classroom title;
   - `partial.primaryTopic` equals the Google Classroom topic name (when the
     topic name is non-null);
   - `partial.alternateTopics` contains the Google Classroom topic name
     (when the topic name is non-null).

   The topic check is included for symmetry with the matcher relaxation
   (Decision 7): a definition whose topic is already covered would match the
   happy path in the future, so adding the same topic again would be a
   no-op and the row should not be selectable. Already-linked rows are still
   rendered (so the teacher can see what is already covered) but cannot be
   selected and carry a small "Already linked" annotation.

6. **Empty-picker handling.** If no definition matches the class's year group,
   the "Link to Existing Definition" button in the choice prompt is rendered
   disabled with a Tooltip explaining that there are no linkable definitions in
   the same year group. The "Create New Definition" button stays enabled.
7. **Matcher relaxation.** `findMatchingDefinition` is updated to use
   case-insensitive trimmed equality for both the title match (against
   `primaryTitle` and `alternateTitles`) and the topic match (against
   `primaryTopic` and, for the first time, `alternateTopics`). The user asked
   for the topic relaxation explicitly; the title relaxation is included for
   symmetry — it costs nothing and saves the same class of common errors. The
   case-insensitive trimmed comparison is the same primitive for both fields
   and is implemented as a small pure helper co-located with the matcher.
8. **Link write path.** The link is recorded by extending the existing
   `upsertAssignmentDefinition` payload to accept `alternateTitles` and
   `alternateTopics` in addition to the wizard's URL-shape fields. The backend
   transport validator already tolerates extra keys (its `_resolveAlternateTitles`
   helper preserves existing alternate titles when the field is omitted). The
   same is added for `alternateTopics`. No new endpoint, no new
   `ALLOWLISTED_METHOD_HANDLERS` entry.
9. **Fuzzy title ranking with `fuse.js`.** The picker sorts definitions by
   the `fuse.js` score between the Google Classroom assignment's `title` and
   each definition's `primaryTitle`, with `updatedAt` desc as a tie-breaker
   for definitions with the same score. `fuse.js` is a well-maintained
   fuzzy search library (https://fusejs.io) with built-in TypeScript types
   (v7+), no runtime dependencies, and ~12 kB gzipped bundle weight. It is
   the only new direct dependency added by this feature. The configuration:
   - `keys: ['primaryTitle']` — the score is computed against
     `primaryTitle` only; `alternateTitles` and `primaryTopic` are
     intentionally excluded from the ranking because the user said "sorting
     them in order of closest match between the Google Classroom
     assignment title and the AssignmentDefinition primary titles".
   - `threshold: 1.0` — fuse.js's `search()` method only returns items
     within the threshold; we set it to 1.0 to ensure all
     year-group-matching definitions are returned (and then ranked by
     score). This means a completely unrelated title still appears in the
     picker with a worse score; the user can always scroll past it.
   - `includeScore: true` — so the result includes the per-item score
     (useful for the tie-breaker logic and for debugging).
   - `ignoreLocation: true` — match anywhere in the title; the position
     of the match does not affect the score.

   The user's request said "if some sort of fuzzy/search/match library
   exists that's maintained and not going to be a huge effort to
   implement, then sorting them in order of closest match". `fuse.js` is
   exactly that library. The matcher relaxation (Decision 7) is
   complementary, not redundant: the matcher determines whether a match
   exists (binary), and the fuzzy ranking determines the picker's
   display order (ranked). A rephrased title like "Algebra HW" can both
   (a) match the happy path via the matcher relaxation when
   `alternateTitles` is updated to include it, and (b) be ranked near
   the top of the picker before the link is recorded.

10. **Post-link flow.** After the upsert call resolves successfully, the modal
    calls `startAssessmentRun` with the linked definition's `definitionKey`, the
    Google Classroom assignment's `assignmentId`, and the modal's `classId` —
    exactly the same call the matched-path and wizard-success paths make.
11. **Failure handling.** If the upsert call rejects, the modal shows an error
    Alert in the body and the picker remains closed; the footer shows a single
    Cancel button that closes the modal. The teacher can re-open the modal and
    try again. The modal also invalidates
    `queryClient.invalidateQueries({ queryKey: queryKeys.assignmentDefinitionPartials() })`
    on any upsert failure to defend against a stale cache (e.g. a definition
    that was deleted between picker render and upsert call would otherwise
    remain in the cached list until the next page-level refetch). The picker
    on the next modal open is built from the freshly-refetched partials. If
    the upsert resolves but `startAssessmentRun` rejects, the same error
    path is used (the link has been written; the user can re-open and retry
    the assessment run). This mirrors the existing wizard-creation error
    flow.
12. **State machine extension.** `noMatchResolution` is extended from
    `'idle' | 'choice' | 'creating'` to `'idle' | 'choice' | 'creating' |
'linking'`. The new `'linking'` sub-state covers the picker UI; the existing
    `assessmentState` machine (`'idle' | 'loading' | 'success' | 'error'`) is
    reused for the post-selection upsert + start-assessment run. The link flow
    does **not** use `flushSync` (unlike the wizard-create flow): the
    `flushSync` pattern in `handleWizardCreateSuccess` is needed to synchronously
    unmount a child component (the wizard modal) before the auto-assessment API
    call begins. The link flow has no such child component to unmount — the
    picker is a state branch inside the same `AssessTaskModal` — so React 18
    batching of the `assessmentState` transition is harmless.
13. **Cancel from picker.** Clicking the outer Cancel button while
    `noMatchResolution === 'linking'` and `assessmentState === 'idle'` returns
    the modal to `noMatchResolution === 'choice'` (mirrors the wizard-cancel
    path) so the teacher can pick a different action. Clicking Cancel while the
    upsert or assessment run is in flight closes the modal (mirrors the
    wizard-creation cancellation path).
14. **State reset on modal reopen.** The new `'linking'` state, the
    `selectedAssignmentForChoice` slot, and the `selectedDefinitionForLink`
    slot are all reset to their idle values when the modal re-opens, exactly
    like the existing `'creating'` and `hasCreateSucceeded` slots.

## Existing system constraints

### Backend or API constraints already in place

- `apiHandler` in `z_Api/z_apiHandler.js` is the sole transport entry point.
  `upsertAssignmentDefinition` is already allowlisted; the link flow reuses it.
- The trailing-underscore handler pattern in `z_Api/assignmentDefinitionTransport.js`
  already supports two payload shapes: the wizard URL-shape (with
  `referenceDocumentUrl` and `templateDocumentUrl`) and the ID-shape (with
  `referenceDocumentId`, `templateDocumentId`, and `documentType`). The link flow
  uses the ID-shape because it does not need to re-validate or re-parse
  documents.
- The `AssignmentDefinitionUpsertOrchestrator._resolveAlternateTitles` helper
  already preserves existing `alternateTitles` on update when the payload omits
  the field and normalises the array when it is provided. The new
  `_resolveAlternateTopics` helper mirrors this exact pattern.
- `AssignmentDefinition` (the model) already accepts `alternateTopics` in its
  constructor and serialises it via `toJSON()` and `toPartialJSON()`. The
  response mapper already includes `alternateTopics` in the canonical response.
  The orchestrator currently does not call `_resolveAlternateTopics` and so
  never writes a non-default value — this is the gap that gets closed.
- The transport validator in `z_Api/assignmentDefinitionValidation.js` does not
  reject extra fields. Adding `alternateTitles` and `alternateTopics` to the
  payload requires no transport validation change.
- The transport validator's ID-shape path requires
  `referenceDocumentId`, `templateDocumentId`, and `documentType` as strings.
  The cached `definitionPartials` already carry all three.

### Current data-shape constraints

- Cached `AssignmentDefinitionPartial` rows include
  `primaryTitle`, `primaryTopicKey`, `primaryTopic`, `yearGroupKey`,
  `yearGroupLabel`, `alternateTitles`, `alternateTopics`, `documentType`,
  `referenceDocumentId`, `templateDocumentId`, and ISO timestamps. This is
  sufficient to construct the link's upsert payload without an extra
  `getAssignmentDefinition` round-trip.
- The upsert orchestrator's `_hasDocumentIdChanges` returns `false` for an
  update that does not change the document IDs, so the existing task map is
  preserved and the document-modified timestamps are not refreshed. The link
  flow relies on this so the existing tasks are not invalidated.
- `Date` objects are prohibited in `google.script.run` return values. The
  existing `toTransportPartialRow_` helper already normalises `createdAt` and
  `updatedAt` to ISO strings on partial reads; the matcher uses only the string
  form.

### Frontend or consumer architecture constraints

- The frontend Zod `UpsertAssignmentDefinitionRequestSchema` is the wizard's
  URL-shape contract. It already requires `primaryTitle`, `primaryTopicKey`,
  and `yearGroupKey`; the link flow uses the same required-field set and
  _adds_ `referenceDocumentId`, `templateDocumentId`, `documentType`,
  `alternateTitles`, and `alternateTopics` as **optional** fields. The schema
  extension makes the existing required `referenceDocumentUrl` and
  `templateDocumentUrl` fields **optional** and uses a `superRefine` to enforce
  the URL-shape vs ID-shape mutual exclusion. `yearGroupKey` is **not** a new
  field in the extension — it is already required by the existing schema and
  remains required for the link flow (the picker filters to definitions whose
  `yearGroupKey` matches the class's `yearGroupKey`, so the value is always
  available).
- The picker reads from the existing `queryClient.getQueryData<AssignmentDefinitionPartial[]>(queryKeys.assignmentDefinitionPartials())`
  cache. The cache is populated by the existing `getAssignmentDefinitionPartials`
  query and re-populated on invalidation; the link flow does not add a new
  query.
- The picker must be rendered inside the existing `AssessTaskModal` rather than
  as a separate modal because the existing state machine
  (`noMatchResolution`) and `assessmentState` machine already model this
  flow's lifecycle.

## Domain and contract recommendations

### Why this approach is preferable

- **Single upsert endpoint, no new method entry.** The user wants to "add an
  entry to the alternateTitles and alternateTopics arrays" — the orchestrator's
  existing `_resolveAlternateTitles` helper already does this for `alternateTitles`,
  and the data shape for `alternateTopics` is identical. Adding a new endpoint
  would duplicate validation, persistence, and rollback logic for no benefit.
- **Case-insensitive trimmed equality is the smallest robust matcher relaxation.** Fuzzy
  matching would not be appropriate inside the matcher (which is binary —
  matched or no-match) but is appropriate for the picker's display order.
  See "Fuzzy title ranking" below. The relaxation is a 5-line change to the
  matcher.
- **Fuzzy title ranking with `updatedAt` tie-breaker puts the right definition
  at the top of the picker.** The matcher relaxation handles case- and
  whitespace-different titles, but fuzzy ranking via `fuse.js` (threshold
  1.0, score-only) additionally handles rephrased titles ("Algebra HW" vs
  "Algebra Homework") and partial overlaps. Definitions with the same
  score are tie-broken by `updatedAt` desc. This is a strict UX improvement
  over a most-recent-first ordering for the realistic case (a teacher with
  many definitions, where the most recently edited definition is often
  unrelated to the current Google Classroom assignment). `fuse.js` is a
  well-maintained library with TypeScript types, no runtime dependencies,
  and ~12 kB gzipped bundle weight — a small one-time cost.
- **Year-group filter on the picker prevents a no-op link.** The matcher
  requires `yearGroupKey` to match, so linking to a definition outside the
  class's year group would never be matched again. Filtering the picker to the
  matching year group is a small UI rule that prevents a future dead link.
- **Reusing the existing `assessmentState` machine keeps the surface small.**
  The post-selection upsert + start-assessment-run flow has the same
  loading/success/error shape as the post-wizard flow; reusing the state
  machine avoids a parallel state machine for the same lifecycle.

### Recommended data shapes

#### `LinkExistingDefinition` upsert request (frontend → backend)

The frontend Zod `UpsertAssignmentDefinitionRequestSchema` is extended. The link
flow sends the ID-shape payload:

```ts
{
  definitionKey: string;            // existing definition to update
  primaryTitle: string;             // unchanged
  primaryTopicKey: string;          // unchanged
  yearGroupKey: string;             // unchanged (and matches the class's year group)
  referenceDocumentId: string;      // unchanged
  templateDocumentId: string;       // unchanged
  documentType: 'SLIDES' | 'SHEETS';// unchanged
  alternateTitles: string[];        // existing alternates + the new Google Classroom title (deduplicated, case-insensitive)
  alternateTopics: string[];        // existing alternates when the Google Classroom topic name is null, or existing alternates + the new Google Classroom topic name (deduplicated, case-insensitive) when the topic name is non-null
}
```

Both `alternateTitles` and `alternateTopics` are **always sent as the full
array** (never omitted). Sending an empty array would clear the existing
alternates (the orchestrator's "preserve when omitted" rule only fires when
the field is missing from the payload). The link flow intentionally sends
the full array so that adding a new entry is always additive. The "empty
array" payload case is therefore an internal hazard the implementation must
avoid: when the Google Classroom topic name is `null`, the modal sends
`alternateTopics: existingAlternateTopics` (the unchanged existing array),
not `alternateTopics: []`.

The frontend Zod schema enforces the "either URL-shape or ID-shape" rule
(mutually exclusive; the link flow always uses the ID-shape). The schema
extension preserves the wizard's URL-shape contract.

#### `AssignmentDefinition` response

No change. The canonical response shape already includes
`alternateTitles` and `alternateTopics`. After the link upsert, the response
returned to the modal (and propagated to the React Query cache) includes the
new entries.

#### Picker row shape (frontend only, derived from `AssignmentDefinitionPartial`)

```ts
type LinkableDefinition = {
  definitionKey: string;
  primaryTitle: string;
  primaryTopic: string;
  yearGroupKey: string;
  yearGroupLabel: string;
  updatedAt: string; // ISO timestamp used for sort
  isAlreadyLinked: boolean; // derived per Decision 5: title or topic (case-insensitive trimmed) is already covered by the definition
  alternateTitles: string[];
  alternateTopics: string[];
  documentType: string;
  referenceDocumentId: string;
  templateDocumentId: string;
};
```

The picker derives this from the cached `AssignmentDefinitionPartial` row plus
the selected Google Classroom assignment. The derived list is memoised.

### Naming recommendation

Prefer:

- `linkableDefinitions` for the picker list (filter + sort applied to the
  cached partials).
- `selectedDefinitionForLink` for the slot that holds the picked definition
  inside the modal state.
- `_resolveAlternateTopics` for the new orchestrator method, mirroring
  `_resolveAlternateTitles`.
- `normaliseStringList` is a _candidate_ rename of the existing
  `normaliseAlternateTitles` in `AssignmentDefinitionValidation`. Renaming is
  out of scope for v1; the new method delegates to the existing one with a
  comment explaining the reuse.

Avoid:

- `addAlternateTitle` (would imply a new endpoint, which is unnecessary).
- `linkAssignment` (overloaded term — the picker is the link, not the
  assessment run).

### Validation recommendation

#### Frontend

- `alternateTitles` and `alternateTopics` Zod fields use
  `TrimmedNonEmptyStringSchema` (an array of trimmed non-empty strings). Empty
  arrays are allowed; missing fields are allowed (the orchestrator preserves
  the existing array).
- `referenceDocumentId`, `templateDocumentId`, `documentType` are required
  only when the URL fields are absent. The schema uses a `superRefine` to
  enforce the mutual exclusion. (See the schema shape in
  `Domain and contract recommendations` above.)
- The picker list is a frontend derivation; no Zod schema is needed. The
  underlying `AssignmentDefinitionPartial` is already Zod-validated at the
  transport boundary.

#### Backend

- The orchestrator reuses `validation.normaliseAlternateTitles` (the existing
  method) for both `alternateTitles` and `alternateTopics`. The method's
  semantics are generic — non-empty trimmed strings — and match the contract
  for both fields. The reuse is **safe** for the link flow's payload because
  the modal never adds an empty-string entry to either array: the Google
  Classroom title is a non-empty string by construction (the modal's
  `selectedAssignment.title` is required to be a non-empty string by the
  `GoogleClassroomAssignment` Zod schema), and the Google Classroom topic
  name is either added (when non-null) or skipped entirely (the
  `alternateTopics` array is left unchanged). A code comment in the
  orchestrator records the reuse.
- The transport validator in `z_Api/assignmentDefinitionValidation.js`
  requires no change. The existing
  `validateRequiredYearGroupKey_` is invoked for both the URL-shape and the
  ID-shape paths (`validateUpsertParameters_` calls it after the shape
  switch, and `validateWizardUpsertParameters_` calls it inline), so
  `yearGroupKey` is required for both. Extra keys (`alternateTitles`,
  `alternateTopics`) are tolerated; the existing ID-shape path already
  validates `referenceDocumentId`, `templateDocumentId`, and `documentType`
  as strings when the URL fields are absent.

### Display-resolution recommendation

- The picker list filters on `yearGroupKey` equality with the class's
  `yearGroupKey`. Definitions whose `yearGroupKey` is `null` (corrupt cache
  entry) are excluded; the existing `AssignmentDefinitionPartial` Zod schema
  enforces `TrimmedNonEmptyStringSchema` for `yearGroupKey` so this should be
  rare in practice, but a defensive filter is the right default.
- The picker list sorts by fuzzy title rank (per Decision 3 and Decision 9):
  primary sort is the `fuse.js` score on `primaryTitle`; secondary sort
  (tie-breaker for equal scores) is `updatedAt` descending using
  `localeCompare` on the ISO timestamp strings (lexicographic order matches
  chronological order for ISO 8601 with timezone). The `fuse.js` score is
  an implementation detail of the picker ordering and is not surfaced as a
  field on `LinkableDefinition`.
- The "already linked" derivation is:
  ```ts
  const titleMatches =
    caseInsensitiveTrimmedEquals(partial.primaryTitle, gcTitle) ||
    partial.alternateTitles.some((t) => caseInsensitiveTrimmedEquals(t, gcTitle));
  const topicMatches =
    gcTopicName !== null &&
    (caseInsensitiveTrimmedEquals(partial.primaryTopic, gcTopicName) ||
      partial.alternateTopics.some((t) => caseInsensitiveTrimmedEquals(t, gcTopicName)));
  const isAlreadyLinked = titleMatches || topicMatches;
  ```
- The `caseInsensitiveTrimmedEquals(a, b)` helper normalises both arguments
  via `a.trim().toLowerCase() === b.trim().toLowerCase()`. The normalisation
  is consistent with the existing backend
  `AssignmentDefinitionValidation.normaliseTitleForDuplicate` method
  (which uses `String(...).trim().toLowerCase()`) but is not shared across
  the backend / frontend boundary because (a) the matcher is a frontend
  pure helper with no backend dependency, and (b) `normaliseTitleForDuplicate`
  is a private method on a backend validation class.

## Feature architecture

### Placement

- **Modal state machine**: extended inside
  `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx` — no
  new modal, no new top-level component, no new feature directory.
- **Picker component**: a feature-local helper inside the modal feature:
  `src/frontend/src/features/classes/AssessTaskModal/LinkableDefinitionList.tsx`.
  This is a presentational component (no state, no side effects) that receives
  the derived `LinkableDefinition[]` and the current selection, and emits a
  `onSelect(definitionKey)` callback. The component is colocated with the
  modal so the picker reads in the same visual style as the rest of the modal.
  The presentational component has exactly one caller (`AssessTaskModal`) and
  is not promoted to a shared component per
  `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
  §3.4 (the rule is "extract a new helper only when repeated behaviour exists
  now, or a second in-scope caller is already accepted").
- **Matcher helper**: extended inside
  `src/frontend/src/features/classes/AssessTaskModal/matchDefinitionForAssignment.ts`.
  A small `caseInsensitiveTrimmedEquals(a, b)` helper is added in a new
  feature-local file
  `src/frontend/src/features/classes/AssessTaskModal/stringComparison.ts`;
  the helper is shared between the matcher and the picker derivation
  helper (`getLinkableDefinitionsForModal.ts`) and is **not** exported
  from the modal feature directory. The new file is colocated with the
  matcher per the shared-helpers extraction rule
  (`docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
  §3.4: "extract a new helper only when repeated behaviour exists
  now, or a second in-scope caller is already accepted").
- **Zod schema**: extended inside
  `src/frontend/src/services/assignmentDefinition/assignmentDefinition.zod.ts`.
  No new service file; the existing `upsertAssignmentDefinition` service
  function already passes the parsed payload to the backend, and the new fields
  ride along.
- **Backend orchestrator**: extended inside
  `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionUpsertOrchestrator.js`.
  The new `_resolveAlternateTopics` method is co-located with
  `_resolveAlternateTitles` and follows the same private-helper pattern.
- **No new backend transport file, no new allowlist entry, no new controller
  class.**

### Proposed high-level call tree

```text
AssessTaskModal (noMatchResolution === 'linking')
└── LinkableDefinitionList
    └── (renders rows from getLinkableDefinitionsForModal(partials, gcAssignment))
        └── onSelect(definitionKey) → AssessTaskModal.handleLinkConfirm(definitionKey)
            └── upsertAssignmentDefinition({ definitionKey, ..., alternateTitles, alternateTopics })
                └── AssignmentDefinitionUpsertOrchestrator.upsert
                    ├── validation.normaliseAlternateTitles(alternateTitles)
                    ├── _resolveAlternateTopics({ payload, isUpdate, existingDefinition })
                    │   └── validation.normaliseAlternateTitles(alternateTopics) // reuse
                    └── new AssignmentDefinition({ ..., alternateTopics: resolved })
            └── startAssessmentRun({ definitionKey, assignmentId, courseId })
                └── AssignmentController.startAssessmentRun → startProcessing → trigger
```

### Out of scope for this surface

- Creating a new `AssignmentDefinition` from the picker (the existing
  "Create New Definition" wizard path is the supported create flow).
- Editing any field of the chosen definition other than its
  `alternateTitles` and `alternateTopics` arrays.
- Removing or renaming existing alternate titles or topics (the picker only
  adds; it does not prune).
- Unlinking a previously-linked assignment.
- Linking across year groups (a deliberate filter — see Decision 2).
- Multi-selection of definitions (deliberately single — see Decision 1).
- Fuzzy matching in the matcher (binary match decision) — the matcher
  uses case-insensitive trimmed equality per Decision 7. Fuzzy
  ranking for picker display order is in scope per Decision 9.

## Data loading and orchestration

### Required datasets or dependencies

- `AssignmentDefinitionPartial[]` from the React Query cache
  (`queryKeys.assignmentDefinitionPartials()`) — already loaded by the
  existing modal's `getValidatedCachedData` helper.
- The selected `Assignment` (`{ assignmentId, title, topicId, topicName }`)
  from local modal state — already used by the matcher and the wizard.
- The class's `yearGroupKey` from the React Query cache
  (`queryKeys.classPartials()`) — already used by the matcher.

No new datasets, no new query keys, no new service functions.

### Prefetch or initialisation policy

#### Startup

- No change. The existing `getAssignmentDefinitionPartials` and
  `getABClassPartials` queries already run at startup and warm up the cache.

#### Feature entry

- No change. The modal already reads from the React Query cache for matching
  and wizard pre-population; the link picker reuses the same cache reads.

#### Manual refresh

- The link flow calls
  `queryClient.invalidateQueries({ queryKey: queryKeys.assignmentDefinitionPartials() })`
  immediately after the upsert resolves successfully, **before** calling
  `startAssessmentRun`. The invalidation is fire-and-forget (it is **not**
  awaited): the modal does not block on the partials refetch, because the
  assessment run must start as soon as the upsert completes and the partials
  refetch is for the next time the user opens the modal (or any other
  consumer reads the cache). The invalidation is the standard React Query
  post-mutation pattern; the wizard-success flow in
  `handleWizardCreateSuccess` follows the same pattern.

### Query or transport additions

- **Frontend Zod schema extension** in
  `src/frontend/src/services/assignmentDefinition/assignmentDefinition.zod.ts`
  to add `alternateTitles`, `alternateTopics`, `referenceDocumentId`,
  `templateDocumentId`, and `documentType` as optional fields, with a
  `superRefine` to enforce the URL-shape vs ID-shape mutual exclusion.
- **Frontend Zod spec update** in
  `src/frontend/src/services/assignmentDefinition/assignmentDefinition.zod.spec.ts`
  to cover the new fields and the mutual exclusion rule.
- **Frontend service no change** — `upsertAssignmentDefinition` already
  forwards the parsed payload to the backend; the new fields ride along.
- **Backend transport no change** — the existing
  `validateUpsertParameters_` already accepts the ID-shape payload.
- **Backend orchestrator addition** — a new private `_resolveAlternateTopics`
  method on `AssignmentDefinitionUpsertOrchestrator`, plus a one-line
  constructor call update to pass the resolved array to
  `new AssignmentDefinition({ ... })`.
- **Backend orchestrator test** — extend
  `tests/controllers/assignmentDefinitionController.upsert.test.js` with cases
  for the new method.
- **No allowlist entry, no new endpoint, no new controller class.**

## Core view model or behavioural model

### Suggested shape

The modal's `noMatchResolution` union becomes:

```ts
type NoMatchResolution = 'idle' | 'choice' | 'creating' | 'linking';
```

A new modal-state slot is added:

```ts
const [selectedDefinitionForLink, setSelectedDefinitionForLink] =
  useState<LinkableDefinition | null>(null);
```

A new derived value is computed inside the modal:

```ts
const linkableDefinitions = useMemo<LinkableDefinition[]>(() => {
  if (noMatchResolution !== 'linking' && noMatchResolution !== 'choice') return [];
  if (!classPartialForWizard?.yearGroupKey) return [];
  if (!selectedAssignmentForChoice) return [];
  return getLinkableDefinitionsForModal(
    definitionPartialsFromCache ?? [],
    classPartialForWizard.yearGroupKey,
    selectedAssignmentForChoice
  );
}, [
  noMatchResolution,
  classPartialForWizard,
  selectedAssignmentForChoice,
  definitionPartialsFromCache,
]);
```

### Derivation rules for `LinkableDefinition`

For each `AssignmentDefinitionPartial` in the cached list:

1. **Filter**: include only when `partial.yearGroupKey === classYearGroupKey`.
2. **Derive `isAlreadyLinked`** (per Decision 5):
   ```ts
   const titleMatches =
     caseInsensitiveTrimmedEquals(partial.primaryTitle, gcAssignment.title) ||
     partial.alternateTitles.some((t) => caseInsensitiveTrimmedEquals(t, gcAssignment.title));
   const topicMatches =
     gcAssignment.topicName !== null &&
     (caseInsensitiveTrimmedEquals(partial.primaryTopic, gcAssignment.topicName) ||
       partial.alternateTopics.some((t) =>
         caseInsensitiveTrimmedEquals(t, gcAssignment.topicName)
       ));
   const isAlreadyLinked = titleMatches || topicMatches;
   ```
3. **Sort** the filtered list by `fuse.js` title rank (per Decision 3 and
   Decision 9):
   - Primary sort: ascending `fuse.js` score (lower score = closer match).
   - Secondary sort (tie-breaker for equal scores): `updatedAt` desc.
     The `fuse.js` instance is built once per `getLinkableDefinitionsForModal`
     call (the function is pure and is called per modal render; building the
     instance per call is acceptable because the partials list is at most a
     few dozen rows and the build cost is small).
4. **Map** to the `LinkableDefinition` shape.

#### `getLinkableDefinitionsForModal` pure function

A new pure function lives at
`src/frontend/src/features/classes/AssessTaskModal/getLinkableDefinitionsForModal.ts`.
It is a peer to `findMatchingDefinition` and follows the same conventions: pure,
no I/O, no React, fully unit-testable. Its signature:

```ts
export function getLinkableDefinitionsForModal(
  definitionPartials: AssignmentDefinitionPartial[],
  classYearGroupKey: string,
  selectedAssignment: { title: string; topicName: string | null }
): LinkableDefinition[];
```

The function is placed in its own file (not inside `AssessTaskModal.tsx`) to
follow the same pattern as `findMatchingDefinition` and to enable independent
unit testing. The helper is a **feature-local** module — colocated with the
modal — and is not promoted to a shared utility because it has exactly one
caller. The
`docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
§9.13 entry is extended to record the new helper with status `Implemented`.

## Main user-facing surface specification

### Recommended components or primitives

- **Picker list**: a feature-local presentational component. A separate
  layout spec is produced for the new `LinkableDefinitionList` workflow
  surface. The contract for the component is "single selection, disabled
  rows for already-linked, accessible name per row, keyboard navigation
  consistent with the rest of the modal". The layout spec decides the
  exact Ant Design primitive and any custom styling. The current best
  guess is Ant Design's `Radio.Group` (or equivalent built-in primitive)
  over a custom implementation to reuse built-in single-selection,
  disabled, keyboard navigation, and accessibility behaviour; the layout
  spec is the authority on this.
- **Choice prompt buttons**: the existing "Create New Definition" + new
  "Link to Existing Definition" buttons in a `Space` (unchanged layout).
- **Tooltip on the disabled "Link to Existing Definition" button**: a `Tooltip`
  explaining why the button is disabled when no linkable definitions exist
  (the existing "Coming soon" `Tooltip` is removed).

### Fields, columns, or visible sections

1. **Choice prompt (no-match)**: `Alert` (no-match explanation) +
   `Button` (Create New Definition) + `Button` (Link to Existing Definition).
2. **Picker (linking state)**: `Alert` (no-match explanation, persistent across
   the picker state so the user retains the context) + `LinkableDefinitionList`
   - `Button` (Link) + `Button` (Cancel). The Link button is disabled until a
     non-already-linked row is selected.
3. **Post-link loading**: the picker is hidden; a `Spin` occupies the body.
4. **Post-link success**: a success `Alert` ("Assessment started for ...")
   replaces the body; footer shows a single Close button.
5. **Post-link error**: an error `Alert` replaces the body; footer shows a
   single Cancel button.

### Sorting, filtering, or navigation rules

- See "Derivation rules for `LinkableDefinition`" above. The list is
  filtered by year group and sorted by **fuzzy title rank** (primary;
  via `fuse.js` per Decision 9) with **`updatedAt` desc as
  tie-breaker** for definitions with the same score. There is no
  in-list search or filter (the list is expected to be small — one or
  two dozen rows at most — and adding a search box would be
  speculative scope).

### Rendering rules

#### `noMatchResolution === 'linking'` and `assessmentState === 'idle'`

- The body renders the picker (Alert + LinkableDefinitionList + Link + Cancel).
- The Link button is disabled until a non-already-linked row is selected.
- The Cancel button returns the modal to `'choice'`.

#### `noMatchResolution === 'linking'` and `assessmentState === 'loading'`

- The body renders a `Spin` (consistent with the wizard-creation loading
  state). The picker is hidden.

#### `noMatchResolution === 'linking'` and `assessmentState === 'success'`

- The body renders a success `Alert` with the selected Google Classroom
  assignment's title.
- The footer renders a single Close button.

#### `noMatchResolution === 'linking'` and `assessmentState === 'error'`

- The body renders an error `Alert` with the error message.
- The footer renders a single Cancel button (closes the modal).

## Workflow specification

## Link to Existing Definition

### Eligible inputs or preconditions

- The user clicked the "Link to Existing Definition" button in the choice
  prompt. This transitions `noMatchResolution` to `'linking'`.
- The cached `AssignmentDefinitionPartial[]` is non-empty.
- At least one cached partial matches the class's `yearGroupKey`.

### Inputs, fields, or confirmation copy

- The picker list is a derived view; no user input other than selection.
- The picker List shows `primaryTitle` as the main label and
  `<primaryTopic> · <yearGroupLabel>` as a subtitle, with the
  "Already linked" annotation for non-selectable rows.

### Behaviour

1. **Selection**: clicking a non-already-linked row highlights it and enables
   the Link button. Clicking an already-linked row does nothing.
2. **Confirm**: clicking Link transitions `assessmentState` to `'loading'` and
   calls `upsertAssignmentDefinition` with the ID-shape payload. The payload
   includes:
   - `definitionKey` from the selected row
   - `primaryTitle`, `primaryTopicKey`, `yearGroupKey`, `documentType`,
     `referenceDocumentId`, `templateDocumentId` from the cached partial
   - `alternateTitles` = deduped union of the existing `alternateTitles` and
     the Google Classroom title (case-insensitive trimmed equality)
   - `alternateTopics` = deduped union of the existing `alternateTopics` and
     the Google Classroom topic name (case-insensitive trimmed equality), or
     the existing `alternateTopics` unchanged when the Google Classroom topic
     name is `null`
3. **Post-upsert success**: the modal invalidates
   `queryKeys.assignmentDefinitionPartials()` and then calls
   `startAssessmentRun` with the linked definition's `definitionKey`, the
   Google Classroom `assignmentId`, and the modal's `classId`.
4. **Post-assessment-run success**: `assessmentState` becomes `'success'`. The
   body shows a success `Alert`; the footer shows a Close button.
5. **Failure path (any step)**: `assessmentState` becomes `'error'`. The body
   shows the error `Alert`; the footer shows a Cancel button. Clicking Cancel
   closes the modal. Re-opening the modal lets the teacher retry.

## Cancel from picker

### Eligible inputs or preconditions

- `noMatchResolution === 'linking'` and `assessmentState === 'idle'`.

### Behaviour

- The modal returns to `noMatchResolution === 'choice'` so the teacher can
  pick a different action (Create New Definition, Link to Existing, or close
  the modal).
- `selectedDefinitionForLink` is reset to `null`.

## Error, loading, and empty-state rules

### Blocking failure

- **Upsert validation error (INVALID_REQUEST)**: the modal shows an error
  `Alert` with the backend's `error.message` text. The picker is hidden; the
  footer shows Cancel. (Same path as any other `ApiValidationError`.)
- **Upsert INTERNAL_ERROR**: same as above; `error.message` is the canonical
  "Internal API error." string.
- **startAssessmentRun DEFINITION_STALE**: the modal shows a warning `Alert`
  with the backend's `error.message` text. (The link has been written; the
  teacher can re-open the modal to retry the assessment run.)
- **startAssessmentRun other errors**: error `Alert` with the backend's
  `error.message` text.

### Partial-load or partial-success failure

- Not applicable. The link flow is single-shot: upsert, then start-assessment
  run. The picker is hidden during both calls; there is no partial-state UI.

### Empty states

#### Empty picker (no matching year group)

- The "Link to Existing Definition" button in the choice prompt is rendered
  disabled with a `Tooltip` explaining that there are no linkable definitions
  in the same year group as the current class. The "Create New Definition"
  button stays enabled.
- The "Already linked" filter is independent of the year-group filter; the
  picker can still show the "every row is already linked" case. In that
  case, the Link button is rendered disabled with a `Tooltip` explaining
  that every matching definition is already linked to this Google Classroom
  assignment.

#### Empty assignments list (pre-no-match)

- Unchanged. The existing `<Empty description="No assignments found for this
class" />` continues to render.

## Accessibility and usability notes

- The "Link to Existing Definition" button in the choice prompt keeps the
  same keyboard-focus behaviour as the existing "Create New Definition"
  button. `Tab` moves focus between them in DOM order.
- The picker's rows are keyboard-navigable: `Tab` moves focus into the list,
  `Arrow` keys move focus between rows, `Enter` (or `Space`) confirms the
  selection. The disabled rows are reachable by `Tab` but cannot be
  activated. The Link button is reachable by `Tab` after the list and is
  disabled until a valid row is selected.
- The disabled "Link to Existing Definition" button's `Tooltip` is keyboard
  accessible — the same focus-then-hover pattern as the existing
  "Coming soon" `Tooltip`.
- The picker's "Already linked" annotation is rendered as visible text, not
  tooltip-only information, per the accessibility rule of thumb.
- The error `Alert` is the top-level `Alert` pattern mandated by
  `src/frontend/AGENTS.md` §5.1.

## Backend changes required

1. **`AssignmentDefinitionUpsertOrchestrator` — new private
   `_resolveAlternateTopics` method.**
   - Mirrors `_resolveAlternateTitles` line for line.
   - Uses `validation.normaliseAlternateTitles(payload.alternateTopics)` —
     this method is reused. A code comment in the new method records the
     reuse: the validation is identical (non-empty trimmed strings) and a
     parallel method would duplicate logic.
   - Preserves the existing `alternateTopics` on update when the payload omits
     the field.
2. **`AssignmentDefinitionUpsertOrchestrator.upsert` — one-line addition.**
   - Pass `alternateTopics: this._resolveAlternateTopics({ payload, isUpdate,
existingDefinition })` to the `new AssignmentDefinition({ ... })`
     constructor call.
3. **No new error types, no new transport file, no new allowlist entry.**
4. **No new manifest scope or service change in `appsscript.json`.**
5. **Test surface.**
   - Extend
     `tests/controllers/assignmentDefinitionController.upsert.test.js` with a
     small new `describe` block for `_resolveAlternateTopics`. Cases:
     preserve-when-omitted, normalise-when-provided, reject-non-array,
     reject-non-string-entry, reject-empty-string-entry.
   - Existing tests for `_resolveAlternateTitles` (preserve-when-omitted,
     etc.) double as contract references and should be mirrored.

## Frontend changes required

1. **`findMatchingDefinition` matcher — case-insensitive trimmed equality +
   `alternateTopics` lookup.**
   - Add a small private `caseInsensitiveTrimmedEquals(a, b)` helper.
   - Replace the strict equality and `Array.includes` calls with the relaxed
     predicate for both title and topic.
   - Extend the topic filter to also check `partial.alternateTopics.some(t =>
caseInsensitiveTrimmedEquals(t, selectedAssignment.topicName))`.
   - The `MatchResult` discriminated union shape does not change.
2. **`getLinkableDefinitionsForModal` — new pure helper.**
   - Lives at
     `src/frontend/src/features/classes/AssessTaskModal/getLinkableDefinitionsForModal.ts`.
   - Peer to `findMatchingDefinition`; follows the same conventions (pure, no
     I/O, no React).
   - Imported by `AssessTaskModal` for the picker.
3. **`LinkableDefinitionList` — new presentational component.**
   - Lives at
     `src/frontend/src/features/classes/AssessTaskModal/LinkableDefinitionList.tsx`.
   - Receives `linkableDefinitions`, `selectedDefinitionKey`, `onSelect`, and a
     stable `id` prefix for accessibility.
   - Renders rows as radio-style buttons. The exact Ant Design primitive is
     deferred to the layout spec; the contract is "single selection, disabled
     rows for already-linked, accessible name per row".
4. **`UpsertAssignmentDefinitionRequestSchema` Zod schema — extension.**
   - Add `alternateTitles`, `alternateTopics`, `referenceDocumentId`,
     `templateDocumentId`, `documentType` as optional fields.
   - Use a `superRefine` to enforce the mutual exclusion (URL-shape vs
     ID-shape).
5. **`AssessTaskModal` — state machine and body/footer extensions.**
   - Extend `noMatchResolution` union to include `'linking'`.
   - Add `selectedDefinitionForLink` state slot.
   - Add `handleLinkExistingDefinition`, `handleLinkConfirm`,
     `handleLinkCancel` async/sync functions.
   - Extend `renderBody` to render the picker in the `'linking'` branch.
   - Extend `getFooterContent` to render Link + Cancel in the `'linking'` +
     `'idle'` branch (mirrors the wizard footer pattern).
   - Reset `selectedDefinitionForLink` on modal open, on Cancel from
     picker, and on assessment-state transitions to `success` (closes modal).
   - Invalidate `queryKeys.assignmentDefinitionPartials()` after a successful
     upsert.
6. **Test surface.**
   - **Matcher unit tests** — extend
     `matchDefinitionForAssignment.spec.ts` with cases that verify
     case-insensitive trimmed equality and the new `alternateTopics` lookup.
   - **Picker helper unit tests** — new
     `getLinkableDefinitionsForModal.spec.ts` covering: year-group filter,
     **fuzzy title rank with `updatedAt` desc tie-breaker** (with
     explicit cases for: exact match ranks first; close rephrasing
     ranks second; unrelated title still appears with a worse score
     — `threshold: 1.0`; `updatedAt` desc tie-breaker for equal
     scores), "already linked" derivation (with explicit cases for
     primaryTitle match, alternateTitles match, primaryTopic match when topic
     non-null, alternateTopics match when topic non-null, and the
     "topicName is null" branch where the topic-based check is skipped), and
     empty-input cases (empty `definitionPartials`, null year group).
   - **Modal Vitest component tests** — extend `AssessTaskModal.spec.tsx`
     with cases for: button enablement when picker is non-empty, button
     disablement with tooltip when picker is empty, picker row rendering
     with subtitle, "already linked" disabled row, confirm flow
     (mocked upsert + mocked startAssessmentRun), upsert-failure error
     state, startAssessmentRun-failure error state, Cancel from picker
     returns to choice, state reset on modal reopen.
   - **Shared test utilities** — extend
     `src/frontend/src/test/classes/AssessTaskModal.test-utilities.tsx`
     with a `linkableDefinition` fixture factory and a `clickLinkToExisting`
     interaction helper.
   - **Playwright e2e** — add tests to
     `src/frontend/e2e-tests/classes-page-assess-task.spec.ts` for: the
     "Link to Existing Definition" button transitions to the picker; the
     picker renders with the expected filter and fuzzy sort (closest
     primaryTitle at the top, `updatedAt` tie-breaker); clicking a row
     and confirming calls `upsertAssignmentDefinition` and then
     `startAssessmentRun`; Cancel returns to the choice prompt; the modal
     state resets on reopen. The `RuntimeScenario` type already includes
     `upsertAssignmentDefinition` and `getAssignmentDefinition`, so no
     runtime-mock changes are required.

## Planning handoff notes

- The matcher relaxation is a deliberate, scoped change. It changes the
  behaviour of `findMatchingDefinition` for all callers. A repository-wide
  grep for `findMatchingDefinition` identified exactly four call sites, all
  inside the AssessTask feature:
  - `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`
    (the only production call site, in `handleStartAssessment`).
  - `src/frontend/src/features/classes/AssessTaskModal/matchDefinitionForAssignment.spec.ts`
    (the matcher's unit tests — 10 call sites).
  - `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.spec.tsx`
    (mocks `findMatchingDefinition` via `vi.mock`).
  - `src/frontend/src/test/classes/AssessTaskModal.test-utilities.tsx`
    (re-exports `findMatchingDefinition` for the modal spec to mock via
    `vi.mocked`).
    No production code outside the AssessTask feature depends on the matcher.
    The existing matcher tests use matching-case inputs (e.g.
    `partial.primaryTitle = 'Essay'` and `selectedAssignment.title = 'Essay'`),
    so they continue to pass under the relaxed comparator. The matcher spec is
    **extended** with new cases for case-different and whitespace-different
    inputs and for the new `alternateTopics` lookup; existing cases are not
    modified.
- The frontend Zod schema extension uses a `superRefine` to enforce the
  URL-shape vs ID-shape mutual exclusion. The wizard's existing payload
  passes this rule (it always sends the URL fields), so no wizard change is
  required.
- The orchestrator's `_resolveAlternateTopics` is a pure helper that mirrors
  `_resolveAlternateTitles`. The duplication is intentional and small; a
  future refactor could rename `normaliseAlternateTitles` to
  `normaliseTrimmedStringArray` and avoid the alias comment, but that rename
  is out of scope for v1.
- The modal state machine extension adds one new branch (`'linking'`) to an
  existing union. The new branch is exercised in unit tests and e2e tests.
  The `assessmentState` machine is reused without changes.
- The picker's `LinkableDefinitionList` is a feature-local component
  colocated with the modal. It is not promoted to a shared component because
  there is no second in-scope caller (per
  `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
  §3.4: "extract a new helper only when repeated behaviour exists now, or a
  second in-scope caller is already accepted").
- The backend transport validator in
  `z_Api/assignmentDefinitionValidation.js` requires no change. The existing
  ID-shape path already validates the link flow's payload. The new optional
  `alternateTitles` and `alternateTopics` fields are tolerated as extras.
- The new test for `_resolveAlternateTopics` is colocated with the existing
  upsert controller tests and follows the same Vitest patterns.
- The new direct dependency `fuse.js` is added to
  `src/frontend/package.json`. The lockfile must be regenerated
  (`npm install`) after the package.json change. The `fuse.js` import
  is confined to `getLinkableDefinitionsForModal.ts`; no other file
  in the modal feature directory imports `fuse.js`. The matcher
  and the picker's "already linked" derivation continue to use the
  `caseInsensitiveTrimmedEquals` helper, which is unrelated to
  `fuse.js`.
- The `getLinkableDefinitionsForModal` is called per modal render
  (via `useMemo` with the partials cache and the selected Google
  Classroom assignment as dependencies). The `fuse.js` instance is
  built per call; the per-call cost is small (a few dozen partials)
  and matches the existing pattern of building derived data per
  render.

## Testing expectations

- **Backend unit tests** —
  `tests/controllers/assignmentDefinitionController.upsert.test.js` extends
  with `_resolveAlternateTopics` cases (preserve-when-omitted,
  normalise-when-provided, reject-non-array, reject-non-string-entry,
  reject-empty-string-entry). The existing
  `_assertNoDuplicateBusinessTuple` and `normaliseAlternateTitles` tests
  remain unchanged.
- **Backend transport tests** — none. The transport validator is unchanged.
  The existing
  `tests/api/assignmentDefinitionUpsertApi.test.js` already covers the
  ID-shape path.
- **Frontend unit tests** —
  `matchDefinitionForAssignment.spec.ts` extends with the case-insensitive
  trimmed equality cases and the new `alternateTopics` lookup cases.
  `getLinkableDefinitionsForModal.spec.ts` is a new file with the
  derivation cases, including the new fuzzy ranking cases (closest
  primaryTitle ranks higher, `updatedAt` desc is the tie-breaker for
  equal scores, a completely unrelated title still appears with a worse
  score). `AssessTaskModal.spec.tsx` extends with the picker integration
  cases.
- **Frontend Zod tests** —
  `assignmentDefinition.zod.spec.ts` extends with cases for the new
  optional fields and the `superRefine` mutual-exclusion rule.
- **Frontend e2e** — `classes-page-assess-task.spec.ts` extends with the
  picker flow cases.
- **Contract / regression coverage** — the existing
  `assignmentDefinitionController.upsert.test.js` continues to pass without
  modification; the new tests are additive.
- **Partial-transport contract guard** — the existing
  `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartialsContract.guard.spec.ts`
  validates the registry shape of `AssignmentDefinitionPartial` and includes
  `alternateTopics` in its required-field check (lines 14, 42). The matcher
  now reads `alternateTopics` from partials, so the guard test is the
  upstream invariant that guarantees the field is present. The spec does
  **not** change the partial response shape, so the guard test continues to
  pass without modification; it is cited here as a regression sentinel.

## Documentation and rollout notes

- **`docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`**
  §9.13 is extended with the new `getLinkableDefinitionsForModal` entry,
  including a note that the helper uses `fuse.js` (declared in
  `src/frontend/package.json` as a direct dependency) for fuzzy title
  ranking with `updatedAt` desc as the tie-breaker. A new §9.16 records
  `caseInsensitiveTrimmedEquals` as a feature-local helper.
- **`docs/developer/backend/DATA_SHAPES.md`** — three updates:
  1. The existing entry for the partial response shape (line 585) describes
     `alternateTopics` as "present in partial responses for registry
     compatibility, even though it is not part of the greenfield upsert
     request contract". This line is updated to reflect that `alternateTopics`
     is now a documented optional field in the upsert request contract and
     is written by the orchestrator on update when provided.
  2. The existing `upsertAssignmentDefinition` request shape section
     (around line 588-639) is extended to document the new optional
     `alternateTopics` field alongside the existing optional `alternateTitles`
     field, with the same contract (non-empty trimmed strings, deduplicated
     on merge).
  3. The transport validation entry for the ID-shape path is updated to
     document the new `superRefine` mutual-exclusion rule (URL-shape vs
     ID-shape).
- **`docs/developer/backend/api-layer.md`** — the existing
  "Optional request fields" line on `upsertAssignmentDefinition` (around
  line 342) is already accurate for `alternateTitles`. The new optional
  `alternateTopics` field is added to the same line. The mutual-exclusion
  rule between URL-shape and ID-shape is added to the "Validation split"
  paragraph.
- **No docs changes for the modal patterns doc** — the picker is a
  feature-local addition to an existing modal, not a new modal family.
- **No migration / rollout concern** — the matcher relaxation makes the
  wizard take the happy path for some previously-no-match cases, but this
  is forward-compatible (the relaxation is a strict superset of the strict
  equality). The link write is opt-in (the user must click Link).

## V1 scope recommendation

### Include in v1

- New `'linking'` sub-state in the `AssessTaskModal` state machine.
- New `LinkableDefinitionList` presentational component.
- New `getLinkableDefinitionsForModal` pure helper (uses `fuse.js` for
  fuzzy title ranking).
- New `caseInsensitiveTrimmedEquals` feature-local helper in
  `stringComparison.ts` (shared between the matcher and the picker
  derivation helper).
- New direct dependency `fuse.js` in `src/frontend/package.json`
  (declared as a dependency; locked in `src/frontend/package-lock.json`).
- Matcher relaxation: case-insensitive trimmed equality for title and topic;
  `alternateTopics` lookup.
- Frontend Zod `UpsertAssignmentDefinitionRequestSchema` extension
  (`alternateTitles`, `alternateTopics`, ID-shape fields, mutual-exclusion
  `superRefine`).
- Backend `AssignmentDefinitionUpsertOrchestrator` `_resolveAlternateTopics`
  method and the one-line constructor call.
- Test surface: backend controller unit tests, frontend matcher and picker
  helper unit tests, frontend Zod tests, frontend modal Vitest tests,
  Playwright e2e tests.
- Documentation updates to the shared-helpers doc, the DATA_SHAPES doc, and
  the api-layer doc.

### Defer from v1

- Multi-selection of definitions (deliberately single in v1 per Decision 1).
- Fuzzy matching in the matcher (deliberately case-insensitive trimmed
  equality in v1 per Decision 7). The picker's fuzzy ranking (per
  Decision 9) is in scope for v1.
- In-picker search/filter input.
- Unlinking a previously-linked assignment.
- Renaming `normaliseAlternateTitles` to `normaliseTrimmedStringArray` to
  remove the alias comment.
- A dedicated `addAlternateTitle` backend endpoint.
- Year-group-aware matching in the picker beyond the simple year-group
  filter (e.g. showing a count of how many definitions are excluded).

## Resolved decisions

1. **Single-selection picker** (confirmed by the user; rationale: matches the
   singular "in the AssignmentDefinition" wording in the request; smaller
   change; no extra decision about which of N to start the assessment
   against).
2. **Picker row contents: `primaryTitle` + `<primaryTopic> · <yearGroupLabel>`
   subtitle** (confirmed by the user; rationale: secondary text helps the
   teacher identify the right definition at a glance).
3. **Picker filter: same `yearGroupKey` as the class** (confirmed by the
   user; rationale: guarantees the link is useful because the matcher
   requires year-group match).
4. **Picker sort: fuzzy title rank via `fuse.js` with `updatedAt` desc
   tie-breaker** (confirmed by the user; rationale: the user originally
   offered "most recently created first" or "fuzzy match if a maintained
   library exists" as the two options. `fuse.js` is exactly such a
   library, and is added to `src/frontend/package.json` as the only new
   direct dependency for this feature).
5. **Matcher relaxation: case-insensitive trimmed equality for both title
   and topic, plus `alternateTopics` lookup** (confirmed by the user;
   rationale: the user explicitly asked for the topic relaxation; the title
   relaxation is included for symmetry at zero cost).
6. **No new backend endpoint** (rationale: the existing
   `upsertAssignmentDefinition` is the only mutator; the orchestrator
   already supports the `alternateTitles` field, and the data shape for
   `alternateTopics` is identical).
7. **Post-link auto-start** (rationale: the user said "the assessment
   begins" after linking; the existing wizard-success flow is the
   reference).
8. **Failure closes the modal on Cancel** (rationale: mirrors the existing
   wizard-creation error flow).

## Open questions

None. The user has confirmed the two material decisions (single-selection
picker, row content + filter + sort) and one explicit behaviour
relaxation (case-insensitive trimmed topic match, extended by symmetry to
title match). All remaining choices follow the existing patterns in the
repo and are recorded as decisions in this document.
