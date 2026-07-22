# Code Review — Frontend (K3, K5, K6, K7 + follow-up cleanup)

**Reviewer:** Code Reviewer agent
**Module:** Frontend (`src/frontend/`)
**Date:** 2026-07-17
**Outcome:** ✅ PASS (clean) — no blocking (Critical/Improvement) issues. Minor non-blocking nitpicks noted below.

---

## Verification performed

| Check                                  | Command                                                                                                     | Result                                                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Lint (frontend)                        | `npm run lint:frontend` (`eslint src e2e-tests playwright.config.ts vite.config.ts eslint.config.js --fix`) | **0 errors, 1 warning** (`apiService.spec.ts:304` no-magic-numbers — pre-existing, out of scope)              |
| Type-check                             | `npm exec tsc -- -b src/frontend/tsconfig.json`                                                             | **EXIT 0** (clean)                                                                                            |
| Vitest (affected specs)                | `TaskPreviewCard.spec.tsx` + `MarkdownRenderer.spec.tsx`                                                    | **17/17 passed**                                                                                              |
| `detect-object-injection` directives   | grep across `src/frontend` (`*.{ts,tsx,js}`)                                                                | **ZERO active disable directives remain** (9 remaining matches are all comments or `eslint.config.js` itself) |
| `getReasoning` references              | grep across `src/frontend`                                                                                  | **None** (fully removed)                                                                                      |
| `MarkdownRenderer` `className` callers | grep + read `TaskPreviewCard.tsx:158`                                                                       | **No caller passed `className`**                                                                              |
| `HeatmapMetricKey` type                | `metricDisplayMeta.ts:18` → `'completeness'                                                                 | 'accuracy'                                                                                                    | 'spag'` | matches Zod `assessments` keys; `entry.assessments[metricKey]` type-checks ✓ |

---

## In-scope findings

### K3 — `src/frontend/src/AppThemeShell.tsx`

- ✅ Added comment `// Mid-tier transition duration (matches the design-token scale).` above `motionDurationMid: '0.1s',`.
- ✅ Accurate, British English, no behaviour change, value unchanged.

### K5 — `src/frontend/eslint.config.js` + `taskPreviewFixtures.ts`

- ✅ `'security/detect-object-injection': 'off'` added to the main `rules` block (line 57) → rule is **globally off** (confirmed via `--print-config`: `detect-object-injection -> [0]`).
- ✅ `getReasoning` switch helper fully removed; `getTaskPreviewData` now uses `entry.assessments[metricKey].reasoning` directly. No remaining reference.
- ✅ Type-checks: `HeatmapMetricKey` is the exact union over the Zod `assessments` keys.

### K6 — `src/frontend/src/components/MarkdownRenderer/MarkdownRenderer.tsx`

- ✅ `className` prop, its JSDoc `@param`, and the `classes` computation all removed.
- ✅ Wrapping `<div>` still uses `styles.markdown` directly.
- ✅ Sole caller (`TaskPreviewCard.tsx:158`) and the spec render `<MarkdownRenderer>{...}</MarkdownRenderer>` with no `className` → no breakage.

### K7 — `src/frontend/src/features/classPage/taskPreviewFixtures.ts`

- ✅ Zod schemas added: `FixtureArtifactSchema` (enum `IMAGE`/`TEXT`/`TABLE`, `content: string`), `FixtureAssessmentSchema` (`reasoning: string`), `FixtureEntrySchema` (artifact + completeness/accuracy/spag assessments), `FixtureDataSchema` (`z.record(z.string(), FixtureEntrySchema)`).
- ✅ `as FixtureData` casts replaced with `FixtureDataSchema.parse(...)` at module load (fail-fast on malformed fixtures).
- ✅ Redundant `FixtureEntry`/`FixtureData` TS interfaces removed; `getFixtureEntry` return type uses `z.infer<typeof FixtureEntrySchema>`.
- ✅ tsc clean; `TaskPreviewCard.spec.tsx` (11 tests) passes, confirming runtime correctness of the `.parse` + direct `reasoning` access.

### Follow-up cleanup — redundant inline `eslint-disable` directives

- ✅ All 7 listed inline directives removed (plus `e2e-tests/shared/endToEndRuntimeMocks.ts`, making 8 total in the working tree).
- ✅ Code lines they guarded are unchanged; grep confirms zero active directives remain anywhere under `src/frontend`.
- ✅ Per-file overrides for `TaskHeatmapTable.tsx` / `studentAveragesTableColumns.tsx` left in place (intentional, harmless redundancy).
- ✅ Lint clean (only pre-existing warning), no new type errors, affected tests pass.

### British English / general

- ✅ Comment text and identifiers are British English.
- ✅ No `console.*`, no empty `catch`, no speculative scope, no undocumented defaults.
- ✅ Frontend `App.tsx` composition boundary untouched; no `src/backend` imports introduced.

---

## Nitpicks (non-blocking — optional tidy-up)

1. **`src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts:494`** — When the `// eslint-disable-next-line security/detect-object-injection` line was removed, it was replaced with a whitespace-only line (5 spaces) rather than being deleted. This has **no lint/test/type impact** (the `no-trailing-spaces` rule is not enabled in this project's ESLint config — verified `no-trailing-spaces -> None`), but it is a leftover artifact that should be removed for source cleanliness.

2. **`src/frontend/eslint.config.js:57`** — The new global `'security/detect-object-injection': 'off'` entry has no explanatory comment, unlike the per-file overrides below it (lines 236–262) and other rules in the file. A one-line rationale (e.g. "user-authorised: rule forces spaghetti workarounds for compile-time-safe lookups") would aid future maintainers. The change is user-authorised, so this is optional.

3. **`src/frontend/eslint.config.js:204, 246, 260`** — Now-redundant per-file `'off'` overrides (spec block, `TaskHeatmapTable.tsx`, `studentAveragesTableColumns.tsx`) could be pruned since the rule is globally disabled, but they are harmless and were intentionally left per the change description. Optional cleanup only.

---

## Conclusion

All in-scope review criteria (K3, K5, K6, K7, follow-up cleanup) are satisfied. Lint is clean (no new errors), types compile, the directive grep is zero, and affected tests pass. No Critical or Improvement findings. The three nitpicks above are cosmetic/optional and do not block a clean pass.

---

## Out-of-scope note — pre-existing `e2e-tests` LSP errors

While reviewing, the editor's TS language server reported errors in `src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts` (readonly-property assignments at lines 162–361 and a readonly `ResponseItem[]` assignment at line 495). **These are pre-existing and NOT introduced by this PR** — the only change to that file in this review was deleting a `// eslint-disable-next-line` comment line (line 494). `eslint-disable` comments have no effect on TypeScript, and none of the flagged lines were modified.

Additionally, `tsconfig.json` (the `tsc -b` build root) references only `tsconfig.app.json` and `tsconfig.node.json`; it does **not** include `tsconfig.e2e.json`. Therefore `e2e-tests` is excluded from the project's canonical type-check (`tsc -b` passes cleanly, as reported above). The LSP errors are surfaced only because the editor server resolves `e2e-tests` files against `tsconfig.e2e.json` (which has a separate, pre-existing `rootDir` misconfiguration). They do not affect the build or this review's outcome and should be tracked separately if desired.

---

> Remember, you must address **all** in-scope review items and then resubmit to the reviewer until the review comes back clean.
