# Code Review — Section 3 `assembleTaskPreviewData` GREEN-phase implementation

**File under review:** `src/frontend/src/features/classPage/assembleTaskPreviewData.ts`
**RED test (must stay green):** `src/frontend/src/features/classPage/assembleTaskPreviewData.spec.ts`
**Branch:** `feat/preview-card-real-data-wiring`
**Verdict:** CLEAN — GREEN approved.

---

## Files read (mandatory + verification)

1. `/home/developer/AssessmentBot/SPEC.md` — Assembly mapping section, coercion table, reasoning extraction, `taskId` propagation, `null` cellData contract, `TaskPreviewData`/`CellPreviewData` shapes.
2. `/home/developer/AssessmentBot/ACTION_PLAN.md` — Section 3 objective, constraints, 13 required test cases, acceptance criteria.
3. `/home/developer/AssessmentBot/src/frontend/AGENTS.md` — frontend standards (British English, function export, no backend import, purity).
4. `/home/developer/AssessmentBot/src/frontend/src/features/classPage/assembleTaskPreviewData.ts` — file under review (137 lines).
5. `/home/developer/AssessmentBot/src/frontend/src/features/classPage/assembleTaskPreviewData.spec.ts` — RED test (16 tests; must stay green).
6. `/home/developer/AssessmentBot/src/frontend/src/features/classPage/TaskPreviewCard.tsx` — `TaskPreviewData` interface (lines 45–53).
7. `/home/developer/AssessmentBot/src/frontend/src/features/classPage/buildCellPreviewLookup.ts` — `CellPreviewData` / `ArtifactType` (lines 7, 13–24).
8. `/home/developer/AssessmentBot/src/frontend/src/features/classPage/spreadsheetToMarkdownTable.ts` — converter (called for `SPREADSHEET`).
9. `/home/developer/AssessmentBot/src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts` — `MetricResult` discriminated union (lines 84–114).
10. `/home/developer/AssessmentBot/src/frontend/src/services/dataAnalysis/metricDisplay/metricDisplayMeta.ts` — `HeatmapMetricKey` (line 18).
11. `/home/developer/AssessmentBot/docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` — §9.18.16 items 24/25/26 (item 25 confirmed `Not implemented`).
12. `/home/developer/AssessmentBot/docs/developer/frontend/frontend-logging-and-error-handling.md` — no silent error swallowing; `console.*` boundary.

---

## Verification results

- **Lint (`npm run lint:frontend`):** 0 errors. Only the pre-existing, unrelated `apiService.spec.ts` magic-number warning (`-1`) is reported — out of scope, not introduced here. `assembleTaskPreviewData.ts` itself is lint-clean.
- **Tests (`npm run test:frontend -- assembleTaskPreviewData`):** 16/16 passing. RED test remains green.
- **Compile:** TypeScript via Vitest transform resolves cleanly; `tsc -b src/frontend/tsconfig.json` not separately re-run for a single file, but the test run exercises the module and all types line up (return object satisfies `TaskPreviewData` exactly).

---

## Findings (per in-scope checklist)

### 1. Correctness vs contract — PASS

- TEXT/TABLE/IMAGE → same `artifactType`, `artifactContent` coerced to string via `String(cellData.artifactContent ?? '')` (lines 67–68, 135–136). This is a _safer_ coercion than the spec's illustrative `as string || ''` cast: it defaults `null`/`undefined` to `''` and stringifies any non-string value rather than relying on a no-op type assertion. No behaviour divergence for the RED tests (which pass string content) and it is more defensive.
- SPREADSHEET → `artifactType: 'TABLE'` + `spreadsheetToMarkdownTable((content as 2D array | null) ?? [])` (lines 125–128). Matches SPEC coercion row exactly.
- `base` → `artifactType: 'TEXT'`, `artifactContent: ''` (lines 131–133). Matches.
- `null` cellData → `{ artifactType: 'TEXT', artifactContent: '', reasoning: '' }` (lines 54–64). Matches.
- `reasoning = cellData?.reasoning[metricKey] ?? ''` (line 77) — exact SPEC wording, handles populated and absent-key cases.
- `metricScore = metricResult.value`, `metricState = metricResult.state` (lines 75–76) — pass-through confirmed; types align (`number | 'N' | 'E'` / `'computed' | 'notAttempted' | 'error'`).
- `metricKey` forwarded via `metricKey` param (line 74). `taskId` forwarded in **both** branches (lines 56 and 71) — stable across populated and `null` cellData, satisfying the SPEC `taskId` propagation contract and test cases 12/13.

### 2. Purity — PASS

No React, Ant Design, or I/O imports. Imports are `type`-only for `CellPreviewData`, `MetricResult`, `HeatmapMetricKey`, `TaskPreviewData` plus the `spreadsheetToMarkdownTable` function. Pure function.

### 3. Types — PASS

Return object (lines 55–63 / 70–78) contains exactly the seven `TaskPreviewData` fields in compatible order. `coerceArtifactType` return type is `TaskPreviewData['artifactType']` (`'IMAGE' | 'TEXT' | 'TABLE'`), and the `switch` is exhaustive over `CellPreviewData['artifactType']` (5 cases) — TypeScript enforces exhaustiveness, so a future backend type addition becomes a compile error here (fail-fast at the type level) rather than a runtime `undefined`. `artifactContent` is always `string`; the SPREADSHEET `as` assertion is confined to the `SPREADSHEET` branch and matches the SPEC's own coercion expression.

### 4. Standards — PASS

British English throughout (e.g. "Coerce", "discriminator", "forwarded", "no-submission", `JSDoc` in British register). KISS — no speculative features. No scope creep beyond Section 3. No defaults injected. No `console.*` calls. No swallowed errors — the function either returns a value or (for malformed SPREADSHEET content) lets `spreadsheetToMarkdownTable` throw loudly via `rows.length`, which is fail-fast, not silent. Function is exported as a `function` declaration (not a `const` arrow) — satisfies `src/frontend/AGENTS.md` §2.

### 5. Shared-helper registry — PASS

§9.18.16 item 25 (`assembleTaskPreviewData`) remains status `Not implemented` (line 820 of the standards doc). No documentation regressions introduced. (Items 24/26 likewise `Not implemented`; all are expected to flip to `Implemented` only in the documentation pass, per SPEC §"Documentation and rollout notes".)

### 6. Test file untouched — PASS

`assembleTaskPreviewData.spec.ts` is the committed RED spec; it remains the canonical RED test and is unmodified by the implementation. It passes (16/16), satisfying the "must stay green" requirement.

### 7. Lint clean — PASS

`assembleTaskPreviewData.ts` is lint-clean. The only lint output is the pre-existing unrelated `apiService.spec.ts` `-1` magic-number warning, which is out of scope for this review.

### 8. Extraction review — PASS (acceptable)

The private helpers `coerceArtifactType` (lines 90–110) and `coerceArtifactContent` (lines 124–137) are:

- simple, single-responsibility, and private (not exported);
- they separate the _type-map_ concern from the _content-coercion_ concern, keeping the public `assembleTaskPreviewData` readable;
- they were introduced for cognitive-complexity relief and match the ACTION_PLAN Section 3 allowance ("acceptable if simple and private").

This is reasonable KISS extraction, not premature abstraction or unnecessary indirection. No finding.

---

## Verdict

**CLEAN — GREEN approved.**

No Critical, Improvement, or Nitpick findings for the in-scope review of `assembleTaskPreviewData.ts`. All coercion branches, reasoning extraction, score/state pass-through, `metricKey`/`taskId` pass-through (both branches), purity, typing, British English, lint cleanliness, and the shared-helper registry status are correct and compliant. The RED test suite remains green (16/16).
