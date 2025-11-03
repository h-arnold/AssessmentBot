const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const adminAppScriptPath = path.join(rootDir, 'src', 'AdminSheet', 'appsscript.json');
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
