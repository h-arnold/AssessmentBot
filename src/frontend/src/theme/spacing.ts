/**
 * Canonical spacing constants for the frontend.
 *
 * This module is the TypeScript-side source of truth for inter-element gaps
 * and spacing values. Each constant maps to the corresponding `--app-spacing-*`
 * CSS custom property defined in `src/frontend/src/index.css`.
 *
 * | Constant                 | Value | Maps To              |
 * |--------------------------|-------|----------------------|
 * | `APP_GAP_XS`             | 4     | `--app-spacing-xs`   |
 * | `APP_GAP_SM`             | 8     | `--app-spacing-sm`   |
 * | `APP_GAP_COMPACT`        | 12    | Accepted half-step   |
 * | `APP_GAP_MD`             | 16    | `--app-spacing-md`   |
 * | `APP_GAP_LG`             | 24    | `--app-spacing-lg`   |
 * | `APP_SPACE_SIZE_DEFAULT` | 'middle' | 16px Space size   |
 * | `APP_SPACE_SIZE_TIGHT`   | 'small'  | 8px Space size    |
 */

/** 4px — half-unit exception for tight inner-element spacing only. */
export const APP_GAP_XS = 4 as const;

/** 8px — small spacing (`--app-spacing-sm`). */
export const APP_GAP_SM = 8 as const;

/** 12px — accepted Flex compact half-step. */
export const APP_GAP_COMPACT = 12 as const;

/** 16px — middle spacing (`--app-spacing-md`). */
export const APP_GAP_MD = 16 as const;

/** 24px — large spacing (`--app-spacing-lg`). */
export const APP_GAP_LG = 24 as const;

/**
 * Default Ant Design Space size (`'middle'` → 16px).
 * Use for related-but-distinct control groups.
 */
export const APP_SPACE_SIZE_DEFAULT = 'middle' as const;

/**
 * Tight Ant Design Space size (`'small'` → 8px).
 * Use for tightly related action buttons, icon + label pairs.
 */
export const APP_SPACE_SIZE_TIGHT = 'small' as const;

/**
 * Fixed width (px) for the Student Name column. Shared by the Class and Task
 * Heatmap tables for consistent alignment.
 */
export const APP_COL_WIDTH_STUDENT_NAME = 200 as const;

/**
 * Fixed width (px) for a single metric column (e.g. Completeness, Accuracy, SPaG)
 * in the Task Heatmap table. Shows a single-digit score.
 */
export const APP_COL_WIDTH_METRIC = 40 as const;

/**
 * Fixed width (px) for a single MetricPill column in the Student Averages table.
 * Matches the Class Page metric column width (a multiple of 8 per Ant Design
 * spacing standards).
 */
export const APP_COL_WIDTH_METRIC_PILL = 48 as const;
