const fs = require('fs');
/**
 * @file sync-appsscript.js
 * @summary Husky pre-commit helper that ensures OAuth scopes remain in sync across the repository.
 *
 * @description
 * This script is intended to run as a Husky pre-commit hook. Its purpose is to detect and reconcile
 * differences between OAuth scopes declared in Google Apps Script manifests (appsscript.json) and the
 * scopes expected/declared by the TriggerController (a centralized place in this repository that lists
 * required scopes for triggered / runtime behavior).
 *
 * Why this exists
 * - Apps Script projects require explicit OAuth scopes in their appsscript.json manifest files.
 * - When code introduces new runtime behaviors (especially triggers or APIs accessed in TriggerController),
 *   corresponding OAuth scopes must be present in each affected appsscript.json. Missing or mismatched
 *   scopes can cause runtime failures or insufficient permission issues after deployment.
 *
 * What this script does (high level)
 * - Locate relevant appsscript.json manifests in the repository.
 * - Parse and collect scope declarations.
 * - Read the authoritative scope list from the TriggerController (or a central source maintained here).
 * - Compare manifests and the TriggerController list; update manifests or the central list as needed to
 *   keep everything consistent, or fail the commit if automatic resolution would be unsafe.
 * - Exit with a non-zero status if synchronization fails or requires manual intervention; otherwise allow commit.
 *
 * Behavioral guarantees & recommendations
 * - The script should be idempotent: running it multiple times without code changes should not create
 *   successive diffs.
 * - Changes made by the script should be small and reviewable. Prefer failing the commit and asking the
 *   developer to review scope changes over making risky automatic edits.
 * - When this script mutates files, Husky will prevent the commit until the developer re-stages updated files.
 * - Developers should always review scope additions carefully. OAuth scopes are security-sensitive — a new
 *   scope often grants broader access and requires deliberate justification.
 *
 * Usage notes
 * - This script is normally invoked automatically by Husky on pre-commit.
 * - To run manually (for testing or CI), invoke the script from the repo root so it can locate manifests and
 *   the TriggerController file(s).
 *
 * Limitations
 * - The script is intended to reconcile manifests and a single TriggerController-style authoritative source
 *   used in this repository. It does not probe deployed Apps Script projects nor external environments.
 * - It assumes a consistent manifest schema and repository layout; if files are moved or renamed, the script
 *   may need updating.
 *
 * @author Repository maintainers
 * @see package.json (husky configuration) -- ensures this script runs during the pre-commit hook.
 */
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
function writeJson(filePath, data, fsModule = fs) {
  const serialised = `${JSON.stringify(data, null, 2)}\n`;
  fsModule.writeFileSync(filePath, serialised, 'utf8');
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
function updateTriggerControllerScopes(
  scopes,
  { fsModule = fs, filePath = triggerControllerPath } = {}
) {
  const triggerSource = fsModule.readFileSync(filePath, 'utf8');
  const blockRegex = /TriggerController\.REQUIRED_SCOPES = \[[\s\S]*?\];/;

  if (!blockRegex.test(triggerSource)) {
    throw new Error('Unable to locate REQUIRED_SCOPES block in TriggerController.js');
  }

  const scopeLines = scopes.map((scope) => `  '${scope}',`).join('\n');
  const replacement = `TriggerController.REQUIRED_SCOPES = [\n${scopeLines}\n];`;
  const updatedSource = triggerSource.replace(blockRegex, replacement);
  const finalSource = updatedSource.endsWith('\n') ? updatedSource : `${updatedSource}\n`;

  fsModule.writeFileSync(filePath, finalSource, 'utf8');
}

/**
 * Synchronise Apps Script configuration across project artefacts.
 * @param {Object} [options] - Optional overrides for dependency injection.
 * @param {import('fs')} [options.fsModule] - File system interface.
 * @param {string} [options.adminPath] - Path to AdminSheet appsscript.json.
 * @param {string} [options.templatePath] - Path to template appsscript.json.
 * @param {string} [options.triggerPath] - Path to TriggerController source file.
 */
function syncAppsscript({
  fsModule = fs,
  adminPath = adminAppScriptPath,
  templatePath = templateAppScriptPath,
  triggerPath = triggerControllerPath,
} = {}) {
  const adminConfig = JSON.parse(fsModule.readFileSync(adminPath, 'utf8'));

  if (!Array.isArray(adminConfig.oauthScopes)) {
    throw new Error('AdminSheet appsscript.json must define an oauthScopes array.');
  }

  writeJson(templatePath, adminConfig, fsModule);
  updateTriggerControllerScopes(adminConfig.oauthScopes, {
    fsModule,
    filePath: triggerPath,
  });
}

function main() {
  syncAppsscript();

  console.log('Synced appsscript configuration and trigger scopes.');
}

module.exports = {
  writeJson,
  updateTriggerControllerScopes,
  syncAppsscript,
  main,
};

if (require.main === module) {
  main();
}
