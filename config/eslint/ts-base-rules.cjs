const tsBaseRules = {
  complexity: ['warn', 7],
  'jsdoc/require-jsdoc': [
    'warn',
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
