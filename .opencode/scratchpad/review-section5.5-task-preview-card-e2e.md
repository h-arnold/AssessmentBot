# Code Review — Section 5.5: Update E2E `task-preview-card.spec.ts` for real-data popover

**Branch:** `feat-preview-card-real-data-wiring`
**Reviewer:** Code Reviewer (frontend E2E focus)
**Scope:** E2E plumbing only (no production `src/frontend/src/**` code changed)

## Verdict: **CLEAN**

Section 5.5 is **approved**. The planned E2E breakage from Section 5 is now
resolved — `task-preview-card.spec.ts` is green. One non-blocking Nitpick is
recorded below for the documentation pass; it does not block approval.

---

## Files read

1. `/home/developer/AssessmentBot/SPEC.md` (§"E2E plumbing updates", §"Testing expectations → E2E tests (Playwright)")
2. `/home/developer/AssessmentBot/ACTION_PLAN.md` (Section 5.5, full — read through line 1243)
3. `/home/developer/AssessmentBot/src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts`
4. `/home/developer/AssessmentBot/src/frontend/e2e-tests/helpers/task-heatmap-end-to-end-helpers.ts`
5. `/home/developer/AssessmentBot/src/frontend/e2e-tests/task-preview-card.spec.ts`
6. `/home/developer/AssessmentBot/src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts`
7. `/home/developer/AssessmentBot/docs/developer/frontend/frontend-playwright-e2e.md`
8. `/home/developer/AssessmentBot/src/frontend/AGENTS.md`

Plus: `git status` / `git diff` (confirmed no production `src/frontend/src/**` files
touched — only the 3 E2E source files + 4 PNG snapshots), a grep for the removed
fixture text, a glob for new E2E spec files, and a live E2E + lint run.

---

## In-scope verification (all PASS)

1. **`getAssignment` plumbing** — `allMethods` (line 490) contains the literal
   `'getAssignment'`; `RuntimeScenario` (line 63) declares
   `getAssignment?: ReadonlyArray<ResponseItem>` with a `@remarks` cross-reference
   to the `getABClass` two-entry pattern. ✓
2. **Fresh `buildAssignmentFullDocument` construction** — defined as a new
   standalone helper (lines 364–449); its inner `buildItem`/`buildArtifact`
   closures are independent and do **not** reuse/extend the `ClassFull`-path
   `buildItem` in `buildClassFullDocument`. Returns all 12 `.strict()` top-level
   `AssignmentFull` fields with no extra keys. Each `StudentSubmission` satisfies
   `StudentSubmissionSchema` (studentId/studentName/assignmentId/documentId/
   items/createdAt/updatedAt); each `StudentSubmissionItem` satisfies
   `StudentSubmissionItemSchema` (id/taskId/artifact/assessments/feedback); each
   `artifact` satisfies `BaseTaskArtifactSchema` (all `BaseTaskArtifactFields` +
   discriminant `type` + type-matching `content`); each `assessment[key]`
   satisfies `AssessmentSchema` (score:number + reasoning:string);
   `assignmentDefinition` satisfies `AssignmentDefinitionSchema` (including
   `referenceLastModified`/`templateLastModified`/`tasks:{}`). ✓
3. **Two identical `getAssignment` entries (StrictMode)** — lines 519–522 seed two
   identical `{ kind:'success', data: buildAssignmentFullDocument() }` entries,
   mirroring `getABClass`. ✓
4. **Per-task artifact distribution** — `task_001 → IMAGE` (non-empty renderable
   data URI so `ImageRenderer` emits `<img>`), `task_002 → TEXT` (non-empty
   deterministic markdown), `task_003 → TABLE` (non-empty markdown table so
   `MarkdownRenderer` emits `<table>`). ✓
5. **Four spec edits match Section 5.5** — IMAGE/completeness hover target
   `'Student Two, task_001, Completeness: 5'` + `img` assertion unchanged (lines
   97, 107); TEXT/accuracy target changed to `'Student Two, task_002, Accuracy: 4'`
   and assertion replaced with `/student explained the method clearly and showed
all working\./i` (the `task_002.accuracy.reasoning` seeded string, lines
   120, 132–134); TABLE/spag target changed to `'Student Two, task_003, SPaG: 5'`
   - `table` assertion (lines 147, 157); pinned-popover click target
     `'Student Two, task_001, Completeness: 5'` + `assertPopoverStructure`
     unchanged (lines 172, 179). `assertPopoverStructure` itself is structurally
     unchanged. No new E2E spec files created. ✓
6. **Removed fixture text** — grep for `/preview cards work properly/i` across
   `e2e-tests/` returns no matches. ✓
7. **Standards / quality gates** —
   - British English in comments. ✓
   - No speculative scope; changes are confined to Section 5.5. ✓
   - No production `src/frontend/src/**` files modified (verified via `git status`). ✓
   - Live E2E run: `npm run test:frontend:e2e -- task-preview-card` → **4 passed**
     (chromium `chrome-linux64/chrome` present). ✓
   - Lint: the two lines added (endToEndRuntimeMocks.ts lines 63, 490) introduce
     **no** new lint errors. The only lint errors reported
     (`no-restricted-imports` on lines 2–3 of the same file) are **pre-existing**
     (unchanged by this diff, importing `src/test/*`); out of scope per the
     pre-existing-warning rule. ✓

---

## Findings

**Nitpick (non-blocking, documentation cleanliness):**

- `src/frontend/e2e-tests/helpers/task-heatmap-end-to-end-helpers.ts` — the
  `buildAssignmentFullDocument` helper carries **two** JSDoc blocks describing it:
  the first at lines ~289–313 (placed above `HEATMAP_REASONING`, so it is orphaned
  from the function it documents) and a second at lines ~356–363 immediately above
  the actual function definition. The orphaned leading block is dead/duplicated
  documentation.
  - **Concrete fix:** delete the first JSDoc block (lines ~289–313) and keep the
    one immediately preceding the `function buildAssignmentFullDocument()`
    declaration. (Optional per ACTION_PLAN §5.5 "Optional @remarks JSDoc
    follow-through"; best absorbed in the documentation pass.)

No Critical or Improvement findings.

---

## Out-of-scope notes (not blocking)

- The `no-restricted-imports` lint errors on `endToEndRuntimeMocks.ts` lines 2–3
  pre-date this change and were explicitly scoped out of this review.
- PNG snapshot artefacts under
  `task-preview-card.spec.ts-snapshots/` were regenerated by the passing run; this
  is expected and not a code concern.
