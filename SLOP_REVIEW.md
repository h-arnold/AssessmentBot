# De-Sloppification Review: ClassesWindow Feature

## Files read

- `/home/developer/AssessmentBot/AGENTS.md`
- `/home/developer/AssessmentBot/src/frontend/AGENTS.md`
- `/home/developer/AssessmentBot/docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `/home/developer/AssessmentBot/docs/developer/frontend/frontend-loading-and-width-standards.md`
- `/home/developer/AssessmentBot/docs/developer/frontend/frontend-shell-navigation-and-motion.md`
- `/home/developer/AssessmentBot/SPEC.md`
- `/home/developer/AssessmentBot/CLASSES_PAGE_LAYOUT.md`
- `/home/developer/AssessmentBot/src/frontend/src/pages/ClassesPage.tsx`
- `/home/developer/AssessmentBot/src/frontend/src/pages/classes/classesPageModel.ts`
- `/home/developer/AssessmentBot/src/frontend/src/pages/classes/classesPageModel.spec.ts`
- `/home/developer/AssessmentBot/src/frontend/src/pages/ClassesPage.spec.tsx`
- `/home/developer/AssessmentBot/src/frontend/e2e-tests/classes-page.spec.ts`
- `/home/developer/AssessmentBot/src/frontend/src/navigation/appNavigation.tsx`
- `/home/developer/AssessmentBot/src/frontend/src/navigation/appNavigation.spec.tsx`
- `/home/developer/AssessmentBot/src/frontend/src/pages/pageContent.ts`

Additionally searched for shared patterns across:

- `/home/developer/AssessmentBot/src/frontend/src/features/classes/ClassesTable.helpers.ts`
- `/home/developer/AssessmentBot/src/frontend/src/features/classes/ClassesTable.sorting.ts`
- `/home/developer/AssessmentBot/src/frontend/src/features/classes/classesManagementViewModel.ts`
- `/home/developer/AssessmentBot/src/frontend/src/errors/blockingLoadError.ts`
- `/home/developer/AssessmentBot/src/frontend/src/pages/AssignmentsPage.tsx`
- `/home/developer/AssessmentBot/src/frontend/src/index.css`

## Summary

**Verdict: Needs Improvement**

The ClassesWindow feature is well-structured and follows the SPEC closely. No blocking issues were found. The feature correctly keeps its view model page-local (per the documented helper decision in `frontend-shared-helpers-and-abstraction-standards.md` §9.11), uses the canonical `renderNavigationPage` contract in `appNavigation.tsx`, and consumes shared page copy from `pageContent.ts`. However, there are several medium-grade slop findings: dead exports, stale accessibility attributes, duplicated type definitions in tests, and cargo-cult JSDoc on self-describing functions. None of these are blocking, but they add maintenance friction.

---

## Critical

_No confirmed critical slop found._

None of the in-scope files contain dead code paths, silently swallowed errors, duplicated orchestration skeletons, or misleading abstractions that would block production use. The following items were investigated and ruled out:

- **`compareStringsLocally` vs shared helpers**: This is a local helper with one call site. Per `frontend-shared-helpers-and-abstraction-standards.md` §4.1, logic with one call site and no independent contract should stay local. The `localeCompare` pattern also appears in `ClassesTable.helpers.ts`, `ClassesTable.sorting.ts`, and `classesManagementViewModel.ts`, but these serve different sorting contexts and extracting them into a shared helper now would be a speculative one-caller wrapper. **No action.**
- **Blocking/loading surface-state functions**: `shouldBlockSingleDataset`, `hasRecoveredDataset`, `isDatasetRenderable`, `getClassesSurfaceState`, and `getFinalClassesPageStates` are structurally similar to `AssignmentsPage`'s surface-state computation, but the trust-boundary and dataset-count logic differs materially. The duplication is structural resemblance, not copy-pasted logic. **No action.**
- **`forceRender` on `Collapse.Panel`**: Required to keep panel content in the DOM for accessibility attributes (`id`, `aria-expanded`) on the content div regardless of collapse state. Without it, collapsed panels would have no DOM presence for the test-required accessible regions. **No action.**
- **Ant Design Collapse v6 deprecation of `Collapse.Panel`**: The code intentionally uses the children pattern for keyboard navigation support, with documented rationale. This is a known trade-off, not slop. **No action.**

---

## Improvement

### 1. Stale `aria-expanded` attribute on panel content divs

- **Location**: `src/frontend/src/pages/ClassesPage.tsx`, lines 215–219 in `renderYearGroupCollapse`
- **Evidence**: `const isExpanded = defaultExpandedPanelKeys.includes(panel.yearGroupKey);` is computed once from the view model's initial default keys. Ant Design's `Collapse` manages its own internal open/close state. After a user collapses or expands a panel, the `aria-expanded` on the custom content `<div>` will not reflect the actual state. Meanwhile, Ant Design's `Collapse.Panel` header button already manages its own `aria-expanded` correctly.
- **Why it matters**: Screen readers will receive conflicting expansion state from the header button (correct) vs the content region (stale). This is a genuine accessibility defect, albeit a subtle one. The content `div`'s `aria-expanded` is checked by Vitest tests but will drift from reality after any user interaction.
- **Recommended simplification**: Either (a) remove the `aria-expanded` from the content `<div>` entirely and rely on Ant Design's built-in header `aria-expanded`, or (b) track expansion state through Ant Design's `onChange` callback and derive `aria-expanded` from live state. Option (a) is simpler and matches Ant Design's intended usage.

### 2. Unnecessarily exported types in model module

- **Location**: `src/frontend/src/pages/classes/classesPageModel.ts`, lines 25 and 35
- **Evidence**: `ClassesPageCardModel` and `ClassesPagePanelModel` are exported but never directly imported by any consumer. `ClassesPage.tsx` imports only `buildClassesPageModel` and `InvalidClassesPageDataViewModel`. The test file re-declares these types rather than importing them. `ClassesPagePanelViewModel` is implicitly consumed through the return type of `buildClassesPageModel` but is also never directly imported.
- **Why it matters**: Dead exports clutter the public API surface and create false signals about which types are intended for external consumption. They make it harder to determine whether a type change is a breaking change.
- **Recommended simplification**: Unexport `ClassesPageCardModel`, `ClassesPagePanelModel`, and `ClassesPagePanelViewModel`. These are internal implementation details of the model builder. The return type of `buildClassesPageModel` already communicates the shape through TypeScript inference. Only `InvalidClassesPageDataViewModel` needs to remain exported since it is directly imported by `ClassesPage.tsx`.

### 3. Duplicated type definitions in model spec

- **Location**: `src/frontend/src/pages/classes/classesPageModel.spec.ts`, lines 21–40
- **Evidence**: The test file re-declares `ClassesPageCardModel`, `ClassesPagePanelModel`, `ClassesPagePanelViewModel`, and `InvalidClassesPageDataViewModel` as local types rather than importing them from `./classesPageModel`. The import at line 51 uses `any` typing (`const module = (await import('./classesPageModel')) as any;`) which bypasses type checking on the import.
- **Why it matters**: Duplicated type definitions create a maintenance risk — the test types can drift from the source types without TypeScript catching it. The `any` cast on the import silently swallows any structural mismatch.
- **Recommended simplification**: Replace the dynamic `import()` with `any` + try-catch pattern with a static import of the types from `./classesPageModel`. Remove the duplicated local type declarations. For example:

  ```ts
  import {
    buildClassesPageModel,
    type ClassesPagePanelViewModel,
    type InvalidClassesPageDataViewModel,
  } from './classesPageModel';
  ```

  The `try-catch` wrapper and `any` cast are TDD scaffolding from the RED phase and should be removed now that the implementation exists.

### 4. `shouldBlockSingleDataset` accepts a derivable parameter

- **Location**: `src/frontend/src/pages/ClassesPage.tsx`, lines 24–43
- **Evidence**: The function accepts `hasTrustworthyDataset` as a parameter (line 33), but this value is derivable from two other parameters it already receives: `isDatasetReady` (line 30) and `isDatasetTrustworthy` (line 31). At the call site (`getClassesSurfaceState`, line 138), the caller computes `hasTrustworthyDataset` separately and passes it in, introducing coupling between the caller's pre-computation and the function's expectations.
- **Why it matters**: The parameter adds surface area without adding expressive power. The function could derive `hasTrustworthyDataset` internally, removing the coupling and reducing the caller's responsibility. This is a mild anti-pattern of over-parameterisation.
- **Recommended simplification**: Remove the `hasTrustworthyDataset` parameter and compute it inside the function as `input.isDatasetReady && input.isDatasetTrustworthy`. The final `return` condition on line 41 uses only `hasTrustworthyDataset`, which would become `input.isDatasetReady && input.isDatasetTrustworthy && input.isQueryError`.

### 5. `isModelEmpty` uses unsafe inline casting

- **Location**: `src/frontend/src/pages/ClassesPage.tsx`, lines 188–195
- **Evidence**: The function casts the model result to `Record<string, unknown>` and then to `{ panels: unknown[] }` and `{ defaultExpandedPanelKeys: unknown[] }` in a single expression with triple inline casts. While functionally correct (the `'panels' in` guard catches the invalid case), this pattern is fragile — renaming `panels` or `defaultExpandedPanelKeys` in the model would silently break this check without a compile error.
- **Why it matters**: Brittle type assertions masquerading as type guards. If the model shape changes, the `'panels' in` check would still pass syntactically but the length checks would operate on the wrong data.
- **Recommended simplification**: Use a proper discriminated union type guard. Since `ClassesPagePanelViewModel` has `panels` and `InvalidClassesPageDataViewModel` has `type`, a type-narrowing guard function would be safer:

  ```ts
  function isEmptyViewModel(
    modelResult: ClassesPagePanelViewModel | InvalidClassesPageDataViewModel
  ): boolean {
    if ('type' in modelResult) return false;
    return modelResult.panels.length === 0 && modelResult.defaultExpandedPanelKeys.length === 0;
  }
  ```

### 6. Inline hardcoded pixel values in render function

- **Location**: `src/frontend/src/pages/ClassesPage.tsx`, lines 238–240
- **Evidence**: The flex container and empty-state card use hardcoded pixel values: `flex: '1 1 200px'`, `minWidth: 200`, `gap: '16px'`, and `marginTop: '16px'`. Per `frontend-loading-and-width-standards.md` §7: "Do not duplicate raw width literals across feature code or CSS."
- **Why it matters**: These literals will need to be found and updated individually if the design system's spacing scale or card-width baseline changes.
- **Recommended simplification**: Extract the card minimum width and gap values into named constants at the module level (not shared tokens since these are card-internal layout values, not page/panel widths). The `marginTop: '16px'` on the empty-state `Card` could be replaced with Ant Design's `Space` component or a shared spacing class.

### 7. One-caller wrapper function `renderClassesRefreshStatus`

- **Location**: `src/frontend/src/pages/ClassesPage.tsx`, lines 266–271
- **Evidence**: `renderClassesRefreshStatus()` is a single-caller function that wraps a single JSX element (a `<div>` with `aria-live` and `role`). Per `frontend-shared-helpers-and-abstraction-standards.md` §4.1, extraction is not justified when it "would only rename existing code without removing duplication."
- **Why it matters**: Adds indirection without reducing duplication or owning an independent contract.
- **Recommended simplification**: Inline the JSX directly where `renderClassesRefreshStatus()` is called (line 352). The accessibility attributes are clear enough at the call site.

---

## Nitpick

### 1. Duplicate explanatory comments about `Collapse.Panel` children pattern

- **Location**: `src/frontend/src/pages/ClassesPage.tsx`, lines 198–207 (JSDoc) and lines 212–218 (inline JSX comment)
- **Evidence**: Both comments explain that the `Collapse.Panel` children pattern is used for keyboard navigation and that a `defaultActiveKey` type assertion is needed. The JSDoc on `renderYearGroupCollapse` and the inline JSX comment inside the function body say substantially the same thing.
- **Recommended simplification**: Keep the JSDoc (it serves as API documentation) and remove the inline JSX comment. The inline comment adds noise inside the JSX structure.

### 2. Cargo-cult JSDoc on self-describing functions

- **Location**: `src/frontend/src/pages/ClassesPage.tsx`, lines 163–170 and 176–182
- **Evidence**: Functions like `isClassesSurfaceBusy` and `isModelInvalid` have JSDoc blocks that restate the function name in prose. For example, `isClassesSurfaceBusy`'s JSDoc says "Returns whether the classes surface is busy (fetching)." which adds no information beyond what the function name `isClassesSurfaceBusy` already conveys.
- **Why it matters**: Boilerplate JSDoc creates maintenance burden and noise. Per KISS principle, documentation should add information not already present in names and types.
- **Recommended simplification**: Remove JSDoc from functions whose name and TypeScript signature are fully self-documenting. Keep JSDoc on functions like `shouldBlockSingleDataset` and `getClassesSurfaceState` where the decision logic benefits from documentation.

### 3. Redundant `as const` on dataset state objects

- **Location**: `src/frontend/src/pages/ClassesPage.tsx`, lines 431 and 441
- **Evidence**: The `classPartialsDatasetState` and `yearGroupsDatasetState` objects are suffixed with `as const`. These objects are consumed as `Readonly<{...}>` typed parameters and are never used for literal type narrowing or discriminated union matching. The `as const` adds no type-safety benefit here.
- **Why it matters**: Unnecessary type assertions create false signals about intent. A reader may assume the `as const` is load-bearing when it is not.
- **Recommended simplification**: Remove the `as const` suffixes. The objects are already immutable through their `const` binding and `Readonly<>` consumption.

### 4. `isClassesSurfaceBusyValue` naming redundancy

- **Location**: `src/frontend/src/pages/ClassesPage.tsx`, line 456
- **Evidence**: The variable is named `isClassesSurfaceBusyValue` where the `Value` suffix adds nothing. The function it calls is `isClassesSurfaceBusy`. The suffix appears to distinguish the variable from the function name, but the distinction is already clear from context (one is a function, one is a `const boolean`).
- **Recommended simplification**: Rename to `isClassesSurfaceBusy`. The variable shadows the function name, but since the function is only used once (to initialise this variable), there is no ambiguity.

### 5. `getFinalClassesPageStates` uses `ReturnType<>` parameter indirection

- **Location**: `src/frontend/src/pages/ClassesPage.tsx`, line 374
- **Evidence**: The `classesSurfaceState` parameter is typed as `ReturnType<typeof getClassesSurfaceState>`. While technically correct, this adds a level of indirection — a reader must jump to `getClassesSurfaceState` to understand what fields are available.
- **Recommended simplification**: Inline the return type or extract it as a named type alias. Using `ReturnType<>` is appropriate for generic utilities but adds friction in page-local code where the return type is stable and small.

### 6. `unknown`-typed `viewModel` in `renderClassesContent`

- **Location**: `src/frontend/src/pages/ClassesPage.tsx`, lines 315–322
- **Evidence**: The `viewModel` parameter is typed as `unknown` and then cast inline at line 342 to the panel view model shape. The `renderClassesContent` function already branches on `shouldRenderEmptyState` before reaching the cast, so the cast is safe, but the `unknown` type obscures the actual contract.
- **Recommended simplification**: Use a discriminated union type parameter: `viewModel: ClassesPagePanelViewModel | InvalidClassesPageDataViewModel`. The function already handles the invalid case via `finalShouldRenderBlockingState` (which checks `isModelInvalid`). The `shouldRenderEmptyState` check already guards against the invalid case. With proper typing, the cast at line 342 becomes unnecessary.

### 7. Test file uses `any` cast and dynamic import scaffolding

- **Location**: `src/frontend/src/pages/classes/classesPageModel.spec.ts`, lines 46–60
- **Evidence**: The test imports `buildClassesPageModel` via a dynamic `import()` with an `any` type assertion and a try-catch block that silently catches import failures. A comment on line 59 says "Expected in RED phase — function does not exist yet." The RED phase has passed; the implementation exists.
- **Recommended simplification**: Replace with a static import. Remove the try-catch wrapper, the `any` cast, the `/* eslint-disable */` comments, and the `let` declaration. This is pure TDD scaffolding that has outlived its purpose.

### 8. Missing `key` on refresh status element alongside fragment

- **Location**: `src/frontend/src/pages/ClassesPage.tsx`, lines 350–353
- **Evidence**: The ternary `{properties.isBusy ? renderClassesRefreshStatus() : null}` produces a conditional element inside a fragment. While React handles this correctly, the pattern is slightly unusual — conditional sibling elements in a fragment without keys.
- **Recommended simplification**: This is extremely minor. If `renderClassesRefreshStatus()` is inlined (per Improvement #7), the pattern becomes a clean conditional render. Otherwise, no change needed.

---

## Policy deviation check

No policy deviations found. Specifically verified:

- **Frontend AGENTS.md §2.2 (shared helpers)**: The view model (`classesPageModel.ts`) is kept page-local per the documented decision in `frontend-shared-helpers-and-abstraction-standards.md` §9.11. The feature does not introduce a speculative cross-feature helper. ✅
- **Frontend AGENTS.md §2.2 (query keys)**: The page uses shared query key factories from `sharedQueries.ts` (`getClassPartialsQueryOptions`, `getYearGroupsQueryOptions`). No ad-hoc query key arrays. ✅
- **Frontend AGENTS.md §9 (shell navigation)**: Navigation entry added to `appNavigation.tsx` using the canonical `renderNavigationPage` contract. No second source of truth for routing. ✅
- **Frontend AGENTS.md §5.1 (loading standards)**: Skeleton for initial load, busy affordance for background refresh, blocking alert for untrustworthy data. All three states comply with `frontend-loading-and-width-standards.md`. ✅
- **Frontend AGENTS.md §5.1 (fail-closed)**: Untrustworthy data (null className, null yearGroupKey, unresolved yearGroupKey) all result in the blocking-state treatment per SPEC. ✅
- **Frontend AGENTS.md §8 (Zod validation)**: The model uses Zod-derived types (`ClassPartial`, `YearGroup`) from existing service modules. ✅
- **Core AGENTS.md §3.4 (British English)**: All user-facing text uses British English ("configured", not "configured"). ✅
- **Core AGENTS.md §3.12 (defaults in constructor)**: No defaults set outside constructors. ✅

---

## Cleanup performed

None. This review is read-only as instructed.
