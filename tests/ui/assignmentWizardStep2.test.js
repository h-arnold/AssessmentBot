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

    saveStartAndShowProgress(...args) {
      this._registerCall('saveStartAndShowProgress', args);
      return this;
    },

    showProgressModal(...args) {
      this._registerCall('showProgressModal', args);
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

describe('Assessment wizard Step 2 (create new assignment)', () => {
  it('opens Step 2 when the add icon is clicked and focuses reference input', () => {
    vi.useFakeTimers();
    const { document, googleRun, cleanup } = setupWizard();
    try {
      vi.runAllTimers();
      const assignments = [{ id: 'a1', title: 'Alpha' }];
      googleRun.triggerSuccess('fetchAssignmentsForWizard', assignments);
      // Ensure partial definitions are loaded to avoid 'loading' icon state
      googleRun.triggerSuccess('getAllPartialDefinitions', []);

      // Find the add icon wrapper and click it
      const addWrap = document.querySelector('[data-action="create-definition"]');
      expect(addWrap).toBeTruthy();
      addWrap.click();

      const step2 = document.getElementById('step2Panel');
      const refInput = document.getElementById('referenceInputStep2');
      const backButton = document.getElementById('backToStep1');
      const startButton = document.getElementById('startAssessment');

      expect(step2.hidden).toBe(false);
      expect(document.activeElement.id).toBe(refInput.id);
      expect(backButton.hidden).toBe(false);
      expect(startButton.textContent.trim()).toBe('Next');
      expect(startButton.disabled).toBe(true);
    } finally {
      vi.useRealTimers();
      cleanup();
    }
  });

  it('parses Slides and Sheets URLs and shows appropriate icons, enabling Next when valid', () => {
    vi.useFakeTimers();
    const { document, googleRun, window, cleanup } = setupWizard();
    try {
      vi.runAllTimers();
      const assignments = [{ id: 'a1', title: 'Alpha' }];
      googleRun.triggerSuccess('fetchAssignmentsForWizard', assignments);
      // Ensure partial definitions are loaded to avoid 'loading' icon state
      googleRun.triggerSuccess('getAllPartialDefinitions', []);

      const addWrap = document.querySelector('[data-action="create-definition"]');
      addWrap.click();

      const refInput = document.getElementById('referenceInputStep2');
      const tplInput = document.getElementById('templateInputStep2');
      const refIcon = document.getElementById('referenceIcon');
      const tplIcon = document.getElementById('templateIcon');
      const startButton = document.getElementById('startAssessment');

      // Paste a Slides URL
      refInput.value = 'https://docs.google.com/presentation/d/1SLIDEIDEXAMPLE1234567890';
      refInput.dispatchEvent(new window.Event('input'));
      expect(refIcon.textContent).toBe('slideshow');

      // Paste a Sheets URL
      tplInput.value = 'https://docs.google.com/spreadsheets/d/1SHEETIDEXAMPLE1234567890';
      tplInput.dispatchEvent(new window.Event('input'));
      expect(tplIcon.textContent).toBe('grid_on');

      // Now Next should be enabled (ids different)
      expect(startButton.disabled).toBe(false);
    } finally {
      vi.useRealTimers();
      cleanup();
    }
  });

  it('marks invalid input and disables Next', () => {
    vi.useFakeTimers();
    const { document, googleRun, window, cleanup } = setupWizard();
    try {
      vi.runAllTimers();
      const assignments = [{ id: 'a1', title: 'Alpha' }];
      googleRun.triggerSuccess('fetchAssignmentsForWizard', assignments);
      // Ensure partial definitions are loaded to avoid 'loading' icon state
      googleRun.triggerSuccess('getAllPartialDefinitions', []);

      const addWrap = document.querySelector('[data-action="create-definition"]');
      addWrap.click();

      const refInput = document.getElementById('referenceInputStep2');
      const tplInput = document.getElementById('templateInputStep2');
      const tplField = tplInput.parentElement;
      const tplFeedback = document.getElementById('templateFeedback');
      const startButton = document.getElementById('startAssessment');

      refInput.value = 'https://docs.google.com/presentation/d/1SLIDEIDEXAMPLE1234567890';
      refInput.dispatchEvent(new window.Event('input'));

      // Invalid template
      tplInput.value = 'not a url';
      tplInput.dispatchEvent(new window.Event('input'));

      expect(tplField.classList.contains('invalid')).toBe(true);
      expect(tplFeedback.hidden).toBe(false);
      expect(startButton.disabled).toBe(true);
    } finally {
      vi.useRealTimers();
      cleanup();
    }
  });

  it('prevents Next when IDs are identical', () => {
    vi.useFakeTimers();
    const { document, googleRun, window, cleanup } = setupWizard();
    try {
      vi.runAllTimers();
      const assignments = [{ id: 'a1', title: 'Alpha' }];
      googleRun.triggerSuccess('fetchAssignmentsForWizard', assignments);
      // Ensure partial definitions are loaded to avoid 'loading' icon state
      googleRun.triggerSuccess('getAllPartialDefinitions', []);

      const addWrap = document.querySelector('[data-action="create-definition"]');
      addWrap.click();

      const refInput = document.getElementById('referenceInputStep2');
      const tplInput = document.getElementById('templateInputStep2');
      const startButton = document.getElementById('startAssessment');

      refInput.value = 'https://docs.google.com/presentation/d/1SAMEIDEXAMPLE1234567890';
      tplInput.value = 'https://docs.google.com/presentation/d/1SAMEIDEXAMPLE1234567890';
      refInput.dispatchEvent(new window.Event('input'));
      tplInput.dispatchEvent(new window.Event('input'));

      expect(startButton.disabled).toBe(true);
    } finally {
      vi.useRealTimers();
      cleanup();
    }
  });

  it('validates Step 2 on Next click and does not call backend', () => {
    vi.useFakeTimers();
    const { document, googleRun, window, cleanup } = setupWizard();
    try {
      vi.runAllTimers();
      const assignments = [{ id: 'a1', title: 'Alpha' }];
      googleRun.triggerSuccess('fetchAssignmentsForWizard', assignments);
      // Ensure partial definitions are loaded to avoid 'loading' icon state
      googleRun.triggerSuccess('getAllPartialDefinitions', []);

      const addWrap = document.querySelector('[data-action="create-definition"]');
      addWrap.click();

      const refInput = document.getElementById('referenceInputStep2');
      const tplInput = document.getElementById('templateInputStep2');
      const startButton = document.getElementById('startAssessment');
      const step2Error = document.getElementById('step2ErrorMessage');

      refInput.value = 'https://docs.google.com/presentation/d/1SLIDEIDEXAMPLE1234567890';
      tplInput.value = 'https://docs.google.com/presentation/d/1OTHERIDEXAMPLE1234567890';
      refInput.dispatchEvent(new window.Event('input'));
      tplInput.dispatchEvent(new window.Event('input'));

      expect(startButton.disabled).toBe(false);

      // Click Next (first click) - should validate and not call the backend
      startButton.click();

      expect(googleRun.calledMethods).not.toContain('saveStartAndShowProgress');
      expect(step2Error.hidden).toBe(false);
      expect(step2Error.textContent).toContain('Documents validated');
      expect(startButton.textContent.trim()).toBe('Start assessment');

      // Clicking again (Start assessment) should still not call backend at this time
      startButton.click();
      expect(googleRun.calledMethods).not.toContain('saveStartAndShowProgress');
    } finally {
      vi.useRealTimers();
      cleanup();
    }
  });
});
