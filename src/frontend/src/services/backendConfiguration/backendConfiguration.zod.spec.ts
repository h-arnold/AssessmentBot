import { describe, expect, it } from 'vitest';
import { BackendApiKeyWriteSchema } from './backendConfiguration.zod';

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
