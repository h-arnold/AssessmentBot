# Lucide Icons Integration Plan

## Goal

Integrate the `lucide-react` icon pack with Ant Design so that lucide icons can be
dropped into the frontend as easily as antd icons, rendered at exactly the same size
(`1em`) as antd icons, and supporting the same ergonomics (`spin`, `rotate`,
`className`, `style`, `onClick`).

## Why this is low-risk

- Ant Design's `Icon` (the default export of `@ant-design/icons`) passes
  `width="1em" height="1em"` to its inner SVG component via `svgBaseProps`.
  Any lucide icon rendered through it is therefore automatically the same size
  as an antd icon.
- `lucide-react@1.23.0` ships its own TypeScript types and is compatible with
  React 19.2.4 and antd 6.3.1 (already in use).

## What was delivered

### 1. Dependency

- Installed `lucide-react` into `src/frontend` (`package.json`, `package-lock.json`).

### 2. Wrapper component

- **New file:** `src/frontend/src/components/icons/LucideIcon.tsx`
  - Exports `LucideIcon` (function component) and its `LucideIconProperties` type.
  - Renders a lucide icon through antd's `Icon`, so it inherits the antd box model,
    the `anticon-spin` animation, and the rotate transform.
  - Default `size = '1em'` matches antd icons; an explicit `size`, `color`
    (default `currentColor`), and `strokeWidth` are forwarded.
  - Accessibility: exposes `aria-label` when a `title` is supplied, otherwise
    `aria-hidden` (decorative).
  - Usage:

    ```tsx
    import { Plus } from 'lucide-react';
    import { LucideIcon } from './components/icons/LucideIcon';

    <LucideIcon icon={Plus} />;
    ```

### 3. Demo migration (proves the drop-in works)

- **Modified:** `src/frontend/src/components/SelectWithAddNew.tsx`
  - Replaced `PlusOutlined` from `@ant-design/icons` with lucide `Plus` via
    `<LucideIcon icon={Plus} />` in the "Add new" option label.
  - This is the only icon migrated; broad migration of the other
    `@ant-design/icons` usages is intentionally out of scope.

## Verification

- `npx tsc -b` (frontend typecheck): passes.
- `eslint` on the two changed files: passes (no warnings/errors).
- Pre-commit hook (staged-files lint + `builder:compile`): expected to pass.

## Out of scope (not requested)

- Vitest unit test for the wrapper (can be added later, delegated to Testing Specialist).
- Bulk migration of remaining `@ant-design/icons` usages to lucide.

## Abstraction justification

Per `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`,
the wrapper owns a coherent cross-feature contract (consistent lucide sizing and
antd-compatible ergonomics) and is justified as shared infrastructure rather than a
single-caller pass-through.
