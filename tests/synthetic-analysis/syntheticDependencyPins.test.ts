import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

type PackageManifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type LockfilePackage = {
  version?: string;
  devDependencies?: Record<string, string>;
};

type PackageLock = {
  packages?: Record<string, LockfilePackage>;
};

const FAKER_PACKAGE = '@faker-js/faker';
const FAKER_PINNED_VERSION = '10.6.0';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const packageManifest = JSON.parse(
  readFileSync(join(repositoryRoot, 'package.json'), 'utf8')
) as PackageManifest;
const packageLock = JSON.parse(
  readFileSync(join(repositoryRoot, 'package-lock.json'), 'utf8')
) as PackageLock;

describe('synthetic analysis generation dependency pinning', () => {
  it('declares @faker-js/faker at exactly 10.6.0 as a root development dependency', () => {
    expect(packageManifest.devDependencies?.[FAKER_PACKAGE]).toBe(FAKER_PINNED_VERSION);
    expect(packageManifest.dependencies?.[FAKER_PACKAGE]).toBeUndefined();
  });

  it('records the exact pinned version in the lockfile root and resolved package entry', () => {
    const rootPackage = packageLock.packages?.[''];

    expect(rootPackage?.devDependencies?.[FAKER_PACKAGE]).toBe(FAKER_PINNED_VERSION);
    expect(packageLock.packages?.[`node_modules/${FAKER_PACKAGE}`]?.version).toBe(
      FAKER_PINNED_VERSION
    );
  });
});
