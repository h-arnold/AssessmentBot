/**
 * GAS web-app entrypoint that serves the built React HtmlService template.
 *
 * @returns {GoogleAppsScript.HTML.HtmlOutput} Rendered web-app HTML output.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('UI/ReactApp');
}

if (typeof module !== 'undefined') {
  module.exports = { doGet };
}
