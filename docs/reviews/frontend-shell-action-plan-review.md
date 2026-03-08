# Frontend shell action plan review

## Verdict

Pass with improvements.

## Scope reviewed

- `ACTION_PLAN.md`
- `src/frontend/src/App.tsx`
- `src/frontend/src/AppThemeShell.tsx`
- `src/frontend/src/AppShell.tsx`
- `src/frontend/src/navigation/appNavigation.tsx`
- `src/frontend/src/pages/*`
- `src/frontend/src/index.css`
- `src/frontend/src/*.spec.tsx`
- `src/frontend/e2e-tests/*.spec.ts`

## Findings

### 🔴 Critical

None.

### 🟡 Improvement

1. `AppShell` rebuilds Ant Design `Menu` item objects on every render via `toMenuItems(navigationItems)` in JSX. Consider memoising the transformed menu model (`useMemo`) so item identity stays stable and unnecessary downstream work is avoided as shell state changes.  
   Affected area: `src/frontend/src/AppShell.tsx`.

2. `isAppNavigationKey` currently performs an array scan each time (`navigationItems.some(...)`). Given keys are static, consider using a module-level `Set<AppNavigationKey>` for constant-time lookups and clearer intent.  
   Affected area: `src/frontend/src/navigation/appNavigation.tsx`.

3. The side rail transition is explicitly disabled (`transition: none`). If product UX expects visible motion on collapse/expand, a token-aligned transition could improve perceived responsiveness while keeping behaviour deterministic.  
   Affected area: `src/frontend/src/index.css`.

### ⚪ Nitpick

1. None.

## Validation run

- `npm run frontend:lint` ✅
- `npm exec tsc -- -b src/frontend/tsconfig.json` ✅
- `npm run frontend:test` ✅
- `npm run frontend:test:coverage` ✅
- `npm run frontend:test:e2e` ✅

## Notes

Playwright browser and OS dependencies were installed in this environment using `npx playwright install --with-deps chromium`, after which all E2E checks passed.
