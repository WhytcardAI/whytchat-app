# Copilot Instructions for WhytChat

## Project Overview

WhytChat is a 100% private AI chat desktop application built with Tauri v2, React 18, TypeScript, and Rust. All conversations run locally using llama.cpp - no data is ever sent to external servers.

**Version**: 0.3.1  
**Tech Stack**: Tauri v2 + React 18 + TypeScript + Rust + SQLite + llama.cpp  
**Architecture**: Hybrid (Rust backend, React frontend)  
**i18n**: Custom implementation with 8 languages (canonical: English)

## Repository Structure

```
whytchat-app/
├── .github/              # Workflows, issue templates, documentation
├── src/                  # React TypeScript frontend
│   ├── components/       # UI components (Chat, Settings, Models, etc.)
│   ├── contexts/         # React contexts (Theme, Server)
│   ├── locales/          # i18n JSON files (8 languages)
│   └── utils/            # Storage, error handling utilities
├── src-tauri/            # Rust backend
│   ├── src/
│   │   ├── main.rs       # Tauri commands and app setup
│   │   ├── db.rs         # SQLite database operations
│   │   └── llama.rs      # llama-server process management
│   ├── capabilities/     # Tauri v2 permission definitions
│   └── presets.json      # AI model preset configurations
├── scripts/              # Build and validation scripts
├── docs/                 # Additional documentation
└── models/               # GGUF model files (runtime)
```

## Coding Standards

### TypeScript/React (Frontend)

- **Strict TypeScript**: Use strict mode, avoid `any` types
- **Functional Components**: Use hooks, not class components
- **Props Interface**: Define explicit interfaces for all component props
- **Error Handling**: Use ErrorBoundary for component errors
- **Naming Conventions**:
  - Components: PascalCase (`ChatView.tsx`)
  - Hooks: camelCase with `use` prefix (`useServerStatus`)
  - Utilities: camelCase (`formatDate.ts`)
  - Constants: UPPER_SNAKE_CASE
- **Styling**: Tailwind CSS classes only, follow dark mode conventions
- **State Management**: React Context for global state, useState for local

### Rust (Backend)

- **Error Handling**: Use `Result<T, E>` types, proper error propagation
- **Async/Await**: Use tokio for async operations
- **Tauri Commands**: All commands return `Result<T, String>`
- **Database**: SQLite with rusqlite, WAL mode enabled
- **Naming Conventions**:
  - Functions: snake_case
  - Structs: PascalCase
  - Constants: UPPER_SNAKE_CASE
- **Safety**: Avoid unsafe code unless absolutely necessary

## Build & Development

### Scripts

```bash
npm run dev              # Vite dev server only
npm run tauri            # Full Tauri dev with hot reload
npm run build            # Production frontend build
npm run tauri:build      # Complete Tauri app build
npm run check:lint       # ESLint check (no auto-fix)
npm run lint:fix         # ESLint with auto-fix
npm run format           # Prettier formatting
npm run check:i18n       # Validate i18n completeness
npm run check:version    # Validate version consistency
```

### Before Committing

**Required checks:**

1. `npm run check:lint` - Must pass without errors
2. `npm run check:i18n` - Ensure all translations are complete
3. `npm run format:check` - Verify code formatting

### Testing Philosophy

- Manual testing is primary (desktop app with native integrations)
- Test critical paths: conversation creation, model loading, server management
- Verify cross-platform compatibility when possible
- Test i18n by switching languages in settings

## i18n Requirements

### Critical Rules

1. **English is canonical**: All new keys must exist in `en.json` first
2. **Run check before commit**: `npm run check:i18n` must pass
3. **Translation structure**: Nested JSON keys (e.g., `chat.sendButton`, `settings.models.title`)
4. **Fallback chain**: Missing key → English → empty string
5. **8 languages**: fr, en, de, es, it, pt, nl, pl (maintain all when adding keys)

### Adding New Translations

```typescript
// 1. Add key to src/locales/en.json (canonical)
{
  "newFeature": {
    "title": "My Feature",
    "description": "This is a new feature"
  }
}

// 2. Add to all other language files (fr, de, es, it, pt, nl, pl)
// 3. Use in code:
import { i18n } from "./i18n";
const title = i18n.t("newFeature.title");

// 4. Verify: npm run check:i18n
```

## Security & Privacy

### Non-Negotiable Rules

1. **No telemetry**: Never add tracking, analytics, or external API calls
2. **Offline-first**: All AI processing must remain local
3. **No credentials**: Never require API keys or cloud accounts
4. **Data privacy**: Conversations stay in local SQLite database
5. **Tauri permissions**: Use explicit capabilities in `capabilities/` directory
6. **Input validation**: Sanitize all user inputs in Tauri commands
7. **Signed builds**: Production builds must be cryptographically signed

### Tauri v2 Permissions

When adding new Tauri commands:

1. Define command in `src-tauri/src/main.rs`
2. Add capability definition in `src-tauri/capabilities/`
3. Use minimal permissions (deny by default)
4. Document permission requirements in PR

## Common Tasks

### Adding a New UI Component

1. Create component in `src/components/ComponentName.tsx`
2. Define props interface: `interface ComponentNameProps { ... }`
3. Use Tailwind classes for styling (respect dark mode)
4. Import and use i18n for all text: `i18n.t("key")`
5. Handle errors with try-catch or ErrorBoundary
6. Export from component file

### Adding a New Tauri Command

1. Define Rust function in appropriate file (`main.rs`, `db.rs`, `llama.rs`)
2. Annotate with `#[tauri::command]`
3. Return `Result<T, String>` for error handling
4. Add to `.invoke_handler()` in `main.rs`
5. Update capabilities if new permissions needed
6. Call from frontend: `await invoke("command_name", { args })`

### Adding a New Database Table

1. Update schema in `src-tauri/src/db.rs`
2. Create migration logic (app uses create-if-not-exists)
3. Add CRUD commands as Tauri commands
4. Use WAL mode for concurrent access
5. Add proper foreign keys and constraints

### Adding a New i18n Key

1. Add to `src/locales/en.json` first (canonical)
2. Translate and add to all 7 other language files
3. Use nested structure for organization
4. Run `npm run check:i18n` to verify
5. Use in code: `i18n.t("your.new.key")`

## Model & Preset System

- **Presets**: Defined in `src-tauri/presets.json`
- **Model Files**: GGUF format in `models/` directory
- **Server Binary**: `llama-bin/llama-server` (platform-specific)
- **Model Loading**: Handled by `ServerContext` in `src/contexts/ServerContext.tsx`
- **Parameters**: temperature, top_p, max_tokens, repeat_penalty (per conversation)

## Contribution Workflow

1. **Branch naming**:
   - Features: `feat/feature-name`
   - Fixes: `fix/issue-description`
   - Docs: `docs/what-changed`
   - CI tests: `ci/workflow-name`

2. **Commit messages**: Follow conventional commits
   - `feat: add new feature`
   - `fix: resolve bug`
   - `docs: update readme`
   - `refactor: improve code structure`

3. **PR requirements**:
   - Target `main` branch
   - Pass linting: `npm run check:lint`
   - Pass i18n check: `npm run check:i18n`
   - Update CHANGELOG.md if user-facing
   - Include screenshots for UI changes
   - Test cross-platform when possible

4. **Code Review**: All PRs require review before merge

## Documentation

- **README.md**: User-facing documentation, installation, usage
- **ARCHITECTURE.md**: Technical implementation details, file responsibilities
- **CONTRIBUTING.md**: Contribution guidelines, setup instructions
- **SECURITY.md**: Security policy and vulnerability reporting
- **CHANGELOG.md**: Version history (keep updated)

## Platform-Specific Considerations

### Windows

- Installers: NSIS (.exe) and WiX (.msi)
- Test with Windows Defender enabled
- Verify clickthrough/overlay features

### Linux

- Packages: DEB and AppImage
- Test with common desktop environments (GNOME, KDE)
- Verify permissions (file dialogs, etc.)

### macOS

- Universal binary (Intel + Apple Silicon)
- DMG installer
- Test permission prompts (code signing)

## Best Practices for Copilot

1. **Understand before changing**: Review related files and context
2. **Minimal changes**: Modify only what's necessary for the task
3. **Follow patterns**: Match existing code style and structure
4. **Test changes**: Run dev server and verify functionality
5. **i18n first**: Always add translations when adding UI text
6. **Security mindful**: Consider privacy and local-only requirements
7. **Document decisions**: Add comments for non-obvious logic
8. **Version consistency**: Update package.json and Cargo.toml together

## Common Gotchas

- **i18n**: Always use `i18n.t()` for user-facing text, never hardcode
- **Theme**: Support both light and dark modes in all UI components
- **Server state**: Always check server status before making requests
- **Error handling**: Display user-friendly messages in correct language
- **File paths**: Use Tauri path APIs for cross-platform compatibility
- **Model paths**: Store relative to app data directory
- **Database**: Always use parameterized queries (prevent SQL injection)
- **Async**: Properly handle promises and async Tauri commands

## Performance Considerations

- **Model loading**: Happens in background, show loading states
- **Database queries**: Use indexes for frequently queried columns
- **Message streaming**: Use streamdown for token-by-token display
- **Memory**: Monitor memory usage with large models (3B-14B parameters)
- **Concurrent access**: SQLite WAL mode handles multiple readers

## Resources

- [Tauri v2 Documentation](https://v2.tauri.app)
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Rust Book](https://doc.rust-lang.org/book/)
- [llama.cpp](https://github.com/ggerganov/llama.cpp)
