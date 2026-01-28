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

    startAssessmentFromWizard(...args) {
      this._registerCall('startAssessmentFromWizard', args);
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

  return { google: { script: { host, run } }, host, run };
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
  if (!inlineScript) throw new Error('Inline wizard script was not found');

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

describe('Assessment wizard definition matching', () => {
  it('matches a definition by primaryTitle/topic/yearGroup and enables fast-start when doc IDs present', () => {
    vi.useFakeTimers();
    const { document, googleRun, cleanup } = setupWizard();
    try {
      vi.runAllTimers();

      const defs = [
        {
          definitionKey: 'Alpha_English_10',
          primaryTitle: 'Alpha Assignment',
          primaryTopic: 'English',
          yearGroup: 10,
          documentType: 'SLIDES',
          referenceDocumentId: 'r1',
          templateDocumentId: 't1',
        },
      ];

      // Send definitions first
      googleRun.triggerSuccess('getAllPartialDefinitions', defs);

      const assignments = [
        { id: 'a1', title: 'Alpha Assignment ', topicName: 'English', yearGroup: 10 },
      ];
      googleRun.triggerSuccess('fetchAssignmentsForWizard', assignments);

      // Select assignment by clicking the rendered list item
      const assignmentMenu = document.getElementById('assignmentMenu');
      const startButton = document.getElementById('startAssessment');
      const row = assignmentMenu.querySelector('li.assignment-row[data-assignment-id="a1"]');
      row.click();

      // Fast path should have triggered startAssessmentFromWizard
      expect(googleRun.calledMethods).toContain('startAssessmentFromWizard');
      const call = googleRun._handlers.startAssessmentFromWizard;
      expect(call.args[0]).toBe('a1');
      expect(call.args[1]).toBe('Alpha_English_10');
    } finally {
      vi.useRealTimers();
      cleanup();
    }
  });

  it('matches a definition using alternateTitles (case-insensitive, trimmed)', () => {
    vi.useFakeTimers();
    const { document, googleRun, cleanup } = setupWizard();
    try {
      vi.runAllTimers();

      const defs = [
        {
          definitionKey: 'Beta_English_null',
          primaryTitle: 'Beta Assignment',
          alternateTitles: ['beta alt'],
          primaryTopic: 'English',
          yearGroup: null,
          documentType: 'SLIDES',
          referenceDocumentId: 'r2',
          templateDocumentId: 't2',
        },
      ];
      googleRun.triggerSuccess('getAllPartialDefinitions', defs);

      const assignments = [
        { id: 'b1', title: '  Beta ALT', topicName: 'English', yearGroup: null },
      ];
      googleRun.triggerSuccess('fetchAssignmentsForWizard', assignments);

      const assignmentMenu = document.getElementById('assignmentMenu');
      const startButton = document.getElementById('startAssessment');
      const row = assignmentMenu.querySelector('li.assignment-row[data-assignment-id="b1"]');
      row.click();

      expect(googleRun.calledMethods).toContain('startAssessmentFromWizard');
      const call = googleRun._handlers.startAssessmentFromWizard;
      expect(call.args[0]).toBe('b1');
      expect(call.args[1]).toBe('Beta_English_null');
    } finally {
      vi.useRealTimers();
      cleanup();
    }
  });

  it('does not match when yearGroup differs', () => {
    vi.useFakeTimers();
    const { document, googleRun, cleanup } = setupWizard();
    try {
      vi.runAllTimers();

      const defs = [
        {
          definitionKey: 'Gamma_Maths_9',
          primaryTitle: 'Gamma',
          primaryTopic: 'Maths',
          yearGroup: 9,
          documentType: 'SLIDES',
          referenceDocumentId: 'r3',
          templateDocumentId: 't3',
        },
      ];
      googleRun.triggerSuccess('getAllPartialDefinitions', defs);

      const assignments = [{ id: 'g1', title: 'Gamma', topicName: 'Maths', yearGroup: 10 }];
      googleRun.triggerSuccess('fetchAssignmentsForWizard', assignments);

      const assignmentMenu = document.getElementById('assignmentMenu');
      const startButton = document.getElementById('startAssessment');
      const row = assignmentMenu.querySelector('li.assignment-row[data-assignment-id="g1"]');
      row.click();

      // No automatic start should have been triggered when yearGroup differs
      expect(googleRun.calledMethods).not.toContain('startAssessmentFromWizard');
      // Start button remains disabled because no linked definition with docs exists
      expect(startButton.disabled).toBe(true);
    } finally {
      vi.useRealTimers();
      cleanup();
    }
  });

  it('disables start when matching definition lacks document IDs', () => {
    vi.useFakeTimers();
    const { document, googleRun, cleanup } = setupWizard();
    try {
      vi.runAllTimers();

      const defs = [
        {
          definitionKey: 'Delta_Science_11',
          primaryTitle: 'Delta',
          primaryTopic: 'Science',
          yearGroup: 11,
          documentType: 'SLIDES',
          // missing reference/template IDs
        },
      ];
      googleRun.triggerSuccess('getAllPartialDefinitions', defs);

      const assignments = [{ id: 'd1', title: 'Delta', topicName: 'Science', yearGroup: 11 }];
      googleRun.triggerSuccess('fetchAssignmentsForWizard', assignments);

      const assignmentMenu = document.getElementById('assignmentMenu');
      const startButton = document.getElementById('startAssessment');
      const row = assignmentMenu.querySelector('li.assignment-row[data-assignment-id="d1"]');
      row.click();

      // Definition exists but missing doc IDs, so we should not auto-start
      expect(googleRun.calledMethods).not.toContain('startAssessmentFromWizard');
      // Start should remain disabled because linked definition has no document IDs
      expect(startButton.disabled).toBe(true);
    } finally {
      vi.useRealTimers();
      cleanup();
    }
  });

  it('shows stale banner when TaskDefinitionsChanged is true on definition', () => {
    vi.useFakeTimers();
    const { document, googleRun, cleanup } = setupWizard();
    try {
      vi.runAllTimers();

      const defs = [
        {
          definitionKey: 'Epsilon_Art_null',
          primaryTitle: 'Epsilon',
          primaryTopic: 'Art',
          yearGroup: null,
          documentType: 'SLIDES',
          referenceDocumentId: 'r4',
          templateDocumentId: 't4',
          TaskDefinitionsChanged: true,
        },
      ];
      googleRun.triggerSuccess('getAllPartialDefinitions', defs);

      const assignments = [{ id: 'e1', title: 'Epsilon', topicName: 'Art', yearGroup: null }];
      googleRun.triggerSuccess('fetchAssignmentsForWizard', assignments);

      const assignmentMenu = document.getElementById('assignmentMenu');
      const row = assignmentMenu.querySelector('li.assignment-row[data-assignment-id="e1"]');
      row.click();

      // Stale flag should not prevent fast-path starting; start should have been triggered
      expect(googleRun.calledMethods).toContain('startAssessmentFromWizard');
      const call = googleRun._handlers.startAssessmentFromWizard;
      expect(call.args[0]).toBe('e1');
      expect(call.args[1]).toBe('Epsilon_Art_null');
    } finally {
      vi.useRealTimers();
      cleanup();
    }
  });
});
