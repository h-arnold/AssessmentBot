# Contributing

Thank you for considering contributing to AssessmentBot! Contributions of all kinds are welcome.

---

## Codebase Overview

AssessmentBot has three active modules, each with its own runtime, language, and standards:

| Module   | Path               | Runtime                | Language                  |
| -------- | ------------------ | ---------------------- | ------------------------- |
| Backend  | `src/backend/`     | Google Apps Script V8  | GAS-compatible JavaScript |
| Frontend | `src/frontend/`    | Browser (Vite + React) | TypeScript                |
| Builder  | `scripts/builder/` | Node.js                | TypeScript                |

Each module has a detailed `AGENTS.md` that describes its conventions and constraints. Read the relevant one before working in that area:

- [src/backend/AGENTS.md](src/backend/AGENTS.md)
- [src/frontend/AGENTS.md](src/frontend/AGENTS.md)
- [scripts/builder/AGENTS.md](scripts/builder/AGENTS.md)
- [AGENTS.md](AGENTS.md) — cross-component rules

Detailed developer documentation lives under [docs/developer/](docs/developer/).

---

## Getting Started

```bash
# Install all root dependencies (also installs Husky git hooks)
npm install

# Install frontend dependencies
npm --prefix src/frontend install
```

---

## Running Tests

### Backend (tests at repo root)

```bash
npm run test:backend            # backend GAS JavaScript tests
npm run test:backend:coverage   # with coverage
```

### Frontend

```bash
npm run test:frontend
npm run test:frontend:coverage
npm run test:frontend:e2e   # Playwright end-to-end tests
```

### Builder

```bash
npm run test:builder
npm run test:builder:coverage
```

---

## Linting and Type Checking

Style and most code quality rules are enforced automatically by ESLint and CI. Run checks locally before pushing:

```bash
npm run lint:backend      # backend GAS JavaScript
npm run lint:frontend     # frontend TypeScript/React
npm run lint:builder      # builder TypeScript
npm run lint:synthetic    # synthetic test-data scripts
```

Run every scope at once with `npm run lint`.

These commands pass `--fix` and rewrite files. To check without modifying anything, use the matching `:check` variants (`npm run lint:backend:check`, `npm run lint:frontend:check`, `npm run lint:builder:check`, `npm run lint:synthetic:check`) or `npm run lint:check` for every scope at once.

TypeScript compile checks:

```bash
npm run build:frontend    # frontend TypeScript build and Vite bundle
npm run builder:compile   # builder TypeScript compile
```

The backend CI job uses `npm run lint:backend:errors-only`. This intentionally allows the
following ten existing `max-lines` warnings while still failing on every ESLint error:

- `src/backend/DocumentParsers/SlidesParser.js`
- `src/backend/GoogleDriveManager/DriveManager.js`
- `tests/assignment/assignmentFactory.test.js`
- `tests/backend-api/assignmentDefinitionPartials.unit.test.js`
- `tests/controllers/abclassController.readClass.test.js`
- `tests/controllers/assignmentController.hydration.test.js`
- `tests/controllers/referenceDataController.test.js`
- `tests/dbManager/dbManager.test.js`
- `tests/googleClassroom/classroomApiClient.test.js`
- `tests/utils/batchUpdateUtility.test.js`

This temporary errors-only check remains in place until these ten large files have been
refactored and the warnings can be removed without creating false positives.

### Full Check Suite

Run the complete check suite (lint, tests with coverage, and production build):

```bash
npm run run-all-checks
```

This is useful for verifying everything before committing or pushing changes.

---

## Core Principles

Most formatting rules are enforced by the linter. These are the things it cannot catch:

- **British English** in all code comments, identifiers, and user-facing text (e.g. `colour`, `initialise`, `serialise`).
- **KISS** — implement the simplest working solution. No speculative abstractions.
- **Fail fast** — never swallow errors silently. No empty `catch` blocks. No `console.*`.
- **No defaults unless instructed** — do not introduce default parameter values unless the task explicitly requires them.
- **No scope creep** — only fulfil what was explicitly asked.

---

## Error Handling (Backend)

Backend code follows a two-channel logging contract:

- **User-facing errors**: `ProgressTracker.getInstance().logError(message, { err })`
- **Developer diagnostics**: `ABLogger.getInstance().error/warn/info(...)`

Do not duplicate the same error details in both. Log and rethrow at top-level boundaries. Never use `console.*`.

```javascript
try {
  // core logic
} catch (err) {
  ProgressTracker.getInstance().logError('Readable user message', { err });
  ABLogger.getInstance().error('Contextual dev message', err);
  throw err;
}
```

---

## Writing Backend Tests

Backend tests run in Node via Vitest and must not depend on live GAS services. Many backend classes call GAS globals in their constructors, which will throw in a Node environment.

**Prefer rehydration over construction:**

```javascript
// Bad: constructor may call GAS services
// const a = new Assignment('courseId', 'assignmentId');

// Good: restores state without invoking the constructor
const a = Assignment.fromJSON({ courseId: 'c1', assignmentId: 'as1' });
```

If a class has no `fromJSON()` method and you need constructor behaviour, mock the required globals in your test setup file, or refactor the constructor to separate the side-effecting logic. See [docs/developer/backend/rehydration.md](docs/developer/backend/rehydration.md) and [docs/developer/backend/backend-testing.md](docs/developer/backend/backend-testing.md) for more detail.

---

## Pre-Submission Checklist

- [ ] All relevant lint checks pass (`npm run lint:check` runs every scope without modifying files)
- [ ] TypeScript compiles cleanly (frontend and builder)
- [ ] Tests pass and new logic has test coverage
- [ ] No `console.*` calls introduced
- [ ] No eager heavy work in top-level scope (no Drive/Properties/Classroom access during file load or construction)
- [ ] Singletons accessed via `Class.getInstance()`, never `new Class()`
- [ ] British English used throughout
- [ ] `docs/developer/` updated if the change affects documented behaviour

---

## Submitting a Pull Request

1. Fork the repository and clone it locally.
2. Create a branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```
3. Make your changes, run the checks above, and commit.
4. Open a pull request with a clear description of what changed and why.

---

## Git Hooks (Husky)

`npm install` installs a `pre-commit` hook that formats and lints staged files (Prettier, then ESLint with the per-component config) and runs the builder TypeScript compile check. Node.js v18 or later is required.

To reinstall hooks manually:

```bash
npx husky
```
