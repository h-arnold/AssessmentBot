/**
 * Dropdown body for the numeric score-range filter.
 *
 * Extracted into its own module (a real React component with no sibling
 * non-component exports) so it satisfies the fast-refresh rule. Renders a
 * two-thumb Ant Design `Slider` bounded by the metric's scoring range, with
 * the range endpoints labelled on the slider and the active `[min, max]`
 * selection shown as text. **Include Not Attempted (N)** and **Include Error
 * (E)** independently let the user keep those non-computed rows while a filter
 * is active. Aggregate surfaces also expose **Include Excluded**. Confirming
 * writes an encoded filter key (with `includeExcluded` appended as its fifth
 * field) into `selectedKeys`; **Reset** clears the selection and all toggles.
 *
 * @module metricRangeFilterDropdown
 */

import { useState } from 'react';
import type { JSX } from 'react';
import { Button, Checkbox, Slider, Typography } from 'antd';
import type { FilterDropdownProps } from 'antd/es/table/interface';

import type { MetricToneRange } from './metricTone';
import {
  createDefaultMetricRangeFilterState,
  decodeMetricFilter,
  encodeMetricFilter,
  type MetricRangeFilterFlags,
  type MetricRangeFilterState,
} from './metricRangeKey';

/** Step interval for the range slider. */
const RANGE_SLIDER_STEP = 0.5;

type MetricRangeFilterDropdownProperties = FilterDropdownProps & {
  /** Scoring bounds used by the range slider. */
  range: MetricToneRange;
  /** Optional slider interval. */
  step?: number;
  /** Whether the aggregate-only **Include Excluded** toggle is available. */
  showExcludedToggle?: boolean;
};

type ApplyFilterOptions = Readonly<{
  /** Complete state to encode and render. */
  state: MetricRangeFilterState;
  /** Whether Ant Design should close the dropdown after applying. */
  closeDropdown: boolean;
}>;

type MetricRangeFilterStateToggle = Readonly<{
  /** Filter-state field controlled by the checkbox. */
  stateFlag: keyof MetricRangeFilterFlags;
  /** User-visible checkbox label. */
  label: string;
}>;

/** Checkbox descriptors for the independently selectable non-computed states. */
const METRIC_RANGE_FILTER_STATE_TOGGLES = [
  {
    stateFlag: 'includeNotAttempted',
    label: 'Include Not Attempted (N)',
  },
  {
    stateFlag: 'includeError',
    label: 'Include Error (E)',
  },
  {
    stateFlag: 'includeExcluded',
    label: 'Include Excluded',
  },
] as const satisfies readonly MetricRangeFilterStateToggle[];

/**
 * Dropdown body for a numeric score-range filter.
 *
 * @param {MetricRangeFilterDropdownProperties} dropdownProperties -
 *   Ant Design filter-dropdown props plus the scoring range and surface options.
 * @returns {JSX.Element} The dropdown body.
 */
export function MetricRangeFilterDropdown({
  range,
  step = RANGE_SLIDER_STEP,
  selectedKeys,
  setSelectedKeys,
  confirm,
  showExcludedToggle = true,
}: MetricRangeFilterDropdownProperties): JSX.Element {
  const defaultState = createDefaultMetricRangeFilterState(range.lower, range.upper);
  const initialState: MetricRangeFilterState = decodeMetricFilter(selectedKeys[0]) ?? defaultState;
  const hydratedState: MetricRangeFilterState = {
    ...initialState,
    includeExcluded: showExcludedToggle ? initialState.includeExcluded : false,
  };

  const [filterState, setFilterState] = useState<MetricRangeFilterState>(hydratedState);

  const applyFilter = ({ state, closeDropdown }: ApplyFilterOptions): void => {
    setFilterState(state);
    setSelectedKeys([encodeMetricFilter(state)]);
    confirm({ closeDropdown });
  };

  const applyStateToggle = (
    stateFlag: keyof MetricRangeFilterFlags,
    checked: boolean
  ): void => {
    const nextState: MetricRangeFilterState = {
      ...filterState,
      [stateFlag]: checked,
    };
    applyFilter({ state: nextState, closeDropdown: false });
  };

  const marks: Record<string, string> = {
    [String(range.lower)]: String(range.lower),
    [String(range.upper)]: String(range.upper),
  };
  const availableStateToggles = METRIC_RANGE_FILTER_STATE_TOGGLES.filter(
    ({ stateFlag }) => stateFlag !== 'includeExcluded' || showExcludedToggle
  );

  return (
    <div style={{ padding: 8, width: 240 }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          width: '100%',
        }}
      >
        <Typography.Text type="secondary">
          Showing {filterState.min} – {filterState.max}
        </Typography.Text>
        <Slider
          range
          min={range.lower}
          max={range.upper}
          step={step}
          marks={marks}
          value={[filterState.min, filterState.max]}
          onChange={(value): void => {
            const nextBounds = value as [number, number];
            setFilterState((current) => ({
              ...current,
              min: nextBounds[0],
              max: nextBounds[1],
            }));
          }}
          onChangeComplete={(value): void => {
            const nextBounds = value as [number, number];
            applyFilter({
              state: {
                ...filterState,
                min: nextBounds[0],
                max: nextBounds[1],
              },
              closeDropdown: true,
            });
          }}
        />
        {availableStateToggles.map(({ stateFlag, label }) => (
          <Checkbox
            key={stateFlag}
            checked={filterState[stateFlag]}
            onChange={(event): void => {
              applyStateToggle(stateFlag, event.target.checked);
            }}
          >
            {label}
          </Checkbox>
        ))}
        <Button
          size="small"
          onClick={(): void => {
            setFilterState(createDefaultMetricRangeFilterState(range.lower, range.upper));
            setSelectedKeys([]);
            confirm({ closeDropdown: true });
          }}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
