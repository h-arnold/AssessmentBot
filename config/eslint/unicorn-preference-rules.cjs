// Unicorn preferences shared by the backend and frontend ESLint configs.
const unicornPreferenceRules = {
  // Keep conventional starred JSDoc and single-line block comments; retain full words in prose
  // while checking standard capitalisation (including both backend and frontend conventions).
  'unicorn/no-asterisk-prefix-in-documentation-comments': 'off',
  'unicorn/single-line-block-comment-style': ['error', 'single-line'],
  'unicorn/comment-content': [
    'error',
    {
      replacements: {
        '\\bapplication\\b(?!/)': false,
        '\\bapplications\\b': false,
      },
    },
  ],
  // Wrapped comments meet readability and line-length needs; action-labelled UI names,
  // common Date/Set expressions, and object-method syntax remain intentional preferences.
  'unicorn/no-manually-wrapped-comments': 'off',
  'unicorn/no-non-function-verb-prefix': 'off',
  'unicorn/no-unreadable-new-expression': 'off',
  'unicorn/prefer-short-arrow-method': 'off',
  // Preserve logical member grouping (constructor/public-entrypoint-first).
  'unicorn/consistent-class-member-order': 'off',
  // Preserve semantic guard order: reordering conditions can skip validation, logging, or side effects.
  'unicorn/prefer-simple-condition-first': 'off',
  // Preserve deliberate promise observers, identity, cleanup ordering, and direct chaining
  // without unnecessary async wrappers.
  'unicorn/prefer-await': 'off',
  // Preserve prefix parsing: Number coercion rejects CSS values such as '12px' and differs
  // from decimal parseInt for blank, scientific-notation and hexadecimal inputs.
  'unicorn/prefer-number-coercion': 'off',
  // Retain descriptive full names rather than abbreviation churn.
  'unicorn/name-replacements': 'off',
  // Short whitespace fixtures are clearer as literals than repeat expressions.
  'unicorn/prefer-string-repeat': 'off',
  // Temporal is unavailable in Node 24; GAS/browser compatibility is not established.
  'unicorn/prefer-temporal': 'off',
  // Temporarily disabled pending review of exception boundaries before enforcing complexity one.
  // https://github.com/h-arnold/AssessmentBot/issues/325
  'unicorn/try-complexity': 'off',
  // .forEach is readable and preserves existing iteration semantics; for...of offers no
  // readability benefit here.
  'unicorn/no-for-each': 'off',
  // Temporarily disabled pending native Error.isError runtime, typing and recognition investigation.
  // https://github.com/h-arnold/AssessmentBot/issues/326
  'unicorn/prefer-error-is-error': 'off',
  // Temporarily disabled pending a universal custom-error constructor and cause contract.
  // https://github.com/h-arnold/AssessmentBot/issues/328
  'unicorn/custom-error-definition': 'off',
  // Temporarily disabled pending native Error.cause support, descriptors/serialisation and
  // full-cause preservation. https://github.com/h-arnold/AssessmentBot/issues/328
  'unicorn/no-error-property-assignment': 'off',
  // Guard clauses and comparator tie-breaks are clearer as statements; ternary conversion also
  // conflicts with prefer-logical-operator-over-ternary.
  'unicorn/prefer-ternary': 'off',
};

// Shared across backend and frontend source scopes (frontend TypeScript/TSX only).
const crossRuntimeUnicornPreferenceRules = {
  // Standardise catch clauses on the conventional `error` name.
  'unicorn/catch-error-name': 'error',
  // Preserve null as a valid value; keyword-prefix and filename-case enforcement conflicts with
  // GAS naming conventions and is intentionally avoided across runtimes.
  'unicorn/no-null': 'off',
  'unicorn/no-keyword-prefix': 'off',
  'unicorn/filename-case': 'off',
};

module.exports = { crossRuntimeUnicornPreferenceRules, unicornPreferenceRules };
