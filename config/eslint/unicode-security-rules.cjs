const unicodeSecurityRules = {
  'security/detect-bidi-characters': 'warn',
  'no-irregular-whitespace': [
    'warn',
    {
      skipComments: false,
      skipRegExps: false,
      skipStrings: false,
      skipTemplates: false,
      skipJSXText: false,
    },
  ],
  'no-misleading-character-class': 'warn',
  'no-control-regex': 'warn',
  'require-unicode-regexp': 'warn',
};

module.exports = {
  unicodeSecurityRules,
};
