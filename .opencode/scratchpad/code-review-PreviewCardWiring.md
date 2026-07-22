# Pre-PR Code Review — `feat/PreviewCardWiring` vs `main`

**Focus:** KISS & DRY (simplicity, SOLID, duplication-vs-wrong-abstraction, speculative/over-abstraction).
**Constraint applied:** Lint/type-check/tests NOT run (per instructions). Findings based on `git diff main...HEAD` plus full reads of the changed files.
**Verdict:** **Needs Improvement** — no blocking functional bugs found, but several DRY / type-derivation deviations from `src/frontend/AGENTS.md` should be addressed before merge.

---

## DIFF FINDINGS

### Improvement

**1. `src/frontend/src/features/classPage/buildCellPreviewLookup.ts:9` — hand-written `ArtifactType` union duplicates the Zod schema discriminator (DRY / AGENTS §9 violation).**
The file redefines `type ArtifactType = 'TEXT' | 'TABLE' | 'IMAGE' | 'SPREADSHEET' | 'base';` (line 9) with a comment "matching the discriminator union in `BaseTaskArtifactSchema`". `src/frontend/AGENTS.md` §9 mandates deriving TypeScript types from the Zod schema via `z.infer<typeof ...>` to avoid duplicated type declarations. The single source of truth already exists at `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts:47-60`.
_Fix:_ `import { BaseTaskArtifactSchema } from '../../services/assignmentAssessment/assignmentAssessment.zod';` and write `type ArtifactType = z.infer<typeof BaseTaskArtifactSchema>['type'];`. This keeps the frontend type automatically in sync with the backend-shaped schema.

**2. `src/frontend/src/features/classPage/buildCellPreviewLookup.ts:19` — `CellPreviewData.artifactContent: unknown` discards schema-encoded per-type content typing (wrong abstraction / lost type safety).**
`createCellPreviewData` (lines 40-52) stores the raw `item.artifact.content` (typed `unknown` after flattening). The `BaseTaskArtifactSchema` discriminated union already encodes precise content types — `string | null` for TEXT/TABLE/IMAGE, `Array<Array<string|number|null>> | null` for SPREADSHEET, `unknown` for `base` (`assignmentAssessment.zod.ts:47-60`). By erasing to `unknown`, the downstream code is forced to re-derive the type by hand: `assembleTaskPreviewData.ts:99` casts `(cellData.artifactContent as Array<Array<string | number | null>> | null)` and `coerceArtifactType` (lines 62-82) re-implements the discriminator mapping. Net effect: the discrimination that Zod already provides is re-implemented manually.
_Fix:_ carry the typed content from the schema (e.g. `z.infer<typeof BaseTaskArtifactSchema>['content']`) so `coerceArtifactContent` no longer needs an unsafe `as` cast and the `SPREADSHEET`→markdown branch is type-checked rather than asserted.

**3. `src/frontend/src/features/classPage/TaskHeatmapTable.tsx:193-221` — `TaskPreviewSkeleton` duplicates the card layout magic numbers via a prose comment (fragile cross-file coupling).**
The skeleton hard-codes `width: 400` (line 198) and a comment (lines 186-189) states it cross-references `CARD_MAX_WIDTH = 400` and `CARD_BODY_MAX_HEIGHT = 480` from `TaskPreviewCard.tsx`, ending with "Those constants must NOT be refactored out of TaskPreviewCard.tsx." This is duplicated magic-number coupling held together only by a warning comment. `CARD_MAX_WIDTH` (TaskPreviewCard.tsx:66) and `CARD_BODY_MAX_HEIGHT` (TaskPreviewCard.tsx:58) are currently module-private `const`s.
_Fix:_ export `CARD_MAX_WIDTH` (and `CARD_BODY_MAX_HEIGHT`) from `TaskPreviewCard.tsx` and import them in `TaskHeatmapTable.tsx`, replacing the literal `400` on line 198. Removes the brittle comment and guarantees the popover skeleton stays shape-matched to the card.

**4. `src/frontend/src/features/classPage/TaskHeatmapPage.tsx:174-197` — the "log once" `useRef`+`useEffect` guard is now triplicated (DRY).**
The diff adds two new log-once guards (assignment-error: lines 174-180; assignment-not-found: lines 183-197) that are structurally identical to the pre-existing generic-error guard (lines 202-210): `const hasX = useRef(false); useEffect(() => { if (cond && !hasX.current) { hasX.current = true; logFn(...); } }, [deps]);`. Three copies of the same boilerplate differ only in predicate and log call.
_Fix:_ extract a tiny `useLogOnce(predicate: () => boolean, logFn: () => void): void` hook in the feature (or shared) hooks area and call it three times. Note the WET caveat — with only three usages this is borderline, but the repetition is mechanical and low-risk to unify.

### Minor Improvement

**5. `src/frontend/src/features/classPage/assembleTaskPreviewData.ts:62-109` — `coerceArtifactType` and `coerceArtifactContent` both switch on `cellData.artifactType`, splitting one mapping across two functions.**
The `artifactType → TaskPreviewData.artifactType` mapping (lines 62-82) and the `artifactType → content string` mapping (lines 96-109) each enumerate the same discriminator. Adding a new artifact type requires edits in both places (e.g. the `SPREADSHEET` → `TABLE`/markdown pair lives in two spots). Consolidating into a single `coerceArtifact(cellData): { artifactType, artifactContent }` would keep the type/content pairing cohesive. Low priority — WET could justify leaving the two single-responsibility helpers separate, so this is a judgement call rather than a defect.

---

## INCIDENTAL FINDINGS

**6. [Accepted — no action] Cross-runtime regex duplication.**
`src/backend/ConfigurationManager/03_validators.js:6` (`API_KEY_PATTERN = /^[A-Za-z0-9]+_[A-Za-z0-9_-]{32}$/u`) and `src/frontend/src/services/backendConfiguration/backendConfigurationValidation.ts:7` (`backendApiKeyTokenRegex`, identical literal) are the same pattern in two runtimes. Cross-runtime source sharing is not possible (GAS JS vs TS), and both files carry an explicit "keep both in sync" comment. This is an accepted, documented duplication, not a violation of the DRY rule (which targets same-module duplication). Flagged only for awareness; the new single-regex backend form (consolidating the old `backendApiKeyTokenCharacterRegex` + manual hyphen checks + `finalCharacterOffset` constant) is a KISS improvement.

**7. [Nitpick — test-only] `src/frontend/e2e-tests/helpers/task-heatmap-end-to-end-helpers.ts:286-?` — duplicated reasoning fixture string.**
`HEATMAP_REASONING['task_002.completeness']` and `HEATMAP_REASONING['task_002.accuracy']` both equal `'Student explained the method clearly and showed all working.'`. Acceptable for fixture data; only worth differentiating if the E2E assertions need to tell those two popovers apart. Test scaffolding only — not production code.

---

## Notes / Non-issues verified

- No `console.*` calls in the changed production files.
- No `TASK_PREVIEW_CARD_LAYOUT.md` or `taskPreviewFixtures`/`getTaskPreviewData` references remain anywhere in `src/frontend` (removal was complete; grep returned no matches).
- `getAssignmentQueryOptions` (`src/frontend/src/query/sharedQueries.ts:139`) is the canonical shared query-options helper — its use in `TaskHeatmapPage.tsx:163` follows AGENTS.md §3.2 (shared query-key factory) correctly.
- `spreadsheetToMarkdownTable` (`spreadsheetToMarkdownTable.ts:46`) has no pre-existing equivalent converter in the frontend — no DRY violation from a duplicated utility.
- Backend `03_validators.js` change is a KISS consolidation (single anchored regex replacing manual hyphen checks and the `finalCharacterOffset` constant); `validateApiKey` still trims before testing (line 48-51), consistent with the new frontend `.trim()` on `BackendApiKeyWriteSchema` (`backendConfiguration.zod.ts:12-17`).

## Files read

- `.opencode/agents/code-reviewer.md`
- `src/frontend/AGENTS.md`, `src/backend/AGENTS.md`
- `src/backend/ConfigurationManager/03_validators.js` (diff)
- `src/frontend/src/features/classPage/TaskHeatmapPage.tsx` (full + diff)
- `src/frontend/src/features/classPage/TaskHeatmapTable.tsx` (full + diff)
- `src/frontend/src/features/classPage/TaskPreviewCard.tsx` (full + diff)
- `src/frontend/src/features/classPage/assembleTaskPreviewData.ts` (full + diff)
- `src/frontend/src/features/classPage/buildCellPreviewLookup.ts` (full + diff)
- `src/frontend/src/features/classPage/spreadsheetToMarkdownTable.ts` (full + diff)
- `src/frontend/src/components/ImageRenderer/ImageRenderer.tsx` (diff)
- `src/frontend/src/services/backendConfiguration/backendConfigurationValidation.ts` (full + diff)
- `src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts` (full + diff)
- `src/frontend/src/services/backendConfiguration/backendConfigurationService.spec.ts` (diff)
- `src/frontend/e2e-tests/helpers/task-heatmap-end-to-end-helpers.ts` (diff)
- `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts` (artifact schema context)
- `src/frontend/src/query/sharedQueries.ts` (query-options context)
