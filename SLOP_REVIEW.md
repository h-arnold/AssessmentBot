# Slop Review: WIZARD_REFACTOR_ACTION_PLAN.md

**Review date:** 2025-01-20  
**Reviewer:** Mistral Vibe  
**Document under review:** WIZARD_REFACTOR_ACTION_PLAN.md  
**Scope:** Planned refactor of AssignmentDefinitionWizardModal.tsx to reduce cyclomatic complexity from 37 to <=7

**Status:** SUPERSEDED — All critical and major findings have been incorporated into WIZARD_REFACTOR_ACTION_PLAN.md. This document is retained for audit purposes only.

---

## Executive Summary

This slop review identified **one critical false assumption**, **three major structural issues**, and **multiple minor optimizations** in the WIZARD_REFACTOR_ACTION_PLAN.md. The most serious finding was that the plan incorrectly assumed hooks are exempt from ESLint complexity checking, which would cause the extracted hook to fail lint even after the refactor.

**Resolution:** All critical findings (CF-001, CF-002, CF-003) and selected major finding (MF-004) have been addressed in the updated WIZARD_REFACTOR_ACTION_PLAN.md. The remaining de-sloppification findings (document verbosity) were explicitly deprecated by user decision.

**Effort impact:** Addressed findings prevent rework and maintain implementation efficiency.

---

## Resolution Status

| Finding ID | Status      | Resolution                                                                       |
| ---------- | ----------- | -------------------------------------------------------------------------------- |
| CF-001     | ✅ RESOLVED | Added explicit hook complexity target (<=7) and helper decomposition requirement |
| CF-002     | ✅ RESOLVED | Updated Phase 2 to require hook + helper decomposition pattern                   |
| CF-003     | ✅ RESOLVED | File relocation retained per user request as Phase 3                             |
| CF-004     | N/A         | User deprecated de-sloppification findings                                       |
| MF-001     | N/A         | User deprecated de-sloppification findings                                       |
| MF-002     | N/A         | User deprecated de-sloppification findings                                       |
| MF-003     | N/A         | User deprecated de-sloppification findings                                       |
| MF-004     | ✅ RESOLVED | Phase 1 refocused on `hasAllParseFields` (10→3)                                  |

---

---

## Legend

| Severity | Icon | Meaning                                          |
| -------- | ---- | ------------------------------------------------ |
| Critical | ❌   | Must fix before implementation; blocks success   |
| Major    | ⚠️   | Should fix; significant effort or risk reduction |
| Minor    | ℹ️   | Nice to fix; cosmetic or small improvements      |

---

## Critical Findings (Must Fix)

### ❌ CF-001: False assumption about ESLint hook complexity checking

**Location:** Complexity Reduction Analysis section, "How extraction achieves targets" point 3  
**Problem:**

The plan states: _"Moving this logic to the hook means the **component** no longer contains this `useEffect`, so its complexity score drops. The hook's internal complexity is not measured by ESLint."_

This is **factually incorrect**. Hooks **are** linted for complexity. Running `npm run frontend:lint` against the codebase shows that `useClassesManagement.ts` (308 lines) and other hooks are subject to the same `complexity: ['error', 7]` rule defined in `config/eslint/ts-base-rules.cjs` line 14.

**Evidence:**

- `config/eslint/ts-base-rules.cjs:14` defines `complexity: ['error', 7]` for all files
- `useClassesManagement.ts` passes lint because it delegates complex logic to separate helper functions (`getReadyClassesQueryState`, `createClassesQueriesState`, etc.), not because hooks are exempt
- The extracted `useAssignmentDefinitionWizard.ts` will inherit all complexity from moved logic and **will fail lint** unless that logic is properly decomposed

**Impact:**

- The extracted hook will have complexity violations (likely >7 for the main hook function)
- Phase 4 acceptance criterion "Frontend lint passes clean" will fail
- Requires rework after Phase 2 implementation

**Simplification:**

1. **Correct the assumption:** Acknowledge that hooks are linted for complexity
2. **Add hook complexity target:** `useAssignmentDefinitionWizard.ts` main function must be <=7 complexity
3. **Adopt precedent pattern:** Follow `useClassesManagement.ts` structure — hook contains simple orchestration, complex logic lives in separate helper functions
4. **Update analysis:** Show how both component AND hook will achieve <=7 complexity via helper decomposition

**Recommended replacement text for Complexity Reduction Analysis:**

```markdown
**How extraction achieves targets:**

1. **`hasAllParseFields` (10 -> ~3):** Replace chained boolean conditions with `Array.every()` pattern.
2. **`handleSave` (8 -> ~5):** Extract request-building logic to helper function.
3. **Dirty state `useEffect` (19 -> N/A):** This complexity moves to the hook. The **hook** must delegate to helper functions to achieve <=7 complexity, following the precedent of `useClassesManagement.ts`.
4. **Main component (37 -> <=7):** After extracting queries, state, and handlers to the hook, the component retains only hook invocation, JSX rendering, and event wiring (~5-6 complexity).
5. **Hook complexity (<=7):** The hook itself must be decomposed into helper functions. Complex logic (e.g., dirty state calculation, request building) must live in separate helpers called by the hook.

**Complexity threshold source:** `config/eslint/ts-base-rules.cjs` line 14: `'complexity': ['error', 7]` (applies to ALL files, including hooks)
```

---

### ❌ CF-002: God hook anti-pattern — over-extraction creates new complexity

**Location:** Phase 2 Acceptance Criteria  
**Problem:**

The plan proposes extracting **everything** into `useAssignmentDefinitionWizard.ts`:

- All `useQuery` calls (3 queries)
- `useMutation` for upsert
- All state variables (8: `hasParsedTasks`, `taskRows`, `isSubmitting`, `blockingError`, `hasDirtyEdits`, `documentChange`, `showDiscardConfirm`, plus form state)
- All handler functions (10: `handleFormValuesChange`, `handleParseAndContinue`, `handleSave`, `handleReparse`, `handleReparseCancel`, `handleClose`, `handleDiscardConfirm`, `handleKeepEditing`, `handleTaskWeightingChange`, `handlePrimaryAction`)
- All helper functions (3: `buildCanonicalUrl`, `hasAllParseFields`, `hasYearGroupSelected`)

This creates a "god hook" — a single file containing all logic, state, and side effects. The hook would be 400-500 lines with high internal complexity, violating the very principle it aims to solve.

**Evidence:**

- The precedents cited (`useClassesManagement.ts` at 308 lines, `useBackendSettings.ts` at 409 lines) pass lint because they **delegate** complex logic to helper functions, not because they absorb all complexity
- `useClassesManagement.ts` exports a single function (`useClassesManagement`) but depends on 8+ helper functions defined in the same file (`toLabelsByKey`, `getReadyClassesQueryState`, `createClassesQueriesState`, etc.)
- Complex handlers like dirty state tracking would remain complex even after moving to the hook

**Impact:**

- Hook will have complexity violations
- Creates an indirection layer without actual simplification
- Makes the code harder to understand (logic is now split across files but still complex)
- Violates the KISS principle from AGENTS.md Section 3.1

**Simplification:**

Adopt a **narrow hook contract** pattern:

```markdown
useAssignmentDefinitionWizard.ts structure:
├── Hook (exported function, <=7 complexity)
│ ├── Query orchestration (useQuery, useMutation)
│ ├── Core state management
│ └── Simple handler delegation
│
└── Helper functions (separate, testable)
├── buildCanonicalUrl
├── hasAllParseFields (simplified with Array.every())
├── hasYearGroupSelected
├── buildSaveRequest
├── calculateDirtyState
└── buildReparseRequest
```

The hook should **orchestrate**, not **absorb**. Complex logic stays in helpers.

**Recommended Phase 2 acceptance criteria change:**

```markdown
- `useAssignmentDefinitionWizard.ts` exists with:
  - All `useQuery` calls (topics, yearGroups, definition)
  - `useMutation` for upsert
  - Core state: form state, hasParsedTasks, taskRows, isSubmitting, blockingError
  - Simple handlers that delegate to helper functions
  - **NOT** complex logic directly in the hook body
- Component complexity reduced to <=7
- **Hook complexity also <=7** (via helper decomposition)
```

---

### ❌ CF-003: Unnecessary file relocation phase adds risk without benefit

**Location:** Phase 3 — File relocation and import updates  
**Problem:**

Phase 3 proposes moving files to a new directory structure:

- `AssignmentDefinitionWizardModal.tsx` → `pages/assignmentDefinitionWizard/`
- `AssignmentDefinitionWizardModal.spec.tsx` → `pages/assignmentDefinitionWizard/`
- `AssignmentDefinitionWizardModalShell.tsx` → `pages/assignmentDefinitionWizard/`
- `useAssignmentDefinitionWizard.ts` → `pages/assignmentDefinitionWizard/`
- Update import paths in `AssignmentsPage.tsx`

This is **purely organizational churn** with no functional benefit. The existing file locations work correctly, and the refactor's goals (complexity reduction, hook extraction) can be achieved without moving files.

**Evidence:**

- No user-facing change results from file relocation
- No technical debt is addressed by moving files
- The plan's own scope (Section "Scope and assumptions") doesn't mention file organization as a goal
- The modal patterns document (`frontend-modal-patterns.md` Section 3.4) doesn't require a specific directory structure

**Impact:**

- Risk of broken imports during move
- Requires updating `AssignmentsPage.tsx` and potentially other consumers
- Creates a commit that could introduce errors
- Delays the actual refactor work
- Violates "keep changes minimal" from AGENTS.md Section 3.9

**Simplification:**

**Remove Phase 3 entirely.**

File relocation can be done later as a separate, low-risk organizational task if desired. The refactor's value comes from complexity reduction and hook extraction, not file structure.

If file organization is truly important, it should be a separate action plan with its own justification, not bundled with a complexity refactor.

**Recommended Phase structure:**

```markdown
Phase 1: Helper function simplification
Phase 2: Hook extraction (in current location)
Phase 3: Final verification and cleanup
```

---

## Major Findings (Should Fix)

### ⚠️ MF-001: Duplicate mandatory reads lists bloat the plan

**Location:** All phase sections (Phases 1-4)  
**Problem:**

Each phase contains a "Delegation mandatory reads" subsection that repeats nearly identical lists of documentation files. The lists are:

- 6-10 items per phase
- Repeated across 4 phases
- ~25-40 lines per phase
- Total duplication: ~200+ lines

The lists are nearly identical, with minor variations (e.g., Phase 1 doesn't include `ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md` but Phase 2 does).

**Evidence:**

- Phase 1 Testing Specialist: 7 docs
- Phase 1 Implementation: 6 docs
- Phase 1 Code Reviewer: 5 docs
- Phase 2 Testing Specialist: 10 docs
- Phase 2 Implementation: 9 docs
- Phase 2 Code Reviewer: 6 docs
- (and so on for Phases 3-4)

**Impact:**

- Makes the plan harder to read and maintain
- Increases risk of inconsistencies between phases
- Violates DRY principle
- Adds cognitive overhead for reviewers

**Simplification:**

Create a **shared mandatory reads registry** at the top of the document, then reference it by name in each phase:

````markdown
## Shared Delegation Mandatory Reads

### Core (required for all phases)

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md` (Section 4)
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

### Modal-specific (required for all phases)

- `ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md`
- `docs/developer/frontend/frontend-modal-patterns.md`

### Testing-specific

- `docs/developer/frontend/frontend-testing.md`

### Lint-specific

- `config/eslint/ts-base-rules.cjs`

### React Query-specific

- `docs/developer/frontend/frontend-react-query-and-prefetch.md`

---

Then in each phase:

```markdown
### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- All Core
- All Modal-specific
- Testing-specific

Implementation mandatory docs:

- All Core
- All Modal-specific
- Lint-specific

Code Reviewer mandatory docs:

- All Core
- All Modal-specific
```
````

````

This reduces ~200 lines to ~50 lines while improving clarity.

---

### ⚠️ MF-002: Over-specified and repetitive phase checklists

**Location:** All phase sections ("Phase checks")
**Problem:**

Every phase includes an identical 8-item checklist:
- [ ] red tests added
- [ ] red review clean
- [ ] green implementation complete
- [ ] green review clean
- [ ] checks passed
- [ ] action plan updated
- [ ] commit created
- [ ] push completed

However, many items are marked "N/A" in the checklists, indicating they don't apply to that phase. Phase 1 has "N/A - no new tests needed" for red tests, Phase 2 has the same, etc.

**Evidence:**
- Phase 1: "red tests added (N/A - no new tests needed)"
- Phase 2: "red tests added (N/A - no new tests needed)"
- Phase 3: "red tests added (N/A - no new tests needed)"
- Phase 4: "red tests added (N/A)"

**Impact:**
- Checklist doesn't reflect actual phase requirements
- "N/A" items clutter the checklist
- Reduces the value of the checklist as a tracking tool

**Simplification:**

Customize checklists per phase to only include applicable items:

**Phase 1 (Helper simplification):**
```markdown
### Phase checks
- [ ] green implementation complete
- [ ] green review clean
- [ ] checks passed (tests + lint)
- [ ] action plan updated
- [ ] commit created
- [ ] push completed
````

**Phase 2 (Hook extraction):**

```markdown
### Phase checks

- [ ] red tests added (if new hook tests needed)
- [ ] red review clean
- [ ] green implementation complete
- [ ] green review clean
- [ ] checks passed (tests + lint + type-check)
- [ ] action plan updated
- [ ] commit created
- [ ] push completed
```

**Phase 3 (Removed):** N/A

**Phase 4 (Final verification):**

```markdown
### Phase checks

- [ ] green implementation complete (cleanup)
- [ ] checks passed (full test suite + lint)
- [ ] manual smoke tests passed
- [ ] action plan updated (documentation)
- [ ] commit created
- [ ] push completed
```

---

### ⚠️ MF-003: Overly defensive hook extraction justification

**Location:** Justification for Hook Extraction section  
**Problem:**

The "Justification for Hook Extraction" section is 15+ lines of defensive reasoning addressing a planner-reviewer concern about the single-caller anti-pattern. It:

- Restates the concern at length
- Lists precedents (`useClassesManagement.ts`, `useBackendSettings.ts`)
- Explains why this case is different
- Explicitly addresses the anti-pattern rule

While the reasoning is sound, the length is unnecessary for a plan document. The precedents speak for themselves.

**Evidence:**

- The section is longer than the actual phase descriptions
- The concern it addresses (planner-reviewer finding) is already resolved in the "Resolution of planner-reviewer findings" section
- The justifications are repeated in the Shared-helper planning gate section

**Impact:**

- Adds unnecessary verbosity to the plan
- Makes the document harder to scan
- Duplicates information

**Simplification:**

Replace the entire section with:

```markdown
## Justification for Hook Extraction

This refactor follows the established precedent of single-caller, feature-local hooks that own coherent contracts: `useClassesManagement.ts` (used by ClassesManagementPanel.tsx) and `useBackendSettings.ts` (used by BackendSettingsPanel.tsx). The hook owns the wizard state and lifecycle contract, satisfying `src/frontend/AGENTS.md` Section 2.2.
```

Or even simpler, move this to a single sentence in the Scope section:

```markdown
- Extract state management and side effects into a feature-local custom hook following precedent (`useClassesManagement.ts`, `useBackendSettings.ts`).
```

---

### ⚠️ MF-004: Premature optimization in Phase 1

**Location:** Phase 1 — Quick wins: Helper function simplification  
**Problem:**

Phase 1 targets `handleSave` (complexity 8 → 7) as a "quick win," but this is premature optimization. The function is only 1 point over the threshold, and reducing it may not be straightforward.

Meanwhile, the component has much larger complexity violations that should be prioritized:

- Main component: 37 (needs -30)
- Dirty state useEffect: 19 (needs -12)

**Evidence:**

- Phase 1 acceptance criteria: "`handleSave` complexity reduced from 8 to <=7"
- Phase 1 implementation notes focus on extracting `buildSaveRequest()`
- The baseline table shows bigger violations exist

**Impact:**

- Focuses effort on small wins instead of big problems
- May not actually achieve the complexity reduction (extracting one helper from an 8-complexity function may not reduce it to <=7)
- Delays addressing the real problems

**Simplification:**

Refocus Phase 1 on the **highest-impact, easiest wins**:

```markdown
### Acceptance criteria

- `hasAllParseFields` complexity reduced from 10 to <=3 (Array.every() pattern)
- All 10 existing unit tests pass without modification
- No new files created

### Required test cases/checks

1. `hasAllParseFields` uses `Array.every()` pattern
2. Run `npm run frontend:test -- AssignmentDefinitionWizardModal.spec.tsx` — all 10 tests pass
3. Run `npm run frontend:lint -- AssignmentDefinitionWizardModal.tsx` — complexity errors reduced from 5 to 4 (hasAllParseFields fixed)
```

Defer `handleSave` simplification to Phase 2 or 3, where it can be addressed as part of the broader hook extraction and decomposition.

---

## Minor Findings (Nice to Fix)

### ℹ️ mf-001: Redundant "Resolution of planner-reviewer findings" section

**Location:** Resolution of planner-reviewer findings section  
**Problem:**

This section documents 8 resolved findings from the planner-reviewer. However, most of these resolutions are already incorporated into the plan itself. The section:

- Restates changes that are already visible in the revised plan
- Adds ~40 lines of text
- Doesn't provide new information

**Simplification:**

- Remove the section entirely, OR
- Condense to a single paragraph: "All planner-reviewer findings have been addressed: documentation added, anti-pattern concern resolved with precedent justification, phase ordering corrected, complexity analysis added."

---

### ℹ️ mf-002: Duplicate baseline complexity documentation

**Location:** Complexity Reduction Analysis section  
**Problem:**

The baseline complexity table duplicates information already present in `ACTION_PLAN.md` Section 4 (Known Technical Debt table). This creates a maintenance burden — if the baseline changes, it must be updated in two places.

**Simplification:**

Replace the table with a reference:

```markdown
**Baseline (from ACTION_PLAN.md Section 4):**

| File                                                                               | Line | Function | Current | Target |
| ---------------------------------------------------------------------------------- | ---- | -------- | ------- | ------ |
| See ACTION_PLAN.md Section 4 for the authoritative baseline complexity violations. |

**How extraction achieves targets:**
[... rest of analysis ...]
```

Or keep the table but add a note: "Source: ACTION_PLAN.md Section 4 — keep synchronized."

---

### ℹ️ mf-003: Inconsistent "N/A" formatting

**Location:** Multiple phase sections  
**Problem:**

The plan uses inconsistent formatting for "not applicable" items:

- "N/A - no new tests needed"
- "N/A"
- "(N/A - no new tests needed)"
- "N/A - no new tests needed"

**Simplification:**

Standardize on one format. Recommended: "N/A — no new tests needed" (with em dash for consistency with British English standards).

---

### ℹ️ mf-004: Repetitive "red tests added" pattern

**Location:** All phase checklists  
**Problem:**

The phrase "red tests added (N/A - no new tests needed)" appears in multiple phases. This is repetitive and could be standardized.

**Simplification:**

For phases with no new tests: Omit the item entirely (customize checklists per phase, as recommended in MF-002).

---

### ℹ️ mf-005: Over-specified validation commands in each phase

**Location:** All phase sections  
**Problem:**

Each phase includes a "Validation commands hierarchy" that repeats the same commands. This is redundant with the global validation commands at the top of the document.

**Simplification:**

Remove the "Validation commands hierarchy" from individual phases. Keep only the global one at the top of the document.

---

## Structural Recommendations

### SR-001: Revised Extraction Strategy

**Current approach:** Extract everything into one hook.

**Recommended approach:** Decompose into hook + helpers:

```
AssignmentDefinitionWizardModal.tsx (presenter, <=7 complexity)
├── Consumes: useAssignmentDefinitionWizard()
│
useAssignmentDefinitionWizard.ts (orchestrator, <=7 complexity)
├── Queries: topics, yearGroups, definition
├── Mutations: upsert
├── State: hasParsedTasks, taskRows, isSubmitting, blockingError, hasDirtyEdits, documentChange
├── Simple handlers (delegate to helpers)
│
└── Helper functions (separate, each <=7 complexity)
    ├── buildCanonicalUrl
    ├── hasAllParseFields (Array.every() pattern)
    ├── hasYearGroupSelected
    ├── buildSaveRequest
    ├── buildReparseRequest
    ├── calculateDirtyState
    └── validateParseFields
```

**Benefits:**

- Hook stays simple and testable
- Each helper can be tested independently
- Complexity violations are isolated to specific helpers
- Matches the precedent pattern (`useClassesManagement.ts` uses helper functions)

---

### SR-002: Revised Phase Structure

**Current:**

1. Helper simplification
2. Hook extraction
3. File relocation
4. Final verification

**Recommended:**

1. **Helper simplification** — Fix `hasAllParseFields` (10→3)
2. **Hook extraction + decomposition** — Extract hook AND decompose complex logic into helpers
3. **Final verification** — Full regression test

**Key changes:**

- Remove Phase 3 (file relocation)
- Merge complexity reduction into Phase 2 (can't extract hook without also reducing its complexity)
- Add explicit hook complexity target to Phase 2

---

### SR-003: Add Explicit Complexity Budget

**Problem:** The plan has complexity targets for the component but not for the hook.

**Solution:** Add a complexity budget section:

```markdown
## Complexity Budget

| File                                | Current | Target | Owner                      |
| ----------------------------------- | ------- | ------ | -------------------------- |
| AssignmentDefinitionWizardModal.tsx | 37      | <=7    | Component (presenter only) |
| useAssignmentDefinitionWizard.ts    | N/A     | <=7    | Hook (orchestrator only)   |
| hasAllParseFields                   | 10      | <=3    | Helper function            |
| handleSave                          | 8       | <=7    | Helper function            |
| Dirty state useEffect               | 19      | <=7    | Helper function(s)         |

**Total new complexity:** Distributed across helpers, each <=7
```

---

### SR-004: Add Rollback Criteria for Hook

**Problem:** No criteria for determining if the hook extraction is successful.

**Solution:** Add to Phase 2 acceptance criteria:

```markdown
- Hook file size <= 400 lines
- Hook main function complexity <=7
- All helper functions complexity <=7
- No circular dependencies introduced
```

---

## Validation Gaps

| Gap    | Description                              | Risk                                           | Mitigation                                                                                                        |
| ------ | ---------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| VG-001 | No verification that hook will pass lint | Hook may have complexity violations            | Add explicit hook complexity target and helper decomposition requirement                                          |
| VG-002 | No precedent pattern audit               | May not match `useClassesManagement` structure | Require code review to verify hook follows precedent pattern before merge                                         |
| VG-003 | No size limit for hook                   | Hook could become unmanageable                 | Add explicit line limit (400 lines max)                                                                           |
| VG-004 | No circular dependency check             | Could break build                              | Add to Phase 2 acceptance criteria                                                                                |
| VG-005 | No hook test coverage plan               | Hook logic may be untested                     | Clarify: existing component tests cover hook behavior through integration; add hook-specific unit tests if needed |

---

## Estimated Impact

### Effort Reduction

| Change                      | Current Effort            | Revised Effort             | Savings                   |
| --------------------------- | ------------------------- | -------------------------- | ------------------------- |
| Phase count                 | 4 phases                  | 3 phases                   | 1 phase                   |
| File moves                  | 4 files relocated         | 0 files relocated          | 4 file moves              |
| Mandatory reads maintenance | ~200 lines                | ~50 lines                  | 150 lines                 |
| Hook complexity management  | Not planned (rework risk) | Explicit (prevents rework) | 1 rework cycle            |
| **Total**                   | ~4 phases, rework risk    | ~3 phases, no rework       | **~30% effort reduction** |

### Risk Reduction

| Risk                                | Current              | Revised                |
| ----------------------------------- | -------------------- | ---------------------- |
| Broken imports from file relocation | Medium               | None (Phase 3 removed) |
| Hook complexity violations          | High (unplanned)     | Low (explicit target)  |
| Plan maintenance overhead           | Medium (duplication) | Low (DRY)              |
| Implementation confusion            | Medium (god hook)    | Low (narrow contract)  |

---

## Recommendations Summary

### Must Do (Blocks Success)

1. ✅ **Fix CF-001:** Correct the false assumption about hook linting; add explicit hook complexity target
2. ✅ **Fix CF-002:** Adopt narrow hook contract with helper decomposition pattern
3. ✅ **Fix CF-003:** Remove Phase 3 (file relocation)

### Should Do (Significant Benefit)

1. ✅ **Fix MF-001:** Consolidate mandatory reads lists
2. ✅ **Fix MF-002:** Customize phase checklists
3. ✅ **Fix MF-003:** Shorten hook extraction justification
4. ✅ **Fix MF-004:** Refocus Phase 1 on high-impact wins

### Nice to Do (Improves Quality)

1. ✅ **Fix mf-001:** Remove or condense planner-reviewer findings resolution
2. ✅ **Fix mf-002:** Reference ACTION_PLAN.md for baseline instead of duplicating
3. ✅ **Fix mf-003:** Standardize "N/A" formatting
4. ✅ **Fix mf-004:** Remove repetitive validation commands

### Structural

1. ✅ **Implement SR-001:** Revised extraction strategy (hook + helpers)
2. ✅ **Implement SR-002:** Revised phase structure (3 phases)
3. ✅ **Implement SR-003:** Add explicit complexity budget
4. ✅ **Implement SR-004:** Add rollback criteria for hook

---

## Conclusion

The WIZARD_REFACTOR_ACTION_PLAN.md contains **critical flaws** that would prevent the refactor from achieving its goals. The false assumption about hook linting (CF-001) is the most serious, as it would cause the extracted hook to fail lint checks. The god hook anti-pattern (CF-002) and unnecessary file relocation (CF-003) add significant risk and effort without benefit.

Addressing these findings would:

- Prevent rework by establishing correct complexity assumptions
- Reduce implementation effort by ~30%
- Lower risk by removing unnecessary file moves
- Improve plan maintainability by eliminating duplication

**Recommendation:** Revise the plan to incorporate the critical fixes (CF-001, CF-002, CF-003) before beginning implementation. The major and minor findings can be addressed during plan refinement or as part of implementation.

---

_Review conducted by: Mistral Vibe_  
_Document: SLOP_REVIEW.md_  
_Status: Ready for user review_
