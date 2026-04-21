import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BulkSetSelectModal } from './BulkSetSelectModal';

const selectOptions = [
  { label: 'Cohort 2025', value: 'cohort-2025' },
  { label: 'Cohort 2026', value: 'cohort-2026' },
];

/**
 * Opens the cohort selector and chooses one option by visible label.
 *
 * @param {string} label Option label to choose.
 * @returns {Promise<void>} Completion signal.
 */
async function chooseOption(label: string): Promise<void> {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Cohort' }));
  fireEvent.click(await screen.findByText(label));
}

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

    await chooseOption('Cohort 2025');
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith('cohort-2025');
    });
  });

  it('shows validation messages for missing and invalid selections', async () => {
    const onConfirm = vi.fn().mockImplementation(async () => {});
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
    expect(await screen.findByText('Please select a cohort.')).toBeInTheDocument();

    await chooseOption('Cohort 2025');
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
    expect(await screen.findByText('Please select a valid cohort.')).toBeInTheDocument();
  });

  it('renders submission failures as an inline error alert', async () => {
    render(
      <BulkSetSelectModal
        fieldLabel="Cohort"
        open
        options={selectOptions}
        title="Set cohort"
        onCancel={vi.fn()}
        onConfirm={vi.fn().mockRejectedValue(new Error('Update failed.'))}
      />,
    );

    await chooseOption('Cohort 2025');
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(await screen.findByText('Update failed.')).toBeInTheDocument();
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

    await chooseOption('Cohort 2025');
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
        onConfirm={vi.fn().mockImplementation(async () => {})}
      />,
    );

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Cohort' })).toBeDisabled();
  });

});
