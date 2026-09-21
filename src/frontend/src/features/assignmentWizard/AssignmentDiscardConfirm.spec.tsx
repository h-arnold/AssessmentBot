/**
 * Behaviour coverage for the feature-local discard-confirmation component
 * shared by the assignment-definition wizard, the in-modal create review,
 * and the stale-recovery review surface.
 *
 * The component owns the nested confirmation copy, footer actions, dismissal
 * wiring, and deterministic accessible-name anchoring for all three callers.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, type ComponentType } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import wizardModalSourceRaw from './AssignmentDefinitionWizardModal.tsx?raw';
import createReviewSourceRaw from '../classes/AssessTaskModal/AssessTaskCreateReview.tsx?raw';
import recoverySurfaceSourceRaw from '../classes/AssessTaskModal/AssessTaskRecoverySurface.tsx?raw';

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
});

/**
 * Dynamically imports the discard-confirmation module through a variable path
 * so the test exercises runtime module resolution.
 *
 * @returns {Promise<Record<string, unknown>>} Imported module namespace.
 */
async function loadDiscardConfirmModule(): Promise<Record<string, unknown>> {
  const modulePath = './AssignmentDiscardConfirm';
  return import(/* @vite-ignore */ modulePath);
}

/**
 * Resolves the shared discard-confirmation component from its module.
 *
 * @returns {Promise<ComponentType<Record<string, unknown>>>} Discard-confirmation component.
 */
async function loadDiscardConfirmComponent(): Promise<ComponentType<Record<string, unknown>>> {
  const discardModule = await loadDiscardConfirmModule();
  return discardModule.AssignmentDiscardConfirm as unknown as ComponentType<
    Record<string, unknown>
  >;
}

/**
 * Renders the shared discard confirmation in its open state.
 *
 * @param {ComponentType<Record<string, unknown>>} component Shared confirmation component.
 * @param {Record<string, unknown>} [overrides] Per-test property overrides.
 * @returns {{ onKeepEditing: ReturnType<typeof vi.fn>; onDiscard: ReturnType<typeof vi.fn> }} Mock callbacks.
 */
function renderDiscardConfirm(
  component: ComponentType<Record<string, unknown>>,
  overrides: Record<string, unknown> = {}
): { onKeepEditing: ReturnType<typeof vi.fn>; onDiscard: ReturnType<typeof vi.fn> } {
  const onKeepEditing = vi.fn();
  const onDiscard = vi.fn();
  render(
    createElement(component, {
      open: true,
      onKeepEditing,
      onDiscard,
      ...overrides,
    })
  );
  return { onKeepEditing, onDiscard };
}

describe('AssignmentDiscardConfirm shared component', () => {
  it('exposes the shared discard-confirmation component', async () => {
    const discardModule = await loadDiscardConfirmModule();

    expect(discardModule).toHaveProperty('AssignmentDiscardConfirm');
  });

  it('renders the shared discard copy without owning-modal chrome', async () => {
    const DiscardConfirm = await loadDiscardConfirmComponent();
    renderDiscardConfirm(DiscardConfirm);

    // The dialog title and the primary action intentionally share the same
    // copy (per the modal-patterns discard-confirmation contract), so both
    // matching elements are asserted.
    const [titleCopy, actionCopy] = await screen.findAllByText('Discard changes');
    expect(titleCopy).toBeInTheDocument();
    expect(actionCopy).toBeInTheDocument();
    expect(
      await screen.findByText('You have unsaved changes. Discard and close?')
    ).toBeInTheDocument();
  });

  it('routes Keep editing and Discard changes to their callbacks', async () => {
    const DiscardConfirm = await loadDiscardConfirmComponent();
    const { onKeepEditing, onDiscard } = renderDiscardConfirm(DiscardConfirm);

    await user.click(await screen.findByRole('button', { name: /keep editing/i }));
    expect(onKeepEditing).toHaveBeenCalledTimes(1);

    await user.click(await screen.findByRole('button', { name: /discard changes/i }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('keeps its own accessible name instead of inheriting the owning modal name', async () => {
    const DiscardConfirm = await loadDiscardConfirmComponent();
    renderDiscardConfirm(DiscardConfirm);

    const dialog = await screen.findByRole('dialog', { name: /discard changes/i });
    const labelledBy = dialog.getAttribute('aria-labelledby');

    expect(labelledBy).not.toBeNull();
    const labelledElement =
      labelledBy === null ? null : document.querySelector(`#${labelledBy}`);
    expect(labelledElement?.textContent).toMatch(/discard changes/i);
  });

  it('is consumed by the wizard, create-review, and recovery surfaces', () => {
    for (const source of [
      wizardModalSourceRaw as unknown as string,
      createReviewSourceRaw as unknown as string,
      recoverySurfaceSourceRaw as unknown as string,
    ]) {
      expect(source).toContain('AssignmentDiscardConfirm');
    }
  });
});
