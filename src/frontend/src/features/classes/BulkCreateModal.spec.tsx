import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BulkCreateModal } from './BulkCreateModal';
import {
  chooseOption,
  changeCourseLength,
  assertMessage,
  assertControlDisabled,
  CreateModalResetHarness,
} from '../../test/classes/modalTestHelpers';

const cohortOptions = [
  { label: 'Cohort 2025', value: 'cohort-2025' },
  { label: 'Cohort 2026', value: 'cohort-2026' },
];

const yearGroupOptions = [
  { label: 'Year 10', value: 'year-10' },
  { label: 'Year 11', value: 'year-11' },
];

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
    await assertMessage('Please select a cohort.');
    await assertMessage('Please select a year group.');

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
    await assertMessage('Please select a valid cohort.');
    await assertMessage('Please select a valid year group.');
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
    await assertMessage('Course length must be an integer greater than or equal to 1.');
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

    await assertMessage('Create failed.');
  });

  it('resets local state when the modal closes', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('Create failed.'));

    const modalComponent = (
      <BulkCreateModal
        open={true}
        cohortOptions={cohortOptions}
        yearGroupOptions={yearGroupOptions}
        onCancel={() => {}}
        onConfirm={onConfirm}
      />
    );

    render(<CreateModalResetHarness modalComponent={modalComponent} />);

    await chooseOption('Cohort', 'Cohort 2025');
    await chooseOption('Year group', 'Year 10');
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(await screen.findByText('Create failed.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reopen modal' }));

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

    assertControlDisabled('button', 'Cancel');
    assertControlDisabled('combobox', 'Cohort');
    assertControlDisabled('combobox', 'Year group');
    assertControlDisabled('spinbutton', 'Course length');
  });
});
