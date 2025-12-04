import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

describe('ConfigurationDialog.html', () => {
  let dom;
  let window;
  let document;

  // Mocks
  let mockGoogleScriptRun;
  let mockGoogleScriptHost;
  let mockMaterialize;
  let getConfiguration, getClassrooms, saveConfiguration;

  const htmlPath = path.resolve(__dirname, '../../src/AdminSheet/UI/ConfigurationDialog.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Helper to simulate a server call and capture handlers
  const mockServerCall = () => {
    const call = {};
    call.successHandler = vi.fn();
    call.failureHandler = vi.fn();
    call.withSuccessHandler = vi.fn(function (handler) {
      call.successHandler = handler;
      return this;
    });
    call.withFailureHandler = vi.fn(function (handler) {
      call.failureHandler = handler;
      return this;
    });
    return call;
  };

  beforeEach(() => {
    // --- Mock setup ---
    getConfiguration = mockServerCall();
    getClassrooms = mockServerCall();
    saveConfiguration = mockServerCall();

    mockGoogleScriptRun = {};
    // This mock simulates the chained API of google.script.run
    // It stores the handlers and associates them with the final function call.
    Object.assign(mockGoogleScriptRun, {
      lastSuccessHandler: null,
      lastFailureHandler: null,
      withSuccessHandler: vi.fn(function (handler) {
        this.lastSuccessHandler = handler;
        return this;
      }),
      withFailureHandler: vi.fn(function (handler) {
        this.lastFailureHandler = handler;
        return this;
      }),
      getConfiguration: vi.fn(function () {
        getConfiguration.successHandler = this.lastSuccessHandler;
        getConfiguration.failureHandler = this.lastFailureHandler;
        this.lastSuccessHandler = null;
        this.lastFailureHandler = null;
      }),
      getClassrooms: vi.fn(function () {
        getClassrooms.successHandler = this.lastSuccessHandler;
        getClassrooms.failureHandler = this.lastFailureHandler;
        this.lastSuccessHandler = null;
        this.lastFailureHandler = null;
      }),
      saveConfiguration: vi.fn(function (payload) {
        saveConfiguration.successHandler = this.lastSuccessHandler;
        saveConfiguration.failureHandler = this.lastFailureHandler;
        saveConfiguration.payload = payload;
        this.lastSuccessHandler = null;
        this.lastFailureHandler = null;
      }),
    });

    mockGoogleScriptHost = {
      close: vi.fn(),
    };

    mockMaterialize = {
      Tabs: {
        init: vi.fn(),
        getInstance: vi.fn().mockReturnValue({
          select: vi.fn(),
        }),
      },
      FormSelect: {
        init: vi.fn(),
      },
      updateTextFields: vi.fn(),
      toast: vi.fn(),
    };

    dom = new JSDOM(html, {
      runScripts: 'dangerously',
      url: 'https://localhost/',
      beforeParse(win) {
        // Inject mocks BEFORE the script in the HTML runs
        win.google = {
          script: {
            run: mockGoogleScriptRun,
            host: mockGoogleScriptHost,
          },
        };
        win.M = mockMaterialize;
      },
    });

    window = dom.window;
    document = window.document;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialisation', () => {
    it('should initialise Materialize components on DOMContentLoaded', () => {
      expect(mockMaterialize.Tabs.init).toHaveBeenCalledOnce();
      expect(mockMaterialize.FormSelect.init).toHaveBeenCalledOnce();
      expect(mockMaterialize.updateTextFields).toHaveBeenCalledOnce();
    });

    it('should try to fetch configuration and classrooms on load', () => {
      expect(mockGoogleScriptRun.getConfiguration).toHaveBeenCalledOnce();
      expect(mockGoogleScriptRun.getClassrooms).toHaveBeenCalledOnce();
    });

    it('should show a toast on configuration load failure', () => {
      const error = new Error('Config Load Failed');
      getConfiguration.failureHandler(error);
      expect(mockMaterialize.toast).toHaveBeenCalledWith({
        html: `Error loading configuration: ${error.message}`,
        classes: 'red',
      });
    });

    it('should show a toast on classroom load failure', () => {
      const error = new Error('Classroom Load Failed');
      getClassrooms.failureHandler(error);
      expect(mockMaterialize.toast).toHaveBeenCalledWith({
        html: `Error loading classrooms: ${error.message}`,
        classes: 'red',
      });
    });
  });

  describe('Form Population', () => {
    const mockConfig = {
      apiKey: '********',
      hasApiKey: true,
      backendUrl: 'https://example.com/api',
      backendAssessorBatchSize: 50,
      slidesFetchBatchSize: 10,
      updateDetailsUrl: 'https://example.com/updates',
      assessmentRecordTemplateId: 'template-id',
      assessmentRecordDestinationFolder: 'folder-id',
      daysUntilAuthRevoke: 30,
      jsonDbMasterIndexKey: 'master-key',
      jsonDbRootFolderId: 'root-folder-id',
      jsonDbLockTimeoutMs: 20000,
      jsonDbLogLevel: 'WARN',
      jsonDbBackupOnInitialise: false,
    };

    it('should populate form fields with existing configuration', () => {
      getConfiguration.successHandler(mockConfig);

      expect(document.getElementById('apiKey').placeholder).toBe(mockConfig.apiKey);
      expect(document.getElementById('apiKey').value).toBe('');
      expect(window._apiKeyWasRedacted).toBe(true);
      expect(document.getElementById('backendUrl').value).toBe(mockConfig.backendUrl);
      expect(document.getElementById('backendAssessorBatchSize').value).toBe(
        mockConfig.backendAssessorBatchSize.toString()
      );
      expect(document.getElementById('slidesFetchBatchSize').value).toBe(
        mockConfig.slidesFetchBatchSize.toString()
      );
      expect(document.getElementById('updateDetailsUrl').value).toBe(mockConfig.updateDetailsUrl);
      expect(document.getElementById('assessmentRecordTemplateId').value).toBe(
        mockConfig.assessmentRecordTemplateId
      );
      expect(document.getElementById('assessmentRecordDestinationFolder').value).toBe(
        mockConfig.assessmentRecordDestinationFolder
      );
      expect(document.getElementById('daysUntilAuthRevoke').value).toBe(
        mockConfig.daysUntilAuthRevoke.toString()
      );
      expect(document.getElementById('jsonDbMasterIndexKey').value).toBe(
        mockConfig.jsonDbMasterIndexKey
      );
      expect(document.getElementById('jsonDbRootFolderId').value).toBe(
        mockConfig.jsonDbRootFolderId
      );
      expect(document.getElementById('jsonDbLockTimeoutMs').value).toBe(
        mockConfig.jsonDbLockTimeoutMs.toString()
      );
      expect(document.getElementById('jsonDbLogLevel').value).toBe(mockConfig.jsonDbLogLevel);
      expect(document.getElementById('jsonDbBackupOnInitialise').checked).toBe(
        mockConfig.jsonDbBackupOnInitialise
      );
      expect(mockMaterialize.updateTextFields).toHaveBeenCalledTimes(2); // Once on init, once on populate
    });

    it('should handle apiKey when none is saved', () => {
      const configWithoutKey = { ...mockConfig, apiKey: '', hasApiKey: false };
      getConfiguration.successHandler(configWithoutKey);

      expect(document.getElementById('apiKey').placeholder).toBe('');
      expect(document.getElementById('apiKey').value).toBe('');
      expect(window._apiKeyWasRedacted).toBe(false);
    });

    it('should show a toast if configuration contains load errors', () => {
      getConfiguration.successHandler({ loadError: 'Could not parse JSON' });
      expect(mockMaterialize.toast).toHaveBeenCalledWith({
        html: 'Some configuration values failed to load: Could not parse JSON',
        classes: 'orange',
        displayLength: 8000,
      });
    });

    it('should populate the classroom dropdown', () => {
      const mockClassrooms = [
        { id: 'c1', name: 'Test Class 1' },
        { id: 'c2', name: 'Test Class 2' },
      ];
      getClassrooms.successHandler(mockClassrooms);

      const options = document.querySelectorAll('#classrooms option');
      expect(options).toHaveLength(3); // Including "Choose" option
      expect(options[1].value).toBe('c1');
      expect(options[1].textContent).toBe('Test Class 1');
      expect(options[2].value).toBe('c2');
      expect(options[2].textContent).toBe('Test Class 2');
      // Called once on init, once on populate
      expect(mockMaterialize.FormSelect.init).toHaveBeenCalledTimes(2);
    });
  });

  describe('Form Validation and Submission', () => {
    // Helper to fill the form with valid data
    const fillFormWithValidData = () => {
      document.getElementById('apiKey').value = 'new-api-key';
      document.getElementById('backendUrl').value = 'https://valid.url/api';
      document.getElementById('jsonDbMasterIndexKey').value = 'valid-master-key';
      document.getElementById('jsonDbLogLevel').value = 'INFO';
      document.getElementById('jsonDbLockTimeoutMs').value = '5000';
      document.getElementById('slidesFetchBatchSize').value = '10';
      document.getElementById('backendAssessorBatchSize').value = '20';
      document.getElementById('daysUntilAuthRevoke').value = '90';
    };

    it('should require API key if none is pre-existing', () => {
      getConfiguration.successHandler({ hasApiKey: false }); // Set initial state
      fillFormWithValidData();
      document.getElementById('apiKey').value = ''; // Clear the required field for this test

      document
        .getElementById('config-form')
        .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

      expect(mockMaterialize.toast).toHaveBeenCalledWith({
        html: 'API Key is required.',
        classes: 'orange',
      });
      expect(mockMaterialize.Tabs.getInstance().select).toHaveBeenCalledWith('backendTab');
      expect(mockGoogleScriptRun.saveConfiguration).not.toHaveBeenCalled();
    });

    it('should NOT require API key if one is pre-existing', () => {
      getConfiguration.successHandler({ hasApiKey: true }); // Set initial state
      fillFormWithValidData();
      document.getElementById('apiKey').value = ''; // User leaves field blank

      document
        .getElementById('config-form')
        .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

      expect(mockMaterialize.toast).not.toHaveBeenCalledWith(
        expect.objectContaining({ html: 'API Key is required.' })
      );
      expect(mockGoogleScriptRun.saveConfiguration).toHaveBeenCalled();
    });

    it('should require a valid backend URL', () => {
      getConfiguration.successHandler({ hasApiKey: false });
      fillFormWithValidData();
      document.getElementById('backendUrl').value = 'invalid-url';
      document
        .getElementById('config-form')
        .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

      expect(mockMaterialize.toast).toHaveBeenCalledWith({
        html: 'Please provide a valid Backend URL.',
        classes: 'orange',
      });
      expect(mockMaterialize.Tabs.getInstance().select).toHaveBeenCalledWith('backendTab');
      expect(mockGoogleScriptRun.saveConfiguration).not.toHaveBeenCalled();
    });

    it('should require a Master Index Key', () => {
      getConfiguration.successHandler({ hasApiKey: false });
      fillFormWithValidData();
      document.getElementById('jsonDbMasterIndexKey').value = '';
      document
        .getElementById('config-form')
        .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

      expect(mockMaterialize.toast).toHaveBeenCalledWith({
        html: 'Master Index Key is required.',
        classes: 'orange',
      });
      expect(mockMaterialize.Tabs.getInstance().select).toHaveBeenCalledWith('databaseTab');
      expect(mockGoogleScriptRun.saveConfiguration).not.toHaveBeenCalled();
    });

    it('should require a valid Log Level', () => {
      getConfiguration.successHandler({ hasApiKey: false });
      fillFormWithValidData();
      document.getElementById('jsonDbLogLevel').value = ''; // Invalid selection
      document
        .getElementById('config-form')
        .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

      expect(mockMaterialize.toast).toHaveBeenCalledWith({
        html: 'Please select a valid log level.',
        classes: 'orange',
      });
      expect(mockMaterialize.Tabs.getInstance().select).toHaveBeenCalledWith('databaseTab');
      expect(mockGoogleScriptRun.saveConfiguration).not.toHaveBeenCalled();
    });

    it('should validate Lock Timeout range', () => {
      getConfiguration.successHandler({ hasApiKey: false });
      fillFormWithValidData();
      document.getElementById('jsonDbLockTimeoutMs').value = '999'; // Too low
      document
        .getElementById('config-form')
        .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

      expect(mockMaterialize.toast).toHaveBeenCalledWith({
        html: 'Lock Timeout (ms) must be an integer between 1000 and 600000.',
        classes: 'orange',
      });
      expect(mockGoogleScriptRun.saveConfiguration).not.toHaveBeenCalled();
    });

    it('should validate Slides Fetch Batch Size range', () => {
      getConfiguration.successHandler({ hasApiKey: false });
      fillFormWithValidData();
      document.getElementById('slidesFetchBatchSize').value = '101'; // Too high
      document
        .getElementById('config-form')
        .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

      expect(mockMaterialize.toast).toHaveBeenCalledWith({
        html: 'Slides Fetch Batch Size must be an integer between 1 and 100.',
        classes: 'orange',
      });
      expect(mockGoogleScriptRun.saveConfiguration).not.toHaveBeenCalled();
    });

    it('should validate a valid Google Drive ID for Root Folder ID if provided', () => {
      getConfiguration.successHandler({ hasApiKey: false });
      fillFormWithValidData();
      document.getElementById('jsonDbRootFolderId').value = 'invalid!';
      document
        .getElementById('config-form')
        .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

      expect(mockMaterialize.toast).toHaveBeenCalledWith({
        html: 'Root Folder ID must be a valid Google Drive identifier.',
        classes: 'orange',
      });
      expect(mockGoogleScriptRun.saveConfiguration).not.toHaveBeenCalled();
    });

    it('should submit correct data on successful validation', () => {
      getConfiguration.successHandler({ hasApiKey: false });
      fillFormWithValidData();
      getClassrooms.successHandler([{ id: 'c1', name: 'Test Class 1' }]);
      const classroomSelect = document.getElementById('classrooms');
      classroomSelect.value = 'c1';

      document
        .getElementById('config-form')
        .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

      expect(document.getElementById('loadingOverlay').style.display).toBe('flex');
      expect(mockGoogleScriptRun.saveConfiguration).toHaveBeenCalledOnce();

      const submittedData = saveConfiguration.payload;
      expect(submittedData.apiKey).toBe('new-api-key');
      expect(submittedData.backendUrl).toBe('https://valid.url/api');
      expect(submittedData.jsonDbMasterIndexKey).toBe('valid-master-key');
      expect(submittedData.jsonDbLockTimeoutMs).toBe(5000);
      expect(submittedData.slidesFetchBatchSize).toBe(10);
      expect(submittedData.classroom).toEqual({ courseId: 'c1', courseName: 'Test Class 1' });
    });

    it('should omit apiKey from payload if it was redacted and user left it blank', () => {
      getConfiguration.successHandler({ hasApiKey: true }); // A key already exists
      fillFormWithValidData();
      document.getElementById('apiKey').value = ''; // User doesn't enter a new key

      document
        .getElementById('config-form')
        .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

      expect(mockGoogleScriptRun.saveConfiguration).toHaveBeenCalled();
      const submittedData = saveConfiguration.payload;
      expect(submittedData.apiKey).toBeUndefined();
    });

    it('should handle successful save', () => {
      getConfiguration.successHandler({ hasApiKey: false });
      fillFormWithValidData();
      document
        .getElementById('config-form')
        .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

      saveConfiguration.successHandler({ success: true });

      expect(document.getElementById('loadingOverlay').style.display).toBe('none');
      expect(mockMaterialize.toast).toHaveBeenCalledWith({
        html: 'Configuration saved successfully.',
        classes: 'green',
      });
      expect(mockGoogleScriptHost.close).toHaveBeenCalledOnce();
    });

    it('should handle server-side save error', () => {
      getConfiguration.successHandler({ hasApiKey: false });
      fillFormWithValidData();
      document
        .getElementById('config-form')
        .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

      saveConfiguration.successHandler({ success: false, error: 'Server validation failed' });

      expect(document.getElementById('loadingOverlay').style.display).toBe('none');
      expect(mockMaterialize.toast).toHaveBeenCalledWith({
        html: 'Error saving configuration: Server validation failed',
        classes: 'orange',
        displayLength: 8000,
      });
      expect(mockGoogleScriptHost.close).not.toHaveBeenCalled();
    });

    it('should handle network/runtime save error', () => {
      getConfiguration.successHandler({ hasApiKey: false });
      fillFormWithValidData();
      document
        .getElementById('config-form')
        .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

      const error = new Error('Network Failed');
      saveConfiguration.failureHandler(error);

      expect(document.getElementById('loadingOverlay').style.display).toBe('none');
      expect(mockMaterialize.toast).toHaveBeenCalledWith({
        html: `Error saving configuration: ${error.message}`,
        classes: 'red',
      });
      expect(mockGoogleScriptHost.close).not.toHaveBeenCalled();
    });
  });

  describe('User Actions', () => {
    it('should close the dialog when Cancel button is clicked', () => {
      const cancelButton = document.querySelector('.btn.grey');
      cancelButton.click();
      expect(mockGoogleScriptHost.close).toHaveBeenCalledOnce();
    });
  });
});
