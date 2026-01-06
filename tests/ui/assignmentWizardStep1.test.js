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

  const run = {
    successHandler: null,
    failureHandler: null,
    savedArgs: null,
    calls: 0,
    withSuccessHandler(handler) {
      this.successHandler = handler;
      return this;
    },
    withFailureHandler(handler) {
      this.failureHandler = handler;
      return this;
    },
    fetchAssignmentsForWizard(...args) {
      this.calls += 1;
      this.savedArgs = args;
      return this;
    },
    triggerSuccess(payload) {
      if (typeof this.successHandler === 'function') {
        this.successHandler(payload);
      }
    },
    triggerFailure(error) {
      if (typeof this.failureHandler === 'function') {
        this.failureHandler(error);
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
      const assignmentSelect = document.getElementById('assignmentSelect');
      const spinner = document.getElementById('assignmentLoadingSpinner');
      const startButton = document.getElementById('startAssessment');
      const errorMessage = document.getElementById('assignmentErrorMessage');

      expect(assignmentSelect.disabled).toBe(true);
      expect(assignmentSelect.options[0].textContent).toContain('Loading assignments');
      expect(spinner.hidden).toBe(false);
      expect(startButton.disabled).toBe(true);
      expect(errorMessage.hidden).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('asks GAS for assignments after the template loads', () => {
    const { googleRun, cleanup } = setupWizard();
    try {
      expect(googleRun.calls).toBeGreaterThan(0);
      expect(googleRun.savedArgs).toEqual([]);
    } finally {
      cleanup();
    }
  });

  it('enables the select and hides the spinner once assignments arrive', () => {
    const { document, googleRun, cleanup } = setupWizard();
    try {
      const assignments = [
        { id: 'a1', title: 'Year 9 Programming' },
        { id: 'a2', title: 'Year 10 Robotics' },
      ];

      googleRun.triggerSuccess(assignments);

      const assignmentSelect = document.getElementById('assignmentSelect');
      const spinner = document.getElementById('assignmentLoadingSpinner');
      const startButton = document.getElementById('startAssessment');
      const errorMessage = document.getElementById('assignmentErrorMessage');

      expect(assignmentSelect.disabled).toBe(false);
      expect(assignmentSelect.options.length).toBe(assignments.length + 1);
      expect(assignmentSelect.options[1].value).toBe('a1');
      expect(assignmentSelect.options[1].textContent).toBe('Year 9 Programming');
      expect(spinner.hidden).toBe(true);
      expect(startButton.disabled).toBe(true);
      expect(errorMessage.hidden).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('toggles the primary button as the selection changes', () => {
    const { document, googleRun, window, cleanup } = setupWizard();
    try {
      const assignments = [{ id: 'alpha', title: 'Alpha Assignment' }];
      googleRun.triggerSuccess(assignments);

      const assignmentSelect = document.getElementById('assignmentSelect');
      const startButton = document.getElementById('startAssessment');

      assignmentSelect.value = 'alpha';
      assignmentSelect.dispatchEvent(new window.Event('change'));
      expect(startButton.disabled).toBe(false);

      assignmentSelect.value = '';
      assignmentSelect.dispatchEvent(new window.Event('change'));
      expect(startButton.disabled).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('shows the error banner when fetching assignments fails', () => {
    const { document, googleRun, cleanup } = setupWizard();
    try {
      googleRun.triggerFailure({ message: 'Network error' });

      const assignmentSelect = document.getElementById('assignmentSelect');
      const spinner = document.getElementById('assignmentLoadingSpinner');
      const startButton = document.getElementById('startAssessment');
      const errorMessage = document.getElementById('assignmentErrorMessage');

      expect(assignmentSelect.disabled).toBe(true);
      expect(spinner.hidden).toBe(true);
      expect(startButton.disabled).toBe(true);
      expect(errorMessage.hidden).toBe(false);
      expect(errorMessage.textContent).toContain('Network error');
    } finally {
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
