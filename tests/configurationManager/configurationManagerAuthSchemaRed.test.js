/**
 * RED-phase contract tests for the Section 1 auth schema additions.
 *
 * These tests define the target contract from SPEC.md decision 2 and
 * docs/developer/data-shapes/auth-users.md (Persistence section) and MUST FAIL
 * against the current implementation (which still accepts `'none'`, has no
 * `authUsers`/`authRevision` validators, no 8KB cap constant, and no strict
 * auth-state validator). They are the specification the Implementation phase
 * must satisfy.
 *
 * Encoded API surface (to be delivered by 01_configKeysAndSchema.js):
 *  - CONFIG_KEYS.AUTH_USERS === 'authUsers', CONFIG_KEYS.AUTH_REVISION === 'authRevision'
 *  - CONFIG_SCHEMA[CONFIG_KEYS.AUTH_USERS].validate(value: string, instance?) => string
 *      Validates a JSON string array of { email, role } entries; returns the
 *      canonical JSON string; throws on any violation. Normalisation is NOT
 *      applied — unnormalised input is rejected.
 *  - CONFIG_SCHEMA[CONFIG_KEYS.AUTH_REVISION].validate(value: string, instance?) => string
 *      Validates a positive-integer string; returns the canonical string; throws otherwise.
 *  - MAX_CONFIG_BLOB_BYTES: number === 8 * 1024 (8192), exported for the write path.
 *  - validateAuthStateStrict_(authConfig) => { authMode, authGroupEmail, authUsers, authRevision }
 *      Strict security read. Throws on any broken-config state; the single
 *      leniency (absent authMode + non-blank authGroupEmail) resolves to
 *      googleGroups. The forgiving transport getter (getAuthMode) stays
 *      best-effort and never throws.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setupGlobalGASMocks } from '../helpers/mockFactories.js';

const fs = require('node:fs');

const {
  CONFIG_KEYS,
  CONFIG_SCHEMA,
  MAX_CONFIG_BLOB_BYTES,
  validateAuthStateStrict_,
} = require('../../src/backend/ConfigurationManager/01_configKeysAndSchema.js');
const ConfigurationManager = require('../../src/backend/ConfigurationManager/98_ConfigurationManagerClass.js');

function buildUsersJson(entries) {
  return JSON.stringify(entries);
}

describe('Backend configuration auth schema — authUsers, authRevision, size cap', () => {
  let mocks;
  let configManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks = setupGlobalGASMocks(vi, { mockConsole: true });
    ConfigurationManager.resetForTests();
    configManager = new ConfigurationManager(true);
    configManager.scriptProperties = mocks.PropertiesService.scriptProperties;
    configManager.documentProperties = mocks.PropertiesService.documentProperties;
    configManager._initialized = true;
    configManager.configCache = null;
  });

  describe('authUsers validator', () => {
    function getValidator() {
      return CONFIG_SCHEMA[CONFIG_KEYS.AUTH_USERS].validate;
    }

    it('exposes the authUsers config key and a script-scoped schema entry', () => {
      expect(CONFIG_KEYS.AUTH_USERS).toBe('authUsers');
      expect(CONFIG_SCHEMA[CONFIG_KEYS.AUTH_USERS]).toEqual(
        expect.objectContaining({ storage: 'script' })
      );
    });

    it.each([
      ['malformed JSON', '{not-json'],
      ['a non-array JSON value (object)', '{"email":"admin@school.edu"}'],
      ['a non-array JSON value (scalar)', '42'],
      [
        'duplicate emails after normalisation',
        buildUsersJson([
          { email: 'admin@school.edu', role: 'admin' },
          { email: 'ADMIN@school.edu', role: 'user' },
        ]),
      ],
      ['an unknown role', buildUsersJson([{ email: 'admin@school.edu', role: 'super' }])],
      [
        'an unknown key per entry',
        buildUsersJson([{ email: 'admin@school.edu', role: 'admin', extra: 'x' }]),
      ],
      ['a blank email', buildUsersJson([{ email: '   ', role: 'admin' }])],
      [
        'an unnormalised (uppercase) email',
        buildUsersJson([{ email: 'Admin@School.Edu', role: 'admin' }]),
      ],
      ['an untrimmed email', buildUsersJson([{ email: ' admin@school.edu ', role: 'admin' }])],
      ['a list with zero admins', buildUsersJson([{ email: 'user@school.edu', role: 'user' }])],
      ['an empty list', '[]'],
    ])('rejects %s', (_label, payload) => {
      const validator = getValidator();

      expect(() => validator(payload, configManager)).toThrow();
    });

    it('accepts a valid, already-normalised list and returns a canonical JSON string', () => {
      const validator = getValidator();
      const payload = buildUsersJson([
        { email: 'admin@school.edu', role: 'admin' },
        { email: 'user@school.edu', role: 'user' },
      ]);

      const result = validator(payload, configManager);

      expect(typeof result).toBe('string');
      expect(JSON.parse(result)).toEqual([
        { email: 'admin@school.edu', role: 'admin' },
        { email: 'user@school.edu', role: 'user' },
      ]);
    });
  });

  describe('authRevision validator', () => {
    function getValidator() {
      return CONFIG_SCHEMA[CONFIG_KEYS.AUTH_REVISION].validate;
    }

    it('exposes the authRevision config key and a script-scoped schema entry', () => {
      expect(CONFIG_KEYS.AUTH_REVISION).toBe('authRevision');
      expect(CONFIG_SCHEMA[CONFIG_KEYS.AUTH_REVISION]).toEqual(
        expect.objectContaining({ storage: 'script' })
      );
    });

    it.each([
      ['the zero revision', '0'],
      ['a non-integer string', 'abc'],
      ['an empty string', ''],
      ['a non-string (numeric) type', 1],
      ['a negative revision', '-1'],
      ['a fractional revision', '1.5'],
    ])('rejects %s', (_label, payload) => {
      const validator = getValidator();

      expect(() => validator(payload, configManager)).toThrow();
    });

    it('accepts the initial revision', () => {
      const validator = getValidator();

      expect(validator('1', configManager)).toBe('1');
    });

    it('accepts a higher positive-integer revision', () => {
      const validator = getValidator();

      expect(validator('42', configManager)).toBe('42');
    });

    it('canonicalises a non-canonical positive-integer revision (no leading zeros)', () => {
      const validator = getValidator();

      expect(validator('007', configManager)).toBe('7');
      expect(validator('0001', configManager)).toBe('1');
    });
  });

  describe('8KB configuration blob cap constant', () => {
    it('exports the maximum serialised config blob size as 8192 bytes', () => {
      expect(typeof MAX_CONFIG_BLOB_BYTES).toBe('number');
      expect(MAX_CONFIG_BLOB_BYTES).toBe(8 * 1024);
      expect(MAX_CONFIG_BLOB_BYTES).toBe(8192);
    });
  });

  describe('strict auth-state security read', () => {
    it('marks a stored none mode as broken (throws)', () => {
      expect(() => validateAuthStateStrict_({ authMode: 'none' })).toThrow();
    });

    it('marks an absent mode without a group as broken (throws)', () => {
      expect(() => validateAuthStateStrict_({})).toThrow();
    });

    it('marks an absent mode with a blank group as broken (throws)', () => {
      expect(() => validateAuthStateStrict_({ authGroupEmail: '   ' })).toThrow();
    });

    it('applies the leniency: absent mode with a non-blank group reads as googleGroups', () => {
      const result = validateAuthStateStrict_({
        authGroupEmail: 'teachers@school.edu',
      });

      expect(result).toEqual(expect.objectContaining({ authMode: 'googleGroups' }));
    });

    it('treats a blank mode as absent, so a non-blank group reads as googleGroups', () => {
      const result = validateAuthStateStrict_({
        authMode: '',
        authGroupEmail: 'teachers@school.edu',
      });

      expect(result).toEqual(expect.objectContaining({ authMode: 'googleGroups' }));
    });

    it('does not extend the leniency to a stored none mode with a non-blank group (throws)', () => {
      expect(() =>
        validateAuthStateStrict_({
          authMode: 'none',
          authGroupEmail: 'teachers@school.edu',
        })
      ).toThrow();
    });

    it('does not extend the leniency to an unrecognised mode with a non-blank group (throws)', () => {
      expect(() =>
        validateAuthStateStrict_({
          authMode: 'foo',
          authGroupEmail: 'teachers@school.edu',
        })
      ).toThrow();
    });

    it('accepts a googleGroups mode with a non-blank group', () => {
      const result = validateAuthStateStrict_({
        authMode: 'googleGroups',
        authGroupEmail: 'teachers@school.edu',
      });

      expect(result).toEqual(expect.objectContaining({ authMode: 'googleGroups' }));
    });

    it('marks a googleGroups mode with a blank group as broken (throws)', () => {
      expect(() =>
        validateAuthStateStrict_({
          authMode: 'googleGroups',
          authGroupEmail: '',
        })
      ).toThrow();
    });

    it('accepts a scriptProperties mode with a valid user list and revision', () => {
      const result = validateAuthStateStrict_({
        authMode: 'scriptProperties',
        authUsers: buildUsersJson([
          { email: 'admin@school.edu', role: 'admin' },
          { email: 'user@school.edu', role: 'user' },
        ]),
        authRevision: '1',
      });

      expect(result).toEqual(expect.objectContaining({ authMode: 'scriptProperties' }));
    });

    it('canonicalises the stored revision in the resolved scriptProperties state', () => {
      const result = validateAuthStateStrict_({
        authMode: 'scriptProperties',
        authUsers: buildUsersJson([{ email: 'admin@school.edu', role: 'admin' }]),
        authRevision: '007',
      });

      expect(result.authRevision).toBe('7');
    });

    it('marks a scriptProperties mode with zero admins as broken (throws)', () => {
      expect(() =>
        validateAuthStateStrict_({
          authMode: 'scriptProperties',
          authUsers: buildUsersJson([{ email: 'user@school.edu', role: 'user' }]),
          authRevision: '1',
        })
      ).toThrow();
    });

    it('marks a scriptProperties mode with an invalid revision as broken (throws)', () => {
      expect(() =>
        validateAuthStateStrict_({
          authMode: 'scriptProperties',
          authUsers: buildUsersJson([{ email: 'admin@school.edu', role: 'admin' }]),
          authRevision: '0',
        })
      ).toThrow();
    });

    it('marks a scriptProperties mode with malformed users as broken (throws)', () => {
      expect(() =>
        validateAuthStateStrict_({
          authMode: 'scriptProperties',
          authUsers: '{not-json',
          authRevision: '1',
        })
      ).toThrow();
    });
  });

  describe('auth-user key allowlist', () => {
    it('declares the fixed email/role allowlist as an immutable frozen constant', () => {
      const schemaSource = fs.readFileSync(
        require.resolve('../../src/backend/ConfigurationManager/01_configKeysAndSchema.js'),
        'utf8'
      );
      const declaration = schemaSource.match(/AUTH_USER_ALLOWED_KEYS\s*=\s*([^;]+);/u);

      expect(declaration).not.toBeNull();
      expect(declaration[1]).toContain('Object.freeze');
      expect(declaration[1]).toContain("'email'");
      expect(declaration[1]).toContain("'role'");
    });
  });
});
