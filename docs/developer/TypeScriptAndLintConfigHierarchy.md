# TypeScript and ESLint Configuration Hierarchy

This project uses a shared configuration tree so TypeScript and linting standards remain consistent across frontend and builder code, while still allowing environment-specific settings.

## Why this exists

- Keep one source of truth for strictness and quality standards.
- Avoid drift between frontend and builder defaults.
- Isolate runtime-specific settings (browser vs Node.js) to leaf configs.

## TypeScript hierarchy

### 1) Single global base

- `tsconfig.base.json`
- Defines shared language and safety defaults used everywhere:
  - `target`
  - `strict`
  - `noUnusedLocals`
  - `noUnusedParameters`
  - `forceConsistentCasingInFileNames`
  - `skipLibCheck`
  - `noFallthroughCasesInSwitch`
  - `noUncheckedSideEffectImports`
  - `erasableSyntaxOnly`

### 2) Component leaf configs

- `src/frontend/tsconfig.app.json`
  - Extends `../../tsconfig.base.json`.
  - Adds frontend app specifics only: DOM libs, JSX, Vite/Vitest types, app include paths.
- `src/frontend/tsconfig.node.json`
  - Extends `../../tsconfig.base.json`.
  - Adds frontend tooling specifics only: include for `vite.config.ts`, build info path.
- `scripts/builder/tsconfig.json`
  - Extends `../../tsconfig.base.json`.
  - Adds builder specifics only: `rootDir`, `outDir`, JSON module resolution, include paths.

## ESLint hierarchy

### 1) Shared TypeScript rule base

- `config/eslint/ts-base-rules.cjs`
- Contains cross-component TypeScript lint standards:
  - Complexity limit
  - JSDoc requirement baseline
  - Magic number policy
  - Consistent type imports

### 2) Component ESLint configs

- `src/frontend/eslint.config.js`
  - Imports shared TS base rules.
  - Adds frontend-only rules/plugins (React hooks, Vite React refresh, browser globals).
- `scripts/builder/eslint.config.js`
  - Imports shared TS base rules.
  - Adds builder-only parser/project context for Node-side TypeScript files.
- `eslint.config.js` (repo root)
  - Remains focused on existing backend GAS JavaScript linting rules.
  - Does not replace frontend/builder TypeScript lint configs.

## Change policy

When updating TypeScript or lint standards:

1. Update root shared base first (`tsconfig.base.json` or `config/eslint/ts-base-rules.cjs`) when the rule is intended to apply across components.
2. Update leaf config only for runtime- or component-specific behaviour.
3. Run affected validation commands:
   - `npm run builder:build`
   - `npm run builder:lint`
   - `npm run frontend:build`
   - `npm run frontend:lint`

If a proposed change does not clearly belong to a specific runtime, prefer placing it in a shared root config.
