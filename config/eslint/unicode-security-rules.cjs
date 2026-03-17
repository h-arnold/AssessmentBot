const unicodeSecurityRules = {
  'security/detect-bidi-characters': 'error',
  'no-irregular-whitespace': [
    'error',
    {
      skipComments: false,
      skipRegExps: false,
      skipStrings: false,
      skipTemplates: false,
      skipJSXText: false,
    },
  ],
  'no-misleading-character-class': 'error',
  'no-control-regex': 'error',
  'require-unicode-regexp': 'error',
};

module.exports = {
  unicodeSecurityRules,
};
