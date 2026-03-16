import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ScriptAppManager from '../../src/AdminSheet/Utils/ScriptAppManager.js';
import ABLogger from '../../src/AdminSheet/Utils/ABLogger.js';

// Mock ScriptApp APIs
const mockGetAuthorizationInfo = vi.fn();
const mockGetScriptId = vi.fn();
const mockInvalidateAuth = vi.fn();

const authInfoMock = {
  getAuthorizationStatus: vi.fn(),
  getAuthorizationUrl: vi.fn(),
};

describe('ScriptAppManager', () => {
  let loggerSpy;

  beforeEach(() => {
    vi.clearAllMocks();

    globalThis.ScriptApp = {
      getAuthorizationInfo: mockGetAuthorizationInfo,
      getScriptId: mockGetScriptId,
      invalidateAuth: mockInvalidateAuth,
      AuthMode: {
        FULL: 'FULL',
      },
      AuthorizationStatus: {
        REQUIRED: 'REQUIRED',
        NOT_REQUIRED: 'NOT_REQUIRED',
      },
    };

    // Mock ABLogger.getInstance() and its methods
    const loggerInstance = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
    };
    loggerSpy = vi.spyOn(ABLogger, 'getInstance').mockReturnValue(loggerInstance);

    // Setup default mock behaviours
    authInfoMock.getAuthorizationStatus.mockReturnValue('NOT_REQUIRED');
    authInfoMock.getAuthorizationUrl.mockReturnValue('https://example.com/auth');

    mockGetAuthorizationInfo.mockReturnValue(authInfoMock);
    mockGetScriptId.mockReturnValue('test-script-id');
  });

  afterEach(() => {
    loggerSpy.mockRestore();
    delete globalThis.ScriptApp;
  });

  describe('constructor', () => {
    it('should initialize and log authorization status', () => {
      new ScriptAppManager();

      expect(mockGetAuthorizationInfo).toHaveBeenCalledWith('FULL');
      expect(authInfoMock.getAuthorizationStatus).toHaveBeenCalled();
      expect(ABLogger.getInstance().info).toHaveBeenCalledWith(
        expect.stringContaining('ScriptAppManager instantiated')
      );
    });
  });

  describe('getScriptId', () => {
    it('should retrieve and return script ID', () => {
      const manager = new ScriptAppManager();

      const result = manager.getScriptId();

      expect(mockGetScriptId).toHaveBeenCalled();
      expect(result).toBe('test-script-id');
    });
  });

  describe('checkAuthMode', () => {
    it('should return authorization status and log it', () => {
      const manager = new ScriptAppManager();

      const result = manager.checkAuthMode();

      expect(result).toBe('NOT_REQUIRED');
      expect(ABLogger.getInstance().info).toHaveBeenCalledWith(
        expect.stringContaining('ScriptAppManager.checkAuthMode() called')
      );
    });

    it('should return REQUIRED when authorization is required', () => {
      authInfoMock.getAuthorizationStatus.mockReturnValue('REQUIRED');
      const manager = new ScriptAppManager();

      const result = manager.checkAuthMode();

      expect(result).toBe('REQUIRED');
    });
  });

  describe('getAuthorisationUrl', () => {
    it('should return authorization URL', () => {
      const manager = new ScriptAppManager();

      const result = manager.getAuthorisationUrl();

      expect(result).toBe('https://example.com/auth');
      expect(authInfoMock.getAuthorizationUrl).toHaveBeenCalled();
    });
  });

  describe('handleAuthFlow', () => {
    it('should return needsAuth false when authorization is NOT_REQUIRED', () => {
      authInfoMock.getAuthorizationStatus.mockReturnValue('NOT_REQUIRED');
      const manager = new ScriptAppManager();

      const result = manager.handleAuthFlow();

      expect(result).toEqual({
        needsAuth: false,
        authUrl: null,
      });
    });

    it('should return needsAuth true with URL when authorization is REQUIRED', () => {
      authInfoMock.getAuthorizationStatus.mockReturnValue('REQUIRED');
      const manager = new ScriptAppManager();

      const result = manager.handleAuthFlow();

      expect(result).toEqual({
        needsAuth: true,
        authUrl: 'https://example.com/auth',
      });
    });
  });

  describe('isAuthorised', () => {
    it('should return true when authorization status is NOT_REQUIRED', () => {
      authInfoMock.getAuthorizationStatus.mockReturnValue('NOT_REQUIRED');
      const manager = new ScriptAppManager();

      const result = manager.isAuthorised();

      expect(result).toBe(true);
    });

    it('should return false when authorization status is REQUIRED', () => {
      authInfoMock.getAuthorizationStatus.mockReturnValue('REQUIRED');
      const manager = new ScriptAppManager();

      const result = manager.isAuthorised();

      expect(result).toBe(false);
    });
  });

  describe('revokeAuthorisation', () => {
    it('should successfully revoke authorization', () => {
      mockInvalidateAuth.mockImplementation(() => {});
      const manager = new ScriptAppManager();

      const result = manager.revokeAuthorisation();

      expect(mockInvalidateAuth).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: 'Authorization successfully revoked',
      });
    });

    it('should handle errors when revoking authorization', () => {
      mockInvalidateAuth.mockImplementation(() => {
        throw new Error('Revocation failed');
      });
      const manager = new ScriptAppManager();

      const result = manager.revokeAuthorisation();

      expect(result).toEqual({
        success: false,
        message: 'Failed to revoke authorization: Revocation failed',
      });
    });
  });
});
