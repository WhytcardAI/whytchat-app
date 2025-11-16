# Contributing to WhytChat

First off, thank you for considering contributing to WhytChat! It's people like you that make WhytChat such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Important Documentation

Before contributing, please review:

- **[Branch Policy](docs/branch-policy.md)** - Branch management and CI strategy
- **[CI/CD Strategy](docs/ci-strategy.md)** - Workflow details and best practices

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* **Use a clear and descriptive title**
* **Describe the exact steps which reproduce the problem**
* **Provide specific examples to demonstrate the steps**
* **Describe the behavior you observed after following the steps**
* **Explain which behavior you expected to see instead and why**
* **Include screenshots if possible**
* **Include your environment details** (OS, WhytChat version, llama.cpp version)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

* **Use a clear and descriptive title**
* **Provide a step-by-step description of the suggested enhancement**
* **Provide specific examples to demonstrate the steps**
* **Describe the current behavior** and **explain which behavior you expected to see instead**
* **Explain why this enhancement would be useful**

### Pull Requests

**Important**: All PRs should target the `main` branch. See [Branch Policy](docs/branch-policy.md) for details.

* Fill in the required template
* Do not include issue numbers in the PR title
* Follow the coding style (TypeScript/Rust)
* Include thoughtful comments in your code
* Write tests when applicable
* End all files with a newline
* Avoid platform-dependent code
* Use proper branch naming conventions (see Branch Policy)
* Test CI changes using `ci/**` branches

## Development Setup

### Prerequisites

```bash
# Required
- Node.js >= 18
- Rust >= 1.70
- Platform-specific dependencies (see below)

# Optional
- Visual Studio Code
- Rust Analyzer extension
```

#### Platform-Specific Dependencies

**Windows**
- No additional dependencies required

**Linux (Ubuntu/Debian)**
```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf \
  libssl-dev
```

**macOS**
- Xcode Command Line Tools: `xcode-select --install`
- For universal binary builds:
  ```bash
  rustup target add aarch64-apple-darwin x86_64-apple-darwin
  ```

### Setup Steps

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/WhytChat02.git
cd WhytChat02

# Install dependencies
npm install

# Run in development mode
npm run tauri

# Run linters
npm run check:lint          # TypeScript ESLint
cargo clippy --all-targets   # Rust Clippy (in src-tauri/)

# Run build
npm run build
```

### Building for Production

```bash
# Build for your current platform
npm run tauri:build

# Platform-specific outputs:
# Windows: .msi and .exe in src-tauri/target/release/bundle/
# Linux: .deb and .AppImage in src-tauri/target/release/bundle/
# macOS: .dmg in src-tauri/target/release/bundle/

# macOS Universal Binary (Intel + Apple Silicon)
npm run tauri:build -- --target universal-apple-darwin
```

### Coding Standards

#### TypeScript/React
- Use functional components with hooks
- Prefer `const` over `let`, avoid `var`
- Use TypeScript types, avoid `any` when possible
- Follow existing code formatting (Prettier)
- Write descriptive variable/function names

#### Rust
- Follow `cargo clippy` recommendations
- Avoid `.unwrap()`, use proper error handling
- Document public functions with `///` comments
- Keep functions focused and small
- Use meaningful variable names

#### Git Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally after the first line

Examples:
```
Add support for custom model paths
Fix server crash when model file is missing
Update README with installation instructions
```

### Project Structure

```
WhytChat/
├── src/                    # React TypeScript frontend
│   ├── components/         # UI components
│   ├── contexts/           # React contexts
│   ├── locales/            # i18n translations (8 languages)
│   └── utils/              # Utility functions
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs         # Tauri commands
│   │   ├── db.rs           # SQLite operations
│   │   ├── llama.rs        # llama-server communication
│   │   └── llama_install.rs # Binary installation
│   └── capabilities/       # Tauri v2 permissions
├── models/                 # User-downloaded GGUF models
├── llama-bin/              # llama-server executable
└── data/                   # SQLite database
```

### Testing

```bash
# Frontend tests (when available)
npm test

# Rust tests
cd src-tauri
cargo test

# Manual testing checklist
- [ ] Create a new conversation
- [ ] Download a model
- [ ] Send a message and receive response
- [ ] Delete a conversation
- [ ] Test overlay mode (F10)
- [ ] Test keyboard shortcuts
- [ ] Test language switching
```

## Translation Contributions

We support 8 languages: EN, FR, DE, ES, IT, PT, NL, PL.

To add/update translations:

1. Edit files in `src/locales/[lang].json`
2. Keep the JSON structure identical across all languages
3. Test the translation in the app by changing language in Settings

## GitHub Copilot

This repository supports GitHub Copilot coding agent with custom instructions. If you're a maintainer assigning issues to `@copilot`, the agent will follow the guidelines in `.github/copilot-instructions.md`.

For best results when creating issues for Copilot:
- Provide clear, specific requirements
- Include acceptance criteria
- Reference relevant files or components
- Specify any constraints or requirements

## Questions?

Feel free to open an issue with the `question` label, or reach out to the maintainers.

Thank you for your contributions! 🚀
