# Code Quality Remediation Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read the current `SPEC.md` — behaviour and contracts remain unchanged.
2. Read the current `ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md` — layout and workflow remain unchanged.
3. This plan addresses **only** the non-helper-extraction issues identified in CODE_REVIEW.md and SLOP_REVIEW.md for the `feat/CreateAssessmentModal` branch.

## Scope and assumptions

### Scope

This action plan addresses two critical issues that require remediation without behaviour change:

1. **Dead code removal**: Delete unused query mutation files that duplicate cache invalidation logic already present in `useAssignmentDefinitionWizard.ts`.
2. **Validation compliance**: Add missing `Validate.requireParams` call to `AssignmentDefinitionController.saveDefinition` to satisfy mandatory backend validation contract.

### Finding mapping

| Review Doc     | Finding ID | Plan Section           | Status                                           |
| -------------- | ---------- | ---------------------- | ------------------------------------------------ |
| CODE_REVIEW.md | CR-001     | Section 1              | ✅ Complete                                      |
| CODE_REVIEW.md | CR-NEW-001 | Section 2              | ✅ Complete                                      |
| CODE_REVIEW.md | CR-004     | Section 1 (incidental) | ✅ Complete                                      |
| SLOP_REVIEW.md | SLOP-001   | Section 1              | ✅ Complete                                      |
| SLOP_REVIEW.md | SLOP-004   | Section 1 (incidental) | ✅ Complete                                      |
| CODE_REVIEW.md | CR-002     | N/A                    | Out of scope (user directive: needed for CC < 7) |
| CODE_REVIEW.md | CR-003     | N/A                    | Out of scope (user directive: needed for CC < 7) |
| SLOP_REVIEW.md | SLOP-002   | N/A                    | Out of scope (user directive: needed for CC < 7) |
| SLOP_REVIEW.md | SLOP-003   | N/A                    | Out of scope (user directive: needed for CC < 7) |

### Out of scope

The following issues are **explicitly excluded** per user directive (needed to keep cyclomatic complexity below 7):

- Single-caller helper functions in `AssignmentsPage.tsx` (CR-002 / SLOP-002)
- Single-caller helper functions in `useAssignmentDefinitionWizard.ts` (CR-003 / SLOP-003)
- Over-extraction concerns related to the above

Cargo-cult comment pattern (CR-004 / SLOP-004) is addressed incidentally by Section 1 (deleting dead code files removes the duplicate comments; the canonical comment in `useAssignmentDefinitionWizard.ts` line 837 is retained as intended).

### Assumptions

1. No behaviour change is required or desired for this remediation.
2. Existing tests for `AssignmentDefinitionController` that call `saveDefinition` use valid definition objects and will continue to pass after adding parameter validation. New tests for null/undefined parameter validation will be added in the Red phase.
3. Deleting `upsertAssignmentDefinitionMutation.ts` and its test file will not break any production code, as verified by exhaustive import search in CODE_REVIEW.md.
4. The `Validate` utility is already available in `src/backend/Utils/Validate.js` and is loaded before `AssignmentDefinitionController` in the GAS concatenation order (Utils/ files load before y_controllers/ files).

### Shared-helper planning gate

No new shared helpers are being introduced by this plan. The existing `Validate.requireParams` utility in `src/backend/Utils/Validate.js` is reused. No planned helper entries are required in canonical docs.

---

## Global constraints and quality gates

### Engineering constraints

- Keep changes minimal, localised, and consistent with repository conventions.
- Preserve existing file/load ordering conventions (numeric prefixes where present).
- Do not introduce new dependencies or runtime assumptions.
- Use British English in comments and documentation.
- Backend changes must remain GAS V8 compatible.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section's acceptance criteria (where applicable).
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Delegation mandatory-read gate

When a section is delegated to sub-agents, the following documentation must be read and included in the handoff `Files read` section:

- `/home/developer/AssessmentBot/AGENTS.md`
- `/home/developer/AssessmentBot/src/backend/AGENTS.md`
- `/home/developer/AssessmentBot/src/frontend/AGENTS.md`
- This `ACTION_PLAN.md`
- Relevant companion docs: `SPEC.md`, `ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md`

### Validation commands hierarchy

- Backend lint: `npm run lint`
- Frontend lint: `npm run frontend:lint`
- TypeScript compilation: `npm exec tsc -- -b src/frontend/tsconfig.json`
- Backend tests: `npm test`
- Frontend unit tests: `npm run frontend:test`

---

## Section 1 — Remove dead code query mutation files

### Objective

Delete unused frontend query mutation files that violate frontend abstraction standards (§4.1, §5.1) and duplicate logic already implemented in `useAssignmentDefinitionWizard.ts`.

### Constraints

- Must not break any production imports (verified: zero production imports exist).
- Must not break any tests that depend on these files (only their own test file references them).
- Deletion must be atomic (both files together).
- Preserve git history via `git rm` rather than manual deletion.

### Delegation mandatory reads

Implementation mandatory docs:

- `/home/developer/AssessmentBot/AGENTS.md`
- `/home/developer/AssessmentBot/src/frontend/AGENTS.md`
- `/home/developer/AssessmentBot/docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `/home/developer/AssessmentBot/SPEC.md`
- `/home/developer/AssessmentBot/ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md`
- This `ACTION_PLAN.md`

Testing Specialist mandatory docs:

- `/home/developer/AssessmentBot/AGENTS.md`
- `/home/developer/AssessmentBot/src/frontend/AGENTS.md`
- `/home/developer/AssessmentBot/docs/developer/frontend/frontend-testing.md`
- This `ACTION_PLAN.md`

Code Reviewer mandatory docs:

- `/home/developer/AssessmentBot/AGENTS.md`
- `/home/developer/AssessmentBot/src/frontend/AGENTS.md`
- `/home/developer/AssessmentBot/docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- This `ACTION_PLAN.md`

### Shared helper plan

No shared helper changes are expected in this section. The logic being removed is dead code that was never integrated; the canonical implementation exists in `useAssignmentDefinitionWizard.ts`.

Helper decision entries:

1. Helper: Cache invalidation logic
   - Decision: `keep local`
   - Owning module/path: `src/frontend/src/pages/useAssignmentDefinitionWizard.ts`
   - Call-site rationale: Canonical implementation already exists and is used; dead code duplicate is being removed
   - Relevant canonical doc target: N/A
   - Planned doc status: N/A

### Acceptance criteria

- `src/frontend/src/query/upsertAssignmentDefinitionMutation.ts` is deleted from the repository.
- `src/frontend/src/query/upsertAssignmentDefinitionMutation.query.spec.ts` is deleted from the repository.
- No other production files reference the deleted files (verified via `grep -r "upsertAssignmentDefinitionMutation" src/frontend/src --include="*.ts" --include="*.tsx"` returns no results excluding test files).
- Frontend TypeScript compilation passes.
- Frontend lint passes.

### Required test cases (Red first)

Frontend tests:

1. Verify that no production code imports the deleted module by running TypeScript compilation — should pass without errors related to missing imports.

### Section checks

- `git rm src/frontend/src/query/upsertAssignmentDefinitionMutation.ts`
- `git rm src/frontend/src/query/upsertAssignmentDefinitionMutation.query.spec.ts`
- `npm exec tsc -- -b src/frontend/tsconfig.json`
- `npm run frontend:lint`
- Verify no references remain: `grep -r "upsertAssignmentDefinitionMutation" src/frontend/src --include="*.ts" --include="*.tsx"`
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

None — no new code is being added, only dead code removed.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Files deleted using `git rm` to preserve history. TypeScript compilation and frontend lint confirmed passing. No production files referenced the deleted modules.
- **Deviations from plan:** None.
- **Follow-up implications:** Removing these files also eliminates the cargo-cult comment duplicates identified in CR-004 / SLOP-004. The canonical comment instance in `useAssignmentDefinitionWizard.ts` line 837 remains.

---

## Section 2 — Add parameter validation to AssignmentDefinitionController.saveDefinition

### Objective

Add mandatory `Validate.requireParams` call at the entry point of `AssignmentDefinitionController.saveDefinition` to satisfy backend validation contract per `src/backend/AGENTS.md §2`.

### Constraints

- Must follow the pattern: `Validate.requireParams({ definition }, 'AssignmentDefinitionController.saveDefinition')` at the start of the method.
- Must not change method signature or behaviour for valid inputs.
- Must not break existing tests (validation should pass with valid input; existing tests use valid definitions).
- Must preserve existing JSDoc comment.
- Must maintain GAS V8 compatibility.
- Must verify that `Validate` utility is loaded before `AssignmentDefinitionController` in GAS concatenation order.

### Delegation mandatory reads

Implementation mandatory docs:

- `/home/developer/AssessmentBot/AGENTS.md`
- `/home/developer/AssessmentBot/src/backend/AGENTS.md`
- `/home/developer/AssessmentBot/docs/developer/backend/backend-logging-and-error-handling.md`
- `/home/developer/AssessmentBot/SPEC.md`
- This `ACTION_PLAN.md`

Testing Specialist mandatory docs:

- `/home/developer/AssessmentBot/AGENTS.md`
- `/home/developer/AssessmentBot/src/backend/AGENTS.md`
- `/home/developer/AssessmentBot/docs/developer/backend/backend-testing.md`
- This `ACTION_PLAN.md`

Code Reviewer mandatory docs:

- `/home/developer/AssessmentBot/AGENTS.md`
- `/home/developer/AssessmentBot/src/backend/AGENTS.md`
- `/home/developer/AssessmentBot/docs/developer/backend/backend-logging-and-error-handling.md`
- This `ACTION_PLAN.md`

### Shared helper plan

The existing `Validate.requireParams` utility is reused.

Helper decision entries:

1. Helper: `Validate.requireParams`
   - Decision: `reuse`
   - Owning module/path: `src/backend/Utils/Validate.js`
   - Call-site rationale: Mandatory backend validation contract per src/backend/AGENTS.md §2
   - Relevant canonical doc target: N/A (backend utility)
   - Planned doc status: N/A

### Acceptance criteria

- `AssignmentDefinitionController.saveDefinition` starts with `Validate.requireParams({ definition }, 'AssignmentDefinitionController.saveDefinition');`
- All existing tests for `AssignmentDefinitionController` continue to pass.
- New tests for null/undefined parameter validation are added and pass.
- Backend lint passes.
- No behaviour change: valid definitions still save correctly; invalid (null/undefined) definitions now throw with a clear error message.

### Required test cases (Red first)

Backend controller tests:

1. Add test case in `AssignmentDefinitionController` test suite: calling `saveDefinition(null)` throws Error with message containing **"definition is required for AssignmentDefinitionController.saveDefinition"**.
2. Add test case: calling `saveDefinition(undefined)` throws Error with message containing **"definition is required for AssignmentDefinitionController.saveDefinition"**.
3. Existing test cases using valid definition objects continue to pass.

### Section checks

- Verify `Validate.requireParams` is called at the start of `saveDefinition`
- Verify file load order: `ls src/backend/Utils/Validate.js` and `ls src/backend/y_controllers/AssignmentDefinitionController.js` confirm Utils/ loads before y_controllers/
- `npm test -- tests/controllers/assignmentDefinitionController.test.js`
- `npm run lint`
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

None — the validation is self-explanatory and follows the established pattern documented in `src/backend/AGENTS.md §2`.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Added `Validate.requireParams({ definition }, 'AssignmentDefinitionController.saveDefinition');` as the first line of the `saveDefinition` method. Two new test cases added to verify null and undefined parameter validation. All 953 backend tests pass, including the 2 new validation tests.
- **Deviations from plan:** None.
- **Follow-up implications:** This change hardens the contract without changing visible behaviour for valid inputs. All existing tests using valid definition objects continue to pass.

---

## Regression and contract hardening

### Objective

Verify that all remediation changes pass existing validation gates and do not introduce regressions.

### Constraints

- Run validation in the order specified to catch failures early.
- Do not proceed to broader tests if lint or compilation fails.

### Acceptance criteria

- All lint checks pass.
- TypeScript compilation passes.
- All backend unit tests pass.
- All frontend unit tests pass.
- Dead code files are fully removed with no residual references.

### Required test cases/checks

1. Run backend lint: `npm run lint`
2. Run frontend lint: `npm run frontend:lint`
3. Run TypeScript compilation: `npm exec tsc -- -b src/frontend/tsconfig.json`
4. Run backend tests: `npm test`
5. Run frontend tests: `npm run frontend:test`
6. Verify no residual references to deleted files: `grep -r "upsertAssignmentDefinitionMutation" src/frontend/src --include="*.ts" --include="*.tsx"`

### Section checks

- All commands listed above return green results.
- Mandatory-read evidence (`Files read`) is complete for every delegated regression handoff.

### Implementation notes / deviations / follow-up

- **Implementation notes:** TBD during execution.
- **Deviations from plan:** TBD during execution.

---

## Documentation and rollout notes

### Objective

No documentation changes are required. The changes are internal quality improvements that do not alter API contracts, data shapes, or user-visible behaviour. Existing `SPEC.md` and `ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md` remain valid.

### Constraints

- Do not modify `SPEC.md` or `ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md` as behaviour is unchanged.
- Do not add new documentation for this remediation work.

### Acceptance criteria

- No documentation files are modified as part of this remediation.
- All planning artefacts accurately reflect what was implemented.

### Required checks

1. Verify `SPEC.md` remains unchanged.
2. Verify `ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md` remains unchanged.
3. Confirm no new docs were created for this remediation.

### Optional `@remarks` JSDoc review

None — no non-obvious design decisions require preservation in JSDoc.

### Implementation notes / deviations / follow-up

- **Implementation notes:** TBD during execution.
- **Deviations from plan:** TBD during execution.

---

## Suggested implementation order

1. **Section 1** — Remove dead code query mutation files (no behaviour change, cleans codebase)
2. **Section 2** — Add parameter validation to `AssignmentDefinitionController.saveDefinition` (contract hardening)
3. **Regression and contract hardening** — Validate all changes pass existing gates
4. **Documentation and rollout notes** — Confirm no doc changes needed

---

## Summary

This action plan addresses the two critical blocking issues identified in CODE_REVIEW.md and SLOP_REVIEW.md that are **not** related to single-caller helper extraction (which the user explicitly wants to retain for CC < 7 compliance):

- **Section 1**: Removes dead code files violating frontend abstraction standards
- **Section 2**: Adds missing parameter validation per backend validation contract

All other findings (CR-002, CR-003, SLOP-002, SLOP-003) are explicitly out of scope. Cargo-cult comments (CR-004, SLOP-004) are resolved incidentally by Section 1.

**Readiness for implementation orchestration**: Pending Planner Reviewer re-validation after addressing reviewer findings.
