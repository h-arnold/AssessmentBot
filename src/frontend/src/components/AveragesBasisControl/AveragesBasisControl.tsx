/**
 * Shared "Averages basis" control for the Class page's two averaging views.
 *
 * @remarks
 * A `Segmented` control toggling the analysis mode between `absolute`
 * ("All tasks") and `topDecileBaseline` ("Baseline tasks"). It carries no card
 * chrome of its own: the host table card renders it in its top-right `extra`
 * and owns the surrounding `Card`. While a baseline failure blocks the page,
 * the host renders this control in a fallback header card instead, so the
 * escape route back to `absolute` stays reachable (see
 * docs/pedagogy/data-analysis-scoring.md § Averages basis).
 *
 * The group label is visually hidden (`sr-only`) to keep the card header
 * uncluttered, but stays in the accessibility tree and remains the
 * `aria-labelledby` target, so the accessible name "Averages basis" survives.
 *
 * DOM contract:
 * - the control's accessible name is the visually hidden group label via
 *   `aria-labelledby`, overriding the underlying hard-coded
 *   `aria-label="segmented control"`;
 * - the control itself is disabled only while availability is `awaiting-data`
 *   (neither antd nor the underlying control emits `aria-disabled`, so the
 *   disabled state surfaces as the root disabled class plus disabled radio
 *   inputs);
 * - when availability is `ineligible`, the control stays enabled so the
 *   `absolute` escape route remains selectable; only the `topDecileBaseline`
 *   option is disabled, and its per-option tooltip carries the reason. The
 *   fail-fast guard against entering baseline with an ineligible roster is this
 *   disabled option (the derivation still throws if baseline is forced);
 * - the baseline option carries its explanatory tooltip whenever availability
 *   is `ready`;
 * - an sr-only description node is always rendered so the `aria-describedby`
 *   target is reachable, carrying the availability reason whenever one is
 *   present and rendering empty for `ready`. `aria-describedby` is bound
 *   exactly while the control itself is disabled, so the `awaiting-data`
 *   reason is discoverable without hover;
 * - per-option tooltips are not supplied while the control itself is disabled:
 *   antd wraps option tooltips unconditionally, so a disabled-state hover would
 *   otherwise fire competing popups alongside the root reason tooltip; the
 *   control is never wrapped in a span (the root is a div that receives Tooltip
 *   handlers, and the disabled style sets no `pointer-events: none`).
 */

import type { JSX } from 'react';
import { Flex, Segmented, Tooltip, Typography } from 'antd';
import type { AnalysisMode } from '@/services/dataAnalysis/dataAnalysis.zod';
import type { BaselineAvailability } from '@/features/shared/baselineAvailability';
import { pageContent } from '@/pages/pageContent';
import { APP_GAP_SM } from '@/theme/spacing';

/** Stable DOM ids (the Class page mounts once per selected class). */
const MODE_CONTROL_LABEL_ID = 'class-page-mode-control-label';
const MODE_CONTROL_DESCRIPTION_ID = 'class-page-mode-control-description';

type AveragesBasisControlProperties = Readonly<{
  /** The currently selected analysis mode. */
  analysisMode: AnalysisMode;
  /** Change the analysis mode (page-owned state; no persistence). */
  onAnalysisModeChange: (mode: AnalysisMode) => void;
  /** Availability of baseline mode (disabled state + reason copy). */
  baselineAvailability: BaselineAvailability;
}>;

/**
 * Resolve the baseline option's tooltip for the current availability.
 *
 * `ready` shows the explanatory mode copy; `ineligible` shows the unmet
 * eligibility condition on the disabled option; `awaiting-data` shows none
 * because the root tooltip already carries that reason and a second popup
 * would compete with it.
 *
 * @param {BaselineAvailability} availability - The current availability state.
 * @returns {string | undefined} The tooltip copy, or undefined for no tooltip.
 */
function resolveBaselineOptionTooltip(availability: BaselineAvailability): string | undefined {
  switch (availability.status) {
    case 'ready': {
      return pageContent.classDetail.baselineModeOptionTooltip;
    }
    case 'ineligible': {
      return availability.reason ?? undefined;
    }
    case 'awaiting-data': {
      return undefined;
    }
  }
}

/**
 * Render the shared analysis-mode control for a host card's `extra` slot.
 *
 * @param {AveragesBasisControlProperties} properties - Component properties.
 * @param {AnalysisMode} properties.analysisMode - Current analysis mode.
 * @param {(mode: AnalysisMode) => void} properties.onAnalysisModeChange - Mode-change handler.
 * @param {BaselineAvailability} properties.baselineAvailability - Availability state.
 * @returns {JSX.Element} The rendered mode control.
 */
export function AveragesBasisControl({
  analysisMode,
  onAnalysisModeChange,
  baselineAvailability,
}: AveragesBasisControlProperties): JSX.Element {
  const isControlDisabled = baselineAvailability.status === 'awaiting-data';
  const isBaselineOptionDisabled = baselineAvailability.status !== 'ready';
  const baselineOptionTooltip = resolveBaselineOptionTooltip(baselineAvailability);

  // Per-option tooltips are withheld while the control itself is disabled so
  // they cannot compete with the root reason tooltip (see module remarks).
  const options = [
    { value: 'absolute' as const, label: pageContent.classDetail.absoluteModeOptionLabel },
    {
      value: 'topDecileBaseline' as const,
      label: pageContent.classDetail.baselineModeOptionLabel,
      disabled: isBaselineOptionDisabled,
      ...(baselineOptionTooltip !== undefined && { tooltip: baselineOptionTooltip }),
    },
  ];

  return (
    <Flex wrap align="center" gap={APP_GAP_SM}>
      <Typography.Text id={MODE_CONTROL_LABEL_ID} className="sr-only">
        {pageContent.classDetail.modeControlLabel}
      </Typography.Text>
      {/* Always present so the `aria-describedby` target is reachable
          while disabled (HeatmapSelectionBar precedent). */}
      <span id={MODE_CONTROL_DESCRIPTION_ID} className="sr-only">
        {baselineAvailability.reason ?? ''}
      </span>
      <Tooltip
        title={isControlDisabled ? baselineAvailability.reason : undefined}
        trigger={['hover', 'focus']}
      >
        <Segmented
          size="small"
          value={analysisMode}
          onChange={onAnalysisModeChange}
          options={options}
          disabled={isControlDisabled}
          aria-labelledby={MODE_CONTROL_LABEL_ID}
          aria-describedby={isControlDisabled ? MODE_CONTROL_DESCRIPTION_ID : undefined}
        />
      </Tooltip>
    </Flex>
  );
}
