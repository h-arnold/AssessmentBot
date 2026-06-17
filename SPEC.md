# AssessTask "Link to Existing Definition" Path Specification

## Status

- Approved v1.0

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
  trimmed equality per Decision 6. (Fuzzy ranking is used for the
  picker's _display order_ per Decision 8, which is a separate concern
  from the matcher's match/no-match decision.);
- resolve the `'ambiguous'` match case — the matcher returns
  `{ kind: 'ambiguous' }` when multiple definitions match; that path is
  handled by the existing error Alert flow and is unchanged by this
  feature. The link-to-existing flow only triggers on
  `{ kind: 'no-match' }`;
- allow linking more than one definition per Google Classroom assignment — the
  stakeholder confirmed single-selection;
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
   realistic case (a teacher with many definitions). See Decision 8 for
   the `fuse.js` integration details.
4. **Picker list contents.** Each row shows `primaryTitle` as the main label and
   `<primaryTopic> · <yearGroupLabel>` as a subtitle. The user explicitly
   approved this richer row content (the request said "list of titles" but the
   secondary text is a small UX improvement and does not change the contract).
5. **Empty-picker handling.** If no definition matches the class's year group,
   the "Link to Existing Definition" button in the choice prompt is rendered
   disabled with a Tooltip explaining that there are no linkable definitions in
   the same year group. The "Create New Definition" button stays enabled.
6. **Matcher relaxation.** `findMatchingDefinition` is updated to use
   case-insensitive trimmed equality for both the title match (against
   `primaryTitle` and `alternateTitles`) and the topic match (against
   `primaryTopic` and, for the first time, `alternateTopics`).
   The existing early return for `selectedAssignment.topicName === null`
   is **preserved**: a Google Classroom assignment without a topic
   cannot match any definition (definitions always have string topics,
   never null). The stakeholder asked for the topic relaxation
   explicitly; the title relaxation is included for symmetry — it costs
   nothing and saves the same class of common errors. The
   case-insensitive trimmed comparison is the same primitive for both
   fields and is implemented as a small pure helper co-located with the
   matcher.

   The supplementary `alternateTopics` topic check only runs when
   `topicName !== null`; the early return for `topicName === null` is
   unchanged.

7. **Link write path.** The link is recorded by extending the existing
   `upsertAssignmentDefinition` payload to accept `alternateTitles` and
   `alternateTopics` in addition to the wizard's URL-shape fields. The backend
   transport validator already tolerates extra keys (its `_resolveAlternateTitles`
   helper preserves existing alternate titles when the field is omitted). The
   same is added for `alternateTopics`. No new endpoint, no new
   `ALLOWLISTED_METHOD_HANDLERS` entry.
8. **Fuzzy title ranking with `fuse.js`.** The picker sorts definitions by
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
   exactly that library. The matcher relaxation (Decision 6) is
   complementary, not redundant: the matcher determines whether a match
   exists (binary), and the fuzzy ranking determines the picker's
   display order (ranked). A rephrased title like "Algebra HW" can both
   (a) match the happy path via the matcher relaxation when
   `alternateTitles` is updated to include it, and (b) be ranked near
   the top of the picker before the link is recorded.

9. **Post-link flow.** After the upsert call resolves successfully, the modal
   calls `startAssessmentRun` with the linked definition's `definitionKey`, the
   Google Classroom assignment's `assignmentId`, and the modal's `classId` —
   exactly the same call the matched-path and wizard-success paths make.
10. **Failure handling.**
    - **Upsert failure**: the modal shows an error Alert in the body and the
      picker remains closed; the footer shows a single Cancel button that
      closes the modal. The teacher can re-open the modal and try again.
      The modal also invalidates
      `queryClient.invalidateQueries({ queryKey: queryKeys.assignmentDefinitionPartials() })`
      on any upsert failure to defend against a stale cache (e.g. a definition
      that was deleted between picker render and upsert call would otherwise
      remain in the cached list until the next page-level refetch). The picker
      on the next modal open is built from the freshly-refetched partials.
    - **Upsert succeeds but `startAssessmentRun` rejects with a recoverable
      error** (e.g. `DEFINITION_STALE`): the link (the alternateTitle write)
      is **preserved** — the teacher's intent to link is kept. Instead of
      showing an error Alert, the modal transitions to the **wizard's 2nd
      panel** (task weightings), with the document re-parsed and
      pre-populated from the stale definition's data. The teacher can adjust
      weightings and submit. This mirrors the existing behaviour when the
      wizard path encounters `DEFINITION_STALE`: the re-parsed wizard panel
      is opened regardless of whether the stale definition was reached via
      the link flow or the standard wizard flow.

      Implementation note: the `AssignmentDefinitionWizardModal` currently
      opens at panel 1 (title/topic). For `DEFINITION_STALE` recovery, the
      wizard needs a new prop — e.g. `initialPanel={2}` or
      `mode="stale-recovery"` — that causes it to skip directly to the task
      weightings panel with the stale definition's data pre-populated. This
      is a new wizard entry point, not an existing one. The SPEC's phrase
      "mirrors the existing behaviour" refers to the _outcome_ (re-parsed
      document, pre-populated weightings), not the entry mechanism.

    - **Upsert succeeds but `startAssessmentRun` rejects with a non-recoverable
      error**: the existing error path is used (error Alert, Cancel button).

11. **State machine extension.** `noMatchResolution` is extended from
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
12. **`hasLinkSucceeded` flag.** A new `hasLinkSucceeded` boolean state slot is
    added to the modal, analogous to `hasCreateSucceeded`. It is set to `true`
    after the upsert resolves successfully (before calling
    `startAssessmentRun`). It is reset to `false` on modal reopen, on Cancel
    from the picker (before upsert), and when `noMatchResolution` leaves the
    `'linking'` state. The flag distinguishes "user cancelled before the upsert"
    from "upsert committed, assessment run is in flight or has completed".
13. **Cancel from picker.** Clicking the outer Cancel button while
    `noMatchResolution === 'linking'` and `assessmentState === 'idle'` returns
    the modal to `noMatchResolution === 'choice'` (mirrors the wizard-cancel
    path) so the teacher can pick a different action. Clicking Cancel while the
    upsert or assessment run is in flight closes the modal (mirrors the
    wizard-creation cancellation path).
14. **State reset on modal reopen.** The new `'linking'` state, the
    `selectedAssignmentForChoice` slot, and the `selectedDefinitionForLink`
    slot are all reset to their idle values when the modal re-opens, exactly
    like the existing `'creating'` and `hasCreateSucceeded` slots. The
    `hasLinkSucceeded` flag is also reset to `false` on modal reopen.

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
  `referenceDocumentId` and `templateDocumentId` as strings, and the
  orchestrator's `_resolveDocumentType` handles `documentType` with a
  fallback to the existing definition's value for updates (it is not
  validated at the transport layer). The cached `definitionPartials`
  already carry all three fields.

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
  enforce the mutual exclusion: the payload must include **either** both
  `referenceDocumentUrl` and `templateDocumentUrl` (wizard shape) **or**
  `referenceDocumentId`, `templateDocumentId`, and `documentType`
  (ID shape, used by the link flow). A payload with neither shape, only
  partial URL fields, or only partial ID fields is rejected. The wizard's
  existing payload (always providing both URL fields and no ID fields)
  continues to pass without modification.
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
- The picker list sorts by fuzzy title rank (per Decision 3 and Decision 8):
  primary sort is the `fuse.js` score on `primaryTitle`; secondary sort
  (tie-breaker for equal scores) is `updatedAt` descending using
  `localeCompare` on the ISO timestamp strings (lexicographic order matches
  chronological order for ISO 8601 with timezone). The `fuse.js` score is
  an implementation detail of the picker ordering and is not surfaced as a
  field on `LinkableDefinition`.
- No `isAlreadyLinked` derivation is performed. Every definition that passes
  the year-group filter is selectable in the picker. The Link button is
  enabled once the teacher makes a selection. The "already linked" concept
  is dropped as redundant with the matcher's binary match decision: if the
  matcher already found a match (`'matched'` or `'ambiguous'`), the link
  flow would not be triggered; if the matcher returned `'no-match'`, then
  no definition currently covers the assignment's title+topic combination,
  so every definition in the picker is a valid link target.

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
  the helper is exported from `stringComparison.ts` for internal feature
  use by both the matcher and the picker derivation helper
  (`getLinkableDefinitionsForModal.ts`), but is not re-exported from a
  feature barrel or public index. The helper is imported via relative
  path (`'./stringComparison'`) by both sibling consumers. The new file
  is colocated with the matcher per the shared-helpers extraction rule
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
                ├── (on DEFINITION_STALE) → open wizard 2nd panel with re-parsed document
                └── (on success) → success Alert
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
  uses case-insensitive trimmed equality per Decision 6. Fuzzy
  ranking for picker display order is in scope per Decision 8.

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

A new `hasLinkSucceeded` boolean state slot is added:

```ts
const [hasLinkSucceeded, setHasLinkSucceeded] = useState(false);
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
2. **Sort** the filtered list by `fuse.js` title rank (per Decision 3 and
   Decision 8):
   - Primary sort: ascending `fuse.js` score (lower score = closer match).
   - Secondary sort (tie-breaker for equal scores): `updatedAt` desc.
     The `fuse.js` instance is built once per `getLinkableDefinitionsForModal`
     call (the function is pure and is called per modal render via
     `useMemo`; building the instance per call is acceptable because the
     partials list is at most a few dozen rows. If performance becomes a
     concern in practice, the `Fuse` instance can be memoised keyed by
     the `definitionPartials` array reference, re-building only when the
     reference changes). The helper is robust to malformed cache entries:
     partials with missing `primaryTitle`, `primaryTopic`, `alternateTitles`,
     or `alternateTopics` are handled defensively (coerced to empty
     strings/arrays) to avoid throwing on stale cache data.
3. **Map** to the `LinkableDefinition` shape, copying `documentType`,
   `referenceDocumentId`, and `templateDocumentId` from the partial
   alongside the filtered and ranked fields.

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
follow the same pattern as `findMatchingDefinition` (which lives in
`matchDefinitionForAssignment.ts`) and to enable independent unit testing.
The helper is a **feature-local** module — colocated with the
modal — and is not promoted to a shared utility because it has exactly one
caller. The
`docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
shared-helpers document will be extended to record the new helper with
status `Not implemented`, reconciled to `Implemented` in the
documentation pass (Section 9 of ACTION_PLAN.md).

## Main user-facing surface specification

### Recommended components or primitives

- **Picker list**: a feature-local presentational component. A separate
  layout spec is produced for the new `LinkableDefinitionList` workflow
  surface. The contract for the component is "single selection,
  accessible name per row, keyboard navigation consistent with the rest
  of the modal". The layout spec decides the exact Ant Design primitive
  and any custom styling. The current best guess is Ant Design's
  `Radio.Group` (or equivalent built-in primitive) over a custom
  implementation to reuse built-in single-selection, keyboard navigation,
  and accessibility behaviour; the layout spec is the authority on this.
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
   - `Button` (Link) + `Button` (Cancel).
3. **Post-link loading**: the picker is hidden; a `Spin` occupies the body.
4. **Post-link success**: a success `Alert` ("Assessment started for ...")
   replaces the body; footer shows a single Close button.
5. **Post-link error**: an error `Alert` replaces the body; footer shows a
   single Cancel button. The error Alert includes text indicating the
   link was committed but the assessment could not be started; the
   teacher can reopen the modal and the link will be reflected.

### Sorting, filtering, or navigation rules

- See "Derivation rules for `LinkableDefinition`" above. The list is
  filtered by year group and sorted by **fuzzy title rank** (primary;
  via `fuse.js` per Decision 8) with **`updatedAt` desc as
  tie-breaker** for definitions with the same score. There is no
  in-list search or filter (the list is expected to be small — one or
  two dozen rows at most — and adding a search box would be
  speculative scope).

### Rendering rules

#### `noMatchResolution === 'linking'` and `assessmentState === 'idle'`

- The body renders the picker (Alert + LinkableDefinitionList + Link + Cancel).
- The Link button is disabled until a row is selected (no selection → nothing
  to link). Every row in the picker is selectable.
- The Cancel button returns the modal to `'choice'`.

#### `noMatchResolution === 'linking'` and `assessmentState === 'loading'`

- `hasLinkSucceeded` is `true` (the upsert committed).
- The picker is hidden; a `Spin` occupies the body.
- The footer shows a loading "Link" button (disabled) + Cancel.

#### `noMatchResolution === 'linking'` and `assessmentState === 'success'`

- The body shows a success `Alert`.
- The footer shows a Close button (unchanged pattern).
- `hasLinkSucceeded` is `true`.

#### `noMatchResolution === 'linking'` and `assessmentState === 'error'`

Two sub-cases:

1. **`hasLinkSucceeded === true` (upsert committed, assessment run failed
   with a non-recoverable error or a recoverable error that has been
   handled)**: The body shows an error Alert explaining that the link was
   committed but the assessment could not be started. The footer shows a
   single Close button. The teacher can reopen the modal and the link
   will be reflected in the definition's `alternateTitles`/`alternateTopics`.

2. **`hasLinkSucceeded === false` (upsert failed before the assessment run)**:
   The body shows an error Alert. The footer shows a single Cancel button
   that closes the modal.

#### `DEFINITION_STALE` recovery (post-upsert, during `startAssessmentRun`)

When `startAssessmentRun` rejects with `DEFINITION_STALE`, the link
(the alternateTitle write) is **preserved** and the modal transitions to
the **wizard's 2nd panel** (task weightings and assignment settings), with
the document re-parsed and pre-populated from the stale definition. This is
the same recovery path used by the existing wizard flow; it applies to
both the link flow and the standard wizard-create-stale flow.

### Order of appearance or initialisation

- The picker is the second body state (entered after the user picks "Link to
  Existing Definition" from the choice prompt).
- The picker appears immediately (no loading skeleton; the cache is warm from
  the modal mount).
- The chooser disappears once the user clicks "Link" (transition to loading),
  not on row selection.

### Empty states and zero-data

- **Empty picker (no matching year group)**: the "Link to Existing Definition"
  button in the choice prompt is disabled with a `Tooltip` explaining that no
  linkable definitions exist for this class's year group. The teacher can still
  use "Create New Definition".
- **Empty partials cache**: if `definitionPartialsFromCache` is `[]` or
  `undefined`, the picker has zero rows; the Link button is disabled; the
  Tooltip explains "No assignment definitions exist for this class's year
  group." This is the same state as the empty-year-group case and uses the
  same Tooltip.
- **No selection in picker**: the Link button is disabled until the teacher
  selects a row. This is the normal idle state of the picker.
- **Upsert failure**: error Alert with Cancel button (closes modal).

### Error states

- **Upsert transport failure** (network, auth, etc.): error Alert, Cancel
  closes modal.
- **Upsert resolves but `startAssessmentRun` rejects**:
  - `DEFINITION_STALE`: transition to wizard 2nd panel with re-parsed
    document (the link is preserved).
  - Other error: error Alert, single Close button. The link has been
    committed; the teacher can reopen and retry the assessment run.
- **Cache invalidation failure silently ignored** (the modal does not await
  the refetch; a failed refetch does not affect the current flow).

### Loading states

- **Post-Link-click loading**: `Spin` in body, disabled "Link" button +
  Cancel in footer.

## State machine extension details

### Existing `noMatchResolution` union

Currently: `'idle' | 'choice' | 'creating'`

Extended to: `'idle' | 'choice' | 'creating' | 'linking'`

### New slots

| Slot                        | Type                         | Initial value | Reset on                                         |
| --------------------------- | ---------------------------- | ------------- | ------------------------------------------------ |
| `noMatchResolution`         | extended union               | `'idle'`      | modal reopen                                     |
| `selectedDefinitionForLink` | `LinkableDefinition \| null` | `null`        | modal reopen, Cancel from picker, success close  |
| `hasLinkSucceeded`          | `boolean`                    | `false`       | modal reopen, Cancel from picker (before upsert) |

Note: `selectedAssignmentForChoice` is an **existing** slot (line 73 of
`AssessTaskModal.tsx`) and is retained across the `'choice'` ↔ `'linking'`
transition. It holds the Google Classroom assignment the user chose at the
modal's assignment-selection step and is reset only on modal reopen or
assignment re-selection, not on Cancel from the picker.

### State transition table

| Trigger                                              | From                      | To                                                                               | Side effects                                                                                             |
| ---------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Click "Link to Existing Definition" in choice prompt | `'choice'`                | `'linking'`                                                                      | Set `selectedAssignmentForChoice` (already set); compute `linkableDefinitions`                           |
| Click row in picker                                  | `'linking'` + `'idle'`    | (same)                                                                           | Set `selectedDefinitionForLink`                                                                          |
| Click Cancel in picker                               | `'linking'` + `'idle'`    | `'choice'`                                                                       | Reset `selectedDefinitionForLink` to `null`; reset `hasLinkSucceeded` to `false`                         |
| Click Link (row selected)                            | `'linking'` + `'idle'`    | `'linking'` + `'loading'`                                                        | Call `handleLinkConfirm`: set `hasLinkSucceeded = true` after upsert resolves; call `startAssessmentRun` |
| `startAssessmentRun` succeeds                        | `'linking'` + `'loading'` | `'linking'` + `'success'`                                                        | Show success Alert; footer shows Close                                                                   |
| `startAssessmentRun` fails with `DEFINITION_STALE`   | `'linking'` + `'loading'` | `'creating'` (wizard via new `initialPanel={2}` or `mode='stale-recovery'` prop) | Preserve link; re-parse document; pre-populate task weightings from stale definition                     |
| `startAssessmentRun` fails with other error          | `'linking'` + `'loading'` | `'linking'` + `'error'`                                                          | Show error Alert (link committed); footer shows Close                                                    |
| Upset fails (rejects)                                | `'linking'` + `'loading'` | `'linking'` + `'error'`                                                          | Show error Alert (`hasLinkSucceeded === false`); footer shows Cancel                                     |
| Click Close on success                               | `'linking'` + `'success'` | `'idle'`                                                                         | Close modal; reset all slots                                                                             |
| Click Close on error                                 | `'linking'` + `'error'`   | `'idle'`                                                                         | Close modal; reset all slots                                                                             |

## Backend changes required

### `AssignmentDefinitionUpsertOrchestrator`

- Add a new private method `_resolveAlternateTopics({ payload, isUpdate, existingDefinition })`
  that mirrors `_resolveAlternateTitles` exactly, delegating to
  `validation.normaliseAlternateTitles` for array normalisation.
- Add a one-line constructor call update in `upsert`:
  `alternateTopics: this._resolveAlternateTopics({ payload, isUpdate, existingDefinition })`.
- A code comment records the reuse of `normaliseAlternateTitles` for the
  `alternateTopics` field.

### No backend changes

- No new controller class.
- No new `apiHandler` allowlist entry.
- No new transport validator rule.
- No model changes (the model already accepts `alternateTopics`).
- No response mapper changes (the mapper already serialises `alternateTopics`).

## Frontend changes required

### `AssessTaskModal.tsx`

- Extend `noMatchResolution` union: `'idle' | 'choice' | 'creating' | 'linking'`.
- Add `selectedDefinitionForLink` state slot.
- Add `hasLinkSucceeded` state slot.
- Add `handleLinkExistingDefinition` (transition to picker).
- Add `handleLinkConfirm` (upsert + start assessment).
- Add `handleLinkCancel` (return to choice prompt).
- Add `linkableDefinitions` derived value (`useMemo`).
- Update `renderBody` to render `LinkableDefinitionList` in the `'linking'` branch.
- Update `getFooterContent` to render the Link + Cancel footer in the
  `'linking'` + `'idle'` branch.
- Extend effect/reset handlers to reset the new slots on modal reopen
  and on fetch error.
- Add `DEFINITION_STALE` recovery: on `startAssessmentRun` failure with
  `DEFINITION_STALE`, transition to `noMatchResolution === 'creating'`
  (wizard 2nd panel) instead of showing an error Alert. The link is
  preserved. This mirrors the existing wizard-stale recovery path.

### `matchDefinitionForAssignment.ts`

- Replace `===` and `Array.includes` with `caseInsensitiveTrimmedEquals`
  for both title and topic comparisons.
- Add `alternateTopics` lookup branch in the topic match.

### `stringComparison.ts` (new file)

- Export `caseInsensitiveTrimmedEquals(a: string, b: string): boolean`
  using `a.trim().toLowerCase() === b.trim().toLowerCase()`.
- Follow the existing frontend convention for colocated pure helpers.
- The helper is feature-local and is not exported from the modal feature
  directory.

### `getLinkableDefinitionsForModal.ts` (new file)

- Pure function that filters, sorts (via `fuse.js`), and maps cached
  `AssignmentDefinitionPartial` rows to `LinkableDefinition[]`.
- No `isAlreadyLinked` derivation — every year-group-matching definition
  is returned as a selectable row.

### `LinkableDefinitionList.tsx` (new file)

- Presentational component rendering an Ant Design `Radio.Group` with
  vertical orientation and block width.
- Receives `linkableDefinitions`, `selectedDefinitionKey`, `onSelect`.
- All rows are fully selectable — no disabled state, no "Already linked"
  Tag, no `aria-live` summary.
- Renders an Alert with extended copy (the "Link to an existing definition"
  explanation).
- See the layout spec `ASSESS_TASK_MODAL_LINK_PICKER_LAYOUT.md` for the
  full visual and interaction specification.

### `assignmentDefinition.zod.ts`

- Extend `UpsertAssignmentDefinitionRequestSchema`:
  - Make `referenceDocumentUrl` and `templateDocumentUrl` optional.
  - Add optional fields: `alternateTitles: TrimmedNonEmptyStringSchema[]`,
    `alternateTopics: TrimmedNonEmptyStringSchema[]`,
    `referenceDocumentId: z.string()`, `templateDocumentId: z.string()`,
    `documentType: z.enum(['SLIDES', 'SHEETS'])`.
  - Add `superRefine` to enforce mutual exclusion between URL-shape
    and ID-shape payloads.
- Keep `strict()` (no extra fields).

### Service changes

- No change to `upsertAssignmentDefinition` — it already forwards the
  parsed payload.
- No change to `startAssessmentRun` — it already accepts the link flow's
  arguments.

### Query key changes

- No new query keys. `queryKeys.assignmentDefinitionPartials()` is reused
  for cache invalidation after the upsert.

## Testing expectations

- **Backend controller tests**: extend
  `tests/controllers/assignmentDefinitionController.upsert.test.js` with
  cases for `_resolveAlternateTopics` normalisation, preserve-on-omit, and
  end-to-end model construction.
- **Zod schema tests**: extend
  `src/frontend/src/services/assignmentDefinition/assignmentDefinition.zod.spec.ts`
  with cases for ID-shape acceptance, URL-shape acceptance, mutual-exclusion
  rejection, and field-type rejection.
- **Frontend matcher tests**: extend
  `matchDefinitionForAssignment.spec.ts` with cases for case-insensitive
  trimmed equality on title and topic, `alternateTopics` lookup, and
  `topicName === null` early return preservation.
- **Picker helper tests**: new file
  `getLinkableDefinitionsForModal.spec.ts` covering empty input,
  year-group filtering, fuzzy ranking, `updatedAt` tie-breaker, and
  defensive handling of missing fields.
- **Picker component tests**: new file
  `LinkableDefinitionList.spec.tsx` covering Alert rendering, row
  content, selection via `onChange`, keyboard navigation via `name`
  prop, and empty input.
- **Modal integration tests**: extend
  `AssessTaskModal.spec.tsx` covering the link flow: choice-prompt
  button enable/disable, state transitions, Link-click payload
  verification, `hasLinkSucceeded` flag management, success/error/cancel
  flows, cache invalidation, and `DEFINITION_STALE` recovery to wizard
  2nd panel.
- **Playwright e2e tests**: extend
  `classes-page-assess-task.spec.ts` with the link picker flow.
- **Test utilities extension**: extend
  `src/frontend/src/test/classes/AssessTaskModal.test-utilities.tsx` with
  new fixture factories and interaction helpers.

## Documentation and rollout notes

- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
  shared-helpers document is extended with entries for
  `caseInsensitiveTrimmedEquals` (in `stringComparison.ts`),
  `getLinkableDefinitionsForModal`, and `LinkableDefinitionList`.
- `docs/developer/backend/DATA_SHAPES.md` is updated to document
  `alternateTopics` as a documented optional field in the upsert request
  contract.
- `docs/developer/backend/api-layer.md` is updated to include
  `alternateTopics` in the "Optional request fields" entry and to
  document the mutual-exclusion rule.

## Accessibility and usability notes

- The picker uses a `Radio.Group` with a descriptive `name` prop to
  enable arrow-key keyboard navigation.
- The `aria-live` region is not needed — all rows are always selectable
  and there is no disabled already-linked state to announce.
- The no-definition-match Alert copy is extended to include the line
  "Link to an existing definition to associate the Google Classroom
  assignment with it."
- British English in all user-facing text.

## Open questions

- None at this stage.

## V1 scope recommendation

### Include in v1

- Picker UI (Ant Design `Radio.Group` with vertical orientation and block width).
- Single-selection picker with fuzzy ranking (`fuse.js`).
- Case-insensitive trimmed matcher relaxation for both title and topic.
- `alternateTopics` write path (backend orchestrator `_resolveAlternateTopics`).
- Frontend Zod schema extension with `superRefine` mutual-exclusion rule.
- `hasLinkSucceeded` flag for link-flow lifecycle management.
- `DEFINITION_STALE` recovery (transition to wizard 2nd panel with re-parsed document).
- Cache invalidation on upsert success/failure.
- Full test surface (backend controller, Zod, matcher unit, picker helper unit,
  component Vitest, Playwright e2e).
- Documentation updates (shared-helpers doc, DATA_SHAPES, api-layer).

### Defer from v1

- Multi-selection of definitions.
- In-picker search or filter input.
- Pagination or virtualisation of the picker list.
- Cross-year-group linking.
- Unlinking a previously-linked assignment.
- Renaming `normaliseAlternateTitles` to `normaliseTrimmedStringArray`.
- The `isAlreadyLinked` concept (removed per stakeholder decision).
