import { describe, it, expect, vi } from 'vitest';
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

  it('renders the progress and assessment wizard BeerCSS modals', async () => {
    const harness = new SingletonTestHarness();

    await harness.withFreshSingletons(() => {
      loadSingletonsWithMocks(harness, { loadUIManager: true });
      const BeerCSSUIHandler = require('../../src/AdminSheet/UI/99_BeerCssUIHandler.js');
      const handler = BeerCSSUIHandler.getInstance();

      handler.showProgressModal();

      expect(gasMocks.HtmlService._calls).toContain(
        'createTemplateFromFile:UI/BeerCssProgressModal'
      );
      expect(gasMocks.HtmlService._calls).toContain('setWidth:400');
      expect(gasMocks.HtmlService._calls).toContain('setHeight:160');
      expect(gasMocks.SpreadsheetApp._calls).toContain('showModalDialog:Progress');

      handler.showAssessmentWizard();

      expect(gasMocks.HtmlService._calls).toContain('createTemplateFromFile:UI/AssessmentWizard');
      expect(gasMocks.HtmlService._calls).toContain('setWidth:660');
      expect(gasMocks.HtmlService._calls).toContain('setHeight:440');
      expect(gasMocks.SpreadsheetApp._calls).toContain(
        'showModalDialog:Step 1 - Select assignment'
      );
    });
  });

  it('passes template data before rendering via _renderDialog', async () => {
    const harness = new SingletonTestHarness();

    await harness.withFreshSingletons(() => {
      loadSingletonsWithMocks(harness, { loadUIManager: true });
      const BeerCSSUIHandler = require('../../src/AdminSheet/UI/99_BeerCssUIHandler.js');
      const handler = BeerCSSUIHandler.getInstance();

      const htmlService = gasMocks.HtmlService;
      const originalCreateTemplate = htmlService.createTemplateFromFile;
      let capturedTemplate;

      const htmlOutput = {
        setWidth(width) {
          htmlService._calls.push(`setWidth:${width}`);
          return this;
        },
        setHeight(height) {
          htmlService._calls.push(`setHeight:${height}`);
          return this;
        },
      };

      htmlService.createTemplateFromFile = vi.fn((name) => {
        capturedTemplate = {
          name,
          evaluate() {
            return htmlOutput;
          },
        };
        htmlService._calls.push(`createTemplateFromFile:${name}`);
        return capturedTemplate;
      });

      try {
        handler._renderDialog(
          'UI/BeerCssDemoDialog',
          { injectedKey: 'injected value' },
          'Injected data',
          { width: 321, height: 210 }
        );

        expect(capturedTemplate).toBeDefined();
        expect(capturedTemplate.injectedKey).toBe('injected value');
        expect(gasMocks.HtmlService._calls).toContain('setWidth:321');
        expect(gasMocks.HtmlService._calls).toContain('setHeight:210');
        expect(gasMocks.SpreadsheetApp._calls).toContain('showModalDialog:Injected data');
      } finally {
        htmlService.createTemplateFromFile = originalCreateTemplate;
      }
    });
  });
});
