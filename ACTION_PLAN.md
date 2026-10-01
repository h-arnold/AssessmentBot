# Issue #19 — Task Preview Source Link Delivery Plan (TDD-First)

## Read-first context and scope

Product/contract source of truth: `SPEC.md`. Layout source of truth: `TASK_PREVIEW_SOURCE_LINK_LAYOUT.md`. Deliver a frontend-only source-document action and the explicitly approved local popover keyboard handling. No backend metadata changes, migration, Google Docs support, sheet-range selection, wizard refactor or global popup-container change.

Only deliberate deferral: the user explicitly authorised final icon/action dimensions and header spacing to be tuned using Playwright visual evidence. Start with 16px icon, 24px action, stroke 1.5; reconcile final values before completion. All other behaviour is settled.

## Global constraints and delegation gates

- Check `git status` before edits; preserve other work. British English, existing helpers first, no lint suppression or hidden error handling.
- **Section 1 must be completed, regression-tested and receive clean Code Reviewer sign-off before ANY source-link, nullable-ID or new focus behaviour is implemented.** Decomposition is a prerequisite, not a late refactor.
- Each section follows **Red → Green → Refactor**. Testing Specialist owns Vitest implementation/debugging; Implementation owns production changes; Playwright owns browser tests and walkthroughs. Follow the Implementation → Code Reviewer fix/re-review loop until clean. Docs/Data Shapes Agent reconcile canonical entries before final sign-off.
- For every delegated phase, include the common and section-specific mandatory reads below as `@` paths. Require `Files read`, reject incomplete evidence and return the work to the same agent before progressing. Test, implementation, review, browser and documentation handoffs all use this gate.

### Common mandatory reads for every phase

- @SPEC.md
- @TASK_PREVIEW_SOURCE_LINK_LAYOUT.md
- @ACTION_PLAN.md
- @docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md
- @docs/developer/testing/synthetic-test-data.md

Additional baseline reads by phase:

- Testing Specialist: @docs/developer/frontend/frontend-testing.md
- Implementation and Code Reviewer: @docs/developer/frontend/frontend-spacing-and-padding-standards.md @docs/developer/frontend/frontend-loading-and-width-standards.md
- Playwright: @docs/developer/frontend/frontend-playwright-e2e.md @docs/developer/frontend/frontend-spacing-and-padding-standards.md
- Docs/Data Shapes Agent: @docs/developer/data-shapes/assignment.md @docs/developer/data-shapes/frontend-data-analysis-response.md

Component instructions remain mandatory under each agent's own contract; do not attach agent-definition/instruction files to delegation prompts.

### Planned canonical entries already recorded

- `docs/developer/data-shapes/assignment.md`, **Planned frontend validation alignment — issue #19**: required nullable artefact document/page IDs, `Not implemented`; parent document-ID optionality is documentation reconciliation only.
- `docs/developer/data-shapes/frontend-data-analysis-response.md`, **Task preview derived shapes (planned)**: required nullable editor `sourceUrl` on `CellPreviewData` and `TaskPreviewData`, `Not implemented`; no wire/persistence field.
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.26: local URL ownership, existing lookup/assembly extension, popover extraction, LucideIcon reuse and test-helper ownership, all `Not implemented`.

### Module sizing inventory and pre-functionality separation

Physical line counts include comments/blank lines. Projected counts are estimates; recount before editing and after every section. Any materially touched module projected above **500** must receive coherent separation before its functionality is added; never compress formatting or weaken documentation. Backend facade/load-order rules apply if scope ever legitimately touches backend, but none is planned here.

Frontend feature paths below are under `src/frontend/src/features/taskHeatmap/` unless qualified.

| Module                                                                       |  Current |    Projected without separation | Required target/order                                                                                                                                 |
| ---------------------------------------------------------------------------- | -------: | ------------------------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `buildCellPreviewLookup.spec.ts`                                             |      877 |                       1000–1060 | Section 1: contract 200–240, content 300–350, indexing 390–440; new source-link spec 120–180 later                                                    |
| `services/assignmentAssessment/assignmentAssessment.zod.spec.ts`             |      659 |                         710–750 | Section 1: original request/assignment/submission suite 450–490; artefact/task suite 260–310                                                          |
| `taskHeatmapTableColumns.tsx`                                                |      476 | 560–610 with inline focus logic | Section 1: columns 365–390; `TaskMetricPreviewCell.tsx` 85–120 initially/180–240 final; `TaskMetricPreviewContent.tsx` 90–115 initially/100–130 final |
| `buildCellPreviewLookup.ts`                                                  |      152 |                         200–225 | No split                                                                                                                                              |
| `assembleTaskPreviewData.ts`                                                 |      142 |                         145–155 | No split                                                                                                                                              |
| `TaskPreviewCard.tsx`                                                        |      168 |                         210–250 | No split; local CSS module if needed, estimated 30–60                                                                                                 |
| `services/assignmentAssessment/assignmentAssessment.zod.ts`                  |      208 |                         208–215 | No split                                                                                                                                              |
| `assembleTaskPreviewData.spec.ts`                                            |      399 |                         430–470 | No split                                                                                                                                              |
| `TaskPreviewCard.spec.tsx` / `.status.spec.tsx`                              | 240 / 77 |                 300–350 / 78–85 | No split                                                                                                                                              |
| `assembleMergedPreviewData.spec.ts`                                          |      243 |                         270–300 | No split                                                                                                                                              |
| `TaskHeatmapTable.preview.spec.tsx`                                          |      312 |                         340–380 | Integration regressions; new focus matrix in extracted cell spec (180–260)                                                                            |
| `TaskMetricPreviewCell.spec.tsx` / `TaskMetricPreviewContent.spec.tsx` (new) |    0 / 0 |               180–260 / 100–160 | Direct extraction characterisation first; focus extensions in Section 3                                                                               |
| `src/test/taskHeatmapTableTestHelpers.ts`                                    |      298 |                         300–320 | Required typed-literal alignment only                                                                                                                 |
| `src/test/taskHeatmap/previewFixtures.ts` (new)                              |        0 |                          60–100 | Canonical selection, not a competing corpus                                                                                                           |
| `e2e-tests/task-preview-card.spec.ts`                                        |      192 |                         192–220 | Existing content regressions, not a giant source-link matrix                                                                                          |
| `e2e-tests/task-preview-source-link.spec.ts` / `.visual.spec.ts` (new)       |        0 |                    250–350 each | Separate interaction and geometry/visual journeys from the outset                                                                                     |
| `e2e-tests/helpers/task-preview-source-link-helpers.ts` (new)                |        0 |                         200–300 | Canonical selection and scenario/navigation helpers, reuses runtime queues                                                                            |

Do not modify these near/over-threshold neighbours merely to add link tests: `TaskHeatmapTable.spec.tsx` 478, `.merged.spec.tsx` 474, `useHeatmapsPageData.ts` 478, `e2e-tests/task-heatmap.spec.ts` 479, shared runtime mock 882. Run them as regression checks. If a necessary edit is discovered, stop feature implementation, record current/projected counts and execute/review its decomposition first. Canonical Markdown catalogues and generated JSON are documentation/data, not runtime/test modules subject to source LOC decomposition; do not expand scope into a documentation reorganisation.

## Canonical-fixture selection and unsupported-data plan

Use the `small` profile views `classPartials`, `classesById`, `assignmentDefinitionPartials`, `assignmentsByKey`. Select `class-2` (trustworthy class row), populated Slides `assignment-2-1` and Sheets `assignment-2-2`; derive student/task IDs, labels, URLs and expected completeness content from the selected records. Unit mapping may also use Slides `assignment-1-1`. Validate full records through `AssignmentFullSchema`, clone before boundary mutations, and never import test code from production.

Use existing frontend raw-JSON import conventions for Vitest and direct JSON imports in the Node-side E2E helper; do not import the filesystem-based Node loader into browser code. Local null/blank/omitted/wrong-type IDs, unknown document format, encoded-ID probes, `"0"` gid and duplicate-task conflict cases are narrow boundary fixtures.

The compact corpus currently has TEXT-only populated submission artefacts and generic (non-numeric) Sheets page IDs. Existing image/table walkthrough examples may remain local while this unsupported-data extension plan is recorded (canonical fixture policy exception); use canonical text for the new normal journey, local boundary mutations for numeric gid/navigation probes. Do not replace the shared legacy heatmap scenario wholesale.

**Recorded generator-extension target (not required production functionality for issue #19):** extend `scripts/synthetic-test-data/generateAssignmentDefinitions.js` (216 lines; estimate 235–255) and `generateSubmissions.js` (233; estimate 285–325) to emit format-aware deterministic slide IDs/numeric sheet IDs and representative valid Slides IMAGE/TABLE plus Sheets SPREADSHEET content, consistent with definition locations. Keep seeds/counts/completion bands stable and use the existing `small` profile and existing views, not another realistic corpus. Add focused coverage in a new `tests/synthetic-analysis/syntheticSourceContent.test.ts` (estimate 150–250), retain projection/redaction and byte-reproducible regeneration checks, and regenerate compact fixtures via `npm run fixtures:synthetic` if that extension is subsequently implemented. This records unsupported fixture capability; it is not a deferred product/contract decision or authorisation to expand this issue into a generator rewrite.

Opportunistically migrate realistic setup in tests touched by this feature to canonical records; keep invalid/boundary cases local. Preserve untouched existing test/scenario labels and fixtures.

## Section 1 — Behaviour-preserving decomposition prerequisite

### Objective and constraints

Separate oversized test concerns and extract the metric-cell popover responsibility before feature implementation. No `sourceUrl`, nullability relaxation, controlled-focus behaviour or visible UI changes in this section.

### Delegation mandatory reads (all phases in addition to common reads)

- @src/frontend/src/features/taskHeatmap/taskHeatmapTableColumns.tsx
- @src/frontend/src/features/taskHeatmap/DeferredPopoverContent.tsx
- @src/frontend/src/features/taskHeatmap/TaskHeatmapTable.preview.spec.tsx
- @src/frontend/src/features/taskHeatmap/buildCellPreviewLookup.spec.ts
- @src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.spec.ts

### Shared helper / data-shape / fixture planning

- §9.26 entries 3 and 5: new coherent feature-local cell/content modules; shared canonical fixture selection. No generic popover wrapper.
- No data-shape changes. Fixture profile/views as above; boundary cases stay local. Moving an unchanged test does not require reinventing its fixtures; migrate realistic setup locally without weakening assertions.

### Red, Green, Refactor and acceptance criteria

1. **Red:** Testing Specialist adds direct characterisation specs importing the not-yet-extracted `TaskMetricPreviewCell` and `TaskMetricPreviewContent`. Prove current hover/click/Enter/Space activation, trigger role/label/tone, loading-over-error precedence, ready body and closed-overlay deferred assembly. Imports fail until the production extraction exists. Run/save failing output.
2. **Green:** Implementation moves `buildPopoverContent` (current lines 231–296) to `TaskMetricPreviewContent.tsx`; moves trigger/Popover rendering (367–405) into `TaskMetricPreviewCell.tsx`. Retain `DeferredPopoverContent`, hover/click/right placement/destroy-on-hide semantics, score/labels and existing Enter/Space click behaviour. Columns keep filtering/sorting/tier grouping and `<td>` tone/label mapping; rendering delegates to the new cell.
3. **Refactor:** split lookup tests into original contract/key invariants, `buildCellPreviewLookup.content.spec.ts` and `.indexing.spec.ts`; split schema artefact/task cases into `assignmentAssessment.artifacts.zod.spec.ts`. Original schema suite retains request/assignment/submission/assessment cases. Share necessary test setup without weakening assertions or creating competing realistic data.
4. Each resultant module ≤500 projected final lines; preserved assertions, comments and public column-builder APIs. Clean Code Reviewer pass on decomposition before Section 2.

### Section checks

- `npm run test:frontend -- src/features/taskHeatmap`
- `npm run test:frontend -- src/services/assignmentAssessment`
- `npm exec -- tsc -b` (working directory: `src/frontend`)
- `npm run lint:frontend`
- `npm run test:frontend:e2e -- e2e-tests/task-preview-card.spec.ts e2e-tests/task-heatmap.spec.ts e2e-tests/heatmaps.spec.ts`
- Review diff for behaviour preservation, recount files and check mandatory-read evidence.

`@remarks`: preserve why actual assembly remains deferred until opening; do not treat a function-valued Ant Popover content prop as sufficient on its own.

## Section 2 — Nullable validation and source-link derivation

### Objective and constraints

Implement the documented target contracts using only existing transport metadata. Section 1 sign-off is a hard dependency. No backend, wizard, merged winner or query changes.

### Delegation mandatory reads (all phases)

- @docs/developer/data-shapes/assignment.md
- @docs/developer/data-shapes/assignment-definition.md
- @docs/developer/data-shapes/frontend-data-analysis-response.md
- @src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts
- @src/frontend/src/features/taskHeatmap/buildCellPreviewLookup.ts
- @src/frontend/src/features/taskHeatmap/assembleTaskPreviewData.ts
- @src/frontend/src/features/taskHeatmap/assembleMergedPreviewData.ts

### Shared helper / data-shape / fixture planning

- §9.26 entries 1/2/5: extend lookup/assembly; source URL resolver kept private in lookup. Reuse whole-cell merged assembly unchanged.
- Implement the planned nullable-ID alignment and both derived `sourceUrl` entries in the named canonical docs. Data Shapes Agent removes `Not implemented` only after verifying code; no new API/persistence field.
- Canonical `small` full assignments for realistic cases; clone boundary probes. Update all five typed setup owners: `assembleTaskPreviewData.spec.ts`, `assembleMergedPreviewData.spec.ts`, `TaskPreviewCard.spec.tsx`, `.status.spec.tsx`, `src/test/taskHeatmapTableTestHelpers.ts`. Assertions/casts must not conceal an omitted required field.
- Update lookup-output assertions and any relevant shared fixture primitives in the newly split `buildCellPreviewLookup.*.spec.ts` suites for the derived-shape change in this section. Their API payloads must not gain a derived `sourceUrl`; this normal contract extension does not reopen or mix feature work into Section 1's already reviewed decomposition.

### Red, Green, Refactor and acceptance criteria

1. **Red:** nullable artefact `documentId`/`pageId` accepted across TEXT/TABLE/IMAGE/SPREADSHEET/base; missing and wrong-type fields rejected. Existing full assignment parse stays valid. Add lookup `.sourceLink.spec.ts` matrix for both anchor formats, artefact-first conflicts, parent fallback, root fallback, null/blank IDs, `"0"`, unknown/null format, encoded components and non-use of reference/template/export URLs. Assembly preserves URL for each content/metric case and returns explicit null for missing cells. Merged first-wins test pins content and URL from the same item, including first winner with null URL followed by a link-bearing loser.
2. **Green:** relax only the two common artefact source-ID validators to required nullable strings. Add required `sourceUrl: string | null` to `CellPreviewData` and `TaskPreviewData`. Resolve root assignment format and stored student IDs in lookup; carry URL unchanged in assembly. Align explicit typed test literals; do not insert derived fields into mock API payloads.
3. **Refactor:** keep resolution pure/private, fixed host/path, trimmed and encoded IDs, no duplicate URL resolution in card/merge. Preserve existing content coercion and metric identity.

### Section checks

- `npm run test:frontend -- src/services/assignmentAssessment src/features/taskHeatmap`
- `npm exec -- tsc -b` (working directory: `src/frontend`)
- `npm run lint:frontend`
- Data Shapes Agent reconciliation and clean Code Reviewer pass; mandatory-read evidence complete.

`@remarks`: editor URL is not image-export metadata; document format is not artefact type; display-time reference-page fallback is forbidden, while stored IDs are intentionally trusted as-is.

## Section 3 — Header action and approved local keyboard interaction

### Objective and constraints

Render the action and make the portal-mounted card straightforward to use by keyboard without altering pointer behaviour or trapping focus. Use extracted modules; do not inline state in column construction.

### Delegation mandatory reads (all phases)

- @src/frontend/src/features/taskHeatmap/TaskPreviewCard.tsx
- @src/frontend/src/features/taskHeatmap/TaskMetricPreviewCell.tsx
- @src/frontend/src/features/taskHeatmap/TaskMetricPreviewContent.tsx
- @src/frontend/src/components/icons/LucideIcon.tsx
- @docs/developer/frontend/metric-icon-display.md

The new files become mandatory only after Section 1 creates them; reject handoffs that substitute the old column module for those reads.

### Shared helper / data-shape / fixture planning

- §9.26 entries 3/4: local cell owns controlled open state, trigger ref and keyboard focus intent; content/card exposes the source anchor ref as an optional internal UI prop, not a transport field. Reuse LucideIcon unchanged, existing metric/body renderers and spacing constants.
- No additional persistence/transport shape. Use Section 2 derived contracts.
- Canonical text source examples for normal card/cell tests; null/metric-error/loading and focus-race probes are local boundaries. Existing unsupported image/table tests remain covered by the recorded generator-extension plan.

### Red, Green, Refactor and acceptance criteria

1. **Red:** conditional role=link, exact label, target/rel, hover/focus tooltip, decorative icon, live-region separation and unchanged body/score. Cell tests: keyboard Enter and Space open/focus link once; pointer hover/click does not move focus; Escape in trigger/portal restores trigger and closes; loading retains trigger focus then ready transfers once; no transfer if closed or user moved focus; error/no-link stays at trigger; Tab/Shift+Tab not prevented; reopened previews regain the correct session's focus intent.
2. **Green:** Card `extra` icon-only text Button with href and explicit aria-label/tooltip, sibling to the metric status. Balance title spacing for whole-card centring; header/extra inline-flex vertical alignment, viewport-constrained card, local CSS if necessary. Add controlled open state and focus ownership to the extracted cell. Native anchor/ref targets the source link, avoiding global DOM queries or timers. Pending focus belongs to the current keyboard-open session and is cancelled on closure/user focus departure. No global popup-container changes.
3. **Refactor:** preserve hover traversal, click pinning, deferred assembly, destroy-on-hide, outside-click behaviour and existing aria labels. Keep focus code in the extracted interaction owner. Separate new cell/content test suites from the existing near-500-line table suites.

### Section checks

- `npm run test:frontend -- src/features/taskHeatmap`
- `npm exec -- tsc -b` (working directory: `src/frontend`)
- `npm run lint:frontend`
- Clean Code Reviewer pass, recount and mandatory-read evidence.

`@remarks`: document portal-driven focus ownership, one-time late-readiness transfer and why the action is outside the score's live region.

## Section 4 — Playwright interaction and visual walkthrough

### Objective and constraints

Verify what users actually see and do, not merely the href or JSX styles. Playwright owns tests and screenshot inspection; Implementation applies any production tuning via the review loop. Browser testing uses mocked GAS queues, not live Google authentication or documents.

### Delegation mandatory reads (Playwright, Implementation and Code Reviewer)

- @src/frontend/e2e-tests/task-preview-card.spec.ts
- @src/frontend/e2e-tests/heatmaps.spec.ts
- @src/frontend/e2e-tests/helpers/task-heatmap-end-to-end-helpers.ts
- @src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts
- @src/frontend/src/features/taskHeatmap/TaskMetricPreviewCell.tsx
- @src/frontend/src/features/taskHeatmap/TaskPreviewCard.tsx

### Shared helper / data-shape / fixture planning

- §9.26 entry 5: new feature-local source-link scenario/navigation helper reuses existing runtime mocks, doubled StrictMode queues and canonical `small` linked views. No edits to the 882-line runtime mock are planned.
- The new helper constructs its own `getAssignment` queue entries from canonical `assignmentsByKey` records, including doubled `deferredSuccess`, failure and ready variants; do not inherit `createHeatmapScenario`'s immediate successes for the loading-to-ready focus journey. Release the held assignment responses with existing `releaseNextDeferredSuccess` helpers while the chosen preview session is open.
- No wire changes. Derive URLs from raw mocked assignment data through the actual service/schema/lookup pipeline.
- Use canonical class-2/Slides/Sheets records. Reuse the existing content fixture only for unsupported IMAGE/TABLE visual review; recorded generator-extension plan permits this exception. Local boundary variants cover unknown sources, numeric gid, root fallback and failure/deferred queues.

### Red, Green, Refactor and acceptance criteria

1. **Red (written before Section 3 functionality; see Execution order):** Playwright writes failing source-link interaction and geometry scenarios once decomposition/Section 2 are green. Record missing-link/focus failures. Do not wait until a complete UI exists to author them.
2. **Green:** execute after Section 3; fix through Implementation/Code Reviewer. Separate `task-preview-source-link.spec.ts` and `.visual.spec.ts` so each remains below 500 projected lines.
3. **Walkthrough:** root → Classes → selected class → recent assignment → embedded heatmap → cell → ready card. Repeat root → Heatmaps → selected class/assignments → merged table → cell. Use completeness labels/data derived from records, not copied scores.
4. Pointer: hover cell, move onto action, verify popover remains usable, hover tooltip, click. Register a context-wide route for `https://docs.google.com/**` before clicking, fulfil with harmless test content and capture popup navigation; assert exact editor URL including fragment, `_blank`/rel, original view unchanged and no source-click API calls. This verifies new-tab behaviour without reaching Google. Test Slides and Sheets; fallback and unavailable action cases.
5. Keyboard: focus trigger, Enter/Space, assert source link focus and tooltip, Enter opens captured popup; return to app, Escape restores cell. Cover deferred-ready transfer, focus moved elsewhere before readiness, closed-before-ready, no-link/error cases and untrapped Tab/Shift+Tab.
6. Geometry: desktop 1440×900 and narrow 390×844, light/dark. Poll stable ready header geometry (no sleeps); measure actual SVG/action size, whole-card metric centre, vertical centres, right inset, non-overlap and viewport containment to the layout doc's tolerances. Include long metric label and text/image/table bodies. Do not substitute DOM ordering or CSS declarations for rendered measurements.
7. Capture and **visually inspect** normal/hover/focused card and page-context screenshots from both entry points. Compare with issue #19 illustration and adjacent app actions; record scale, stroke, alignment, theme contrast and clipping verdict. Perform a separate real 200% browser-zoom walkthrough, recording the browser's zoom setting (not CSS zoom or pinch/page-scale masquerading as browser zoom). If tooling cannot perform it, report the limitation and keep the visual gate incomplete until a headed-browser check is supplied.
8. **Refactor/authorised tuning:** if 16px/24px looks inconsistent, record concrete evidence and final compliant dimensions/spacing; Implementation tunes, reviewer rechecks, then Playwright remeasures/reinspects. Update layout values and assertions, not weakened tolerances to hide defects. Save final evidence in test output directories; temporary review notes use `.opencode/scratchpad/`.

### Section checks

- `npm run test:frontend:e2e -- e2e-tests/task-preview-source-link.spec.ts e2e-tests/task-preview-source-link.visual.spec.ts e2e-tests/task-preview-card.spec.ts e2e-tests/heatmaps.spec.ts`
- `npm run test:frontend:e2e -- e2e-tests/task-preview-source-link.visual.spec.ts --repeat-each=5 --workers=1`
- Run the full E2E suite in Section 5. Screenshot paths, measured final values, viewport/theme/zoom and actual visual verdict are mandatory handoff evidence; automated success alone is insufficient.

## Section 5 — Regression, documentation and rollout sign-off

### Objective, constraints and mandatory reads

Regression and documentation agents use common/phase reads plus @docs/developer/data-shapes/assignment.md @docs/developer/data-shapes/frontend-data-analysis-response.md @docs/developer/frontend/frontend-playwright-e2e.md . Review only relevant changes; no unsolicited generator implementation or backend edits.

### Acceptance criteria and checks

- Earlier red-first contracts remain green; original body, metric states, hover/click pinning, table sorting/filtering, merged winner semantics and loading/error behaviour are preserved.
- `npm run test:frontend`
- `npm run test:frontend:e2e`
- `npm exec -- tsc -b` (working directory: `src/frontend`)
- `npm run lint:frontend`
- `npm run build:frontend`
- Docs/Data Shapes Agent reconcile implemented `Not implemented` entries and final visual values, including explicit editor-vs-export URL distinction. Historical metric-icon prose is reconciled only as warranted by measured evidence; no metric renderer changes.
- Recount touched modules, verify decomposition landed before feature phases, require complete `Files read` evidence and clean Code Reviewer sign-off after any documentation/contract changes. Record baseline failures rather than silently waiving tests.
- No migration, extra scopes, API change or feature flag. Use normal frontend bundle deployment only when requested; planning does not deploy.

### Implementation notes / deviations / follow-up (populate during execution)

- Execution status: Section 1 complete, Section 2 red testing next. Baseline established on branch `docs/issue-19-task-preview-source-link`.
- User-approved Section 1 scope amendment: migrate realistic fixtures throughout the suites being split and the new characterisation specs to canonical synthetic `small` records, not merely the new ready-content tests. Preserve assertions; clone canonical records for narrow boundary mutations and retain local invalid/state probes. Unsupported image/table/spreadsheet content retains the documented corpus-capability exception. Investigate bugs exposed by this migration and route production fixes through Implementation and Code Reviewer; do not weaken assertions to hide failures.
- Sequencing deviation: Testing Specialist performed the lookup/schema suite split during the red handoff rather than after green extraction. No feature production changes were made. Review the complete red test diff, including canonical migration, before green extraction; decomposition still requires its full regression and review gates before Section 2.
- User-approved additional generator alignment: replace synthetic roster `student-{class}-{student}` IDs with deterministic digit-only 21-character strings, regenerate committed compact profiles and derive fixture consumer IDs from roster records. The user supplied a live 21-digit sample; do not retain that exact value in tracked tests, code or documentation (use a fictional precision probe). Official Classroom UserProfile.id and Student.userId remain string contracts; numeric identifiers are documented, but neither a fixed length nor digit-only response validation is guaranteed. This is synthetic realism only: no production validation tightening or numeric conversion. Add focused red-first tests for deterministic uniqueness, string precision and cross-view linkage; preserve seeds/counts/names/Faker sequence. This approval does not authorise the separately recorded document-content generator extension.
- Red review identified five minor in-scope items: correct type-check gate cwd (fixed above), accurate spec JSDoc aliases, replace silent lookup cast with loud guard, co-locate boundary fixture helper under `src/test/taskHeatmap`, and freeze canonical schema fixture deliberately. All must be resolved before clean red sign-off.
- Red sign-off: all five findings fixed and Code Reviewer PASS (`.opencode/scratchpad/section1-red-review.md`). Preserved lookup 17 tests and schema 46 split tests; feature 213 assertions/tests passing, schema 58 tests passing, Section 1 browser subset 22 passing. Expected current-section reds: two missing extraction modules (also two TS2307 errors) and four digit-ID tests against unchanged generator; six identifier tests pass. Fictional precision probe replaces live sample, never tighten runtime string contracts. Frontend lint 32 existing warnings, none touched.
- Red regression run: `npm run regression-checker`, comparison timestamp `2026-09-30T21:14:38.275Z`, zero regressions, zero counted new failures, two lint fixes. Coverage command exit 1 is accounted by the two intended missing-module red suites (checker does not count these suite-import errors as individual test failures); full E2E and all other checks pass except accepted backend lint. Green must remove all intentional reds, not waive them. Report directory: `.ts-regression-checker/reports/session-docs-issue-19-task-preview-source-link/runs/`.
- Baseline: `npm run regression-checker` (2026-09-30), 7/8 checks passing; backend lint fails with 10 pre-existing `max-lines` warnings and zero errors. Frontend lint, frontend unit coverage, full frontend E2E, backend coverage, builder lint/coverage/compile pass. Report: `.ts-regression-checker/reports/session-docs-issue-19-task-preview-source-link/baseline/baseline.txt`. User accepted existing oversized-file technical debt and authorised continuation; no new failures or regressions may be waived. Baseline checker reports backend warnings (not frontend); broader existing oversized-file debt does not waive this plan's required in-scope decomposition.
- Worktree preservation: unrelated modification to `.opencode/skills/pre-pr-review/SKILL.md` detected after baseline; leave untouched and exclude from commits.
- Section 1 decomposition evidence and clean review: final Code Reviewer PASS, zero outstanding findings (`.opencode/scratchpad/section1-green-final-review.md`). Columns 390 lines, extracted cell/content 103/111; split lookup contract/content/indexing 140/180/275; schema original/artefacts 450/145. Canonical fixture selection and all materially touched modules remain below 500 lines. Feature 223 tests, schema 58, full frontend 2370, Section 1 E2E 22 and synthetic 248 pass; frontend type-check passes. Generator ID uniqueness/string precision/linkage covered; six dependent fixture views regenerate byte-reproducibly with names/seeds/Faker sequence unchanged. Docs reconciled extraction and fixture selection only; source-link/nullability/focus remain planned.
- Green regression gate: `npm run regression-checker` comparison `2026-10-01T00:09:20.677Z`: 7/8 passing, zero regressions, zero new failures, two lint fixes. Full frontend E2E and coverage pass. Only the 10 accepted baseline backend `max-lines` warnings remain failing. All current-section intentional reds removed. Branch `docs/issue-19-task-preview-source-link`; commit SHA/message and push confirmation pending below.
- Section 1 commit/push evidence: `0e4d3e9`, exact message `refactor: split task preview modules and use realistic synthetic student IDs`, branch `docs/issue-19-task-preview-source-link`. Pre-commit formatting/lint/type-check hooks passed without bypass. `git push origin docs/issue-19-task-preview-source-link` succeeded (`1ec3f6c..0e4d3e9`); clean worktree after push. This evidence update is committed separately before starting Section 2.
- Sections 2–3 red/green results, contracts/helpers reconciled and clean review:
- Section 4 final icon/action/spacing, geometry, screenshot paths, themes/viewports/zoom and visual-review verdict:
- Section 5 regression results, final review, documentation reconciliation:
- Deviations and reasons (no unapproved product/contract changes):

## Execution order

Section 1 decomposition/sign-off → Section 2 contracts/derivation → Section 4 red browser scenarios → Section 3 UI/keyboard → Section 4 green walkthrough/visual tuning/sign-off → Section 5 full regression/docs/final review. No open questions; only the user's explicitly authorised evidence-based visual tuning is left to execution.
