# Frontend Shell Navigation and Motion Conventions

## Purpose

This document defines the canonical conventions for frontend shell navigation, motion behaviour, and related test selectors used in:

- `src/frontend/src/AppShell.tsx`
- `src/frontend/src/AppThemeShell.tsx`
- `src/frontend/src/navigation/appNavigation.tsx`
- `src/frontend/src/index.css`

Use these rules when extending shell behaviour so future changes stay consistent and performant.

For surface loading, fail-closed degraded-data behaviour, and page or panel width ownership, also read `docs/developer/frontend/frontend-loading-and-width-standards.md`.

## 1. Navigation model and rendering contract

### 1.1 Keep navigation metadata and page rendering centralised

Navigation keys, labels, icons, and the page-render contract must be defined in `src/frontend/src/navigation/appNavigation.tsx` and consumed from there.

- `renderNavigationPage(...)` is the single runtime source of truth for navigation-key-to-page rendering.
- `AppShell` must consume that contract rather than keeping a second page-selection switch.
- Do not duplicate page labels in multiple feature files.

### 1.2 Keep menu item identity stable

`AppShell` must pass memoised Ant Design `Menu` items to avoid rebuilding equivalent object graphs on every render.

Current pattern:

- source model: `navigationItems`
- transformation: `toMenuItems(...)`
- memoisation boundary: `useMemo(() => toMenuItems(navigationItems), [])`

If menu structure becomes dynamic later, keep memoisation but move dependencies to the smallest required set.

### 1.3 Key validation must be explicit and constant-time

When handling menu clicks, validate unknown keys before updating state.

Use a module-level `Set<AppNavigationKey>` for membership checks (`isAppNavigationKey`) rather than repeated array scans.

## 2. Accessibility and selector conventions for navigation icons

### 2.1 Decorative icon wrappers

Navigation icon wrappers are decorative only and must stay hidden from assistive technology:

- wrapper: `<span aria-hidden className="app-navigation-icon">...`
- icon element: `aria-hidden`

Do not reintroduce unnamed `role="img"` wrappers.

### 2.2 Stable selector strategy in tests

For collapsed-menu icon assertions, prefer stable structural selectors over inferred accessibility roles:

- Unit tests: query `.app-navigation-icon`
- E2E tests: when checking toggle button icons, use accessible labels emitted by Ant icons

This avoids brittle tests tied to incidental DOM role output.

## 3. Motion behaviour (theme-first, token-aligned)

### 3.1 Global reduced-motion source of truth

`AppThemeShell` is the shell-level source of truth for OS reduced-motion preference:

- listen to `matchMedia('(prefers-reduced-motion: reduce)')`
- update Ant Design theme token `motion`

When reduced motion is enabled by the OS, Ant Design motion should be disabled by default (`token.motion = false`).

### 3.2 Token-aligned CSS transitions

Shell CSS transitions must consume values provided from Ant tokens (via CSS custom properties) rather than hard-coded easing/duration values.

Current variables:

- `--app-motion-duration-mid` ← `token.motionDurationMid`
- `--app-motion-ease-in-out` ← `token.motionEaseInOut`

### 3.3 CSS reduced-motion fallback

Keep a CSS-level fallback for reduced motion:

- `@media (prefers-reduced-motion: reduce)` sets transition duration/delay to zero for shell sider transitions.

This protects behaviour even when JavaScript media-query handling is unavailable or delayed.

## 4. Future-change checklist

When changing shell navigation or motion, confirm:

1. `App.tsx` remains thin and composition-only.
2. Navigation labels/keys still come from `appNavigation.tsx`.
3. Menu item transformation remains memoised.
4. `isAppNavigationKey` remains fail-fast and constant-time.
5. Decorative icon wrappers remain `aria-hidden`.
6. Motion remains token-aligned (theme token + CSS variables).
7. Reduced-motion behaviour remains honoured in both theme and CSS fallback layers.
8. Vitest and Playwright assertions remain aligned with the selector conventions above.
