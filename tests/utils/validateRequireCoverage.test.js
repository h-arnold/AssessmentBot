import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { withGlobalMocks } from '../helpers/globalMockManager.js';

// Require-loader behaviour coverage for Validate edges. This suite mirrors the
// ESM import coverage through the CommonJS loader used by setupGlobals and
// production globals so the reported copy reflects the exercised branches.
// Vitest functions use ESM imports; `require` is retained only for the
// CommonJS loader-path assertion below.
const { Validate } = require('../../src/backend/Utils/Validate.js');

// Require-loader behaviour coverage for Validate edges. This suite mirrors the
// ESM import coverage through the CommonJS loader used by setupGlobals and
// production globals so the reported copy reflects the exercised branches.
describe('Validate require-loader edge behaviour', () => {
  let restoreGlobals;
  let mockLogger;
  let mockTracker;

  beforeEach(() => {
    mockLogger = { warn: vi.fn() };
    mockTracker = { logError: vi.fn() };
    const mockContext = withGlobalMocks({
      ABLogger: () => ({ getInstance: () => mockLogger }),
      ProgressTracker: () => ({ getInstance: () => mockTracker }),
    });
    restoreGlobals = mockContext.restore;
  });

  afterEach(() => {
    restoreGlobals();
    vi.restoreAllMocks();
  });

  it('rejects non string emails and logs invalid ones', () => {
    expect(Validate.isEmail(null)).toBe(false);
    expect(Validate.isEmail(42)).toBe(false);
    expect(Validate.isEmail('not-an-email')).toBe(false);
    expect(mockTracker.logError).toHaveBeenCalledWith('Invalid teacher email: not-an-email');
  });

  it('falls back to developer logging when the tracker fails', () => {
    mockTracker.logError.mockImplementation(() => {
      throw new Error('tracker down');
    });
    expect(Validate.isEmail('bad-email')).toBe(false);
    expect(mockLogger.warn).toHaveBeenCalledWith('Invalid teacher email', expect.any(Error));
    expect(Validate.isGoogleUserId('!!!')).toBe(false);
    expect(mockLogger.warn).toHaveBeenCalledWith('Invalid Google userId', expect.any(Error));
    expect(Validate.isValidUrl('http://example.com')).toBe(false);
    expect(mockLogger.warn).toHaveBeenCalledWith('Invalid URL', expect.any(Error));
  });

  it('validates google user ids', () => {
    expect(Validate.isGoogleUserId(null)).toBe(false);
    expect(Validate.isGoogleUserId('123')).toBe(false);
    expect(Validate.isGoogleUserId('123456')).toBe(true);
    expect(mockTracker.logError).toHaveBeenCalledWith('Invalid Google userId: 123');
  });

  it('rejects malformed urls and bad hostnames', () => {
    expect(Validate.isValidUrl(null)).toBe(false);
    expect(Validate.isValidUrl('   ')).toBe(false);
    expect(Validate.isValidUrl('https://example.com/has space')).toBe(false);
    expect(Validate.isValidUrl('http://example.com')).toBe(false);
    expect(Validate.isValidUrl('https://localhost/x')).toBe(false);
    expect(Validate.isValidUrl('https://192.168.0.1/x')).toBe(false);
    expect(Validate.isValidUrl('https://example/x')).toBe(false);
    expect(Validate.isValidUrl('https://-bad.example.com/')).toBe(false);
    expect(Validate.isValidUrl('https://bad-.example.com/')).toBe(false);
    expect(Validate.isValidUrl('https://bad_host.example.com/')).toBe(false);
    expect(Validate.isValidUrl('https://example..com/')).toBe(false);
    expect(Validate.isValidUrl('https://example.com/ok')).toBe(true);
  });

  it('checks ipv4 hostnames', () => {
    expect(Validate._isIPv4('example.com')).toBe(false);
    expect(Validate._isIPv4('1.2.3.4')).toBe(true);
    expect(Validate._isIPv4('999.1.1.1')).toBe(false);
  });

  it('requires object params and validates helpers', () => {
    expect(() => Validate.requireParams(null)).toThrow('params must be an object');
    expect(() => Validate.requireParams([1])).toThrow('params must be an object');
    expect(Validate.validateTrimmedNonEmptyString('Label', '  value  ')).toBe('value');
    expect(() => Validate.validateTrimmedNonEmptyString('Label', '  ')).toThrow(TypeError);
    const target = { key: 'value' };
    expect(Validate.validatePlainObject('Label', target)).toBe(target);
    expect(() => Validate.validatePlainObject('Label', [])).toThrow(TypeError);
    expect(Validate._coerceBooleanString('true')).toBe(true);
    expect(Validate._coerceBooleanString('false')).toBe(false);
    expect(Validate._coerceBooleanString('other')).toBeUndefined();
  });
});
