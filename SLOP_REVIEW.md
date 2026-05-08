# Slop Review: feat/CreateAssessmentModal Branch

**Review Date:** 2025-01-20  
**Reviewer:** De-Sloppification Agent  
**Branch:** `feat/CreateAssessmentModal`  
**Baseline Branch:** `feat/ReactFrontend`  
**Status:** **BLOCKED** - Critical dead code must be removed before merge

---

## Executive Summary

This de-sloppification review covers all code changes between `feat/ReactFrontend` and `feat/CreateAssessmentModal` (HEAD: d22131f). The review identifies **1 critical blocking issue** (dead code), **2 improvement issues** (over-extracted helpers), and **1 nitpick** (cargo-cult comments).

**Overall Verdict:** **FAIL** - Blocking issues prevent merge.

The branch introduces functional changes to the assignment definition wizard, assignments page, and backend controllers. The core feature implementation follows React + Ant Design patterns correctly and complies with SPEC.md and ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md specifications. However, **critical dead code** exists that violates canonical frontend abstraction standards, representing classic AI-slop (scaffolding created but never integrated).

**No new slop** was introduced beyond what was identified in CODE_REVIEW.md. All findings from the previous review remain relevant and unaddressed.

---

## Review Scope

### Files Analysed

**Production Code (New/Modified):**

- `src/frontend/src/query/upsertAssignmentDefinitionMutation.ts` - **DEAD CODE**
- `src/frontend/src/pages/useAssignmentDefinitionWizard.ts` - Over-extracted helpers
- `src/frontend/src/pages/AssignmentsPage.tsx` - Over-extracted helper chain
- `src/frontend/src/pages/AssignmentDefinitionWizardModal.tsx` - ✅ Clean
- `src/frontend/src/pages/AssignmentDefinitionWizardModalShell.tsx` - ✅ Clean
- `src/frontend/src/errors/map-error-to-ui.ts` - ✅ Clean (actually used)
- `src/frontend/src/services/assignmentDefinitionService.ts` - ✅ Clean
- `src/frontend/src/services/assignmentTopicsService.ts` - ✅ Clean
- `src/frontend/src/services/*zod.ts` files - ✅ Clean
- `src/backend/Assessors/0_SpreadsheetFormulaEquivalence.js` - ✅ Clean (actually used)
- Backend API and controller files - ✅ Clean

**Test Files (New/Modified):**

- `src/frontend/src/query/upsertAssignmentDefinitionMutation.query.spec.ts` - **DEAD CODE** (tests dead code)
- All other test files - ✅ Clean (test production code that exists)

---

## 🔴 Critical Findings (MUST FIX - Blocking)

### SLOP-001: Dead Code - upsertAssignmentDefinitionMutation.ts and its test

**Severity:** 🔴 **CRITICAL** (Blocker)  
**Status:** UNRESOLVED (from CODE_REVIEW.md CR-001)  
**Location:**

- `src/frontend/src/query/upsertAssignmentDefinitionMutation.ts` (entire file, 38 lines)
- `src/frontend/src/query/upsertAssignmentDefinitionMutation.query.spec.ts` (entire file, 83 lines)

**Evidence:**

```bash
# Verification command
$ grep -r "upsertAssignmentDefinitionMutation" src/frontend/src --include="*.ts" --include="*.tsx" | grep -v "\.spec\."
# Result: No production imports found (only reference is in its own test file)
```

- **Zero production imports** - Verified via exhaustive search
- **Only referenced by its own test file** (line 15 of the test file)
- **Duplicates logic** already implemented in `useAssignmentDefinitionWizard.ts` lines 837-848 (`invalidateMutationQueries` function)
- Both implementations perform identical cache invalidation:
  ```typescript
  await queryClient.invalidateQueries({ queryKey: queryKeys.assignmentDefinitionPartials() });
  await queryClient.invalidateQueries({
    queryKey: queryKeys.assignmentDefinitionByKey(definitionKey),
  });
  ```

**Policy Violations:**

| Document                                                                       | Rule | Impact                                                                            |
| ------------------------------------------------------------------------------ | ---- | --------------------------------------------------------------------------------- |
| `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` | §4.1 | Keep logic local when there is one call site and no clear independent contract    |
| `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` | §5.1 | Reject single-caller wrapper extraction that does not own an independent contract |

**Root Cause:** Classic AI-slop - scaffolding created during implementation but never wired into the actual codebase. The developer extracted this as a shared utility but the logic was instead kept local to the hook.

**Required Action:**

```bash
# Delete both dead code files
git rm src/frontend/src/query/upsertAssignmentDefinitionMutation.ts
git rm src/frontend/src/query/upsertAssignmentDefinitionMutation.query.spec.ts
```

**Blocker Status:** **YES** - Must be resolved before merge. This is a canonical policy violation.

---

## 🟡 Improvement Findings (SHOULD FIX)

### SLOP-002: Over-Extracted Single-Caller Helper Chain in AssignmentsPage.tsx

**Severity:** 🟡 **IMPROVEMENT**  
**Status:** UNRESOLVED (from CODE_REVIEW.md CR-002)  
**Location:** `src/frontend/src/pages/AssignmentsPage.tsx` lines 239-310

**Evidence:**

- `shouldRenderAssignmentsBlockingState` (line 239) → used only by `getAssignmentsSurfaceState` (line 276)
- `getAssignmentsSurfaceState` (line 265) → used only at line 720 in component body
- `isAssignmentsSurfaceBusyState` (line 301) → used only at line 730 in component body

**Issue:** Creates a chain of single-caller helpers, each adding an indirection layer without removing duplication. This violates the principle that extraction should only occur when it removes proven duplication across multiple real call sites.

**Policy Violation:** `frontend-shared-helpers-and-abstraction-standards.md §4.1` - "extraction would only rename existing code without removing duplication"

**Recommended Action:**

- **Inline** `shouldRenderAssignmentsBlockingState` directly into `getAssignmentsSurfaceState` (its sole caller)
- **Consider keeping** `getAssignmentsSurfaceState` and `isAssignmentsSurfaceBusyState` as they encapsulate complex boolean logic that improves readability
- Decision should be based on whether the readability benefit outweighs the indirection cost

**Note:** This is a judgment call. The helpers do improve code clarity for complex conditional logic, but strictly speaking, they don't meet the duplication threshold for extraction.

---

### SLOP-003: Single-Caller Helper Functions in useAssignmentDefinitionWizard.ts

**Severity:** 🟡 **IMPROVEMENT**  
**Status:** UNRESOLVED (from CODE_REVIEW.md CR-003)  
**Location:** `src/frontend/src/pages/useAssignmentDefinitionWizard.ts`

**Evidence - Single-use helpers:**

| Function                   | Line | Used At           | Complexity          |
| -------------------------- | ---- | ----------------- | ------------------- |
| `hasAllParseFields`        | 340  | 147               | Trivial (one-liner) |
| `hasYearGroupSelected`     | 350  | 148               | Trivial (one-liner) |
| `buildTopicOptions`        | 314  | 685 (via useMemo) | Trivial (one-liner) |
| `buildYearGroupOptions`    | 327  | 686 (via useMemo) | Trivial (one-liner) |
| `deriveReferenceDataState` | 104  | 683               | Non-trivial         |
| `derivePrimaryActionState` | 138  | 692               | Non-trivial         |

**Issue:** Six helper functions each used exactly once. Four are trivial one-liners that don't justify extraction. Two encapsulate non-trivial logic.

**Policy Violation:** `frontend-shared-helpers-and-abstraction-standards.md §4.1`

**Recommended Action:**

- **Inline immediately:** `hasAllParseFields`, `hasYearGroupSelected`, `buildTopicOptions`, `buildYearGroupOptions`
- **Keep for now:** `deriveReferenceDataState`, `derivePrimaryActionState` (encapsulate non-trivial logic, plausible future callers)

**Rationale:** The trivial helpers add cognitive overhead without benefit. The non-trivial ones may gain additional callers in future development and improve readability.

---

## ⚪ Nitpick Findings (Nice to Fix)

### SLOP-004: Cargo-Cult Comment Pattern

**Severity:** ⚪ **NITPICK**  
**Status:** UNRESOLVED (from CODE_REVIEW.md CR-004)  
**Locations:**

- `src/frontend/src/query/upsertAssignmentDefinitionMutation.ts` lines 18-20 (to be deleted with SLOP-001)
- `src/frontend/src/query/upsertAssignmentDefinitionMutation.query.spec.ts` lines 7-9, 37-39, 74-77 (to be deleted with SLOP-001)
- `src/frontend/src/pages/useAssignmentDefinitionWizard.ts` line 837

**Evidence:** All contain near-identical explanatory text:

```typescript
// Per frontend-react-query-and-prefetch.md §7, we use invalidateQueries only.
// Active useQuery observers will automatically refetch in the background,
// and any errors will properly propagate to their isError state.
```

**Issue:** Suggests copy-paste documentation rather than organic, context-specific explanation. This is a telltale sign of generated code.

**Recommended Action:**

- Keep the canonical instance in `useAssignmentDefinitionWizard.ts` line 837 (where the logic is actually used)
- Remove from `upsertAssignmentDefinitionMutation.ts` (will be deleted anyway with SLOP-001)
- Remove from `upsertAssignmentDefinitionMutation.query.spec.ts` (will be deleted anyway with SLOP-001)

---

## Status of Previous Review Findings

### From CODE_REVIEW.md

| Finding ID | Status             | Resolution                                                            |
| ---------- | ------------------ | --------------------------------------------------------------------- |
| CR-001     | ❌ **STILL VALID** | Dead code files still exist and must be deleted                       |
| CR-002     | ⚠️ **STILL VALID** | Over-extracted helper chain in AssignmentsPage.tsx still exists       |
| CR-003     | ⚠️ **STILL VALID** | Single-caller helpers in useAssignmentDefinitionWizard.ts still exist |
| CR-004     | ℹ️ **STILL VALID** | Cargo-cult comments still exist                                       |

### From SLOP_REVIEW.md

All findings in SLOP_REVIEW.md relate to `WIZARD_REFACTOR_ACTION_PLAN.md` which is a **planning document**, not production code. These findings are **SUPERSEDED** and **NOT RELEVANT** to the current code review of `feat/CreateAssessmentModal` branch changes.

---

## Compliance Verification

### SPEC.md Compliance

**Status:** ✅ **COMPLIANT**

The implementation in `useAssignmentDefinitionWizard.ts` correctly implements the SPEC.md requirements:

- ✅ Two-stage flow: Stage 1 validates and parses documents, Stage 2 allows metadata/task weighting edits
- ✅ Creation persists twice: once after successful parse (stage-one), once after final save
- ✅ Stage-one create persists with defaulted weighting values
- ✅ `primaryTopic` and `yearGroup` are dropdown-only fields backed by reference-data collections
- ✅ Document changes require explicit re-parse action
- ✅ If user cancels re-parse prompt, document URL fields revert to previously persisted values
- ✅ `assignmentWeighting` and `taskWeighting` default to 1, accept values 0-10 inclusive
- ✅ `upsertAssignmentDefinition` is the single write transport for all operations
- ✅ Duplicate detection applies at every upsert call that creates/changes (normalised primaryTitle, primaryTopicKey, yearGroupKey)

### ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md Compliance

**Status:** ✅ **COMPLIANT**

The implementation correctly follows the layout specification:

- ✅ Uses Ant Design `Modal` component for the wizard
- ✅ Uses Ant Design `Form` for document URL inputs, metadata fields, and weighting inputs
- ✅ Uses Ant Design `Alert` for blocking local errors and re-parse required states
- ✅ Uses Ant Design `Flex` and `Space` for layout
- ✅ No extra navigation layers (no nested tabs, nested routes, or stepper-style navigation)
- ✅ Modal uses custom footer with explicit `Cancel` and primary action buttons
- ✅ Document-change resolution is visible inside the modal
- ✅ Task-weighting region uses `Table` component
- ✅ Modal body scrolls within approved wide-data modal width

---

## New Slop Introduced Since Previous Review

**Status:** ✅ **NONE IDENTIFIED**

No new slop was introduced in the changes between `feat/ReactFrontend` and `feat/CreateAssessmentModal` that was not already identified in CODE_REVIEW.md.

All new production files are either:

1. **Actually used** (map-error-to-ui.ts, assignmentDefinitionService.ts, etc.)
2. **Properly structured** (AssignmentDefinitionWizardModal.tsx, AssignmentDefinitionWizardModalShell.tsx)
3. **Dead code** (already identified in CODE_REVIEW.md)

---

## Files with No Slop (Clean)

The following files were reviewed and found to have **no slop**:

- `src/frontend/src/errors/map-error-to-ui.ts` - Legitimate error mapping utility, actually used
- `src/frontend/src/pages/AssignmentDefinitionWizardModal.tsx` - Proper modal component
- `src/frontend/src/pages/AssignmentDefinitionWizardModalShell.tsx` - Proper shell component
- `src/frontend/src/services/assignmentDefinitionService.ts` - Proper service wrapper
- `src/frontend/src/services/assignmentTopicsService.ts` - Proper service wrapper
- `src/frontend/src/services/assignmentDefinition.zod.ts` - Proper Zod schema
- `src/frontend/src/services/assignmentTopics.zod.ts` - Proper Zod schema
- `src/frontend/src/query/sharedQueries.ts` - Proper query definitions
- `src/frontend/src/query/queryKeys.ts` - Proper query keys
- `src/frontend/src/query/assignmentDefinitionWizard.query.spec.ts` - Proper test for query wiring
- `src/backend/Assessors/0_SpreadsheetFormulaEquivalence.js` - Legitimate utility, actually used
- Backend API and controller files - Proper implementation

---

## Validation Commands

Run these commands after applying fixes:

```bash
# 1. Frontend lint check
npm run frontend:lint

# 2. TypeScript compilation
npm exec tsc -- -b src/frontend/tsconfig.json

# 3. Delete dead code files
git rm src/frontend/src/query/upsertAssignmentDefinitionMutation.ts
git rm src/frontend/src/query/upsertAssignmentDefinitionMutation.query.spec.ts

# 4. Verify no references to deleted files
grep -r "upsertAssignmentDefinitionMutation" src/frontend/src --include="*.ts" --include="*.tsx" | grep -v "\.spec\."
# Should return no results

# 5. Run unit tests for affected modules
npm --prefix src/frontend test -- --run src/pages/AssignmentsPage.spec.tsx
npm --prefix src/frontend test -- --run src/pages/AssignmentDefinitionWizardModal.spec.tsx

# 6. Run all frontend tests
npm run frontend:test
```

---

## Checklist for Merge Readiness

### 🔴 Blocking (Must Complete)

- [ ] **SLOP-001**: Delete `upsertAssignmentDefinitionMutation.ts`
- [ ] **SLOP-001**: Delete `upsertAssignmentDefinitionMutation.query.spec.ts`
- [ ] Verify no other files reference the deleted files
- [ ] Confirm `git status` is clean after deletion

### 🟡 Recommended (Should Complete)

- [ ] **SLOP-003**: Inline trivial single-caller helpers in useAssignmentDefinitionWizard.ts
  - [ ] Inline `hasAllParseFields` (line 340)
  - [ ] Inline `hasYearGroupSelected` (line 350)
  - [ ] Inline `buildTopicOptions` (line 314)
  - [ ] Inline `buildYearGroupOptions` (line 327)
- [ ] **SLOP-002**: Evaluate helper chain in AssignmentsPage.tsx (optional, based on team preference)

### ⚪ Optional (Nice to Have)

- [ ] **SLOP-004**: Deduplicate cargo-cult comments (will largely be resolved by SLOP-001)

### Validation

- [ ] `npm run frontend:lint` passes
- [ ] `npm exec tsc -- -b src/frontend/tsconfig.json` passes
- [ ] All unit tests pass
- [ ] E2E tests pass (if environment supports Chromium)

---

## Summary

The `feat/CreateAssessmentModal` branch has **one critical blocking issue** (SLOP-001) that must be resolved before merge. The dead code in `upsertAssignmentDefinitionMutation.ts` and its test file represent a clear violation of frontend abstraction standards and serve no purpose in the codebase.

**Once SLOP-001 is resolved by deleting the two dead code files, the branch can be reconsidered for merge.**

The improvement findings (SLOP-002, SLOP-003) are non-blocking but would enhance code maintainability if addressed either before or after merge. The trivial helper inlining (SLOP-003) is particularly recommended as low-risk, high-value cleanup.

**Final Status:** **BLOCKED** - Critical issue SLOP-001 prevents merge.

---

## Files Read

### Mandatory Agent Instructions

- `/home/developer/AssessmentBot/AGENTS.md`
- `/home/developer/AssessmentBot/src/frontend/AGENTS.md`
- `/home/developer/AssessmentBot/.github/agents/de-sloppification.agent.md`
- `/home/developer/AssessmentBot/.github/agents/code-reviewer.agent.md`

### Canonical Policy Documents Consulted

- `/home/developer/AssessmentBot/docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `/home/developer/AssessmentBot/docs/developer/frontend/frontend-modal-patterns.md`
- `/home/developer/AssessmentBot/docs/developer/frontend/frontend-react-query-and-prefetch.md`
- `/home/developer/AssessmentBot/docs/developer/frontend/frontend-loading-and-width-standards.md`
- `/home/developer/AssessmentBot/docs/developer/frontend/frontend-testing.md`

### Planning and Review Documents Consulted

- `/home/developer/AssessmentBot/CODE_REVIEW.md` (previous code review findings)
- `/home/developer/AssessmentBot/SLOP_REVIEW.md` (previous slop review - SUPERSEDED for planning docs)
- `/home/developer/AssessmentBot/SPEC.md` (specification - COMPLIANT)
- `/home/developer/AssessmentBot/ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md` (layout spec - COMPLIANT)

### Changed Files Reviewed

#### Production Code

- `src/frontend/src/query/upsertAssignmentDefinitionMutation.ts` - **DEAD CODE**
- `src/frontend/src/pages/useAssignmentDefinitionWizard.ts` - Over-extracted helpers
- `src/frontend/src/pages/AssignmentsPage.tsx` - Over-extracted helper chain
- `src/frontend/src/pages/AssignmentDefinitionWizardModal.tsx` - ✅ Clean
- `src/frontend/src/pages/AssignmentDefinitionWizardModalShell.tsx` - ✅ Clean
- `src/frontend/src/errors/map-error-to-ui.ts` - ✅ Clean
- `src/frontend/src/services/assignmentDefinitionService.ts` - ✅ Clean
- `src/frontend/src/services/assignmentTopicsService.ts` - ✅ Clean
- `src/frontend/src/services/assignmentDefinition.zod.ts` - ✅ Clean
- `src/frontend/src/services/assignmentTopics.zod.ts` - ✅ Clean
- `src/backend/Assessors/0_SpreadsheetFormulaEquivalence.js` - ✅ Clean
- Backend API and controller files - ✅ Clean

#### Test Files

- `src/frontend/src/query/upsertAssignmentDefinitionMutation.query.spec.ts` - **DEAD CODE**
- `src/frontend/src/query/assignmentDefinitionWizard.query.spec.ts` - ✅ Clean
- All other test files - ✅ Clean

---

_Document generated by Mistral Vibe from de-sloppification review on 2025-01-20_
