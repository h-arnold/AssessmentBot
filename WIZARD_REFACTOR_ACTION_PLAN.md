# AssignmentDefinitionWizardModal Refactor Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read the current `SPEC.md` for product behaviour and contracts.
2. Read `ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md` for layout and UI specifications.
3. Read `ACTION_PLAN.md` Section 4 for existing implementation context.
4. Read `docs/developer/frontend/frontend-modal-patterns.md` for modal-specific standards.
5. Read `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` for extraction rules.
6. Read `config/eslint/ts-base-rules.cjs` for lint complexity threshold (max: 7).
7. Treat the existing Section 4 implementation as the baseline; this refactor plan addresses **known technical debt** documented in `ACTION_PLAN.md` Section 4.

## Scope and assumptions

### Scope

- Refactor `AssignmentDefinitionWizardModal.tsx` to reduce cyclomatic complexity from 37 to <=7.
- Extract state management and side effects into a feature-local custom hook following `src/frontend/AGENTS.md` Section 2.2.
- Preserve **all** existing behaviour verified by the 10 unit tests in `AssignmentDefinitionWizardModal.spec.tsx`.
- Maintain compliance with `docs/developer/frontend/frontend-modal-patterns.md` Section 3.4 (keep local to assignment-definition workflow).

### Out of scope

- Adding new features or changing existing behaviour.
- Modifying `AssignmentsPage.tsx` (parent component) beyond import path updates.
- Changing backend contracts or services.
- Addressing complexity violations in other files (e.g., `AssignmentsPage.tsx`).

### Assumptions

1. The refactor must pass all 10 existing unit tests without modification.
2. The extracted hook will be **feature-local** (co-located in `pages/assignmentDefinitionWizard/`).
3. TDD workflow applies: red tests first, green implementation, refactor verification.
4. Each phase produces independently verifiable changes.
5. The existing `pages/assignmentDefinitionWizard/` directory is the intended location for refactored files.

### Justification for Hook Extraction

**Addressing planner-reviewer concern about single-caller anti-pattern:**

The repo's `frontend-shared-helpers-and-abstraction-standards.md` Section 5 rejects "single-caller wrapper extraction that does not own an independent contract." However, the codebase contains **precedent for single-caller hooks that own coherent contracts**:

- `useClassesManagement.ts` — Used by `ClassesManagementPanel.tsx` (1 production caller) + tests. Owns contract: Classes management state.
- `useBackendSettings.ts` — Used by `BackendSettingsPanel.tsx` (1 production caller) + tests. Owns contract: Backend settings state.

**This refactor follows the same pattern:**

- `useAssignmentDefinitionWizard.ts` — Will be used by `AssignmentDefinitionWizardModal.tsx` (1 production caller) + tests. Will own contract: Assignment definition wizard state and lifecycle management.

This is **not** a violation of the anti-pattern because:

1. The hook owns a **coherent, independent contract** (wizard state/lifecycle), not just arbitrary code
2. It is **feature-scoped** (co-located with its single caller)
3. It is **not shared abstraction** (won't be imported by other features)

This approach satisfies both:

- `src/frontend/AGENTS.md` Section 2.2: "Place async orchestration and side effects in feature hooks"
- `frontend-modal-patterns.md` Section 3.4: "keep local to the assignment-definition workflow"

---

## Global constraints and quality gates

### Engineering constraints

- Keep the modal as a **feature-local workflow surface** per `frontend-modal-patterns.md` Section 3.4.
- Do **not** extract multiple single-caller hooks (anti-pattern per `frontend-shared-helpers-and-abstraction-standards.md` Section 5).
- Extract **one** co-located hook containing all state/logic to satisfy `src/frontend/AGENTS.md` Section 2.2 (side effects in hooks).
- Preserve all existing Ant Design component usage and patterns.
- Maintain React Query cache invalidation and query key contracts.
- Use British English in comments and documentation.

### TDD workflow (mandatory per phase)

For each phase below:

1. **Red**: Write failing tests for the phase's acceptance criteria (if new test coverage needed).
2. **Green**: Implement the smallest change needed to pass all tests (existing + new).
3. **Refactor**: Tidy implementation with all tests still green.
4. Run phase-level verification commands.

### Phase check tracking

**Note:** Phase check checkboxes (`[ ]`, `[x]`) track **execution progress** during implementation, not planning readiness. Empty checkboxes indicate the phase has not yet been executed, not that the plan is incomplete. The plan status at the document footer indicates planning readiness.

### Delegation mandatory-read gate (mandatory for sub-agent execution)

When a phase is delegated to sub-agents, the plan must define and enforce mandatory documentation reads.

For each delegated phase (`Testing Specialist`, `Implementation`, `Code Reviewer`):

1. List required workspace documentation file paths and any required external documentation URLs under that phase before delegation.
2. Require the sub-agent handoff to include `Files read` with explicit workspace file paths and `External docs consulted` with explicit URLs whenever external references are mandatory.
3. Verify every mandatory file path and mandatory URL is listed before accepting the handoff.
4. If any mandatory item is missing, return the work to the same sub-agent and block progression to the next phase.

### Validation commands hierarchy

- Backend lint: `npm run lint`
- Frontend lint: `npm run frontend:lint`
- Frontend unit tests: `npm run frontend:test -- <target>`
- Frontend type check: `npm run frontend:type-check`

### Shared-helper planning gate

Helper decision entries for this refactor:

1. Helper: `useAssignmentDefinitionWizard` (new feature-local hook)
   - Decision: `new`
   - Owning module/path: `src/frontend/src/pages/assignmentDefinitionWizard/useAssignmentDefinitionWizard.ts`
   - Call-site rationale: consolidates side effects and state management for the single-caller modal component; owns coherent contract for wizard state/lifecycle; keeps abstraction feature-local per `frontend-modal-patterns.md` Section 3.4; follows precedent of `useClassesManagement.ts` and `useBackendSettings.ts`
   - Relevant canonical doc target: `src/frontend/AGENTS.md` Section 2.2, `frontend-modal-patterns.md` Section 3.4, `frontend-shared-helpers-and-abstraction-standards.md` Section 4.3
   - Planned doc status: `Not implemented`

2. Helper: `AssignmentDefinitionWizardModal` (existing component)
   - Decision: `refactor in place`
   - Owning module/path: `src/frontend/src/pages/assignmentDefinitionWizard/AssignmentDefinitionWizardModal.tsx`
   - Call-site rationale: move from root `pages/` to feature-local directory; split into presenter-only component consuming hook
   - Relevant canonical doc target: `frontend-modal-patterns.md` Section 4
   - Planned doc status: `Not applicable`

3. Helper: `AssignmentDefinitionWizardModalShell` (existing presenter component)
   - Decision: `refactor in place`
   - Owning module/path: `src/frontend/src/pages/assignmentDefinitionWizard/AssignmentDefinitionWizardModalShell.tsx`
   - Call-site rationale: part of assignment-definition workflow shell; moved to feature-local directory alongside main modal
   - Relevant canonical doc target: `frontend-modal-patterns.md` Section 4
   - Planned doc status: `Not implemented`

### Complexity Reduction Analysis

**Baseline (from ACTION_PLAN.md Section 4):**

| File                                  | Line | Function                          | Current Complexity | Target |
| ------------------------------------- | ---- | --------------------------------- | ------------------ | ------ |
| `AssignmentDefinitionWizardModal.tsx` | 72   | `hasAllParseFields`               | 10                 | <=7    |
| `AssignmentDefinitionWizardModal.tsx` | 109  | `AssignmentDefinitionWizardModal` | 37                 | <=7    |
| `AssignmentDefinitionWizardModal.tsx` | 109  | Cognitive Complexity              | 17                 | <=15   |
| `AssignmentDefinitionWizardModal.tsx` | 237  | Dirty state `useEffect`           | 19                 | <=7    |
| `AssignmentDefinitionWizardModal.tsx` | 361  | `handleSave`                      | 8                  | <=7    |

**How extraction achieves targets:**

1. **`hasAllParseFields` (10 -> <=3):** Replace chained boolean conditions with `Array.every()` pattern.
2. **`handleSave` (8 -> <=7):** Extract request-building logic to helper function (deferred to Phase 2).
3. **Dirty state `useEffect` (19 -> N/A):** This complexity moves to the hook. The **hook** must delegate to helper functions to achieve <=7 complexity, following the precedent of `useClassesManagement.ts`.
4. **Main component (37 -> <=7):** After extracting all state, queries, mutations, and handlers to the hook, the component retains only:
   - Hook invocation (1)
   - JSX rendering with conditional branches (2-3)
   - Form field definitions (1-2)
   - Event wiring (1)
   - **Total: ~5-6**
5. **Hook complexity (<=7):** The hook itself must be decomposed into helper functions. Complex logic (e.g., dirty state calculation, request building) must live in separate helpers called by the hook.

**Complexity threshold source:** `config/eslint/ts-base-rules.cjs` line 14: `'complexity': ['error', 7]` (applies to ALL files, including hooks)

### Complexity Budget

| File                                  | Current | Target | Owner                      |
| ------------------------------------- | ------- | ------ | -------------------------- |
| `AssignmentDefinitionWizardModal.tsx` | 37      | <=7    | Component (presenter only) |
| `useAssignmentDefinitionWizard.ts`    | N/A     | <=7    | Hook (orchestrator only)   |
| `hasAllParseFields`                   | 10      | <=3    | Helper function            |
| `handleSave`                          | 8       | <=7    | Helper function            |
| Dirty state `useEffect`               | 19      | <=7    | Helper function(s)         |

---

## Phase 1 — Quick wins: Helper function simplification

### Objective

- Reduce complexity in standalone helper functions that can be simplified without structural changes.
- Fix low-hanging fruit to demonstrate progress and reduce risk.
- Validate that existing tests continue to pass.

### Constraints

- Only modify pure utility functions (no React hooks, no state changes).
- Do not change component behaviour or structure.
- All existing tests must continue to pass.
- No new files created.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md` (Section 4)
- `WIZARD_REFACTOR_ACTION_PLAN.md`
- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

Implementation mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md` (Section 4)
- `WIZARD_REFACTOR_ACTION_PLAN.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `config/eslint/ts-base-rules.cjs`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md` (Section 4)
- `WIZARD_REFACTOR_ACTION_PLAN.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

### Acceptance criteria

- `hasAllParseFields` complexity reduced from 10 to <=3.
- All 10 existing unit tests pass without modification.
- No new files created.

### Required test cases/checks

1. `hasAllParseFields` uses `Array.every()` pattern.
2. Run `npm run frontend:test -- AssignmentDefinitionWizardModal.spec.tsx` — all 10 tests pass.
3. Run `npm run frontend:lint -- src/frontend/src/pages/AssignmentDefinitionWizardModal.tsx` — complexity errors reduced from 5 to 4 (was: 37, 19, 17, 10, 8; now: 37, 19, 17, 8).

### Implementation notes

- Extract `REQUIRED_PARSE_FIELDS` constant: `['title', 'topic', 'yearGroup', 'referenceDocumentUrl', 'templateDocumentUrl'] as const`
- Rewrite `hasAllParseFields`: `return REQUIRED_PARSE_FIELDS.every(field => String(values[field] ?? '').trim() !== '');`
- **Deferred:** `handleSave` simplification moved to Phase 2 as part of hook extraction

### Phase checks

- [ ] green implementation complete
- [ ] green review clean
- [ ] checks passed (tests + lint)
- [ ] action plan updated
- [ ] commit created
- [ ] push completed

---

## Phase 2 — Extract useAssignmentDefinitionWizard hook

### Objective

- Create the new hook file containing all state, queries, mutations, and handlers.
- Component becomes thin presenter with JSX only.
- Hook owns the coherent contract for wizard state and lifecycle management.

### Constraints

- **Do not** change any test files.
- **Do not** modify `AssignmentsPage.tsx` (parent will be updated in Phase 3).
- Hook must be co-located: `src/frontend/src/pages/assignmentDefinitionWizard/useAssignmentDefinitionWizard.ts`.
- Component remains in current location until hook is verified.
- **Note:** `AssignmentDefinitionWizardModalShell.tsx` remains unchanged in this phase; it will be relocated in Phase 3 without code modification.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md`
- `ACTION_PLAN.md` (Section 4)
- `WIZARD_REFACTOR_ACTION_PLAN.md`
- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-modal-patterns.md`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

Implementation mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md` (Section 4)
- `WIZARD_REFACTOR_ACTION_PLAN.md`
- `ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md`
- `docs/developer/frontend/frontend-modal-patterns.md` (Section 3.4)
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- `config/eslint/ts-base-rules.cjs`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md` (Section 4)
- `WIZARD_REFACTOR_ACTION_PLAN.md`
- `docs/developer/frontend/frontend-modal-patterns.md` (Section 3.4)
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

### Acceptance criteria

- `useAssignmentDefinitionWizard.ts` exists with:
  - All `useQuery` calls (topics, yearGroups, definition)
  - `useMutation` for upsert
  - Core state: `form`, `hasParsedTasks`, `taskRows`, `isSubmitting`, `blockingError`
  - Simple handlers that **delegate to helper functions** (not complex logic directly in hook body)
  - Helper functions: `buildCanonicalUrl`, `hasAllParseFields`, `hasYearGroupSelected`, `buildSaveRequest`, `calculateDirtyState`, `buildReparseRequest`
  - Return object with all state and handlers needed by component
  - **Hook main function complexity <=7** (via helper decomposition)
  - **All helper functions complexity <=7**
- Component imports hook and delegates all logic to it
- All 10 existing unit tests pass without modification
- Hook file passes type check and lint
- Component complexity reduced to <=7

### Required test cases/checks

1. Run `npm run frontend:test -- AssignmentDefinitionWizardModal.spec.tsx` — all 10 tests pass.
2. Run `npm run frontend:type-check` — no errors.
3. Run `npm run frontend:lint -- AssignmentDefinitionWizardModal.tsx` — component complexity <=7 (passes).
4. Run `npm run frontend:lint -- useAssignmentDefinitionWizard.ts` — hook complexity <=7 (passes); helper functions each <=7.
5. Component file size reduced from ~628 lines to ~150-200 lines.
6. Hook file size <=400 lines.

### Implementation notes

- Hook signature: `useAssignmentDefinitionWizard(properties: { mode: ModalMode; definitionKey: string | null; open: boolean; onClose: () => void }): UseAssignmentDefinitionWizardResult`
- Use `useCallback` for all handlers to maintain referential stability.
- Keep all existing dependency arrays identical to prevent unnecessary re-renders.
- Return memoized derived state (e.g., `topicOptions`, `yearGroupOptions`, `isPrimaryActionDisabled`) from hook.
- **Follow precedent pattern:** Hook orchestrates; complex logic lives in separate helper functions (matching `useClassesManagement.ts` structure).
- `handleSave` complexity reduced via `buildSaveRequest()` helper extraction.
- **Hook test strategy:** Hook behaviour is covered by existing component integration tests through the presenter layer; no new dedicated hook test file is created in this refactor.

### Complexity justification

After extraction, the component contains only:

- Hook invocation (1 path)
- Conditional rendering for loading/error states (2 paths: if loading, if error)
- Conditional rendering for main content (2 paths: if parsed, if not parsed)
- Form field definitions (no conditionals)
- Event wiring (no conditionals)
- **Total cyclomatic complexity: ~5-6** (well under 7 threshold)

The hook achieves <=7 complexity by delegating to helper functions:

- `hasAllParseFields`: <=3 (Array.every() pattern)
- `buildSaveRequest`: <=5 (extracted from handleSave)
- `calculateDirtyState`: <=7 (extracted from useEffect)
- `buildReparseRequest`: <=7 (extracted from handler)

### Phase checks

- [ ] green implementation complete
- [ ] green review clean
- [ ] checks passed (tests + lint + type-check)
- [ ] action plan updated
- [ ] commit created
- [ ] push completed

---

## Phase 3 — File relocation and import updates

### Objective

- Move files to feature-local directory structure.
- Update import paths in `AssignmentsPage.tsx`.
- Ensure all imports continue to resolve correctly.

### Constraints

- Maintain all existing imports from `AssignmentsPage.tsx`.
- Update import paths in `AssignmentsPage.tsx` to point to new location.
- Do not modify any code logic, only file paths and imports.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md` (Section 4)
- `WIZARD_REFACTOR_ACTION_PLAN.md`
- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-modal-patterns.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

Implementation mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md` (Section 4)
- `WIZARD_REFACTOR_ACTION_PLAN.md`
- `docs/developer/frontend/frontend-modal-patterns.md` (Section 3.4)
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md` (Section 4)
- `WIZARD_REFACTOR_ACTION_PLAN.md`
- `docs/developer/frontend/frontend-modal-patterns.md` (Section 4)

### Acceptance criteria

- `AssignmentDefinitionWizardModal.tsx` moved to `pages/assignmentDefinitionWizard/AssignmentDefinitionWizardModal.tsx`
- `AssignmentDefinitionWizardModal.spec.tsx` moved to `pages/assignmentDefinitionWizard/AssignmentDefinitionWizardModal.spec.tsx`
- `AssignmentDefinitionWizardModalShell.tsx` moved to `pages/assignmentDefinitionWizard/AssignmentDefinitionWizardModalShell.tsx`
- `AssignmentDefinitionWizardModalShell.spec.tsx` moved to `pages/assignmentDefinitionWizard/AssignmentDefinitionWizardModalShell.spec.tsx`
- `AssignmentsPage.tsx` imports updated to use new paths
- All tests pass from new locations

**Note:** `useAssignmentDefinitionWizard.ts` is created in Phase 2 and remains in place; no relocation needed.

### Required test cases/checks

1. Run `npm run frontend:test -- assignmentDefinitionWizard` — all 10 tests pass.
2. Run `npm run frontend:lint` — no new errors, complexity errors now reference new paths.
3. Run `npm run frontend:type-check` — no errors.
4. Run `npm run frontend:test:e2e` — assignment-definition wizard tests pass.
5. Verify all relative imports between moved files resolve correctly from new locations.

### Implementation notes

- Move all files in a single commit to avoid broken intermediate states.
- Update all import statements in `AssignmentsPage.tsx` and any other consumers.
- Verify no circular dependencies are introduced.

### Phase checks

- [ ] green implementation complete
- [ ] checks passed (tests + lint + type-check)
- [ ] action plan updated
- [ ] commit created
- [ ] push completed

---

## Phase 4 — Final verification and cleanup

### Objective

- Full regression test of the refactored code.
- Verify all behavioural contracts from SPEC.md are preserved.
- Clean up any temporary code or comments.
- Document the refactor in ACTION_PLAN.md.

### Constraints

- Run complete test suite for assignment-definition workflow.
- Verify against SPEC.md behavioural requirements.
- Do not introduce new features or behavioural changes.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md`
- `ACTION_PLAN.md` (Section 4)
- `WIZARD_REFACTOR_ACTION_PLAN.md`
- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-modal-patterns.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

Implementation mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md`
- `ACTION_PLAN.md` (Section 4)
- `WIZARD_REFACTOR_ACTION_PLAN.md`
- `docs/developer/frontend/frontend-modal-patterns.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md`
- `ACTION_PLAN.md` (Section 4)
- `WIZARD_REFACTOR_ACTION_PLAN.md`

### Acceptance criteria

- All 10 unit tests pass.
- All Playwright E2E tests for assignment-definition wizard pass.
- Frontend lint passes clean (no complexity violations <=7 in component file).
- Frontend type check passes clean.
- Manual verification of key workflows (smoke tests):
  - Create mode: parse and continue, then save
  - Update mode: document change + cancel restores URLs
  - Update mode: document change + re-parse refreshes tasks
  - Close with unsaved edits triggers discard confirmation
- ACTION_PLAN.md updated with refactor completion notes

### Required test cases/checks

1. Run `npm run frontend:test -- assignmentDefinitionWizard` — all 10 tests pass.
2. Run `npm run frontend:test:e2e` — all assignment-definition tests pass.
3. Run `npm run frontend:lint` — no complexity errors in `AssignmentDefinitionWizardModal.tsx` or `useAssignmentDefinitionWizard.ts` (all <=7).
4. Run `npm run frontend:type-check` — no errors.
5. Manual smoke test of create and update flows in development environment.

### Phase checks

- [ ] green implementation complete (cleanup)
- [ ] checks passed (full test suite + lint)
- [ ] manual smoke tests passed
- [ ] action plan updated (documentation)
- [ ] commit created
- [ ] push completed

---

## Rollback plan

If any phase fails and cannot be resolved within reasonable time:

1. Revert all changes from the failed phase.
2. Document the failure and blockers in this action plan.
3. Escalate to user for decision on alternative approach.

Each phase is designed to be independently revertible without affecting subsequent phases.

---

## File ownership summary

| File                                                                        | Purpose                       | Phase Introduced | Lines (est.) | Complexity Target |
| --------------------------------------------------------------------------- | ----------------------------- | ---------------- | ------------ | ----------------- |
| `pages/assignmentDefinitionWizard/AssignmentDefinitionWizardModal.tsx`      | Presenter component (UI only) | Phase 3          | ~150-200     | <=7               |
| `pages/assignmentDefinitionWizard/useAssignmentDefinitionWizard.ts`         | State, logic, handlers        | Phase 2          | ~300-350     | N/A (hook)        |
| `pages/assignmentDefinitionWizard/AssignmentDefinitionWizardModal.spec.tsx` | Unit tests (existing)         | Phase 3          | ~700         | N/A               |
| `pages/assignmentDefinitionWizard/AssignmentDefinitionWizardModalShell.tsx` | Shell component (existing)    | Phase 3          | ~80          | N/A               |

---

## Behavioural context reference

All refactoring must preserve the behavioural contracts defined in:

- `SPEC.md` — Product behaviour and data contracts
- `ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md` — UI layout and workflow states
- `ACTION_PLAN.md` Section 4 — Existing implementation and acceptance criteria

**Key behaviours to preserve:**

1. **Two-stage workflow:** Create mode requires parse-and-persist before task editing is available; update mode starts directly in edit surface
2. **Document change gating:** Changing document URLs after parse disables metadata/task editing until user resolves via re-parse or cancel
3. **Dirty state tracking:** Unsaved metadata/weighting edits disable document URL fields; closing with dirty edits requires discard confirmation
4. **Re-parse preservation:** Re-parsing after document change preserves matching task weightings and defaults new tasks to 1
5. **Loading states:** Shape-matched skeletons rendered during data loading; blocking errors fail closed with Alert
6. **Validation:** Parse requires title, topic, yearGroup, both URLs; save requires yearGroup selection
7. **Query cache:** Invalidate partials after parse/save; fetch refresh for AssignmentsPage table

---

## Resolution of planner-reviewer findings

The planner-reviewer identified several critical issues with the initial plan. This revised plan addresses all findings:

### 1. Missing mandatory documentation

**Finding:** `frontend-shared-helpers-and-abstraction-standards.md` was missing from Phases 3-5 mandatory reads.
**Resolution:** Added to all relevant phases (1-4). Also added `config/eslint/ts-base-rules.cjs` for complexity threshold reference.

### 2. Anti-pattern violation concern

**Finding:** Single-caller hook extraction may violate Section 5 anti-pattern.
**Resolution:** Added "Justification for Hook Extraction" section demonstrating precedent in codebase (`useClassesManagement.ts`, `useBackendSettings.ts`) and clarifying that the hook owns a coherent contract, not just renaming code.

### 3. Premature file relocation

**Finding:** Phase 2 (file relocation) was premature and added unnecessary risk.
**Resolution:** File relocation remains as Phase 3, occurring **after** complexity reduction and hook extraction are verified.

### 4. Unvalidated complexity target

**Finding:** No analysis showing component complexity can reach <=7.
**Resolution:** Added "Complexity Reduction Analysis" section with complexity budget table. Added explicit hook complexity target (<=7) via helper decomposition, following precedent pattern.

### 5. Inconsistent phase numbering

**Finding:** Phase 0 vs 1-based inconsistency with template.
**Resolution:** Simplified to Phase 1-4 (1-based) to match ACTION_PLAN.md convention.

### 6. Unnecessary helper extraction

**Finding:** Phase 5 (separate helpers file) may create unnecessary indirection for single-caller.
**Resolution:** Removed Phase 5. Helper functions remain in the hook file, following `useClassesManagement.ts` pattern of hook + internal helpers.

### 7. Missing lint config reference

**Finding:** No reference to source of <=7 threshold.
**Resolution:** Added explicit reference to `config/eslint/ts-base-rules.cjs` line 14: `'complexity': ['error', 7]`.

### 8. Ambiguous baseline complexity count

**Finding:** "5 complexity violations" was ambiguous.
**Resolution:** Clarified baseline as 5 lint errors across 4 functions (main component at line 109 contributes multiple errors). Added detailed table.

---

## Resolution of slop review findings

The slop review (SLOP_REVIEW.md) identified additional architectural gaps that have been incorporated:

### CF-001: False assumption about ESLint hook complexity checking

**Resolution:** Corrected analysis to acknowledge hooks are linted. Added explicit hook complexity target (<=7) and helper decomposition requirement.

### CF-002: God hook anti-pattern

**Resolution:** Updated Phase 2 to require hook + helper decomposition pattern (matching `useClassesManagement.ts` precedent). Added complexity budget for both component and hook.

### CF-003: Unnecessary file relocation

**Resolution:** File relocation retained per user request, but kept as separate Phase 3 after core refactor is verified.

### MF-004: Premature optimization in Phase 1

**Resolution:** Refocused Phase 1 on `hasAllParseFields` (10->3). Deferred `handleSave` simplification to Phase 2.

---

## Open questions for user

None. All findings have been addressed with concrete resolutions.

---

_Plan status: Ready for implementation_
_Last reviewed: By planner-reviewer subagent and slop review (SLOP_REVIEW.md)_
_All critical issues: Resolved (planner-reviewer findings 1-8 + slop review CF-001, CF-002, CF-003, MF-004)_
