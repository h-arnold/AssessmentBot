# Reference Data Modal Duplication Reduction Plan

## Problem Statement

SonarQube PR #232 analysis reports **37.3% duplication on new code** (required: ≤ 3%).

**Metrics:**

- New Duplicated Lines: 651
- New Duplicated Blocks: 48
- Quality Gate: **FAILED** ❌

**Primary Source:** Duplicated orchestration logic in `ManageCohortsModal.tsx` and `ManageYearGroupsModal.tsx` (approximately ~300 lines each of nearly identical state management, handler factories, and query orchestration).

**Test Status:** ✅ All existing tests are behavior-focused. No implementation-coupled tests exist that would break with internal refactoring (verified by Testing Specialist).

---

## Objective

Reduce duplication from **37.3%** to under **3%** by extracting shared orchestration logic into a reusable hook, while preserving all public behavior, props contracts, and rendered output.

---

## Scope

### In Scope

- Extract orchestration logic from `ManageCohortsModal.tsx`
- Extract orchestration logic from `ManageYearGroupsModal.tsx`
- Create shared `useReferenceDataManagement` hook
- Migrate both components to use the new hook
- Preserve all existing test coverage (no modifications required)

### Out of Scope

- Modifying `ReferenceDataManagementModalScaffold` (already shared, working as intended)
- Changing public props interface of caller components
- Modifying rendered DOM structure or test IDs
- Changing user-facing behavior or workflows
- Adding new features or functionality

---

## Implementation Plan

### Phase 1: Hook Creation

**File:** `src/frontend/src/features/classes/hooks/useReferenceDataManagement.ts` (new)

**Extract these duplicated patterns:**

| Pattern                                                                                                           | Lines (est.) | Status      |
| ----------------------------------------------------------------------------------------------------------------- | ------------ | ----------- |
| State management (formMode, editingEntity, formSubmitting, formError, **toggleError**, deleteState)               | ~45          | ✅ Extract  |
| Handler structure (openCreateForm, openEditForm, closeFormDialog, handleModalClose, handleRequiredRefreshFailure) | ~60          | ✅ Extract  |
| Handler factories (create*FormFinishHandler, create*DeleteConfirmHandler)                                         | ~80          | ✅ Extract  |
| Query orchestration (primary query, blocking load error query)                                                    | ~30          | ✅ Extract  |
| **Blocking load error useEffect cleanup**                                                                         | ~15          | ✅ Extract  |
| Dialog rendering (renderFormDialog, renderDeleteDialog, **inlineDialog/inlineAlert composition**)                 | ~40          | ✅ Extract  |
| **Form instance management**                                                                                      | ~5           | ✅ Extract  |
| **Total**                                                                                                         | **~275**     | **Extract** |

**Note on Blocking Load Error useEffect:** The `useEffect` cleanup for blocking load errors **WILL BE INCLUDED** in the hook abstraction. This is a critical fail-closed safety mechanism (not merely duplication) that ensures stale blocking errors are cleared when fresh data is available. The hook will use `entityKey` to call `clearPersistedBlockingLoadError(queryClient, entityKey)`.

**Hook Interface:**

```typescript
export function useReferenceDataManagement<T extends { key: string }>(
  config: ReferenceDataManagementConfig<T>
): ReferenceDataManagementResult<T>;

type ReferenceDataManagementConfig<T> = {
  entityName: string;
  entityLabel: string;
  entityKey: ReferenceDataTrustBoundary; // 'cohorts' | 'yearGroups'
  queryOptions: UseQueryOptions<T[]>;
  queryKey: QueryKey;
  createService: (params: { record: Omit<T, 'key'> }) => Promise<void>;
  updateService: (params: { key: string; record: Omit<T, 'key'> }) => Promise<void>;
  deleteService: (params: { key: string }) => Promise<void>;
  supportsToggleActive: boolean;
  toggleService?: (params: { key: string; active: boolean }) => Promise<void>;
  formValidationMessage: string;
  loadFailureCopy: string;
  refreshStatusCopy: string;
  renderFormDialog: (props: FormDialogProps<T>) => ReactElement | null;
  renderDeleteDialog: (props: DeleteDialogProps<T>) => ReactElement | null;
};

type DeleteDialogState<T> = Readonly<{
  open: boolean;
  entity: T | null;
  error: string | null;
  blocked: boolean;
  submitting: boolean;
}>;

type ReferenceDataManagementResult<T> = {
  // State
  formMode: 'create' | 'edit' | null;
  editingEntity: T | null;
  form: ReturnType<typeof Form.useForm>; // form instance
  formSubmitting: boolean;
  formError: string | null;
  toggleError: string | null; // toggle error state
  deleteState: DeleteDialogState<T>;
  loadError: string | null;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  rows: T[];

  // Derived UI elements
  inlineDialog: ReactElement | null; // NEW: composed from dialog renderers and state
  inlineAlert: ReactElement | null; // NEW: composed from toggleError and entity-specific alerts

  // Handlers
  openCreateForm: () => void; // will always reset form fields
  openEditForm: (entity: T) => void;
  closeFormDialog: () => void;
  handleModalClose: () => void;
  handleFormFinish: (values: ReferenceDataFormValues) => Promise<void>;
  handleDeleteConfirm: () => Promise<void>;
  handleToggleActive?: (entity: T, active: boolean) => Promise<void>;
};
```

**Standardization Decision:** `openCreateForm` will **always call `form.resetFields()`** before opening the form, standardizing the behavior currently inconsistent between Cohorts (no reset) and YearGroups (reset).

---

### Phase 2: Migrate ManageCohortsModal

**File:** `src/frontend/src/features/classes/ManageCohortsModal.tsx`

**Actions:**

1. Import and use `useReferenceDataManagement<Cohort>`
2. Remove duplicated state declarations
3. Remove duplicated handler functions and factories
4. Remove duplicated query orchestration
5. Remove duplicated dialog rendering functions
6. **Update `openCreateForm` to call `form.resetFields()`** (standardization)
7. Preserve entity-specific:
   - `buildCohortColumns` (entity-specific column definitions with Active toggle)
   - `CohortFormValues` type
   - Service calls (createCohort, updateCohort, deleteCohort)
   - Query keys (`queryKeys.cohorts()`)
   - Copy strings (cohort-specific messages)
   - Toggle active functionality (via `supportsToggleActive: true` and `toggleService`)

**Result:** File reduced from ~573 lines to ~80-100 lines

---

### Phase 3: Migrate ManageYearGroupsModal

**File:** `src/frontend/src/features/classes/ManageYearGroupsModal.tsx`

**Actions:** Same as Phase 2, adapted for YearGroup entity:

1. Import and use `useReferenceDataManagement<YearGroup>`
2. Remove duplicated state declarations
3. Remove duplicated handler functions and factories
4. Remove duplicated query orchestration
5. Remove duplicated dialog rendering functions
6. **Update `openCreateForm` to call `form.resetFields()`** (standardization - YearGroup already does this)
7. Preserve entity-specific:
   - `buildYearGroupColumns` (entity-specific column definitions, no toggle)
   - `YearGroupFormValues` type
   - Service calls (createYearGroup, updateYearGroup, deleteYearGroup)
   - Query keys (`queryKeys.yearGroups()`)
   - Copy strings (year-group-specific messages)
   - No toggle active functionality (via `supportsToggleActive: false`)

**Result:** File reduced from ~480 lines to ~60-80 lines

---

### Phase 4: Validation

**Actions:**

1. Run full test suite: `npm run test:frontend`
2. Run lint: `npm run lint:frontend`
3. Run type check: `npm run type-check:frontend` (if applicable)
4. Run Playwright e2e tests: `npx playwright test`
5. Verify SonarQube metrics: duplication should drop below 3%

**Expected:** All tests pass without modification (verified by Testing Specialist review).

---

## Success Criteria

| Metric                | Current | Target  | Status       |
| --------------------- | ------- | ------- | ------------ |
| SonarQube Duplication | 37.3%   | < 3%    | ✅ Must meet |
| New Duplicated Lines  | 651     | < 20    | ✅ Must meet |
| New Duplicated Blocks | 48      | < 5     | ✅ Must meet |
| All existing tests    | Passing | Passing | ✅ Must meet |
| All lint checks       | Passing | Passing | ✅ Must meet |

---

## File Changes Summary

| File                            | Action   | Lines Before | Lines After  | Reduction        |
| ------------------------------- | -------- | ------------ | ------------ | ---------------- |
| `useReferenceDataManagement.ts` | Create   | 0            | ~240-290     | +240-290         |
| `ManageCohortsModal.tsx`        | Refactor | ~573         | ~80-100      | -473             |
| `ManageYearGroupsModal.tsx`     | Refactor | ~480         | ~60-80       | -400             |
| **Net Change**                  |          | **~1053**    | **~380-420** | **-633 to -673** |

**Note:** Line estimates updated to account for additional abstraction of toggleError state, form instance management, standardized form reset behavior, blocking load error useEffect cleanup, and inlineDialog/inlineAlert composition.

---

## Risk Assessment

| Risk                                      | Probability | Impact | Mitigation                                                                                  |
| ----------------------------------------- | ----------- | ------ | ------------------------------------------------------------------------------------------- |
| Tests break due to implementation changes | Low         | High   | Testing Specialist verified all tests are behavior-focused; run full suite after each phase |
| Type errors in hook                       | Medium      | Medium | Use TypeScript generics properly; validate with `type-check:frontend`                       |
| Query cache behavior changes              | Low         | High   | Preserve existing query patterns; verify with integration tests                             |
| Error handling behavior changes           | Low         | High   | Preserve existing error handling patterns; verify with error state tests                    |

**Overall Risk: LOW** ✅

---

## Dependencies

- SPEC.md §1-17 (scaffold extraction already complete)
- `ReferenceDataManagementModalScaffold.tsx` (stable, do not modify)
- `manageReferenceDataHelpers.ts` (shared utilities, may need minor extensions)
- `manageReferenceDataDialogs.tsx` (shared dialogs, unchanged)

---

## Rollback Plan

If issues arise:

1. Revert hook creation
2. Revert ManageCohortsModal migration
3. Revert ManageYearGroupsModal migration
4. All changes are isolated to new file + two component files = easy rollback

---

## Next Steps

1. ✅ Planning complete (this document)
2. ⏳ Implement Phase 1: Create `useReferenceDataManagement` hook
3. ⏳ Implement Phase 2: Migrate `ManageCohortsModal`
4. ⏳ Implement Phase 3: Migrate `ManageYearGroupsModal`
5. ⏳ Implement Phase 4: Validation and SonarQube verification
6. ⏳ Commit and push with descriptive message referencing this plan

---

## Notes

- This plan **exceeds SPEC.md's original scope** (which limited extraction to outer shell only). Stakeholder approval may be required before implementation.
- The abstraction is **optional** for meeting current functional requirements but **required** to pass SonarQube Quality Gate.
- Test suite review by Testing Specialist confirms **100% behavior-focused tests** — no test modifications needed.
- **Form reset standardization:** Both modals will reset form fields when opening the create form, standardizing the current inconsistent behavior.
- **Blocking load error useEffect:** This cleanup pattern is **now included** in the hook abstraction as it is a critical fail-closed safety mechanism, not merely duplication.
- **Critical design fix:** Removed `columns` and `scaffoldProps` from hook result type. The hook exposes primitive state and handlers only; consumers construct scaffold props and columns from hook outputs. This preserves separation of concerns.
- **UI composition:** Added `inlineDialog` and `inlineAlert` to hook result to reduce duplication in dialog rendering and alert construction.
