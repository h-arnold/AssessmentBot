import { describe, it, expect } from 'vitest';
const {
  loadSingletonsWithMocks,
  SingletonTestHarness,
} = require('../helpers/singletonTestSetup.js');
const gasMocks = require('../__mocks__/googleAppsScript');

describe('BeerCSSUIHandler dialog rendering', () => {
  it('applies provided dimensions and shows modal dialogs', async () => {
    const harness = new SingletonTestHarness();

    await harness.withFreshSingletons(() => {
      // Ensure UIManager is loaded so BeerCSSUIHandler can extend it correctly
      loadSingletonsWithMocks(harness, { loadUIManager: true });
      // Require the handler after mocks and UIManager are installed
      const BeerCSSUIHandler = require('../../src/AdminSheet/UI/99_BeerCssUIHandler.js');
      const handler = BeerCSSUIHandler.getInstance();

      handler.showBeerCssDemoDialog();

      expect(gasMocks.HtmlService._calls).toContain('createTemplateFromFile:UI/BeerCssDemoDialog');
      expect(gasMocks.HtmlService._calls).toContain('setWidth:420');
      expect(gasMocks.HtmlService._calls).toContain('setHeight:220');
      expect(gasMocks.SpreadsheetApp._calls).toContain('showModalDialog:BeerCSS Demo');

      handler.showBeerCssPlaygroundDialog();

      expect(gasMocks.HtmlService._calls).toContain('createTemplateFromFile:UI/BeerCssPlayground');
      expect(gasMocks.HtmlService._calls).toContain('setWidth:800');
      expect(gasMocks.HtmlService._calls).toContain('setHeight:680');
      expect(gasMocks.SpreadsheetApp._calls).toContain('showModalDialog:BeerCSS Playground');
    });
  });
});
