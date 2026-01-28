import { describe, it, expect, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTemplateWithIncludes } from '../helpers/htmlTemplateRenderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatePath = path.resolve(__dirname, '../../src/AdminSheet/UI/AssessmentWizard.html');

function createGoogleMock() {
  const host = {
    close: vi.fn(),
  };

  // A small per-method handler emulation so tests can handle concurrent calls
  const run = {
    _pendingSuccess: null,
    _pendingFailure: null,
    _handlers: {}, // methodName => { success, failure }
    calls: 0,
    calledMethods: [],

    withSuccessHandler(handler) {
      this._pendingSuccess = handler;
      return this;
    },
    withFailureHandler(handler) {
      this._pendingFailure = handler;
      return this;
    },

    // Called when a GAS method is invoked; record handlers under method name
    _registerCall(methodName, args) {
      this.calls += 1;
      this.calledMethods.push(methodName);
      this._handlers[methodName] = {
        success: this._pendingSuccess,
        failure: this._pendingFailure,
        args,
      };
      // clear pending handlers for next chain
      this._pendingSuccess = null;
      this._pendingFailure = null;
    },

    fetchAssignmentsForWizard(...args) {
      this._registerCall('fetchAssignmentsForWizard', args);
      return this;
    },

    getAllPartialDefinitions(...args) {
      this._registerCall('getAllPartialDefinitions', args);
      return this;
    },

    triggerSuccess(methodName, payload) {
      const h = this._handlers[methodName];
      if (h && typeof h.success === 'function') {
        h.success(payload);
      }
    },

    triggerFailure(methodName, error) {
      const h = this._handlers[methodName];
      if (h && typeof h.failure === 'function') {
        h.failure(error);
      }
    },
  };

  return {
    google: {
      script: {
        host,
        run,
      },
    },
    host,
    run,
  };
}

function setupWizard() {
  const html = renderTemplateWithIncludes(templatePath);
  const dom = new JSDOM(html, {
    url: 'https://example.test',
    runScripts: 'outside-only',
    resources: 'usable',
  });

  const { window } = dom;
  const googleMock = createGoogleMock();
  window.google = googleMock.google;

  const inlineScript = Array.from(window.document.querySelectorAll('script')).find(
    (script) => !script.src && script.textContent.includes('assignmentWizard')
  );
  if (!inlineScript) {
    throw new Error('Inline wizard script was not found');
  }

  window.eval(inlineScript.textContent);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

  return {
    dom,
    window,
    document: window.document,
    cleanup: () => dom.window.close(),
    googleRun: googleMock.run,
    googleHost: googleMock.host,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Assessment wizard Step 1', () => {
  it('renders initial loading state with spinner and disabled controls', () => {
    const { document, cleanup } = setupWizard();
    try {
      const assignmentInput = document.getElementById('assignmentInput');
      const assignmentMenu = document.getElementById('assignmentMenu');
      const spinner = document.getElementById('assignmentLoadingSpinner');
      const startButton = document.getElementById('startAssessment');
      const errorMessage = document.getElementById('assignmentErrorMessage');

      expect(assignmentInput.disabled).toBe(true);
      expect(assignmentMenu.textContent).toContain('Loading assignments');
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

      const assignmentInput = document.getElementById('assignmentInput');
      const assignmentMenu = document.getElementById('assignmentMenu');
      const spinner = document.getElementById('assignmentLoadingSpinner');
      const startButton = document.getElementById('startAssessment');
      const errorMessage = document.getElementById('assignmentErrorMessage');

      expect(assignmentInput.disabled).toBe(false);
      // first result is a placeholder + two assignment rows
      const items = Array.from(assignmentMenu.querySelectorAll('li.assignment-row'));
      expect(items.length).toBe(assignments.length);
      expect(items[0].dataset.assignmentId).toBe('a1');
      expect(items[0].textContent).toContain('Year 9 Programming');
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

      const assignmentMenu = document.getElementById('assignmentMenu');
      const startButton = document.getElementById('startAssessment');

      // click the assignment row to select
      const row = assignmentMenu.querySelector('li.assignment-row[data-assignment-id="alpha"]');
      row.click();
      // Without a linked definition with documents, start should remain disabled
      expect(startButton.disabled).toBe(true);

      // simulate clearing selection
      const input = document.getElementById('assignmentInput');
      input.value = '';
      // reconstruct state similar to empty filter action
      window.assignmentWizard.handleFilterInput();
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

      const assignmentInput = document.getElementById('assignmentInput');
      const assignmentMenu = document.getElementById('assignmentMenu');
      const spinner = document.getElementById('assignmentLoadingSpinner');
      const startButton = document.getElementById('startAssessment');
      const errorMessage = document.getElementById('assignmentErrorMessage');

      expect(assignmentInput.disabled).toBe(true);
      const items = Array.from(assignmentMenu.querySelectorAll('li.assignment-row'));
      expect(items.length).toBe(1);
      expect(items[0].textContent).toBe('No assignments available yet');
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

      const assignmentInput = document.getElementById('assignmentInput');
      const spinner = document.getElementById('assignmentLoadingSpinner');
      const startButton = document.getElementById('startAssessment');
      const errorMessage = document.getElementById('assignmentErrorMessage');

      expect(assignmentInput.disabled).toBe(true);
      expect(spinner.hidden).toBe(true);
      expect(startButton.disabled).toBe(true);
      expect(errorMessage.hidden).toBe(false);
      expect(errorMessage.textContent).toContain('Network error');
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
