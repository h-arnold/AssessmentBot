export type BuildStageId =
  | 'preflight-clean'
  | 'frontend-build'
  | 'frontend-htmlservice-transform'
  | 'backend-copy'
  | 'resolve-jsondb-source'
  | 'jsondb-inline-namespace';

export type BuilderConfig = {
  frontendDir: string;
  backendDir: string;
  buildDir: string;
  jsonDbApp: {
    pinnedSnapshotDir: string;
    sourceFiles: string[];
    publicExports: string[];
  };
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
  jsonDbAppPinnedSnapshotDir: string;
  jsonDbAppSourceFiles: string[];
  jsonDbAppPublicExports: string[];
};

export type PreflightCleanResult = {
  stage: BuildStageId;
  createdDirs: string[];
};

export type FrontendBuildResult = {
  stage: BuildStageId;
  entryHtmlPath: string;
  generatedChunks: string[];
  warnings: string[];
};

export type FrontendHtmlServiceTransformResult = {
  stage: BuildStageId;
  reactAppPath: string;
  inlinedScriptCount: number;
  inlinedStyleCount: number;
};

export type BackendCopyResult = {
  stage: BuildStageId;
  copiedFiles: string[];
};

export type ResolveJsonDbSourceResult = {
  stage: BuildStageId;
  sourceFiles: string[];
};

export type JsonDbInlineNamespaceResult = {
  stage: BuildStageId;
  outputPath: string;
  namespaceSymbol: string;
  exportedApi: string[];
};
