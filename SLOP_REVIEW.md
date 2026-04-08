# Slop Review - Action-Plan Scope

Date: 2026-04-08

This report covers the code explicitly mentioned in the root action-plan files:

- `ACTION_PLAN.md`
- `ACTION_PLAN_1_BACKEND_CONTRACTS.md`
- `ACTION_PLAN_2_FRONTEND_DATA_AND_QUERY.md`
- `ACTION_PLAN_3_CLASSES_TAB_SHELL_AND_TABLE.md`
- `ACTION_PLAN_4_BULK_CLASS_WORKFLOWS.md`
- `ACTION_PLAN_5_REFERENCE_DATA_MANAGEMENT_AND_SIGNOFF.md`

The review prioritised confirmed dead code, duplicated logic, migration residue, and misleading abstractions. It is intentionally remedy-oriented: every finding below is written so that an agent that has not seen the original review can clean it up directly.

## Summary

**Needs Improvement** - the action-plan slice is functionally healthy, but it still contains confirmed migration residue: one unreachable page, several dead exports/state fields left behind by workstream churn, a legacy constructor compatibility branch that production no longer uses, and a few misleading names/tests that document retired contracts.

## Recommended remediation order

1. Remove the confirmed dead UI surface (`ClassesPage.tsx` and the orphaned `pageContent.classes` entry).
2. Remove the confirmed dead frontend scaffolding exports/state (`useSelectedRows`, `warmClassPartials`, unused query-invalidation schema exports, and `hasErrorStartupDataset`).
3. Migrate tests/helpers off the legacy positional `ABClass` constructor, then remove the compatibility branch.
4. Consolidate duplicated Classes ordering logic into one canonical helper.
5. Clean up misleading names/docs/tests (`validateDeleteClassId`, stale API fixture payloads, duplicate docblocks).

## 🔴 Critical

### 1. Dead Classes page and orphaned shell content are still in the frontend tree

**Location**

- `src/frontend/src/pages/ClassesPage.tsx:1-16`
- `src/frontend/src/pages/pageContent.ts:10-13`
- `src/frontend/src/navigation/appNavigation.tsx:8-13`
- `src/frontend/src/navigation/appNavigation.tsx:51-67`
- `src/frontend/src/navigation/appNavigation.tsx:98-102`

**Evidence**

1. `src/frontend/src/pages/ClassesPage.tsx:1-16` is still a standalone page component that renders only a placeholder `PageSection` using `pageContent.classes`.
2. `src/frontend/src/pages/pageContent.ts:10-13` still carries a `classes` heading/summary entry solely for that page.
3. `src/frontend/src/navigation/appNavigation.tsx:13` defines `AppNavigationKey` as `'dashboard' | 'assignments' | 'settings'` - there is no `classes` route.
4. `src/frontend/src/navigation/appNavigation.tsx:51-67` builds navigation definitions for only dashboard, assignments, and settings.
5. `src/frontend/src/navigation/appNavigation.tsx:98-102` builds page renderers for only dashboard, assignments, and settings.
6. Repo-wide reachability check during this review:

   ```text
   rg -n "ClassesPage\b" src/frontend/src src/frontend/e2e-tests
   ```

   returned only:

   ```text
   src/frontend/src/pages/ClassesPage.tsx:9:export function ClassesPage() {
   ```

7. Repo-wide usage check for the content entry during this review:

   ```text
   rg -n "pageContent\.classes" src/frontend/src
   ```

   returned only:

   ```text
   src/frontend/src/pages/ClassesPage.tsx:12:      heading={pageContent.classes.heading}
   src/frontend/src/pages/ClassesPage.tsx:13:      summary={pageContent.classes.summary}
   src/frontend/src/pages/pageContent.ts:10:  classes: {
   ```

**Why it matters**

This is confirmed dead code, not a style preference. The action-plan history shows that Classes was moved under `SettingsPage` and the live application reflects that migration, but the original top-level placeholder page was left behind. Keeping it in-tree creates two bad outcomes:

1. it preserves a fake app surface that no user can reach;
2. it suggests to future agents that there is still a top-level Classes page contract to maintain.

That is classic migration residue: technically harmless, but actively misleading.

**Recommended simplification**

Delete the dead surface rather than documenting around it.

**Concrete remediation steps**

1. Delete `src/frontend/src/pages/ClassesPage.tsx`.
2. Remove `pageContent.classes` from `src/frontend/src/pages/pageContent.ts` if no other live caller is introduced.
3. Re-run a reachability search:

   ```text
   rg -n "ClassesPage\b|pageContent\.classes" src/frontend/src src/frontend/e2e-tests
   ```

4. Run the lightweight frontend validation for page/navigation fallout:

   ```text
   npm run frontend:test -- src/pages/pages.spec.tsx src/navigation/appNavigation.spec.tsx src/pages/SettingsPage.spec.tsx
   npm run frontend:lint
   npm exec tsc -- -b src/frontend/tsconfig.json
   ```

### 2. `ABClass` still carries a legacy positional-constructor compatibility branch that production no longer uses

**Location**

- `src/backend/Models/ABClass.js:55-77`
- `src/backend/y_controllers/ABClassController.js:572-577`
- `tests/helpers/controllerTestHelpers.js:24-36`
- representative test callers in the action-plan area, e.g.:
  - `tests/controllers/abclass-controller-partials.test.js:89`
  - `tests/controllers/abclass-roster-sync.test.js:83`
  - `tests/models/abclass.assignment.test.js:37`

**Evidence**

1. `src/backend/Models/ABClass.js:55-77` explicitly supports two constructor modes:
   - a single options object; or
   - a legacy positional argument list.
2. In the reviewed production backend path, `src/backend/y_controllers/ABClassController.js:572-577` creates `ABClass` using only the object form:

   ```javascript
   const abClass = new ABClass({ classId });
   ```

3. Production usage search during this review:

   ```text
   rg -n "new ABClass\(" src/backend
   ```

   returned only:

   ```text
   src/backend/y_controllers/ABClassController.js:576:    const abClass = new ABClass({ classId });
   ```

4. Test/helper usage still depends on the positional branch. The shared helper `tests/helpers/controllerTestHelpers.js:35` does this:

   ```javascript
   const abClass = new ABClass(courseId, className);
   ```

5. The same pattern is repeated across many backend tests in the action-plan slice. Representative search results captured during this review included:

   ```text
   tests/controllers/abclass-controller-partials.test.js:89:    const abClass = new ABClass('class-001', 'Test Class Alpha');
   tests/controllers/abclass-roster-sync.test.js:83:    const abClass = new ABClass('class-r01', 'Roster Sync Class');
   tests/models/abclass.assignment.test.js:37:      const abClass = new ABClass('class-idx', 'Test Class');
   ```

**Why it matters**

This is a confirmed over-general API, not a theoretical concern. The live runtime has already converged on the object-form constructor, but the model still exposes a wider compatibility surface because tests and helpers were never migrated. That creates three maintenance problems:

1. the constructor is harder to understand than the live runtime requires;
2. future changes must preserve both calling conventions even though only one is real;
3. tests are keeping old production complexity alive.

This is exactly the kind of slop that accumulates after a migration: the app gets simpler, but the foundational model never sheds the scaffolding.

**Recommended simplification**

Migrate tests and shared test helpers to the object form first, then delete the positional branch from `ABClass`.

**Concrete remediation steps**

1. Update `tests/helpers/controllerTestHelpers.js` to construct `ABClass` like this:

   ```javascript
   const abClass = new ABClass({ classId: courseId, className });
   ```

2. Update backend tests that still call `new ABClass('id', 'name')` to the object form.
3. Once no callers remain, simplify `src/backend/Models/ABClass.js:55-77` to accept only the object-form constructor.
4. Re-run a caller search to confirm the branch is dead:

   ```text
   rg -n "new ABClass\(" src/backend tests
   ```

5. Validate with the model/controller suites most likely to break:

   ```text
   npm test -- tests/models/abclass.test.js tests/models/abclass.assignment.test.js tests/models/abclass.partial.test.js
   npm test -- tests/controllers/abclass-controller-partials.test.js tests/controllers/abclass-roster-sync.test.js tests/controllers/abclass-upsert-update.test.js
   npm run lint
   ```

### 3. The frontend Classes/query layer still exposes dead workstream scaffolding that production does not use

This item groups four separate cases of confirmed dead or stale scaffolding in the same feature slice.

#### 3a. `useSelectedRows` is a dead export kept alive only by its own spec

**Location**

- `src/frontend/src/features/classes/selectionState.ts:20-35`
- `src/frontend/src/features/classes/selectionState.spec.ts:3`
- `src/frontend/src/features/classes/selectionState.spec.ts:27-30`
- `src/frontend/src/features/classes/selectionState.spec.ts:49-50`

**Evidence**

1. `selectionState.ts:27-35` exports `useSelectedRows`.
2. Repo-wide caller search during this review:

   ```text
   rg -n "useSelectedRows\b" src/frontend/src src/frontend/e2e-tests tests
   ```

   returned only:

   ```text
   src/frontend/src/features/classes/selectionState.ts:27:export function useSelectedRows(
   src/frontend/src/features/classes/selectionState.spec.ts:3:import { pruneSelectedRowKeys, useSelectedRows } from './selectionState';
   src/frontend/src/features/classes/selectionState.spec.ts:30:        useSelectedRows(currentRows, selectedRowKeys),
   src/frontend/src/features/classes/selectionState.spec.ts:50:    const { result } = renderHook(() => useSelectedRows(rows, []));
   ```

3. The live feature shell does not use it. `ClassesManagementPanel` computes selected rows inline from `classesManagement.rows` and `classesManagement.selectedRowKeys`.

**Why it matters**

This is a dead helper abstraction. It expands the feature API surface, invites future callers to depend on a hook the feature does not actually need, and keeps tests focused on an implementation path the app no longer exercises.

**Recommended simplification**

Delete `useSelectedRows` and reduce the spec to the still-live `pruneSelectedRowKeys` helper, or move that remaining assertion into the consumer spec if you want to reduce the file further.

#### 3b. `warmClassPartials()` is a dead export kept alive only by its own spec

**Location**

- `src/frontend/src/query/sharedQueries.ts:94-102`
- `src/frontend/src/query/sharedQueries.query.spec.tsx:105-113`

**Evidence**

1. `sharedQueries.ts:100-102` exports `warmClassPartials()`.
2. Repo-wide caller search during this review:

   ```text
   rg -n "warmClassPartials\(" src/frontend/src src/frontend/e2e-tests tests
   ```

   returned only:

   ```text
   src/frontend/src/query/sharedQueries.ts:100:export function warmClassPartials(queryClient: QueryClient): Promise<ClassPartial[]> {
   src/frontend/src/query/sharedQueries.query.spec.tsx:112:    await expect(warmClassPartials(queryClient)).resolves.toEqual(classPartials);
   ```

3. The live startup path uses `warmStartupQueries()` from `AppAuthGate`; there is no production caller of the narrower helper.

**Why it matters**

This is dead transitional API. It looks like an earlier warm-up entry point that survived after the startup contract expanded to `classPartials + cohorts + yearGroups`.

**Recommended simplification**

Remove `warmClassPartials()` and its dedicated test, unless you intentionally want to expose and support a single-dataset warm-up API.

#### 3c. Two query-invalidation schema exports are declared but not consumed anywhere

**Location**

- `src/frontend/src/features/classes/queryInvalidation.zod.ts:26-40`

**Evidence**

1. `queryInvalidation.zod.ts:26-29` exports `requiredClassPartialsRefreshOutcomeSchema`.
2. `queryInvalidation.zod.ts:38-40` exports `RequiredClassPartialsRefreshOutcomeBase`.
3. Repo-wide consumer search during this review:

   ```text
   rg -n "requiredClassPartialsRefreshOutcomeSchema|RequiredClassPartialsRefreshOutcomeBase" src/frontend/src src/frontend/e2e-tests tests
   ```

   returned only the declaration lines in `queryInvalidation.zod.ts`.

4. The live code uses the success/failure branch schemas directly (`requiredClassPartialsRefreshSuccessOutcomeSchema` and `requiredClassPartialsRefreshFailureOutcomeSchema`) via `queryInvalidation.ts`.

**Why it matters**

These exports make the module look more general than it is. They are dead public surface area with no behavioural value.

**Recommended simplification**

Delete the unused schema export and unused inferred base type. Keep only the schemas/types that production actually imports.

#### 3d. `hasErrorStartupDataset` is computed but never read

**Location**

- `src/frontend/src/features/classes/useClassesManagement.ts:32-37`
- `src/frontend/src/features/classes/useClassesManagement.ts:130-139`

**Evidence**

1. `useClassesManagement.ts:34` declares `hasErrorStartupDataset` in `ClassesQueriesState`.
2. `useClassesManagement.ts:136` computes that field.
3. Repo-wide search during this review:

   ```text
   rg -n "hasErrorStartupDataset" src/frontend/src/features/classes src/frontend/src/features/auth
   ```

   returned only the declaration and the assignment inside `useClassesManagement.ts`.

4. The non-ready state logic uses `hasPendingStartupDataset`, `hasAnyBlockingDataGap`, and `startupWarmupFailed`; it never branches on `hasErrorStartupDataset`.

**Why it matters**

This is dead state in the readiness model. It makes the derived state shape look richer than the component logic actually is.

**Recommended simplification**
