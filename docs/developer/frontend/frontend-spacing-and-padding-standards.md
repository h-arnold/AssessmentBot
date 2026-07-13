# Frontend Spacing and Padding Standards

This is the canonical standards document for spacing and padding decisions in `src/frontend`. All frontend agents **must** read this document before adding, modifying, or reviewing any UI element that affects layout spacing.

Use it alongside:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-shell-navigation-and-motion.md`
- `docs/developer/frontend/frontend-logging-and-error-handling.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

## 1. Ant Design Spacing System

Ant Design's spacing philosophy is defined in the [Proximity design principle](https://ant.design/docs/spec/proximity). The system is based on an **8px grid** with the formula:

```
y = 8 + 8 × n   (where n ≥ 0, y = spacing value, 8 = basic spacing unit)
```

### 1.1 Three Standard Spacing Formats

| Format             | Value | Usage                                                           |
| ------------------ | ----- | --------------------------------------------------------------- |
| **Small spacing**  | 8px   | Tightly related elements; compact layouts                       |
| **Middle spacing** | 16px  | Related but distinct elements; default between grouped elements |
| **Large spacing**  | 24px  | Section-level separations; container padding                    |

### 1.2 Derived Spacing Values (Common Multiples)

| n   | Value | Usage                                           |
| --- | ----- | ----------------------------------------------- |
| 0   | 8px   | Small spacing                                   |
| 1   | 16px  | Middle spacing                                  |
| 2   | 24px  | Large spacing                                   |
| 3   | 32px  | Extra-large (section margins, large containers) |
| 4   | 40px  | Page-level margins                              |
| 5   | 48px  | Major section separations                       |

> **4px (half-unit) exceptions:** The 4px value is **not** part of Ant Design's standard scale. It is permitted only for tight inner-element spacing such as filter-dropdown items, metric-pill compact mode, or inline icon-to-text gaps. These are documented exceptions and should remain rare.

## 2. CSS Custom Property Spacing Tokens

These custom properties are the **single source of truth** for spacing values in CSS and inline styles. Add them to `src/frontend/src/index.css`:

```css
:root {
  /* Spacing tokens — aligned to Ant Design 8px grid */
  --app-spacing-xs: 4px; /* Half-unit exception (tight inner-element spacing only) */
  --app-spacing-sm: 8px; /* Small spacing */
  --app-spacing-md: 16px; /* Middle spacing */
  --app-spacing-lg: 24px; /* Large spacing */
  --app-spacing-xl: 32px; /* Extra-large (section margins, large containers) */
  --app-spacing-xxl: 48px; /* Major section separations */
}
```

**Rules for using tokens (by priority):**

1. When adding spacing to a file that already references these tokens, reuse the existing token.
2. When using spacing in CSS classes, reference the custom property (e.g. `padding: var(--app-spacing-lg)`).
3. When using spacing in inline `style` props, prefer the raw pixel value that maps to a token (e.g. `padding: 24` is valid; `padding: 27` is not).
4. Never introduce a spacing value that is not a multiple of 8, unless it is a documented 4px exception (see §1.2).

## 3. Container-Level Spacing Rules

### 3.1 App Content Area (`.app-content`)

The shell content area **must** use consistent padding across all pages:

```css
.app-content {
  padding: var(--app-spacing-lg) var(--app-spacing-md);
  /* = 24px top/bottom, 16px left/right */
}
```

- **Vertical padding**: `var(--app-spacing-lg)` — 24px
- **Horizontal padding**: `var(--app-spacing-md)` — 16px

This applies to the outermost content wrapper rendered by `AppShell` and affects the positioning of the breadcrumb and all page content.

### 3.2 Page Content Container (`.app-page-content`)

The page content container centres content and applies a max-width:

```css
.app-page-content {
  width: min(var(--app-page-width-wide-data), calc(100% - 1rem));
}
```

This does **not** add additional padding — it constrains width only. Pages share this container identically via the `PageSection` component.

### 3.3 Breadcrumb (`.app-breadcrumb`)

```css
.app-breadcrumb {
  margin-bottom: 1.5rem; /* 24px — aligned to var(--app-spacing-lg) */
}
```

This value is correct and should not be changed.

## 4. Component-Level Spacing Rules

### 4.1 Ant Design Component Defaults

Ant Design components have baked-in spacing that follows the 8px grid. **Do not override these defaults unless there is a documented UX justification.**

| Component                       | Default Spacing Token | Default Value | Notes                                                    |
| ------------------------------- | --------------------- | ------------- | -------------------------------------------------------- |
| `Card` (`size="medium"`)        | `bodyPadding`         | 24px          | Do not change                                            |
| `Card` (`size="small"`)         | `bodyPaddingSM`       | 12px          | Fits within 8px grid                                     |
| `Card` header (`size="medium"`) | `headerPadding`       | 24px          | Do not change                                            |
| `Card` header (`size="small"`)  | `headerPaddingSM`     | 12px          | Fits within 8px grid                                     |
| `Space` (`size="small"`)        | —                     | 8px           | Maps to `var(--app-spacing-sm)`                          |
| `Space` (`size="middle"`)       | —                     | 16px          | Maps to `var(--app-spacing-md)`                          |
| `Space` (`size="large"`)        | —                     | 24px          | Maps to `var(--app-spacing-lg)`                          |
| `Typography.Title`              | `titleMarginBottom`   | 0.5em         | Do not override                                          |
| `Typography.Title`              | `titleMarginTop`      | 1.2em         | Do not override                                          |
| `Flex` gap                      | —                     | —             | Use token values only: `{sm: 8}`, `{md: 16}`, `{lg: 24}` |

**Card size convention:** List/grid _data_ cards (e.g. class cards in a grid, per-row/per-item cards in tables, bulk-action cards) **must** use `size="small"`. Standalone _settings / configuration_ panels (e.g. the `settings-tab-panel` cards, `BackendSettingsPanel` cards, `AuthStatusCard`) use `size="medium"` (the Ant default — do not set `size`). Rationale: small keeps dense list/grid layouts compact; medium gives standalone config surfaces room. This is intentional, not an inconsistency.

**Text button restriction:** `Button type="text"` is permitted **only** for (a) icon-only actions such as back/chevron buttons, and (b) header-inline toggles in the app shell. All other action buttons (including in-card "View"/"Assess Task" style actions) **must** use the default button (or `primary` where it is the primary action), which carries Ant's standard `paddingInline` (15px medium / 7px small). Do not use `type="text"` for labelled in-card actions.

### 4.2 Space Component Usage

Use `Space` for aligning related controls:

- `size="small"` (8px) — tightly related action buttons, icon + label pairs
- `size="middle"` (16px) — related but distinct controls, default choice
- `size="large"` (24px) — section-level groupings, distinct operation groups

Do not use a numeric `size` value that is not an 8px multiple. If you need custom spacing, use `Flex` with `gap` set to a token-aligned value.

### 4.3 Flex Gap Usage

When using `Flex` with `gap`, use token-aligned values:

```tsx
// ✅ Correct: token-aligned gap
<Flex vertical gap={16}>
<Flex vertical gap="small"> {/* maps to 8px */}
<Flex vertical gap="middle"> {/* maps to 16px */}
<Flex vertical gap="large"> {/* maps to 24px */}

// ❌ Avoid: non-standard values
<Flex vertical gap={13}>
<Flex vertical gap={18}>
```

### 4.5 Card Inner Spacing

When a `Card` contains multiple child sections, prefer Ant Design's built-in `Card` padding over additional wrapper padding. Children inside a `Card` body should use `Space` or `Flex` with token-aligned gaps rather than wrapping in extra `<div>` elements with margins.

### 4.6 Inline-Dialog Container

The `InlineDialog` container uses `padding: 24` with `marginTop: 16` — both values align to the 8px grid and are correct. Do not change these values.

### 4.7 Canonical Gap Constants

All inter-element gaps/spacings expressed in TSX must come from a single constant module:

- **Module path:** `src/frontend/src/theme/spacing.ts` (created during implementation; this section documents its intended contract).
- **Exports and their token mapping:**

  | Constant                 | Value      | Maps To                            |
  | ------------------------ | ---------- | ---------------------------------- |
  | `APP_GAP_XS`             | `4`        | `--app-spacing-xs`                 |
  | `APP_GAP_SM`             | `8`        | `--app-spacing-sm`                 |
  | `APP_GAP_COMPACT`        | `12`       | Accepted Flex half-step (see §6.2) |
  | `APP_GAP_MD`             | `16`       | `--app-spacing-md`                 |
  | `APP_GAP_LG`             | `24`       | `--app-spacing-lg`                 |
  | `APP_SPACE_SIZE_DEFAULT` | `'middle'` | 16px Space size                    |
  | `APP_SPACE_SIZE_TIGHT`   | `'small'`  | 8px Space size                     |

- **Rule:** Replace magic-number `gap`/`margin`/`padding` literals and implicit `<Space>` sizes with these constants. The `<Space size={0}>` skeleton list pattern in `AssignmentsPage.tsx` is a documented exception (zero-gap skeleton) and need not use a constant.
- **Relationship to CSS tokens:** These constants mirror the existing `--app-spacing-*` CSS custom properties defined in `src/frontend/src/index.css`. The TS module is the TypeScript-side source of truth for component code.

## 5. Inline Style Rules

### 5.1 Permitted Inline Spacing Values

When using inline `style` props, only use values from the spacing token set:

```tsx
// ✅ Correct: token-aligned values
style={{ marginBottom: 16 }}
style={{ padding: '4px 8px' }}  // 4px only for tight inner-element spacing
style={{ marginTop: 24 }}
style={{ gap: 12 }}             // Accepted: Flex gap uses numbers

// ❌ Rejected: non-standard values
style={{ marginBottom: 14 }}
style={{ padding: '5px 9px' }}
style={{ marginTop: 18 }}
```

### 5.2 4px Exception Rules

The 4px (`var(--app-spacing-xs)`) value is permitted **only** for tight inner-element spacing where 8px would be visually too loose. Examples:

- Filter dropdown items: `padding: '4px 8px'` (tight vertical, standard horizontal) — confirmed in `AssignmentsPage.tsx`
- Metric pill compact mode: `padding: '2px 4px'` (tighter still, compact-only) — confirmed in `MetricPill.tsx`
- Icon-to-text inline gap in compact controls

If you introduce a new 4px-level spacing, document the rationale in the component code as a comment.

### 5.3 Inline Margin on Alert Components

Alerts inside modals or cards that need visual separation from child content below should use `marginBottom: 16` (aligned to `var(--app-spacing-md)`). The value of 16 is the standard across the codebase and is correct.

## 6. Current Codebase Audit

The following inconsistencies were identified in the initial audit. These should be addressed opportunistically:

### 6.1 Resolved Baseline

| Location                 | Current Value                                             | Status                            |
| ------------------------ | --------------------------------------------------------- | --------------------------------- |
| `.app-content` padding   | `var(--app-spacing-lg) var(--app-spacing-md)` (24px/16px) | ✅ Resolved — uses spacing tokens |
| `.app-breadcrumb` margin | `1.5rem` (24px)                                           | ✅ Aligned                        |
| Card `bodyPadding`       | 24 (default)                                              | ✅ Aligned                        |
| Card `headerPadding`     | 24 (default)                                              | ✅ Aligned                        |
| Space `size="middle"`    | 16px                                                      | ✅ Aligned                        |

### 6.2 Values Already Aligned (Do Not Change)

The following inline values are already on the 8px grid and should not be changed:

- `padding: '4px 8px'` in `AssignmentsPage.tsx` filter dropdowns — 4px is a permitted half-unit exception
- `padding: 24` in `InlineDialog.tsx` — maps to `var(--app-spacing-lg)`
- `marginBottom: 16` in Alert components across the codebase — maps to `var(--app-spacing-md)`; migrated instances now use `APP_GAP_MD` (see §4.7)
- `gap: 12` in `ClassesManagementPanel.tsx` and `AssignmentsPage.tsx` — 12px is accepted within the 8px system (8 + 4 half-step, permitted for Flex gap); now `APP_GAP_COMPACT` (see §4.7)
- `marginTop: 16` in `InlineDialog.tsx` — maps to `var(--app-spacing-md)`
- `marginTop: 8` in `AssignmentDefinitionWizardModalShell.tsx` — maps to `var(--app-spacing-sm)`
- `gap: 16` in `TaskHeatmapPage.tsx` and `AssignmentsPage.tsx` — maps to `var(--app-spacing-md)`; now `APP_GAP_MD` (see §4.7)
- `gap: 24` in `BackendSettingsPanel.tsx` — maps to `var(--app-spacing-lg)`; now `APP_GAP_LG` (see §4.7)

> These literals have been replaced with the canonical `theme/spacing.ts` constants (see §4.7).

### 6.3 Check-Once Values (Borderline)

- `ClassesPage.tsx` card gap derives from `APP_GAP_MD` (the canonical constant in `src/frontend/src/theme/spacing.ts`; previously a local `CLASSES_CARD_GAP_PX = 16` literal, since removed)
- `CLASSES_CARD_HORIZONTAL_PADDING_FACTOR = 2` — a scaling factor, not a spacing literal
- `ASSIGNMENTS} filter dropdown padding: '4px 8px'` — the 4px vertical is a permitted half-unit exception; the 8px horizontal maps to `var(--app-spacing-sm)`

## 7. Enforcement in Code Review

All frontend code reviews **must** check:

1. **No non-standard spacing values**: Reject any padding, margin, or gap value that is not a multiple of 8 (or a documented 4px exception).
2. **No CSS class introduced without using spacing tokens**: New CSS classes that set padding or margin must reference `var(--app-spacing-*)` tokens.
3. **No inline style spacing without rationale**: Inline spacing values that do not map to a token require a comment explaining the deviation.
4. **Component defaults preserved**: Ant Design component spacing defaults (Card, Typography, Space, etc.) must not be overridden without documented justification.
5. **Consistent horizontal page padding**: All pages must use the same `.app-content` padding (`24px 16px`). Any page-specific override must be approved in code review with documented rationale.

## 8. Relationship to Other Canonical Docs

This document defines spacing and padding rules only.

- Loading, width, and busy-state semantics: `docs/developer/frontend/frontend-loading-and-width-standards.md`
- Shell layout, navigation, and motion conventions: `docs/developer/frontend/frontend-shell-navigation-and-motion.md`
- Logging and error-handling policy: `docs/developer/frontend/frontend-logging-and-error-handling.md`
- Shared helpers and abstraction decisions: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- Tests: `docs/developer/frontend/frontend-testing.md`
- E2E tests: `docs/developer/frontend/frontend-playwright-e2e.md`
