import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ClassesBulkProgressModal } from './ClassesBulkProgressModal';
import type { BatchProgressSnapshot } from './runQueuedBatchMutation';

/**
 * Creates a BatchProgressSnapshot with sensible defaults for testing.
 *
 * @param {Partial<BatchProgressSnapshot>} overrides - Partial overrides to set specific
 *   snapshot fields.
 * @returns {BatchProgressSnapshot} A complete BatchProgressSnapshot.
 */
function createProgress(
  overrides: Partial<BatchProgressSnapshot> = {},
): BatchProgressSnapshot {
  return {
    currentItem: null,
    completed: 0,
    pendingCount: 0,
    total: 0,
    isInProgress: false,
    ...overrides,
  };
}

describe('ClassesBulkProgressModal', () => {
  it('renders current item text, progress bar, and count', () => {
    render(
      <ClassesBulkProgressModal
        open
        progress={{
          currentItem: { verb: 'Creating', className: 'Science 202' },
          completed: 2,
          pendingCount: 3,
          total: 5,
          isInProgress: true,
        }}
        verb="Creating"
        onCancel={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    // Current item text: "{verb} class {className}"
    expect(screen.getByText('Creating class Science 202')).toBeInTheDocument();

    // Progress bar: 40% (2/5 * 100)
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '40');

    // Count: "{completed} / {total}"
    expect(screen.getByText('2 / 5')).toBeInTheDocument();
  });

  it('disables Cancel button when pendingCount is zero', () => {
    render(
      <ClassesBulkProgressModal
        open
        progress={createProgress({ pendingCount: 0, total: 1, completed: 1 })}
        verb="Creating"
        onCancel={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /cancel remaining/i })).toBeDisabled();
  });

  it('enables Cancel button when pendingCount is greater than zero', () => {
    render(
      <ClassesBulkProgressModal
        open
        progress={createProgress({
          pendingCount: 2,
          total: 3,
          completed: 1,
          isInProgress: true,
        })}
        verb="Deleting"
        onCancel={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /cancel remaining/i })).toBeEnabled();
  });

  it('calls onCancel when the footer Cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <ClassesBulkProgressModal
        open
        progress={createProgress({
          pendingCount: 2,
          total: 3,
          completed: 1,
          isInProgress: true,
        })}
        verb="Creating"
        onCancel={onCancel}
        onDismiss={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /cancel remaining/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  // Note: antd Modal's onCancel prop fires for both header X click and mask
  // (backdrop) click natively. This test verifies the dismiss pathway for both
  // triggers with a single X-click interaction. Dedicated mask-click coverage
  // in a real browser is deferred to Playwright E2E (Section 7 of ACTION_PLAN).
  it('calls onDismiss and not onCancel when the Modal close X or mask is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onDismiss = vi.fn();

    render(
      <ClassesBulkProgressModal
        open
        progress={createProgress({
          pendingCount: 2,
          total: 3,
          completed: 1,
          isInProgress: true,
        })}
        verb="Creating"
        onCancel={onCancel}
        onDismiss={onDismiss}
      />,
    );

    // Click the Modal header close X button
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('marks the non-live-region content as aria-busy while isInProgress is true', () => {
    // Render with queue active
    render(
      <ClassesBulkProgressModal
        open
        progress={createProgress({
          isInProgress: true,
          total: 1,
          currentItem: { verb: 'Creating', className: 'Math 101' },
        })}
        verb="Creating"
        onCancel={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    // The Modal body content (excluding the live region) should have aria-busy="true"
    const busyElement = document.querySelector('[aria-busy="true"]');
    expect(busyElement).toBeInTheDocument();

    cleanup();

    // Render with queue idle
    render(
      <ClassesBulkProgressModal
        open
        progress={createProgress({
          isInProgress: false,
          total: 0,
        })}
        verb="Creating"
        onCancel={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(document.querySelector('[aria-busy="true"]')).not.toBeInTheDocument();
  });

  it('wraps current item text and count in an aria-live="polite" region', () => {
    render(
      <ClassesBulkProgressModal
        open
        progress={{
          currentItem: { verb: 'Deleting', className: 'History 101' },
          completed: 1,
          pendingCount: 0,
          total: 3,
          isInProgress: false,
        }}
        verb="Deleting"
        onCancel={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    // Find the aria-live region and verify it contains both text elements
    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveTextContent('Deleting class History 101');
    expect(liveRegion).toHaveTextContent('1 / 3');
  });

  it('renders without error when closed', () => {
    expect(() =>
      render(
        <ClassesBulkProgressModal
          open={false}
          progress={createProgress()}
          verb="Creating"
          onCancel={vi.fn()}
          onDismiss={vi.fn()}
        />,
      ),
    ).not.toThrow();
  });

  it('does not render modal content when closed (focus not trapped within)', () => {
    render(
      <ClassesBulkProgressModal
        open={false}
        progress={createProgress()}
        verb="Creating"
        onCancel={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    // When closed, no dialog should be rendered, so focus cannot be trapped
    // inside the modal. Real focus-management behaviour (focus moves to the
    // toolbar region on drain) is verified in Playwright E2E.
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
