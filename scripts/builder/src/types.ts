export type BuildStageId = 'preflight-clean';

export type BuilderConfig = {
  frontendDir: string;
  backendDir: string;
  buildDir: string;
};

export type BuilderPaths = {
  repoRoot: string;
  builderRoot: string;
  configPath: string;
  frontendDir: string;
  backendDir: string;
  buildDir: string;
  buildFrontendDir: string;
  buildWorkDir: string;
  buildGasDir: string;
  buildGasUiDir: string;
};

export type PreflightCleanResult = {
  stage: BuildStageId;
  createdDirs: string[];
};
