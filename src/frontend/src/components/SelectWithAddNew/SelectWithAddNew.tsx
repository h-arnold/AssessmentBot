import { useCallback, useState, type ReactElement } from 'react';
import { Select, type SelectProps } from 'antd';
import { Plus } from 'lucide-react';
import { LucideIcon } from '../icons/LucideIcon';

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
   * Callback dispatched immediately when the 'Add new' option is selected by pointer or keyboard.
   * The command is intercepted rather than forwarded through `onChange`.
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
   * The options to display in the Select dropdown.
   */
  options?: NonNullable<SelectProps['options']>;
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
 * Checks the scalar or labelled Select value for the Add new sentinel.
 * @param {unknown} value Selected value from Ant Design.
 * @returns {boolean} Whether the selection represents the sentinel option.
 */
function isAddNewSelection(value: unknown): boolean {
  if (typeof value === 'object' && value !== null && 'value' in value) {
    return value.value === ADD_NEW_SENTINEL_VALUE;
  }
  return value === ADD_NEW_SENTINEL_VALUE;
}

/**
 * SelectWithAddNew component - wraps Ant Design Select with an 'Add new' option.
 *
 * @remarks
 * The 'Add new' sentinel is an immediate command: scalar and `labelInValue` sentinel selections
 * dispatch `onAddNew` and are not adopted as a value or forwarded through `onChange`.
 * When `value` is an own property, the parent controls selection (including explicit `undefined`,
 * represented to Ant Design as `null`). Otherwise, the component owns normal selection state,
 * initialised from `defaultValue`; normal, clear and labelled-value payloads are preserved.
 *
 * @param {SelectWithAddNewProperties} properties - The component props.
 * @returns {ReactElement} The rendered Select component with 'Add new' option.
 */
export function SelectWithAddNew(properties: Readonly<SelectWithAddNewProperties>): ReactElement {
  const {
    onAddNew,
    addNewLabel,
    entityType,
    options = [],
    disabled,
    value,
    defaultValue,
    onChange,
    ...restProperties
  } = properties;

  const isControlled = Object.prototype.hasOwnProperty.call(properties, 'value');
  const [uncontrolledValue, setUncontrolledValue] = useState<unknown>(() => defaultValue);
  const selectedValue = isControlled ? value : uncontrolledValue;

  // Generate the 'Add new' label
  const computedAddNewLabel =
    addNewLabel ?? (entityType ? getDefaultAddNewLabel(entityType) : 'Add new');

  // Handle selection change
  const handleChange = useCallback(
    (value: unknown, option: unknown) => {
      // If the sentinel value is selected, trigger onAddNew and prevent the value from being set
      if (isAddNewSelection(value)) {
        onAddNew?.();
        // Return early to prevent the sentinel value from being used
        return;
      }

      if (!isControlled) {
        setUncontrolledValue(value);
      }

      // For normal options, call the original onChange if provided
      if (onChange) {
        onChange(value, option as Parameters<NonNullable<SelectProps['onChange']>>[1]);
      }
    },
    [isControlled, onAddNew, onChange]
  );

  // Build options with 'Add new' at the bottom
  const optionsWithAddNew: SelectProps['options'] = [
    ...options,
    {
      value: ADD_NEW_SENTINEL_VALUE,
      label: (
        <span aria-label={computedAddNewLabel}>
          <LucideIcon icon={Plus} /> {computedAddNewLabel}
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
      value={selectedValue ?? null}
      onChange={handleChange}
      disabled={disabled}
    />
  );
}
