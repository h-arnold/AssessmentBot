import { describe, it, expect, beforeEach, vi } from 'vitest';

// Setup global mocks before imports
global.ABLogger = require('../../src/AdminSheet/Utils/ABLogger.js');

// Mock ScriptAppManager
const mockScriptAppManager = {
  isAuthorised: vi.fn(),
  checkAuthMode: vi.fn(),
};

global.ScriptAppManager = vi.fn(() => mockScriptAppManager);

// Mock ConfigurationManager
const mockConfigManager = {
  getIsAdminSheet: vi.fn(),
  getUpdateStage: vi.fn(),
  getRevokeAuthTriggerSet: vi.fn(),
  getDaysUntilAuthRevoke: vi.fn(),
  setRevokeAuthTriggerSet: vi.fn(),
};

global.ConfigurationManager = {
  getInstance: vi.fn(() => mockConfigManager),
};

// Mock UIManager
const mockUiManager = {
  createAuthorisedMenu: vi.fn(),
  createUnauthorisedMenu: vi.fn(),
  createAssessmentRecordMenu: vi.fn(),
};

global.UIManager = {
  getInstance: vi.fn(() => mockUiManager),
};

// Mock TriggerController
global.TriggerController = vi.fn(() => ({
  createTimeBasedTrigger: vi.fn(),
}));

// Mock UpdateManager
global.UpdateManager = vi.fn(() => ({
  runAssessmentRecordUpdateWizard: vi.fn(),
}));

// Mock BaseUpdateAndInit
global.BaseUpdateAndInit = vi.fn(() => ({
  getLatestAssessmentRecordTemplateId: vi.fn().mockReturnValue('template-id-123'),
}));

// Import InitController after mocks
const InitController = require('../../src/AdminSheet/y_controllers/InitController.js');

describe('InitController - Authorization Flow', () => {
  let initController;
  let loggerSpy;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton instance
    InitController._instance = null;

    // Mock ABLogger.getInstance() and its methods
    const loggerInstance = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
    };
    loggerSpy = vi.spyOn(ABLogger, 'getInstance').mockReturnValue(loggerInstance);

    // Default mock behaviors
    mockScriptAppManager.isAuthorised.mockReturnValue(true);
    mockConfigManager.getIsAdminSheet.mockReturnValue(true);
    mockConfigManager.getUpdateStage.mockReturnValue(2);
    mockConfigManager.getRevokeAuthTriggerSet.mockReturnValue(false);
    mockConfigManager.getDaysUntilAuthRevoke.mockReturnValue(60);

    initController = InitController.getInstance();
  });

  afterEach(() => {
    loggerSpy.mockRestore();
  });

  describe('onOpen', () => {
    it('should check authorization using ScriptAppManager', () => {
      initController.onOpen();

      expect(global.ScriptAppManager).toHaveBeenCalled();
      expect(mockScriptAppManager.isAuthorised).toHaveBeenCalled();
    });

    it('should create authorised menu when user is authorized and is admin sheet', () => {
      mockScriptAppManager.isAuthorised.mockReturnValue(true);
      mockConfigManager.getIsAdminSheet.mockReturnValue(true);

      initController.onOpen();

      expect(mockUiManager.createAuthorisedMenu).toHaveBeenCalled();
      expect(mockUiManager.createUnauthorisedMenu).not.toHaveBeenCalled();
    });

    it('should create assessment record menu when user is authorized and not admin sheet', () => {
      mockScriptAppManager.isAuthorised.mockReturnValue(true);
      mockConfigManager.getIsAdminSheet.mockReturnValue(false);

      initController.onOpen();

      expect(mockUiManager.createAssessmentRecordMenu).toHaveBeenCalled();
      expect(mockUiManager.createAuthorisedMenu).not.toHaveBeenCalled();
    });

    it('should create unauthorised menu when user is not authorized', () => {
      mockScriptAppManager.isAuthorised.mockReturnValue(false);

      initController.onOpen();

      expect(mockUiManager.createUnauthorisedMenu).toHaveBeenCalled();
      expect(mockUiManager.createAuthorisedMenu).not.toHaveBeenCalled();
    });

    it('should log authorization status', () => {
      mockScriptAppManager.isAuthorised.mockReturnValue(true);
      mockConfigManager.getIsAdminSheet.mockReturnValue(true);

      initController.onOpen();

      expect(ABLogger.getInstance().info).toHaveBeenCalledWith(
        expect.stringContaining('InitController.onOpen() - User authorized: true')
      );
    });
  });

  describe('handleScriptInit', () => {
    it('should check authorization using ScriptAppManager', () => {
      mockScriptAppManager.isAuthorised.mockReturnValue(true);
      mockConfigManager.getIsAdminSheet.mockReturnValue(true);

      // Mock adminScriptInit to prevent full execution
      vi.spyOn(initController, 'adminScriptInit').mockImplementation(() => {});

      initController.handleScriptInit();

      expect(global.ScriptAppManager).toHaveBeenCalled();
      expect(mockScriptAppManager.isAuthorised).toHaveBeenCalled();
    });

    it('should pass authorization status to adminScriptInit', () => {
      mockScriptAppManager.isAuthorised.mockReturnValue(true);
      mockConfigManager.getIsAdminSheet.mockReturnValue(true);

      const adminScriptInitSpy = vi
        .spyOn(initController, 'adminScriptInit')
        .mockImplementation(() => {});

      initController.handleScriptInit();

      expect(adminScriptInitSpy).toHaveBeenCalledWith(true);
    });

    it('should call assessmentRecordScriptInit when not admin sheet', () => {
      mockScriptAppManager.isAuthorised.mockReturnValue(true);
      mockConfigManager.getIsAdminSheet.mockReturnValue(false);

      const assessmentRecordSpy = vi
        .spyOn(initController, 'assessmentRecordScriptInit')
        .mockImplementation(() => {});

      initController.handleScriptInit();

      expect(assessmentRecordSpy).toHaveBeenCalled();
    });

    it('should not call doFirstRunInit when user is already authorized', () => {
      mockScriptAppManager.isAuthorised.mockReturnValue(true);

      const firstRunSpy = vi.spyOn(initController, 'doFirstRunInit').mockImplementation(() => {});
      vi.spyOn(initController, 'adminScriptInit').mockImplementation(() => {});

      initController.handleScriptInit();

      expect(firstRunSpy).not.toHaveBeenCalled();
    });
  });

  describe('adminScriptInit', () => {
    beforeEach(() => {
      vi.spyOn(initController, 'setupAuthRevokeTimer').mockImplementation(() => {});
    });

    it('should use provided authorization status without creating new ScriptAppManager', () => {
      mockConfigManager.getUpdateStage.mockReturnValue(2);

      // Clear previous ScriptAppManager calls
      global.ScriptAppManager.mockClear();

      initController.adminScriptInit(true);

      // Should not create a new ScriptAppManager when auth status is provided
      expect(global.ScriptAppManager).not.toHaveBeenCalled();
      expect(ABLogger.getInstance().info).toHaveBeenCalledWith(
        expect.stringContaining('Using provided authorization status: true')
      );
    });

    it('should check authorization when not provided', () => {
      mockConfigManager.getUpdateStage.mockReturnValue(2);
      mockScriptAppManager.isAuthorised.mockReturnValue(true);

      // Clear previous calls
      global.ScriptAppManager.mockClear();

      initController.adminScriptInit(undefined);

      // Should create a new ScriptAppManager when auth status not provided
      expect(global.ScriptAppManager).toHaveBeenCalled();
      expect(mockScriptAppManager.isAuthorised).toHaveBeenCalled();
      expect(ABLogger.getInstance().info).toHaveBeenCalledWith(
        expect.stringContaining('Authorization not provided, checking now')
      );
    });

    it('should create authorised menu when update stage is 2 and user is authorized', () => {
      mockConfigManager.getUpdateStage.mockReturnValue(2);

      initController.adminScriptInit(true);

      expect(mockUiManager.createAuthorisedMenu).toHaveBeenCalled();
    });

    it('should call setupAuthRevokeTimer', () => {
      mockConfigManager.getUpdateStage.mockReturnValue(2);
      const setupTimerSpy = vi
        .spyOn(initController, 'setupAuthRevokeTimer')
        .mockImplementation(() => {});

      initController.adminScriptInit(true);

      expect(setupTimerSpy).toHaveBeenCalled();
    });
  });

  describe('Authorization check optimization', () => {
    it('should minimize ScriptAppManager instantiations when calling handleScriptInit', () => {
      mockScriptAppManager.isAuthorised.mockReturnValue(true);
      mockConfigManager.getIsAdminSheet.mockReturnValue(true);
      mockConfigManager.getUpdateStage.mockReturnValue(2);

      vi.spyOn(initController, 'setupAuthRevokeTimer').mockImplementation(() => {});

      // Clear any previous calls
      global.ScriptAppManager.mockClear();

      initController.handleScriptInit();

      // Should only create ScriptAppManager once in handleScriptInit
      // adminScriptInit should reuse the passed authorization status
      expect(global.ScriptAppManager).toHaveBeenCalledTimes(1);
    });
  });
});
