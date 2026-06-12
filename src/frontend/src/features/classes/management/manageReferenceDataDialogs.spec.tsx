/**
 * Shared reference-data dialog helper tests.
 *
 * Covers the shared form and delete inline-dialog branches used by the cohorts
 * and year-groups modal workflows.
 */

import { Form } from 'antd';
import { render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it } from 'vitest';
import {
  ReferenceDataDeleteDialog,
  ReferenceDataFormDialog,
  type ReferenceDataFormValues,
} from './manageReferenceDataDialogs';

type ReferenceDataFormDialogProperties = ComponentProps<typeof ReferenceDataFormDialog>;
type ReferenceDataDeleteDialogProperties = ComponentProps<typeof ReferenceDataDeleteDialog>;

/**
 * Provides an Ant Form instance to the shared dialog for test rendering.
 *
 * @param {Omit<ReferenceDataFormDialogProperties, 'form'>} properties Dialog properties excluding `form`.
 * @returns {JSX.Element} Dialog rendered with an internally created form instance.
 */
function ReferenceDataFormDialogHarness(
  properties: Omit<ReferenceDataFormDialogProperties, 'form'>,
) {
  const [form] = Form.useForm<ReferenceDataFormValues>();

  return <ReferenceDataFormDialog {...properties} form={form} />;
}

/**
 * Renders the shared form dialog with defaults overridden by the provided properties.
 *
 * @param {Partial<Omit<ReferenceDataFormDialogProperties, 'form'>>} [properties] Property overrides.
 * @returns {void}
 */
function renderReferenceDataFormDialog(
  properties: Partial<Omit<ReferenceDataFormDialogProperties, 'form'>> = {},
) {
  const defaultProperties: Omit<ReferenceDataFormDialogProperties, 'form'> = {
    labelId: 'reference-data-form-dialog-title',
    title: 'Create cohort',
    formKey: 'create',
    initialName: null,
    formError: null,
    formSubmitting: false,
    validationMessage: 'Please enter a cohort name.',
    onClose: () => {},
    onFinish: async () => {},
    onOk: () => {},
  };

  render(<ReferenceDataFormDialogHarness {...defaultProperties} {...properties} />);
}

/**
 * Renders the shared delete dialog with defaults overridden by the provided properties.
 *
 * @param {Partial<ReferenceDataDeleteDialogProperties>} [properties] Property overrides.
 * @returns {void}
 */
function renderReferenceDataDeleteDialog(
  properties: Partial<ReferenceDataDeleteDialogProperties> = {},
) {
  const defaultProperties: ReferenceDataDeleteDialogProperties = {
    labelId: 'reference-data-delete-dialog-title',
    title: 'Delete cohort',
    entityLabel: 'cohort',
    entityName: 'Cohort 2025',
    error: null,
    blocked: false,
    submitting: false,
    onClose: () => {},
    onConfirm: () => {},
  };

  render(<ReferenceDataDeleteDialog {...defaultProperties} {...properties} />);
}

describe('ReferenceDataFormDialog', () => {
  it('renders no alert and leaves the name field blank when formError and initialName are null', () => {
    renderReferenceDataFormDialog();

    const dialog = screen.getByRole('dialog', { name: /create cohort/i });

    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: /name/i })).toHaveValue('');
  });

  it('renders an alert and pre-fills the name field when formError and initialName are provided', () => {
    renderReferenceDataFormDialog({
      initialName: 'Cohort 2025',
      formError: 'Unable to save the cohort.',
      title: 'Edit cohort',
      formKey: 'edit',
    });

    const dialog = screen.getByRole('dialog', { name: /edit cohort/i });

    expect(within(dialog).getByRole('alert')).toHaveTextContent('Unable to save the cohort.');
    expect(within(dialog).getByRole('textbox', { name: /name/i })).toHaveValue('Cohort 2025');
  });
});

describe('ReferenceDataDeleteDialog', () => {
  it('renders fallback delete copy and keeps the delete button enabled when entityName and error are null', () => {
    renderReferenceDataDeleteDialog({
      entityName: null,
      error: null,
    });

    const dialog = screen.getByRole('dialog', { name: /delete cohort/i });

    expect(dialog).toHaveTextContent('Are you sure you want to delete this cohort?');
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /delete/i })).toBeEnabled();
  });

  it('renders the provided entity name when delete confirmation has no error', () => {
    renderReferenceDataDeleteDialog({
      entityName: 'Cohort 2025',
      error: null,
    });

    const dialog = screen.getByRole('dialog', { name: /delete cohort/i });

    expect(dialog).toHaveTextContent('Are you sure you want to delete Cohort 2025?');
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders an alert when delete error text is provided', () => {
    renderReferenceDataDeleteDialog({
      entityName: 'Cohort 2025',
      error: 'Unable to delete the cohort.',
    });

    const dialog = screen.getByRole('dialog', { name: /delete cohort/i });

    expect(within(dialog).getByRole('alert')).toHaveTextContent('Unable to delete the cohort.');
  });

  it('disables the delete button when blocked is true', () => {
    renderReferenceDataDeleteDialog({
      blocked: true,
    });

    const dialog = screen.getByRole('dialog', { name: /delete cohort/i });

    expect(within(dialog).getByRole('button', { name: /delete/i })).toBeDisabled();
  });

  it('disables the delete button when submitting is true', () => {
    renderReferenceDataDeleteDialog({
      submitting: true,
    });

    const dialog = screen.getByRole('dialog', { name: /delete cohort/i });

    expect(within(dialog).getByRole('button', { name: /delete/i })).toBeDisabled();
  });
});
