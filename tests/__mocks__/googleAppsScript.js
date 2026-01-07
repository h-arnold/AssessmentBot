/**
 * Mock implementations for Google Apps Script globals used in singleton constructors
 * These mocks are lightweight and track when they are called for testing purposes
 */

// Mock PropertiesService
const mockPropertiesService = {
  _calls: [],
  getScriptProperties() {
    this._calls.push('getScriptProperties');
    return {
      _properties: {},
      _calls: [],
      getProperties() {
        this._calls.push('getProperties');
        return { ...this._properties };
      },
      getProperty(key) {
        this._calls.push(`getProperty:${key}`);
        return this._properties[key] || null;
      },
      setProperty(key, value) {
        this._calls.push(`setProperty:${key}`);
        this._properties[key] = value;
      },
      setProperties(props) {
        this._calls.push('setProperties');
        Object.assign(this._properties, props);
      },
      deleteProperty(key) {
        this._calls.push(`deleteProperty:${key}`);
        delete this._properties[key];
      },
      getKeys() {
        this._calls.push('getKeys');
        return Object.keys(this._properties);
      },
    };
  },
  getDocumentProperties() {
    this._calls.push('getDocumentProperties');
    return {
      _properties: {},
      _calls: [],
      getProperties() {
        this._calls.push('getProperties');
        return { ...this._properties };
      },
      getProperty(key) {
        this._calls.push(`getProperty:${key}`);
        return this._properties[key] || null;
      },
      setProperty(key, value) {
        this._calls.push(`setProperty:${key}`);
        this._properties[key] = value;
      },
      setProperties(props) {
        this._calls.push('setProperties');
        Object.assign(this._properties, props);
      },
      deleteProperty(key) {
        this._calls.push(`deleteProperty:${key}`);
        delete this._properties[key];
      },
      getKeys() {
        this._calls.push('getKeys');
        return Object.keys(this._properties);
      },
    };
  },
};

// Mock SpreadsheetApp
const mockSpreadsheetApp = {
  _calls: [],
  getUi() {
    this._calls.push('getUi');
    return {
      _calls: [],
      createMenu(title) {
        this._calls.push(`createMenu:${title}`);
        mockSpreadsheetApp._calls.push(`createMenu:${title}`);
        return {
          addItem: () => this,
          addToUi: () => this,
        };
      },
      alert(message) {
        this._calls.push(`alert:${message}`);
        mockSpreadsheetApp._calls.push(`alert:${message}`);
      },
      showModalDialog(htmlOutput, title) {
        this._calls.push(`showModalDialog:${title}`);
        mockSpreadsheetApp._calls.push(`showModalDialog:${title}`);
      },
    };
  },
};

// Mock HtmlService
const mockHtmlService = {
  _calls: [],
  createHtmlOutputFromFile(filename) {
    this._calls.push(`createHtmlOutputFromFile:${filename}`);
    return {
      getContent: function () {
        return '';
      },
      setWidth: function (w) {
        mockHtmlService._calls.push(`setWidth:${w}`);
        this._width = w;
        return this;
      },
      setHeight: function (h) {
        mockHtmlService._calls.push(`setHeight:${h}`);
        this._height = h;
        return this;
      },
      evaluate: function () {
        return this;
      },
    };
  },
  createTemplateFromFile(name) {
    this._calls.push(`createTemplateFromFile:${name}`);
    return {
      assignments: [],
      versions: [],
      evaluate: function () {
        return {
          setWidth: function (w) {
            mockHtmlService._calls.push(`setWidth:${w}`);
            this._width = w;
            return this;
          },
          setHeight: function (h) {
            mockHtmlService._calls.push(`setHeight:${h}`);
            this._height = h;
            return this;
          },
        };
      },
    };
  },
  createHtmlOutput(html) {
    this._calls.push('createHtmlOutput');
    return {
      setWidth: function () {
        return this;
      },
      setHeight: function () {
        return this;
      },
    };
  },
};

// Mock DriveApp
const mockDriveApp = {
  _calls: [],
  getFileById(id) {
    this._calls.push(`getFileById:${id}`);
    return {
      getId: () => id,
      getName: () => `MockFile-${id}`,
    };
  },
  getFolderById(id) {
    this._calls.push(`getFolderById:${id}`);
    return {
      getId: () => id,
      getName: () => `MockFolder-${id}`,
    };
  },
};

// Mock GoogleClassroomManager with required methods
const mockGoogleClassroomManager = function () {
  mockGoogleClassroomManager._constructorCalls =
    (mockGoogleClassroomManager._constructorCalls || 0) + 1;
  this._instanceId = mockGoogleClassroomManager._constructorCalls;
  this.getCourseId = () => 'course-123';
  this.getAssignments = () => [
    { title: 'Assignment One' },
    { title: 'Assignment Two With Longer Title' },
  ];
  this.getActiveClassrooms = () => [
    { name: 'Class A', id: 'cA' },
    { name: 'Class B', id: 'cB' },
  ];
  this.sheet = {
    getDataRange: () => ({
      getValues: () => [
        [
          'Classroom ID',
          'Name',
          'Teacher 1',
          'Teacher 2',
          'Teacher 3',
          'Teacher 4',
          'Enrollment Code',
          'createAssessmentRecord',
          'Template File Id',
        ],
        ['cA', 'Class A', 'T1', '', '', '', '', 'true', 'tmpl1'],
      ],
    }),
    getRange: () => ({ setValues: () => {} }),
  };
};
mockGoogleClassroomManager._constructorCalls = 0;

// Mock PropertiesCloner
const mockPropertiesCloner = function () {
  mockPropertiesCloner._constructorCalls = (mockPropertiesCloner._constructorCalls || 0) + 1;
  this.sheet = null; // Default to no sheet found
  this.deserialiseProperties = () => {
    mockPropertiesCloner._calls = mockPropertiesCloner._calls || [];
    mockPropertiesCloner._calls.push('deserialiseProperties');
  };
};
mockPropertiesCloner._constructorCalls = 0;
mockPropertiesCloner._calls = [];

// Mock ConfigurationManager for UIManager tests
const mockConfigurationManager = {
  _instance: null,
  getInstance() {
    if (!this._instance) {
      this._instance = {
        getAssessmentRecordCourseId: function () {
          return 'mock-course-id';
        },
      };
    }
    return this._instance;
  },
};

module.exports = {
  PropertiesService: mockPropertiesService,
  SpreadsheetApp: mockSpreadsheetApp,
  HtmlService: mockHtmlService,
  DriveApp: mockDriveApp,
  GoogleClassroomManager: mockGoogleClassroomManager,
  PropertiesCloner: mockPropertiesCloner,
  ConfigurationManager: mockConfigurationManager,
  Utils: { isValidUrl: (u) => typeof u === 'string' && /^https?:\/\//.test(u) },
};
