/**
 * Shared availability contract for the attempt-baseline analysis mode.
 *
 * Lives in `features/shared` because it crosses two feature directories
 * (`classPage`, which resolves it, and `taskHeatmap`, whose table card hosts
 * the mode control) plus the shared `AveragesBasisControl`; the taskHeatmap
 * feature must not import from `features/classPage`.
 */

/**
 * Availability of the attempt-baseline analysis mode (shared-helpers register
 * §9.27 in
 * docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md).
 *
 * - `ready`: both eligibility conditions hold — the control is enabled.
 * - `awaiting-data`: no usable attempt evidence yet (no successful analysis
 *   result in this mount, a result without `perStudentTaskMetrics`, or no
 *   class roster). Never produced by an eligibility failure.
 * - `ineligible`: the class cannot use baseline mode; `reason` names the
 *   unmet condition.
 *
 * `reason` is the display copy feeding the mode control's tooltip and its
 * sr-only description node; it is populated for both disabled statuses and
 * `null` only for `ready`.
 */
export type BaselineAvailability = Readonly<{
  status: 'ready' | 'awaiting-data' | 'ineligible';
  reason: string | null;
}>;
