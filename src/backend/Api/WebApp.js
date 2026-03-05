/**
 * GAS web-app entrypoint that serves the built React HtmlService template.
 *
 * @returns {GoogleAppsScript.HTML.HtmlOutput} Rendered web-app HTML output.
 */
function doGet() {
  return HtmlService.createTemplateFromFile('UI/ReactApp').evaluate();
}

if (typeof module !== 'undefined') {
  module.exports = { doGet };
}
