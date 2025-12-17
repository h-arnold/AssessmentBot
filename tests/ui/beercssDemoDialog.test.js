import { describe, it, expect } from 'vitest';
import path from 'node:path';
import {
  createDomFromTemplate,
  renderTemplateWithIncludes,
} from '../helpers/htmlTemplateRenderer.js';

const templatePath = path.resolve(__dirname, '../../src/AdminSheet/UI/BeerCssDemoDialog.html');

describe('BeerCssDemoDialog template', () => {
  it('inlines shared head and BeerCSS vendor partials', () => {
    const rendered = renderTemplateWithIncludes(templatePath);

    expect(rendered).not.toMatch(/<\?!=\s*include/);
    expect(rendered).toContain('BeerCSS (scoped) vendored for Apps Script HtmlService');
    expect(rendered).toContain('<base target="_top" />');
  });

  it('renders a scoped BeerCSS container with demo content and close action', () => {
    const dom = createDomFromTemplate(templatePath);
    const { document } = dom.window;

    const beerContainer = document.querySelector('.beer');
    expect(beerContainer).not.toBeNull();

    const heading = beerContainer.querySelector('h5');
    expect(heading?.textContent).toBe('BeerCSS is active');

    const paragraph = beerContainer.querySelector('p');
    expect(paragraph?.textContent).toContain('vendored scoped BeerCSS stylesheet');

    const closeButton = beerContainer.querySelector('button.border');
    expect(closeButton).not.toBeNull();
    expect(closeButton?.getAttribute('onclick')).toContain('google.script.host.close');

    const styles = Array.from(document.querySelectorAll('style'));
    const hasScopedFlag = styles.some((style) => style.textContent.includes('--scoped: 1'));
    expect(hasScopedFlag).toBe(true);

    dom.window.close();
  });
});
