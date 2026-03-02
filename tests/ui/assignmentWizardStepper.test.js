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
    _pendingSuccess: null,
    _pendingFailure: null,
    _handlers: {},
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

    _registerCall(methodName, args) {
      this.calls += 1;
      this.calledMethods.push(methodName);
      this._handlers[methodName] = {
        success: this._pendingSuccess,
        failure: this._pendingFailure,
        args,
      };
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
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false,
    media: '',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  const inlineScript = Array.from(window.document.querySelectorAll('script')).find(
    (script) => !script.src && script.textContent.includes('assignmentWizard')
  );
  if (!inlineScript) {
    throw new Error('Inline wizard script was not found');
  }

  // Eval all non-main scripts first (e.g. WizardStepper class from StepperJS.html)
  Array.from(window.document.querySelectorAll('script')).forEach((script) => {
    if (!script.src && !script.textContent.includes('assignmentWizard')) {
      const suffix = script.textContent.includes('class WizardStepper')
        ? '\nwindow.WizardStepper = WizardStepper;'
        : '';
      window.eval(script.textContent + suffix);
    }
  });
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

describe('Assessment wizard stepper interactions', () => {
  it('navigates back to the year group when the first bullet is clicked', () => {
    const { document, window, cleanup } = setupWizard();
    try {
      window.assignmentWizard.showStep('selectAssignment');

      const firstStep = document.querySelector('span[data-step-index="0"]');
      firstStep.click();

      const yearGroupPanel = document.getElementById('yearGroupPanel');
      const step1Panel = document.getElementById('step1Panel');

      expect(window.assignmentWizard.state.step).toBe('yearGroup');
      expect(yearGroupPanel.hidden).toBe(false);
      expect(step1Panel.hidden).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('remains on the docs panel when the weights bullet is clicked', () => {
    const { document, window, cleanup } = setupWizard();
    try {
      window.assignmentWizard.openCreateAssignmentPanel({ id: 'dummy', title: 'Dummy' });

      const weightsStep = document.querySelector('span[data-step-index="3"]');
      weightsStep.click();

      const weightingsPanel = document.getElementById('weightingsPanel');

      expect(window.assignmentWizard.state.step).toBe('createDefinitionDocs');
      expect(weightingsPanel.hidden).toBe(true);
    } finally {
      cleanup();
    }
  });
});
