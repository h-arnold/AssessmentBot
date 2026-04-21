import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BulkSetCourseLengthModal } from './BulkSetCourseLengthModal';

const submittedCourseLength = 4;

/**
 * Changes the course-length control value.
 *
 * @param {string} value Input value.
 * @returns {void}
 */
function changeCourseLength(value: string): void {
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Course length' }), {
    target: { value },
  });
}

describe('BulkSetCourseLengthModal', () => {
  it('submits through the modal OK action', async () => {
    const onConfirm = vi.fn().mockImplementation(async () => {});

    render(
      <BulkSetCourseLengthModal open onCancel={vi.fn()} onConfirm={onConfirm} />,
    );

    changeCourseLength(String(submittedCourseLength));
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith(submittedCourseLength);
    });
  });

  it('shows validation message for invalid and missing course length values', async () => {
    render(
      <BulkSetCourseLengthModal open onCancel={vi.fn()} onConfirm={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(
      await screen.findByText('Course length must be an integer greater than or equal to 1.'),
    ).toBeInTheDocument();

    changeCourseLength('0');
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(
      await screen.findByText('Course length must be an integer greater than or equal to 1.'),
    ).toBeInTheDocument();
  });

  it('renders submission failures as an inline error alert', async () => {
    render(
      <BulkSetCourseLengthModal
        open
        onCancel={vi.fn()}
        onConfirm={vi.fn().mockRejectedValue(new Error('Update failed.'))}
      />,
    );

    changeCourseLength('3');
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
          <BulkSetCourseLengthModal
            open={open}
            onCancel={() => setOpen(false)}
            onConfirm={onConfirm}
          />
        </>
      );
    }

    render(<Harness />);

    changeCourseLength('3');
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(await screen.findByText('Update failed.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));

    expect(screen.queryByText('Update failed.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(
      await screen.findByText('Course length must be an integer greater than or equal to 1.'),
    ).toBeInTheDocument();
  });

  it('disables cancel and form controls while loading', () => {
    render(
      <BulkSetCourseLengthModal
        confirmLoading
        open
        onCancel={vi.fn()}
        onConfirm={vi.fn().mockImplementation(async () => {})}
      />,
    );

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('spinbutton', { name: 'Course length' })).toBeDisabled();
  });

});
