/**
 * Dropdown body for the numeric score-range filter.
 *
 * Extracted into its own module (a real React component with no sibling
 * non-component exports) so it satisfies the fast-refresh rule. Renders a
 * two-thumb Ant Design `Slider` bounded by the metric's scoring range, with
 * the range endpoints labelled on the slider and the active `[min, max]`
 * selection shown as text. **Include Not Attempted (N)**, **Include Error
 * (E)**, and **Include Excluded** checkboxes independently let the user keep
 * those non-computed rows while a filter is active. Confirming writes an
 * encoded filter key (with `includeExcluded` appended as its fifth field) into
 * `selectedKeys`; **Reset** clears the selection and all three toggles.
 *
 * @module metricRangeFilterDropdown
 */

import { useState } from 'react';
import type { JSX } from 'react';
import { Button, Checkbox, Slider, Typography } from 'antd';
import type { FilterDropdownProps } from 'antd/es/table/interface';

import type { MetricToneRange } from './metricTone';
import {
  decodeMetricFilter,
  encodeMetricFilter,
  type MetricRangeFilterState,
} from './metricRangeKey';

/** Step interval for the range slider. */
const RANGE_SLIDER_STEP = 0.5;

/**
 * Dropdown body for a numeric score-range filter.
 *
 * @param {FilterDropdownProps & { range: MetricToneRange; step?: number }} dropdownProperties -
 *   Ant Design filter-dropdown props plus the scoring `range` and optional `step`.
 * @returns {JSX.Element} The dropdown body.
 */
export function MetricRangeFilterDropdown(
  dropdownProperties: FilterDropdownProps & { range: MetricToneRange; step?: number }
): JSX.Element {
  const {
    range,
    step = RANGE_SLIDER_STEP,
    selectedKeys,
    setSelectedKeys,
    confirm,
  } = dropdownProperties;

  const fallback: MetricRangeFilterState = {
    min: range.lower,
    max: range.upper,
    includeNotAttempted: false,
    includeError: false,
    includeExcluded: false,
  };
  const initial: MetricRangeFilterState = selectedKeys[0]
    ? decodeMetricFilter(selectedKeys[0]) ?? fallback
    : fallback;

  const [bounds, setBounds] = useState<[number, number]>([initial.min, initial.max]);
  const [includeN, setIncludeN] = useState<boolean>(initial.includeNotAttempted);
  const [includeE, setIncludeE] = useState<boolean>(initial.includeError);
  const [includeExcluded, setIncludeExcluded] = useState<boolean>(initial.includeExcluded);

  const applyFilter = (
    nextBounds: [number, number],
    nextN: boolean,
    nextE: boolean,
    nextExcluded: boolean,
    closeDropdown: boolean
  ): void => {
    setSelectedKeys([
      encodeMetricFilter({
        min: nextBounds[0],
        max: nextBounds[1],
        includeNotAttempted: nextN,
        includeError: nextE,
        includeExcluded: nextExcluded,
      }),
    ]);
    confirm({ closeDropdown });
  };

  const marks: Record<string, string> = {
    [String(range.lower)]: String(range.lower),
    [String(range.upper)]: String(range.upper),
  };

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
          Showing {bounds[0]} – {bounds[1]}
        </Typography.Text>
        <Slider
          range
          min={range.lower}
          max={range.upper}
          step={step}
          marks={marks}
          value={bounds}
          onChange={(value): void => setBounds(value as [number, number])}
          onChangeComplete={(value): void => {
            const next = value as [number, number];
            setBounds(next);
            applyFilter(next, includeN, includeE, includeExcluded, true);
          }}
        />
        <Checkbox
          checked={includeN}
          onChange={(event): void => {
            const next = event.target.checked;
            setIncludeN(next);
            applyFilter(bounds, next, includeE, includeExcluded, false);
          }}
        >
          Include Not Attempted (N)
        </Checkbox>
        <Checkbox
          checked={includeE}
          onChange={(event): void => {
            const next = event.target.checked;
            setIncludeE(next);
            applyFilter(bounds, includeN, next, includeExcluded, false);
          }}
        >
          Include Error (E)
        </Checkbox>
        <Checkbox
          checked={includeExcluded}
          onChange={(event): void => {
            const next = event.target.checked;
            setIncludeExcluded(next);
            applyFilter(bounds, includeN, includeE, next, false);
          }}
        >
          Include Excluded
        </Checkbox>
        <Button
          size="small"
          onClick={(): void => {
            setBounds([range.lower, range.upper]);
            setIncludeN(false);
            setIncludeE(false);
            setIncludeExcluded(false);
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
