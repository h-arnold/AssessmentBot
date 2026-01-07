import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';

function createMatchMediaMock() {
  return vi.fn().mockImplementation(() => ({
    matches: false,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function evalInlineScripts(window) {
  const scripts = Array.from(window.document.querySelectorAll('script'))
    .map((s) => s.textContent)
    .filter((text) => text?.trim());

  scripts.forEach((script) => {
    window.eval(script);
  });
}

describe('BeerCSS JS vendoring (GAS compatibility)', () => {
  it('does not contain ESM export syntax', () => {
    const vendorPath = path.resolve(
      __dirname,
      '../../src/AdminSheet/UI/vendor/beercss/BeerCssJs.html'
    );

    const content = fs.readFileSync(vendorPath, 'utf8');

    // If an export sneaks back in, HtmlService classic scripts will syntax-error.
    // (We allow the word "export" in comments/headers.)
    expect(content).not.toMatch(/\bexport\s*\{/);
    expect(content).not.toMatch(/\bexport\s+default\b/);
    expect(content).toContain('BeerCSS JavaScript vendored for Apps Script HtmlService');
  });

  it('executes in JSDOM as a classic script and exposes window.ui', () => {
    const vendorPath = path.resolve(
      __dirname,
      '../../src/AdminSheet/UI/vendor/beercss/BeerCssJs.html'
    );

    const content = fs.readFileSync(vendorPath, 'utf8');

    const dom = new JSDOM(`<!doctype html><html><head></head><body>${content}</body></html>`, {
      url: 'https://example.test',
      runScripts: 'outside-only',
      pretendToBeVisual: true,
    });

    const { window } = dom;

    // BeerCSS uses matchMedia during startup for auto mode.
    window.matchMedia = createMatchMediaMock();

    evalInlineScripts(window);

    expect(typeof window.ui).toBe('function');

    // Sanity checks against a couple of stable API calls.
    const guid = window.ui('guid');
    expect(guid).toMatch(/^f[0-9a-f]{7}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

    expect(window.ui('mode', 'light')).toBe('light');
    expect(window.document.body.classList.contains('light')).toBe(true);

    dom.window.close();
  });

  it('handles a basic data-ui click activation flow (snackbar)', () => {
    const vendorPath = path.resolve(
      __dirname,
      '../../src/AdminSheet/UI/vendor/beercss/BeerCssJs.html'
    );

    const jsPartial = fs.readFileSync(vendorPath, 'utf8');

    const dom = new JSDOM(
      `<!doctype html>
      <html>
        <body>
          <div id="toast" class="snackbar">Hello</div>
          <button id="open" data-ui="#toast">Open</button>
          ${jsPartial}
        </body>
      </html>`,
      {
        url: 'https://example.test',
        runScripts: 'outside-only',
        pretendToBeVisual: true,
      }
    );

    const { window } = dom;
    window.matchMedia = createMatchMediaMock();

    evalInlineScripts(window);

    // BeerCSS initialises its event wiring lazily; force a synchronous setup pass.
    window.ui();

    const toast = window.document.getElementById('toast');
    const open = window.document.getElementById('open');

    expect(toast.classList.contains('active')).toBe(false);

    open.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect(toast.classList.contains('active')).toBe(true);

    dom.window.close();
  });
});
