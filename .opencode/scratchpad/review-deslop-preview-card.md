# Code Review — De-Sloppification Fix (feat-preview-card-real-data-wiring)

**Reviewer:** Code Reviewer (frontend)
**Scope:** 3 de-sloppification fixes on branch `feat/preview-card-real-data-wiring`

## Files read (mandatory + in-scope)

1. `/home/developer/AssessmentBot/AGENTS.md`
2. `/home/developer/AssessmentBot/src/frontend/AGENTS.md`
3. `/home/developer/AssessmentBot/SPEC.md` (lines 256–315 — CellPreviewData contract)
4. `/home/developer/AssessmentBot/src/frontend/src/features/classPage/assembleTaskPreviewData.ts` (current + diff)
5. `/home/developer/AssessmentBot/src/frontend/src/components/ImageRenderer/ImageRenderer.tsx` (current + diff)
6. `/home/developer/AssessmentBot/src/frontend/src/features/classPage/buildCellPreviewLookup.ts` (current + diff)
7. `/home/developer/AssessmentBot/src/frontend/src/services/dataAnalysis/metricDisplay/metricDisplayMeta.ts` (`HEATMAP_METRIC_KEYS`, `HeatmapMetricKey` definitions)
8. Grep of `.reasoning` usages across `src/frontend/src` (14 matches — 2 production, 12 spec assertions)

## Automated checks

- `npm run lint:frontend` → **0 errors**, 1 warning. Only warning is the pre-existing
  `src/frontend/src/services/apiService.spec.ts:304` `@typescript-eslint/no-magic-numbers` (-1),
  which is baseline debt explicitly excluded from this review. No new lint issues introduced.
- `npm exec tsc -- -b src/frontend/tsconfig.json` → **exit 0** (type-check clean).

## Findings per fix

### Fix 1 — `assembleTaskPreviewData.ts`: removed unattached file-level JSDoc

- **Confirmed:** The removed block (old lines 1–31) was a file-level JSDoc placed _before_ the
  `import` statements with no associated declaration — an unattached doc-comment (documentation
  anti-pattern). It was effectively duplicative of the function-level JSDoc.
- **Function-level JSDoc preserved:** The retained `@param`/`@returns` JSDoc for
  `assembleTaskPreviewData` is intact (current file lines 7–18). The two private helpers
  `coerceArtifactType` / `coerceArtifactContent` retain their own JSDoc.
- **No logic changed.** Pure documentation removal. ✅ Compliant.

### Fix 2 — `ImageRenderer.tsx`: reworded broken JSDoc sentence

- **Confirmed:** The new text — _"The `maxHeight: 400` constraint prevents the image from making
  the popover card overflow the viewport."_ — is grammatically correct and references **no**
  non-existent layout document (the old text referenced "the layout specification which" with a
  dangling clause). British English preserved.
- The runtime `style={{ maxWidth: '100%', height: 'auto', maxHeight: 400 }}` (line 45) is
  unchanged and consistent with the comment. ✅ Compliant.

### Fix 3 — `buildCellPreviewLookup.ts`: `reasoning` typed as `Record<HeatmapMetricKey, string | null>`

- **SPEC alignment:** SPEC.md line 272 defines `readonly reasoning: Record<HeatmapMetricKey, string | null>`.
  The new type exactly matches. ✅
- **Imports:** `HEATMAP_METRIC_KEYS` (value) and `HeatmapMetricKey` (type) are both imported from
  `metricDisplayMeta` (current lines 2–3). ✅
- **Iteration:** `createCellPreviewData` now builds `reasoning` via
  `Object.fromEntries(HEATMAP_METRIC_KEYS.map((key) => [key, assessments[key]?.reasoning ?? null]))`
  cast to `Record<HeatmapMetricKey, string | null>`. The constant `HEATMAP_METRIC_KEYS`
  (`metricDisplayMeta.ts` lines 39–43) is `readonly HeatmapMetricKey[] = ['completeness','accuracy','spag']`,
  so iteration covers exactly the three SPEC metric keys with the SPEC-mandated
  `item.assessments[key]?.reasoning ?? null` derivation. ✅
- **Shape correctness:** For each key the value is `assessments[key]?.reasoning ?? null`, i.e.
  `string | null`. Produces the exact `Record<HeatmapMetricKey, string | null>` shape the consumer expects.
- **Downstream consumer intact:** `assembleTaskPreviewData.ts` line 49 reads
  `cellData.reasoning[metricKey] ?? ''`. Since `metricKey` is typed `HeatmapMetricKey`, indexing the
  `Record` yields `string | null`, and `?? ''` narrows to `string`. Still valid. ✅
- **Existing spec tests still compile/valid:** `buildCellPreviewLookup.spec.ts` accesses
  `cellData!.reasoning.completeness | .accuracy | .spag` (dot notation) — valid against the
  `Record<HeatmapMetricKey, string | null>` shape (equivalent to the named-property type). Confirmed by
  `tsc` exit 0. `assembleTaskPreviewData.spec.ts` assertions on `result.reasoning` (a `string`) are
  unchanged and unaffected. ✅
- **No new lint/typescript issues.** ✅

## Scope note (important)

The de-sloppification fix itself is confined exactly to the **3 named files**, and the diff for each
matches the described intent with no extra logic changes.

The working tree _also_ contains unrelated modifications that are **out of scope** for this review
and were not introduced by the slop fix:

- `ACTION_PLAN.md` (modified)
- 4 PNG snapshot files under `src/frontend/e2e-tests/task-preview-card.spec.ts-snapshots/`
  (`completeness-pinned.png`, `image-completeness-hover.png`, `table-spag-hover.png`,
  `text-accuracy-hover.png`)

These are pre-existing branch/test-artefact changes and are not part of the three slop fixes. They
should not be assumed correct by this review; they require separate review if they are meant to
be committed. The reviewer flags them only so the calling agent is aware the working tree is not
limited to the 3 reviewed files.

## Verdict

**CLEAN** — All three in-scope fixes are correct, SPEC-compliant, and introduce no lint or
type-check regressions. The only outstanding lint warning is the pre-existing baseline
`apiService.spec.ts` magic-number warning, intentionally excluded.

## Reminder to calling agent

> Remember, you must address **all** in-scope review items and then resubmit to the reviewer until the review comes back clean.
