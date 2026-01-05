/**
 * @file Tests for Utils.isValidUrl slide export handling.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const SLIDE_EXPORT_URL =
  'https://docs.google.com/presentation/d/10BRsRpIFj1_jIx3ZibYbLSrR_eBVMJcVmoV5UVD3BOY/export/png?id=10BRsRpIFj1_jIx3ZibYbLSrR_eBVMJcVmoV5UVD3BOY&pageid=g18a58a7aa3d_0_42';

describe('Utils.isValidUrl', () => {
  let realURL;
  const originalProgressTracker = globalThis.ProgressTracker;
  const originalABLogger = globalThis.ABLogger;
  let Utils;
  let progressTracker;
  let warnSpy;

  beforeEach(async () => {
    vi.resetModules();
    realURL = globalThis.URL;

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

    // Simulate environments where the URL constructor rejects Slides export URLs
    globalThis.URL = class FailingURL {
      constructor() {
        throw new TypeError('mock parse failure');
      }
    };

    // Import after globals are prepared so Utils picks up the mocks
    const utilsModule = await import('../../src/AdminSheet/Utils/Utils.js');
    Utils = utilsModule.default || utilsModule;
  });

  afterEach(() => {
    globalThis.URL = realURL;
    globalThis.ProgressTracker = originalProgressTracker;
    globalThis.ABLogger = originalABLogger;
    vi.restoreAllMocks();
  });

  it('accepts Google Slides export URLs even when URL parsing fails', () => {
    const result = Utils.isValidUrl(SLIDE_EXPORT_URL);

    expect(result).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(progressTracker.logError).not.toHaveBeenCalled();
  });
});
