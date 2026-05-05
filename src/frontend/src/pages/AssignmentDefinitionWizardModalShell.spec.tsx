import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

const baseProperties = {
  open: true,
  mode: 'create' as const,
  title: null,
  isHydrating: false,
  blockingError: null,
  isMutationBusy: false,
  onCancel: () => {},
  onSubmit: () => {},
};

/**
 * Dynamically imports the wizard modal shell module under test.
 *
 * @returns {Promise<Record<string, unknown>>} Imported module.
 */
async function loadAssignmentDefinitionWizardModalShell() {
  const modulePath = './AssignmentDefinitionWizardModalShell';
  return import(/* @vite-ignore */ modulePath);
}

describe('AssignmentDefinitionWizardModalShell', () => {
  it('renders hydrated, loading, and blocking-error shell states for the assignment-definition wizard modal', async () => {
    const { AssignmentDefinitionWizardModalShell } = await loadAssignmentDefinitionWizardModalShell();

    const { rerender } = render(<AssignmentDefinitionWizardModalShell {...baseProperties} mode="create" />);

    expect(screen.getByRole('form')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /parse and continue/i })).toBeEnabled();

    rerender(
      <AssignmentDefinitionWizardModalShell
        {...baseProperties}
        isHydrating
        mode="update"
      />
    );

    expect(screen.getByLabelText(/assignment wizard loading/i)).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();

    rerender(
      <AssignmentDefinitionWizardModalShell
        {...baseProperties}
        blockingError="Assignment definition could not be loaded."
        mode="update"
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/could not be loaded/i);
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });
});
