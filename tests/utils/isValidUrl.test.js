/**
 * @file Tests for Utils.isValidUrl.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Validate } from '../../src/AdminSheet/Utils/Validate.js';

const SLIDE_EXPORT_URL =
  'https://docs.google.com/presentation/d/10BRsRpIFj1_jIx3ZibYbLSrR_eBVMJcVmoV5UVD3BOY/export/png?id=10BRsRpIFj1_jIx3ZibYbLSrR_eBVMJcVmoV5UVD3BOY&pageid=g18a58a7aa3d_0_42';

describe('Validate.isValidUrl', () => {
  const originalProgressTracker = globalThis.ProgressTracker;
  const originalABLogger = globalThis.ABLogger;
  let progressTracker;
  let warnSpy;

  beforeEach(async () => {
    vi.resetModules();

    progressTracker = {
      logError: vi.fn(),
      logAndThrowError: vi.fn(),
      captureError: vi.fn(),
      updateProgress: vi.fn(),
      complete: vi.fn(),
      startTracking: vi.fn(),
    };
    warnSpy = vi.fn();

    globalThis.ProgressTracker = { getInstance: () => progressTracker };
    globalThis.ABLogger = {
      getInstance: () => ({
        warn: warnSpy,
        debug: vi.fn(),
        debugUi: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        log: vi.fn(),
      }),
    };
  });

  afterEach(() => {
    globalThis.ProgressTracker = originalProgressTracker;
    globalThis.ABLogger = originalABLogger;
    vi.restoreAllMocks();
  });

  it('accepts Google Slides export URLs', () => {
    const result = Validate.isValidUrl(SLIDE_EXPORT_URL);

    expect(result).toBe(true);
    expect(progressTracker.logError).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('rejects non-https URLs', () => {
    expect(Validate.isValidUrl('http://example.com/a')).toBe(false);
    expect(Validate.isValidUrl('ftp://example.com/a')).toBe(false);
    expect(progressTracker.logError).toHaveBeenCalledTimes(2);
  });

  it('rejects URLs with ports', () => {
    expect(Validate.isValidUrl('https://example.com:443/a')).toBe(false);
    expect(progressTracker.logError).toHaveBeenCalledTimes(1);
  });

  it('rejects localhost', () => {
    expect(Validate.isValidUrl('https://localhost/a')).toBe(false);
    expect(progressTracker.logError).not.toHaveBeenCalled();
  });

  it('rejects IPv4 addresses', () => {
    expect(Validate.isValidUrl('https://8.8.8.8/a')).toBe(false);
    expect(Validate.isValidUrl('https://192.168.0.1/a')).toBe(false);
    expect(progressTracker.logError).not.toHaveBeenCalled();
  });

  it('rejects whitespace and empty strings', () => {
    expect(Validate.isValidUrl('')).toBe(false);
    expect(Validate.isValidUrl('   ')).toBe(false);
    expect(Validate.isValidUrl('https://example.com/a b')).toBe(false);
  });
});
