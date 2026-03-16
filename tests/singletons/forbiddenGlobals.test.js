const fs = require('fs');
const path = require('path');

describe('Forbidden global singleton identifiers', () => {
  const SRC_DIR = path.join(__dirname, '../../src');
  const allowedNewConfigurationManagerFiles = new Set([
    // Allow within the class definition file itself.
    path.normalize('src/AdminSheet/ConfigurationManager/ConfigurationManagerClass.js'),
    // Allow test environment instantiations via z_singletons deprecation comment (no actual instantiation now)
  ]);

  function walk(dir) {
    return fs.readdirSync(dir).flatMap((entry) => {
      const full = path.join(dir, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) return walk(full);
      return [full];
    });
  }

  const deprecatedFiles = new Set([path.join(SRC_DIR, 'AdminSheet/z_singletons.js')]);
  const files = walk(SRC_DIR)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => !deprecatedFiles.has(f));

  test('no usage of configurationManager.<member> remains', () => {
    const offenders = [];
    const pattern = /configurationManager\./g;
    for (const file of files) {
      const rel = path.relative(process.cwd(), file);
      const content = fs.readFileSync(file, 'utf8');
      if (pattern.test(content)) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('no usage of initController.<member> remains', () => {
    const offenders = [];
    const pattern = /initController\./g;
    for (const file of files) {
      const rel = path.relative(process.cwd(), file);
      const content = fs.readFileSync(file, 'utf8');
      if (pattern.test(content)) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('no direct new ConfigurationManager() outside allowed files', () => {
    const offenders = [];
    const pattern = /new\s+ConfigurationManager\s*\(/g;
    for (const file of files) {
      const rel = path.relative(process.cwd(), file);
      const normalized = rel.replace(/\\/g, '/');
      const content = fs.readFileSync(file, 'utf8');
      if (pattern.test(content) && !allowedNewConfigurationManagerFiles.has(normalized)) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
});
