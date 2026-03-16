# AssessmentBot Dev Container

This development container provides a complete development environment for AssessmentBot with all necessary tools and extensions pre-configured.

## Features

### Base Image

- **Node.js**: Latest LTS version via Microsoft's official devcontainer image
- **Git**: Pre-installed for version control

### VS Code Extensions

The following extensions are automatically installed:

- **ESLint** (`dbaeumer.vscode-eslint`) - JavaScript linting
- **Prettier** (`esbenp.prettier-vscode`) - Code formatting
- **SonarLint** (`sonarsource.sonarlint-vscode`) - Code quality and security analysis
- **GitHub Copilot** (`github.copilot` & `github.copilot-chat`) - AI-powered code assistance
- **Markdown All in One** (`yzhang.markdown-all-in-one`) - Markdown support
- **JavaScript Debugger** (`ms-vscode.js-debug`) - Debugging support

### Pre-configured Settings

- **Editor**: Word wrap enabled, format on save with Prettier
- **Git**: Auto-fetch and smart commit enabled
- **Keyboard**: British layout (GB)
- **Copilot**: Configured with project-specific instructions

### Automatic Setup

On container creation:

1. Node.js dependencies are automatically installed via `npm install`
2. Husky git hooks are configured
3. All development tools are ready to use

## Usage

### Opening in VS Code

1. Install the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
2. Open the repository in VS Code
3. Click "Reopen in Container" when prompted, or use Command Palette: "Dev Containers: Reopen in Container"

### Available Commands

Once inside the container, you can use:

```bash
npm test          # Run all tests
npm run test:watch # Run tests in watch mode
npm run lint      # Check code style
npm run lint:fix  # Auto-fix linting issues
npm run format    # Format code with Prettier
```

### Husky Git Hooks

The pre-commit hook automatically:

- Formats staged files with Prettier
- Runs ESLint with auto-fix on JavaScript files

## Customisation

### Adding Extensions

Edit `.devcontainer/devcontainer.json` and add extension IDs to the `extensions` array.

### Modifying Settings

Update the `settings` object in `.devcontainer/devcontainer.json` to change VS Code configuration.

### Adding Additional Tools

Use the `features` section to add additional development tools from the [dev container features library](https://containers.dev/features).

## Troubleshooting

### Container Build Issues

If the container fails to build:

1. Ensure Docker is running
2. Try rebuilding without cache: Command Palette > "Dev Containers: Rebuild Container"

### Extension Issues

If extensions don't load:

1. Check the extension IDs are correct
2. Rebuild the container to refresh extensions

## More Information

- [Dev Containers Documentation](https://containers.dev/)
- [VS Code Dev Containers](https://code.visualstudio.com/docs/devcontainers/containers)
