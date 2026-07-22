# Code Review — Section 1 `buildCellPreviewLookup` (GREEN phase)

**Reviewer:** Code Reviewer (frontend)
**Branch:** feat/preview-card-real-data-wiring
**File under review:** `src/frontend/src/features/classPage/buildCellPreviewLookup.ts`
**RED test (must stay green):** `src/frontend/src/features/classPage/buildCellPreviewLookup.spec.ts`

## Files read

- `/home/developer/AssessmentBot/SPEC.md` (multi-dimensional lookup design + Assumptions)
- `/home/developer/AssessmentBot/ACTION_PLAN.md` (Section 1 constraints, acceptance criteria)
- `/home/developer/AssessmentBot/src/frontend/AGENTS.md` (frontend conventions)
- `/home/developer/AssessmentBot/src/frontend/src/features/classPage/buildCellPreviewLookup.ts` (file under review)
- `/home/developer/AssessmentBot/src/frontend/src/features/classPage/buildCellPreviewLookup.spec.ts` (RED tests)
- `/home/developer/AssessmentBot/src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts` (Zod source of `AssignmentFull`)
- `/home/developer/AssessmentBot/docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` (§4, §9.18.16 item 24)
- `/home/developer/AssessmentBot/docs/developer/frontend/frontend-logging-and-error-handling.md`

## Verification results (in-scope)

1. **Correctness vs derivation rules** — PASS
   - Outer key `submission.studentId` (line 72) ✓
   - Inner key bare `item.taskId` (line 67–68) ✓
   - First-wins on duplicate `taskId` (line 67 `if (!innerMap.has(item.taskId))`) ✓
   - Reasoning derived per metric from `item.assessments[key]` (lines 44–48) — uses truthiness guard equivalent to `?.reasoning ?? null` given the Zod `AssessmentSchema` guarantees `reasoning: z.string()` ✓
   - `artifactType`/`artifactContent` from `item.artifact.type`/`item.artifact.content` (line 68) ✓
   - Empty `submissions` → empty `Map` (loop body never executes) ✓
   - 14/14 RED tests pass with this implementation (`npm run test:frontend -- buildCellPreviewLookup`)
2. **Purity** — PASS. No React/antd/I/O imports; only `import type { AssignmentFull }`. No side effects.
3. **Types** — PARTIAL (see Finding A). Parameter is `AssignmentFull` (= `z.infer<typeof AssignmentFullSchema>`) ✓. `CellPreviewLookup` matches SPEC ✓. `CellPreviewData` deviates on `artifactType` (see A).
4. **Standards** — PASS. British English throughout; KISS; no scope creep; no swallowed errors; no speculative additions; no `console.*`.
5. **Shared-helper registry** — PASS. `docs/.../frontend-shared-helpers-and-abstraction-standards.md` §9.18.16 item 24 still reads `Status: Not implemented` (line 813). Implementation did not flip it.
6. **Test file untouched** — PASS. `git status` shows `buildCellPreviewLookup.spec.ts` as untracked (`??`) — created by the RED phase, unmodified by implementation. Only the new implementation file and an unrelated e2e snapshot PNG are changed.
7. **Lint** — PASS. `npm run lint:frontend` → 0 errors, 1 warning: `src/frontend/src/services/apiService.spec.ts:304:44  warning  No magic number: -1` — pre-existing, unrelated to this change (out of scope).
8. **Redundant extraction** — see Finding B (Nitpick).

## Findings

### Finding A — Improvement (non-blocking)

- **File:line:** `src/frontend/src/features/classPage/buildCellPreviewLookup.ts:9`
- **Issue:** `CellPreviewData.artifactType` is typed as `string`, but the SPEC's "Multi-dimensional lookup design > Shape" (SPEC.md lines 266–273) explicitly defines it as the literal union `'TEXT' | 'TABLE' | 'IMAGE' | 'SPREADSHEET' | 'base'`. This is a deviation from the SPEC shape required by review verification point 3 ("exported `CellPreviewData` and `CellPreviewLookup` match SPEC shape"). Runtime behaviour is correct and tests pass, so this is not a Critical / blocking defect, but the broader `string` weakens the downstream type contract — `assembleTaskPreviewData` (Section 3) will switch on `artifactType` and a precise literal union gives compile-time narrowing and guards against typos/ad-hoc values. `item.artifact.type` is already a literal union in the inferred `AssignmentFull` type, so narrowing is free.
- **Concrete fix:**
  ```ts
  /** The artifact type discriminator from the backend. */
  readonly artifactType: 'TEXT' | 'TABLE' | 'IMAGE' | 'SPREADSHEET' | 'base';
  ```

### Finding B — Nitpick (optional)

- **File:line:** `src/frontend/src/features/classPage/buildCellPreviewLookup.ts:36–50`
- **Issue:** The private `createCellPreviewData` helper has exactly one call site (line 68) and does not own an independent contract beyond constructing the `CellPreviewData` object inline. Per `frontend-shared-helpers-and-abstraction-standards.md` §4.1 ("extraction would only rename existing code without removing duplication") and §5 anti-pattern ("single-caller wrapper extraction that does not own an independent contract"), this is a borderline premature abstraction. It is defensible as a cognitive-complexity reducer (the action plan notes it was added for that reason), so it is **not** flagged as an Improvement — but it does add a level of indirection for a single caller. Inlining the three-field object at line 68 would be marginally simpler (KISS). No change required; flagged for transparency per review task point 8.

## Summary verdict

**ISSUES FOUND (N=2): 1 Improvement (non-blocking) + 1 Nitpick (optional).**
No Critical or blocking issues. Correctness, purity, standards, shared-helper registry, test-file integrity, and lint are all clean.

The GREEN phase is **approved subject to** addressing Finding A (a quick, low-risk type-precision fix that restores exact SPEC-shape compliance and strengthens the Section 3 downstream contract). Finding B is optional and may be left as-is.

> Remember, you must address **all** in-scope review items and then resubmit to the reviewer until the review comes back clean.
