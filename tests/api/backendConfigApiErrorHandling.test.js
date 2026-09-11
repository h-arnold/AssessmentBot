/**
 * Focused contract tests for the `setBackendConfig` transport review findings
 * (pre-PR review, configuration/API remediation batch):
 *
 *   1. A typed locked-write contention failure must propagate to the retriable
 *      `RATE_LIMITED` envelope rather than being flattened into a domain
 *      `{ success: false }` result, and the raw internal message must never be
 *      returned to the caller.
 *   2. A per-field validation failure must emit exactly ONE boundary error log
 *      (the previous implementation logged the field detail and then the
 *      aggregate, duplicating the same failure).
 *   3. Each ordinary writable field must be declared exactly once in the
 *      descriptor list so the read behaviour cannot drift from the field name.
 *
 * These encode the target contract for `src/backend/z_Api/apiConfig.js`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadApiHandlerModule,
  setupApiHandlerTestContext,
  teardownApiHandlerTestContext,
} from '../helpers/apiHandlerTestUtils.js';
import { createConfigurationManagerMock } from '../helpers/backendConfigTestHelpers.js';

const fs = require('node:fs');

const ORDINARY_WRITABLE_FIELDS = Object.freeze([
  'backendAssessorBatchSize',
  'slidesFetchBatchSize',
  'apiKey',
  'backendUrl',
  'revokeAuthTriggerSet',
  'daysUntilAuthRevoke',
  'jsonDbMasterIndexKey',
  'jsonDbLockTimeoutMs',
  'jsonDbLogLevel',
  'jsonDbBackupOnInitialise',
  'jsonDbRootFolderId',
]);

/**
 * Dispatches a request through the real ApiDispatcher singleton.
 * @param {string} method - The allowlisted method name.
 * @param {Object} [params] - Optional method payload.
 * @returns {Object} The response envelope.
 */
function dispatch(method, params) {
  const { ApiDispatcher } = loadApiHandlerModule();
  return ApiDispatcher.getInstance().handle({
    method,
    ...(params === undefined ? {} : { params }),
  });
}

describe('backend configuration API transport — locked-write failure propagation', () => {
  let context;
  let configurationManagerMock;

  beforeEach(() => {
    context = setupApiHandlerTestContext(vi, { installLogger: 'mock' });
  });

  afterEach(() => {
    if (configurationManagerMock) {
      configurationManagerMock.restore();
      configurationManagerMock = undefined;
    }
    teardownApiHandlerTestContext(vi, context);
  });

  it('maps a typed locked-write contention failure to a retriable RATE_LIMITED envelope', () => {
    const contention = new Error('Script lock could not be acquired within the timeout.');
    contention.code = 'CONFIG_LOCK_CONTENTION';
    contention.retriable = true;
    configurationManagerMock = createConfigurationManagerMock(
      vi,
      {},
      {
        writeConfigurationLocked: () => {
          throw contention;
        },
      }
    );

    const response = dispatch('setBackendConfig', { backendAssessorBatchSize: 42 });

    // Contention is transient: it must reach the caller as a retriable
    // rate-limit envelope, not a non-retriable INTERNAL_ERROR and not a
    // domain-level `{ success: false }` success envelope.
    expect(response.ok).toBe(false);
    expect(response.error).toMatchObject({ code: 'RATE_LIMITED', retriable: true });
    // The internal lock signal text is not frontend-safe and must not leak.
    expect(response.error.message).not.toContain('Script lock could not be acquired');
  });

  it('emits exactly one boundary error log when a supplied field fails validation', () => {
    configurationManagerMock = createConfigurationManagerMock(vi);
    configurationManagerMock.manager.preparePropertyValue.mockImplementation(() => {
      throw new Error('Backend Assessor Batch Size must be an integer.');
    });

    const response = dispatch('setBackendConfig', { backendAssessorBatchSize: 0 });

    // The existing redacted aggregate domain result is preserved.
    expect(response).toMatchObject({ ok: true, data: { success: false } });
    // The former per-field detail log duplicated the aggregate boundary log;
    // log-once discipline requires a single emission.
    expect(context.errorSpy).toHaveBeenCalledTimes(1);
  });
});

describe('backend configuration API transport — writable-field descriptor consistency', () => {
  it('declares each ordinary writable field exactly once in the descriptor list', () => {
    const source = fs.readFileSync(require.resolve('../../src/backend/z_Api/apiConfig.js'), 'utf8');
    const declaration = source.match(
      /BACKEND_CONFIG_WRITABLE_FIELDS\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\s*\)/u
    );

    expect(declaration).not.toBeNull();
    const descriptorBody = declaration[1];

    for (const field of ORDINARY_WRITABLE_FIELDS) {
      const occurrences = descriptorBody.match(new RegExp(`\\b${field}\\b`, 'gu')) ?? [];
      expect(occurrences, `${field} must be defined exactly once`).toHaveLength(1);
    }
  });
});
