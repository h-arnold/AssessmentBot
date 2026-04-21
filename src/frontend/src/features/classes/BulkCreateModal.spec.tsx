import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BulkCreateModal } from './BulkCreateModal';

const cohortOptions = [
  { label: 'Cohort 2025', value: 'cohort-2025' },
  { label: 'Cohort 2026', value: 'cohort-2026' },
];

const yearGroupOptions = [
  { label: 'Year 10', value: 'year-10' },
  { label: 'Year 11', value: 'year-11' },
];

/**
 * Opens a named selector and chooses one option by visible label.
 *
 * @param {string} fieldLabel Accessible form label.
 * @param {string} optionLabel Option label to select.
 * @returns {Promise<void>} Completion signal.
 */
async function chooseOption(fieldLabel: string, optionLabel: string): Promise<void> {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: fieldLabel }));
  fireEvent.click(await screen.findByText(optionLabel));
}

/**
 * Changes the course-length input value.
 *
 * @param {string} value Input value.
 * @returns {void}
 */
function changeCourseLength(value: string): void {
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Course length' }), {
    target: { value },
  });
}

describe('BulkCreateModal', () => {
  it('keeps the initial course length at 1', () => {
    render(
      <BulkCreateModal
        open
        cohortOptions={cohortOptions}
        yearGroupOptions={yearGroupOptions}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole('spinbutton', { name: 'Course length' })).toHaveValue('1');
  });

  it('submits through the modal OK action with the current payload shape', async () => {
    const onConfirm = vi.fn().mockImplementation(async () => {});

    render(
      <BulkCreateModal
        open
        cohortOptions={cohortOptions}
        yearGroupOptions={yearGroupOptions}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    await chooseOption('Cohort', 'Cohort 2025');
    await chooseOption('Year group', 'Year 10');
    changeCourseLength('3');
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith({
        cohortKey: 'cohort-2025',
        yearGroupKey: 'year-10',
        courseLength: 3,
      });
    });
  });

  it('keeps validation and allowed-option checks local and unchanged', async () => {
    const onConfirm = vi.fn().mockImplementation(async () => {});
    const { rerender } = render(
      <BulkCreateModal
        open
        cohortOptions={cohortOptions}
        yearGroupOptions={yearGroupOptions}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(await screen.findByText('Please select a cohort.')).toBeInTheDocument();
    expect(await screen.findByText('Please select a year group.')).toBeInTheDocument();

    await chooseOption('Cohort', 'Cohort 2025');
    await chooseOption('Year group', 'Year 10');
    rerender(
      <BulkCreateModal
        open
        cohortOptions={[{ label: 'Cohort 2027', value: 'cohort-2027' }]}
        yearGroupOptions={[{ label: 'Year 12', value: 'year-12' }]}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(await screen.findByText('Please select a valid cohort.')).toBeInTheDocument();
    expect(await screen.findByText('Please select a valid year group.')).toBeInTheDocument();
  });

  it('shows validation message for invalid course length values', async () => {
    render(
      <BulkCreateModal
        open
        cohortOptions={cohortOptions}
        yearGroupOptions={yearGroupOptions}
        onCancel={vi.fn()}
        onConfirm={vi.fn().mockImplementation(async () => {})}
      />,
    );

    await chooseOption('Cohort', 'Cohort 2025');
    await chooseOption('Year group', 'Year 10');
    changeCourseLength('');
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(
      await screen.findByText('Course length must be an integer greater than or equal to 1.'),
    ).toBeInTheDocument();
  });

  it('renders submission failures as an inline error alert', async () => {
    render(
      <BulkCreateModal
        open
        cohortOptions={cohortOptions}
        yearGroupOptions={yearGroupOptions}
        onCancel={vi.fn()}
        onConfirm={vi.fn().mockRejectedValue(new Error('Create failed.'))}
      />,
    );

    await chooseOption('Cohort', 'Cohort 2025');
    await chooseOption('Year group', 'Year 10');
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(await screen.findByText('Create failed.')).toBeInTheDocument();
  });

  it('resets local state when the modal closes', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('Create failed.'));

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
          <BulkCreateModal
            open={open}
            cohortOptions={cohortOptions}
            yearGroupOptions={yearGroupOptions}
            onCancel={() => setOpen(false)}
            onConfirm={onConfirm}
          />
        </>
      );
    }

    render(<Harness />);

    await chooseOption('Cohort', 'Cohort 2025');
    await chooseOption('Year group', 'Year 10');
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(await screen.findByText('Create failed.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));

    expect(screen.queryByText('Create failed.')).not.toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Course length' })).toHaveValue('1');
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(await screen.findByText('Please select a cohort.')).toBeInTheDocument();
  });

  it('disables cancel and form controls while loading', () => {
    render(
      <BulkCreateModal
        open
        confirmLoading
        cohortOptions={cohortOptions}
        yearGroupOptions={yearGroupOptions}
        onCancel={vi.fn()}
        onConfirm={vi.fn().mockImplementation(async () => {})}
      />,
    );

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Cohort' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Year group' })).toBeDisabled();
    expect(screen.getByRole('spinbutton', { name: 'Course length' })).toBeDisabled();
  });
});
