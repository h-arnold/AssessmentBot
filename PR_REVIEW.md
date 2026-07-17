# Pre-PR Review — feat/PreviewCards

- **Base branch:** feat/ReactFrontend (explicitly requested in place of `main`)
- **Generated:** 2026-07-16T20:55:00Z
- **Regression gate:** BLOCKED (see note below) — baseline incompatible; remaining failures reported as pre-existing by the author and excluded from the review mandate.
- **Changed files:** 104 (5751 insertions, 908 deletions)

## Verdict

**Fail / Needs Improvement** — one **Critical** error-handling defect (silent catch-and-downgrade in `00_AssignmentSerialisation.js`) must be resolved before merge. Numerous Improvement-level items across DRY, performance, layout/a11y, data-shape, and British-English consistency should be triaged.

> **Reviewer decisions recorded:** Every finding (including incidental/triage items) has been triaged by the author via the question tool. Outcomes are captured verbatim in the **Reviewer Decisions** section at the end of this document, with the nuance and rationale needed to implement each change. The Critical serialisation defect is to be **removed (fail-fast)**, not merely narrowed.

> **Regression gate note:** `npm run regression-checker` returned `BASELINE-INCOMPATIBLE` (all 8 checks marked incompatible against a stale `2026-07-15` baseline). The author confirmed the non-frontend-lint failures (backend max-lines, backend coverage, builder specs, 33 Playwright E2E) are pre-existing and out of scope for this review. The frontend-lint failure (`no-magic-numbers` at `apiService.spec.ts`) was fixed as part of this task (`errorEntries.length - 1` via an explicit `lastIndex` constant). The gate remains BLOCKED but is not treated as a regression introduced by this branch.

## Focus areas

### Repo rule compliance

- **Improvement** — Backend fail-fast deviation in serialisation fallback: `src/backend/AssignmentProcessor/Assignment/00_AssignmentSerialisation.js:30-42`. `toJSON()` wraps `this._assignment.assignmentDefinition.toJSON()` in a `try/catch`, logs a warn but does **not** rethrow, substituting `toPartialJSON()` output. Silent downgrade of full serialisation to partial.
- **Improvement** — Frontend analyser silently drops data on missing definition partial: `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.filters.ts:41-46`. Logs a warn and `return true` (excludes from analysis) instead of failing fast.
- **Improvement** — Inconsistent fail-fast for the same `!definitionKey` invariant: `averagingAnalyser.filters.ts:32` throws, but `averagingAnalyser.accumulation.ts:313-318` logs a warn and `continue`s.
- **Improvement** — Static demo fixtures shipped in production feature code: `src/frontend/src/features/classPage/taskPreviewFixtures.ts:112-133` (consumed by `TaskHeatmapTable.tsx` via `getTaskPreviewData`). Popover shows fabricated student-response content. Confirm v1 demo stopgap is acceptable; remove unused `_taskId` param (no speculative scope).

#### Incidental (triage)

- `src/backend/z_Api/WebApp.js` `doGet()` switched from `createTemplateFromFile('UI/ReactApp').evaluate()` to `createHtmlOutputFromFile('UI/ReactApp')` — confirm intentional and aligned with builder inlined output.

### KISS & DRY

- **Improvement (DRY)** — `src/frontend/src/features/classPage/classPageAdapter.ts:283-285,331` re-implements `definitionKey → partial` resolution instead of using the documented seam `getAssignmentDefinitionPartial` (`assignmentDefinitionUtilities.ts:20-24`).
- **Improvement (DRY)** — `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.ts:26-36` inlines `ClassFullResponseSchema.parse` + try/catch instead of adopting `parseApiResponse`, losing `zodIssues`/`responsePreview` telemetry.
- **Improvement (DRY)** — `src/backend/y_controllers/ABClassController/ABClassResponseMapper.js:62-90` hand-builds the ABClass field list duplicated from `ABClass.toJSON()` (`Models/ABClass.js:272-285`). Prefer `abClass.toJSON()` then post-process.
- **Improvement (KISS)** — `src/frontend/src/features/classPage/taskPreviewFixtures.ts:106` carries unused `_taskId` parameter "for the service-wiring contract". Drop until a caller needs it.
- **Improvement (DRY)** — `src/frontend/src/features/classPage/taskPreviewFixtures.ts:56-100` `getFixtureEntry` and `getReasoning` both `switch (metricKey)` over the same three cases; collapse to a single `Record` lookup.

#### Nitpick

- `src/backend/AssignmentProcessor/Assignment/00_AssignmentSerialisation.js:60-64` — `Object.assign`/`fromEntries`/`filter` chain denser than the prior explicit loop.

#### Incidental (triage)

- Duplicated fixture JSON across `features/classPage/fixtures/` and `test/shared/` (same shape, only `taskId` differs) — single source of truth.
- `src/frontend/src/features/classPage/TaskHeatmapPage.tsx:75` inlines the same `definitionKey` lookup seam.

### De-Sloppification

- **Critical** — Dead `getAssignmentTopics` in `referenceDataService.ts:167-178` duplicated by `assignmentTopicsService.ts` (never imported; only consumer imports from `assignmentTopicsService`). Violates frontend service-domain folder org (§14). Delete and remove dead type/schema imports.
- **Critical** — Duplicated fixture JSON across `features/classPage/fixtures/{imageTask,textTask,table_task}.json` and `test/shared/{imageTask,textTask,table_task}.json` (byte-identical content). Single source of truth.
- **Critical** — Duplicated preview-truncation logic in `parseApiEnvelope` (`apiService.ts:134-141`) and `parseApiResponse` (`apiService.ts:175-179`). Extract a shared `truncateForPreview` helper.

#### Improvement

- `taskPreviewFixtures.ts:80-92` — `getReasoning` switch is redundant over a typed `Record`; replace with `entry.assessments[metricKey].reasoning`.
- `MarkdownRenderer.tsx:27,42-44` — speculative `className` prop with no caller; remove (Core Principle 3).
- `heatmapAdapter.ts:187` and `classPageAdapter.ts:330` — silent `?? ''` fallback for nullable `assignmentDefinitionKey` masks a data-integrity bug; throw explicitly.
- 7 duplicated `parseApiResponseMock` mocks across service specs — extract to `test/shared/apiServiceMocks.ts`.
- `e2e-tests/task-preview-card.spec.ts:40-55` — duplicated `openHeatmapTable` helper; extract to `e2e-tests/helpers/task-heatmap-end-to-end-helpers.ts`.

#### Nitpick

- `AppThemeShell.tsx:76` — undocumented `motionDurationMid: '0.1s'` override; add rationale comment.
- `apiService.ts:147-165` — verbose JSDoc disproportionate to function complexity.

### Performance (Big-O)

- **Improvement** — `averagingAnalyser.filters.ts:81-84` rebuilds `definitionByKey` Map **per class**; `analyse` (`averagingAnalyser.ts:71-92`) calls `filterAssignments` once per class → O(C·P + C·A) not O(P + C·A). Hoist the Map (and `topicKeySet`/`definitionKeySet`) into `analyse`.
- **Improvement** — `averagingAnalyser.accumulation.ts:298-308` rebuilds `partialsByDefinitionKey` and `taskWeightByDefinitionKey` Map **per class** → O(C·P·T + ΣA·I) not O(P·T + ΣA·I). Build once in `analyse` and thread down.
- **Improvement (incidental)** — `DateUtils.deepConvertDates` (`DateUtils.js:99-117`) is an O(N) recursive deep copy now on the `getAssignment_` hot path; confirm required per call.
- **Improvement (incidental)** — `callApi` payload Zod-validated twice (`parseApiEnvelope` `apiService.ts:144-145` and `parseApiResponse` in each service); fold into one pass if feasible.

#### Nitpick

- `averagingAnalyser.accumulation.ts:332` — needless `[...resolved.tasks]` spread allocates O(T) per assignment though param is `ReadonlyArray`; pass `resolved.tasks` directly.

### Logging rules compliance

_(Logging-rules agent returned no structured output; the error-handling and repo-compliance focuses cover the material logging items — see Error-handling Critical and Repo-rule Improvement re: swallowed errors and warn-and-continue vs fail-fast.)_

#### Incidental (triage)

- `apiService.ts:305` logs `params` and `apiService.ts:273` attaches `responsePreview` (raw backend-body substring, truncated 200 chars). Shared logger redacts by exact key only (`frontendLogger.ts:24,58-80`); sanctioned by logging policy §3 but confirm backend returns no secret values before enabling rich previews.

### Frontend layout / design / accessibility

- **Improvement (Width-token ownership)** — `TaskPreviewCard.tsx:73` raw `CARD_MAX_WIDTH = 400`. Introduce an intent-named token (e.g. `--app-panel-width-preview-card: 400px`) per `frontend-loading-and-width-standards.md §7`.
- **Improvement (Spec/impl mismatch)** — `TaskHeatmapTable.tsx:236` gates `content={previewData ? <TaskPreviewCard …/> : null}`, so the `data === null` branch at `TaskPreviewCard.tsx:189-191` ("Task data not available") is dead code. Align with `TASK_PREVIEW_CARD_LAYOUT.md` blocking-error state.
- **Improvement (Spacing token)** — `MarkdownRenderer.module.css:9` `padding: 8px` on `th,td`; use `var(--app-spacing-sm)`.
- **Improvement (Dark-mode colour)** — `MarkdownRenderer.module.css:8` hardcoded `border: 1px solid #d9d9d9`; use `var(--ant-color-border)`.
- **Improvement (Keyboard activation)** — `TaskHeatmapTable.tsx:234` `Popover trigger={['hover','click']}` over a non-focusable `<span>` (`:241`); keyboard/SR users cannot open. Add `tabIndex={0}` + `role`/`aria-label` or a `focus` trigger.

#### Nitpick

- `TaskHeatmapPage.tsx:187` removed explicit `role="alert"` from `Alert` — harmless (antd applies it by default).

#### Incidental (triage)

- `AppThemeShell.tsx:76` global `motionDurationMid: '0.1s'` undocumented; confirm rationale.

### Frontend data shape / schema consistency

- **Improvement** — `assignmentDefinitionKey` typed `z.string().nullable()` (`classDetailService.zod.ts:133`) but four consumers disagree: `averagingAnalyser.filters.ts:41-47` throws; `averagingAnalyser.accumulation.ts:311-319` has unreachable `if (!definitionKey) continue`; `heatmapAdapter.ts:187` masks `null`→`''` then throws `TaskTitlesUnavailableError('')`; `classPageAdapter.ts:327` falls back. Make field required or align all consumers and delete dead guard.
- **Improvement** — `TaskPreviewData.metricScore: number | 'N' | 'E'` (`TaskPreviewCard.tsx:45-53`) decoupled from `metricState`; `buildMetricResult` (`:91-119`) does `Number(score)` so a mismatched pair yields `NaN`. Tighten to a discriminated union mirroring `MetricResult` (`dataAnalysis.zod.ts:84-112`).

#### Nitpick

- `taskPreviewFixtures.ts:59,63,67` casts fixture JSON via `as FixtureData` bypassing shape checks; consider Zod validation.

### Backend data shape / schema consistency

- **Improvement** — `00_AssignmentSerialisation.js:31-42` catches **all** errors, not only the intended `TypeError` from `AssignmentDefinition.toJSON()`'s partial guard (`Models/AssignmentDefinition.js:289-293`). Narrow to `catch (err) { if (!(err instanceof TypeError)) throw err; }`.
- **Improvement** — Fallback path yields a partial `tasks` array at root (`00_AssignmentSerialisation.js:29-45,75-77,92`), contradicting the documented "Full Hydration" shape in `DATA_SHAPES.md:847-885`. Either guarantee full definitions in `assign_full_*` or document the partial-`tasks` possibility for `getAssignment`.

#### Nitpick

- `ABClassResponseMapper.js:67-97` manual `_toReadView` duplicates `ABClass.toJSON()` field list; extract a shared `toReadViewJSON()` helper.

#### Incidental (triage)

- `WebApp.js:7` `doGet` now `createHtmlOutputFromFile` — confirm built HTML has no template scriptlets (`<?!= ?>`/`<?= ?>`).

### Security & secrets

- **Verdict:** Pass — no Critical findings.
- **Improvement (incidental)** — `ImageRenderer.tsx:37` `<img src={src} />` consumes unvalidated `string`; no script-exec XSS risk but an external/non-image URL could be supplied once wired to live data. Validate `data:image/...` at the component or `artifactContent` Zod boundary.
- **Nitpick (incidental)** — `apiService.ts:305`/`273` transport logging relies on key-only redaction; acceptable per policy but confirm no secret values in responses before production rich previews.
- **Positive** — `MarkdownRenderer` omits `rehype-raw` (no stored-XSS); `WebApp.js` change removes template-scriptlet evaluation (security-positive); `ABClassResponseMapper` narrows payload to `assignmentDefinitionKey`; no new OAuth scopes; no `dangerouslySetInnerHTML`/`eval`; supply-chain clean.

### Test-coverage gaps

- **Critical** — `00_AssignmentSerialisation.js:31-43` partial-definition fallback (the defining behaviour of the change) is **untested** in `tests/assignment/assignmentSerialisation.test.js`. No test asserts the fallback returns a valid `toPartialJSON()` shape or emits `ABLogger.warn`.
- **Improvement** — `getTaskPreviewData` null/unknown-`metricKey` return (`taskPreviewFixtures.ts:119-120`) untested; `taskPreviewFixtures.spec.ts` only exercises valid keys.
- **Improvement** — `ABClassResponseMapper._toReadView` false branch (no embedded `assignmentDefinition`) untested in `abclassController.readClass.test.js`.
- **Improvement** — `TaskPreviewCard.renderArtifact` empty-content-with-`computed` path (`TaskPreviewCard.tsx:143-152`) untested by `TaskPreviewCard.spec.tsx`.
- **Nitpick** — `buildMetricResult` (`TaskPreviewCard.tsx:60-99`) exercised only via rendering; add direct unit assertions.

### British-English consistency

- **Critical** — Branch mixes American `artifact` and British `artefact` for the same concept; normalise to British per AGENTS.md §3(4). Same-file evidence: `ACTION_PLAN.md:30` vs `:400`; `SPEC.md:19` vs `:339`/`:341`. Prose overwhelmingly American: `TASK_PREVIEW_CARD_LAYOUT.md` (11×), `SPEC.md` (38×), `ACTION_PLAN.md` (22×), `docs/releaseNotes/v0.7.3_release_notes.md` (2×).
- **Improvement** — American `artifact` baked into identifiers/contract: `BaseTaskArtifact`/`BaseTaskArtifactSchema`, `artifactType`/`artifactContent` (`TaskPreviewCard.tsx:47-48,138-140`), `renderArtifact`, and the `"artifact"` JSON key (`fixtures/*.json`, `taskPreviewFixtures.ts`). If `artifact` is adopted as a domain noun, document the exception.

#### Incidental (triage)

- `DATA_SHAPES.md` uses American `artifact` 25× on base branch (canonical contract doc, pre-existing) — separate normalisation outside this PR.
- `justify="center"`/`align="center"` and `micromark-util-normalize-identifier` are library API values, not leaks.

### Error-handling robustness

- **Critical** — `src/backend/AssignmentProcessor/Assignment/00_AssignmentSerialisation.js:31-42` — Broad `catch { }` (no error binding) around `assignmentDefinition.toJSON()` discards the error and silently falls back to `toPartialJSON()` (or raw definition object at `:41`) instead of rethrowing. Breaches backend Error/Logging Contract (§4: never suppress errors; prefer fail-fast log-and-rethrow) and the prime directive "Never silently swallow errors". Fix: detect partial-ness explicitly; if a `catch` stays, bind `err`, log, and rethrow (or narrow to the guard `TypeError`). Do not assign the raw definition object as fallback.
- **Improvement** — `classPageAdapter.ts:331` `primaryTitleByKey.get(definitionKey) ?? assignment.assignmentId` fails soft, inconsistent with `heatmapAdapter.ts:192-193` throwing `TaskTitlesUnavailableError`. Fail closed or log.
- **Nitpick** — `TaskPreviewCard.tsx:202` `METRIC_DISPLAY_META.get(metricKey)!` non-null assertion yields opaque `TypeError`; use an explicit guard.

#### Incidental (triage)

- `useClassPageData.ts:171-172` `runAdapterStep` returns silent `[null, null]` when `assignmentDefinitionPartials` is null; latent fail-soft path (currently unreachable).
- `assignmentAssessment.js:107-149` pre-existing `getAssignment_` uses bespoke validation, not `Validate.requireParams`; not introduced by this branch. No _new_ public backend method omits `Validate.requireParams` → checklist passes.
- `WebApp.js:7` `doGet` change adds no try/catch, still fails fast.

---

## Files changed (diff --stat)

```
 .opencode/plugins/no-eslint-silence.ts             |   31 +-
 .opencode/skills/pre-pr-review/SKILL.md            |  240 +++
 ACTION_PLAN.md                                     |  754 +++----
 SPEC.md                                            |  481 +++
 TASK_PREVIEW_CARD_LAYOUT.md                        |  345 +++++
 docs/developer/backend/DATA_SHAPES.md              |   59 +-
 docs/developer/frontend/frontend-logging-and-error-handling.md | 11 +
 docs/releaseNotes/v0.7.3_release_notes.md          |    4 +-
 src/backend/AssignmentProcessor/Assignment/00_AssignmentSerialisation.js | 33 +-
 src/backend/y_controllers/ABClassController/ABClassResponseMapper.js      | 58 +-
 src/backend/z_Api/WebApp.js                        |    2 +-
 src/backend/z_Api/assignmentAssessment.js          |   33 +-
 src/frontend/e2e-css-loader.mjs / -bootstrap.mjs   |  29 +/4 +
 src/frontend/e2e-tests/task-preview-card.spec.ts   | 188 +++
 src/frontend/package.json / package-lock.json      |   4 +/1575 +-
 src/frontend/src/AppThemeShell.tsx                 |   1 +
 src/frontend/src/components/ImageRenderer/*        |  42/45 +
 src/frontend/src/components/MarkdownRenderer/*     |  54/65/10
 src/frontend/src/features/classPage/*              | TaskPreviewCard, TaskHeatmapTable,
                                                    | taskPreviewFixtures, classPageAdapter,
                                                    | useClassPageData, fixtures/* + specs
 src/frontend/src/services/apiService.ts/.spec.ts   | 175/157 +-
 src/frontend/src/services/**/*Service.ts (+specs)  | assignmentAssessment, assignmentTopics,
                                                    | authService, backendConfiguration,
                                                    | googleClassrooms*, referenceData
 src/frontend/src/services/dataAnalysis/*           | analysers/*, heatmapAdapter, zod
 tests/api/assignmentReadApi.test.js / webApp.test.js | 50/20 +-
  tests/controllers/abclassController.readClass.test.js | 65 +-
  104 files changed, 5751 insertions(+), 908 deletions(-)
```

(Full per-file stat captured in `/tmp/opencode/previewcards-stat.txt`.)

---

# Reviewer Decisions

Every finding below (including incidental/triage items) was triaged by the author through the question
tool. Items are grouped by severity and focus. Each entry records the **decision**, the **target
location(s)**, the **nuance/rationale**, and any **dependency** on another decision. British English
is used throughout, per AGENTS.md §3(4).

## Critical findings

### C1 — Serialisation catch swallows errors and downgrades full→partial (`00_AssignmentSerialisation.js:31-42`)

- **Decision:** **Remove the fallback — fail fast.** Delete the `try/catch` around
  `this._assignment.assignmentDefinition.toJSON()` entirely. When a partial definition (tasks stored
  as an array) reaches `toJSON()`, let `AssignmentDefinition.toJSON()` throw its `TypeError`
  (`AssignmentDefinition.js:289-293`) and propagate. Callers that genuinely need a partial payload
  must call `toPartialJSON()` explicitly rather than relying on a silent degrade.
- **Nuance / rationale:** `toJSON()`'s contract is "emit the full object". The fallback violated that
  contract by emitting a _partial_ shape and, because the fallback sets root `tasks` from the partial
  (array form), it produced a payload that contradicts the documented "Full Hydration" shape in
  `DATA_SHAPES.md:847-885` (which expects `tasks` as a keyed object). This is error-masking, not
  useful resilience — the author explicitly agreed the degrade hides a real condition. The backend
  Error/Logging Contract (§4: never suppress errors with defensive feature detection; prefer fail-fast
  log-and-rethrow) is thereby restored.
- **Dependency:** Drives C5 (no degrade path remains to test) and enables I3 (see below).
- **Safety analysis — all `assignment.toJSON()` call sites audited.** Removing the fallback will not
  break any code path. Three consumers exist and all three are already guarded against a partial
  definition reaching `toJSON()`:

  | Call site              | File:line                           | Guard                                                                                                                                                                                                                                 |
  | ---------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `getAssignment_`       | `z_Api/assignmentAssessment.js:126` | `rehydrateAssignment` runs `_ensureFullDefinition` which calls `AssignmentDefinitionController.getDefinitionByKey()` to replace any partial definition with the full one before `toJSON()` is reached.                                |
  | `persistAssignmentRun` | `ABClassAssignmentOps.js:89`        | `Array.isArray(assignment.assignmentDefinition?.tasks)` check at `:76` throws `TypeError` before `toJSON()`.                                                                                                                          |
  | `_toReadView` fallback | `ABClassResponseMapper.js:82`       | **Dead code.** Only reached when `typeof assignment.toPartialJSON !== 'function'`, which is never true — `toPartialJSON` is defined on the `Assignment` prototype. The ternary at `:80-82` always takes the `toPartialJSON()` branch. |

  `ABClass.toJSON()` (which would cascade to `Assignment.toJSON()` on every assignment) has
  **zero callers** in the codebase — the `ABClassResponseMapper` explicitly avoids it
  (`:56-61`) citing partial-definition failures. Once C1 removes the fallback that caused
  those failures, the `ABClassResponseMapper` _can_ safely delegate to `abClass.toJSON()` (see I3).

- **Additional cleanup unlocked by C1.** Once the fallback is removed, the following become dead or
  simplify naturally:

  1. **`00_AssignmentSerialisation.js:30` — overly defensive guard.** `if (this._assignment.assignmentDefinition?.toJSON)` — remove the optional-chaining and existence check. Once C1 is applied, this block becomes a direct call because `assignmentDefinition` is always an `AssignmentDefinition` instance when set (it is never a raw object or `null` on the serialisation path). See also I3 — after that change the guard collapses further.

  2. **`ABClassResponseMapper.js:80-82` — dead ternary.** The `typeof assignment.toPartialJSON === 'function'` guard and the `: assignment.toJSON()` fallback vanish once `_toReadView` is deleted per I3.

  3. **`ABClassResponseMapper.js:56-61` `@remarks` — stale rationale.** Delete the comment block justifying manual field building; it cites the partial-definition failure mode that C1 removes.

### C2 — British-English `artifact`/`artefact` inconsistency

- **Decision:** **Normalise to British `artefact`** across the branch, including `DATA_SHAPES.md`
  (pre-existing 25× usage on base branch) — normalise now rather than deferring.
- **Scope:** Docs (`ACTION_PLAN.md`, `SPEC.md`, `TASK_PREVIEW_CARD_LAYOUT.md`,
  `docs/releaseNotes/v0.7.3_release_notes.md`), identifiers (`BaseTaskArtifact`/`BaseTaskArtifactSchema`,
  `artifactType`/`artifactContent`, `renderArtifact`), and JSON keys (`"artifact"` in
  `fixtures/{imageTask,table_task,textTask}.json` and `taskPreviewFixtures.ts`).
- **Nuance / rationale:** Per AGENTS.md §3(4). If the team prefers `artifact` as a deliberate domain
  noun, the reverse normalisation (fix the few British `artefact` occurrences, document the exception)
  was offered but **not** chosen — the author selected full British normalisation. `DATA_SHAPES.md`
  is the canonical contract doc; the author opted to normalise it within this branch rather than in a
  separate PR.
- **Dependency:** Touches JSON keys → coordinates with the fixtures decision (C4, ignored) only in
  that the feature-local fixtures are being deleted next round; the `test/shared` copies keep the
  normalised key.

### C3 — Dead `getAssignmentTopics` in `referenceDataService.ts:167-178`

- **Decision:** **Delete it.** Remove the function and its now-unused imports
  (`AssignmentTopicListResponse` type at `:3`, `AssignmentTopicListResponseSchema` at `:26`).
- **Nuance / rationale:** The function is exported but never imported by any production module; the
  only consumer imports `getAssignmentTopics` from `assignmentTopicsService` (the canonical home per
  frontend AGENTS §14 domain-folder org). Two same-named exported functions with identical backend
  method/schema are a maintenance trap and breach the service-domain folder rule.

### C4 — Duplicated fixture JSON across `features/classPage/fixtures/` and `test/shared/`

- **Decision:** **Ignore.** Leave both copies as-is.
- **Nuance / rationale:** The author confirmed the feature-local fixtures
  (`taskPreviewFixtures.ts` imports them) will be **deleted in the next implementation round** when
  previews are wired to full assignment objects. Fixing the duplication now would be wasted effort.
  (Note: this does not block C2's `artefact` key normalisation in `test/shared` copies.)

### C5 — Duplicated preview-truncation logic in `apiService.ts` (`:134-141` and `:175-179`)

- **Decision:** **Extract a shared helper.** Create `truncateForPreview(value, maxLen)` returning the
  truncated string (using the existing `ZOD_ERROR_PREVIEW_LENGTH` ellipsis behaviour) and call it from
  both `parseApiEnvelope` and `parseApiResponse`.
- **Nuance / rationale:** Both sites implement the identical `typeof data === 'string' ? data :
JSON.stringify(data)` + slice pattern; a single helper prevents drift if the length/ellipsis changes.

## Test-coverage Critical (dependent on C1)

### C6 — `00_AssignmentSerialisation.js:31-43` partial-definition fallback untested

- **Decision:** **No test.** Skip adding coverage.
- **Nuance / rationale:** Directly dependent on C1 — once the fallback is removed, there is no degrade
  path to exercise. The author agreed no test is needed.

## Improvement findings

### I1 — `classPageAdapter.ts:283-285,331` re-implements `definitionKey→partial` lookup

- **Decision:** **Use the seam helper** `getAssignmentDefinitionPartial`
  (`assignmentDefinitionUtilities.ts:20-24`) instead of building a local `primaryTitleByKey` map.
- **Nuance / rationale:** The helper's JSDoc explicitly states other consumers should use it rather
  than inlining the array find. Replacement form:
  `getAssignmentDefinitionPartial(assignmentDefinitionPartials, definitionKey)?.primaryTitle ?? …`.

### I2 — `classDetailService.ts:26-36` inlines `Schema.parse` + try/catch

- **Decision:** **Adopt `parseApiResponse`** (`parseApiResponse(ClassFullResponseSchema, 'getABClass', responseData)`).
- **Nuance / rationale:** Centralises the boilerplate the helper was extracted for and attaches the
  richer `zodIssues`/`responsePreview` diagnostics the inline version omits.

### I3 — `ABClassResponseMapper.js:62-90` hand-builds ABClass field list (and Nitpick I13)

- **Decision:** **Use `abClass.toJSON()` and delete `_toReadView`.** Replace the manual object with
  `abClass.toJSON()` then post-process each assignment (strip `_hydrationLevel`/`progressTracker`,
  swap embedded `assignmentDefinition` → `assignmentDefinitionKey`). The separate Nitpick
  (`_toReadView` duplicates `ABClass.toJSON()` field list) is subsumed by this deletion.
- **Nuance / rationale:** The original `@remarks` justified avoiding `toJSON()` because the call chain
  "fails when assignments carry a partial definition." That failure mode is removed by C1 (the
  serialisation fallback is gone, so `Assignment.toJSON()` throws instead of downgrading). The
  mapper's `_toReadView` can therefore safely delegate to `abClass.toJSON()` + post-process. The
  single backend emission point of `assignmentDefinitionKey` (`ABClassResponseMapper.js:91`) is
  preserved in the post-process step. C1's safety analysis confirmed that `ABClass.toJSON()` has
  zero callers today — implementing I3 restores `abClass.toJSON()` as the canonical serialisation
  path and eliminates the `~30`-line manual field list.
- **Side-effects of this change:**
  1. `ABClassResponseMapper.js:80-82` ternary (`typeof assignment.toPartialJSON === 'function'` /
     `assignment.toJSON()` fallback) disappears — the post-process iterates the assignments from
     `abClass.toJSON()` output directly.
  2. `ABClassResponseMapper.js:56-61` `@remarks` block (justifying manual field building) is deleted.
  3. `00_AssignmentSerialisation.js:30` `if (this._assignment.assignmentDefinition?.toJSON)` guard
     can be simplified to a direct call — after C1+I3, every assignment reaching `toJSON()` has a
     full `AssignmentDefinition` instance (C1 ensures throw-instead-of-degrade; I3 ensures the mapper
     routes through `abClass.toJSON()`).

### I4 — `taskPreviewFixtures.ts:106` unused `_taskId` parameter

- **Decision:** **Keep it.**
- **Nuance / rationale:** Retained deliberately for the future service-wiring contract; the author
  chose to keep the forward-looking parameter rather than remove speculative scope here.

### I5 — `taskPreviewFixtures.ts:56-100` two parallel `switch (metricKey)` blocks

- **Decision:** **Leave as-is.**
- **Nuance / rationale:** The author chose not to collapse `getFixtureEntry`/`getReasoning` into a
  single `Record` lookup.

### I6 — Analyser per-class Map rebuild (Performance)

- **Decision:** **Hoist the Maps to `analyse()`.**
- **Nuance / rationale:** `filterAssignments` (`averagingAnalyser.filters.ts:81-84`) and
  `accumulateDataPoints` (`averagingAnalyser.accumulation.ts:298-308`) each rebuild
  `definitionByKey`/`partialsByDefinitionKey`/`taskWeightByDefinitionKey` **inside** the per-class loop
  (`analyser.ts:71` maps `sortedClasses`). `P` (definition partials) and `T` (tasks-per-def) are
  identical for every class, so the O(P·T) build repeats C times. Hoisting into `analyse()` and passing
  the Maps down turns O(C·P·T + ΣA·I) into O(P·T + ΣA·I) — a constant-factor saving of ~C× on the
  lookup-build cost (C = class count). A real but modest win at current data sizes; the author elected
  to take it.

### I7 — `DateUtils.deepConvertDates` O(N) deep copy on `getAssignment_` hot path (Performance, incidental)

- **Decision:** **Confirm/leave.**
- **Nuance / rationale:** Acceptable because `getAssignment` fetches a single assignment; the O(N)
  deep copy is bounded by one response graph. No change.

### I8 — `callApi` payload Zod-validated twice (Performance, incidental)

- **Decision:** **Keep (different schemas).**
- **Nuance / rationale:** `parseApiEnvelope` validates the **generic transport envelope**
  `{ok, data, error}`; each service's `parseApiResponse` validates the **schema-specific inner
  `data`**. They validate different shapes, so this is envelope-vs-payload, not redundant validation of
  the same data. No consolidation needed.

### I9 — Layout / design / accessibility (four sub-items)

- **Decision:** **Fix all four.**
  1. **Width token** (`TaskPreviewCard.tsx:73` `CARD_MAX_WIDTH = 400`): introduce an intent-named token
     (e.g. `--app-panel-width-preview-card: 400px`) and reference it, per
     `frontend-loading-and-width-standards.md §7`.
  2. **Spacing/border tokens** (`MarkdownRenderer.module.css:9` `padding: 8px` → `var(--app-spacing-sm)`;
     `:8` `border: 1px solid #d9d9d9` → `var(--ant-color-border)`): removes raw literals and fixes
     dark-mode incompatibility.
  3. **Keyboard activation** (`TaskHeatmapTable.tsx:234` `Popover trigger={['hover','click']}` over a
     non-focusable `<span>` at `:241`): make the trigger focusable (`tabIndex={0}` + `role`/`aria-label`)
     or add a `focus` trigger so keyboard/SR users can open the preview.
  4. **Dead null branch** (`TaskPreviewCard.tsx:189-191` "Task data not available"): `TaskHeatmapTable.tsx:236`
     gates `content={previewData ? <TaskPreviewCard …/> : null}`, so the `data === null` branch is
     unreachable. Align code with `TASK_PREVIEW_CARD_LAYOUT.md` blocking-error state (pass `data` allowing
     `null`, or remove the dead branch).

### I10 — Frontend data shape: `assignmentDefinitionKey` consumer divergence

- **Decision:** **Align the schemas/consumers (frontend-only).** Make `assignmentDefinitionKey` **required**
  (not `z.string().nullable()`) in `classDetailService.zod.ts:133`, then unify the four consumers:
  - `averagingAnalyser.filters.ts:41-47` — already throws; keep.
  - `averagingAnalyser.accumulation.ts:311-319` — **delete** the now-unreachable `if (!definitionKey) continue` guard.
  - `heatmapAdapter.ts:187` — replace `?? ''` mask (which throws `TaskTitlesUnavailableError('')`) with a
    direct required lookup / explicit throw.
  - `classPageAdapter.ts:327` — replace the `?? assignment.assignmentId` soft fallback with fail-closed
    behaviour (ties to error-handling Improvement E1).
- **Research finding (billability):** `definitionKey` originates in the **backend**
  `AssignmentDefinition` model (`AssignmentDefinition.js:62,104,127-128` via `buildDefinitionKey`); it is
  surfaced to the frontend **only** at `ABClassResponseMapper.js:91`
  (`safe.assignmentDefinitionKey = safe.assignmentDefinition.definitionKey ?? null`). That `?? null` may
  stay as defensive transport-boundary code. **No backend schema change is required** — aligning the key
  is a **frontend-only** change (Zod + consumers). Therefore this is **not billable** backend work, contrary
  to the initial suspicion.
- **`metricScore` decoupling (`TaskPreviewCard.tsx:45-53`):** Leave as-is (not part of the align decision).

### I11 — Backend data shape: `ABClassResponseMapper._toReadView` field-list dup

- **Decision:** Subsumed by **I3** (delete `_toReadView`, use `toJSON()`).

### I12 — Security (incidental): `ImageRenderer.tsx:37` `<img src={src}>` unvalidated

- **Decision:** **Validate `data:image`.** Constrain `ImageRendererProperties.src` (`:18`) to a
  `data:image/...` URL, or enforce the constraint at the `artifactContent` Zod boundary.
- **Nuance / rationale:** No script-execution XSS (browsers ignore `javascript:` in img src and do not
  run scripts in img-rendered SVG), but an external `http(s)` URL or non-image `data:` URL could leak
  viewer IP/referrer or render unexpected content once wired to live backend data. Low severity; validate
  at the boundary.

### I13 — Test gaps: `getTaskPreviewData` null/unknown-metricKey, `_toReadView` false branch, `TaskPreviewCard` empty+computed

- **Decision:** **Leave as-is.** No new tests added for these paths.
- **Nuance / rationale:** The author chose not to add the three tests (null/unknown-metricKey,
  `_toReadView` missing-definition false branch, `TaskPreviewCard` empty-content-with-`computed`).

## Error-handling findings

### E1 — `classPageAdapter.ts:331` soft `?? assignment.assignmentId` fallback

- **Decision:** **Fail closed / log.** Replace the silent substitution with a throw or explicit log when
  the definition registry lacks the key, matching `heatmapAdapter.ts:192-193` which throws
  `TaskTitlesUnavailableError`. Coordinates with I10 (consumer alignment).

### E2 — `TaskPreviewCard.tsx:202` `METRIC_DISPLAY_META.get(metricKey)!` non-null assertion

- **Decision:** **Leave as-is.** Keep the non-null assertion (yields an opaque `TypeError` on a missing
  key, but the author accepted the risk).

### E3 — `useClassPageData.ts:171-172` silent `[null, null]` on null partials

- **Decision:** **Return an explicit error** (currently an unreachable latent fail-soft path behind the
  upstream `shouldRunPipeline` guard).

## Nitpick findings (all to be fixed)

### N1 — `00_AssignmentSerialisation.js:60-64` dense `Object.assign`/`fromEntries` chain

- **Decision:** **Fix** (revert to the clearer explicit `forEach` + `Object.hasOwn` guard, for KISS).

### N2 — `averagingAnalyser.accumulation.ts:332` needless `[...resolved.tasks]` spread

- **Decision:** **Fix** — pass `resolved.tasks` directly (param is `ReadonlyArray<TaskPartial>`); avoids
  the per-assignment O(T) allocation.

### N3 — `AppThemeShell.tsx:76` undocumented `motionDurationMid: '0.1s'`

- **Decision:** **Fix** — add an in-code comment citing the rationale (faster popover open/close for
  preview cards).

### N4 — `apiService.ts:147-165` verbose JSDoc on `parseApiResponse`

- **Decision:** **Fix** — trim the disproportionate 18-line JSDoc to convey the contract concisely.

### N5 — `taskPreviewFixtures.ts:80-92` redundant `getReasoning` switch

- **Decision:** **Fix** — replace with `entry.assessments[metricKey].reasoning`.
- **Nuance:** The original comment cites the `security/detect-object-injection` lint rule as the reason
  for the switch. Replacing with direct property access may trip that rule on a typed `Record`; if so,
  add a **targeted `eslint-disable` comment** for that line (do **not** disable the rule globally). The
  access is on a typed `Record`, not external input, so the disable is safe and localised.

### N6 — `MarkdownRenderer.tsx:27,42-44` speculative `className` prop

- **Decision:** **Fix** — remove the `className` prop and its class-merging logic (no caller passes it;
  Core Principle 3).

### N7 — `taskPreviewFixtures.ts:59,63,67` `as FixtureData` cast bypasses shape checks

- **Decision:** **Fix** — add a Zod validation or typed import for the fixture JSON rather than a bare cast.

## Incidental / triage findings (all to be ignored)

The following were raised as "Incidental (triage)" by reviewers and the author chose to **ignore** (no
code change, no further investigation):

- `WebApp.js:7` `doGet` `createTemplateFromFile(...).evaluate()` → `createHtmlOutputFromFile(...)` change
  (security-positive; confirm builder inlining separately if desired — not in scope).
- `apiService.ts:305`/`273` transport logging key-only redaction (sanctioned by logging policy §3;
  confirm no secret values in responses before production rich previews — out of scope).
- `TaskHeatmapPage.tsx:75` inline `definitionKey` lookup seam (duplicates `getAssignmentDefinitionPartial`).
- `averagingAnalyser` 85% coverage-confidence spot-check (no gap found).
- `taskPreviewFixtures.spec.ts:9-11` comment drift (null control keyed by `metricKey`, not `taskId`).
- `DATA_SHAPES.md` pre-existing American `artifact` usage — **excepted**: normalised per C2 (not ignored).
- `assignmentAssessment.js` pre-existing `getAssignment_` bespoke validation (not introduced by this branch).
- `useClassPageData.ts` silent null return — **excepted**: addressed per E3 (not ignored).

## Implementation sequencing note

Recommended order (minimises rework):

1. **C1** (remove serialisation fallback) — confirmed safe: all 3 `assignment.toJSON()` call sites
   already guard against partial definitions reaching the serialisation path. No breakage.

2. **C1-post-cleanup** — after C1 is applied, simplify or remove:
   - `00_AssignmentSerialisation.js:30` — remove optional-chaining and existence guard; make a direct
     `this._assignment.assignmentDefinition.toJSON()` call.
   - `ABClassResponseMapper.js:56-61` — delete stale `@remarks` block citing partial-definition
     failures as rationale for manual field building.

3. **I3** (delete `_toReadView`, use `abClass.toJSON()`) — now unblocked by C1. This eliminates the
   duplicated field list, the dead ternary at `:80-82`, and restores `abClass.toJSON()` as the
   canonical serialisation path.

4. E3 (useClassPageData error return) → classPageAdapter changes. C3 (delete dead `getAssignmentTopics`)
   and C5 (extract truncation helper).

5. I10 + E1 (data-shape alignment, frontend-only) — delete dead `accumulation.ts` guard.

6. I1, I2, I6, I9 (DRY, performance hoist, layout/a11y).

7. I12, N1–N7 (security validation, nitpicks).
8. C2 (British-English `artefact` normalisation, including `DATA_SHAPES.md`) — **DEFERRED** (see
   Deferred Work section below). Spellings left as-is for now.
9. C4 and I4/I5/I8/I13 and all Incidental items: **no action**.

---

## Deferred Work

### C2 — `artifact` → `artefact` British-English normalisation — **DEFERRED (2026-07-17)**

**Decision:** Leave all current `artifact`/`Artifact` spellings unchanged for now. The change is
documented here so it is not lost, but will be scheduled as a separate, explicitly-scoped piece of
work rather than folded into `feat/PreviewCards`.

**Rationale / risk analysis (captured so the future owner has full context):**

A naive find-and-replace of `artifact`→`artefact` / `Artifact`→`Artefact` across the whole repo
would cause concrete problems at the backend–frontend contract seam:

1. **Wire-format key.** The backend emits the serialised property name `artifact` and reads it back:
   - `src/backend/Models/StudentSubmission.js:110` → `artifact: this.artifact.toJSON()`
   - `src/backend/Models/StudentSubmission.js:162` → `ArtifactFactory.fromJSON(json.artifact)`
     The frontend Zod schemas parse that exact key:
   - `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts:87` → `artifact: BaseTaskArtifactSchema`
   - `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts:85` → `artifact: BaseTaskArtifactPartialSchema`
     Renaming the schema key to `artefact` would break parsing of real backend responses.

2. **Test fixtures mirroring the backend shape.** `textTask.json`, `table_task.json`, `imageTask.json`,
   `src/frontend/src/test/dataAnalysis/fixtures.ts`, `assignmentAssessment.zod.spec.ts`,
   `assignmentAssessmentService.spec.ts`, `classDetailService.spec.ts`, `classDetailService.zod.spec.ts`,
   `e2e-tests/helpers/task-heatmap-end-to-end-helpers.ts`, `e2e-tests/task-preview-card.spec.ts`
   all carry the `artifact` key intentionally to match the wire format.

3. **Docs describing the backend contract.** `docs/developer/backend/DATA_SHAPES.md`, `AssessmentFlow.md`,
   and `rehydration.md` document the real emitted shape and must stay in sync with the backend, not the
   other way round.

4. **Already-persisted assignment documents.** Any `assign_*` / `assdef_*` collection rows written with
   the old `artifact` key would no longer parse after a key rename (mitigated only by re-running
   assessments against a fresh database).

**Recommended future approach (when picked up):**

- Treat it as a **full-stack rename** (backend emission + frontend schema key + fixtures + specs + docs
  together) in its own PR, accompanied by a fresh-database re-run of affected assessments. Do **not**
  land a frontend-only key rename that desynchronises from the backend.
- Alternatively, if only cosmetic British-English consistency is wanted without a wire-format change,
  rename **only our own frontend-only identifiers** (`artifactType`/`artifactContent` props,
  `renderArtifact` function, the `BaseTaskArtifactSchema`/`BaseTaskArtifactPartialSchema` _type names_)
  and leave the `artifact:` schema keys, backend-mirroring fixtures, and backend docs untouched.

**Owner:** unassigned. **Branch target:** separate PR (not `feat/PreviewCards`).
