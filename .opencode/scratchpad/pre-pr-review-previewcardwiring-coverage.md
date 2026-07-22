# Pre-PR Code Review — `feat/PreviewCardWiring` (test-coverage focus)

**Scope/method:** Reviewed the diff `main...HEAD` against the changed source files listed in the
brief, plus `docs/developer/backend/backend-testing.md` and
`docs/developer/frontend/frontend-testing.md`. Per the task constraints I did **not** run lint,
type-check, or tests; this is a coverage-gap review only. Every finding cites `file:line`
evidence. Items are tagged **DIFF FINDING** (changed logic on this branch) or **INCIDENTAL**
(pre-existing / surrounding context).

## Summary

**Verdict: NEEDS IMPROVEMENT.** The new PreviewCard wiring in `TaskHeatmapTable.tsx` (loading /
error / populated / empty popover states) is well covered by Vitest, and the backend/frontend
API-key contract change is tested. However, the diff introduces **untested behaviour** in
`backendConfiguration.zod.ts` (the new `.trim()` on the write-key schema has no direct test and
no `backendConfiguration.zod.spec.ts` exists), and several branch edges in the new pure functions
(`assembleTaskPreviewData`, `buildCellPreviewLookup`, `spreadsheetToMarkdownTable`) are not
exercised. None are Critical (no broken behaviour or security issue observed), but they should be
closed before merge to satisfy the 85% coverage threshold and the schema-contract testing
convention.

---

## DIFF FINDINGS

### Improvement — `backendConfiguration.zod.ts:12-17`

- **Untested path:** `BackendApiKeyWriteSchema` now calls `.trim()` _before_ the
  `isBackendApiKeyToken` refine (diff hunk). A key value with surrounding whitespace
  (`' abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-1 '`) is therefore now accepted, whereas before the
  trim it would have failed the regex. There is **no `backendConfiguration.zod.spec.ts`** (the
  mandatory-reading path does not exist in the tree), and `backendConfigurationService.spec.ts`
  only asserts unmasked/malformed/malformed-url read payloads and masked-key rejections — it never
  parses a whitespace-surrounded write key. The behaviour change is therefore unverified.
- **Suggested test:** Add `src/frontend/src/services/backendConfiguration/backendConfiguration.zod.spec.ts`
  asserting `BackendApiKeyWriteSchema.safeParse(' abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-1 ').success`
  is `true` (trim makes it valid) and that a key with an internal-only leading space but otherwise
  valid still passes; also assert a schema-level rejection for a key that remains invalid after
  trimming.

### Improvement — `assembleTaskPreviewData.ts:97-101`

- **Untested path:** SPREADSHEET branch of `coerceArtifactContent`: when
  `cellData.artifactContent` is `null`/`undefined` the `?? []` fallback produces an empty markdown
  table. No spec case (`assembleTaskPreviewData.spec.ts`) supplies a SPREADSHEET cell with null
  content — the SPREADSHEET test (lines 158-176) always passes a real 2D array.
- **Suggested test:** `assembleTaskPreviewData(cellData('SPREADSHEET', null), …, 'completeness', 't')`
  → `artifactType === 'TABLE'` and `artifactContent === ''`.

### Improvement — `assembleTaskPreviewData.ts:107-108`

- **Untested path:** The TEXT/TABLE/IMAGE default branch `String(cellData.artifactContent ?? '')`
  when `artifactContent` is `null` yields `''`. No spec supplies a TEXT/TABLE/IMAGE cell with
  `null` content.
- **Suggested test:** `assembleTaskPreviewData(cellData('TEXT', null), …, 'accuracy', 't')` →
  `artifactContent === ''` (mirrors the `base` and `null cellData` contracts).

### Improvement — `buildCellPreviewLookup.ts:64-78`

- **Untested path:** `outerMap.set(submission.studentId, innerMap)` runs once per submission, so if
  the **same `studentId` appears in more than one submission** the second `set` _overwrites_ the
  first submission's items entirely — only the final submission for that student survives. No spec
  case exercises duplicate student submissions (Test 3 uses two _different_ students). This is a
  latent data-loss edge that the new code does not guard or assert.
- **Suggested test:** Two submissions for the same `studentId` with disjoint `taskId`s; assert only
  the last submission's `taskId`s resolve, and document whether that overwrite is intended (if
  not, aggregate per-task with first-wins like the intra-submission `innerMap` logic).

### Improvement — `spreadsheetToMarkdownTable.ts:46-57`

- **Untested path:** `columnCount` is taken from `rows[0].length` (line 51). The cases of (a) an
  empty header row `[]` and (b) jagged rows where a data row has a different column count than the
  header are never exercised. The empty-_array_ case (`rows.length === 0`) is tested, but the
  zero-column-header and ragged-array shapes are not.
- **Suggested test:** `spreadsheetToMarkdownTable([[]])` (assert shape: `|  |  |  |`) and
  `spreadsheetToMarkdownTable([['A','B'],[1]])` (assert separator keeps 2 columns while the data
  row renders with one cell), confirming the column-count derivation is deterministic.

---

## INCIDENTAL FINDINGS

### Improvement — `backendConfigurationValidation.ts:43-45`

- **Untested path:** `isDriveFolderId` is exported but not imported by
  `backendConfigurationValidation.spec.ts` (which covers only `isBackendApiKeyToken`,
  `backendApiKeyValidationMessage`, `isMaskedBackendApiKeyValue`). Present on `main` (unchanged by
  this diff) — the new spec was an opportunity to cover it.
- **Suggested test:** `isDriveFolderId('folder12345')` → `true`; `isDriveFolderId('short')` →
  `false`; `isDriveFolderId('bad id!')` → `false`.

### Improvement — `TaskHeatmapTable.tsx:277-315`

- **Untested path:** The popover `render` is exercised only with a **TEXT** `CellPreviewData`
  (`POPULATED_LOOKUP` in `TaskHeatmapTable.spec.tsx`). The IMAGE / TABLE / SPREADSHEET branches of
  `assembleTaskPreviewData` are never rendered through the heatmap popover, so the end-to-end
  preview for those artifact kinds (image via `ImageRenderer`, markdown/table via `TaskPreviewCard`)
  is unverified at the table level.
- **Suggested test:** Provide a `CellPreviewLookup` entry with `artifactType: 'IMAGE'` (and one
  `'TABLE'`/`'SPREADSHEET'`) for a rendered cell, hover, and assert the popover shows the image /
  markdown content. (Note: `src/frontend/e2e-tests/task-preview-card.spec.ts` was touched this
  branch and likely covers the card-level interaction in Playwright — confirm it covers non-TEXT
  artifacts so the user-visible-interaction rule is met.)

### Improvement — `TaskHeatmapTable.tsx:137-154`

- **Untested path:** `heatmapMetricComparator` (wired into each metric sub-column `sorter` via
  `buildMetricSorter`) is not exercised by any test — only the Student Name sorter is clicked
  (spec test 3). The computed→notAttempted→error ordering, value tie-break, and `studentId`
  tie-break are unverified.
- **Suggested test:** Render, click a metric sub-column sorter, and assert row order follows the
  documented comparator (computed ascending, then notAttempted, then error, with `studentId`
  tie-break).

### Nitpick — `backendConfigurationValidation.ts:29-35`

- **Untested path:** `isMaskedBackendApiKeyValue` wrong-length branch
  (`value.startsWith(prefix) && value.length === maskedApiKeyWithSuffixLength`) is not directly
  tested (no masked value with an incorrect length such as `'****ab'`).
- **Suggested test:** `isMaskedBackendApiKeyValue('****ab')` → `false`.

### Improvement — `tests/configurationManager/configurationManager.test.js:728-729`

- **Untested path (backend):** The new API-key contract (prefix + `_` + exactly 32 base64url) is
  covered for a valid key and for `invalid-key-` (rejected). There is no explicit regression test
  that a _legacy hyphen-separated_ key of the old shape (valid length, no underscore, e.g.
  `abc-defg…`) is now rejected by `validateApiKey`/`isValidApiKey`. Minor, but worth locking in
  given the contract was deliberately synchronised with the frontend.
- **Suggested test:** `expect(configManager.isValidApiKey('abc-defg...32chars...')).toBe(false)`
  (no underscore) and a test asserting the new error message text.

---

## Files read (evidence base)

- Docs: `docs/developer/backend/backend-testing.md`, `docs/developer/frontend/frontend-testing.md`,
  `.opencode/agents/code-reviewer.md`, `src/frontend/AGENTS.md`, `src/backend/AGENTS.md`
- Source: `assembleTaskPreviewData.ts` (+`.spec.ts`), `buildCellPreviewLookup.ts` (+`.spec.ts`),
  `spreadsheetToMarkdownTable.ts` (+`.spec.ts`), `TaskHeatmapTable.tsx` (+`.spec.tsx`),
  `ImageRenderer.tsx` (+`.spec.tsx`), `backendConfigurationValidation.ts` (+`.spec.ts`),
  `backendConfiguration.zod.ts`, `03_validators.js`
- Diffs: `git diff main...HEAD` for the eight files above; glob confirmed
  `backendConfiguration.zod.spec.ts` does **not** exist.
