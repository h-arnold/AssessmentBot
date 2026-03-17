const googleappsscript = require('eslint-plugin-googleappsscript');
const jsdoc = require('eslint-plugin-jsdoc');
const security = require('eslint-plugin-security');
const unicorn = require('eslint-plugin-unicorn').default;
const sonarjs = require('eslint-plugin-sonarjs');

module.exports = [
  // Ignore legacy GAS source folders entirely from linting
  {
    ignores: ['src/AdminSheet/**', 'src/AssessmentRecordTemplate/**'],
  },
  // Apply unicorn's complete rule set (modern JS preferences + more) to backend only
  {
    ...unicorn.configs.all,
    files: ['src/backend/**/*.js'],
  },
  {
    // Backend GAS JavaScript rules - scoped to backend only
    files: ['src/backend/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        // Project singletons and global classes exposed to GAS
        Assessment: 'readonly',
        Assignment: 'readonly',
        AssessmentRecord: 'readonly',
        Student: 'readonly',
        StudentSubmission: 'readonly',
        TaskDefinition: 'readonly',
        BaseTaskArtifact: 'readonly',
        TextTaskArtifact: 'readonly',
        TableTaskArtifact: 'readonly',
        SpreadsheetTaskArtifact: 'readonly',
        ImageTaskArtifact: 'readonly',
        ArtifactFactory: 'readonly',

        // Managers / controllers / utilities used as globals or singletons
        Utils: 'readonly',
        ProgressTracker: 'readonly',
        UIManager: 'readonly',
        ConfigurationManagerClass: 'readonly',
        LLMRequestManager: 'readonly',
        CacheManager: 'readonly',
        ImageManager: 'readonly',
        TriggerController: 'readonly',

        // Sheet managers and extractors
        BaseSheetManager: 'readonly',
        AnalysisSheetManager: 'readonly',
        ClassAssessmentSheet: 'readonly',
        ClassroomSheetManager: 'readonly',
        CohortAnalysisSheetManager: 'readonly',
        MultiSheetExtractor: 'readonly',
        OverviewSheetManager: 'readonly',
        SummarySheetManager: 'readonly',
      },
    },
    plugins: { googleappsscript, jsdoc, security, unicorn, sonarjs },
    rules: {
      ...security.configs.recommended.rules,
      ...sonarjs.configs.recommended.rules,
      // Temporarily disabled for the backend section only; re-enable requires explicit user approval before modifying these helpers.
      'sonarjs/prefer-single-boolean-return': 'off',
      'sonarjs/prefer-immediate-return': 'off',
      // prefer globalThis instead of window/self/global
      'unicorn/prefer-global-this': 'error',
      // insist on Number.parseInt, Number.parseFloat, etc., instead of globals
      'unicorn/prefer-number-properties': 'error',
      // Standardize on error names only (catch clauses should use 'error')
      'unicorn/catch-error-name': 'error',
      'unicorn/prevent-abbreviations': [
        'error',
        {
          allowList: {
            DbManager: true,
            Utils: true,
          },
        },
      ],
      // Disable rules that conflict with GAS naming conventions and preferences
      'unicorn/no-null': 'off',
      'unicorn/no-keyword-prefix': 'off',
      'unicorn/filename-case': 'off',
      'unicorn/no-array-for-each': 'off',
      'unicorn/numeric-separators-style': 'off',
      // Prevent accidental redefinition of BaseSingleton outside the canonical file.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "Program:not([sourceType='module']) VariableDeclarator[id.name='BaseSingleton']",
          message:
            'Do not declare a global BaseSingleton in individual files. Use src/AdminSheet/00_BaseSingleton.js for the canonical implementation.',
        },

        {
          selector: "AssignmentExpression[left.name='BaseSingleton']",
          message:
            'Do not assign to BaseSingleton identifier outside src/AdminSheet/00_BaseSingleton.js; keep the canonical implementation in that single file.',
        },
        // Prevent direct singleton constructor calls (except in defining modules and tests)
        {
          selector: "NewExpression[callee.name='ConfigurationManager']",
          message:
            'Use ConfigurationManager.getInstance() instead of new ConfigurationManager(). Direct constructor calls violate the singleton pattern.',
        },
        {
          selector: "NewExpression[callee.name='UIManager']",
          message:
            'Use UIManager.getInstance() instead of new UIManager(). Direct constructor calls violate the singleton pattern.',
        },
        {
          selector: "NewExpression[callee.name='ProgressTracker']",
          message:
            'Use ProgressTracker.getInstance() instead of new ProgressTracker(). Direct constructor calls violate the singleton pattern.',
        },
        {
          selector: "NewExpression[callee.name='InitController']",
          message:
            'Use InitController.getInstance() instead of new InitController(). Direct constructor calls violate the singleton pattern.',
        },
      ],
      'jsdoc/require-jsdoc': [
        'error',
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
          },
        },
      ],
      'no-magic-numbers': [
        'warn',
        {
          ignore: [0, 1],
          ignoreArrayIndexes: true,
          enforceConst: true,
          detectObjects: false,
        },
      ],
    },
  },
  {
    // Backend-specific rules
    files: ['src/backend/DbManager/DbManager.js', 'src/backend/Utils/Utils.js'],
    rules: {
      'unicorn/prevent-abbreviations': [
        'error',
        {
          checkFilenames: false,
          allowList: {
            DbManager: true,
            Utils: true,
          },
        },
      ],
    },
  },
];
