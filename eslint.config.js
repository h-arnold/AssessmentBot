const googleappsscript = require('eslint-plugin-googleappsscript');
const jsdoc = require('eslint-plugin-jsdoc');
const unicorn = require('eslint-plugin-unicorn').default;
const sonarjs = require('eslint-plugin-sonarjs');
const { unicodeSecurityRules } = require('./config/eslint/unicode-security-rules.cjs');
const { security, securityRecommendedErrorRules } = require('./config/eslint/ts-base-rules.cjs');

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
      // Google Apps Script evaluates backend files as one concatenated script rather than
      // as modules. A declaration can therefore be consumed by a later file, and a reference
      // can resolve to a symbol declared by an earlier file. ESLint analyses each file in
      // isolation, so these rules would report valid cross-file GAS symbols as false positives.
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-unreachable': 'error',
      ...securityRecommendedErrorRules,
      // `security/detect-object-injection` is disabled backend-wide.
      //
      // Justification: a full-backend audit triaged every finding as a false
      // positive — computed-key reads or numeric array indices, never a
      // computed-string-key write, which is the only shape that can cause
      // prototype pollution. The workarounds the rule pushes (defensive
      // `Object.hasOwn` guards or key allow-lists threaded through
      // serialisation and rehydration code) are routinely no safer than the
      // flagged access itself: they add branching without shrinking the trust
      // boundary. The genuine control is robust validation and input
      // sanitisation at the trust boundaries — transport-boundary checks in
      // the `z_Api` trailing-underscore helpers, domain invariants in the
      // owning controllers, and re-validation of persisted shapes at the
      // downstream schema gate — not computed-key heuristics. This matches
      // the frontend, where the rule is already off globally for the same
      // reason. Do not reintroduce per-file re-enables; fix validation
      // instead.
      'security/detect-object-injection': 'off',
      ...unicodeSecurityRules,
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
      'unicorn/no-array-callback-reference': 'warn',
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
      'jsdoc/require-description': 'error',
      'jsdoc/require-param': 'error',
      'jsdoc/require-param-description': 'error',
      'jsdoc/require-param-type': 'error',
      'jsdoc/require-returns': 'error',
      'jsdoc/require-returns-description': 'error',
      'jsdoc/require-returns-type': 'error',
      'no-magic-numbers': [
        'warn',
        {
          ignore: [0, 1],
          ignoreArrayIndexes: true,
          enforceConst: true,
          detectObjects: false,
        },
      ],
      'max-lines': ['warn', 500],
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    plugins: { security },
    rules: {
      ...unicodeSecurityRules,
      'prefer-object-has-own': 'warn',
      'no-negated-condition': 'warn',
      'require-unicode-regexp': 'off',
      'max-lines': ['warn', 500],
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
