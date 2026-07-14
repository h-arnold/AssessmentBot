/**
 * Tests for MetricRangeFilterDropdown — the Ant Design custom filter dropdown
 * body for numeric score-range filtering.
 *
 * @see metricRangeFilterDropdown.tsx
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FilterDropdownProps } from 'antd/es/table/interface';

import { MetricRangeFilterDropdown } from './metricRangeFilterDropdown';

/** Default scoring range used in tests. */
const DEFAULT_RANGE = { lower: 0, upper: 5 };

/** Number of slider handles (two-thumb slider). */
const SLIDER_HANDLE_COUNT = 2;

/** Number of call invocations expected after toggling a single checkbox. */
const SINGLE_TOGGLE_CALL_COUNT = 1;

/** Number of call invocations expected after toggling two checkboxes. */
const DOUBLE_TOGGLE_CALL_COUNT = 2;

/** First mock invocation index (1-based). */
const FIRST_INVOCATION = 1;
/** Second mock invocation index (1-based). */
const SECOND_INVOCATION = 2;

/**
 * Create a mock `FilterDropdownProps` object with sensible defaults for
 * testing (all callbacks are `vi.fn()`).
 *
 * @param {Partial<FilterDropdownProps>} overrides - Optional overrides for specific props.
 * @returns {FilterDropdownProps} A partial `FilterDropdownProps` suitable for the dropdown.
 */
function createMockDropdownProperties(
  overrides: Partial<FilterDropdownProps> = {}
): FilterDropdownProps {
  return {
    selectedKeys: [],
    setSelectedKeys: vi.fn(),
    confirm: vi.fn(),
    clearFilters: vi.fn(),
    filters: undefined,
    visible: true,
    ...overrides,
  } as unknown as FilterDropdownProps;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

afterEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('MetricRangeFilterDropdown', () => {
  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  it('renders the slider, both checkboxes, and the reset button', () => {
    render(
      <MetricRangeFilterDropdown
        {...createMockDropdownProperties()}
        range={DEFAULT_RANGE}
      />
    );

    // Two-thumb Slider
    const sliders = screen.getAllByRole('slider');
    expect(sliders).toHaveLength(SLIDER_HANDLE_COUNT);

    // Range text display
    expect(screen.getByText(/Showing 0 – 5/)).toBeInTheDocument();

    // Checkboxes
    expect(screen.getByText('Include Not Attempted (N)')).toBeInTheDocument();
    expect(screen.getByText('Include Error (E)')).toBeInTheDocument();

    // Reset button
    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Initialisation from existing selectedKeys
  // ---------------------------------------------------------------------------

  it('initialises bounds and checkboxes from an existing encoded key', () => {
    const selectedKeys = ['1|4|1|0']; // min=1, max=4, includeNotAttempted=true

    render(
      <MetricRangeFilterDropdown
        {...createMockDropdownProperties({ selectedKeys })}
        range={DEFAULT_RANGE}
      />
    );

    // The range text reflects the decoded bounds
    expect(screen.getByText(/Showing 1 – 4/)).toBeInTheDocument();

    // The Not Attempted checkbox should be checked
    const nCheckbox: HTMLInputElement = screen.getByRole('checkbox', {
      name: /include not attempted/i,
    });
    expect(nCheckbox.checked).toBe(true);
  });

  it('falls back to default state when selectedKeys contains an invalid key', () => {
    const selectedKeys = ['invalid']; // decodeMetricFilter returns null for this

    render(
      <MetricRangeFilterDropdown
        {...createMockDropdownProperties({ selectedKeys })}
        range={DEFAULT_RANGE}
      />
    );

    // Should fall back to the default range
    expect(screen.getByText(/Showing 0 – 5/)).toBeInTheDocument();

    // Checkboxes should be unchecked
    const nCheckbox: HTMLInputElement = screen.getByRole('checkbox', {
      name: /include not attempted/i,
    });
    expect(nCheckbox.checked).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Include Not Attempted (N) checkbox
  // ---------------------------------------------------------------------------

  it('calls applyFilter with closeDropdown=false when N checkbox is toggled', async () => {
    const user = userEvent.setup();
    const setSelectedKeys = vi.fn();
    const confirm = vi.fn();

    render(
      <MetricRangeFilterDropdown
        {...createMockDropdownProperties({ setSelectedKeys, confirm })}
        range={DEFAULT_RANGE}
      />
    );

    await user.click(screen.getByText('Include Not Attempted (N)'));

    expect(setSelectedKeys).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledWith({ closeDropdown: false });

    // The encoded key must have includeNotAttempted set to 1
    const key = setSelectedKeys.mock.calls[0][0][0] as string;
    expect(key.endsWith('|1|0') || key.endsWith('|1|1')).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Include Error (E) checkbox
  // ---------------------------------------------------------------------------

  it('calls applyFilter with closeDropdown=false when E checkbox is toggled', async () => {
    const user = userEvent.setup();
    const setSelectedKeys = vi.fn();
    const confirm = vi.fn();

    render(
      <MetricRangeFilterDropdown
        {...createMockDropdownProperties({ setSelectedKeys, confirm })}
        range={DEFAULT_RANGE}
      />
    );

    await user.click(screen.getByText('Include Error (E)'));

    expect(setSelectedKeys).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledWith({ closeDropdown: false });

    // The encoded key must have includeError set to 1
    const key = setSelectedKeys.mock.calls[0][0][0] as string;
    expect(key.endsWith('|0|1') || key.endsWith('|1|1')).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Both checkboxes independently
  // ---------------------------------------------------------------------------

  it('toggles N and E checkboxes independently', async () => {
    const user = userEvent.setup();
    const setSelectedKeys = vi.fn();
    const confirm = vi.fn();

    render(
      <MetricRangeFilterDropdown
        {...createMockDropdownProperties({ setSelectedKeys, confirm })}
        range={DEFAULT_RANGE}
      />
    );

    // Toggle N first
    await user.click(screen.getByText('Include Not Attempted (N)'));
    expect(setSelectedKeys).toHaveBeenCalledTimes(SINGLE_TOGGLE_CALL_COUNT);

    // Then toggle E
    await user.click(screen.getByText('Include Error (E)'));
    expect(setSelectedKeys).toHaveBeenCalledTimes(DOUBLE_TOGGLE_CALL_COUNT);

    // Both confirms should have closeDropdown: false
    expect(confirm).toHaveBeenNthCalledWith(FIRST_INVOCATION, { closeDropdown: false });
    expect(confirm).toHaveBeenNthCalledWith(SECOND_INVOCATION, { closeDropdown: false });
  });

  // ---------------------------------------------------------------------------
  // Reset button
  // ---------------------------------------------------------------------------

  it('resets state and calls setSelectedKeys([]) with confirm closeDropdown=true on Reset', async () => {
    const user = userEvent.setup();
    const setSelectedKeys = vi.fn();
    const confirm = vi.fn();

    render(
      <MetricRangeFilterDropdown
        {...createMockDropdownProperties({ setSelectedKeys, confirm })}
        range={DEFAULT_RANGE}
      />
    );

    // First toggle N to change state away from defaults
    await user.click(screen.getByText('Include Not Attempted (N)'));
    expect(setSelectedKeys).toHaveBeenCalledTimes(SINGLE_TOGGLE_CALL_COUNT);

    // Then click Reset
    await user.click(screen.getByRole('button', { name: /reset/i }));

    // setSelectedKeys should have been called with [] on reset
    expect(setSelectedKeys).toHaveBeenCalledTimes(DOUBLE_TOGGLE_CALL_COUNT);
    expect(setSelectedKeys).toHaveBeenLastCalledWith([]);

    // confirm should have been called with closeDropdown: true on reset
    expect(confirm).toHaveBeenLastCalledWith({ closeDropdown: true });
  });

  it('reset works without any prior interaction (clean state)', async () => {
    const user = userEvent.setup();
    const setSelectedKeys = vi.fn();
    const confirm = vi.fn();

    render(
      <MetricRangeFilterDropdown
        {...createMockDropdownProperties({ setSelectedKeys, confirm })}
        range={DEFAULT_RANGE}
      />
    );

    await user.click(screen.getByRole('button', { name: /reset/i }));

    // Even without prior interaction, reset should clear and confirm
    expect(setSelectedKeys).toHaveBeenCalledWith([]);
    expect(confirm).toHaveBeenCalledWith({ closeDropdown: true });
  });

  // ---------------------------------------------------------------------------
  // Slider onChangeComplete — keyboard interaction
  // ---------------------------------------------------------------------------
  //
  // The @rc-component/slider Handle component checks `e.which || e.keyCode`
  // in its `onKeyDown` / `handleKeyUp` handlers.  happy-dom's KeyboardEvent
  // does not reliably set the deprecated `which` / `keyCode` properties when
  // using `userEvent.keyboard`, so we use `fireEvent` with explicit keyCode
  // values.
  // ---------------------------------------------------------------------------

  it('calls applyFilter with closeDropdown=true when slider handle is moved via keyboard', () => {
    const setSelectedKeys = vi.fn();
    const confirm = vi.fn();

    render(
      <MetricRangeFilterDropdown
        {...createMockDropdownProperties({ setSelectedKeys, confirm })}
        range={DEFAULT_RANGE}
        step={0.5}
      />
    );

    // Find the first (lower) slider handle
    const sliders = screen.getAllByRole('slider');
    const lowerHandle = sliders[0];
    expect(lowerHandle).toHaveAttribute('aria-valuenow', '0');

    // keydown with ArrowRight (keyCode 39) triggers onOffsetChange in the
    // handle's onKeyDown, which causes the slider to update its value.
    fireEvent.keyDown(lowerHandle, { key: 'ArrowRight', keyCode: 39, which: 39 });

    // keyup with ArrowRight fires onChangeComplete in handleKeyUp
    fireEvent.keyUp(lowerHandle, { key: 'ArrowRight', keyCode: 39, which: 39 });

    // onChangeComplete should have fired applyFilter, which calls
    // setSelectedKeys and confirm({ closeDropdown: true })
    expect(setSelectedKeys).toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledWith({ closeDropdown: true });
  });

  // ---------------------------------------------------------------------------
  // Step prop
  // ---------------------------------------------------------------------------

  it('uses custom step value when provided', () => {
    render(
      <MetricRangeFilterDropdown
        {...createMockDropdownProperties()}
        range={DEFAULT_RANGE}
        step={1}
      />
    );

    // The slider handles should have aria-valuenow values at step boundaries
    const sliders = screen.getAllByRole('slider');
    expect(sliders).toHaveLength(SLIDER_HANDLE_COUNT);
    expect(sliders[0]).toHaveAttribute('aria-valuenow', '0');
    // Upper handle should start at 5 (the range upper bound)
    expect(sliders[1]).toHaveAttribute('aria-valuenow', '5');
  });

  // ---------------------------------------------------------------------------
  // Encoding correctness — the dropdown's output key must be decodable
  // ---------------------------------------------------------------------------

  it('produces a key that decodeMetricFilter can parse back', async () => {
    const user = userEvent.setup();
    const setSelectedKeys = vi.fn();
    const confirm = vi.fn();

    render(
      <MetricRangeFilterDropdown
        {...createMockDropdownProperties({ setSelectedKeys, confirm })}
        range={DEFAULT_RANGE}
      />
    );

    // Toggle N checkbox to trigger applyFilter
    await user.click(screen.getByText('Include Not Attempted (N)'));

    const key = setSelectedKeys.mock.calls[0][0][0] as string;
    // Import and check round-trip
    const { decodeMetricFilter } = await import('./metricRangeKey');
    const decoded = decodeMetricFilter(key);
    expect(decoded).not.toBeNull();
    expect(decoded!.includeNotAttempted).toBe(true);
    expect(decoded!.min).toBe(DEFAULT_RANGE.lower);
    expect(decoded!.max).toBe(DEFAULT_RANGE.upper);
  });
});
