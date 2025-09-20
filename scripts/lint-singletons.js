#!/usr/bin/env node

/**
 * Lint script to check for singleton pattern violations
 *
 * This script greps for direct singleton constructor calls outside of
 * their defining modules and test files, which violates the lazy singleton pattern.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Singleton classes to check for
const singletonClasses = ['ConfigurationManager', 'UIManager', 'ProgressTracker', 'InitController'];

// Files/directories where singleton constructors are allowed
const allowedFiles = [
  'src/AdminSheet/ConfigurationManager/',
  'src/AdminSheet/UI/UIManager.js',
  'src/AdminSheet/Utils/ProgressTracker.js',
  'src/AdminSheet/y_controllers/InitController.js',
  'src/AdminSheet/z_singletons.js', // Deprecated file with commented examples
  'tests/',
  '00_BaseSingleton.js',
];

/**
 * Check if a file path is in the allowed list
 */
function isFileAllowed(filePath) {
  return allowedFiles.some((allowed) => filePath.includes(allowed));
}

/**
 * Search for singleton constructor calls in source files
 */
function findSingletonViolations() {
  const violations = [];

  for (const className of singletonClasses) {
    try {
      // Use grep to find 'new ClassName(' patterns (using basic regex)
      const pattern = `new ${className}(`;
      const cmd = `find src -name "*.js" -exec grep -Hn "${pattern}" {} \\;`;

      try {
        const output = execSync(cmd, { encoding: 'utf8' });
        const matches = output
          .trim()
          .split('\n')
          .filter((line) => line.length > 0);

        for (const match of matches) {
          const [filePath, lineNum, ...codeParts] = match.split(':');
          const code = codeParts.join(':');

          // Skip if file is in allowed list
          if (isFileAllowed(filePath)) {
            continue;
          }

          violations.push({
            className,
            filePath,
            lineNum: parseInt(lineNum),
            code: code.trim(),
          });
        }
      } catch (grepError) {
        // grep returns non-zero when no matches found, which is fine
        if (grepError.status !== 1) {
          console.warn(`Warning: grep error for ${className}:`, grepError.message);
        }
      }
    } catch (error) {
      console.warn(`Warning: Error checking ${className}:`, error.message);
    }
  }

  return violations;
}

/**
 * Main function
 */
function main() {
  console.log('🔍 Checking for singleton pattern violations...\n');

  const violations = findSingletonViolations();

  if (violations.length === 0) {
    console.log('✅ No singleton pattern violations found!');
    console.log('📚 All singleton classes are properly using getInstance() pattern.');
    process.exit(0);
  }

  console.log(`❌ Found ${violations.length} singleton pattern violation(s):\n`);

  violations.forEach((violation, index) => {
    console.log(`${index + 1}. ${violation.filePath}:${violation.lineNum}`);
    console.log(`   Class: ${violation.className}`);
    console.log(`   Code: ${violation.code}`);
    console.log(
      `   Fix: Use ${violation.className}.getInstance() instead of new ${violation.className}()`
    );
    console.log('');
  });

  console.log('📚 Please review the singleton pattern guide: docs/howTos/singletons.md');
  console.log('💡 Use ClassName.getInstance() instead of new ClassName() for singleton classes.');

  process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = { findSingletonViolations, isFileAllowed };
