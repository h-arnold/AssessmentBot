const fs = require('fs');
const path = require('path');

describe('Forbidden global singleton identifiers', () => {
  const SRC_DIR = path.join(__dirname, '../../src');
  const allowedNewConfigurationManagerFiles = new Set([
    // Allow within the class definition file itself.
    path.normalize('src/AdminSheet/ConfigurationManager/ConfigurationManagerClass.js'),
    path.normalize('src/backend/ConfigurationManager/98_ConfigurationManagerClass.js'),
    // Allow test environment instantiations via z_singletons deprecation comment (no actual instantiation now)
  ]);
  const ignoredDirectories = new Set(['node_modules']);

  function walk(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      if (entry.isDirectory()) {
        if (ignoredDirectories.has(entry.name)) return [];
        return walk(path.join(dir, entry.name));
      }

      return [path.join(dir, entry.name)];
    });
  }

  const deprecatedFiles = new Set([path.join(SRC_DIR, 'AdminSheet/z_singletons.js')]);
  const files = walk(SRC_DIR)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => !deprecatedFiles.has(f));
  const fileContents = files.map((file) => fs.readFileSync(file, 'utf8'));

  function findOffenders(pattern) {
    const offenders = [];

    fileContents.forEach((content, index) => {
      if (pattern.test(content)) {
        offenders.push(path.relative(process.cwd(), files[index]));
      }
    });

    return offenders;
  }

  test('no usage of configurationManager.<member> remains', () => {
    const pattern = /configurationManager\./g;

    expect(findOffenders(pattern)).toEqual([]);
  }, 20000);

  test('no usage of initController.<member> remains', () => {
    const pattern = /initController\./g;

    expect(findOffenders(pattern)).toEqual([]);
  });

  test('no direct new ConfigurationManager() outside allowed files', () => {
    const pattern = /new\s+ConfigurationManager\s*\(/g;

    const offenders = [];
    fileContents.forEach((content, index) => {
      const rel = path.relative(process.cwd(), files[index]);
      const normalized = rel.replace(/\\/g, '/');
      if (pattern.test(content) && !allowedNewConfigurationManagerFiles.has(normalized)) {
        offenders.push(rel);
      }
    });

    expect(offenders).toEqual([]);
  });
});
