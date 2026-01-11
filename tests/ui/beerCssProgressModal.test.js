import { describe, it, expect, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTemplateWithIncludes } from '../helpers/htmlTemplateRenderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatePath = path.resolve(__dirname, '../../src/AdminSheet/UI/BeerCssProgressModal.html');

function createGoogleRunMock() {
  const host = { close: vi.fn() };
  const run = {
    calls: 0,
    successHandler: null,
    failureHandler: null,
    withSuccessHandler(handler) {
      this.successHandler = handler;
      return this;
    },
    withFailureHandler(handler) {
      this.failureHandler = handler;
      return this;
    },
    requestStatus() {
      this.calls += 1;
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
  return { google: { script: { host, run } }, host, run };
}

function setupProgressModal() {
  const html = renderTemplateWithIncludes(templatePath);
  const dom = new JSDOM(html, {
    url: 'https://example.test',
    runScripts: 'outside-only',
    resources: 'usable',
  });

  const { window } = dom;
  const googleMock = createGoogleRunMock();
  window.google = googleMock.google;

  const intervalId = Symbol('polling');
  window.setInterval = vi.fn(() => intervalId);
  window.clearInterval = vi.fn();
  window.setTimeout = vi.fn((callback) => {
    callback();
    return 'timeout-id';
  });

  const inlineScript = Array.from(window.document.querySelectorAll('script')).find(
    (script) => !script.src && script.textContent.includes('startPolling')
  );
  if (!inlineScript) {
    throw new Error('Unable to locate inline progress script');
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
    intervalId,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('BeerCSS progress modal', () => {
  it('starts polling for progress updates immediately', () => {
    const { window, googleRun, intervalId, cleanup } = setupProgressModal();
    try {
      expect(googleRun.calls).toBe(1);
      expect(window.setInterval).toHaveBeenCalledTimes(1);
      expect(window.setInterval.mock.calls[0][1]).toBe(2000);
      expect(window.pollingInterval).toBe(intervalId);
    } finally {
      cleanup();
    }
  });

  it('updates the status and closes the dialog when completed', () => {
    const { document, googleRun, googleHost, window, cleanup, intervalId } = setupProgressModal();
    try {
      const statusMessage = document.getElementById('status-message');
      const progressBar = document.getElementById('progress-bar');

      googleRun.triggerSuccess({ step: 1, message: 'Processing', completed: false });

      expect(statusMessage.textContent).toBe('Step 1: Processing');
      expect(progressBar.classList.contains('success')).toBe(false);

      googleRun.triggerSuccess({ step: 2, message: 'Done', completed: true });

      expect(window.clearInterval).toHaveBeenCalledWith(intervalId);
      expect(statusMessage.textContent).toContain('Step 2: Done');
      expect(statusMessage.textContent).toContain('(Completed)');
      expect(progressBar.classList.contains('indeterminate')).toBe(false);
      expect(progressBar.classList.contains('error')).toBe(false);
      expect(progressBar.classList.contains('success')).toBe(true);
      expect(googleHost.close).toHaveBeenCalledTimes(1);
      expect(window.setTimeout).toHaveBeenCalledTimes(1);
    } finally {
      cleanup();
    }
  });

  it('shows a clear error state when polling fails', () => {
    const { document, googleRun, googleHost, window, cleanup, intervalId } = setupProgressModal();
    try {
      const statusMessage = document.getElementById('status-message');
      const progressBar = document.getElementById('progress-bar');

      googleRun.triggerFailure({ message: 'Network error' });

      expect(statusMessage.textContent).toBe('Error fetching progress: Network error');
      expect(progressBar.classList.contains('indeterminate')).toBe(false);
      expect(progressBar.classList.contains('error')).toBe(true);
      expect(String(progressBar.value)).toBe('100');
      expect(window.clearInterval).toHaveBeenCalledWith(intervalId);
      expect(googleHost.close).not.toHaveBeenCalled();
      expect(window.setTimeout).not.toHaveBeenCalled();
    } finally {
      cleanup();
    }
  });
});
