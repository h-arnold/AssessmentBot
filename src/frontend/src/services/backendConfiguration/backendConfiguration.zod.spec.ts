import { describe, expect, it } from 'vitest';
import {
  authGroupEmailSchema,
  authModeSchema,
  BackendApiKeyWriteSchema,
  BackendConfigSchema,
  BackendConfigWriteInputSchema,
} from './backendConfiguration.zod';

const validBackendConfig = {
  backendAssessorBatchSize: 30,
  apiKey: '****cdef',
  hasApiKey: true,
  backendUrl: 'https://backend.example.com',
  revokeAuthTriggerSet: false,
  daysUntilAuthRevoke: 60,
  slidesFetchBatchSize: 20,
  jsonDbMasterIndexKey: 'master-index',
  jsonDbLockTimeoutMs: 15_000,
  jsonDbLogLevel: 'INFO',
  jsonDbBackupOnInitialise: true,
  jsonDbRootFolderId: 'folder-1234',
};

describe('BackendConfigSchema', () => {
  it('accepts a blank authGroupEmail when the group is unset', () => {
    const result = BackendConfigSchema.safeParse({ ...validBackendConfig, authGroupEmail: '' });
    expect(result.success).toBe(true);
  });

  it('accepts a configured authGroupEmail', () => {
    const result = BackendConfigSchema.safeParse({
      ...validBackendConfig,
      authGroupEmail: 'teachers@school.edu',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email when authGroupEmail is non-empty', () => {
    const result = BackendConfigSchema.safeParse({
      ...validBackendConfig,
      authGroupEmail: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('accepts an absent authGroupEmail because the field is optional', () => {
    const result = BackendConfigSchema.safeParse(validBackendConfig);
    expect(result.success).toBe(true);
  });

  it('accepts a response that includes authMode', () => {
    const result = BackendConfigSchema.safeParse({
      ...validBackendConfig,
      authMode: 'googleGroups',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a response that omits authMode because the field is optional', () => {
    const result = BackendConfigSchema.safeParse(validBackendConfig);
    expect(result.success).toBe(true);
  });
});

describe('BackendConfigWriteInputSchema', () => {
  it('accepts a blank authGroupEmail in a write patch', () => {
    const result = BackendConfigWriteInputSchema.safeParse({ authGroupEmail: '' });
    expect(result.success).toBe(true);
  });

  it('accepts a configured authGroupEmail in a write patch', () => {
    const result = BackendConfigWriteInputSchema.safeParse({
      authGroupEmail: 'teachers@school.edu',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email in a write patch when non-empty', () => {
    const result = BackendConfigWriteInputSchema.safeParse({ authGroupEmail: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('accepts a write patch without authGroupEmail because the field is optional', () => {
    const result = BackendConfigWriteInputSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts authMode in a write patch', () => {
    const result = BackendConfigWriteInputSchema.safeParse({ authMode: 'none' });
    expect(result.success).toBe(true);
  });

  it('accepts a write patch without authMode because the field is optional', () => {
    const result = BackendConfigWriteInputSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('BackendApiKeyWriteSchema', () => {
  it('accepts a key surrounded by whitespace', () => {
    const result = BackendApiKeyWriteSchema.safeParse('  abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-1  ');
    expect(result.success).toBe(true);
  });

  it('rejects a key with invalid token after trimming', () => {
    const result = BackendApiKeyWriteSchema.safeParse('  badkey  ');
    expect(result.success).toBe(false);
  });

  it('rejects a key that is only whitespace', () => {
    const result = BackendApiKeyWriteSchema.safeParse('     ');
    expect(result.success).toBe(false);
  });
});

describe('authGroupEmailSchema', () => {
  it('accepts a blank auth group email', () => {
    const result = authGroupEmailSchema.safeParse('');
    expect(result.success).toBe(true);
  });

  it('accepts a valid auth group email', () => {
    const result = authGroupEmailSchema.safeParse('user@example.com');
    expect(result.success).toBe(true);
  });

  it('rejects an invalid auth group email', () => {
    const result = authGroupEmailSchema.safeParse('not-an-email');
    expect(result.success).toBe(false);
  });
});

describe('authModeSchema', () => {
  it('accepts the secure default googleGroups', () => {
    const result = authModeSchema.safeParse('googleGroups');
    expect(result.success).toBe(true);
  });

  it('accepts the none development bypass value', () => {
    const result = authModeSchema.safeParse('none');
    expect(result.success).toBe(true);
  });

  it('rejects an unknown value', () => {
    const result = authModeSchema.safeParse('foo');
    expect(result.success).toBe(false);
  });

  it('rejects a blank value', () => {
    const result = authModeSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('rejects null', () => {
    const result = authModeSchema.safeParse(null);
    expect(result.success).toBe(false);
  });
});
