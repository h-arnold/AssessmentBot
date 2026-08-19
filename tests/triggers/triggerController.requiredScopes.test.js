/**
 * Sync guard for TriggerController.REQUIRED_SCOPES.
 *
 * TriggerController.REQUIRED_SCOPES (src/backend/Triggers/TriggerController.js)
 * and the oauthScopes array in src/backend/appsscript.json are two sources of
 * truth for the scopes required to install and execute time-based triggers.
 * This test enforces that they stay in sync; it does not attempt a runtime
 * merge.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const { TriggerController } = require('../../src/backend/Triggers/TriggerController.js');

const manifestPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../src/backend/appsscript.json'
);
const oauthScopes = JSON.parse(readFileSync(manifestPath, 'utf8')).oauthScopes;

describe('TriggerController REQUIRED_SCOPES', () => {
  it('matches the oauthScopes array in src/backend/appsscript.json', () => {
    expect(TriggerController.REQUIRED_SCOPES).toEqual(oauthScopes);
  });
});
