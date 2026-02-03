import { JSDOM } from 'jsdom';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vi } from 'vitest';
import { renderTemplateWithIncludes } from './htmlTemplateRenderer.js';

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
      const handler = this._handlers[methodName];
      if (handler && typeof handler.success === 'function') {
        handler.success(payload);
      }
    },

    triggerFailure(methodName, error) {
      const handler = this._handlers[methodName];
      if (handler && typeof handler.failure === 'function') {
        handler.failure(error);
      }
    },
  };

  return { google: { script: { host, run } }, host, run };
}

export function setupWizard() {
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

export function getWizardElements(document) {
  return {
    assignmentInput: document.getElementById('assignmentInput'),
    assignmentMenu: document.getElementById('assignmentMenu'),
    spinner: document.getElementById('assignmentLoadingSpinner'),
    startButton: document.getElementById('startAssessment'),
    errorMessage: document.getElementById('assignmentErrorMessage'),
  };
}

export function selectAssignment(document, window, assignmentId) {
  const assignmentMenu = document.getElementById('assignmentMenu');
  const menuItem = assignmentMenu.querySelector(`li[data-assignment-id="${assignmentId}"]`);
  if (!menuItem) {
    throw new Error(`Assignment menu item not found: ${assignmentId}`);
  }
  menuItem.dispatchEvent(new window.Event('click', { bubbles: true }));
  return menuItem;
}

export function buildDefinition(overrides = {}) {
  return {
    definitionKey: 'Definition_Key',
    primaryTitle: 'Default Assignment',
    primaryTopic: 'English',
    yearGroup: null,
    documentType: 'SLIDES',
    referenceDocumentId: 'ref-id',
    templateDocumentId: 'template-id',
    ...overrides,
  };
}

export function buildAssignment(overrides = {}) {
  return {
    id: 'assignment-id',
    title: 'Default Assignment',
    topicName: 'English',
    yearGroup: null,
    ...overrides,
  };
}

export function seedWizardData(googleRun, { definitions = [], assignments = [] } = {}) {
  if (definitions.length) {
    googleRun.triggerSuccess('getAllPartialDefinitions', definitions);
  }
  if (assignments.length) {
    googleRun.triggerSuccess('fetchAssignmentsForWizard', assignments);
  }
}
