import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Validate } from '../../src/backend/Utils/Validate.js';
import { withGlobalMocks } from '../helpers/globalMockManager.js';

// Hermetic behaviour coverage for Validate edge branches: type guards,
// URL/hostname rules, IPv4 checks and object/boolean coercion helpers.
describe('Validate edge behaviour', () => {
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

  it('rejects non string emails without logging', () => {
    expect(Validate.isEmail(null)).toBe(false);
    expect(Validate.isEmail(123)).toBe(false);
    expect(mockTracker.logError).not.toHaveBeenCalled();
  });

  it('logs invalid teacher emails through the tracker fallback', () => {
    expect(Validate.isEmail('not-an-email')).toBe(false);
    expect(mockTracker.logError).toHaveBeenCalledWith('Invalid teacher email: not-an-email');
  });

  it('falls back to the developer log when the tracker is unavailable', () => {
    mockTracker.logError.mockImplementation(() => {
      throw new Error('tracker down');
    });
    expect(Validate.isEmail('also-bad')).toBe(false);
    expect(mockLogger.warn).toHaveBeenCalledWith('Invalid teacher email', expect.any(Error));
  });

  it('rejects non string user ids and logs invalid ids', () => {
    expect(Validate.isGoogleUserId(null)).toBe(false);
    expect(Validate.isGoogleUserId({})).toBe(false);
    expect(Validate.isGoogleUserId('123')).toBe(false);
    expect(mockTracker.logError).toHaveBeenCalledWith('Invalid Google userId: 123');
  });

  it('falls back to the developer log for invalid user ids', () => {
    mockTracker.logError.mockImplementation(() => {
      throw new Error('tracker down');
    });
    expect(Validate.isGoogleUserId('!!!')).toBe(false);
    expect(mockLogger.warn).toHaveBeenCalledWith('Invalid Google userId', expect.any(Error));
  });

  it('rejects malformed urls before hostname checks', () => {
    expect(Validate.isValidUrl(null)).toBe(false);
    expect(Validate.isValidUrl(123)).toBe(false);
    expect(Validate.isValidUrl('   ')).toBe(false);
    expect(Validate.isValidUrl('https://example.com/has space')).toBe(false);
    expect(Validate.isValidUrl('http://example.com')).toBe(false);
    expect(mockTracker.logError).toHaveBeenCalled();
  });

  it('falls back to the developer log for malformed urls', () => {
    mockTracker.logError.mockImplementation(() => {
      throw new Error('tracker down');
    });
    expect(Validate.isValidUrl('http://example.com')).toBe(false);
    expect(mockLogger.warn).toHaveBeenCalledWith('Invalid URL', expect.any(Error));
  });

  it('rejects localhost, ip addresses and bad hostnames', () => {
    expect(Validate.isValidUrl('https://localhost/path')).toBe(false);
    expect(Validate.isValidUrl('https://192.168.1.1/path')).toBe(false);
    expect(Validate.isValidUrl('https://example/path')).toBe(false);
    expect(Validate.isValidUrl('https://-bad.example.com/')).toBe(false);
    expect(Validate.isValidUrl('https://bad-.example.com/')).toBe(false);
    expect(Validate.isValidUrl('https://bad_host.example.com/')).toBe(false);
    expect(Validate.isValidUrl('https://example..com/')).toBe(false);
    expect(Validate.isValidUrl(`https://${'a'.repeat(64)}.example.com/`)).toBe(false);
    expect(Validate.isValidUrl(`https://${'a'.repeat(254)}.com/`)).toBe(false);
    expect(Validate.isValidUrl('https://example.com/valid-path')).toBe(true);
  });

  it('detects ipv4 hostnames with octet validation', () => {
    expect(Validate._isIPv4('example.com')).toBe(false);
    expect(Validate._isIPv4('1.2.3.4')).toBe(true);
    expect(Validate._isIPv4('999.1.1.1')).toBe(false);
    expect(Validate._isIPv4('1.2.3')).toBe(false);
  });

  it('rejects non object params for requireParams', () => {
    expect(() => Validate.requireParams(null)).toThrow('params must be an object');
    expect(() => Validate.requireParams([1])).toThrow('params must be an object');
  });

  it('validates trimmed strings and plain objects', () => {
    expect(Validate.validateTrimmedNonEmptyString('Label', '  value  ')).toBe('value');
    expect(() => Validate.validateTrimmedNonEmptyString('Label', '   ')).toThrow(TypeError);
    const target = { key: 'value' };
    expect(Validate.validatePlainObject('Label', target)).toBe(target);
    expect(() => Validate.validatePlainObject('Label', [])).toThrow(TypeError);
    expect(() => Validate.validatePlainObject('Label', null)).toThrow(TypeError);
  });

  it('coerces boolean strings explicitly', () => {
    expect(Validate._coerceBooleanString('true')).toBe(true);
    expect(Validate._coerceBooleanString('false')).toBe(false);
    expect(Validate._coerceBooleanString('yes')).toBeUndefined();
    expect(Validate._coerceBooleanString(undefined)).toBeUndefined();
  });
});
