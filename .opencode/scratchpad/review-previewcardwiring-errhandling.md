# Pre-PR Code Review — `feat/PreviewCardWiring` (error-handling robustness focus)

**Reviewer:** Code Reviewer agent
**Base:** `main` … `HEAD`
**Scope:** Diff findings + incidental issues in surrounding context
**Mandate:** Do NOT run lint/tests. Focus on error-handling robustness (broad catch / swallowed
errors, missing rethrow at boundaries, missing `Validate.requireParams` on public backend
methods, silent fallbacks). Every claim cites file:line.

**Verdict: NEEDS IMPROVEMENT** — No must-fix Critical defect, but several silent-fallback
robustness gaps in the new `assembleTaskPreviewData` / `buildCellPreviewLookup` path should be
tightened (fail-fast) before merge.

---

## DIFF FINDINGS

### Improvement — DIFF FINDING

**`src/frontend/src/features/classPage/assembleTaskPreviewData.ts:67-77` (`coerceArtifactType`)**
The `switch` over `type` covers the five closed-union members (`TEXT`, `TABLE`, `IMAGE`,
`SPREADSHEET`, `base`) but has **no `default` branch**. At runtime, if the backend ever emits an
artifact-type discriminator outside that union (e.g. a new type not yet in the `ArtifactType`
union, or a malformed payload), the function implicitly returns `undefined`. That `undefined`
flows into `artifactType` (`assembleTaskPreviewData.ts:44`), producing a `TaskPreviewData` whose
`artifactType` is `undefined` — violating the `TaskPreviewData` contract
(`TaskPreviewCard.tsx:40` = `'IMAGE' | 'TEXT' | 'TABLE'`). Downstream, `renderArtifact` in
`TaskPreviewCard.tsx:145-154` switches on `artifactType` with no `default`, so an `undefined`
value renders **nothing** for the student response — a silent failure that hides a data
contract breach.
**Fix:** Add an explicit `default` that fails loudly, e.g.
`default: { throw new Error(\`Unhandled artifact type: ${type}\`); }`, or at minimum log and fall
back to `'TEXT'` with a developer warning. Aligns with the fail-fast prime directive
("No silent error swallowing").

### Improvement — DIFF FINDING

**`src/frontend/src/features/classPage/assembleTaskPreviewData.ts:80-91` (`coerceArtifactContent`)**
Two silent fallbacks that mask data problems:

1. Generic branch (line 90): `return String(cellData.artifactContent ?? '');` coerces _any_
   non-string content to a string. For an `IMAGE` artifact whose `artifactContent` is `null`/
   `undefined`, this yields `''`, which becomes `ImageRenderer src=""` — a silently broken image
   (`TaskPreviewCard.tsx:147`). For an object payload it yields `'[object Object]'`.
2. `SPREADSHEET` branch (lines 81-85): `cellData.artifactContent` is cast `as
Array<Array<string | number | null>> | null` and `?? []` before being handed to
   `spreadsheetToMarkdownTable`. If the backend returns a non-array (e.g. a string or object),
   the cast lies and `spreadsheetToMarkdownTable` (`spreadsheetToMarkdownTable.ts:46-57`) will
   iterate over the wrong shape, emitting malformed markdown with no error.
   **Fix:** Validate the content shape per `artifactType` before use. For `IMAGE`, throw/log when
   content is missing/non-string; for `SPREADSHEET`, verify `Array.isArray(...)` and throw/log
   otherwise rather than casting and passing a possibly-invalid value.

### Improvement — DIFF FINDING

**`src/frontend/src/features/classPage/buildCellPreviewLookup.ts:64-76` (`buildCellPreviewLookup`)**
The function walks `assignment.submissions`, then `Object.values(submission.items)`, and
dereferences `item.artifact.type`, `item.artifact.content`, and `item.assessments`
(line 70) with no shape guard. A malformed submission (missing `items`, or an `item` without an
`artifact`) would throw an opaque `TypeError` deep inside the loop. The caller in
`TaskHeatmapPage.tsx:165-168` invokes this inside a `useMemo` with **no `try/catch`**, so such an
error propagates uncaught during render. This is mitigated because `AssignmentFull` is Zod
validated (`assignmentAssessment.zod.ts:167` guarantees `submissions: z.array(...)`), but the
function itself provides no defensive, self-describing failure.
**Fix:** Either rely explicitly on the Zod guarantee with a comment, or add a narrow guard that
throws a descriptive error (e.g. "Submission for student X is missing items") so a future
schema/transport drift fails loudly instead of as a cryptic `TypeError`.

### Improvement — DIFF FINDING

**`src/backend/ConfigurationManager/03_validators.js:48-55` (`validateApiKey`)**
This is an exported (public) backend method, yet it guards the parameter with
`Validate.isNonEmptyString(value)` rather than the mandated `Validate.requireParams({ value },
'validateApiKey')` contract for public backend methods (backend AGENTS.md §3 / code-reviewer
checklist "Backend Only"). It does still fail fast (throws on empty), so behaviour is acceptable,
but it is inconsistent with the project validation contract and the PR focus on
`Validate.requireParams` on public methods.
**Fix:** Add `Validate.requireParams({ value }, 'validateApiKey')` at the top for explicit
presence/type enforcement, then keep the pattern check.

### Nitpick — DIFF FINDING

**`src/frontend/src/services/backendConfiguration/backendConfigurationValidation.ts:9` and
`src/backend/ConfigurationManager/03_validators.js:9`**
The API-key contract regex is duplicated across the two runtimes
(`/^[A-Za-z0-9]+_[A-Za-z0-9_-]{32}$/u`). They are presently identical (good — validation will not
drift today), and the duplicated comment explicitly says "keep both in sync". Cross-module DRY
forbids sharing the constant, so the duplication is acceptable, but there is no automated guard
preventing future drift.
**Fix (optional):** Add a parity test (frontend or backend) that asserts both patterns accept and
reject the same sample keys, so drift is caught in CI.

### Nitpick — DIFF FINDING

**`src/frontend/src/features/classPage/spreadsheetToMarkdownTable.ts:17-22` (`formatCell`)**
`formatCell` special-cases `null` but not `undefined`. A ragged row (missing cell) yields the
literal string `'undefined'` in the generated markdown (line 21: `String(cell).replaceAll(...)`),
silently corrupting output rather than signalling a problem.
**Fix:** Treat `cell == null` (or `cell === null || cell === undefined`) as empty.

---

## INCIDENTAL FINDINGS (surrounding context)

### Improvement — INCIDENTAL

**`src/frontend/src/features/classPage/TaskPreviewCard.tsx:189`**
`const meta = METRIC_DISPLAY_META.get(metricKey)!;` uses a non-null assertion. If a `metricKey`
is ever absent from the map, `meta` is `undefined` and `meta.label` (line 190) throws an opaque
`TypeError` during render. This is pre-existing (not part of this diff) but is in-scope
surrounding context for the preview-card wiring.
**Fix:** Guard with a descriptive error or a safe fallback label instead of `!`.

### Nitpick — INCIDENTAL

**`src/frontend/src/features/classPage/TaskHeatmapTable.tsx:193-221` (`TaskPreviewSkeleton`)**
The skeleton hard-codes `width: 400` and a `height: 120` image placeholder, with a comment
cross-referencing `TaskPreviewCard`'s private `CARD_MAX_WIDTH = 400` / `CARD_BODY_MAX_HEIGHT =
480`. If those `TaskPreviewCard` constants change, the skeleton silently drifts out of shape.
Pre-existing coupling, noted for robustness awareness.
**Fix (optional):** Export the shared dimension tokens or derive the skeleton width from the same
source.

### Nitpick — INCIDENTAL

**`src/frontend/src/features/classPage/TaskHeatmapPage.tsx:103-110` (`computeHeatmapState`)**
The `try/catch` returns the error into `HeatmapPageState.error`, which is correctly surfaced by
the component (Alert for `TaskTitlesUnavailableError`, log + `onBack` for generic errors,
lines 156-157, 175-180). This is _not_ a swallowed error — it is handled. Recorded only to
confirm the surrounding error path is sound and that the new assignment-query error logging
guards (lines 173-180, 182+) match this pattern (log-once via `useRef`, then surface). No change
required.

---

## Things checked and found clean

- No `console.*` calls in any changed source file (grep returned none in the focus files).
- No empty `catch` blocks introduced in the diff.
- New functions are exported as `function` declarations (not const-arrow), satisfying the
  frontend export convention (`assembleTaskPreviewData.ts:19`, `buildCellPreviewLookup.ts:64`,
  `spreadsheetToMarkdownTable.ts:46`).
- `TaskHeatmapPage` fails closed on assignment-query failure: `showAssignmentError`
  (`TaskHeatmapPage.tsx:170`) drives an `Alert` in every popover (`TaskHeatmapTable.tsx:283-285`)
  rather than silently rendering a card.
- Frontend/backend API-key regexes are currently in sync.

## Files read

- `.opencode/agents/code-reviewer.md`, `src/backend/AGENTS.md`, `src/frontend/AGENTS.md`
- `src/backend/ConfigurationManager/03_validators.js`
- `src/frontend/src/features/classPage/assembleTaskPreviewData.ts`
- `src/frontend/src/features/classPage/buildCellPreviewLookup.ts`
- `src/frontend/src/features/classPage/TaskHeatmapTable.tsx`
- `src/frontend/src/features/classPage/TaskHeatmapPage.tsx`
- `src/frontend/src/features/classPage/TaskPreviewCard.tsx`
- `src/frontend/src/features/classPage/spreadsheetToMarkdownTable.ts`
- `src/frontend/src/services/backendConfiguration/backendConfigurationService.spec.ts`
- `src/frontend/src/services/backendConfiguration/backendConfigurationValidation.ts`
- `src/frontend/src/query/sharedQueries.ts` (getAssignmentQueryOptions), `assignmentAssessment.zod.ts` (AssignmentFull)
