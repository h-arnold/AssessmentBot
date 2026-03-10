const sonarjs = require('eslint-plugin-sonarjs');
const unicornModule = require('eslint-plugin-unicorn');
const unicorn = unicornModule?.__esModule ? unicornModule.default : unicornModule;

const tsBaseRules = {
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
  tsBaseRules,
  sonarjs,
  unicorn,
};
