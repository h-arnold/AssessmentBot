const fs = require('node:fs');

/**
 * Write JSON to disk with 2-space pretty formatting and ensure trailing newline.
 * @param {string} filePath
 * @param {Object} json
 */
function writeJson(filePath, json) {
  const content = JSON.stringify(json, null, 2) + '\n';
  fs.writeFileSync(filePath, content, 'utf8');
}

/**
 * Replace TriggerController.REQUIRED_SCOPES block in a source file with the
 * provided scopes array. Ensures trailing newline.
 * @param {string[]} scopes
 * @param {{filePath: string}} opts
 */
function updateTriggerControllerScopes(scopes, opts = {}) {
  if (!Array.isArray(scopes)) throw new TypeError('scopes must be an array');
  const filePath = opts.filePath;
  if (!filePath) throw new TypeError('filePath is required');

  const raw = fs.readFileSync(filePath, 'utf8');

  const newBlockLines = ['TriggerController.REQUIRED_SCOPES = ['];
  scopes.forEach((s) => newBlockLines.push(`  '${s}',`));
  newBlockLines.push('];', '');
  const newBlock = newBlockLines.join('\n');

  // Replace existing block; use non-greedy match so only the REQUIRED_SCOPES
  // block is replaced.
  const updated = raw.replace(/TriggerController\.REQUIRED_SCOPES\s*=\s*\[[\s\S]*?\];/, newBlock);

  fs.writeFileSync(filePath, updated.endsWith('\n') ? updated : updated + '\n', 'utf8');
}

/**
 * Copy the admin appsscript.json to a template path (pretty-printed)
 * and update TriggerController scopes from the admin configuration.
 * @param {{adminPath: string, templatePath: string, triggerPath: string}} opts
 */
function syncAppsscript(opts = {}) {
  const { adminPath, templatePath, triggerPath } = opts;
  if (!adminPath || !templatePath || !triggerPath) {
    throw new TypeError('adminPath, templatePath and triggerPath are required');
  }

  const raw = fs.readFileSync(adminPath, 'utf8');
  const cfg = JSON.parse(raw);

  if (!Array.isArray(cfg.oauthScopes)) {
    throw new TypeError('AdminSheet appsscript.json must define an oauthScopes array.');
  }

  writeJson(templatePath, cfg);
  updateTriggerControllerScopes(cfg.oauthScopes, { filePath: triggerPath });
}

if (require.main === module) {
  const path = require('node:path');
  try {
    const adminPath = path.join(__dirname, '..', 'src', 'AdminSheet', 'appsscript.json');
    const templatePath = path.join(
      __dirname,
      '..',
      'src',
      'AssessmentRecordTemplate',
      'appsscript.json'
    );
    const triggerPath = path.join(
      __dirname,
      '..',
      'src',
      'AdminSheet',
      'Utils',
      'TriggerController.js'
    );
    syncAppsscript({ adminPath, templatePath, triggerPath });
    console.log('Apps Script manifests synchronised.');
  } catch (err) {
    console.error(
      'Failed to synchronise Apps Script manifests:',
      err && err.message ? err.message : err
    );
    process.exit(1);
  }
}

module.exports = { writeJson, updateTriggerControllerScopes, syncAppsscript };
