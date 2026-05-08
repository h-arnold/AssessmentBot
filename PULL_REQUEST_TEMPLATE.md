# PR: feat/CreateAssessmentModal → feat/ReactFrontend

## 📋 Summary

This PR delivers the **Assignment Definition Create/Update Wizard** feature as specified in [SPEC.md](SPEC.md). It implements a modal-driven workflow for creating and updating assignment definitions on the Assignments page, replacing the disabled global create/update buttons with a modern, user-friendly modal interface.

**Target Branch:** `feat/ReactFrontend`  
**Source Branch:** `feat/CreateAssessmentModal`  
**Commit:** `e234527`

---

## 🎯 What This Delivers

As defined in **SPEC.md §Purpose**, this feature enables:

- ✅ Creating assignment definitions from user-supplied reference and template document URLs
- ✅ Updating existing assignment definitions (metadata, document URLs, weighting, task weightings)
- ✅ Exposing task parsing results early for user review before final save

### Key Implementation Details

| SPEC Section                     | Implementation                                             | Status      |
| -------------------------------- | ---------------------------------------------------------- | ----------- |
| **§1-2** Placement               | Modal on Assignments page, row-level update action         | ✅ Complete |
| **§2-3** Two-stage flow          | Stage 1: parse & persist; Stage 2: review & final save     | ✅ Complete |
| **§8** Weighting defaults        | Assignment/task weightings default to 1, range 0-10        | ✅ Complete |
| **§10** Year-group contract      | Stores `yearGroupKey`, resolves `yearGroupLabel`           | ✅ Complete |
| **§16** Single write transport   | `upsertAssignmentDefinition` handles all write paths       | ✅ Complete |
| **§17** Document type derivation | Server-side derivation, not user-editable                  | ✅ Complete |
| **§18** Stable definition keys   | `definitionKey` never recomputes on metadata edits         | ✅ Complete |
| **§21** Canonical response shape | Same shape for both read and write operations              | ✅ Complete |
| **§22** Duplicate detection      | Uses `(primaryTitle, primaryTopicKey, yearGroupKey)` tuple | ✅ Complete |
| **§24** Type validation          | Same document type required for ref/template               | ✅ Complete |
| **§25** Startup warm-up          | `assignmentTopics` added to startup contract               | ✅ Complete |

---

## 📦 Changes by Area

### Frontend (`src/frontend/`)

**New Components:**

- `AssignmentDefinitionWizardModal.tsx` - Main modal component (101 lines)
- `AssignmentDefinitionWizardModalShell.tsx` - Modal shell with form logic (394 lines)
- `useAssignmentDefinitionWizard.ts` - Core state machine hook (1075 lines)

**New Services & Schemas:**

- `assignmentDefinitionService.ts` - API service wrapper
- `assignmentDefinition.zod.ts` - Zod validation schemas
- `assignmentTopicsService.ts` - Reference data service
- `assignmentTopics.zod.ts` - Topics validation schemas

**New Query Layer:**

- `assignmentDefinitionWizard.query.spec.ts` - Query wiring tests
- Updated `sharedQueries.ts` with new query definitions
- Updated `queryKeys.ts` with new query keys

**Updated Pages:**

- `AssignmentsPage.tsx` - Enhanced with modal integration (+161/-44 lines)
- `AssignmentsPage.spec.tsx` - Updated tests for new behavior

**Test Coverage:**

- 71 frontend test files
- 518 frontend tests
- All passing ✅

### Backend (`src/backend/`)

**New/Enhanced Controllers:**

- `AssignmentDefinitionController.js` - Major expansion (+886 lines)
  - `saveDefinition()` method with parameter validation
  - Duplicate business-tuple detection
  - Full/partial definition persistence
  - Task parsing and weighting preservation

**New API Layer:**

- `assignmentDefinitionPartials.js` - Transport methods (+576 lines)
  - `getAssignmentDefinition_()` - Full definition read
  - `upsertAssignmentDefinition_()` - Unified write transport

**Enhanced Models:**

- `AssignmentDefinition.js` - Updated for new contract
- Various artifact and feedback models updated

**Test Coverage:**

- 76 backend test files
- 953 backend tests
- All passing ✅

---

## 🔒 Quality Gates

| Gate           | Command                                         | Result                 |
| -------------- | ----------------------------------------------- | ---------------------- |
| Backend Lint   | `npm run lint`                                  | ✅ Pass                |
| Frontend Lint  | `npm run frontend:lint`                         | ✅ Pass                |
| TypeScript     | `npm exec tsc -- -b src/frontend/tsconfig.json` | ✅ Pass                |
| Backend Tests  | `npm test`                                      | ✅ 76 files, 953 tests |
| Frontend Tests | `npm run frontend:test`                         | ✅ 71 files, 518 tests |

---

## 📊 File Statistics

| Area      | Files Changed | Insertions | Deletions | Net        |
| --------- | ------------- | ---------- | --------- | ---------- |
| Frontend  | 24 files      | +4,422     | -92       | +4,330     |
| Backend   | 13 files      | +2,031     | -319      | +1,712     |
| **Total** | **37 files**  | **+6,453** | **-411**  | **+6,042** |

---

## 🎯 User-Facing Features

### Create Flow

1. User clicks "Create" from Assignments page action area
2. Modal opens with metadata inputs (title, topic dropdown, year-group dropdown)
3. User provides reference and template Google document URLs
4. On submit: validation → parsing → stage-one persistence
5. Modal transitions to edit surface with parsed tasks visible
6. User edits weighting values (assignment and per-task)
7. Final save persists complete definition

### Update Flow

1. User clicks "Update" from row-level action in Assignments table
2. Modal opens with pre-loaded existing definition data
3. User can edit metadata and weightings directly
4. If document URLs change: fields disable, re-parse prompt appears
5. User confirms re-parse → tasks re-parsed, weightings preserved where possible
6. Save persists changes

### Key UX Behaviors

- ✅ Document URL changes require explicit re-parse or cancel
- ✅ Dirty metadata/weighting edits block document URL changes
- ✅ Canceling re-parse restores previous URL values
- ✅ Stage-one create definitions appear in table immediately
- ✅ Closing with unsaved edits requires discard confirmation

---

## 🏗️ Technical Architecture

### Data Flow

```
AssignmentsPage
└── AssignmentDefinitionWizardModal
    └── AssignmentDefinitionWizardModalShell
        ├── Metadata & Document Section
        ├── Weighting Section (Task Table)
        └── Re-parse Prompt Region
```

### Contract Compliance

- ✅ Frontend service modules remain thin wrappers around `callApi(...)`
- ✅ Request/response validation in adjacent Zod schema files
- ✅ Transport goes through `apiHandler` (single entry point)
- ✅ React Query shared query definitions with query-key factories

### Data Loading

- **Startup:** `assignmentDefinitionPartials`, `yearGroups`, `assignmentTopics`
- **Feature Entry:** Full definition loaded for update mode
- **Manual Refresh:** All operations invalidate/refetch query data

---

## 🔍 Validation & Constraints

### Frontend Validation (per SPEC.md §Validation)

- ✅ Topic and year-group must be selected from dropdowns
- ✅ URLs must be valid Google document URLs
- ✅ Reference and template must be different documents
- ✅ Same document type required for both
- ✅ Weighting: 0-10 inclusive, defaults to 1
- ✅ Document URL edits disable other controls until resolved
- ✅ Dirty edits block conflicting changes

### Backend Validation (per SPEC.md §Validation)

- ✅ Transport shape validation in API layer
- ✅ Controller-level: duplicate detection, topic existence, type pairing
- ✅ `yearGroupKey` validated against reference data
- ✅ Weighting range enforcement (0-10)
- ✅ `documentType` derived server-side
- ✅ Duplicate tuple: `(primaryTitle, primaryTopicKey, yearGroupKey)`

---

## ⚠️ Important Notes

### Dependencies

- Requires `feat/ReactFrontend` base for React Query setup
- Uses existing reference data collections (assignmentTopics, yearGroups)
- No new GAS services or scopes required

### Non-Goals (per SPEC.md §Non-goals)

- ❌ Does NOT implement assessment-launch wizard flow
- ❌ Does NOT implement weighted scoring algorithm
- ❌ Does NOT support task content editing beyond weightings
- ❌ Does NOT support draft records that never persist

### Out of Scope (per SPEC.md §Open Questions)

- None - all product-contract questions resolved

---

## 📝 Code Quality Remediation

This PR also includes **critical code quality fixes** identified in CODE_REVIEW.md and SLOP_REVIEW.md:

| Finding           | Description                                        | Status                       |
| ----------------- | -------------------------------------------------- | ---------------------------- |
| CR-001 / SLOP-001 | Dead code: `upsertAssignmentDefinitionMutation.ts` | ✅ **Removed**               |
| CR-NEW-001        | Missing validation in `saveDefinition()`           | ✅ **Added**                 |
| CR-004 / SLOP-004 | Cargo-cult comments                                | ✅ **Resolved** (incidental) |

---

## 🎉 Merge Readiness Checklist

- [x] All acceptance criteria from SPEC.md implemented
- [x] All tests passing (backend + frontend)
- [x] All lint checks passing
- [x] TypeScript compilation successful
- [x] No breaking changes to existing functionality
- [x] Code review findings addressed
- [x] Slop review findings addressed
- [x] Documentation complete (SPEC.md, ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md)

---

## 📚 Related Documentation

- **[SPEC.md](SPEC.md)** - Full feature specification
- **[ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md](ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md)** - UI layout and modal patterns
- **[CODE_REVIEW.md](CODE_REVIEW.md)** - Code review findings (all critical issues resolved)
- **[SLOP_REVIEW.md](SLOP_REVIEW.md)** - Slop review findings (all critical issues resolved)

---

## 💬 Review Focus Areas

When reviewing this PR, please focus on:

1. **SPEC Compliance** - Verify implementation matches SPEC.md requirements
2. **UX Flow** - Test create and update workflows end-to-end
3. **Validation** - Ensure all validation rules are properly enforced
4. **Contract Consistency** - Verify response shapes match specifications
5. **No Regressions** - Confirm existing Assignments page functionality intact

---

**This feature is production-ready and fully implements the Assignment Definition Create/Update Wizard as specified.**
