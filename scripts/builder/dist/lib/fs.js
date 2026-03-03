import { promises as fs } from 'node:fs';
import { BuildStageError } from './errors.js';
export const pathExists = async (targetPath) => {
    try {
        await fs.access(targetPath);
        return true;
    }
    catch (err) {
        const error = err;
        if (error.code === 'ENOENT') {
            return false;
        }
        throw err;
    }
};
export const requireDirectory = async (targetPath, label, stage) => {
    try {
        const stats = await fs.stat(targetPath);
        if (!stats.isDirectory()) {
            throw new BuildStageError(stage, `${label} is not a directory: ${targetPath}`);
        }
    }
    catch (err) {
        if (err instanceof BuildStageError) {
            throw err;
        }
        throw new BuildStageError(stage, `${label} is missing: ${targetPath}`, err);
    }
};
export const requireFile = async (targetPath, label, stage) => {
    try {
        const stats = await fs.stat(targetPath);
        if (!stats.isFile()) {
            throw new BuildStageError(stage, `${label} is not a file: ${targetPath}`);
        }
    }
    catch (err) {
        if (err instanceof BuildStageError) {
            throw err;
        }
        throw new BuildStageError(stage, `${label} is missing: ${targetPath}`, err);
    }
};
export const removeDir = async (targetPath) => {
    await fs.rm(targetPath, { recursive: true, force: true });
};
export const ensureDir = async (targetPath) => {
    await fs.mkdir(targetPath, { recursive: true });
};
export const ensureDirs = async (targets) => {
    for (const target of targets) {
        await ensureDir(target);
    }
};
