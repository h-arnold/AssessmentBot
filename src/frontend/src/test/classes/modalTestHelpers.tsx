import { fireEvent, screen, within } from '@testing-library/react';
import React, { useState } from 'react';
import { vi } from 'vitest';
import type { TableColumnType } from 'antd';
import type { ReferenceDataManagementModalScaffoldProperties } from '../../features/referenceData/ReferenceDataManagementModalScaffold';

/* eslint-disable react-refresh/only-export-components */
// Note: This file contains test helper functions, not React components.
// The CreateModalResetHarness function uses React hooks (useState) to manage
// modal open/close state for testing purposes, which triggers this ESLint rule.
// This disable is justified as we're creating test utilities that need React
// state management capabilities, not production components.

/**
 * Common test helpers for modal components in the classes feature.
 */

// ---------------------------------------------------------------------------
// ReferenceDataManagementModalScaffold test helpers
// ---------------------------------------------------------------------------

/**
 * Default test entity type for ReferenceDataManagementModalScaffold tests.
 */
export type TestEntity = {
  key: string;
  name: string;
};

/**
 * Default test columns for ReferenceDataManagementModalScaffold tests.
 */
export const defaultScaffoldColumns: TableColumnType<TestEntity>[] = [
  {
    title: 'Name',
    dataIndex: 'name',
    key: 'name',
  },
];

/**
 * Default test rows for ReferenceDataManagementModalScaffold tests.
 */
export const defaultScaffoldRows: TestEntity[] = [
  { key: 'test-1', name: 'Test Item 1' },
  { key: 'test-2', name: 'Test Item 2' },
];

/**
 * Default loading state element for scaffold tests.
 */
export const defaultLoadingStateElement = <div aria-label="Loading items">Loading...</div>;

/**
 * Default props for ReferenceDataManagementModalScaffold that are shared across tests.
 * Excludes open, onClose, and onCreate which typically vary per test.
 */
export const defaultScaffoldPropertiesBase = {
  modalTitle: 'Test Modal',
  modalClassName: 'test-modal',
  modalWidth: 800,
  createActionLabel: 'Create item',
  tableAriaLabel: 'test items',
  emptyTableCopy: 'No items',
  refreshStatusCopy: 'Refreshing...',
} as const;

/**
 * Builds default scaffold props with common defaults and type safety.
 *
 * @template T
 * @param {object} options Options for building the properties.
 * @param {Partial<ReferenceDataManagementModalScaffoldProperties<T>>} options.overrides Prop overrides.
 * @param {T[]} options.rows Row data (defaults to cast defaultScaffoldRows).
 * @param {TableColumnType<T>[]} options.columns Column definitions (defaults to cast defaultScaffoldColumns).
 * @param {boolean} [options.includeLoadingState=true] Whether to include default loading state.
 * @returns {Omit<ReferenceDataManagementModalScaffoldProperties<T>, 'open' | 'onClose' | 'onCreate'>} Scaffold properties without open/onClose/onCreate.
 */
export function buildDefaultScaffoldProperties<T extends { key: string }>(
  options: {
    overrides?: Partial<ReferenceDataManagementModalScaffoldProperties<T>>;
    rows?: T[];
    columns?: TableColumnType<T>[];
    includeLoadingState?: boolean;
  } = {}
): Omit<ReferenceDataManagementModalScaffoldProperties<T>, 'open' | 'onClose' | 'onCreate'> {
  const { overrides, rows, columns, includeLoadingState = true } = options;

  const finalRows = (rows ?? defaultScaffoldRows) as unknown as T[];
  const finalColumns = (columns ?? defaultScaffoldColumns) as unknown as TableColumnType<T>[];

  const loadingState = includeLoadingState ? defaultLoadingStateElement : undefined;

  return {
    ...defaultScaffoldPropertiesBase,
    isInitialLoading: false,
    isRefreshing: false,
    loadError: null,
    loadingState: loadingState ?? <div>Loading...</div>,
    rows: finalRows,
    columns: finalColumns,
    ...overrides,
  };
}

/**
 * Builds complete scaffold props including open, onClose, and onCreate.
 *
 * @template T
 * @param {object} options Options for building the props.
 * @param {Partial<ReferenceDataManagementModalScaffoldProperties<T>>} options.overrides Prop overrides.
 * @param {T[]} options.rows Row data (defaults to cast defaultScaffoldRows).
 * @param {TableColumnType<T>[]} options.columns Column definitions (defaults to cast defaultScaffoldColumns).
 * @param {boolean} [options.open=true] Whether the modal is open.
 * @param {MockInstance} [options.onClose] onClose mock (will create a new mock if not provided).
 * @param {MockInstance} [options.onCreate] onCreate mock (will create a new mock if not provided).
 * @returns {ReferenceDataManagementModalScaffoldProperties<T>} Complete scaffold props.
 */
export function buildScaffoldProperties<T extends { key: string }>(
  options: {
    overrides?: Partial<ReferenceDataManagementModalScaffoldProperties<T>>;
    rows?: T[];
    columns?: TableColumnType<T>[];
    open?: boolean;
    onClose?: () => void;
    onCreate?: () => void;
  } = {}
): ReferenceDataManagementModalScaffoldProperties<T> {
  const { overrides, rows, columns, open = true, onClose, onCreate } = options;

  return {
    open,
    onClose: onClose ?? (vi.fn() as () => void),
    onCreate: onCreate ?? (vi.fn() as () => void),
    ...buildDefaultScaffoldProperties({ overrides, rows, columns }),
  };
}

/**
 * Gets the dialog element from the rendered scaffold.
 *
 * @param {string} [title] Expected dialog title (defaults to 'Test Modal').
 * @returns {HTMLElement} The dialog element.
 */
export function getScaffoldDialog(title: string = 'Test Modal'): HTMLElement {
  return screen.getByRole('dialog', { name: title });
}

/**
 * Gets the table element from within the scaffold dialog.
 *
 * @param {string} [ariaLabel] Expected table aria-label (defaults to 'test items').
 * @returns {Promise<HTMLElement>} The table element.
 */
export async function getScaffoldTable(ariaLabel: string = 'test items'): Promise<HTMLElement> {
  const dialog = getScaffoldDialog();
  // eslint-disable-next-line security/detect-non-literal-regexp
  return within(dialog).findByRole('table', { name: new RegExp(ariaLabel, 'i') });
}

// ---------------------------------------------------------------------------
// Other modal test helpers
// ---------------------------------------------------------------------------

/**
 * Changes the course-length control value.
 *
 * @param {string} value Input value.
 * @returns {void}
 */
export function changeCourseLength(value: string): void {
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Course length' }), {
    target: { value },
  });
}

/**
 * Opens a named selector and chooses one option by visible label.
 *
 * @param {string} fieldLabel Accessible form label.
 * @param {string} optionLabel Option label to select.
 * @returns {Promise<void>} Completion signal.
 */
export async function chooseOption(fieldLabel: string, optionLabel: string): Promise<void> {
  // Open the dropdown by clicking on the combobox
  fireEvent.mouseDown(screen.getByRole('combobox', { name: fieldLabel }));

  // Find and click the option by its visible text
  // The option might be in a dropdown menu, so we need to find it in the document
  const option = await screen.findByText(optionLabel);
  fireEvent.click(option);
}

/**
 * Creates a harness component that controls modal open state for testing reset-on-cancel behaviour.
 *
 * @template TProperties
 * @param {Readonly<{ modalComponent: React.ReactElement<TProperties> }>} properties Test harness properties.
 * @returns {React.ReactNode} Harness output.
 */
export function CreateModalResetHarness<TProperties extends object>({ modalComponent }: Readonly<{ modalComponent: React.ReactElement<TProperties> }>): React.ReactNode {
  const [open, setOpen] = useState(true);

  const handleReopen = () => setOpen(true);
  const handleCancel = () => setOpen(false);

  // Create a new element with updated props, preserving type safety.
  // React forbids spreading `key` into JSX, so we pass `key` directly on the JSX element.
  const ModalComponent = modalComponent.type;
  const updatedProperties = {
    ...modalComponent.props,
    open: open as TProperties extends { open: infer TOpen } ? TOpen : boolean,
    onCancel: handleCancel as TProperties extends { onCancel: infer TOnCancel } ? TOnCancel : (() => void),
  };

  return (
    <>
      <button type="button" onClick={handleReopen} aria-label="Reopen modal">
        Reopen
      </button>
      <ModalComponent key="test-harness-modal" {...updatedProperties} />
    </>
  );
}

/**
 * Asserts that a message is displayed in the document.
 *
 * @param {string} message The message to check.
 * @returns {Promise<void>}
 */
export async function assertMessage(message: string): Promise<void> {
  expect(await screen.findByText(message)).toBeInTheDocument();
}

/**
 * Asserts that a control is disabled.
 *
 * @param {string} role The role of the control.
 * @param {string} name The accessible name of the control.
 * @returns {void}
 */
export function assertControlDisabled(role: string, name: string): void {
  expect(screen.getByRole(role, { name })).toBeDisabled();
}
