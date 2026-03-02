/**
 * Renders a GAS HtmlService template by inlining `<?!= include('...') ?>` fragments.
 * @param {string} templatePath - Absolute path to the template file.
 * @param {{ rootDir?: string }} [options] - Optional overrides.
 * @returns {string} The rendered HTML with includes inlined.
 */
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const INCLUDE_REGEX = /<\?!=\s*include\('([^']+)'\)\s*\?>/g;

function inlineIncludes(html, rootDir) {
  let rendered = html;
  let match = INCLUDE_REGEX.exec(rendered);

  while (match) {
    const includeTag = match[0];
    const includeTarget = match[1];
    const includePath = path.resolve(rootDir, `${includeTarget}.html`);
    const includeContent = fs.readFileSync(includePath, 'utf8');

    rendered = rendered.replace(includeTag, includeContent);
    INCLUDE_REGEX.lastIndex = 0;
    match = INCLUDE_REGEX.exec(rendered);
  }

  return rendered;
}

export function renderTemplateWithIncludes(templatePath, options = {}) {
  if (!templatePath) {
    throw new Error('renderTemplateWithIncludes requires a templatePath.');
  }

  const defaultRoot = path.resolve(__dirname, '../../src/AdminSheet');
  const rootDir = options.rootDir || defaultRoot;
  const html = fs.readFileSync(templatePath, 'utf8');

  return inlineIncludes(html, rootDir);
}

export function createDomFromTemplate(templatePath, options = {}) {
  const rendered = renderTemplateWithIncludes(templatePath, options);

  return new JSDOM(rendered, {
    url: 'https://example.test',
    runScripts: 'outside-only',
    resources: 'usable',
  });
}

/**
 * Sets up the matchMedia mock and evals all non-main wizard scripts on the window.
 * Exposes WizardStepper to window if found in the evaluated scripts.
 * @param {object} window - The JSDOM window object.
 * @param {object} vi - The Vitest `vi` object for creating mocks.
 */
export function evalWizardScripts(window, vi) {
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

  // Eval all non-main scripts first (e.g. WizardStepper class from StepperJS.html)
  Array.from(window.document.querySelectorAll('script')).forEach((script) => {
    if (!script.src && !script.textContent.includes('assignmentWizard')) {
      const suffix = script.textContent.includes('class WizardStepper')
        ? '\nwindow.WizardStepper = WizardStepper;'
        : '';
      window.eval(script.textContent + suffix);
    }
  });
}
