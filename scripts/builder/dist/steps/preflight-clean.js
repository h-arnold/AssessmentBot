import { ensureDirs, removeDir, requireDirectory, requireFile } from '../lib/fs.js';
const STAGE_ID = 'preflight-clean';
export const runPreflightClean = async (paths) => {
    await requireDirectory(paths.frontendDir, 'src/frontend', STAGE_ID);
    await requireDirectory(paths.backendDir, 'src/backend', STAGE_ID);
    await requireFile(paths.configPath, 'builder config', STAGE_ID);
    await removeDir(paths.buildDir);
    const dirsToCreate = [
        paths.buildDir,
        paths.buildFrontendDir,
        paths.buildWorkDir,
        paths.buildGasDir,
        paths.buildGasUiDir,
    ];
    await ensureDirs(dirsToCreate);
    return {
        stage: STAGE_ID,
        createdDirs: dirsToCreate,
    };
};
