# CODE REVIEW: feat/CreateAssessmentModal Branch

**Date**: 2025-01-15 (Updated)  
**Branch**: `feat/CreateAssessmentModal`  
**Commit Range**: `feat/ReactFrontend` through `HEAD` (`d22131f`)  
**Reviewers**: Code Reviewer Agent (Fresh Review)  
**Status**: **BLOCKED** - Critical issues must be resolved before merge

---

## Executive Summary

This is a **fresh code review** of all changes on the `feat/CreateAssessmentModal` branch compared to `feat/ReactFrontend`. The previous CODE_REVIEW.md documented findings from an earlier state of this branch. This updated review:

1. Confirms which previous findings remain **relevant** (still present)
2. Identifies which previous findings are now **irrelevant** (code was fixed or deleted)
3. Discovers **new issues** introduced since the previous review
4. Verifies compliance with SPEC.md and ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md

**Overall Verdict**: **FAIL** - Blocking issues identified that prevent merge.

The branch introduces substantial new functionality for the assignment definition create/update wizard, including:

- Backend: Enhanced AssignmentDefinitionController with upsert, duplicate detection, and parsing
- Backend API: New transport methods (getAssignmentDefinition, upsertAssignmentDefinition)
- Frontend: AssignmentDefinitionWizardModal, useAssignmentDefinitionWizard hook, and supporting services
- Tests: Comprehensive unit and E2E test coverage

However, **critical dead code** remains, and a **new critical validation gap** was discovered.

---

## Review Scope

### Files Changed

#### Backend Production Files (Modified)

| File                                                          | Lines Changed   | Type        | Status       |
| ------------------------------------------------------------- | --------------- | ----------- | ------------ |
| `src/backend/y_controllers/AssignmentDefinitionController.js` | Major expansion | Controller  | 🔴 Needs Fix |
| `src/backend/y_controllers/ReferenceDataController.js`        | Minor changes   | Controller  | ✅ Pass      |
| `src/backend/z_Api/assignmentDefinitionPartials.js`           | Major expansion | API Layer   | ✅ Pass      |
| `src/backend/z_Api/z_apiHandler.js`                           | Minor additions | API Handler | ✅ Pass      |
| `src/backend/Assessors/SheetsAssessor.js`                     | Bug fixes       | Assessor    | ✅ Pass      |
| `src/backend/AssignmentProcessor/SheetsAssignment.js`         | Bug fixes       | Processor   | ✅ Pass      |
| `src/backend/DocumentParsers/SheetsParser.js`                 | Bug fixes       | Parser      | ✅ Pass      |
| `src/backend/FeedbackPopulators/SheetsFeedback.js`            | Bug fixes       | Feedback    | ✅ Pass      |

#### Frontend Production Files

| File                                                              | Lines Changed   | Type           | Status        |
| ----------------------------------------------------------------- | --------------- | -------------- | ------------- |
| `src/frontend/src/pages/AssignmentsPage.tsx`                      | +161/-44        | Component      | 🔴 Needs Fix  |
| `src/frontend/src/pages/AssignmentDefinitionWizardModal.tsx`      | +101            | Component      | ✅ Pass       |
| `src/frontend/src/pages/AssignmentDefinitionWizardModalShell.tsx` | +394            | Component      | ✅ Pass       |
| `src/frontend/src/pages/useAssignmentDefinitionWizard.ts`         | +1075           | Hook           | 🔴 Needs Fix  |
| `src/frontend/src/query/upsertAssignmentDefinitionMutation.ts`    | +38             | Query utility  | 🔴 **DELETE** |
| `src/frontend/src/query/queryKeys.ts`                             | Minor additions | Query keys     | ✅ Pass       |
| `src/frontend/src/query/sharedQueries.ts`                         | +43/-           | Shared queries | ✅ Pass       |
| `src/frontend/src/services/assignmentDefinitionService.ts`        | +69             | Service        | ✅ Pass       |
| `src/frontend/src/services/assignmentDefinition.zod.ts`           | +102            | Zod schema     | ✅ Pass       |
| `src/frontend/src/services/assignmentTopicsService.ts`            | +23             | Service        | ✅ Pass       |
| `src/frontend/src/services/assignmentTopics.zod.ts`               | +21             | Zod schema     | ✅ Pass       |
| `src/frontend/src/errors/map-error-to-ui.ts`                      | +124            | Error mapping  | ✅ Pass       |

#### Test Files

- **Backend tests**: Multiple new and modified test files (all passing)
- **Frontend unit tests**: 72 test files, 521 tests (all passing)
- **Frontend E2E tests**: Cannot verify (Chromium not installed in environment)

### Verification Commands Run

```bash
# Backend lint - PASSED
npm run lint

# Frontend lint - PASSED
npm run frontend:lint

# TypeScript compilation - PASSED
npm exec tsc -- -b src/frontend/tsconfig.json

# Builder lint - PASSED
npm run builder:lint

# Backend tests - PASSED (76 files, 951 tests)
npm test

# Frontend unit tests - PASSED (72 files, 521 tests)
npm run frontend:test

# Frontend E2E tests - NOT RUN (Chromium not available)
# Command: npm --prefix src/frontend exec -- playwright install --with-deps chromium
#         npm run frontend:test:e2e
```

---

## 🔴 Critical Findings (MUST FIX)

### CR-001: Dead Code with Duplicated Cache Invalidation Logic

**Severity**: 🔴 **CRITICAL** (Blocker)  
**Source**: Previous review (Confirmed still present)  
**Location**:

- `src/frontend/src/query/upsertAssignmentDefinitionMutation.ts` (38 lines)
- `src/frontend/src/query/upsertAssignmentDefinitionMutation.query.spec.ts` (83 lines)

**Evidence**:

```bash
# Verification command run
$ grep -r "from.*upsertAssignmentDefinitionMutation" src/frontend/src --include="*.ts" --include="*.tsx"
# Result: No imports found (exit code 1)
```

- **Zero production imports** - Confirmed via exhaustive search
- **Only referenced by its own test file**
- **Duplicates logic** already implemented in `useAssignmentDefinitionWizard.ts` lines 835-848 (`invalidateMutationQueries` function)
- Both implementations perform identical cache invalidation:
  ```typescript
  await queryClient.invalidateQueries({ queryKey: queryKeys.assignmentDefinitionPartials() });
  await queryClient.invalidateQueries({ queryKey: queryKeys.assignmentDefinitionByKey(...) });
  ```

**Policy Violations**:
| Document | Rule | Impact |
|----------|------|--------|
| `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` | §4.1 | Keep logic local when there is one call site and no clear independent contract |
| `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` | §5.1 | Reject single-caller wrapper extraction that does not own an independent contract |

**Root Cause**: Classic AI-slop - scaffolding created during implementation but never wired into the actual codebase.

**Required Action**:

```bash
# Delete both dead code files
git rm src/frontend/src/query/upsertAssignmentDefinitionMutation.ts
git rm src/frontend/src/query/upsertAssignmentDefinitionMutation.query.spec.ts
```

**Blocker Status**: **YES** - Must be resolved before merge. This is a canonical policy violation.

---

### CR-NEW-001: Missing Validate.requireParams in AssignmentDefinitionController.saveDefinition

**Severity**: 🔴 **CRITICAL** (Blocker)  
**Source**: Fresh review finding  
**Location**: `src/backend/y_controllers/AssignmentDefinitionController.js` line 477

**Evidence**:

```javascript
saveDefinition(definition) {
  const definitionInstance =
    definition instanceof AssignmentDefinition
      ? definition
      : new AssignmentDefinition(definition);
  // ... no Validate.requireParams call
}
```

**Policy Violation**: `src/backend/AGENTS.md §2` - "Public methods must call `Validate.requireParams({ param1, param2 }, 'MethodName.methodName')` at the start."

**Root Cause**: The public `saveDefinition` method accepts a required `definition` parameter but does not validate its presence at the method entry point.

**Required Action**: Add Validate.requireParams at the start of the method:

```javascript
saveDefinition(definition) {
  Validate.requireParams({ definition }, 'AssignmentDefinitionController.saveDefinition');
  // ... rest of method
}
```

**Blocker Status**: **YES** - Must be resolved before merge. Violates mandatory backend validation contract.

---

## 🟡 Improvement Findings (SHOULD FIX)

### CR-002: Over-Extracted Single-Caller Helper Chain in AssignmentsPage.tsx

**Severity**: 🟡 **IMPROVEMENT**  
**Source**: Previous review (Confirmed still present)  
**Location**: `src/frontend/src/pages/AssignmentsPage.tsx` lines 239-310

**Evidence**:

- `shouldRenderAssignmentsBlockingState` (line 239) → used only by `getAssignmentsSurfaceState` (line 276)
- `getAssignmentsSurfaceState` (line 265) → used only at line 720 in component body
- `isAssignmentsSurfaceBusyState` (line 301) → used only at line 730 in component body

**Issue**: Creates a chain of single-caller helpers, each adding an indirection layer without removing duplication. This violates the principle that extraction should only occur when it removes proven duplication across multiple real call sites.

**Policy Violation**: `frontend-shared-helpers-and-abstraction-standards.md §4.1` - "extraction would only rename existing code without removing duplication"

**Recommended Action**:

- Inline `shouldRenderAssignmentsBlockingState` directly into `getAssignmentsSurfaceState` (its sole caller)
- **Consider keeping** `getAssignmentsSurfaceState` and `isAssignmentsSurfaceBusyState` as they encapsulate complex boolean logic that improves readability
- Decision should be based on whether the readability benefit outweighs the indirection cost

**Note**: This is a judgment call. The helpers do improve code clarity for complex conditional logic, but strictly speaking, they don't meet the duplication threshold for extraction.

---

### CR-003: Single-Caller Helper Functions in useAssignmentDefinitionWizard.ts

**Severity**: 🟡 **IMPROVEMENT**  
**Source**: Previous review (Confirmed still present)  
**Location**: `src/frontend/src/pages/useAssignmentDefinitionWizard.ts`

**Evidence - Single-use helpers**:
| Function | Line | Used At | Complexity |
|----------|------|---------|------------|
| `hasAllParseFields` | 340 | 147 | Trivial (one-liner) |
| `hasYearGroupSelected` | 350 | 148 | Trivial (one-liner) |
| `buildTopicOptions` | 314 | 685 (via useMemo) | Trivial (one-liner) |
| `buildYearGroupOptions` | 327 | 686 (via useMemo) | Trivial (one-liner) |
| `deriveReferenceDataState` | 104 | 683 | Non-trivial |
| `derivePrimaryActionState` | 138 | 692 | Non-trivial |

**Issue**: Six helper functions each used exactly once. Four are trivial one-liners that don't justify extraction. Two encapsulate non-trivial logic.

**Policy Violation**: `frontend-shared-helpers-and-abstraction-standards.md §4.1`

**Recommended Action**:

- **Inline immediately**: `hasAllParseFields`, `hasYearGroupSelected`, `buildTopicOptions`, `buildYearGroupOptions`
- **Keep for now**: `deriveReferenceDataState`, `derivePrimaryActionState` (encapsulate non-trivial logic, plausible future callers)

**Rationale**: The trivial helpers add cognitive overhead without benefit. The non-trivial ones may gain additional callers in future development.

---

## ⚪ Nitpick Findings (OPTIONAL)

### CR-004: Cargo-Cult Comment Pattern

**Severity**: ⚪ **NITPICK**  
**Source**: Previous review (Partially resolved)  
**Locations**:

- `src/frontend/src/query/upsertAssignmentDefinitionMutation.ts` lines 18-19 (to be deleted with CR-001)
- `src/frontend/src/query/upsertAssignmentDefinitionMutation.query.spec.ts` lines 6-8, 30-32 (to be deleted with CR-001)
- `src/frontend/src/pages/useAssignmentDefinitionWizard.ts` line 837

**Evidence**: All contain near-identical explanatory text:

```javascript
// Per frontend-react-query-and-prefetch.md §7, we use invalidateQueries only.
// Active useQuery observers will automatically refetch in the background,
// and any errors will properly propagate to their isError state.
```

**Issue**: Suggests copy-paste documentation rather than organic, context-specific explanation.

**Recommended Action**:

- Remove from `upsertAssignmentDefinitionMutation.ts` (will be deleted anyway with CR-001)
- Remove from `upsertAssignmentDefinitionMutation.query.spec.ts` (will be deleted anyway with CR-001)
- Keep the canonical instance in `useAssignmentDefinitionWizard.ts` (line 837) where the logic is actually used
- If keeping other instances, shorten to: "See frontend-react-query-and-prefetch.md §7 and useAssignmentDefinitionWizard.ts for rationale"

---

## Previous Findings Now IRRELEVANT

The following findings from the previous CODE_REVIEW.md are **no longer applicable** as they referenced code that has been fixed, refactored, or the context has changed:

- **None identified** - All previous findings remain relevant or have been addressed through code evolution that maintains the same structural issues.

---

## Compliance Verification

### SPEC.md Compliance

✅ **§17**: `documentType` is derived server-side inside `upsertAssignmentDefinition`, not user-editable
✅ **§18**: `definitionKey` is stable and doesn't recompute when editing title/topic/year group
✅ **§21**: Both `upsertAssignmentDefinition` and `getAssignmentDefinition` return the same canonical full-definition response shape (AssignmentDefinitionSchema)
✅ **§22**: Duplicate detection uses `(normalised primaryTitle, primaryTopicKey, yearGroupKey)` tuple via `_assertNoDuplicateBusinessTuple`
✅ **§23**: When metadata or weighting edits are dirty, document URL fields become unavailable (implemented in shell via `disabled={hasDirtyEdits || documentChange.hasPendingChange || isMutationBusy}`)
✅ **§24**: Reference and template documents must resolve to same supported document type (validated in `validateWizardUpsertParameters_`)
✅ **§25**: `assignmentTopics` is part of startup warm-up contract (added to sharedQueries.ts)
✅ **§26**: Stage-one create persists with defaulted weighting values, visible in Assignments table
✅ **§27**: `upsertAssignmentDefinition` is single write transport for stage-one create, final save, and re-parse
✅ **§28**: Duplicate business-tuple detection applies at every upsert that creates or changes tuple

### ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md Compliance

✅ **Modal hierarchy**: AssignmentDefinitionWizardModal delegates to AssignmentDefinitionWizardModalShell
✅ **Modal titles**: "Create assignment" and "Update assignment" as specified
✅ **Width**: Uses `var(--app-modal-width-wide-data)` wide-data modal width
✅ **No nested modals for re-parse**: Re-parse actions are inline in document region
✅ **Custom footer**: Modal has custom footer with Cancel and primary action buttons
✅ **Discard confirmation**: Secondary modal only for discard confirmation (not for re-parse)
✅ **Alert stack**: Shows blocking errors and re-parse required states
✅ **Document change region**: URL inputs with Re-parse and Cancel actions appear inline
✅ **Close-with-discard workflow**: Modal stays open on validation failure per SPEC.md §20

---

## Validation Strategy

After applying all fixes:

1. Run `npm run lint && npm run frontend:lint && npm run builder:lint` - should pass
2. Run `npm exec tsc -- -b src/frontend/tsconfig.json` - should pass
3. Run `npm test` - should pass (76 files, 951 tests)
4. Run `npm run frontend:test` - should pass (72 files, 521 tests)
5. Run E2E tests if possible:
   ```bash
   npm --prefix src/frontend exec -- playwright install --with-deps chromium
   npm run frontend:test:e2e
   ```

---

## Checklist for Merge Readiness

### 🔴 Blocking (Must Complete)

- [ ] **CR-001**: Delete `src/frontend/src/query/upsertAssignmentDefinitionMutation.ts` and `src/frontend/src/query/upsertAssignmentDefinitionMutation.query.spec.ts`
- [ ] **CR-NEW-001**: Add `Validate.requireParams({ definition }, 'AssignmentDefinitionController.saveDefinition')` at start of `saveDefinition` method
- [ ] Verify no other files reference the deleted files
- [ ] Confirm `git status` is clean after all fixes

### 🟡 Recommended (Should Complete)

- [ ] **CR-003**: Inline trivial single-caller helpers in useAssignmentDefinitionWizard.ts:
  - `hasAllParseFields` (line 340)
  - `hasYearGroupSelected` (line 350)
  - `buildTopicOptions` (line 314)
  - `buildYearGroupOptions` (line 327)
- [ ] **CR-002**: Evaluate helper chain in AssignmentsPage.tsx (optional, based on team preference)

### ⚪ Optional (Nice to Have)

- [ ] **CR-004**: Remove cargo-cult comments from dead code files (will be deleted with CR-001)

### Validation

- [ ] `npm run lint` passes
- [ ] `npm run frontend:lint` passes
- [ ] `npm exec tsc -- -b src/frontend/tsconfig.json` passes
- [ ] All unit tests pass
- [ ] E2E tests pass (if environment supports Chromium)

---

## Files Read by Review Agent

### Mandatory Agent Instructions

- `/home/developer/AssessmentBot/AGENTS.md`
- `/home/developer/AssessmentBot/src/frontend/AGENTS.md`
- `/home/developer/AssessmentBot/src/backend/AGENTS.md`
- `/home/developer/AssessmentBot/.github/agents/code-reviewer.agent.md`

### Canonical Policy Documents Consulted

- `/home/developer/AssessmentBot/docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `/home/developer/AssessmentBot/docs/developer/frontend/frontend-modal-patterns.md`
- `/home/developer/AssessmentBot/docs/developer/frontend/frontend-react-query-and-prefetch.md`
- `/home/developer/AssessmentBot/docs/developer/backend/backend-logging-and-error-handling.md`

### Planning Documents Consulted

- `/home/developer/AssessmentBot/SPEC.md`
- `/home/developer/AssessmentBot/ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md`
- `/home/developer/AssessmentBot/CODE_REVIEW.md` (previous version)

### Changed Files Reviewed

#### Backend

- `src/backend/y_controllers/AssignmentDefinitionController.js`
- `src/backend/y_controllers/ReferenceDataController.js`
- `src/backend/z_Api/assignmentDefinitionPartials.js`
- `src/backend/z_Api/z_apiHandler.js`
- `src/backend/Assessors/SheetsAssessor.js`
- `src/backend/AssignmentProcessor/SheetsAssignment.js`
- `src/backend/DocumentParsers/SheetsParser.js`
- `src/backend/FeedbackPopulators/SheetsFeedback.js`
- `src/backend/Models/AssignmentDefinition.js`
- `src/backend/Models/Cohort.js`
- `src/backend/Models/Feedback/1_CellReferenceFeedback.js`
- `src/backend/Models/Artifacts/3_SpreadsheetTaskArtifact.js`

#### Frontend

- `src/frontend/src/pages/AssignmentsPage.tsx`
- `src/frontend/src/pages/AssignmentDefinitionWizardModal.tsx`
- `src/frontend/src/pages/AssignmentDefinitionWizardModalShell.tsx`
- `src/frontend/src/pages/useAssignmentDefinitionWizard.ts`
- `src/frontend/src/query/upsertAssignmentDefinitionMutation.ts`
- `src/frontend/src/query/upsertAssignmentDefinitionMutation.query.spec.ts`
- `src/frontend/src/query/queryKeys.ts`
- `src/frontend/src/query/sharedQueries.ts`
- `src/frontend/src/services/assignmentDefinitionService.ts`
- `src/frontend/src/services/assignmentDefinition.zod.ts`
- `src/frontend/src/services/assignmentDefinitionPartialsService.ts`
- `src/frontend/src/services/assignmentDefinitionPartials.zod.ts`
- `src/frontend/src/services/assignmentTopicsService.ts`
- `src/frontend/src/services/assignmentTopics.zod.ts`
- `src/frontend/src/errors/map-error-to-ui.ts`

### Additional Context Files

- `src/frontend/src/test/setup.ts`
- `src/frontend/vite.config.ts`
- `src/frontend/package.json`

---

## Synthesis and Recommendations

### The Problems

The `feat/CreateAssessmentModal` branch contains **two critical blocking issues**:

1. **CR-001**: Dead code in `upsertAssignmentDefinitionMutation.ts` that:
   - Has zero production imports
   - Is only referenced by its own test file
   - Duplicates cache invalidation logic already in `useAssignmentDefinitionWizard.ts`
   - Violates canonical frontend abstraction standards (§4.1, §5.1)

2. **CR-NEW-001**: Missing `Validate.requireParams` in `AssignmentDefinitionController.saveDefinition`:
   - Public method without required parameter validation
   - Violates mandatory backend validation contract

### Immediate Actions (Required for Merge)

1. **Delete the dead code files**

   ```bash
   git rm src/frontend/src/query/upsertAssignmentDefinitionMutation.ts
   git rm src/frontend/src/query/upsertAssignmentDefinitionMutation.query.spec.ts
   ```

2. **Add parameter validation to saveDefinition**
   ```javascript
   saveDefinition(definition) {
     Validate.requireParams({ definition }, 'AssignmentDefinitionController.saveDefinition');
     // ... rest of method
   }
   ```

### Short-term Improvements (Post-Merge Candidates)

3. **Inline trivial helpers** in `useAssignmentDefinitionWizard.ts`:
   - `hasAllParseFields` (line 340)
   - `hasYearGroupSelected` (line 350)
   - `buildTopicOptions` (line 314)
   - `buildYearGroupOptions` (line 327)

4. **Review helper chain** in `AssignmentsPage.tsx`:
   - Consider inlining `shouldRenderAssignmentsBlockingState` into `getAssignmentsSurfaceState`
   - The other helpers may be kept for readability

### Validation Strategy

After applying CR-001 and CR-NEW-001 fixes:

1. Run all lint checks - should pass
2. Run TypeScript compilation - should pass
3. Run all unit tests - should pass
4. Run E2E tests if possible - should pass

### Why This Matters

- **Maintainability**: Dead code increases maintenance burden and bundle size
- **Policy Compliance**: Violates explicitly documented frontend and backend standards
- **Code Quality**: Duplicated logic creates inconsistency risk; missing validation creates error handling gaps
- **Team Velocity**: Future developers will waste time understanding unused code

---

## Conclusion

The `feat/CreateAssessmentModal` branch has **two critical blocking issues** (CR-001 and CR-NEW-001) that must be resolved before merge.

**Once both CR-001 and CR-NEW-001 are resolved, the branch can be reconsidered for merge.**

The improvement findings (CR-002, CR-003) are non-blocking but would enhance code maintainability if addressed either before or after merge. The trivial helper inlining (CR-003) is particularly recommended as low-risk, high-value cleanup.

**Final Status**: **BLOCKED** - Critical issues CR-001 and CR-NEW-001 prevent merge.

---

_Document generated by Mistral Vibe - Fresh Code Review on 2025-01-15_
