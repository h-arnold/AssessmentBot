import path from 'node:path';
import { promises as fs } from 'node:fs';

import { BuildStageError } from '../lib/errors.js';
import type { BuilderPaths, MergeManifestResult } from '../types.js';

const STAGE_ID = 'merge-manifest' as const;
const OUTPUT_FILENAME = 'appsscript.json';
const JSON_INDENT_SPACES = 2;

type ManifestService = {
  userSymbol: string;
  serviceId: string;
  version: string;
};

type Manifest = {
  oauthScopes?: string[];
  dependencies?: {
    enabledAdvancedServices?: ManifestService[];
  };
  [key: string]: unknown;
};

/**
 * Sorts object keys recursively to produce deterministic JSON output.
 *
 * @param {unknown} value - Value to normalise.
 * @return {unknown} Equivalent value with stable key ordering.
 */
export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortKeysDeep(entry));
  }
  if (value && typeof value === 'object') {
    const sortedEntries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    const result: Record<string, unknown> = {};
    for (const [key, entryValue] of sortedEntries) {
      result[key] = sortKeysDeep(entryValue);
    }
    return result;
  }
  return value;
}

/**
 * Merges OAuth scopes from base and additional manifests deterministically.
 *
 * @param {string[] | undefined} baseScopes - Base manifest scopes.
 * @param {string[] | undefined} additionalScopes - Additional manifest scopes.
 * @return {string[]} De-duplicated alphabetically sorted scopes.
 */
export function mergeScopes(baseScopes: string[] | undefined, additionalScopes: string[] | undefined): string[] {
  return [...new Set([...(baseScopes ?? []), ...(additionalScopes ?? [])])].sort((left, right) =>
    left.localeCompare(right),
  );
}

/**
 * Merges enabled advanced services preserving base service versions.
 *
 * @param {ManifestService[] | undefined} baseServices - Base manifest services.
 * @param {ManifestService[] | undefined} additionalServices - Additional manifest services.
 * @return {ManifestService[]} Deterministic services merged by service ID.
 */
export function mergeServices(
  baseServices: ManifestService[] | undefined,
  additionalServices: ManifestService[] | undefined,
): ManifestService[] {
  const byServiceId = new Map<string, ManifestService>();

  for (const service of baseServices ?? []) {
    byServiceId.set(service.serviceId, service);
  }

  for (const service of additionalServices ?? []) {
    if (!byServiceId.has(service.serviceId)) {
      byServiceId.set(service.serviceId, service);
    }
  }

  return [...byServiceId.values()].sort((left, right) => left.serviceId.localeCompare(right.serviceId));
}

/**
 * Reads and parses a manifest JSON file.
 *
 * @param {string} manifestPath - Absolute manifest path.
 * @return {Promise<Manifest>} Parsed manifest object.
 */
async function readManifest(manifestPath: string): Promise<Manifest> {
  try {
    const raw = await fs.readFile(manifestPath, 'utf-8');
    return JSON.parse(raw) as Manifest;
  } catch (err) {
    throw new BuildStageError(STAGE_ID, `Unable to read manifest: ${manifestPath}`, err);
  }
}

/**
 * Merges backend and JsonDbApp manifests and writes final GAS manifest output.
 *
 * @param {BuilderPaths} paths - Resolved builder path configuration.
 * @return {Promise<MergeManifestResult>} Output metadata and merged counts.
 */
export async function runMergeManifest(paths: BuilderPaths): Promise<MergeManifestResult> {
  const baseManifest = await readManifest(paths.backendManifestPath);
  const jsonDbManifest = await readManifest(paths.jsonDbAppManifestPath);

  const mergedScopes = mergeScopes(baseManifest.oauthScopes, jsonDbManifest.oauthScopes);
  const mergedServices = mergeServices(
    baseManifest.dependencies?.enabledAdvancedServices,
    jsonDbManifest.dependencies?.enabledAdvancedServices,
  );

  const mergedManifest: Manifest = {
    ...baseManifest,
    oauthScopes: mergedScopes,
    dependencies: {
      ...(baseManifest.dependencies ?? {}),
      enabledAdvancedServices: mergedServices,
    },
  };

  const outputPath = path.join(paths.buildGasDir, OUTPUT_FILENAME);
  const outputJson = `${JSON.stringify(sortKeysDeep(mergedManifest), null, JSON_INDENT_SPACES)}\n`;

  try {
    await fs.writeFile(outputPath, outputJson, 'utf-8');
  } catch (err) {
    throw new BuildStageError(STAGE_ID, `Unable to write merged manifest: ${outputPath}`, err);
  }

  return {
    stage: STAGE_ID,
    outputPath,
    mergedScopeCount: mergedScopes.length,
    mergedServiceCount: mergedServices.length,
  };
}
