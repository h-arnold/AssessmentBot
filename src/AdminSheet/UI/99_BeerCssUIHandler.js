/**
 * @class BeerCSSUIHandler
 * @extends UIManager
 * @description Extends UIManager to provide new BeerCSS-based dialog and menu implementations.
 * This class serves as the new UI layer using vendored BeerCSS styling.
 *
 * As features are refactored to use BeerCSS, override the parent UIManager methods here.
 * The parent class remains as the legacy implementation for unchanged features.
 *
 * Once all features are migrated, this class will be renamed to UIManager and the old
 * UIManager can be removed.
 *
 * @example
 * const uiHandler = BeerCSSUIHandler.getInstance();
 * uiHandler.showConfigurationDialog(); // Uses BeerCSS version once implemented
 */

class BeerCSSUIHandler extends UIManager {
  /**
   * Constructor for BeerCSSUIHandler
   * @param {boolean} isSingletonCreator - Flag indicating legitimate singleton construction
   */
  constructor(isSingletonCreator = false) {
    super(isSingletonCreator);
  }

  /**
   * Internal helper to render BeerCSS dialog templates.
   * Loads a template file, injects template data, evaluates it with scriptlet support,
   * and displays as a modal dialog.
   *
   * @param {string} file - Template file path relative to root (e.g. 'UI/BeerCssDialog')
   * @param {Object} data - Key/values to inject into template before evaluation
   * @param {string} title - Dialog title
   * @param {{width?:number,height?:number}} opts - Dialog dimensions (defaults applied if absent)
   * @private
   */
  _renderDialog(file, data, title, { width = 400, height = 300 } = {}) {
    this.safeUiOperation(() => {
      const template = HtmlService.createTemplateFromFile(file);
      if (data && typeof data === 'object') {
        Object.keys(data).forEach((k) => {
          template[k] = data[k];
        });
      }
      const htmlOutput = template.evaluate().setWidth(width).setHeight(height);
      // Use the probed UI instance rather than accessing SpreadsheetApp directly
      this.ui.showModalDialog(htmlOutput, title);
    }, `_renderDialog:${title}`);
  }

  /**
   * Shows a minimal BeerCSS-backed dialog demonstrating the include/vendoring approach.
   * This is a reference implementation proving the BeerCSS scaffold works end-to-end.
   */
  showBeerCssDemoDialog() {
    this._renderDialog('UI/BeerCssDemoDialog', {}, 'BeerCSS Demo', {
      width: 420,
      height: 220,
    });
  }

  /**
   * Shows a BeerCSS playground dialog to preview common components.
   * Interactive reference for developers building new dialogs.
   */
  showBeerCssPlaygroundDialog() {
    this._renderDialog('UI/BeerCssPlayground', {}, 'BeerCSS Playground', {
      width: 800,
      height: 680,
    });
  }

  /**
   * Opens the progress modal using a BeerCSS template.
   */
  showProgressModal() {
    this._renderDialog('UI/BeerCssProgressModal', {}, 'Progress', {
      width: 400,
      height: 160,
    });
  }

  /**
   * Shows the assessment wizard modal for Step 1.
   */
  showAssessmentWizard() {
    const courseId = ConfigurationManager.getInstance().getAssessmentRecordCourseId();
    const abClass = new ABClassController().loadClass(courseId);
    const yearGroup = abClass.yearGroup ?? null;
    this._renderDialog(
      'UI/AssessmentWizard',
      { wizardContext: { courseId, yearGroup } },
      'Step 1 - Select assignment',
      {
        width: 760,
        height: 680,
      }
    );
  }

  // TODO: Override parent methods here as you refactor them to BeerCSS
  // Example stub for future migration:
  // showConfigurationDialog() {
  //   this._renderDialog('UI/ConfigurationDialogNew', {}, 'Settings', {
  //     width: 500,
  //     height: 400,
  //   });
  // }
}

// Export for Node tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BeerCSSUIHandler;
}
