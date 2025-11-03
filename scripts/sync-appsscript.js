/**
 * Husky pre-commit helper.
 *
 * Reads OAuth scopes from src/AdminSheet/appsscript.json and:
 * - copies the full appsscript.json to src/AssessmentRecordTemplate/appsscript.json;
 * - updates TriggerController.REQUIRED_SCOPES in
 *   src/AdminSheet/Utils/TriggerController.js to match the oauthScopes array
 *   from the AdminSheet config (only the scopes array is written there).
 *
 * This ensures the OAuth scopes remain consistent across the project.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const adminAppScriptPath = path.join(rootDir, 'src', 'AdminSheet', 'appsscript.json');
/**
 * Path to the Apps Script configuration file for the Assessment Record Template.
 * Constructed by joining the root directory with the relative path to appsscript.json.
 * @type {string}
 */
const templateAppScriptPath = path.join(
  rootDir,
  'src',
  'AssessmentRecordTemplate',
  'appsscript.json'
);
const triggerControllerPath = path.join(
  rootDir,
  'src',
  'AdminSheet',
  'Utils',
  'TriggerController.js'
);

/**
 * Persist structured JSON with trailing newline for readability.
 * @param {string} filePath - Target file path.
 * @param {Object} data - Parsed JSON content to serialise.
 */
function writeJson(filePath, data) {
  const serialised = `${JSON.stringify(data, null, 2)}\n`;
  fs.writeFileSync(filePath, serialised, 'utf8');
}

/**
 * Replace the REQUIRED_SCOPES array in TriggerController.js with the provided scopes.
 * @param {string[]} scopes - OAuth scopes sourced from appsscript.json.
 */
/**
 * Update the TriggerController.REQUIRED_SCOPES block in the TriggerController source file.
 *
 * Reads the file at `triggerControllerPath`, locates the existing
 * `TriggerController.REQUIRED_SCOPES = [...]` block using a regular expression, and
 * replaces it with a newly constructed array built from the provided `scopes`.
 * Each scope is written as a single-quoted, comma-terminated string on its own line.
 * Ensures the file ends with a single trailing newline.
 *
 * Notes:
 * - This function has side effects: it performs synchronous file I/O via `fs`.
 * - It expects `triggerControllerPath` and `fs` to be available in the enclosing module.
 *
 * @param {string[]} scopes - An array of scope strings to be written into the REQUIRED_SCOPES array.
 *
 * @throws {Error} If the REQUIRED_SCOPES block cannot be found in the TriggerController file.
 * @throws {Error} Any file system error thrown by `fs.readFileSync` or `fs.writeFileSync`.
 *
 * @returns {void}
 */
function updateTriggerControllerScopes(scopes) {
  const triggerSource = fs.readFileSync(triggerControllerPath, 'utf8');
  const blockRegex = /TriggerController\.REQUIRED_SCOPES = \[[\s\S]*?\];/;

  if (!blockRegex.test(triggerSource)) {
    throw new Error('Unable to locate REQUIRED_SCOPES block in TriggerController.js');
  }

  const scopeLines = scopes.map((scope) => `  '${scope}',`).join('\n');
  const replacement = `TriggerController.REQUIRED_SCOPES = [\n${scopeLines}\n];`;
  const updatedSource = triggerSource.replace(blockRegex, replacement);
  const finalSource = updatedSource.endsWith('\n') ? updatedSource : `${updatedSource}\n`;

  fs.writeFileSync(triggerControllerPath, finalSource, 'utf8');
}

function main() {
  const adminConfig = JSON.parse(fs.readFileSync(adminAppScriptPath, 'utf8'));

  if (!Array.isArray(adminConfig.oauthScopes)) {
    throw new Error('AdminSheet appsscript.json must define an oauthScopes array.');
  }

  writeJson(templateAppScriptPath, adminConfig);
  updateTriggerControllerScopes(adminConfig.oauthScopes);

  console.log('Synced appsscript configuration and trigger scopes.');
}

main();
