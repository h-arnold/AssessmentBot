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

    listAllDefinitionsForWizard(...args) {
      this._registerCall('listAllDefinitionsForWizard', args);
      return this;
    },

    getAllPartialDefinitions(...args) {
      this._registerCall('getAllPartialDefinitions', args);
      return this;
    },

    linkAssignmentToDefinition(...args) {
      this._registerCall('linkAssignmentToDefinition', args);
      return this;
    },

    createDefinitionFromUrls(...args) {
      this._registerCall('createDefinitionFromUrls', args);
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

describe('Assessment wizard Step 2', () => {
  it('shows definition found panel and stale warning when TaskDefinitionsChanged is true', () => {
    const { window, document, cleanup } = setupWizard();
    try {
      const wizard = window.assignmentWizard;
      expect(typeof wizard.handleDefinitionFound).toBe('function');

      const definition = {
        definitionKey: 'Alpha_Topic_null',
        primaryTitle: 'Alpha',
        primaryTopic: 'Topic',
        yearGroup: null,
        referenceDocumentId: 'ref-1234567890',
        templateDocumentId: 'tpl-1234567890',
        TaskDefinitionsChanged: true,
      };

      wizard.handleDefinitionFound(definition);

      expect(wizard.state.step).toBe('definitionFound');
      const foundPanel = document.getElementById('definitionFoundPanel');
      const missingPanel = document.getElementById('definitionMissingPanel');
      const staleBanner = document.getElementById('definitionStaleBanner');

      expect(foundPanel?.hidden).toBe(false);
      expect(missingPanel?.hidden).toBe(true);
      expect(staleBanner?.hidden).toBe(false);
    } finally {
      cleanup();
    }
  });

  it('renders sorted definition list and filters by query', () => {
    const { window, document, cleanup } = setupWizard();
    try {
      const wizard = window.assignmentWizard;
      expect(typeof wizard.renderDefinitionList).toBe('function');
      expect(typeof wizard.filterDefinitions).toBe('function');

      const definitions = [
        {
          definitionKey: 'Alpha_Topic_null',
          primaryTitle: 'Alpha',
          primaryTopic: 'Topic',
          yearGroup: null,
          updatedAt: '2025-01-03T00:00:00Z',
        },
        {
          definitionKey: 'Beta_Science_null',
          primaryTitle: 'Beta',
          primaryTopic: 'Science',
          yearGroup: null,
          updatedAt: '2025-01-05T00:00:00Z',
        },
        {
          definitionKey: 'Gamma_Maths_null',
          primaryTitle: 'Gamma',
          primaryTopic: 'Maths',
          yearGroup: null,
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ];

      wizard.renderDefinitionList(definitions);

      const list = document.getElementById('definitionList');
      const items = list ? Array.from(list.querySelectorAll('[data-definition-key]')) : [];
      const keys = items.map((item) => item.getAttribute('data-definition-key'));

      expect(keys.slice(0, 3)).toEqual([
        'Beta_Science_null',
        'Alpha_Topic_null',
        'Gamma_Maths_null',
      ]);

      wizard.filterDefinitions('science');
      const filtered = list ? Array.from(list.querySelectorAll('[data-definition-key]')) : [];
      const filteredKeys = filtered.map((item) => item.getAttribute('data-definition-key'));
      expect(filteredKeys).toEqual(['Beta_Science_null']);
    } finally {
      cleanup();
    }
  });

  it('validates document URLs and blocks mismatched types', () => {
    const { window, cleanup } = setupWizard();
    try {
      const wizard = window.assignmentWizard;
      expect(typeof wizard.validateDocUrls).toBe('function');

      const slidesUrl = 'https://docs.google.com/presentation/d/slides1234567890/edit';
      const sheetsUrl = 'https://docs.google.com/spreadsheets/d/sheets1234567890/edit';
      const validResult = wizard.validateDocUrls(slidesUrl, slidesUrl);
      const invalidResult = wizard.validateDocUrls(slidesUrl, sheetsUrl);

      if (typeof validResult === 'object') {
        expect(validResult.ok).toBe(true);
      } else {
        expect(validResult).toBe(true);
      }

      if (typeof invalidResult === 'object') {
        expect(invalidResult.ok).toBe(false);
      } else {
        expect(invalidResult).toBe(false);
      }
    } finally {
      cleanup();
    }
  });

  it('disables link/create actions while requests are in flight', () => {
    const { window, document, googleRun, cleanup } = setupWizard();
    try {
      const wizard = window.assignmentWizard;
      expect(typeof wizard.handleLinkSubmit).toBe('function');
      expect(typeof wizard.handleCreateSubmit).toBe('function');

      const linkButton = document.getElementById('linkDefinitionSubmit');
      const createButton = document.getElementById('createDefinitionSubmit');

      wizard.handleLinkSubmit({
        definitionKey: 'Alpha_Topic_null',
        alternateTitle: 'Alpha',
        alternateTopic: 'Topic',
      });

      expect(linkButton?.disabled).toBe(true);

      googleRun.triggerSuccess('linkAssignmentToDefinition', { definitionKey: 'Alpha_Topic_null' });
      expect(linkButton?.disabled).toBe(false);

      wizard.handleCreateSubmit({
        assignmentId: 'a1',
        primaryTitle: 'Alpha',
        primaryTopic: 'Topic',
        yearGroup: null,
        referenceUrl: 'https://docs.google.com/presentation/d/slides1234567890/edit',
        templateUrl: 'https://docs.google.com/presentation/d/slides1234567890/edit',
      });

      expect(createButton?.disabled).toBe(true);
      googleRun.triggerFailure('createDefinitionFromUrls', { message: 'Bad URL' });
      expect(createButton?.disabled).toBe(false);
    } finally {
      cleanup();
    }
  });

  it('closes the dialog when cancel is clicked', () => {
    const { document, googleHost, cleanup } = setupWizard();
    try {
      document.getElementById('cancelWizard')?.click();
      expect(googleHost.close).toHaveBeenCalledTimes(1);
    } finally {
      cleanup();
    }
  });
});
