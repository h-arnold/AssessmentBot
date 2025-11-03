import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  writeJson,
  updateTriggerControllerScopes,
  syncAppsscript,
} = require('../../scripts/sync-appsscript.js');

let tempDir;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'sync-appsscript-test-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('writeJson', () => {
  it('writes pretty JSON with trailing newline', () => {
    const filePath = path.join(tempDir, 'out.json');

    writeJson(filePath, { foo: 'bar' });

    const content = readFileSync(filePath, 'utf8');
    expect(content).toBe('{' + '\n  "foo": "bar"\n}\n');
  });
});

describe('updateTriggerControllerScopes', () => {
  it('replaces the REQUIRED_SCOPES block and ensures trailing newline', () => {
    const triggerPath = path.join(tempDir, 'TriggerController.js');
    const originalSource = [
      'const TriggerController = {};',
      'TriggerController.REQUIRED_SCOPES = [',
      "  'https://www.googleapis.com/auth/old',",
      '];',
      'module.exports = TriggerController;',
      '',
    ].join('\n');
    writeFileSync(triggerPath, originalSource, 'utf8');

    updateTriggerControllerScopes(['scope.one', 'scope.two'], { filePath: triggerPath });

    const updated = readFileSync(triggerPath, 'utf8');
    const expectedBlock = [
      'TriggerController.REQUIRED_SCOPES = [',
      "  'scope.one',",
      "  'scope.two',",
      '];',
      '',
    ].join('\n');
    expect(updated).toContain(expectedBlock);
    expect(updated.endsWith('\n')).toBe(true);
  });
});

describe('syncAppsscript', () => {
  const baseTriggerSource = [
    'const TriggerController = {};',
    'TriggerController.REQUIRED_SCOPES = [',
    "  'https://www.googleapis.com/auth/old',",
    '];',
    'module.exports = TriggerController;',
    '',
  ].join('\n');

  it('copies the admin config and updates trigger scopes', () => {
    const adminPath = path.join(tempDir, 'admin-appsscript.json');
    const templatePath = path.join(tempDir, 'template-appsscript.json');
    const triggerPath = path.join(tempDir, 'TriggerController.js');
    const adminConfig = {
      timeZone: 'Europe/London',
      oauthScopes: ['scope.one', 'scope.two'],
    };

    writeFileSync(adminPath, JSON.stringify(adminConfig, null, 2), 'utf8');
    writeFileSync(triggerPath, baseTriggerSource, 'utf8');

    syncAppsscript({ adminPath, templatePath, triggerPath });

    const templateContent = readFileSync(templatePath, 'utf8');
    expect(templateContent).toBe(`${JSON.stringify(adminConfig, null, 2)}\n`);

    const updatedTrigger = readFileSync(triggerPath, 'utf8');
    const expectedBlock = [
      'TriggerController.REQUIRED_SCOPES = [',
      "  'scope.one',",
      "  'scope.two',",
      '];',
      '',
    ].join('\n');
    expect(updatedTrigger).toContain(expectedBlock);
  });

  it('throws when oauthScopes is not an array', () => {
    const adminPath = path.join(tempDir, 'admin-appsscript.json');
    const templatePath = path.join(tempDir, 'template-appsscript.json');
    const triggerPath = path.join(tempDir, 'TriggerController.js');

    writeFileSync(
      adminPath,
      JSON.stringify({ timeZone: 'Europe/London', oauthScopes: 'not-an-array' }, null, 2),
      'utf8'
    );
    writeFileSync(triggerPath, baseTriggerSource, 'utf8');

    expect(() => syncAppsscript({ adminPath, templatePath, triggerPath })).toThrow(
      'AdminSheet appsscript.json must define an oauthScopes array.'
    );
  });
});
