import { describe, expect, it } from 'vitest';
import {
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
  jsonDbLockTimeoutMs: 30_000,
  jsonDbLogLevel: 'INFO',
  jsonDbBackupOnInitialise: true,
  jsonDbRootFolderId: 'folder-1234',
};

const validOrdinaryWritePatch = {
  backendAssessorBatchSize: 30,
  backendUrl: 'https://backend.example.com',
  daysUntilAuthRevoke: 60,
  slidesFetchBatchSize: 20,
  jsonDbMasterIndexKey: 'master-index',
  jsonDbLockTimeoutMs: 30_000,
  jsonDbLogLevel: 'INFO',
  jsonDbBackupOnInitialise: true,
  jsonDbRootFolderId: 'folder-1234',
};

describe('BackendConfigSchema', () => {
  it('accepts the canonical 12 non-auth field read response', () => {
    const result = BackendConfigSchema.safeParse(validBackendConfig);
    expect(result.success).toBe(true);
  });

  it('rejects a read response that includes authGroupEmail (strict lockstep)', () => {
    const result = BackendConfigSchema.safeParse({
      ...validBackendConfig,
      authGroupEmail: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a read response that includes authMode (strict lockstep)', () => {
    const result = BackendConfigSchema.safeParse({
      ...validBackendConfig,
      authMode: 'googleGroups',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a read response that reintroduces the stored auth fields', () => {
    const withAuthUsers = BackendConfigSchema.safeParse({
      ...validBackendConfig,
      authUsers: '[]',
    });
    const withAuthRevision = BackendConfigSchema.safeParse({
      ...validBackendConfig,
      authRevision: '1',
    });
    expect(withAuthUsers.success).toBe(false);
    expect(withAuthRevision.success).toBe(false);
  });
});

describe('BackendConfigWriteInputSchema', () => {
  it('accepts an ordinary write patch with no auth fields', () => {
    const result = BackendConfigWriteInputSchema.safeParse(validOrdinaryWritePatch);
    expect(result.success).toBe(true);
  });

  it('rejects a write patch that includes authGroupEmail (strict lockstep)', () => {
    const result = BackendConfigWriteInputSchema.safeParse({
      authGroupEmail: 'teachers@school.edu',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a write patch that includes authMode (strict lockstep)', () => {
    const result = BackendConfigWriteInputSchema.safeParse({ authMode: 'scriptProperties' });
    expect(result.success).toBe(false);
  });

  it('rejects a write patch that reintroduces the stored auth fields', () => {
    const withAuthUsers = BackendConfigWriteInputSchema.safeParse({
      authUsers: [{ email: 'teacher@school.edu', role: 'admin' }],
    });
    const withAuthRevision = BackendConfigWriteInputSchema.safeParse({ authRevision: '1' });
    expect(withAuthUsers.success).toBe(false);
    expect(withAuthRevision.success).toBe(false);
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

describe('BackendConfigSchema non-empty string fields', () => {
  it('rejects a blank jsonDbMasterIndexKey in the read response', () => {
    const result = BackendConfigSchema.safeParse({
      ...validBackendConfig,
      jsonDbMasterIndexKey: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a blank jsonDbLogLevel in the read response', () => {
    const result = BackendConfigSchema.safeParse({
      ...validBackendConfig,
      jsonDbLogLevel: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('BackendConfigWriteInputSchema non-empty string fields', () => {
  it('rejects a blank jsonDbMasterIndexKey in a write patch', () => {
    const result = BackendConfigWriteInputSchema.safeParse({ jsonDbMasterIndexKey: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a blank jsonDbLogLevel in a write patch', () => {
    const result = BackendConfigWriteInputSchema.safeParse({ jsonDbLogLevel: '' });
    expect(result.success).toBe(false);
  });
});
