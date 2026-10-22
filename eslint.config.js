const googleappsscript = require('eslint-plugin-googleappsscript');
const jsdoc = require('eslint-plugin-jsdoc');
const tseslintParser = require('@typescript-eslint/parser');
const unicorn = require('eslint-plugin-unicorn').default;
const sonarjs = require('eslint-plugin-sonarjs');
const { unicodeSecurityRules } = require('./config/eslint/unicode-security-rules.cjs');
const {
  crossRuntimeUnicornPreferenceRules,
  unicornPreferenceRules,
} = require('./config/eslint/unicorn-preference-rules.cjs');
const {
  security,
  securityRecommendedErrorRules,
  nodeToolingRules,
  tseslint: tseslintPlugin,
} = require('./config/eslint/ts-base-rules.cjs');
const { importPathDepthPlugin, pathAliases } = require('./config/eslint/import-path-rules.cjs');

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
      ...unicornPreferenceRules,
      ...crossRuntimeUnicornPreferenceRules,
      ...sonarjs.configs.recommended.rules,
      // Temporarily disabled for the backend section only; re-enable requires explicit user approval before modifying these helpers.
      'sonarjs/prefer-single-boolean-return': 'off',
      'sonarjs/prefer-immediate-return': 'off',
      // prefer globalThis instead of window/self/global
      'unicorn/prefer-global-this': 'error',
      // insist on Number.parseInt, Number.parseFloat, etc., instead of globals
      'unicorn/prefer-number-properties': 'error',
      'unicorn/no-array-callback-reference': 'warn',
      // Preserve the documented per-singleton getInstance forwarding convention.
      'unicorn/no-useless-override': 'off',
      // Keep the Node 24 Buffer test fallback; Uint8Array#toBase64 is unavailable there.
      'unicorn/prefer-uint8array-base64': 'off',
      'unicorn/numeric-separators-style': 'off',
      // GAS rejects private fields; underscore-prefixed hooks must remain accessible to subclasses.
      'unicorn/prefer-private-class-fields': 'off',
      // GAS rejects class field declarations, which is exactly what this rule recommends and
      // autofixes. Its fixer would rewrite a valid constructor assignment into syntax the
      // Apps Script parser refuses, breaking the next clasp push.
      'unicorn/prefer-class-fields': 'off',
      // Object helpers and prototype getters legitimately use receiver-bound `this` outside classes.
      'unicorn/no-this-outside-of-class': 'off',
      // Personal preference: preserve explicit class/prototype/helper bindings alongside
      // receiver-relative singleton inheritance; replacing either changes static call semantics.
      'unicorn/class-reference-in-static-methods': 'off',
      // Prevent accidental redefinition of BaseSingleton outside the canonical file.
      'no-restricted-syntax': [
        'error',
        {
          // The Apps Script script parser rejects class field declarations, so a pushed build
          // fails with "ParseError: Unexpected token ;" even though the V8 runtime supports them.
          // Declare fields in the constructor with a JSDoc @type annotation instead.
          selector: 'PropertyDefinition',
          message:
            'Google Apps Script rejects class field declarations (instance, static and private fields). Declare the field in the constructor with a JSDoc @type annotation instead.',
        },
        {
          selector: 'StaticBlock',
          message:
            'Google Apps Script rejects class static initialisation blocks. Assign static properties after the class definition instead.',
        },
        {
          selector:
            "AssignmentExpression[operator='||='], AssignmentExpression[operator='&&='], AssignmentExpression[operator='??=']",
          message:
            'Google Apps Script rejects logical assignment operators (ES2021). Use an explicit if-statement that preserves the intended falsy or nullish semantics instead.',
        },
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
      'import-path': importPathDepthPlugin,
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
  {
    // Enforce the import-path depth policy across the Node-side test suites:
    // `../x` is allowed, but `../../x` and deeper must use a configured alias.
    // The fixer rewrites covered specifiers, including the Vitest `vi.mock`
    // family, to their canonical alias. The synthetic *scripts* are covered by
    // the shared `nodeToolingRules` in their own scope.
    files: ['tests/**/*.{js,ts}'],
    plugins: { 'import-path': importPathDepthPlugin },
    rules: {
      'import-path/path-depth': [
        'error',
        {
          rootDir: __dirname,
          aliases: [
            pathAliases.backend,
            pathAliases.syntheticData,
            pathAliases.testHelpers,
            pathAliases.frontend,
            pathAliases.syntheticFixtures,
          ],
        },
      ],
    },
  },
];
