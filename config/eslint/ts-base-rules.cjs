const path = require('node:path');
const sonarjs = require('eslint-plugin-sonarjs');
const security = require('eslint-plugin-security');
const tseslint = require('@typescript-eslint/eslint-plugin');
const unicornModule = require('eslint-plugin-unicorn');
const { importPathDepthPlugin, pathAliases } = require('./import-path-rules.cjs');
const unicorn = unicornModule?.__esModule ? unicornModule.default : unicornModule;

const securityRecommendedErrorRules = Object.fromEntries(
  Object.entries(security.configs.recommended.rules).map(([ruleName]) => [ruleName, 'error'])
);

const tsBaseRules = {
  ...securityRecommendedErrorRules,
  ...sonarjs.configs.recommended.rules,
  complexity: ['error', 7],
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
  'jsdoc/require-description': 'error', // require a summary/description
  'jsdoc/require-param': 'error', // require @param tags for all params
  'jsdoc/require-param-description': 'error', // require each @param to have a description
  'jsdoc/require-param-type': 'error', // require types on @param
  'jsdoc/require-returns': 'error', // require @returns tag when function returns
  'jsdoc/require-returns-description': 'error', // require description on @returns
  'jsdoc/require-returns-type': 'error', // require type on @returns
  '@typescript-eslint/no-magic-numbers': [
    'warn',
    {
      ignore: [0, 1],
      ignoreArrayIndexes: true,
      enforceConst: true,
      ignoreEnums: true,
      ignoreNumericLiteralTypes: true,
      ignoreReadonlyClassProperties: true,
    },
  ],
  '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
  '@typescript-eslint/prefer-optional-chain': 'error',
  'unicorn/prefer-string-raw': 'error',
  'unicorn/prefer-string-starts-ends-with': 'error',
  'unicorn/prefer-string-replace-all': 'error',
};

// Canonical rule set for Node-side tooling (the builder CLI and the synthetic
// analysis scripts). Both consumers import this exact object so the two cannot
// drift into divergent rule maps.
const nodeToolingRules = {
  ...tseslint.configs.recommended.rules,
  ...tsBaseRules,
  'security/detect-non-literal-fs-filename': 'off',
  // Node-side tooling must not reach two or more parent directories with a
  // relative specifier; the fixer rewrites covered specifiers to a canonical
  // alias. The alias set is the union of Node-side targets so both consumers
  // share one rule entry (and therefore one identity) as the contract requires.
  'import-path/path-depth': [
    'error',
    {
      rootDir: path.resolve(__dirname, '..', '..'),
      aliases: [
        pathAliases.frontend,
        pathAliases.syntheticFixtures,
        pathAliases.backend,
        pathAliases.syntheticData,
        pathAliases.testHelpers,
        pathAliases.builder,
      ],
    },
  ],
};

module.exports = {
  security,
  securityRecommendedErrorRules,
  tsBaseRules,
  nodeToolingRules,
  importPathDepthPlugin,
  pathAliases,
  sonarjs,
  tseslint,
  unicorn,
};
