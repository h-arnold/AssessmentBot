/**
 * Multi-select with a select-all / select-none dropdown header (issue #342).
 *
 * @remarks
 * The standalone Heatmaps selection bar renders this component once per dependent
 * control (Topics, Assignments), passing that control's cascade-derived options and
 * selection, so the header logic exists once rather than being duplicated across
 * the two Selects.
 *
 * **Controlled query.** The search query is controlled through
 * `showSearch.searchValue`, so the tracked value is exactly the query the dropdown
 * renders (no mirrored state to drift). The query is reset only from `onSelect`
 * (picking an option): rc-select also clears its own search on a deselect-toggle
 * (via `autoClearSearchValue`), on blur and from the allow-clear control.
 * `autoClearSearchValue: false` plus the controlled value neutralise the first two,
 * and `onClear` suppresses the empty `onSearch` the clear control emits. `onChange`
 * cannot discriminate the reset because it also fires for tag removal and
 * allow-clear.
 *
 * **Select all / none.** "Select all" unions the options matching the current query
 * into the existing selection (it never shrinks it) and dispatches the full result
 * through the owning callback, so `selectionCascadeReducer` stays the only selection
 * state machine. "Select none" clears the control's whole selection regardless of the
 * query. The header row is offered only when the full option list has more than one
 * entry.
 *
 * Header activation must neither close the dropdown nor move focus, hence the
 * `preventDefault()` + `stopPropagation()` mousedown guard (Ant Design FAQ).
 *
 * @see docs/plans/HEATMAP_SELECTION_LAYOUT.md
 */

import type { JSX, MouseEvent, ReactElement, ReactNode } from 'react';
import { useMemo, useRef, useState } from 'react';
import { Button, Checkbox, Divider, Flex, Select, Space } from 'antd';
import { APP_GAP_SM } from '@/theme/spacing';

/** One option rendered by the wrapper's Select. */
export type SelectAllDropdownHeaderOption = Readonly<{ value: string; label: string }>;

/** Properties for {@link SelectAllDropdownHeader}. */
export type SelectAllDropdownHeaderProperties = Readonly<{
  /** Id of the element owning the Select's accessible name. */
  labelledBy: string;
  /** Id of the disabled-reason description node, when the control is disabled. */
  describedBy?: string;
  /** Whether the control is disabled (no class loaded). */
  disabled: boolean;
  /** Placeholder shown before a value is selected. */
  placeholder: string;
  /** Copy shown when no option matches the query. */
  notFoundContent: string;
  /** Control qualifier used in the header accessible names ("topics" / "assignments"). */
  controlName: string;
  /** Full option list (post topic cascade, pre search). */
  options: readonly SelectAllDropdownHeaderOption[];
  /** Current selection for this control. */
  selectedValues: readonly string[];
  /** Apply a full replacement selection through the owning callback. */
  onSelectionChange: (values: string[]) => void;
}>;

/** Option count from which the header is offered. */
const HEADER_MINIMUM_OPTIONS = 2;

/**
 * Match an option label against the search query.
 *
 * This is the single label-match rule shared by the dropdown's own option filter and
 * the header's derivation of the shown options, so the two cannot drift apart.
 *
 * @param {ReactNode} label - The label rendered by the Select for an option.
 * @param {string} query - The controlled search query.
 * @returns {boolean} Whether the label matches the query, ignoring case.
 */
function isLabelMatch(label: ReactNode, query: string): boolean {
  return typeof label === 'string' && label.toUpperCase().includes(query.toUpperCase());
}

/**
 * Filter options by the query using the shared label match.
 *
 * @param {readonly SelectAllDropdownHeaderOption[]} options - Full option list.
 * @param {string} query - The controlled search query.
 * @returns {SelectAllDropdownHeaderOption[]} The options the dropdown renders.
 */
function filterShownOptions(
  options: readonly SelectAllDropdownHeaderOption[],
  query: string
): SelectAllDropdownHeaderOption[] {
  return options.filter((option) => isLabelMatch(option.label, query));
}

/**
 * Keep header clicks from closing the dropdown or moving focus.
 *
 * @param {MouseEvent<HTMLDivElement>} event - The header mousedown event.
 * @returns {void}
 */
function handleHeaderMouseDown(event: MouseEvent<HTMLDivElement>): void {
  event.preventDefault();
  event.stopPropagation();
}

/** A Select option carrying its current selection membership for the option renderer. */
type HeaderOption = SelectAllDropdownHeaderOption & Readonly<{ selected: boolean }>;

/**
 * Render one dropdown option as a checkbox row.
 *
 * @remarks
 * Defined at module scope so Ant Design receives a stable renderer rather than a
 * component recreated on every parent render. Selection membership travels with the
 * option data, so the renderer needs no closure over component state.
 *
 * @param {object} option - The flattened option supplied by Ant Design.
 * @param {ReactNode} option.label - The label shown beside the checkbox.
 * @param {HeaderOption} option.data - The source option including its selection flag.
 * @returns {JSX.Element} The checkbox and label row.
 */
function renderHeaderOption({
  label,
  data,
}: Readonly<{
  label?: ReactNode;
  data: HeaderOption;
}>): JSX.Element {
  return (
    <Space>
      <Checkbox checked={data.selected} />
      <span>{label}</span>
    </Space>
  );
}

/** State and actions needed by the select-all header above the dropdown options. */
type HeaderPopupConfiguration = Readonly<{
  hasHeader: boolean;
  hasAllShownSelected: boolean;
  hasSomeShownSelected: boolean;
  controlName: string;
  onSelectAll: () => void;
  onSelectNone: () => void;
}>;

/**
 * Build a dropdown popup renderer bound to the current header state and actions.
 *
 * @remarks
 * The factory and the renderer it returns both live at module scope, so no component
 * is declared inside {@link SelectAllDropdownHeader}. Every dynamic value arrives
 * through `configuration`, keeping the renderer free of React state closures.
 *
 * @param {HeaderPopupConfiguration} configuration - Header state and actions.
 * @returns {(originNode: ReactElement) => JSX.Element} Renderer for the dropdown popup.
 */
function makeHeaderPopupRenderer(
  configuration: HeaderPopupConfiguration
): (originNode: ReactElement) => JSX.Element {
  return function renderHeaderPopup(originNode: ReactElement): JSX.Element {
    return (
      <>
        {configuration.hasHeader ? (
          <div role="presentation" onMouseDown={handleHeaderMouseDown}>
            <Flex
              justify="space-between"
              align="center"
              gap={APP_GAP_SM}
              style={{ padding: APP_GAP_SM }}
            >
              <Checkbox
                checked={configuration.hasAllShownSelected}
                indeterminate={configuration.hasSomeShownSelected}
                onChange={configuration.onSelectAll}
                aria-label={`Select all ${configuration.controlName}`}
              >
                Select all
              </Checkbox>
              <Button
                type="link"
                onClick={configuration.onSelectNone}
                aria-label={`Select none ${configuration.controlName}`}
              >
                Select none
              </Button>
            </Flex>
            <Divider style={{ margin: 0 }} />
          </div>
        ) : null}
        {originNode}
      </>
    );
  };
}

/**
 * Render a searchable multi-select with the select-all header in its dropdown.
 *
 * @param {SelectAllDropdownHeaderProperties} properties - Component properties.
 * @returns {JSX.Element} The rendered control.
 */
export function SelectAllDropdownHeader({
  labelledBy,
  describedBy,
  disabled,
  placeholder,
  notFoundContent,
  controlName,
  options,
  selectedValues,
  onSelectionChange,
}: SelectAllDropdownHeaderProperties): JSX.Element {
  const [query, setQuery] = useState('');
  // `allowClear` emits `onClear` immediately before an empty `onSearch`; see `handleSearch`.
  const clearSuppressesNextSearch = useRef(false);

  const selectedValueSet = useMemo(() => new Set(selectedValues), [selectedValues]);
  const shownOptions = useMemo(() => filterShownOptions(options, query), [options, query]);
  const shownSelectedCount = shownOptions.filter((option) =>
    selectedValueSet.has(option.value)
  ).length;

  const hasHeader = options.length >= HEADER_MINIMUM_OPTIONS;
  const hasAllShownSelected = shownOptions.length > 0 && shownSelectedCount === shownOptions.length;
  const hasSomeShownSelected = shownSelectedCount > 0 && !hasAllShownSelected;

  /**
   * Union the currently shown options into the existing selection.
   *
   * @returns {void}
   */
  const handleSelectAll = (): void => {
    const union = new Set(selectedValues);
    for (const option of shownOptions) {
      union.add(option.value);
    }
    onSelectionChange([...union]);
  };

  /**
   * Clear the control's whole selection, regardless of the query.
   *
   * @returns {void}
   */
  const handleSelectNone = (): void => {
    onSelectionChange([]);
  };

  /**
   * Reset the query when an option is picked from the open dropdown.
   *
   * @returns {void}
   */
  const handleSelect = (): void => {
    setQuery('');
  };

  /**
   * Arm the one-shot suppression of the empty `onSearch` the allow-clear control
   * emits immediately after `onClear`.
   *
   * @returns {void}
   */
  const handleClear = (): void => {
    // Arm only when a query exists: an empty query emits no `onSearch`, so arming
    // then would swallow the next typed character.
    clearSuppressesNextSearch.current = query !== '';
  };

  /**
   * Track the query the dropdown renders.
   *
   * @param {string} value - The search text reported by the Select.
   * @returns {void}
   */
  const handleSearch = (value: string): void => {
    if (clearSuppressesNextSearch.current) {
      clearSuppressesNextSearch.current = false;
      return;
    }
    setQuery(value);
  };

  return (
    <Select
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      mode="multiple"
      allowClear
      showSearch={{
        filterOption: (inputValue, option) => isLabelMatch(option?.label, inputValue),
        searchValue: query,
        autoClearSearchValue: false,
        onSearch: handleSearch,
      }}
      maxTagCount="responsive"
      popupMatchSelectWidth={false}
      placeholder={placeholder}
      value={[...selectedValues]}
      options={options.map((option) => {
        return {
          ...option,
          selected: selectedValueSet.has(option.value),
        };
      })}
      onChange={onSelectionChange}
      onSelect={handleSelect}
      onClear={handleClear}
      notFoundContent={notFoundContent}
      optionRender={renderHeaderOption}
      popupRender={makeHeaderPopupRenderer({
        hasHeader,
        hasAllShownSelected,
        hasSomeShownSelected,
        controlName,
        onSelectAll: handleSelectAll,
        onSelectNone: handleSelectNone,
      })}
      style={{ width: '100%' }}
    />
  );
}
