import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  getWizardElements,
  selectAssignment,
  setupWizard,
} from '../helpers/assessmentWizardTestUtils.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Assessment wizard Step 1', () => {
  it('renders initial loading state with spinner and disabled controls', () => {
    const { document, cleanup } = setupWizard();
    try {
      const { assignmentInput, assignmentMenu, spinner, startButton, errorMessage } =
        getWizardElements(document);

      expect(assignmentInput.disabled).toBe(true);
      expect(assignmentInput.getAttribute('placeholder')).toContain('Loading assignments');
      expect(assignmentMenu.querySelector('li')?.textContent).toContain('Loading assignments');
      expect(spinner.hidden).toBe(false);
      expect(startButton.disabled).toBe(true);
      expect(errorMessage.hidden).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('asks GAS for assignments and partial definitions after the template loads', () => {
    // Use fake timers so we can control the next-tick setTimeouts scheduled by init()
    vi.useFakeTimers();
    const { googleRun, cleanup } = setupWizard();
    try {
      // Advance timers so the setTimeouts used in init() run
      vi.runAllTimers();

      expect(googleRun.calls).toBeGreaterThan(0);
      // both methods should be invoked with no args
      expect(googleRun.calledMethods).toEqual(
        expect.arrayContaining(['fetchAssignmentsForWizard', 'getAllPartialDefinitions'])
      );
    } finally {
      vi.useRealTimers();
      cleanup();
    }
  });

  it('enables the select and hides the spinner once assignments arrive', () => {
    // Ensure setTimeouts scheduled in init() run so GAS call handlers are registered
    vi.useFakeTimers();
    const { document, googleRun, cleanup } = setupWizard();
    try {
      vi.runAllTimers();

      const assignments = [
        { id: 'a1', title: 'Year 9 Programming' },
        { id: 'a2', title: 'Year 10 Robotics' },
      ];

      // Trigger assignments success handler explicitly
      googleRun.triggerSuccess('fetchAssignmentsForWizard', assignments);

      const { assignmentInput, assignmentMenu, spinner, startButton, errorMessage } =
        getWizardElements(document);

      const menuItems = assignmentMenu.querySelectorAll('li[data-assignment-id]');
      expect(assignmentInput.disabled).toBe(false);
      expect(menuItems.length).toBe(assignments.length);
      expect(menuItems[0].dataset.assignmentId).toBe('a1');
      expect(menuItems[0].querySelector('.assignment-name')?.textContent).toBe(
        'Year 9 Programming'
      );
      expect(spinner.hidden).toBe(true);
      expect(startButton.disabled).toBe(true);
      expect(errorMessage.hidden).toBe(true);
    } finally {
      vi.useRealTimers();
      cleanup();
    }
  });

  it('toggles the primary button as the selection changes', () => {
    // Ensure GAS handlers are registered first
    vi.useFakeTimers();
    const { document, googleRun, window, cleanup } = setupWizard();
    try {
      vi.runAllTimers();

      const assignments = [{ id: 'alpha', title: 'Alpha Assignment' }];
      googleRun.triggerSuccess('fetchAssignmentsForWizard', assignments);

      const { assignmentInput, startButton } = getWizardElements(document);

      selectAssignment(document, window, 'alpha');
      expect(assignmentInput.value).toBe('Alpha Assignment');
      expect(startButton.disabled).toBe(true);

      assignmentInput.value = '';
      assignmentInput.dispatchEvent(new window.Event('input'));
      expect(startButton.disabled).toBe(true);
    } finally {
      vi.useRealTimers();
      cleanup();
    }
  });

  it('stores partial definitions returned by backend', () => {
    // Ensure handlers are registered
    vi.useFakeTimers();
    const { window, googleRun, cleanup } = setupWizard();
    try {
      vi.runAllTimers();

      const defs = [
        {
          definitionKey: 'd1',
          primaryTitle: 'Alpha',
        },
      ];

      googleRun.triggerSuccess('getAllPartialDefinitions', defs);
      expect(window.assignmentWizard.state.definitions).toEqual(defs);
    } finally {
      vi.useRealTimers();
      cleanup();
    }
  });

  it('renders an empty-state message when no assignments exist', () => {
    // Ensure GAS handlers are registered first
    vi.useFakeTimers();
    const { document, googleRun, cleanup } = setupWizard();
    try {
      vi.runAllTimers();
      googleRun.triggerSuccess('fetchAssignmentsForWizard', []);

      const { assignmentInput, assignmentMenu, spinner, startButton, errorMessage } =
        getWizardElements(document);

      expect(assignmentInput.disabled).toBe(true);
      expect(assignmentMenu.querySelectorAll('li').length).toBe(1);
      expect(assignmentMenu.querySelector('li')?.textContent).toBe('No assignments available yet');
      expect(spinner.hidden).toBe(true);
      expect(startButton.disabled).toBe(true);
      expect(errorMessage.hidden).toBe(false);
      expect(errorMessage.textContent).toContain('No assignments were found for this classroom.');
    } finally {
      vi.useRealTimers();
      cleanup();
    }
  });

  it('shows the error banner when fetching assignments fails', () => {
    // Ensure GAS handlers are registered first
    vi.useFakeTimers();
    const { document, googleRun, cleanup } = setupWizard();
    try {
      vi.runAllTimers();
      googleRun.triggerFailure('fetchAssignmentsForWizard', { message: 'Network error' });

      const { assignmentInput, assignmentMenu, spinner, startButton, errorMessage } =
        getWizardElements(document);

      expect(assignmentInput.disabled).toBe(true);
      expect(spinner.hidden).toBe(true);
      expect(startButton.disabled).toBe(true);
      expect(errorMessage.hidden).toBe(false);
      expect(errorMessage.textContent).toContain('Network error');
      expect(assignmentMenu.querySelector('li')?.textContent).toContain(
        'Unable to load assignments'
      );
    } finally {
      vi.useRealTimers();
      cleanup();
    }
  });

  it('closes the dialog when cancel is clicked', () => {
    const { document, googleHost, cleanup } = setupWizard();
    try {
      document.getElementById('cancelWizard').click();
      expect(googleHost.close).toHaveBeenCalledTimes(1);
    } finally {
      cleanup();
    }
  });
});
