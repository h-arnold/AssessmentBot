import { promises as fs } from 'node:fs';

import { BuildStageError } from './errors.js';
import type { BuildStageId } from '../types.js';

export const pathExists = async (targetPath: string): Promise<boolean> => {
  try {
    await fs.access(targetPath);
    return true;
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'ENOENT') {
      return false;
    }
    throw err;
  }
};

export const requireDirectory = async (
  targetPath: string,
  label: string,
  stage: BuildStageId,
): Promise<void> => {
  try {
    const stats = await fs.stat(targetPath);
    if (!stats.isDirectory()) {
      throw new BuildStageError(stage, `${label} is not a directory: ${targetPath}`);
    }
  } catch (err) {
    if (err instanceof BuildStageError) {
      throw err;
    }
    throw new BuildStageError(stage, `${label} is missing: ${targetPath}`, err);
  }
};

export const requireFile = async (
  targetPath: string,
  label: string,
  stage: BuildStageId,
): Promise<void> => {
  try {
    const stats = await fs.stat(targetPath);
    if (!stats.isFile()) {
      throw new BuildStageError(stage, `${label} is not a file: ${targetPath}`);
    }
  } catch (err) {
    if (err instanceof BuildStageError) {
      throw err;
    }
    throw new BuildStageError(stage, `${label} is missing: ${targetPath}`, err);
  }
};

export const removeDir = async (targetPath: string): Promise<void> => {
  await fs.rm(targetPath, { recursive: true, force: true });
};

export const ensureDir = async (targetPath: string): Promise<void> => {
  await fs.mkdir(targetPath, { recursive: true });
};

export const ensureDirs = async (targets: string[]): Promise<void> => {
  for (const target of targets) {
    await ensureDir(target);
  }
};
