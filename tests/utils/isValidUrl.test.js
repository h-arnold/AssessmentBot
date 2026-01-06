/**
 * @file Tests for Utils.isValidUrl.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const SLIDE_EXPORT_URL =
  'https://docs.google.com/presentation/d/10BRsRpIFj1_jIx3ZibYbLSrR_eBVMJcVmoV5UVD3BOY/export/png?id=10BRsRpIFj1_jIx3ZibYbLSrR_eBVMJcVmoV5UVD3BOY&pageid=g18a58a7aa3d_0_42';

describe('Utils.isValidUrl', () => {
  const originalProgressTracker = globalThis.ProgressTracker;
  const originalABLogger = globalThis.ABLogger;
  let Utils;
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

    // Import after globals are prepared so Utils picks up the mocks
    const utilsModule = await import('../../src/AdminSheet/Utils/Utils.js');
    Utils = utilsModule.default || utilsModule;
  });

  afterEach(() => {
    globalThis.ProgressTracker = originalProgressTracker;
    globalThis.ABLogger = originalABLogger;
    vi.restoreAllMocks();
  });

  it('accepts Google Slides export URLs', () => {
    const result = Utils.isValidUrl(SLIDE_EXPORT_URL);

    expect(result).toBe(true);
    expect(progressTracker.logError).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('rejects non-https URLs', () => {
    expect(Utils.isValidUrl('http://example.com/a')).toBe(false);
    expect(Utils.isValidUrl('ftp://example.com/a')).toBe(false);
    expect(progressTracker.logError).toHaveBeenCalledTimes(2);
  });

  it('rejects URLs with ports', () => {
    expect(Utils.isValidUrl('https://example.com:443/a')).toBe(false);
    expect(progressTracker.logError).toHaveBeenCalledTimes(1);
  });

  it('rejects localhost', () => {
    expect(Utils.isValidUrl('https://localhost/a')).toBe(false);
    expect(progressTracker.logError).not.toHaveBeenCalled();
  });

  it('rejects IPv4 addresses', () => {
    expect(Utils.isValidUrl('https://8.8.8.8/a')).toBe(false);
    expect(Utils.isValidUrl('https://192.168.0.1/a')).toBe(false);
    expect(progressTracker.logError).not.toHaveBeenCalled();
  });

  it('rejects whitespace and empty strings', () => {
    expect(Utils.isValidUrl('')).toBe(false);
    expect(Utils.isValidUrl('   ')).toBe(false);
    expect(Utils.isValidUrl('https://example.com/a b')).toBe(false);
  });
});
