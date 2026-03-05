import { describe, expect, it } from 'vitest';

import { parseCliOptions } from './cli-options.js';

describe('parseCliOptions', () => {
  it('defaults to production mode when no flag is supplied', () => {
    expect(parseCliOptions([])).toEqual({ frontendMode: 'production' });
  });

  it('accepts --frontend-mode=dev syntax', () => {
    expect(parseCliOptions(['--frontend-mode=dev'])).toEqual({ frontendMode: 'dev' });
  });

  it('accepts --frontend-mode=production syntax', () => {
    expect(parseCliOptions(['--frontend-mode=production'])).toEqual({ frontendMode: 'production' });
  });

  it('accepts --frontend-mode dev syntax', () => {
    expect(parseCliOptions(['--frontend-mode', 'dev'])).toEqual({ frontendMode: 'dev' });
  });

  it('rejects invalid mode values', () => {
    expect(() => parseCliOptions(['--frontend-mode=staging'])).toThrow(
      "Invalid --frontend-mode value. Expected 'production' or 'dev'."
    );
  });
});
