# Pre-PR Review — feat/enahncedABClassMetadata-impl

- **Base branch:** main
- **Generated:** 2026-11-20T20:51:36Z
- **Regression gate:** PASS (0 regressions, 0 new failures; first run created a baseline whose overall status was `FAILING` solely because of 4 pre-existing `max-lines` backend-lint warnings in files this branch does not touch — `tests/backend-api/assignmentDefinitionPartials.unit.test.js:501`, `tests/dbManager/dbManager.test.js:501`, `tests/googleClassroom/classroomApiClient.test.js:501`, `tests/utils/batchUpdateUtility.test.js:501`. The user explicitly waived this and elected to proceed.)
- **Changed files:** 51 (6 regenerated synthetic fixtures under `tests/__mocks__/data/synthetic-analysis/` were excluded at the user's request: `large-representative/{classPartials,classesById}.json`, `medium/{classPartials,classesById}.json`, `small/{classPartials,classesById}.json`)
- **Subagent model:** `opencode-go/hy4-flash-free` (all 12 focuses)

```text
 ACTION_PLAN.md                                     | 517 +++++++++++++++++++++
 SPEC.md                                            | 418 ++++++++++++++++++++
 docs/developer/backend/api-layer.md                |  19 +-
 docs/developer/data-shapes/abclass.md              | 172 +++++--
 docs/developer/data-shapes/frontend-data-analysis-response.md |  57 ++-
 docs/developer/frontend/data-analysis-architecture.md |  57 ++-
 docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md |  12 +-
 docs/developer/frontend/frontend-testing.md        |  17 +-
 docs/developer/testing/synthetic-test-data.md      |  34 +-
 scripts/synthetic-test-data/generateClassMetadata.js |  79 +++-
 scripts/synthetic-test-data/validateClassMetadata.js | 104 ++++-
 src/backend/Models/ABClassMetadata.js              | 172 +++++--
 src/backend/Models/ABClassMetadataStandings.js     | 175 +++++++
 src/frontend/src/services/abClass/abClassMetadata.zod.spec.ts | 198 +++++++-
 src/frontend/src/services/abClass/abClassMetadata.zod.strict.spec.ts |  77 +++
 src/frontend/src/services/abClass/abClassMetadata.zod.ts | 158 ++++++-
 src/frontend/src/services/abClass/abClassMetadataService.calculation.spec.ts |  98 ++--
 src/frontend/src/services/abClass/abClassMetadataService.failure.spec.ts |  20 +-
 src/frontend/src/services/abClass/abClassMetadataService.queue.spec.ts |  12 +-
 src/frontend/src/services/abClass/abClassMetadataService.summaryConsumption.spec.ts | 403 ++++++++++++++++
 src/frontend/src/services/abClass/abClassMetadataService.ts |  37 +-
 src/frontend/src/services/dataAnalysis/analysers/attemptBaselineSelection.ts |  33 +-
 src/frontend/src/services/dataAnalysis/analysers/attemptBaselineSelection.typedError.spec.ts | 264 +++++++++++
 src/frontend/src/services/dataAnalysis/classSummary.zod.spec.ts | 179 +++++++
 src/frontend/src/services/dataAnalysis/classSummary.zod.ts | 172 +++++++
 src/frontend/src/services/dataAnalysis/classSummaryAnalyser.boundary.spec.ts | 474 +++++++++++++++++++
 src/frontend/src/services/dataAnalysis/classSummaryAnalyser.spec.ts | 421 +++++++++++++++++
 src/frontend/src/services/dataAnalysis/classSummaryAnalyser.ts | 373 +++++++++++++++
 src/frontend/src/services/dataAnalysis/dataAnalysisService.spec.ts |  50 ++
 src/frontend/src/services/dataAnalysis/dataAnalysisService.ts |  20 +
 src/frontend/src/services/dataAnalysis/postAnalysis/metadataProjection.freshness.spec.ts |   9 +
 src/frontend/src/services/dataAnalysis/postAnalysis/metadataProjection.merge.spec.ts | 174 ++++++-
 src/frontend/src/services/dataAnalysis/postAnalysis/metadataProjection.ts |  79 +++-
 src/frontend/src/services/dataAnalysis/postAnalysis/refreshABClassMetadata.spec.ts |  10 +
 src/frontend/src/services/googleClassrooms/classReadServices.metadata.spec.ts |  26 +-
 src/frontend/src/test/abClass/abClassMetadataFixtures.ts | 157 +++++++
 tests/api/apiHandler/abclassMetadataReads.test.js  |  20 +-
 tests/api/apiHandler/abclassMetadataWrites.test.js |  51 +-
 tests/controllers/abclassEmbeddedAssignmentPersistence.test.js |  17 +-
 tests/controllers/abclassMetadataLifecycle.test.js |  37 +-
 tests/controllers/abclassMetadataMutations.test.js |  41 +-
 tests/controllers/abclassMetadataPersistence.test.js |  25 +-
 tests/controllers/abclassMetadataResponses.test.js |  29 +-
 tests/models/abclassEmbeddedAssignmentSerialisation.test.js |  15 +-
 tests/models/abclassMetadataBoundary.test.js       |  16 +-
 tests/models/abclassMetadataFiveFieldShape.test.js | 414 +++++++++++++++++
 tests/models/abclassMetadataIntegration.test.js    |  59 ++-
 tests/setupGlobals.js                              |   5 +
 tests/synthetic-analysis/syntheticABClassMetadataFrontendParity.test.ts |  70 +++
 tests/synthetic-analysis/syntheticABClassMetadataGeneratorValidator.test.ts | 272 +++++++++++
 tests/synthetic-analysis/syntheticABClassMetadataRoundTrip.test.ts |  99 +++-
 51 files changed, 6112 insertions(+), 335 deletions(-)
```

## Verdict

**Needs Improvement** — no focus reported a Critical finding, but six focuses reported Improvements covering a reachable schema/transformation defect, an accidental O(n²) hot path, a fail-fast violation, duplicated logic, filler-adjective policy deviations and untested fail-fast branches; all other focuses passed clean.

## Focus areas

### Repo rule compliance

**PASS** — no Critical, Improvement, or Nitpick findings in the in-scope diff; all changed files adhere to the AGENTS rules, module checklists, British-English, error-rethrow, import-path, line-gate and documentation-in-same-change obligations.

#### Incidental (triage)

- Stale `@throws` JSDoc in untouched `averagingAnalyser.ts`.
- Pre-existing extension-guidance JSDoc in `dataAnalysisService.ts`.
- The already-dispositioned backend-subset/frontend-exact acceptance asymmetry (also raised by the data-shape docs focus).

### KISS & DRY

**FAIL** — no Critical issues.

#### Critical

None.

#### Improvement

**Improvement 1 (Frontend, DRY): the "one score set per recent assignment" refinement is implemented twice with identical logic and message**

Two separate helpers enforce the same invariant on two representations of the same standings data in the same frontend module:

- `src/frontend/src/services/dataAnalysis/classSummary.zod.ts:110-127` — `validateBasisScoreAlignment(standings, path, expected, context)` iterates `['top', 'bottom']` and, for each entry whose `recentAssignmentScores.length !== expected`, adds a custom issue with message `'recentAssignmentScores must have one score set per recent assignment'` (line 122).
- `src/frontend/src/services/abClass/abClassMetadata.zod.ts:317-336` — `validateStandingsScoreAlignment(snapshot, context)` derives `expected` from `snapshot.recentAssignments.length`, iterates the two standings bases then `['top', 'bottom']`, and emits the **same** message (line 331).

Both are new in this diff, live under `src/frontend/src/services/`, and guard the same pipeline rule at two stages (analyser output and persisted/wire metadata). The outer loops differ only in how the two standings bases are named and null-checked; the inner check and diagnostic are identical. A future change to the alignment rule or its message must be made in two places. A single shared helper that takes the standings bases plus their issue paths would remove the duplication while keeping both call sites' type-specific outer loops. (Note the deliberate WET trade-off on the _types_ — `MetricStandings` vs `StudentStandings` — is fine; it is the identical inner rule and message that should be shared.)

**Improvement 2 (Backend, KISS): `_validateIdentifier` on `ABClassMetadataStandings` is a zero-value pass-through and is used inconsistently**

`src/backend/Models/ABClassMetadataStandings.js:111-113`:

```js
_validateIdentifier(value, context) {
  ABClassMetadata._validateIdentifier(value, context);
},
```

This adds an indirection layer with no behaviour of its own — it only forwards to the facade. It is called at `src/backend/Models/ABClassMetadataStandings.js:73-74`, while the facade's own identifier validation calls the underlying validator **directly** at `src/backend/Models/ABClassMetadata.js:212` (`ABClassMetadata._validateIdentifier(...)`). The wrapper is both redundant and an inconsistent second call path for one rule. `validateStandingEntry` can call `ABClassMetadata._validateIdentifier(...)` directly (safe: call-time reference, same as every other cross-module reference in this file) and the wrapper can be deleted. Both files are newly added/heavily changed in this diff.

#### Nitpick

**Nitpick 1 (Backend, DRY): `copyBaselineAverages` re-implements `copyScoreSet`'s four-metric loop**

`src/backend/Models/ABClassMetadataStandings.js:120-126` (`copyBaselineAverages`) opens with the exact loop found in `copyScoreSet` at `src/backend/Models/ABClassMetadataStandings.js:165-170`:

```js
const metrics = ABClassMetadata._metrics();
const copy = {};
for (const metric of metrics) copy[metric] = value[metric];
```

`copyBaselineAverages` could reuse `copyScoreSet(value)` and then assign `copy.updatedAt = value.updatedAt`, avoiding a second copy of the metric-copy loop. Low impact, but it is a new helper in a new module whose stated purpose is reuse.

**Nitpick 2 (Frontend, drift risk): four different names for the same "maximum 3" domain limit**

New/updated in this diff, all denoting the same maximum of three recent assignments / standings entries:

- `src/frontend/src/services/abClass/abClassMetadata.zod.ts:21` — `MAX_RECENT_ASSIGNMENTS = 3` (also reused for standing lists and recent-assignment score arrays at lines 100, 104, 123)
- `src/frontend/src/services/dataAnalysis/classSummary.zod.ts:5` — `MAX_LIST_ENTRIES = 3` (lines 44, 45, 70)
- `src/frontend/src/services/dataAnalysis/classSummaryAnalyser.ts:26` — `MAX_STANDING_ENTRIES = 3` (lines 257, 262)
- `src/frontend/src/services/dataAnalysis/postAnalysis/metadataProjection.ts:19` — `RECENT_ASSIGNMENT_LIMIT = 3` (exported; line 186)

Four independent literals for one cross-cutting cap invite drift if the cap ever changes. This is a minor drift risk rather than a logic error, and a single shared constant would need a neutral home to avoid a lower-layer → `postAnalysis` dependency; recorded as low priority.

#### Incidental (triage)

- **Speculative abstraction (pre-existing):** `src/frontend/src/services/dataAnalysis/dataAnalysisService.ts:33` declares `private readonly registry: Map<string, AveragingAnalyser>` initialised with a single `'averaging'` entry (line 41), with error handling for unknown keys. A pluggable registry with one plugin is a classic speculative abstraction; a direct `new AveragingAnalyser()` call would be simpler. This line is **not changed** by this diff (the new `classSummaryAnalyser`/`summaryAnalyser` fields deliberately follow the existing pattern instead), so it is triage-only and should not block this PR.

### De-Sloppification

**Needs Improvement** — no blocking slop and no Critical items, but the new code adds one pure pass-through wrapper, a handful of filler adjectives in comments, and a small duplicated copy loop. The rest of the diff is tightly scoped and reuses existing helpers as intended. No policy deviation is blocking.

#### Critical

None. No dead code, stale exports, obsolete dependencies, or misleading abstractions that need removal before merge.

#### Improvement

**1. Needless pass-through wrapper (`_validateIdentifier`)**

- **Location:** `src/backend/Models/ABClassMetadataStandings.js:111-113` (JSDoc at `:104-110`)
- **Evidence:** The entire body is `ABClassMetadata._validateIdentifier(value, context);`. Its only call sites are `validateStandingEntry` at `:75-76`. The module's own load-order rule (`:7-12`) requires `ABClassMetadata` references to be resolved _inside a method body_ — `validateStandingEntry` is a method body, so calling the facade directly satisfies it with no wrapper.
- **Why it matters:** Pure indirection with zero added behaviour, plus an eight-line JSDoc block for a one-line delegation. This is the "needless pass-through wrapper" pattern.
- **Recommended simplification:** Call `ABClassMetadata._validateIdentifier(value, \`${context}.studentId\`)`/`.studentName`directly in`validateStandingEntry` and delete the wrapper method and its JSDoc.

**2. Filler adjectives in newly added comments — policy deviation**

- **Policy:** `AGENTS.md §2.1.12` — "Avoid empty filler adjectives and phrases … If the sentence keeps its meaning without the word, omit it; otherwise use a plain-English term. Reserve 'canonical' for its technical meaning — a single source of truth that other representations derive from."
- **Evidence (all added/modified on this branch):**
  - `src/frontend/src/services/dataAnalysis/analysers/attemptBaselineSelection.ts:8` — "The **documented** `deriveAttemptBaseline` unavailability signal" (drops cleanly to "The `deriveAttemptBaseline` unavailability signal").
  - `src/frontend/src/services/dataAnalysis/classSummaryAnalyser.ts:186` — "representing **documented** unavailability as null".
  - `src/frontend/src/services/dataAnalysis/classSummaryAnalyser.ts:192` — "the three **documented** baseline-unavailability conditions".
  - `scripts/synthetic-test-data/generateClassMetadata.js:18` — "a fixed, **documented** rule".
  - `src/backend/Models/ABClassMetadata.js:306` — "Copies the **canonical** five-field shape" (borderline: the five-field shape is not a single source of truth; the next sentence already gives the behavioural reason).
- **Why it matters:** These add noise without meaning; the rule is explicit. Genuine technical uses of "canonical UTC" (`ABClassMetadata.js:294,301`; `abClassMetadata.zod.ts:24,58,269,271`; `ABClassMetadataStandings.js:15`; `validateClassMetadata.js:76,147`) are **not** flagged — they name the exact UTC representation.
- **Impact:** Readability only. **Blocker: no.**
- **Required correction:** Delete "documented" and the non-technical "canonical" from the five lines above.

#### Nitpick

1. **Duplicated score-copy loop** — `src/backend/Models/ABClassMetadataStandings.js:120-126` (`copyBaselineAverages`) and `:165-170` (`copyScoreSet`) both create `{}` and loop `ABClassMetadata._metrics()` copying the same four fields; the former only adds `updatedAt`. Recommend `copyBaselineAverages` be `{ ...ABClassMetadataStandings.copyScoreSet(value), updatedAt: value.updatedAt }`.

2. **Single-use field constants** — `src/backend/Models/ABClassMetadata.js:4-5` (`ALL_TASK_STANDINGS_FIELD`, `BASELINE_STANDINGS_FIELD`) are referenced only once each, to build `NEW_METADATA_FIELDS` at `:6-10`. Inline the literals; `BASELINE_AVERAGES_FIELD` is fine because it is compared at `:284` and `:331`.

3. **Generic helper bound by a domain-specific constant** — `src/frontend/src/services/abClass/abClassMetadata.zod.ts:86` (`isBoundedDenseArray`) checks `value.length > MAX_RECENT_ASSIGNMENTS` at `:88`, but is reused for standings lists (`:105`) and score lists (`:99`) too. The renamed generic helper now hides a recent-assignment-specific bound; a neutral name such as `MAX_LIST_ENTRIES` would match its three callers.

4. **One-line domain aliases** — `src/backend/Models/ABClassMetadataStandings.js:20-22` and `scripts/synthetic-test-data/validateClassMetadata.js:147-150` are single-line `validateBaselineAverages` aliases of `validateClassAverages`, each with one caller (`ABClassMetadata.js:285` and `validateMetadata`, respectively). Harmless semantic naming; only worth inlining if doing a larger KISS pass.

#### Incidental (triage)

Both items below are **pre-existing / untouched by this diff**, found while reading surrounding code. They are not regressions from this branch.

1. **Redundant staleness condition** — `src/frontend/src/services/dataAnalysis/postAnalysis/metadataProjection.ts:83-92`. `matching` is derived from `recent` via `.find` at `:68`, so the first disjunct `(matching && updatedAt < matching.updatedAt)` at `:89` is a strict special case of `recent?.some(entry => updatedAt < entry.updatedAt)` at `:90`; when `recent` is nullish, `matching` is too, so the first disjunct can never change the result. `isStaleSource(updatedAt, recent)` would suffice.

2. **Single-entry analyser registry** — `src/frontend/src/services/dataAnalysis/dataAnalysisService.ts:14-15,26,39,98`. A `Map` with one `'averaging'` entry and a defaulted `analyserKey`; the only explicit key found in app code is another `'averaging'` at `useClassPageData.ts:147`. Speculative generality, but explicitly recorded as unchanged in `ACTION_PLAN.md` ("the averaging registry is unchanged") and out of scope here.

### Performance (Big-O)

**Verdict: FAIL** — the newly added `ClassSummaryAnalyser.buildStandings` is an accidental O(n²)-in-roster-size nested linear scan where a Set/Map lookup would be O(n).

#### Critical

None.

#### Improvement

**I1 (Performance, Frontend) — `src/frontend/src/services/dataAnalysis/classSummaryAnalyser.ts:248-253`, `:78-80`, `:90-100`, `:302-309`, `:338-340`**

`buildStandings` filters basis rows with a nested membership test (line 248, `n` rows):

```
isolated.every((result) => hasRowForStudent(result, row.studentId))  // :252, m results
```

and `hasRowForStudent` linearly scans each isolated result's rows:

```
return result.perStudent.some((c) => c.studentId === studentId);   // :79, k rows
```

Cost: for `n` basis rows, `m` isolated results (`m ≤ RECENT_ASSIGNMENT_LIMIT = 3`) and `k` rows per result (`k` up to roster size ≈ `n`), the filter is **O(n·m·k) ≈ O(n²) in roster size**. `buildStandings` runs twice per summary (`analyse` lines 151 and 153), so it is paid twice on every `refreshABClassMetadataInQueue` call.

This is the exact accidental-O(n²)-where-a-Set-would-be-O(n) pattern: build one `Set<string>` of studentIds (or `Map<string, PerStudentRow>`) per isolated result once — O(m·k) — then `.has()` for each row — O(n·m); total O(m·k + n·m) = O(n). The codebase already uses this pattern (`attemptBaselineSelection.ts:85, :122-132`; `baselineKeys` Set at `classSummaryAnalyser.ts:147-149`), so this is an outlier.

Same anti-pattern recurs in the new file: `requireStudentRow` uses `rows.find()` — O(k) — at `:95`, called from `:305` for up to 6 ranked rows × 3 results per basis (≤36 calls, each O(k)); `baselineScores` runs two full `.filter()` passes over `perStudentTaskMetrics` per entry at `:338-340` (O(r) each, ~18 calls, bounded by `MAX_STANDING_ENTRIES = 3`). All are eligible for per-result Maps/indexes.

#### Nitpick

None.

#### Incidental (triage) — pre-existing / context-only, not in the diff

- **I-A (Performance) — `postAnalysis/metadataProjection.ts:60-66`.** `getMetadataRefreshDecision` sorts the whole candidate list (O(n log n)) purely to read `candidates[0]` (line 66; an O(n) max scan suffices), and spreads the entire assignment object inside the comparator on every comparison (`:62-63`) → O(n log n · assignmentSize) transient allocations; `compareAssignmentNewestFirst` (`:37-42`) only needs `updatedAt`/`assignmentId`. Attributed as incidental because the function is explicitly "Reused unchanged" (diff line 339) and its body is not an added hunk (diff 6040-6161). Low practical impact (few assignments per class).

- **I-B (Performance) — `scripts/synthetic-test-data/validateClassMetadata.js:51-62`.** `assertDenseArray` calls `keys.includes(key)` inside a per-index loop (`:56-57`) → O(n²) where a `Set` gives O(n). One-time validation script and all arrays are capped at `MAX_RECENT_ASSIGNMENTS = 3` (`:5`), so negligible. Included as the only other quadratic shape seen in scope.

No performance findings in the backend `ABClassMetadata*.js` models, the Zod schemas, `abClassMetadataService.ts`, `dataAnalysisService.ts`, or the generator script — their bounded loops and Set/Map usage are appropriate.

### Logging rules compliance

## Verdict: PASS — no logging/error-handling findings in any of the 11 in-scope files.

### Method / evidence

A grep across all 11 in-scope files for `console.`, `ABLogger`, `ProgressTracker`, `logFrontend*`, `.log(` and `catch` returned a single hit: one narrow `catch` at `classSummaryAnalyser.ts:202`. There are no `console.*` calls, no logger calls, and no empty catches in scope.

- Backend model files (`ABClassMetadata.js`, `ABClassMetadataStandings.js`) are pure validators — they throw `ABClassMetadataValidationError` (`ABClassMetadata.js:54`) and log nothing, which is correct (models throw; boundaries log). The error class (`src/backend/Utils/ErrorTypes/ABClassMetadataValidationError.js:4-21`) follows the policy's new-error-type pattern.
- `abClassMetadataService.ts` uses the mandated `parseApiResponse(ClassPartialSchema, method, data)` (`abClassMetadataService.ts:62-64`) and propagates errors unchanged to the single logging boundary (`runPostAnalysisTasks.ts:54-61` → `postAnalysisDiagnostics.ts:30` → `logFrontendError`). No double-logging.
- `classSummaryAnalyser.ts:201-205` catches only the documented `AttemptBaselineUnavailableError`, maps it to `null`, and rethrows everything else — narrow, typed signal handling, not catch-and-ignore.
- `dataAnalysisService.ts` correctly logs nothing and rethrows Zod failures for the consumer boundary.
- Synthetic-data scripts are developer tooling using `throw`/`fail()` with no console output — appropriate.

#### Critical / Improvement / Nitpick

None.

#### Incidental (triage)

Informational, pre-existing, out of scope — **not** a finding and not counted against the verdict: `abclassMutations.js:24-38` logs a failed mutation via `ABLogger.error` (lines 27-31) and `z_apiHandler.js:153-159` logs the same propagated error again at the transport boundary — two error-level logs for one failure. Both files are absent from the branch diff, so this was not introduced by this change and the regression gate reported 0 regressions. Flagged for awareness only; not re-litigated.

### Frontend layout / design / accessibility

### Verdict: **PASS** (this focus) — no findings

There is genuinely nothing in this focus's scope. Every changed frontend file is a service, schema, or analyser. None contains UI markup, layout, styling, or accessibility semantics, and the change set does not affect loading/busy states, keyboard activation, error surfacing to users, or motion conventions.

**Evidence:**

1. **No UI surface changed** — `git diff --name-only main...HEAD` contains zero `.tsx`, `.css`, or `.html` files (filter returned NONE). All changed frontend source files are under `services/**` (plus specs, a test fixture, docs, and excluded fixtures).

2. **No accessibility/loading/keyboard/motion constructs** — scanning all seven in-scope files for `role=`, `aria-`, `busy`, `live`, `keyboard`, `motion`, `reduced-motion`, `onKeyDown`, `tabIndex`, `prefers-reduced` produced no accessibility matches. The only `status` tokens are domain literals (`abClassMetadataService.ts:21,51,72`, `metadataProjection.ts:24,30,52,69,71,73`), not `role="status"`/`aria-busy`/`aria-live`.

3. **UI explicitly out of scope** — `SPEC.md` decision 17 ("No frontend layout, navigation, or visible-state change is in scope") and the Purpose non-goal ("No production component currently renders metadata scores, and this feature adds no rendering") match the code: no production component reads the new fields.

4. **Error surfacing unchanged** — the writer is a background post-analysis task; `runPostAnalysisTasks.ts:58-62` catches errors generically into `status: 'failed'`, the feedback hook is warning-only, and neither file is in the diff. No production message-matching exists on the removed `"Missing averaging result"` string. The only error-type change (`deriveAttemptBaseline` → `AttemptBaselineUnavailableError`, `attemptBaselineSelection.ts:8-25,234,251`) keeps identical messages and is an `Error` subclass, so the UI path's `instanceof Error` / generic `analyserError` handling (`useClassPageData.helpers.ts:41,123-124`; `useClassPageData.ts:154,186`; `useClassPagePipelineDiagnostics.ts:66-73`) is unaffected. UI baseline availability is computed via `isAttemptBaselineEligible` directly (`useClassPageData.helpers.ts:16,203`), not by catching that typed error.

5. **No new loading/busy state introduced** — the writer's own JSDoc confirms "No query, invalidation or feedback hook is added here" (`abClassMetadataService.ts:39`).

#### Incidental (triage)

No incidental items relevant to layout, design principles, or accessibility were found while inspecting the in-scope files and their surrounding consumer code.

### Frontend data shape / schema consistency

## Verdict: FAIL

One Improvement (a reachable schema/transformation alignment mismatch) and one Nitpick (nullability coherence not enforced by the summary schema). Discriminated unions, state mapping and the API response boundary were otherwise found consistent.

#### Critical

None.

#### Improvement (Frontend data shape consistency) — main finding

**`mergeClassMetadata` can emit a `recentAssignmentScores` length that the persisted schema rejects.**

- `metadataProjection.ts:186-187` computes `scoreCount = persistedRecent.length` from _stored_ history (`previous.recentAssignments`, `metadataProjection.ts:181,186`).
- `metadataProjection.ts:148-150` trims every projected standing's `recentAssignmentScores` with `.slice(0, scoreCount)`. A `slice` only ever **shortens**; it cannot pad.
- `abClassMetadata.zod.ts:321,327` (via `validateStandingsScoreAlignment`, invoked at `abClassMetadata.zod.ts:180`) requires each standing's `recentAssignmentScores.length` to **equal** the emitted `recentAssignments.length`. `metadataProjection.ts:205,200` emits `persistedRecent` and parses with `NonNullableABClassMetadataSchema`, so the two lengths compared are `min(S, C)` and `C`, where `C = scoreCount` and `S = summary standing scores length`.
- `S` comes from the _fresh class_ assignments: `abClassMetadataService.ts:60-62` supplies `recentAssignments = classFull.assignments…slice(0, RECENT_ASSIGNMENT_LIMIT)`; the analyser emits one score per supplied recent assignment (`classSummaryAnalyser.ts:145,171,302-309`), and `ClassSummarySchema` pins `S === summary.recentAssignments.length` (`classSummary.zod.ts:136-151`). So `S = min(3, fresh class assignment count)`.
- The trim is correct only when `S >= C` (the documented 3→1 case). When `C > S`, `min(S,C) = S < C` and the alignment refinement adds an issue, so `NonNullableABClassMetadataSchema.parse` (`metadataProjection.ts:200`) throws and the whole refresh write is rejected.

`C > S` is reachable because the rolling history is deliberately **never rebuilt from live assignments** (`metadataProjection.ts:163-168`; `abclass.md` "Rolling history is taken from the previous snapshot"). If a class assignment referenced by stored metadata is removed (e.g. deleted in Classroom) while the class still has < 3 assignments and the target is reassessed to a newer timestamp than every stored entry (so the freshness gate returns `changed` rather than `unchanged`/`staleSource` — `metadataProjection.ts:66-73,83-92`), the stored history still has 3 entries (`C = 3`) but the summary has `S = 2`. The write then always throws, leaving that class's metadata permanently stale. The failure is loud (no corruption) but is a real functional defect at the schema/transformation boundary.

Suggested fix: derive the score-array length from the summary's own recent-assignment count (or trim the persisted history and the score arrays to a single common length) so the emitted `recentAssignmentScores.length` always equals the emitted `recentAssignments.length`.

#### Nitpick (Frontend schema consistency)

- `classSummary.zod.ts:61-65`: `baseline` declares `available: boolean` together with nullable `classAverages` and `standings`, but `ClassSummarySchema` (`classSummary.zod.ts:164-170`) adds no refinement tying them together. Incoherent states such as `available: true` with `standings: null`, or `available: false` with a non-null `classAverages`, parse successfully. The schema is documented as the guard "so a malformed summary cannot reach the writer" (`classSummary.zod.ts:161-162`), yet the current producer (`classSummaryAnalyser.ts:162-166`) and consumer (`metadataProjection.ts:188-198`) are the only things keeping these coherent. Consider a cross-field refinement asserting `available === (classAverages !== null) === (standings !== null)` if that is the intended contract.

#### Incidental (triage) — labelled incidental, not formal findings

- Incidental (docs): `docs/developer/data-shapes/frontend-data-analysis-response.md:310` documents only the "trim down" direction of `recentAssignmentScores`, mirroring the code gap above. If the Improvement is fixed, this canonical doc should be updated in the same change.
- Checked and deliberately NOT flagged (documented deliberate boundaries): unbounded computed metric value (`dataAnalysis.zod.ts:109`) vs the 0–5 metadata score (`abClassMetadata.zod.ts:31`) — documented Known discrepancy #2; nullable in-memory `updatedAt` narrowed with `CanonicalMetadataTimestampSchema.parse` at the write boundary (`metadataProjection.ts:179`); frontend/backend parity gap on subsets of the three new fields.

Consistency checks that PASSED (no finding): `projectMetric` (`metadataProjection.ts:113-128`) exhaustively covers the four-state `MetricResult` discriminated union; `NonNullableABClassMetadataSchema` union branches (`abClassMetadata.zod.ts:157-163`) are mutually exclusive via exact-key pre-checks; `ABClassMetadataSchema` transform (`abClassMetadata.zod.ts:175-191`) is idempotent for the writer's second parse; skip-reason union is pinned (`postAnalysis.zod.ts:22-26`); API boundary honoured via `parseApiResponse(ClassPartialSchema, …)` (`abClassMetadataService.ts:70-71`); disjointness is correctly a producer/schema rule only.

### Backend data shape / schema consistency

**PASS** — no findings for this focus. The five-field `ABClassMetadata` shape is applied consistently across validation, `toJSON`/`fromJSON`/`setMetadata`, both ABClass serialisers, all three API response mappers and the persistence consistency checks; round-trips preserve all fields (absent legacy fields become explicit `null`, no silent value defaulting), and `appsscript.json` is unchanged (no scope/service drift). The new `ABClassMetadataStandings.js` is auto-discovered by the builder and its deferred references respect GAS load order.

Critical / Improvement / Nitpick: **none**. Incidental (triage): **none material**.

### Security & secrets

## Verdict: **PASS** — no Critical, Improvement, or Nitpick security findings in this focus.

### Checks performed

**1. Hardcoded credentials / keys / secrets — clean.** No secret, key, token or credential appears in the diff. The two pattern-scan hits are outside the in-scope production changes and contain no secret: `tests/setupGlobals.js` (a `ScriptAppManager` mock) and a `console.debug` spy assertion in a round-trip test. No production `console.*` was added.

**2. `PropertiesService` / `ScriptApp` misuse — none.** No usage in any in-scope file; the only occurrences are the pre-existing test mock above.

**3. Unsafe HtmlService output / injection sinks — none.** No HtmlService output, `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or dynamic code construction.

**4. Unvalidated external input crossing trust boundaries — validated on both sides.** The newly introduced individually-identifiable data is gated at every boundary: frontend write parses via `NonNullableABClassMetadataSchema.parse` (`metadataProjection.ts:200`) and `UpdateABClassRequestSchema.parse` (`abClassMetadataService.ts:68`) with response validation at `:71`; analysis I/O parses via `AveragingAnalyserInputSchema.parse` and `ClassSummarySchema.parse` (`dataAnalysisService.ts:52-53`); backend `ABClassMetadata.js:230` `validateMetadata` calls `_validateNewFields` (`:248`), delegating nested standings checks to `ABClassMetadataStandings.js:37` `validateStandings` / `validateStandingEntry`, which reject unexpected keys, sparse arrays, `undefined` fields and out-of-domain scores. Score unions reject coercion/NaN/Infinity on both sides. Client is treated as untrusted; no gap found.

**5. Accidental data exposure in logs / error messages — clean.** Every added error string interpolates opaque identifiers only, never marks, names or payloads: `abClassMetadataService.ts:48` (`classId`), `:89` (definition/class/assignment ids), `classSummaryAnalyser.ts` (`studentId` only), `dataAnalysisService.ts` (`analyserKey`). The new Zod schemas use generic messages that embed no invalid student name or score value.

#### Incidental (triage) — advisory, not a finding in this focus

- **I-1 (data-handling discipline; out-of-scope verification):** The persisted class-metadata record now carries individually identifiable student rankings — `studentId`/`studentName` plus per-student marks — in `top`/`bottom` lists, built at `src/frontend/src/services/dataAnalysis/postAnalysis/metadataProjection.ts:141-155` (`studentName: entry.studentName` at `:146`) and persisted at `:200`, `:207-208`. Previously this record held only aggregate class/instance averages. Per `docs/developer/security/README.md` (assets: "assessment records, marks and class data"; Layer 4 "server-side persistence is deliberately minimal and bounded"; students are an in-scope adversary), it is worth confirming that the ABClass metadata read endpoints remain behind the AuthService gate. The endpoint/auth code is not in this diff and this is approved product design, so this is recorded for triage only — not as a defect.

### Test-coverage gaps

Verdict: **FAIL** — several fail-fast branches and boundary rules in newly added production logic (mainly `ClassSummaryAnalyser`) have no corresponding test, and one existing "error propagation" test gives false confidence by exercising a different throw path.

#### Critical

None.

#### Improvement

**1. Untested fail-fast / error branches in the new `ClassSummaryAnalyser`**

Three explicit `throw` sites in new production code have no test, corroborated by the checked-in coverage artifact for this file (`src/frontend/coverage/src/services/dataAnalysis/classSummaryAnalyser.ts.html`: 95.83% statements, 86.2% branches, lines 97 / 204 / 300 uncovered):

- `analyseBaseline` rethrows any error that is not an `AttemptBaselineUnavailableError`: `src/frontend/src/services/dataAnalysis/classSummaryAnalyser.ts:204` (`throw error;` inside the `catch` at 202–205). The nearest test, `src/frontend/src/services/dataAnalysis/classSummaryAnalyser.boundary.spec.ts:429-445` ("propagates an arbitrary collaborator error unchanged…"), mocks `AveragingAnalyser.prototype.analyse` to throw for **every** call. `analyse()` therefore fails at the first (absolute) analysis on line 142 and never enters `analyseBaseline` (line 143). That test does **not** prove the baseline catch block preserves genuine faults. Fix: make the spy throw only when `filter.analysisMode === 'topDecileBaseline'` and assert that exact error propagates.
- `requireStudentRow` missing-row guard: `src/frontend/src/services/dataAnalysis/classSummaryAnalyser.ts:97`. No spec asserts the `ClassSummaryAnalyser: no isolated row for student '…'` failure. Nearest: `src/frontend/src/services/dataAnalysis/classSummaryAnalyser.spec.ts` (composition/alignment tests, e.g. lines 370–397, all use data where every isolated result has a row).
- `buildStanding` null student-name guard: `src/frontend/src/services/dataAnalysis/classSummaryAnalyser.ts:300`. No spec asserts `ClassSummaryAnalyser: null studentName for student '…'`. The nearest null-name test, `src/frontend/src/services/abClass/abClassMetadataService.failure.spec.ts:24-44`, asserts a _different_ error (`buildPerStudentRows: null studentName…` from `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.ts:232`), so it cannot catch a regression in this guard.

**2. `ClassSummarySchema` standings length cap has no boundary test**

`src/frontend/src/services/dataAnalysis/classSummary.zod.ts:44-45` sets `.max(MAX_LIST_ENTRIES)` on both `top` and `bottom`. The only ">3" rejection test is `src/frontend/src/services/dataAnalysis/classSummary.zod.spec.ts:169-177`, which grows `recentAssignments` (schema line 70), not a standings list. No test feeds four entries into `top` or `bottom`, so removing the `.max()` caps would go undetected. Note: source line coverage is 100% here because the check runs inside Zod, so this gap is invisible to the coverage report. Fix: add a case that sets `allTasks.standings.top` (and one for `baseline.standings.bottom`) to four valid entries and asserts rejection.

**3. Untrimmed / empty / non-string standing identifiers are untested on both sides**

The new nested-standings validators deliberately require already-trimmed identifiers: backend `src/backend/Models/ABClassMetadataStandings.js:73-74` and frontend `src/frontend/src/services/abClass/abClassMetadata.zod.ts:107-108` (`z.string().min(1).refine(isTrimmed)` on `studentId`/`studentName`). Existing tests only cover _missing_ keys and _unexpected_ keys: `tests/models/abclassMetadataFiveFieldShape.test.js:233-243` and `src/frontend/src/services/abClass/abClassMetadata.zod.spec.ts:139-146`. No test passes an untrimmed value (e.g. `' Alice '`), empty string, or non-string, on either side. Fix: add boundary rows on both validator suites (and, for parity, in the frontend/backend parity suite) proving untrimmed/empty standing identifiers are rejected.

#### Nitpick

None beyond the above.

#### Incidental (triage)

- **Incidental** — `src/frontend/src/services/dataAnalysis/analysers/attemptBaselineSelection.ts:290-299`: `deriveBaselineTaskKeySet` has three untested branches (absolute mode returning `null` at line 291, baseline mode with a block returning a `Set` at line 299, baseline mode with a missing `attemptBaseline` block throwing at lines 294-297). The only new spec touching it, `.../attemptBaselineSelection.typedError.spec.ts:250-261`, covers just the missing-`appliedAnalysisMode` echo. Pre-existing production code, so out of changed-logic scope, but the new spec gives a false impression of full coverage.
- **Incidental** — `src/frontend/src/services/dataAnalysis/classSummaryAnalyser.ts:338`: the `?? []` fallback branch is uncovered (coverage HTML shows one uncovered branch). Defensive default; low priority.
- **Incidental** — `src/frontend/src/services/dataAnalysis/classSummaryAnalyser.ts:120-122`: the constructor's custom `criterionWeightings` override is never exercised — all tests use the no-arg form, as does production `DataAnalysisService.ts:41`. New production code, currently unused by production callers.
- **Incidental** — `src/frontend/src/services/dataAnalysis/classSummaryAnalyser.ts:299-301` is likely unreachable defensive code: `buildPerStudentRows` already rejects null student names (`averagingAnalyser.rows.ts:231-232`). Triage whether to keep or remove rather than writing a test that can only be produced by an artificial fixture.

### Error-handling robustness

**Verdict: FAIL** — one Improvement: `ClassSummaryAnalyser.analyse()` silently degrades a missing baseline block into all-task standings instead of failing fast, contradicting the fail-fast contract this same feature documents.

#### Critical

None.

#### Improvement (Frontend)

`classSummaryAnalyser.ts:147-154, 302-309` — when a non-null baseline result unexpectedly lacks `attemptBaseline`, `baselineKeys` becomes `null`, and line 303 selects the unfiltered `projectScores` path for baseline standings. That silently persists all-task `recentAssignmentScores` under the baseline basis (mixed/wrong data, no throw, no log). This directly contradicts `attemptBaselineSelection.ts:270-278` (which forbids an analogous silent fallback) and `:293-298` (which throws on a missing block). The existing `deriveBaselineTaskKeySet` helper is not used. Latent only (current `AveragingAnalyser` always sets the block at `averagingAnalyser.ts:245-257`), but it is a genuine fail-fast violation. Fix: call `deriveBaselineTaskKeySet(...)` or throw when `baseline !== null && !baseline.attemptBaseline`.

#### Nitpick

None.

#### Incidental (triage), low severity

`classSummaryAnalyser.ts:338` `perStudentTaskMetrics ?? []` silently converts a missing optional field (optional per `dataAnalysis.zod.ts:358`) into `excluded`-style scores with no diagnostic, unlike the sibling heatmap path which warns (`heatmapAdapter.ts:290-299`). Latent.

Clean checks: no broad/empty catches, no swallowed errors, correct narrow typed catch + rethrow at boundaries (`classSummaryAnalyser.ts:195-206`, `abclassMutations.js:23-38`, `ABClassValidation.js:21-26`), typed error well formed, fail-loud guards throughout, and no missing `Validate.requireParams` issue (the new backend validators intentionally accept `null`/`undefined` and emit typed errors, so `requireParams` would be wrong there).

### Data-shape docs consistency

## Verdict: FAIL

One nitpick-level documentation completeness gap in the canonical `abclass.md`: the diff adds new Zod schemas/types to `abClassMetadata.zod.ts` and names some of them in one Validation bullet, but leaves the adjacent "Inferred types" list and the File Index stale. No contract-level contradictions (field names, types, constraints, optionality, serialisation) were found between the code and the docs; the remaining observations are triage-only.

#### Critical

None.

#### Improvement

None.

#### Nitpick (Docs)

`docs/developer/data-shapes/abclass.md` — the Validation section was updated inconsistently within the same edit. The bullet at lines 941–942 was extended to name the new nested schemas (`BaselineAveragesSchema`, `StudentStandingSchema`, `StudentStandingsSchema`), but two other inventories in the same document were not:

- Lines 951–952 still read "Inferred types: `AverageScore`, `AverageScores`, `ClassAverages`, `RecentAssignment`, `ABClassMetadata`." The code newly exports `BaselineAverages`, `StudentStanding`, `StudentStandings`, `LegacyABClassMetadata` and `NonNullableABClassMetadata` from `src/frontend/src/services/abClass/abClassMetadata.zod.ts` (types at lines 199–203; `NonNullableABClassMetadata` at line 180). The canonical doc's inferred-types list is therefore incomplete relative to its own code owner.
- Lines 1420–1423 (File Index) list `CanonicalMetadataTimestampSchema, AverageScoreSchema, AverageScoresSchema, ClassAveragesSchema, RecentAssignmentSchema, NonNullableABClassMetadataSchema, ABClassMetadataSchema` for `abClassMetadata.zod.ts`, omitting the three new schemas named at line 941–942. The File Index contradicts the Validation bullet in the same doc.
- Lines 945–947 still describe `NonNullableABClassMetadataSchema` purely as a "complete non-null snapshot", without noting it now accepts the legacy two-field input and emits the five-field shape (the new behaviour is described at lines 1320–1336). Minor imprecision, included here for completeness.

Evidence: `docs/developer/data-shapes/abclass.md:941-942, 945-947, 951-952, 1420-1423`; `src/frontend/src/services/abClass/abClassMetadata.zod.ts:180, 199-203`.

Cross-reference summary (checks that passed — no finding): five-field emission with enumerable `null` placeholders matches `abclass.md:648-691` and `frontend-data-analysis-response.md:296-317`; `baselineAverages` = four scores + canonical `updatedAt` matches `abclass.md:689`; standings shape `{ top, bottom }` dense 0–3 with aligned score arrays matches `abclass.md:690-691, 1320-1336`; disjointness asserted only in the in-memory `ClassSummarySchema` matches docs; `mergeClassMetadata` 3-argument signature and rolling history matches `frontend-data-analysis-response.md:296-311, 1292` and `abclass.md:1114-1125`; `ClassSummary.updatedAt` is `string | null` matches `frontend-data-analysis-response.md:1294-1297`.

#### Incidental (triage)

- **Incidental — backend subset acceptance vs frontend exact-key rule.** `ABClassMetadata.validateMetadata()` treats all three new fields as optional independently (`ABClassMetadata.js:227-231` passes `NEW_METADATA_FIELDS` as `optionalKeys`; `_validateNewFields()` at lines 277-286 skips each absent field), so a snapshot carrying e.g. only `baselineAverages` is accepted. The frontend requires exactly two or five own keys (`abClassMetadata.zod.ts:157-166`, union at line 176). `abclass.md:715` does not make the backend's any-subset leniency explicit. This asymmetry is already recorded as a dispositioned "Material / noted" item in `ACTION_PLAN.md` (Deferred and Out-of-Scope Findings); flagging for visibility only, not as a new blocking finding.
- **Incidental — `studentName` trim constraint asymmetry.** Persisted standing entries require a non-empty, already-trimmed `studentName` (`ABClassMetadataStandings.js:82` → `ABClassMetadata._validateIdentifier`; frontend `studentStandingShape` at `abClassMetadata.zod.ts:100-103` uses `isTrimmed`). The in-memory `ClassSummary` schema requires only `z.string().min(1)` with no trim (`classSummary.zod.ts:35`), and the writer copies it verbatim (`metadataProjection.ts:146`). A whitespace-padded analyser name would therefore fail the writer's `NonNullableABClassMetadataSchema.parse()`. No doc states `studentName` trimming as an invariant, so this is not a doc contradiction; noted for triage as a latent boundary asymmetry.

## Decisions

Recorded 2026-11-20. Every finding above was walked through individually in severity order (Improvement → Nitpick → Incidental). No Critical findings were reported. **No finding was deferred**, so no GitHub Issues are required (Step 7 skipped). Several decisions explicitly expand scope to pre-existing or out-of-diff code at the user's direction; these are called out below.

### Frontend data shape / schema consistency

- **[Improvement] `metadataProjection.ts:186-187, 148-150`, `abClassMetadata.zod.ts:321,327` — Decision: Fix now.** Resolved choice (user, 2026-11-20): **trim the persisted history down to the summary's score count** (`scoreCount` derived from the summary's own recent assignments) rather than padding score arrays with placeholder markers or skipping the write. This is the only option that fabricates no score data. Note the trade-off: it narrows persisted history when a stored assignment no longer exists, which differs from the `SPEC.md:315` note that rolling history is unchanged; that deviation should be stated when implementing. Add a regression test for the `C > S` case (stored history longer than fresh assignment count, e.g. a deleted assignment with fewer than three remaining, where the freshness gate returns `changed`). Rationale: the reviewer demonstrated a reachable path where the persisted schema rejects the write and the class's metadata stays permanently stale; the user wants this corrected in the PR. Bundle the doc update from the incidental finding below.
- **[Nitpick] `classSummary.zod.ts:61-65, 164-170` — Decision: Fix now.** Approach: add a cross-field refinement asserting `available === (classAverages !== null) === (standings !== null)` (if that is the intended contract), with a test for an incoherent combination. Rationale: the schema is documented as the guard preventing malformed summaries from reaching the writer, but currently relies on producer/consumer convention only; the user wants the invariant enforced.
- **[Incidental (triage)] `docs/developer/data-shapes/frontend-data-analysis-response.md:310` — Decision: Fix now.** Approach: keep this bundled with the Improvement above — update the doc's trim-direction description in the same change as the code fix. Rationale: the doc mirrors the trim-down-only behaviour; same-change documentation obligation applies.

### Error-handling robustness

- **[Improvement] `classSummaryAnalyser.ts:147-154, 302-309` — Decision: Fix now.** Resolved choice (repo rules — reuse existing utilities): call the existing `deriveBaselineTaskKeySet(...)` helper rather than adding a new throw site, so a missing baseline block fails fast instead of silently writing all-task scores under the baseline basis. Add a test covering the missing-block case. Rationale: the silent fallback contradicts the fail-fast contract in `attemptBaselineSelection.ts:270-278, 293-298`; the user wants it corrected.
- **[Incidental (triage)] `classSummaryAnalyser.ts:338` (`perStudentTaskMetrics ?? []`) — Decision: Fix now.** Resolved choice (repo rules — fail loudly, never set defaults): remove the `?? []` fallback so a missing field surfaces as an error instead of silently becoming `excluded`-style scores. Rationale: the default hides a missing optional field with no diagnostic; the sibling warning path (`heatmapAdapter.ts:290-299`) was considered but removal is simpler and matches the project's fail-fast rule. (This item was jointly raised by the test-coverage and error-handling focuses.)

### Performance (Big-O)

- **[Improvement] `classSummaryAnalyser.ts:248-253, 78-80, 90-100, 302-309, 338-340` — Decision: Fix now.** Approach: build one `Set<string>` (or `Map`) of studentIds per isolated result once and use `.has()` lookups in `buildStandings`, replacing the O(n·m·k) ≈ O(n²) nested scan; apply the same indexing to `requireStudentRow`'s `rows.find()` and the `baselineScores` filters where practical. Rationale: the codebase already uses this pattern (`attemptBaselineSelection.ts:85,122-132`; `baselineKeys` at `classSummaryAnalyser.ts:147-149`), and `buildStandings` runs twice per summary on every refresh.
- **[Incidental (triage)] `metadataProjection.ts:60-66` — Decision: Fix now.** Approach: replace the whole-list sort used only to read `candidates[0]` with an O(n) max scan and avoid spreading the full assignment object in the comparator (only `updatedAt`/`assignmentId` are needed). Rationale: user elected to address this pre-existing inefficiency despite low practical impact.
- **[Incidental (triage)] `scripts/synthetic-test-data/validateClassMetadata.js:51-62` — Decision: Fix now.** Approach: use a `Set` for the `assertDenseArray` membership checks instead of `keys.includes(key)` inside the loop. Rationale: cheap fix in a file that is actually in the diff; negligible impact but user chose to address it.

### KISS & DRY

- **[Improvement] `classSummary.zod.ts:110-127` (msg `:122`) and `abClassMetadata.zod.ts:317-336` (msg `:331`) — Decision: Fix now.** Resolved choice (repo rules — reuse-first, KISS): export the single helper for the identical inner alignment rule and message from the existing `abClassMetadata.zod.ts` owner and import it into `classSummary.zod.ts`; do not create a new shared module (the `dataAnalysis → abClass` import direction already exists at `metadataProjection.ts:10`). Keep the type-specific outer loops (`MetricStandings` vs `StudentStandings`) separate. Rationale: two new helpers guard the same rule at two stages with the same message; a future change must currently be made twice.
- **[Improvement] `ABClassMetadataStandings.js:111-113` (used `:73-76`; facade at `ABClassMetadata.js:212`) — Decision: Fix now.** Approach: call `ABClassMetadata._validateIdentifier(...)` directly inside `validateStandingEntry` and delete the `_validateIdentifier` wrapper and its eight-line JSDoc. Rationale: zero-value pass-through, inconsistent second call path; module load-order rule is satisfied by a direct call from a method body. (Jointly raised with the de-sloppification focus.)
- **[Nitpick] `ABClassMetadataStandings.js:120-126` vs `:165-170` — Decision: Fix now.** Approach: make `copyBaselineAverages` reuse `copyScoreSet(value)` and add `updatedAt`, instead of duplicating the four-metric loop. Rationale: a new helper in a module whose purpose is reuse. (Jointly raised with the de-sloppification focus.)
- **[Nitpick] `abClassMetadata.zod.ts:21`, `classSummary.zod.ts:5`, `classSummaryAnalyser.ts:26`, `metadataProjection.ts:19` — Decision: Fix now.** Resolved choice (repo rules — KISS, reuse-first): export the single constant from the existing `abClassMetadata.zod.ts` owner rather than creating a new module, and point all four modules at it. `metadataProjection.ts:10` already imports from that owner, so no new cross-layer dependency is introduced. Rationale: four literals for one cross-cutting cap invite drift.
- **[Incidental (triage)] `dataAnalysisService.ts:33` single-entry registry — Decision: Fix now.** Resolved choice (repo rules — KISS): remove the registry and the `analyserKey` parameter entirely and construct `AveragingAnalyser` directly in the constructor. Update the two call sites/tests that pass `'averaging'` or assert the unknown-key error (`useHeatmapSelectionSummary.spec.ts:62`, `dataAnalysisService.spec.ts:179`). This is an explicit scope expansion: the registry is pre-existing and recorded as unchanged in `ACTION_PLAN.md`, but the user directed the fix. The extension-guidance JSDoc finding below is to be updated as part of this change.

### De-sloppification

- **[Improvement] filler adjectives in new comments — Decision: Fix now.** Approach: delete "documented" at `attemptBaselineSelection.ts:8`, `classSummaryAnalyser.ts:186`, `classSummaryAnalyser.ts:192` and `generateClassMetadata.js:18`, and the non-technical "canonical" at `ABClassMetadata.js:306`; leave genuine technical "canonical UTC" uses untouched. Rationale: explicit `AGENTS.md §2.1.12` rule; readability-only but cheap and safe.
- **[Nitpick] `ABClassMetadata.js:4-5` — Decision: Fix now.** Approach: inline `ALL_TASK_STANDINGS_FIELD` and `BASELINE_STANDINGS_FIELD` into the `NEW_METADATA_FIELDS` construction at `:6-10`; keep `BASELINE_AVERAGES_FIELD` (compared at `:284` and `:331`). Rationale: single-use constants add no value.
- **[Nitpick] `abClassMetadata.zod.ts:86` — Decision: Fix now.** Resolved choice: rename the bound to `MAX_LIST_ENTRIES` as part of the shared-constant export from `abClassMetadata.zod.ts` decided under KISS & DRY above, so the generic helper reads neutrally at all three callers. Rationale: the generic helper currently hides a recent-assignment-specific bound.
- **[Nitpick] `ABClassMetadataStandings.js:20-22`, `validateClassMetadata.js:147-150` — Decision: Fix now.** Approach: inline the single-line `validateBaselineAverages` aliases and call `validateClassAverages` directly at `ABClassMetadata.js:285` and in `validateMetadata`. Rationale: one-line aliases with one caller each; user chose to simplify.
- **[Incidental (triage)] `metadataProjection.ts:83-92` redundant staleness condition — Decision: Fix now.** Approach: collapse the two disjuncts to the `recent?.some(...)` check / `isStaleSource(...)` helper, since the `matching` disjunct is a strict special case that can never change the result. Rationale: explicit scope expansion into pre-existing code at the user's direction.

### Test-coverage gaps

- **[Improvement] `classSummaryAnalyser.ts:97, 204, 300` — Decision: Wontfix.** Rationale: the user elected not to add tests for the three throw sites and to leave the existing `classSummaryAnalyser.boundary.spec.ts:429-445` "arbitrary collaborator error" test as-is, accepting that it exercises the absolute analysis path rather than the baseline catch. The false-confidence observation is recorded here so a future reviewer does not re-raise it.
- **[Improvement] `classSummary.zod.ts:44-45` standings length cap — Decision: Wontfix.** Rationale: the user accepted the current tests without a boundary case for four `top`/`bottom` entries.
- **[Improvement] untrimmed standing identifiers (`ABClassMetadataStandings.js:73-74`, `abClassMetadata.zod.ts:107-108`) — Decision: Wontfix.** Rationale: the user accepted the existing missing/unexpected-key tests without untrimmed/empty/non-string cases. (The related behavioural trim asymmetry is handled separately below and was decided Fix now.)
- **[Incidental (triage)] `attemptBaselineSelection.ts:290-299` untested `deriveBaselineTaskKeySet` branches — Decision: Wontfix.** Rationale: pre-existing production code out of changed-logic scope; user accepted the coverage as-is.
- **[Incidental (triage)] `classSummaryAnalyser.ts:120-122` untested/unused `criterionWeightings` override — Decision: Wontfix.** Rationale: user accepted the untested constructor override as-is; no production caller uses it.
- **[Incidental (triage)] `classSummaryAnalyser.ts:299-301` likely-unreachable null `studentName` guard — Decision: Fix now.** Approach: remove the guard as dead code (`buildPerStudentRows` already rejects null names at `averagingAnalyser.rows.ts:231-232`). Rationale: user preferred removal over an artificial-fixture test. Note this supersedes the Wontfix above in practice — with the guard removed, there is no branch left to test.

### Backend data shape / schema consistency

**PASS — no findings; no decisions required.**

### Logging rules compliance

- **[Incidental (triage)] double-logging at `abclassMutations.js:24-38` and `z_apiHandler.js:153-159` — Decision: Fix now.** Resolved choice (user, 2026-11-20): keep the transport-boundary `ABLogger.error` at `z_apiHandler.js:154-158` (it carries `requestId` correlation and preserves diagnostics in GAS logs) and remove the `ABLogger.error` at `abclassMutations.js:27-31`. Rationale: explicit scope expansion into pre-existing, out-of-diff files at the user's direction; one error log per failure at the API boundary.

### Security & secrets

- **[Incidental (triage)] AuthService gate verification for metadata reads (`metadataProjection.ts:141-155, 200, 207-208`) — Decision: Wontfix.** Rationale: the user accepted the current endpoint gating as sufficient; the persisted records now include identifiable rankings, so the decision is recorded here for traceability.

### Data-shape docs consistency

- **[Nitpick] `docs/developer/data-shapes/abclass.md:941-942, 945-947, 951-952, 1420-1423` — Decision: Fix now.** Approach: update the "Inferred types" list to include the newly exported types (`BaselineAverages`, `StudentStanding`, `StudentStandings`, `LegacyABClassMetadata`, `NonNullableABClassMetadata`), add the three new schemas to the File Index, and clarify that `NonNullableABClassMetadataSchema` now accepts legacy two-field input and emits five fields. Rationale: same-change documentation obligation; the File Index contradicts the Validation bullet in the same document.
- **[Incidental (triage)] backend any-subset acceptance vs frontend exact-key rule (`ABClassMetadata.js:227-231, 277-286`; `abClassMetadata.zod.ts:157-166, 176`; `abclass.md:715`) — Decision: Fix now.** Resolved direction (repo rules / `SPEC.md:34,219`): make the backend accept only the legacy two-field shape or the current five-field shape, rejecting arbitrary subsets, so it matches the frontend's two-or-five own-key rule and the documented contract; update `abclass.md:715` to state this explicitly. Rationale: `SPEC.md` already defines the accepted shapes; the user chose to revisit an asymmetry previously recorded as a dispositioned "Material / noted" item in `ACTION_PLAN.md`, and this decision overrides that disposition.
- **[Incidental (triage)] `studentName` trim asymmetry (`ABClassMetadataStandings.js:82`, `abClassMetadata.zod.ts:100-103`, `classSummary.zod.ts:35`, `metadataProjection.ts:146`) — Decision: Fix now.** Resolved choice (repo rules — Zod validation, fail loudly, never silently coerce): add the same non-empty, already-trimmed refinement to the in-memory `studentName` in `classSummary.zod.ts:35`, rather than trimming the value at the producer. A padded analyser name then fails at summary validation instead of at the writer's persisted-schema parse. Rationale: user chose to close the latent boundary gap.

### Repo rule compliance

- **[Incidental (triage)] stale `@throws` JSDoc in untouched `averagingAnalyser.ts` — Decision: Fix now.** Approach: correct the annotation in this PR. Rationale: explicit scope expansion into a pre-existing, out-of-diff file at the user's direction.
- **[Incidental (triage)] extension-guidance JSDoc in `dataAnalysisService.ts` — Decision: Fix now.** Approach: update or remove the JSDoc as part of the registry change decided under KISS & DRY above. Rationale: user directed the fix alongside Finding 17.

### Resolution of open choices (2026-11-20)

Several Fix-now decisions left the exact remediation open. These were resolved before implementation:

| Finding                                                                      | Open choice                                                                                       | Resolution                                                                                   | Source                                      |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Frontend data shape Improvement — `metadataProjection.ts:186-187`            | How to align score-array and history lengths when stored history is longer than the fresh summary | Trim persisted history to the summary's score count; no fabricated score data                | User decision                               |
| Logging Incidental — `abclassMutations.js:27-31` / `z_apiHandler.js:154-158` | Which of the two error logs to remove                                                             | Keep the `z_apiHandler` transport log; remove the `abclassMutations` log                     | User decision                               |
| Error-handling Improvement — `classSummaryAnalyser.ts:147-154`               | New throw vs existing helper                                                                      | Reuse `deriveBaselineTaskKeySet(...)`                                                        | Repo rule: reuse existing utilities         |
| Error-handling Incidental — `classSummaryAnalyser.ts:338`                    | Remove default vs add warning/test                                                                | Remove the `?? []` fallback                                                                  | Repo rules: fail loudly, never set defaults |
| KISS Improvement — duplicated alignment helper                               | Where the shared helper lives                                                                     | Export from existing `abClassMetadata.zod.ts`; no new module                                 | Repo rules: reuse-first, KISS               |
| KISS Nitpick — four "3" constants                                            | Where the shared constant lives                                                                   | Export from existing `abClassMetadata.zod.ts`; no new module                                 | Repo rules: reuse-first, KISS               |
| De-slop Nitpick — `isBoundedDenseArray` bound                                | Constant name                                                                                     | Rename to `MAX_LIST_ENTRIES` with the shared constant                                        | Consistency with the shared constant        |
| KISS Incidental — single-entry registry                                      | Keep or drop `analyserKey`                                                                        | Drop the registry and the parameter; update the two referencing specs                        | Repo rule: KISS                             |
| Data-shape docs Incidental — field-subset asymmetry                          | Which side aligns to which                                                                        | Backend accepts only legacy two-field or current five-field, matching frontend and `SPEC.md` | Spec: `SPEC.md:34,219`                      |
| Data-shape docs Incidental — `studentName` trim                              | Trim value vs tighten schema                                                                      | Add the same trim refinement to `classSummary.zod.ts`                                        | Repo rules: Zod validation, fail loudly     |

No implementation was performed in this step; this section only records the decisions.

### Summary of decisions

- **Fix now:** 25 findings (six Improvements, seven Nitpicks, twelve Incidental).
- **Wontfix:** 6 findings (three test-coverage Improvements, three Incidental).
- **Defer:** 0 findings — no GitHub Issues to create.
- **Critical:** none reported by any focus.

## Fix batches

Batch plan recorded before implementation. One layer per batch where possible; findings that share a helper, a contract or the same lines are grouped; later batches build on earlier ones; tests are owned by a fresh `testing-specialist` session when a batch changes behaviour, and are bundled into the same batch/commit as the production change they pin. The shared `MAX_LIST_ENTRIES` constant and alignment helper are **defined** in Batch 1 (their `abClassMetadata.zod.ts` owner) and **adopted** by their consumers in Batches 2 and 3; those two consumer edits are recorded against the KISS Nitpick finding in each batch.

| Batch | Layer                                                    | Findings (decision source)                                                                                                                                                                                                                                                                                                                                                                                | Files                                                                                                                                                                                                                                                                                              | Status                                                          | Checks                                                                                                                                                                                 | Commit                                                                                                                            |
| ----- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Frontend src + specs (schemas)                           | KISS Improvement 1 (shared alignment helper/message); KISS Nitpick 2 + De-slop Nitpick 3 (define/export `MAX_LIST_ENTRIES`, rename bound); Frontend data-shape Nitpick (cross-field `available` refinement); Data-shape docs Incidental (`studentName` trim refinement)                                                                                                                                   | `src/frontend/src/services/abClass/abClassMetadata.zod.ts`, `src/frontend/src/services/dataAnalysis/classSummary.zod.ts` (+ their `.spec.ts`)                                                                                                                                                      | Done — review PASS, all 5 findings resolved                     | `lint:frontend:check` 0 errors (16 pre-existing max-lines warnings, none touched); `tsc -b` (app/node/e2e) clean; Vitest 3 spec files 64/64 passed; reviewer coverage 3278/3278 passed | `f6d15ba85cf9168cf9d353237410512da490fb22` — `fix(frontend): consolidate metadata alignment rule and tighten ClassSummary schema` |
| 2     | Frontend src + specs + data-shape docs                   | Frontend data-shape Improvement (`mergeClassMetadata` history trim + `C>S` regression test); Perf Incidental I-A (O(n) max scan); De-slop Incidental (redundant staleness condition); KISS Nitpick 2 consumer (`MAX_LIST_ENTRIES`); Frontend data-shape Incidental doc (`frontend-data-analysis-response.md:310`)                                                                                         | `src/frontend/src/services/dataAnalysis/postAnalysis/metadataProjection.ts`, `src/frontend/src/services/abClass/abClassMetadataService.ts` (shared-constant consumer at `:10,62`), `docs/developer/data-shapes/frontend-data-analysis-response.md` (+ specs)                                       | Done — one doc-contradiction finding fixed and re-reviewed PASS | `lint:frontend:check` 0 errors; `typecheck:all` clean; Vitest 6 files 48/48 passed; reviewer coverage 3280/3280 passed                                                                 | recorded in the next batch's commit                                                                                               |
| 3     | Frontend src + specs (analysers)                         | Error-handling Improvement (reuse `deriveBaselineTaskKeySet` + test); Error-handling Incidental + test-coverage Incidental (remove `?? []` fallback); Perf Improvement I1 (Set/Map indexing); test-coverage Incidental (remove null `studentName` guard); KISS Nitpick 2 consumer (`MAX_LIST_ENTRIES`); De-slop Improvement (remove "documented" at `:186`,`:192` and at `attemptBaselineSelection.ts:8`) | `src/frontend/src/services/dataAnalysis/classSummaryAnalyser.ts`, `src/frontend/src/services/dataAnalysis/analysers/attemptBaselineSelection.ts` (+ specs)                                                                                                                                         | Pending                                                         | —                                                                                                                                                                                      | —                                                                                                                                 |
| 4     | Backend production (+ backend tests if needed)           | KISS Improvement 2 (delete `_validateIdentifier` wrapper); KISS Nitpick 1 (`copyBaselineAverages` reuse `copyScoreSet`); De-slop Nitpick 2 (inline single-use constants); De-slop Nitpick 4 (inline `validateBaselineAverages` alias in standings model); De-slop Improvement (remove non-technical "canonical" at `ABClassMetadata.js:306`)                                                              | `src/backend/Models/ABClassMetadata.js`, `src/backend/Models/ABClassMetadataStandings.js` (+ `tests/models/*` if behaviour is affected)                                                                                                                                                            | Pending                                                         | —                                                                                                                                                                                      | —                                                                                                                                 |
| 5     | Backend + frontend validation contract + data-shape docs | Data-shape docs Incidental (backend accepts only legacy-two-field or current-five-field, matching frontend `SPEC.md:34,219`; `abclass.md:715`); Data-shape docs Nitpick (Inferred types, File Index, `NonNullableABClassMetadataSchema` clarification)                                                                                                                                                    | `src/backend/Models/ABClassMetadata.js`, `docs/developer/data-shapes/abclass.md` (+ backend/frontend specs and canonical specs as required)                                                                                                                                                        | Pending                                                         | —                                                                                                                                                                                      | —                                                                                                                                 |
| 6     | Frontend src + specs (services/analysers)                | KISS Incidental (drop registry + `analyserKey`, construct `AveragingAnalyser` directly; update specs); Repo-rule Incidental (extension-guidance JSDoc in `dataAnalysisService.ts`); Repo-rule Incidental (stale `@throws` JSDoc in `averagingAnalyser.ts`)                                                                                                                                                | `src/frontend/src/services/dataAnalysis/dataAnalysisService.ts`, `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.ts`, `src/frontend/src/services/dataAnalysis/dataAnalysisService.spec.ts`, `src/frontend/src/hooks/**/useHeatmapSelectionSummary.spec.ts` (verify exact path) | Pending                                                         | —                                                                                                                                                                                      | —                                                                                                                                 |
| 7     | Backend production                                       | Logging Incidental (remove `ABLogger.error` in `abclassMutations.js:27-31`; keep `z_apiHandler.js:154-158`)                                                                                                                                                                                                                                                                                               | `src/backend/z_Api/abclass/abclassMutations.js`                                                                                                                                                                                                                                                    | Pending                                                         | —                                                                                                                                                                                      | —                                                                                                                                 |
| 8     | Synthetic scripts                                        | Perf Incidental I-B (`Set` in `assertDenseArray`); De-slop Nitpick 4 (inline `validateBaselineAverages` alias in validator); De-slop Improvement (remove "documented" at `generateClassMetadata.js:18`)                                                                                                                                                                                                   | `scripts/synthetic-test-data/validateClassMetadata.js`, `scripts/synthetic-test-data/generateClassMetadata.js` (+ synthetic-analysis specs if needed)                                                                                                                                              | Pending                                                         | —                                                                                                                                                                                      | —                                                                                                                                 |

Wrap-up (after all batches): raise GitHub issues for **Raise issue** decisions — none recorded, 0 issues expected — and run `npm run run-all-checks`. Wontfix decisions are consciously left unchanged.

Consciously deferred out-of-scope observations reported by review (no recorded decision marks them for action): `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md:229` and `docs/developer/frontend/data-analysis-architecture.md:350` carry pre-fix "keep three" wording.
