# Pre-PR Review — feat/PreviewCardWiring

- **Base branch:** main
- **Generated:** 2026-07-22
- **Regression gate:** SKIPPED (per explicit user instruction — not run)
- **Changed files:** 61 files changed, 20654 insertions(+), 594 deletions(-)

## Diff --stat summary

```
.opencode/agents/code-reviewer.md                  |     2 +-
.opencode/agents/planner-reviewer.md               |     2 +-
.opencode/agents/playwright.md                     |     2 +-
.opencode/scratchpad/buildCellPreviewLookup-review.md    |    61 +
.opencode/scratchpad/code-review-E3-useClassPageData.md  |   145 +
.opencode/scratchpad/code-review-I1-I2.md          |    84 +
.opencode/scratchpad/code-review-K3-K5-K6-K7.md    |    89 +
.opencode/scratchpad/code-review-assembleTaskPreviewData-green.md |    87 +
.opencode/scratchpad/code-review-assembleTaskPreviewData.md |   107 +
.opencode/scratchpad/full_diff.txt                 | 14050 +++++++++++++++++++
.opencode/scratchpad/review-deslop-preview-card.md |    95 +
.opencode/scratchpad/review-section5-taskheatmaptable.md |    80 +
.opencode/scratchpad/review-section5.5-task-preview-card-e2e.md |   109 +
.opencode/scratchpad/review-section6-clean.md      |    74 +
.opencode/scratchpad/review_PR_I9.md               |    79 +
.opencode/scratchpad/review_section4_taskheatmappage.md |   179 +
.opencode/scratchpad/review_section8_docs.md       |    85 +
.opencode/scratchpad/spreadsheetToMarkdownTable-review.md |    88 +
ACTION_PLAN.md                                     |  1683 +++
SPEC.md                                            |   755 +
docs/developer/frontend-shared-helpers-and-abstraction-standards.md |    30 +-
opencode.jsonc                                     |     2 +-
src/backend/ConfigurationManager/03_validators.js  |     8 +-
src/frontend/e2e-tests/helpers/task-heatmap-end-to-end-helpers.ts |   144 +
src/frontend/e2e-tests/settings-backend.spec.ts    |     4 +-
src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts |     3 +
src/frontend/e2e-tests/task-preview-card.spec.ts   |    19 +-
src/frontend/src/components/ImageRenderer/ImageRenderer.tsx |     4 +-
src/frontend/src/features/classPage/ClassPage.spec.tsx |    51 +-
src/frontend/src/features/classPage/ClassPageHeatmapView.spec.tsx |    78 +-
src/frontend/src/features/classPage/TaskHeatmapPage.spec.tsx |   527 +-
src/frontend/src/features/classPage/TaskHeatmapPage.tsx |    48 +-
src/frontend/src/features/classPage/TaskHeatmapTable.spec.tsx |   193 +-
src/frontend/src/features/classPage/TaskHeatmapTable.tsx |    92 +-
src/frontend/src/features/classPage/TaskPreviewCard.tsx |    11 +-
src/frontend/src/features/classPage/assembleTaskPreviewData.spec.ts |   339 +
src/frontend/src/features/classPage/assembleTaskPreviewData.ts |   109 +
src/frontend/src/features/classPage/buildCellPreviewLookup.spec.ts |   715 +
src/frontend/src/features/classPage/buildCellPreviewLookup.ts |    81 +
src/frontend/src/features/classPage/fixtures/imageTask.json |    34 -
src/frontend/src/features/classPage/fixtures/table_task.json |    32 -
src/frontend/src/features/classPage/fixtures/textTask.json |    32 -
src/frontend/src/features/classPage/spreadsheetToMarkdownTable.spec.ts |   111 +
src/frontend/src/features/classPage/spreadsheetToMarkdownTable.ts |    58 +
src/frontend/src/features/classPage/taskPreviewFixtures.spec.ts |   106 -
src/frontend/src/features/classPage/taskPreviewFixtures.ts |   124 -
src/frontend/src/features/settings/backend/backendSettingsForm.zod.spec.ts |   130 +-
src/frontend/src/features/settings/backend/backendSettingsFormMapper.spec.ts |   158 +-
src/frontend/src/features/settings/backend/useBackendSettings.spec.ts |     4 +-
src/frontend/src/features/settings/backend/backendConfiguration.zod.ts |     9 +-
src/frontend/src/features/settings/backend/backendConfigurationService.spec.ts |     4 +-
src/frontend/src/services/backendConfiguration/backendConfigurationValidation.spec.ts |    70 +
src/frontend/src/services/backendConfiguration/backendConfigurationValidation.ts |    16 +-
tests/configurationManager/configurationManager.test.js |    23 +-
tests/configurationManager/configurationManagerSection1Red.test.js |    10 +-
tests/configurationManager/configurationManagerSection1aRed.test.js |    11 +-
tests/singletons/configurationManagerLazyInit.test.js |     2 +-
```

## Verdict

**Needs Improvement** — No Critical or blocking defects were found. The branch is functionally sound and the new PreviewCard wiring respects backend boundaries. However, multiple non-blocking Improvements were raised across focuses (duplicated `ArtifactType` union, hard-coded width token, an unlabelled loading region, a missing dev-log on the title-error path, an unverified breaking API-key format change, and several untested branches). Address the Improvements, then re-run the regression gate before merging.

## Focus areas

### Repo rule compliance

- **[Improvement] `src/frontend/src/features/classPage/TaskHeatmapTable.tsx:187-198`** — `TaskPreviewSkeleton` re-hard-codes `400`, which is `CARD_MAX_WIDTH` owned by `TaskPreviewCard.tsx:66`. The comment states those constants "must NOT be refactored out of TaskPreviewCard.tsx", actively defending a duplication. Violates Core principle #5 (reuse existing modules). Fix: export `CARD_MAX_WIDTH` (and `CARD_BODY_MAX_HEIGHT` if needed) and import it; delete the comment.
- **[Improvement] `src/frontend/src/features/classPage/buildCellPreviewLookup.ts:9`** — `type ArtifactType = 'TEXT' | 'TABLE' | 'IMAGE' | 'SPREADSHEET' | 'base'` hand-copies the discriminator from `BaseTaskArtifactSchema` (`assignmentAssessment.zod.ts:47-60`). Will silently drift if a new artifact type is added. Fix: derive via `z.infer<typeof BaseTaskArtifactSchema>['type']` or export a shared type.
- **[Improvement] `src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts:14`** — `.trim()` silently normalises user input at the transport boundary rather than rejecting stray whitespace. Behaviour matches the backend, so not a defect, but deserves an explicit comment or removal.
- **[Improvement] `src/frontend/src/services/backendConfiguration/backendConfigurationValidation.ts:20`** — `return value !== '' && backendApiKeyTokenRegex.test(value);` — the regex can never match empty, so `value !== ''` is dead. Fix: reduce to `return backendApiKeyTokenRegex.test(value);`.
- **[Incidental] `src/frontend/src/features/classPage/TaskPreviewCard.tsx:131-154`** — An IMAGE artifact with `null` content mapped to `''` renders `<ImageRenderer src="" />` (broken image) rather than a placeholder, because the empty-content branch only handles `notAttempted`/`error` metric states. Pre-existing, not introduced by this diff, but now wired to real data.

### KISS & DRY

- **[Improvement] `src/frontend/src/features/classPage/buildCellPreviewLookup.ts:9`** — Duplicated `ArtifactType` union (see Repo rule compliance).
- **[Improvement] `src/frontend/src/features/classPage/buildCellPreviewLookup.ts:19`** — `CellPreviewData.artifactContent: unknown` discards the per-type content typing from `BaseTaskArtifactSchema`, forcing an `as` cast at `assembleTaskPreviewData.ts:99` and re-implementing discrimination by hand. Fix: model `artifactContent` as a discriminated union.
- **[Improvement] `src/frontend/src/features/classPage/TaskHeatmapTable.tsx:193-221`** — `TaskPreviewSkeleton` hard-codes `width: 400` and relies on a prose comment warning that `CARD_MAX_WIDTH`/`CARD_BODY_MAX_HEIGHT` "must NOT be refactored out" of `TaskPreviewCard.tsx` — fragile magic-number coupling.
- **[Improvement] `src/frontend/src/features/classPage/TaskHeatmapPage.tsx:174-197`** — The "log once" `useRef`+`useEffect` guard is now triplicated (with the pre-existing generic guard at 202-210). Fix: extract a small `useLogOnce` hook.
- **[Minor Improvement] `src/frontend/src/features/classPage/assembleTaskPreviewData.ts:62-109`** — `coerceArtifactType` and `coerceArtifactContent` both switch on `artifactType`; consider consolidating into one cohesive mapping (low priority, WET applies).

### De-Sloppification

- **[Nitpick] `src/frontend/src/services/backendConfiguration/backendConfigurationValidation.spec.ts:13-25`** — The first and third tests both call `expect(isBackendApiKeyToken(validApiKey)).toBe(true)` with the identical key; the third's name implies a distinct hyphen/underscore scenario but is byte-for-byte identical. Gives false coverage. Fix: delete it or use a key that exercises multiple hyphens/underscores in the token.
- **[Nitpick] `src/frontend/src/features/classPage/TaskHeatmapPage.tsx:248`** — The `<TaskHeatmapTable ... />` invocation is a single line exceeding 160 characters, inconsistent with the file's own wrapping. Break props onto separate lines.

### Performance (Big-O)

- **[Improvement] `src/frontend/src/features/classPage/TaskHeatmapTable.tsx:279-280`** — `assembleTaskPreviewData` (and thus `spreadsheetToMarkdownTable`, O(Rₛ×Cₛ)) is called **unconditionally inside the Ant Design `render` callback for every visible cell on every re-render**. The `CellPreviewLookup` Map is keyed by `taskId`, so the same SPREADSHEET artifact is shared across all three metric sub-columns of a task → the conversion runs **3× per (student, task) per render**. Worst case ≈ `VisRows × Tasks × 3 × O(Rₛ × Cₛ)`; cost is also paid while loading/error. Fix: defer conversion until the popover is actually opened (lazy `open` state), or memoïse by `cellData` reference so the three metric columns share one converted string.
- **[Improvement (minor)] `src/frontend/src/features/classPage/TaskHeatmapTable.tsx:277-315`** — `assembleTaskPreviewData` allocates a fresh object for every cell every render even when `isAssignmentLoading`/`showAssignmentError` make it discarded. Fix: short-circuit before assembling when loading/error.
- **[Incidental — Nitpick] `src/frontend/src/features/classPage/TaskHeatmapPage.tsx:70-83`** — `getHeaderLabels` does two linear O(A)/O(P) scans (`Array.find`). Computed once per data change via `useMemo`, so acceptable; a `Map`-backed lookup would give O(1).

### Logging rules compliance

- **[Improvement] `src/frontend/src/features/classPage/TaskHeatmapPage.tsx:216-230`** — The `isTitleError` branch renders an `Alert` for `TaskTitlesUnavailableError` but emits **no** developer diagnostic, unlike the sibling generic-error and assignment-not-found branches (which log via `logFrontendError`/`logFrontendEvent`). Violates the frontend error-flow contract (catch → dev log + user-safe copy). Fix: add `logFrontendEvent('warn', { context: 'TaskHeatmapPage', errorMessage: 'Task titles are currently unavailable.' })` for parity, keeping the `Alert`.
- **[Incidental — Nitpick] `src/backend/ConfigurationManager/03_validators.js:6-9,48-55`** — The diff removes the `// eslint-disable-next-line security/detect-unsafe-regex` directive. The new pattern is anchored and bounded (`{32}`), so it should be safe, but because lint was not run the implementer should confirm the `security/detect-unsafe-regex` rule still passes rather than relying on the deleted suppression.

### Frontend layout / design / accessibility (optional)

- **[Improvement] `src/frontend/src/features/classPage/TaskHeatmapTable.tsx:195-199`** — `TaskPreviewSkeleton` renders `<div role="status" aria-busy="true" style={{ width: 400 }}>` with no text and no `aria-label`. Per `frontend-loading-and-width-standards.md` §8, the status region should be labelled. Fix: add `aria-label="Loading task preview"` (or visually-hidden "Loading…" text).
- **[Improvement] `src/frontend/src/features/classPage/TaskHeatmapTable.tsx:198` (+comment :185-189)** — `style={{ width: 400 }}` duplicates the private `CARD_MAX_WIDTH = 400` in `TaskPreviewCard.tsx:66`. Per `frontend-loading-and-width-standards.md` §7 ("Do not duplicate raw width literals"), this is a violation; the "must NOT be refactored out" comment also contradicts the width-token rule.
- **[Nitpick] `src/frontend/src/features/classPage/TaskHeatmapTable.tsx:185-189`** — The skeleton comment cross-references `CARD_BODY_MAX_HEIGHT = 480` but the function never uses `480` (it uses `height: 120`). Remove the inaccurate reference.
- **[Nitpick] `src/frontend/e2e-tests/helpers/task-heatmap-end-to-end-helpers.ts:321,327,344`** — New identifiers use American `artifact*` (`HEATMAP_ARTIFACT_CONTENT`, `artifactTypeFor`, `buildArtifact`). This matches the pre-existing `TaskPreviewCard` convention, so not a new regression; flagged opportunistically.
- **[Incidental — Improvement] `src/frontend/src/features/classPage/TaskHeatmapTable.tsx:300-312`** — The popover trigger `<span role="button" tabIndex={0}>` correctly wires Enter/Space → click, but has no `aria-label` (name is just the score digit) and lacks `aria-haspopup`/`aria-expanded`. Add a mirroring `aria-label` and consider `aria-haspopup="dialog"`.

### Frontend data shape / schema consistency (optional)

- **[Improvement] `src/frontend/src/features/classPage/assembleTaskPreviewData.ts:65-85`** — `coerceArtifactType` `switch` has no `default`/exhaustiveness assertion. Adding an artifact type to `BaseTaskArtifactSchema` + `ArtifactType` but missing this switch yields `undefined` at runtime while typed as `TaskPreviewData['artifactType']`. Fix: add `default: { const _exhaustive: never = type; throw new Error(...) }`.
- **[Improvement] `src/frontend/src/features/classPage/buildCellPreviewLookup.ts:9`** — Hand-rolled duplicate of the `BaseTaskArtifactSchema` discriminator (root cause of the above). Derive from the schema.
- **[Improvement] `src/frontend/src/features/classPage/buildCellPreviewLookup.ts:48-50`** — `reasoning` is looked up via `assessments[key]` keyed by `HeatmapMetricKey` against `assessments: Record<string, Assessment>` (keyed by arbitrary backend metric names). If backend keys diverge, `reasoning` silently becomes `''`. Fix: assert/document the invariant or map explicitly.
- **[Improvement] `src/frontend/src/features/classPage/TaskHeatmapTable.tsx:279-289` + `assembleTaskPreviewData.ts:24-44`** — The null-cell branch forwards `metricResult.state` and returns empty content. When `cellData === null` but `m.state === 'computed'`, the card shows a _computed_ score with empty content/reasoning, contradicting no-submission semantics (`TaskPreviewCard.tsx:136-142` only handles `notAttempted`/`error`). Fix: derive `metricState` explicitly for the null case.
- **[Improvement] `src/frontend/src/features/classPage/spreadsheetToMarkdownTable.ts:43-52`** — `columnCount` from `rows[0].length` but `buildRow` iterates each row's own length; ragged rows produce mis-aligned GFM tables. Fix: pad rows to `columnCount`.
- **[Improvement] `src/frontend/src/features/classPage/buildCellPreviewLookup.ts:19`** — `artifactContent: unknown` discards per-type content shape, forcing the blind cast at `assembleTaskPreviewData.ts:98-103`. Fix: model as a discriminated union.
- **[Nitpick] `src/frontend/src/features/classPage/TaskHeatmapTable.tsx:193-221`** — Hard-coded `width: 400`, brittle-coupled to private `CARD_MAX_WIDTH`/`CARD_BODY_MAX_HEIGHT`. (See layout focus.)

### Backend data shape / schema consistency (optional)

- **[Improvement] `src/backend/ConfigurationManager/03_validators.js:48-54`** — `validateApiKey` validates `value.trim()` but returns the untrimmed `value`, so a non-frontend caller could persist whitespace-padded keys that the frontend's trimmed contract would later reject. Fix: `return value.trim();`.
- **[Improvement] `tests/configurationManager/configurationManager.test.js:126-152, 725-729`** — Backend API-key tests cover only one valid sample + a couple of invalid cases, while the frontend spec exercises the full boundary (31/33-char token, illegal `+`, missing underscore, leading hyphen). For a two-runtime contract, mirror those cases on the backend.
- **[Improvement] `src/frontend/src/services/backendConfiguration/backendConfigurationValidation.ts:19-21`** — `isBackendApiKeyToken` does not trim internally, unlike backend `validateApiKey`/`isValidApiKey`. Today all callers pre-trim, so behaviour agrees, but the helper is not a faithful mirror.
- **[Incidental — Improvement] `src/backend/ConfigurationManager/98_ConfigurationManagerClass.js:95-103`** — The `API_KEY_PATTERN` getter JSDoc still describes the **old** hyphen-slug contract; update to the new `prefix_32base64url` contract.
- **[Incidental — Nitpick] `src/backend/ConfigurationManager/98_ConfigurationManagerClass.js:14`** — Class `@example` calls a non-existent `setLangflowApiKey('sk-abc123')`; switch to `setApiKey('abt_...')`.

### Security & secrets (optional)

- **[Improvement] `src/backend/ConfigurationManager/03_validators.js:9`** (mirror `backendConfigurationValidation.ts:7`) — The new `API_KEY_PATTERN = /^[A-Za-z0-9]+_[A-Za-z0-9_-]{32}$/u` is _stricter_ (does not weaken acceptance of previously-valid weak keys) but is a **breaking format change**. If the real LLM Service key-issuance format differs (no underscore, different length), legitimate new keys cannot be saved and pre-existing legacy-format stored keys make `isValidApiKey` return `false`. Fix: explicitly confirm the LLM Service emits `prefix_32base64url`; if not, reconcile before merge.
- **[Improvement] `src/backend/ConfigurationManager/03_validators.js`** — The removed `// eslint-disable-next-line security/detect-unsafe-regex` leaves a latent lint/CI risk for the new pattern (still contains a `+` quantifier). Fix: re-add the disable with justification or run `npm run lint:backend` to confirm.
- **[Nitpick] `src/frontend/src/services/backendConfiguration/backendConfigurationValidation.ts:19-21`** — `isBackendApiKeyToken` tests the raw value without trimming (see Backend data shape). Align or document.
- **[Incidental — Positive] `src/backend/z_Api/WebApp.js`** — `doGet()` changed from `createTemplateFromFile(...).evaluate()` to `createHtmlOutputFromFile(...)`, removing the templating engine (and any `<?!= ?>` force-print XSS vector) from the serve path. No `<?= ?>`/`<?!= ?>` scriptlets exist in any repository HTML. Net security improvement; flagged for awareness.
- **[Incidental — Confirmation] `src/backend/z_Api/apiConfig.js` + `backendConfiguration.zod.ts`** — Masked-key contracts match; a full token is rejected by `MaskedApiKeySchema`, so a leaked key in the read payload fails transport validation. Masking sound end-to-end.

### Test-coverage gaps (optional)

- **[Improvement] `src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts:12-17`** — `BackendApiKeyWriteSchema` now `.trim()`s the write-key schema with no `backendConfiguration.zod.spec.ts` existing and `backendConfigurationService.spec.ts` never parsing a whitespace-surrounded key. Add a spec asserting `safeParse(' abt_... ').success === true` and rejection after trimming.
- **[Improvement] `src/frontend/src/features/classPage/assembleTaskPreviewData.ts:97-101`** — SPREADSHEET branch `coerceArtifactContent`: null content → `?? []` yields empty table; no spec supplies a SPREADSHEET cell with null content. Add a test.
- **[Improvement] `src/frontend/src/features/classPage/assembleTaskPreviewData.ts:107-108`** — TEXT/TABLE/IMAGE default `String(cellData.artifactContent ?? '')`; no spec supplies a null-content cell. Add a test.
- **[Improvement] `src/frontend/src/features/classPage/buildCellPreviewLookup.ts:64-78`** — If the same `studentId` appears in two submissions, the second `outerMap.set` overwrites the first entirely, silently dropping earlier items. No spec exercises duplicate student submissions. Add a test and document whether overwrite is intended.
- **[Improvement] `src/frontend/src/features/classPage/spreadsheetToMarkdownTable.ts:46-57`** — `columnCount` from `rows[0].length`; empty header `[]` and jagged rows never exercised. Add `spreadsheetToMarkdownTable([[]])` and `spreadsheetToMarkdownTable([['A','B'],[1]])` tests.
- **[Incidental — Improvement] `src/frontend/src/services/backendConfiguration/backendConfigurationValidation.ts:43-45`** — `isDriveFolderId` exported but not covered by `backendConfigurationValidation.spec.ts`. Add a test.
- **[Incidental — Improvement] `src/frontend/src/features/classPage/TaskHeatmapTable.tsx:277-315`** — Popover render exercised only with a TEXT `CellPreviewData`; IMAGE/TABLE/SPREADSHEET branches never rendered through the heatmap popover. Add coverage (and confirm `e2e-tests/task-preview-card.spec.ts` covers non-TEXT artifacts).
- **[Incidental — Improvement] `src/frontend/src/features/classPage/TaskHeatmapTable.tsx:137-154`** — `heatmapMetricComparator` (wired into each metric sub-column `sorter`) is not exercised. Add a test for ordering.
- **[Incidental — Nitpick] `src/frontend/src/services/backendConfiguration/backendConfigurationValidation.ts:29-35`** — `isMaskedBackendApiKeyValue` wrong-length branch untested (e.g. `'****ab'` should be `false`).
- **[Incidental — Improvement] `tests/configurationManager/configurationManager.test.js:728-729`** — No explicit regression test that a legacy hyphen-separated key of valid length with no underscore is now rejected. Add a test asserting `false` + the new error message.

### British-English consistency (optional)

- **[Nitpick] `artifact` (American) → `artefact` (British)** — Pervasive across `assembleTaskPreviewData.ts`, `buildCellPreviewLookup.ts`, `TaskHeatmapTable.tsx:213`, `e2e-tests/task-preview-card.spec.ts`. **Recommendation: do NOT fix in this PR** — `artifact` mirrors the backend data model (`item.artifact`) and is the established repo-wide convention (43 files vs 6 for `artefact`). A local rename would break the backend-mirror contract. Raise a separate repo-wide decision if strict compliance is desired.
- **[Incidental — Positive]** British correctly used: `behaviour` (03_validators.js:3), `flavoured` (spreadsheetToMarkdownTable.ts), `analyser's` (assembleTaskPreviewData.ts), `labelled` (TaskHeatmapTable.spec.tsx:611). Ant Design `align="center"` props are CSS API literals, not vocabulary leaks.

### Error-handling robustness (optional)

- **[Improvement] `src/frontend/src/features/classPage/assembleTaskPreviewData.ts:67-77`** — `coerceArtifactType` `switch` has no `default`; an unknown artifact type makes the function implicitly return `undefined`, producing `artifactType: undefined` and downstream `renderArtifact` rendering nothing (silent failure). Fix: add `default: throw new Error(...)`.
- **[Improvement] `src/frontend/src/features/classPage/assembleTaskPreviewData.ts:80-91`** — Two silent fallbacks in `coerceArtifactContent`: (1) generic `String(cellData.artifactContent ?? '')` — an `IMAGE` with `null` content → `''` → broken `ImageRenderer`; an object → `'[object Object]'`. (2) `SPREADSHEET` branch casts then `?? []` before `spreadsheetToMarkdownTable`, so a non-array payload is silently fed to the formatter. Fix: validate content shape per `artifactType`; throw/log on missing/invalid content.
- **[Improvement] `src/frontend/src/features/classPage/buildCellPreviewLookup.ts:64-76`** — Dereferences `item.artifact.type/content`, `item.assessments` with no shape guard; a malformed submission throws an opaque `TypeError` deep in the loop, and the caller (`TaskHeatmapPage.tsx:165-168`) runs it inside `useMemo` with no `try/catch`. Mitigated by `AssignmentFull` Zod validation, but the function gives no self-describing failure. Fix: rely on the Zod guarantee explicitly with a comment, or throw a descriptive error on missing `items`/`artifact`.
- **[Improvement] `src/backend/ConfigurationManager/03_validators.js:48-55`** — `validateApiKey` guards with `Validate.isNonEmptyString(value)` rather than the mandated `Validate.requireParams({ value }, 'validateApiKey')` contract (backend AGENTS.md §3). Still fails fast but inconsistent. Fix: add `Validate.requireParams` at the top.
- **[Nitpick] `backendConfigurationValidation.ts:9` & `03_validators.js:9`** — API-key regex duplicated across runtimes; no automated drift guard. Fix (optional): add a parity test asserting both accept/reject the same samples.
- **[Nitpick] `src/frontend/src/features/classPage/spreadsheetToMarkdownTable.ts:17-22`** — `formatCell` handles `null` but not `undefined`; a ragged row yields literal `'undefined'`. Fix: treat `cell == null` as empty.
- **[Incidental — Improvement] `src/frontend/src/features/classPage/TaskPreviewCard.tsx:189`** — `METRIC_DISPLAY_META.get(metricKey)!` non-null assertion; an absent key throws an opaque `TypeError` during render. Guard with a descriptive error/safe label.
- **[Incidental — Nitpick] `src/frontend/src/features/classPage/TaskHeatmapTable.tsx:193-221`** — Hard-coded `width: 400` cross-referencing private constants (see layout focus).
- **[Incidental — Positive] `src/frontend/src/features/classPage/TaskHeatmapPage.tsx:103-110`** — `computeHeatmapState` `try/catch` returns the error into state and is correctly surfaced (not swallowed); log-once guards follow the same pattern.

## Decisions

### Repo rule compliance

- **[Improvement] `buildCellPreviewLookup.ts:9`** — Decision: **Fix now**. Approach: replace the hand-written `ArtifactType` union with `z.infer<typeof BaseTaskArtifactSchema>['type']` (or export a shared type from the schema module) so the two cannot drift.
- **[Improvement] `TaskHeatmapTable.tsx:185-221`** — Decision: **Don't fix (with comment improvement)**. Rationale: the user notes the preview card differs from all other cards and is unlikely to be reused, so sharing the width token is not warranted. Approach: improve the existing comment to make the deliberate non-sharing explicit rather than removing it.
- **[Improvement] `backendConfiguration.zod.ts:14`** — Decision: **Fix now** (covered by the lint/parity item below — make the regex safe and confirm trimming behaviour is intentional and documented).
- **[Improvement] `backendConfigurationValidation.ts:20`** — Decision: **Fix now** (part of test-gaps/cleanup batch). Reduce `return value !== '' && backendApiKeyTokenRegex.test(value);` to `return backendApiKeyTokenRegex.test(value);`.
- **[Incidental] `TaskPreviewCard.tsx:131-154`** — Decision: **Wontfix** for this PR (pre-existing, broader empty-content placeholder work). Noted for a future cleanup ticket.

### KISS & DRY

- **[Improvement] `buildCellPreviewLookup.ts:9`** — Decision: **Fix now** (see Repo rule compliance).
- **[Improvement] `buildCellPreviewLookup.ts:19`** — Decision: **Fix now**. Approach: model `CellPreviewData.artifactContent` as a discriminated union derived from `BaseTaskArtifactSchema` so the `as` cast at `assembleTaskPreviewData.ts:99` is removed.
- **[Improvement] `TaskHeatmapTable.tsx:193-221`** — Decision: **Don't fix**; improve the comment only (see Repo rule compliance rationale).
- **[Improvement] `TaskHeatmapPage.tsx:174-197`** — Decision: **Fix now**. Approach: extract a small `useLogOnce` hook and use it for the three log-once guards.
- **[Minor Improvement] `assembleTaskPreviewData.ts:62-109`** — Decision: **Fix now** (consolidate `coerceArtifactType`/`coerceArtifactContent` as part of the exhaustive-switch and content-validation fixes below).

### De-Sloppification

- **[Nitpick] `backendConfigurationValidation.spec.ts:13-25`** — Decision: **Fix now**. Approach: remove the duplicate identical test or give the third test a key that exercises multiple hyphens/underscores in the 32-char token.

### Performance (Big-O)

- **[Improvement] `TaskHeatmapTable.tsx:279-280`** — Decision: **Fix now**. Approach: defer the `assembleTaskPreviewData`/`spreadsheetToMarkdownTable` conversion until the popover is actually opened (lazy `open` state), eliminating the per-render and 3×-per-task waste; also memoïse by `cellData` reference so the three metric columns share one converted string.
- **[Improvement (minor)] `TaskHeatmapTable.tsx:277-315`** — Decision: **Fix now** (folded into the lazy-popover fix above): short-circuit before assembling preview data when `isAssignmentLoading || showAssignmentError`.
- **[Incidental] `TaskHeatmapPage.tsx:70-83`** — Decision: **Wontfix** (computed once via `useMemo`; acceptable).

### Logging rules compliance

- **[Improvement] `TaskHeatmapPage.tsx:216-230`** — Decision: **Fix now**. Approach: add `logFrontendEvent('warn', { context: 'TaskHeatmapPage', errorMessage: 'Task titles are currently unavailable.' })` alongside the existing `Alert`.
- **[Incidental] `03_validators.js:6-9,48-55`** — Decision: **Fix now** (see Security focus): make the regex demonstrably safe and re-add the `eslint-disable` with justification if the lint rule still fires.

### Frontend layout / design / accessibility (optional)

- **[Improvement] `TaskHeatmapTable.tsx:195-199`** — Decision: **Fix now**. Approach: add `aria-label="Loading task preview"` to the `role="status"` skeleton region.
- **[Improvement] `TaskHeatmapTable.tsx:198`** — Decision: **Don't fix / improve comment** (see Repo rule compliance width decision).
- **[Nitpick] `TaskHeatmapTable.tsx:185-189`** — Decision: **Fix now** (folded into the comment-improvement for the width item): remove the inaccurate `CARD_BODY_MAX_HEIGHT = 480` reference.
- **[Nitpick] `task-heatmap-end-to-end-helpers.ts:321,327,344`** — Decision: **Wontfix** (matches existing `TaskPreviewCard` convention).
- **[Incidental] `TaskHeatmapTable.tsx:300-312`** — Decision: **Fix now**. Approach: add a mirroring `aria-label` and `aria-haspopup="dialog"` to the popover trigger.

### Frontend data shape / schema consistency (optional)

- **[Improvement] `assembleTaskPreviewData.ts:65-85`** — Decision: **Fix now**. Approach: add `default: { const _exhaustive: never = type; throw new Error(\`Unhandled artifact type: ${type}\`); }`.
- **[Improvement] `buildCellPreviewLookup.ts:9`** — Decision: **Fix now** (derive from schema).
- **[Improvement] `buildCellPreviewLookup.ts:48-50`** — Decision: **Fix now** (folded into artifactContent discriminated-union work): assert/document the `assessments` key invariant or map explicitly.
- **[Improvement] `TaskHeatmapTable.tsx:279-289` + `assembleTaskPreviewData.ts:24-44`** — Decision: **Fix now** (folded into lazy-popover + content-validation fixes): derive `metricState` explicitly for the null-cell case so a `computed` score is never shown with empty content.
- **[Improvement] `spreadsheetToMarkdownTable.ts:43-52`** — Decision: **Fix now** (test-gaps batch): pad ragged rows to `columnCount`.
- **[Improvement] `buildCellPreviewLookup.ts:19`** — Decision: **Fix now** (discriminated union).

### Backend data shape / schema consistency (optional)

- **[Improvement] `03_validators.js:48-54`** — Decision: **Fix now**. Approach: `return value.trim();` so persisted key matches the validated form.
- **[Improvement] `tests/configurationManager/configurationManager.test.js:126-152,725-729`** — Decision: **Fix now** (test-gaps batch): mirror the frontend boundary cases (31/33-char token, illegal `+`, missing underscore, leading hyphen, legacy hyphen key rejected).
- **[Improvement] `backendConfigurationValidation.ts:19-21`** — Decision: **Fix now** (Security parity item): align `isBackendApiKeyToken` to trim before testing, or document that callers must pre-trim.
- **[Incidental] `98_ConfigurationManagerClass.js:95-103`** — Decision: **Fix now**. Approach: update the `API_KEY_PATTERN` getter JSDoc to the new `prefix_32base64url` contract.
- **[Incidental] `98_ConfigurationManagerClass.js:14`** — Decision: **Fix now**. Approach: switch the `@example` to `setApiKey('abt_...')`.

### Security & secrets (optional)

- **[Improvement] `03_validators.js:9`** — Decision: **Confirmed**. The user confirmed the LLM Service issues keys in the `prefix_32base64url` format, so the stricter pattern is safe to merge.
- **[Improvement] `03_validators.js` (removed eslint-disable)** — Decision: **Fix the regex so it is safe**. Approach: confirm the anchored, bounded pattern does not trigger `security/detect-unsafe-regex`; re-add the disable with justification only if the lint rule still fires. Aligned with the Logging focus item.
- **[Nitpick] `backendConfigurationValidation.ts:19-21`** — Decision: **Fix now** (align helper to trim).
- **[Incidental] `z_Api/WebApp.js`** — Decision: **No action** (positive security improvement).
- **[Incidental] masked-key contracts** — Decision: **No action** (verified sound).

### Test-coverage gaps (optional)

- **[Improvement] `backendConfiguration.zod.ts:12-17`** — Decision: **Fix now**. Approach: add `backendConfiguration.zod.spec.ts` asserting a whitespace-surrounded key passes and an invalid key still fails after trimming.
- **[Improvement] `assembleTaskPreviewData.ts:97-101,107-108`** — Decision: **Fix now**. Approach: add specs for SPREADSHEET/TEXT/TABLE/IMAGE cells with null content.
- **[Improvement] `buildCellPreviewLookup.ts:64-78`** — Decision: **Fix now**. Approach: add a spec with two submissions for one `studentId` and document whether overwrite is intended (currently last-wins).
- **[Improvement] `spreadsheetToMarkdownTable.ts:46-57`** — Decision: **Fix now**. Approach: add specs for `[[]]` and ragged rows; also pad ragged rows to `columnCount` in the implementation.
- **[Incidental] `backendConfigurationValidation.ts:43-45`** — Decision: **Fix now**. Approach: add a spec for `isDriveFolderId` (accept `folder12345`, reject `short`/`bad id!`).
- **[Incidental] `TaskHeatmapTable.tsx:277-315`** — Decision: **Fix now**. Approach: add popover render coverage for IMAGE/TABLE/SPREADSHEET `CellPreviewData`, and confirm `e2e-tests/task-preview-card.spec.ts` covers non-TEXT artifacts.
- **[Incidental] `TaskHeatmapTable.tsx:137-154`** — Decision: **Fix now**. Approach: add a spec clicking a metric sub-column sorter and asserting comparator ordering.
- **[Incidental] `backendConfigurationValidation.ts:29-35`** — Decision: **Fix now**. Approach: add a spec asserting `isMaskedBackendApiKeyValue('****ab')` is `false`.
- **[Incidental] `configurationManager.test.js:728-729`** — Decision: **Fix now**. Approach: add a regression test that a legacy hyphen-separated key with no underscore is now rejected with the new message.

### British-English consistency (optional)

- **[Nitpick] `artifact`** — Decision: **Wontfix**. Rationale: `artifact` mirrors the backend data model (`item.artifact`) and is the established repo-wide convention (43 files vs 6 for `artefact`); a local rename would break the backend-mirror contract. A separate repo-wide decision can be raised if strict compliance is desired.

### Error-handling robustness (optional)

- **[Improvement] `assembleTaskPreviewData.ts:67-77`** — Decision: **Fix now** (exhaustive `never` default that throws).
- **[Improvement] `assembleTaskPreviewData.ts:80-91`** — Decision: **Fix now**. Approach: validate content shape per `artifactType`; throw/log on missing or invalid content rather than silently coercing.
- **[Improvement] `buildCellPreviewLookup.ts:64-76`** — Decision: **Wontfix** (the user opted not to add a guard; mitigated by `AssignmentFull` Zod validation upstream).
- **[Improvement] `03_validators.js:48-55`** — Decision: **Wontfix** (the user opted not to add `Validate.requireParams`; method still fails fast via `Validate.isNonEmptyString`).
- **[Nitpick] `backendConfigurationValidation.ts:9` & `03_validators.js:9`** — Decision: **Fix now** (parity test is folded into the test-gaps batch / lint-safe fix above).
- **[Nitpick] `spreadsheetToMarkdownTable.ts:17-22`** — Decision: **Fix now** (folded into the ragged-rows fix): treat `cell == null` as empty.
- **[Incidental] `TaskPreviewCard.tsx:189`** — Decision: **Wontfix** (pre-existing, out of scope for this diff).
- **[Incidental] `TaskHeatmapTable.tsx:193-221`** — Decision: **Don't fix / comment only** (see width decision).
- **[Incidental] `TaskHeatmapPage.tsx:103-110`** — Decision: **No action** (verified sound).

## Cross-cutting themes (deduplicated)

The following items recur across multiple focuses and should be treated as a single remediation each:

1. **Duplicate `ArtifactType` union** — `buildCellPreviewLookup.ts:9` (Repo rule, KISS/DRY, Frontend data shape, Error-handling). Derive from `BaseTaskArtifactSchema`.
2. **`CellPreviewData.artifactContent: unknown`** — `buildCellPreviewLookup.ts:19` (KISS/DRY, Frontend data shape). Model as discriminated union.
3. **Hard-coded width `400` / contradictory comment** — `TaskHeatmapTable.tsx:185-221` (Repo rule, KISS/DRY, Layout/a11y, Data shape). Export/import `CARD_MAX_WIDTH`.
4. **`coerceArtifactType` no exhaustive `default`** — `assembleTaskPreviewData.ts:65-85` (Frontend data shape, Error-handling). Add `never` default that throws.
5. **`coerceArtifactContent` silent fallbacks** — `assembleTaskPreviewData.ts:80-101` (Error-handling, Test coverage). Validate content shape per type.
6. **Unlabelled `role="status"`** — `TaskHeatmapTable.tsx:195-199` (Layout/a11y).
7. **Title-error path not dev-logged** — `TaskHeatmapPage.tsx:216-230` (Logging).
8. **Eager per-cell `spreadsheetToMarkdownTable` (Big-O)** — `TaskHeatmapTable.tsx:279-280` (Performance, Data shape). Lazy popover conversion.
9. **API-key format breaking change** — `03_validators.js:9` (Security, Backend data shape). Confirm issuer format.
10. **`validateApiKey` returns untrimmed** — `03_validators.js:48-54` (Backend data shape).
11. **`isBackendApiKeyToken` no trim / lint risk from removed `eslint-disable`** — `backendConfigurationValidation.ts:19-21`, `03_validators.js` (Security, Error-handling, Logging).
12. **Untested branches** — `backendConfiguration.zod.ts`, `assembleTaskPreviewData.ts`, `buildCellPreviewLookup.ts`, `spreadsheetToMarkdownTable.ts` (Test coverage).
13. **`artifact` British-English** — Established convention; do not fix in this PR.
