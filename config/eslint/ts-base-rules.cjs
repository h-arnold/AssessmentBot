const sonarjs = require('eslint-plugin-sonarjs');

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
};

module.exports = {
  tsBaseRules,
};
