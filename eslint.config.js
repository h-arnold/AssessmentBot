const googleappsscript = require('eslint-plugin-googleappsscript');
const jsdoc = require('eslint-plugin-jsdoc');
const tseslintParser = require('@typescript-eslint/parser');
const unicorn = require('eslint-plugin-unicorn').default;
const sonarjs = require('eslint-plugin-sonarjs');
const { unicodeSecurityRules } = require('./config/eslint/unicode-security-rules.cjs');
const {
  security,
  securityRecommendedErrorRules,
  nodeToolingRules,
  tseslint: tseslintPlugin,
} = require('./config/eslint/ts-base-rules.cjs');

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
      // Personal preference: preserve descriptive full names rather than enforce abbreviation churn.
      'unicorn/name-replacements': 'off',
      'unicorn/no-array-callback-reference': 'warn',
      // Disable rules that conflict with GAS naming conventions and preferences
      'unicorn/no-null': 'off',
      'unicorn/no-keyword-prefix': 'off',
      'unicorn/filename-case': 'off',
      // Personal preference: .forEach is readable and preserves existing iteration semantics;
      // for...of offers no readability benefit here.
      'unicorn/no-for-each': 'off',
      // Temporarily disabled pending native Error.isError runtime, typing and recognition investigation.
      // https://github.com/h-arnold/AssessmentBot/issues/326
      'unicorn/prefer-error-is-error': 'off',
      // Temporarily disabled pending a universal custom-error constructor and cause contract.
      // https://github.com/h-arnold/AssessmentBot/issues/328
      'unicorn/custom-error-definition': 'off',
      // Temporarily disabled pending native Error.cause support, descriptors/serialisation and full-cause preservation.
      // https://github.com/h-arnold/AssessmentBot/issues/328
      'unicorn/no-error-property-assignment': 'off',
      // Guard clauses and comparator tie-breaks are clearer as statements; ternaries also
      // conflict with prefer-logical-operator-over-ternary.
      'unicorn/prefer-ternary': 'off',
      // Preserve the documented per-singleton getInstance forwarding convention.
      'unicorn/no-useless-override': 'off',
      // Keep the Node 24 Buffer test fallback; Uint8Array#toBase64 is unavailable there.
      'unicorn/prefer-uint8array-base64': 'off',
      'unicorn/numeric-separators-style': 'off',
      // GAS rejects private fields; underscore-prefixed hooks must remain accessible to subclasses.
      'unicorn/prefer-private-class-fields': 'off',
      // Object helpers and prototype getters legitimately use receiver-bound `this` outside classes.
      'unicorn/no-this-outside-of-class': 'off',
      // Personal preference: preserve explicit class/prototype/helper bindings alongside
      // receiver-relative singleton inheritance; replacing either changes static call semantics.
      'unicorn/class-reference-in-static-methods': 'off',
      // Personal preference: conventional starred JSDoc is more readable.
      'unicorn/no-asterisk-prefix-in-documentation-comments': 'off',
      'unicorn/single-line-block-comment-style': ['error', 'single-line'],
      // Personal preference: retain full words in prose while checking standard capitalisation.
      'unicorn/comment-content': [
        'error',
        {
          replacements: {
            '\\bapplication\\b(?!/)': false,
            '\\bapplications\\b': false,
          },
        },
      ],
      // Personal preference: keep comments wrapped for readability and line-length requirements.
      'unicorn/no-manually-wrapped-comments': 'off',
      // Personal preference: action-labelled UI names are clearer than forced noun-based names.
      'unicorn/no-non-function-verb-prefix': 'off',
      // Personal preference: common Date/Set expressions are clearer without extra variables.
      'unicorn/no-unreadable-new-expression': 'off',
      // Personal preference: consistent object-method syntax is more readable than short arrow properties.
      'unicorn/prefer-short-arrow-method': 'off',
      // Personal preference: logical grouping suits constructor-first and public-entrypoint-first layouts.
      'unicorn/consistent-class-member-order': 'off',
      // Personal preference: preserve semantic guard order rather than sorting conditions by syntax.
      // Reordering can skip validation, logging or other side effects.
      'unicorn/prefer-simple-condition-first': 'off',
      // Personal preference: retain deliberate promise chaining without adding async wrappers.
      'unicorn/prefer-await': 'off',
      // Preserve prefix parsing and existing validation; Number coercion changes accepted inputs.
      'unicorn/prefer-number-coercion': 'off',
      // Personal preference: short whitespace fixtures are clearer as literals.
      'unicorn/prefer-string-repeat': 'off',
      // Temporal is unavailable in Node 24; GAS/browser compatibility is not established.
      'unicorn/prefer-temporal': 'off',
      // Temporarily off: review exception boundaries before enforcing a complexity limit of one.
      // https://github.com/h-arnold/AssessmentBot/issues/325
      'unicorn/try-complexity': 'off',
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
    files: ['src/backend/AssignmentProcessor/Assignment/index.js'],
    rules: {
      // Lazy prototype helpers support constructor-free rehydration; the rule cannot see them.
      'unicorn/no-undeclared-class-members': 'off',
    },
  },
  {
    files: ['src/backend/Models/ABClass.js'],
    rules: {
      // Preserve setClassName's empty-string-to-null contract; parameter defaults replace undefined only.
      'unicorn/prefer-default-parameters': 'off',
    },
  },
  {
    files: ['src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionValidation.js'],
    rules: {
      // Preserve falsy persisted-title normalisation to avoid false duplicate-title collisions.
      'unicorn/prefer-default-parameters': 'off',
    },
  },
  {
    files: [
      'src/backend/00_BaseSingleton.js',
      'src/backend/Assessors/0_SpreadsheetFormulaEquivalence.js',
      'src/backend/ConfigurationManager/98_ConfigurationManagerClass.js',
      'src/backend/Models/Artifacts/0_BaseTaskArtifact.js',
      'src/backend/Models/Artifacts/1_TextTaskArtifact.js',
      'src/backend/Models/Artifacts/2_TableTaskArtifact.js',
      'src/backend/Models/Artifacts/3_SpreadsheetTaskArtifact.js',
      'src/backend/Models/Artifacts/4_ImageTaskArtifact.js',
      'src/backend/Models/Artifacts/5_ArtifactFactory.js',
      'src/backend/Utils/ABLogger.js',
      'src/backend/Utils/AuthService.js',
      'src/backend/Utils/BatchUpdateUtility.js',
      'src/backend/Utils/GoogleGroupsAuthService.js',
      'src/backend/Utils/ProgressTracker.js',
      'src/backend/Utils/ScriptAppManager.js',
      'src/backend/Utils/ScriptPropertiesAuthService.js',
      'src/backend/Utils/Utils.js',
    ],
    rules: {
      // Intentional GAS namespace and proxy exports publish properties on the global object.
      'unicorn/no-global-object-property-assignment': 'off',
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
    // Synthetic analysis generation tooling is Node ESM, not GAS runtime source.
    // It reuses the canonical Node-tooling rule object shared with the builder.
    files: ['scripts/synthetic-test-data/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tseslintParser,
      parserOptions: {
        project: './scripts/synthetic-test-data/tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslintPlugin,
      jsdoc,
      security,
      sonarjs,
      unicorn,
    },
    rules: nodeToolingRules,
  },
  {
    // Synthetic analysis integration specs are TypeScript executed in Node.
    // The stress specs are the opt-in full-large suite in the same runtime.
    files: [
      'tests/synthetic-analysis/**/*.test.ts',
      'tests/synthetic-analysis-stress/**/*.test.ts',
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tseslintParser,
    },
    plugins: { security },
    rules: {
      ...unicodeSecurityRules,
      'max-lines': ['warn', 500],
    },
  },
];
