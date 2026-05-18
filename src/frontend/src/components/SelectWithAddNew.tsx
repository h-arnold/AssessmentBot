import { useCallback, type ReactElement } from 'react';
import { Select, type SelectProps } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useDebounce, DEFAULT_DEBOUNCE_MS } from '../hooks/useDebounce';

/**
 * Sentinel value used internally to identify the 'Add new' option.
 * This value will never be a valid entity key.
 */
const ADD_NEW_SENTINEL_VALUE = '__ADD_NEW_SENTINEL__';

/**
 * Entity types supported by the 'Add new' option.
 */
export type EntityType = 'cohort' | 'yearGroup' | 'topic';

/**
 * Props for the SelectWithAddNew component.
 */
export interface SelectWithAddNewProperties extends Omit<SelectProps, 'options'> {
  /**
   * Callback when 'Add new' is clicked.
   */
  onAddNew?: () => void;

  /**
   * Custom label for the 'Add new' option.
   * If not provided, will use entityType to generate a default label.
   */
  addNewLabel?: string;

  /**
   * Entity type for default label generation.
   * Used when addNewLabel is not provided.
   */
  entityType?: EntityType;

  /**
   * Debounce duration for the onAddNew callback in milliseconds.
   * Defaults to DEFAULT_DEBOUNCE_MS (300ms).
   */
  debounceMs?: number;

  /**
   * The options to display in the Select dropdown.
   */
  options?: SelectProps['options'];
}

/**
 * Generates a default 'Add new' label based on entity type.
 *
 * @param {EntityType} entityType - The entity type.
 * @returns {string} The default label.
 */
function getDefaultAddNewLabel(entityType: EntityType): string {
  switch (entityType) {
    case 'cohort': {
      return 'Add new cohort';
    }
    case 'yearGroup': {
      return 'Add new year group';
    }
    case 'topic': {
      return 'Add new topic';
    }
    default: {
      return 'Add new';
    }
  }
}

/**
 * SelectWithAddNew component - wraps Ant Design Select with an 'Add new' option.
 *
 * @remarks This component wraps Ant Design Select with a custom sentinel option for 'Add new'.
 * The 'Add new' option appears at the bottom of the dropdown and triggers the onAddNew callback
 * when clicked. The callback is debounced to prevent rapid repeated modal opens.
 *
 * @param {SelectWithAddNewProperties} properties - The component props.
 * @returns {ReactElement} The rendered Select component with 'Add new' option.
 */
export function SelectWithAddNew(
  properties: Readonly<SelectWithAddNewProperties>
): ReactElement {
  const {
    onAddNew,
    addNewLabel,
    entityType,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    options = [],
    disabled,
    onChange,
    ...restProperties
  } = properties;

  // Generate the 'Add new' label
  const computedAddNewLabel = addNewLabel ?? (entityType ? getDefaultAddNewLabel(entityType) : 'Add new');

  // Debounce the onAddNew callback
  const debouncedOnAddNew = useDebounce(onAddNew ?? (() => {}), debounceMs);

  // Handle selection change
  const handleChange = useCallback(
    (value: unknown, option: unknown) => {
      // If the sentinel value is selected, trigger onAddNew and prevent the value from being set
      if (value === ADD_NEW_SENTINEL_VALUE) {
        debouncedOnAddNew();
        // Return early to prevent the sentinel value from being used
        return;
      }

      // For normal options, call the original onChange if provided
      if (onChange) {
        onChange(value, option as Parameters<NonNullable<SelectProps['onChange']>>[1]);
      }
    },
    [debouncedOnAddNew, onChange]
  );

  // Build options with 'Add new' at the bottom
  const optionsWithAddNew: SelectProps['options'] = [
    ...options,
    {
      value: ADD_NEW_SENTINEL_VALUE,
      label: (
        <span aria-label={computedAddNewLabel}>
          <PlusOutlined /> {computedAddNewLabel}
        </span>
      ),
      disabled,
      key: ADD_NEW_SENTINEL_VALUE,
    },
  ];

  return (
    <Select
      {...restProperties}
      options={optionsWithAddNew}
      onChange={handleChange}
      disabled={disabled}
    />
  );
}
