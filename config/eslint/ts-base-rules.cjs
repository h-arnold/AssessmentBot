const sonarjs = require('eslint-plugin-sonarjs');
const security = require('eslint-plugin-security');
const unicornModule = require('eslint-plugin-unicorn');
const unicorn = unicornModule?.__esModule ? unicornModule.default : unicornModule;

const securityRecommendedWarnRules = Object.fromEntries(
  Object.entries(security.configs.recommended.rules).map(([ruleName]) => [ruleName, 'warn'])
);

const tsBaseRules = {
  ...securityRecommendedWarnRules,
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

module.exports = {
  security,
  securityRecommendedWarnRules,
  tsBaseRules,
  sonarjs,
  unicorn,
};
