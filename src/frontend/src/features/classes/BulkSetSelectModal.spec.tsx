import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BulkSetSelectModal } from './BulkSetSelectModal';
import {
  chooseOption,
  assertValidationMessage,
  assertErrorMessage,
  assertControlDisabled,
  createMockConfirm,
  createMockConfirmWithError,
} from '../../test/classes/modalTestHelpers';

const selectOptions = [
  { label: 'Cohort 2025', value: 'cohort-2025' },
  { label: 'Cohort 2026', value: 'cohort-2026' },
];

describe('BulkSetSelectModal', () => {
  it('submits through the modal OK action', async () => {
    const onConfirm = vi.fn().mockImplementation(async () => {});

    render(
      <BulkSetSelectModal
        fieldLabel="Cohort"
        open
        options={selectOptions}
        title="Set cohort"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    await chooseOption('Cohort', 'Cohort 2025');
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith('cohort-2025');
    });
  });

  it('shows validation messages for missing and invalid selections', async () => {
    const onConfirm = createMockConfirm();
    const { rerender } = render(
      <BulkSetSelectModal
        fieldLabel="Cohort"
        open
        options={selectOptions}
        title="Set cohort"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await assertValidationMessage('Please select a cohort.');

    await chooseOption('Cohort', 'Cohort 2025');
    rerender(
      <BulkSetSelectModal
        fieldLabel="Cohort"
        open
        options={[{ label: 'Cohort 2027', value: 'cohort-2027' }]}
        title="Set cohort"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await assertValidationMessage('Please select a valid cohort.');
  });

  it('renders submission failures as an inline error alert', async () => {
    render(
      <BulkSetSelectModal
        fieldLabel="Cohort"
        open
        options={selectOptions}
        title="Set cohort"
        onCancel={vi.fn()}
        onConfirm={createMockConfirmWithError(new Error('Update failed.'))}
      />,
    );

    await chooseOption('Cohort', 'Cohort 2025');
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    await assertErrorMessage('Update failed.');
  });

  it('resets local state when the modal closes', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('Update failed.'));

    /**
     * Controls modal open state to verify reset-on-cancel behaviour.
     *
     * @returns {JSX.Element} Harness output.
     */
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Reopen
          </button>
          <BulkSetSelectModal
            fieldLabel="Cohort"
            open={open}
            options={selectOptions}
            title="Set cohort"
            onCancel={() => setOpen(false)}
            onConfirm={onConfirm}
          />
        </>
      );
    }

    render(<Harness />);

    await chooseOption('Cohort', 'Cohort 2025');
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(await screen.findByText('Update failed.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));

    expect(screen.queryByText('Update failed.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(await screen.findByText('Please select a cohort.')).toBeInTheDocument();
  });

  it('disables cancel and select while loading', () => {
    render(
      <BulkSetSelectModal
        confirmLoading
        fieldLabel="Cohort"
        open
        options={selectOptions}
        title="Set cohort"
        onCancel={vi.fn()}
        onConfirm={createMockConfirm()}
      />,
    );

    assertControlDisabled('button', 'Cancel');
    assertControlDisabled('combobox', 'Cohort');
  });

});
