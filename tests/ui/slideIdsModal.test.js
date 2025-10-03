import { describe, it, expect, vi, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const modalPath = path.resolve(__dirname, '../../src/AdminSheet/UI/SlideIdsModal.html');
const rawHtml = fs.readFileSync(modalPath, 'utf8');

const realisticAssignmentTitle = 'Year 10 DT – Sphero Programming Slides';
const realisticAssignmentId = '625001234567';
const realisticReferenceId = '1Qaz2Wsx3Edc4Rfv5Tgb6Yhn7Ujm8Ik9Ol0PqRsTuVWxYzAB';
const realisticTemplateId = '1ZaQxSwcDevFrBgTnhYmJuKiLoPpQzRsTuvWxYzAbCdEfGhI';

function renderTemplate(template, { assignmentDataObj, savedDocumentIds }) {
  return template
    .replace(/<\?= assignmentDataObj.name \?>/g, assignmentDataObj.name)
    .replace(/<\?= assignmentDataObj.id \?>/g, assignmentDataObj.id)
    .replace(
      /<\?= savedDocumentIds.referenceDocumentId \|\| '' \?>/g,
      savedDocumentIds.referenceDocumentId || ''
    )
    .replace(
      /<\?= savedDocumentIds.templateDocumentId \|\| '' \?>/g,
      savedDocumentIds.templateDocumentId || ''
    );
}

function createMaterializeMock() {
  return {
    updateTextFields: vi.fn(),
    toast: vi.fn(),
  };
}

function createGoogleMock() {
  const host = {
    close: vi.fn(),
  };

  const run = {
    failureHandler: null,
    successHandler: null,
    savedArgs: null,
    withFailureHandler(handler) {
      this.failureHandler = handler;
      return this;
    },
    withSuccessHandler(handler) {
      this.successHandler = handler;
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
    reset() {
      this.failureHandler = null;
      this.successHandler = null;
      this.savedArgs = null;
      this.saveStartAndShowProgress.mockClear();
    },
  };

  run.saveStartAndShowProgress = vi.fn((...args) => {
    run.savedArgs = args;
  });

  return {
    google: {
      script: {
        host,
        run,
      },
    },
    run,
    host,
  };
}

function setupModal(options = {}) {
  const assignmentDataObj = {
    name: realisticAssignmentTitle,
    id: realisticAssignmentId,
    ...options.assignmentDataObj,
  };

  const savedDocumentIds = {
    referenceDocumentId: realisticReferenceId,
    templateDocumentId: realisticTemplateId,
    ...options.savedDocumentIds,
  };

  const templatedHtml = renderTemplate(rawHtml, { assignmentDataObj, savedDocumentIds });
  const dom = new JSDOM(templatedHtml, {
    url: 'https://example.test',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });

  const { window } = dom;
  const materializeMock = createMaterializeMock();
  const { google, run, host } = createGoogleMock();

  window.M = materializeMock;
  window.google = google;
  window.alert = vi.fn();

  const inlineScriptTag = Array.from(window.document.querySelectorAll('script')).find(
    (s) => !s.src && s.textContent.trim()
  );
  if (!inlineScriptTag) {
    throw new Error('Inline script block not found in SlideIdsModal.html');
  }
  window.eval(inlineScriptTag.textContent);

  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

  return {
    window,
    document: window.document,
    materializeMock,
    googleRun: run,
    googleHost: host,
    alertMock: window.alert,
    assignmentDataObj,
    savedDocumentIds,
    cleanup: () => dom.window.close(),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SlideIdsModal UI flow', () => {
  it('initialises inputs with saved values and hides any validation errors on load', () => {
    const { document, materializeMock, cleanup, savedDocumentIds } = setupModal();

    try {
      const referenceInput = document.getElementById('referenceDocumentId');
      const templateInput = document.getElementById('templateDocumentId');
      const errorBanner = document.getElementById('idMatchError');

      expect(referenceInput.value).toBe(savedDocumentIds.referenceDocumentId);
      expect(templateInput.value).toBe(savedDocumentIds.templateDocumentId);
      expect(errorBanner.style.display).toBe('none');
      expect(materializeMock.updateTextFields).toHaveBeenCalledTimes(1);
    } finally {
      cleanup();
    }
  });

  it('marks inputs invalid when document IDs match and clears the state when they diverge', () => {
    const { window, document, cleanup } = setupModal();

    try {
      const referenceInput = document.getElementById('referenceDocumentId');
      const templateInput = document.getElementById('templateDocumentId');
      const errorBanner = document.getElementById('idMatchError');

      const duplicateId = realisticReferenceId;
      referenceInput.value = duplicateId;
      templateInput.value = duplicateId;

      expect(window.validateDocumentIds()).toBe(false);
      expect(errorBanner.style.display).toBe('block');
      expect(referenceInput.classList.contains('invalid')).toBe(true);
      expect(templateInput.classList.contains('invalid')).toBe(true);

      templateInput.value = realisticTemplateId;

      expect(window.validateDocumentIds()).toBe(true);
      expect(errorBanner.style.display).toBe('none');
      expect(referenceInput.classList.contains('invalid')).toBe(false);
      expect(templateInput.classList.contains('invalid')).toBe(false);
    } finally {
      cleanup();
    }
  });

  it('requires both IDs before attempting to save', () => {
    const { window, document, alertMock, googleRun, cleanup } = setupModal({
      savedDocumentIds: {
        referenceDocumentId: '',
        templateDocumentId: '',
      },
    });

    try {
      const referenceInput = document.getElementById('referenceDocumentId');
      const templateInput = document.getElementById('templateDocumentId');

      referenceInput.value = '';
      templateInput.value = 'template-only';

      window.saveAndRun();

      expect(alertMock).toHaveBeenCalledWith(
        'Please enter both Reference Document ID and Template Document ID.'
      );
      expect(googleRun.saveStartAndShowProgress).not.toHaveBeenCalled();
    } finally {
      cleanup();
    }
  });

  it('prevents submission when IDs are identical and shows a red toast', () => {
    const { window, document, materializeMock, googleRun, cleanup } = setupModal();

    try {
      const referenceInput = document.getElementById('referenceDocumentId');
      const templateInput = document.getElementById('templateDocumentId');

      const sameId = realisticReferenceId;
      referenceInput.value = sameId;
      templateInput.value = sameId;

      window.saveAndRun();

      expect(materializeMock.toast).toHaveBeenCalledWith({
        html: 'Reference and template document IDs cannot be the same.',
        classes: 'red',
      });
      expect(googleRun.saveStartAndShowProgress).not.toHaveBeenCalled();
    } finally {
      cleanup();
    }
  });

  it('calls saveStartAndShowProgress with the expected payload and closes the modal on success path', () => {
    const { window, document, materializeMock, googleRun, googleHost, cleanup, assignmentDataObj } =
      setupModal();

    try {
      const referenceInput = document.getElementById('referenceDocumentId');
      const templateInput = document.getElementById('templateDocumentId');

      const referenceDocumentId = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789ABCDEfghi';
      const templateDocumentId = '1JkLmNoPqRsTuVwXyZaBcDeFgHiJkLmNoPqRsTuVwXyZaBC';

      referenceInput.value = referenceDocumentId;
      templateInput.value = templateDocumentId;

      window.saveAndRun();

      expect(googleRun.saveStartAndShowProgress).toHaveBeenCalledTimes(1);
      expect(googleRun.savedArgs).toEqual([
        assignmentDataObj.name,
        {
          referenceDocumentId,
          templateDocumentId,
        },
        assignmentDataObj.id,
        referenceDocumentId,
        templateDocumentId,
      ]);
      expect(googleHost.close).toHaveBeenCalledTimes(1);
      expect(materializeMock.toast).not.toHaveBeenCalled();

      googleRun.triggerSuccess();

      expect(materializeMock.toast).toHaveBeenCalledWith({
        html: 'Processing started.',
        classes: 'green',
      });
    } finally {
      cleanup();
    }
  });

  it('surfaces GAS failures via the alert failure handler', () => {
    const { window, document, alertMock, googleRun, materializeMock, cleanup } = setupModal();

    try {
      document.getElementById('referenceDocumentId').value = 'ref-200';
      document.getElementById('templateDocumentId').value = 'tmpl-200';

      window.saveAndRun();
      alertMock.mockClear();
      materializeMock.toast.mockClear();

      googleRun.triggerFailure({ message: 'Upstream boom' });

      expect(materializeMock.toast).toHaveBeenCalledWith({
        html: 'Processing failed: Upstream boom',
        classes: 'red',
      });
    } finally {
      cleanup();
    }
  });
});
