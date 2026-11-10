/**
 * Mode-control slot for the Class page header (attempt-baseline layout spec,
 * "Class-page header — mode-control slot").
 *
 * @remarks
 * A `Segmented` control toggling the Class page's analysis mode between
 * `absolute` ("All tasks") and `topDecileBaseline` ("Baseline tasks"), hosted
 * in a `Card size="small"` as the header's third stacked element so the
 * control stays reachable in every non-loading state — including blocking
 * failures, where the escape route back to `absolute` lives (SPEC decision
 * 6a).
 *
 * DOM contract:
 * - the control's accessible name is the visible group label via
 *   `aria-labelledby`, overriding the underlying hard-coded
 *   `aria-label="segmented control"`;
 * - the control is disabled only when {@link BaselineAvailability} blocks
 *   (neither antd nor the underlying control emits `aria-disabled`, so the
 *   disabled state surfaces as the root disabled class plus disabled radio
 *   inputs);
 * - an sr-only description node is always rendered so the `aria-describedby`
 *   target is reachable, carrying the availability reason while disabled and
 *   rendering empty while enabled (`aria-describedby` is bound exactly while
 *   disabled) — the reason is discoverable without hover;
 * - per-option tooltips are supplied only in the enabled branch: antd wraps
 *   option tooltips unconditionally, so a disabled-state hover would otherwise
 *   fire competing popups alongside the root reason tooltip; the control is
 *   never wrapped in a span (the root is a div that receives Tooltip handlers,
 *   and the disabled style sets no `pointer-events: none`).
 */

import type { JSX } from 'react';
import { Card, Flex, Segmented, Tooltip, Typography } from 'antd';
import type { AnalysisMode } from '@/services/dataAnalysis/dataAnalysis.zod';
import type { BaselineAvailability } from './useClassPageData.helpers';
import { APP_GAP_SM } from '@/theme/spacing';

// Visible control copy (layout spec control states; the `pageContent.classDetail`
// copy home is wired in a later section of the plan).
const MODE_CONTROL_LABEL = 'Averages basis';
const ABSOLUTE_OPTION_LABEL = 'All tasks';
const BASELINE_OPTION_LABEL = 'Baseline tasks';

/** Baseline-option tooltip summary, supplied only while the control is enabled. */
const BASELINE_OPTION_TOOLTIP =
  'Uses the tasks the ten-percent most-engaged students (minimum 2) have all attempted.';

/** Stable DOM ids (the Class page mounts once per selected class). */
const MODE_CONTROL_LABEL_ID = 'class-page-mode-control-label';
const MODE_CONTROL_DESCRIPTION_ID = 'class-page-mode-control-description';

type ClassPageModeControlProperties = Readonly<{
  /** The currently selected analysis mode. */
  analysisMode: AnalysisMode;
  /** Change the analysis mode (page-owned state; no persistence). */
  onAnalysisModeChange: (mode: AnalysisMode) => void;
  /** Availability of baseline mode (disabled state + reason copy). */
  baselineAvailability: BaselineAvailability;
}>;

/**
 * Render the Class page's analysis-mode control slot.
 *
 * @param {ClassPageModeControlProperties} properties - Component properties.
 * @param {AnalysisMode} properties.analysisMode - Current analysis mode.
 * @param {(mode: AnalysisMode) => void} properties.onAnalysisModeChange - Mode-change handler.
 * @param {BaselineAvailability} properties.baselineAvailability - Availability state.
 * @returns {JSX.Element} The rendered mode-control card.
 */
export function ClassPageModeControl({
  analysisMode,
  onAnalysisModeChange,
  baselineAvailability,
}: ClassPageModeControlProperties): JSX.Element {
  const isDisabled = baselineAvailability.status !== 'ready';

  // Per-option tooltips only in the enabled branch (see module remarks).
  const options = [
    { value: 'absolute' as const, label: ABSOLUTE_OPTION_LABEL },
    isDisabled
      ? { value: 'topDecileBaseline' as const, label: BASELINE_OPTION_LABEL }
      : {
          value: 'topDecileBaseline' as const,
          label: BASELINE_OPTION_LABEL,
          tooltip: BASELINE_OPTION_TOOLTIP,
        },
  ];

  return (
    <Card size="small">
      <Flex wrap align="center" gap={APP_GAP_SM}>
        <Typography.Text id={MODE_CONTROL_LABEL_ID}>{MODE_CONTROL_LABEL}</Typography.Text>
        {/* Always present so the `aria-describedby` target is robustly
            reachable while disabled (HeatmapSelectionBar precedent). */}
        <span id={MODE_CONTROL_DESCRIPTION_ID} className="sr-only">
          {baselineAvailability.reason ?? ''}
        </span>
        <Tooltip
          title={isDisabled ? baselineAvailability.reason : undefined}
          trigger={['hover', 'focus']}
        >
          <Segmented
            size="small"
            value={analysisMode}
            onChange={onAnalysisModeChange}
            options={options}
            disabled={isDisabled}
            aria-labelledby={MODE_CONTROL_LABEL_ID}
            aria-describedby={isDisabled ? MODE_CONTROL_DESCRIPTION_ID : undefined}
          />
        </Tooltip>
      </Flex>
    </Card>
  );
}
