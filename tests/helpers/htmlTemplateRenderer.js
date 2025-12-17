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
