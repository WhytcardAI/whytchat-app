# Changelog

All notable changes to WhytChat will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.3.2] - 2025-11-18

### ✨ Added
- **Performance test integration**: Test de performance intégré comme Étape 3 dans l'assistant de création de conversation
- **Intelligent model selection**: Sélection automatique du modèle basée sur les capacités matérielles (tier small/medium/large)
- **Smart recommendations**: Matrice 3×7 de recommandations de modèles selon le tier système et le type de template

### 🔧 Changed
- **Native window decorations**: Suppression de la double barre de titre (activation des décorations natives)
- **Improved UX**: Le test de performance fait maintenant partie du flux d'onboarding (plus de bouton séparé)
- **Better auto-selection**: L'assistant prend en compte les résultats du test de performance pour recommander le bon modèle

### 🐛 Fixed
- **Tier display mapping**: Correction de l'affichage des tiers (small→Light, medium→Medium, large→Heavy)
- **Auto-selection logic**: Les systèmes avec 64GB RAM sélectionnent maintenant des modèles heavy (et non plus light)

### 🔒 Security
- **Path traversal fix**: Correction de la vulnérabilité path traversal dans check-i18n.cjs (merged from main)
- **Codacy fixes**: Application des corrections de sécurité et de type safety recommandées par Codacy

---

## [0.3.1] - 2025-01-17

### ✨ Added

#### Automatic Update System
- **In-app update checker**: Automatically checks for updates on startup
- **Update notifications**: Banner notification when new version available
- **Manual update check**: Button in Settings to check for updates anytime
- **Multilingual patch notes**: Release notes displayed in user's language (8 languages)
- **One-click updates**: Download and install updates directly from the app
- **Progress tracking**: Real-time download progress with percentage
- **Secure updates**: Cryptographic signature verification for all releases

#### Release Infrastructure
- **Standardized file naming**: All releases use `WhytChat_vX.X.X.{extension}` format
- **Automated verification**: Pre-build version consistency checks
- **Post-build validation**: Verify all expected files are generated
- **SHA256 checksums**: Automatic checksum generation for all binaries
- **Multi-platform releases**: Simultaneous Windows, Linux, and macOS builds

### 🔧 Changed
- Updated README.md to v0.3.1 with auto-update documentation
- Enhanced release workflow with verification steps
- Improved error handling in update process

### 🐛 Fixed
- Fixed inconsistent release file naming across platforms
- Fixed missing Linux and macOS releases in previous versions

### 🔒 Security
- **Template literals in console.error**: Replaced string concatenation with template literals in `storage.ts` to prevent log injection attacks (5 functions: getStorageItem, setStorageItem, removeStorageItem, getStorageNumber, getStorageBoolean)
- **Type safety improvements**: Enhanced type safety in `i18n.ts` by replacing `any` with `unknown` type and adding proper type guards
- **Nullable boolean handling**: Fixed optional boolean checks in `UpdateNotification.tsx` by adding explicit nullish coalescing (`?? false`) to 4 useEffect hooks

---

## [3.0.0] - Launcher 3.0 - 2025-01-XX

### ✨ Added

#### Multi-Platform Build System (Launcher 3.0)
- **Windows Build Support**:
  - `.msi` installer (Windows Installer) - Enterprise deployment
  - `.exe` installer (NSIS Setup) - Standard installation
  - Automated builds on GitHub Actions with Windows runner

- **Linux Build Support** (NEW):
  - `.deb` package for Debian/Ubuntu distributions
  - `.AppImage` universal Linux package (portable, no installation required)
  - Automated builds on GitHub Actions with Ubuntu runner
  - Required system dependencies: webkit2gtk, libappindicator3, librsvg2, patchelf

- **macOS Build Support** (NEW):
  - `.dmg` disk image installer
  - Universal Binary support (Intel + Apple Silicon in one package)
  - Automated builds on GitHub Actions with macOS runner
  - Minimum system version: macOS 10.13 (High Sierra)

#### GitHub Actions Workflow Improvements
- Multi-platform parallel build system
- Separate jobs for Windows, Linux, and macOS builds
- Centralized release creation with artifacts from all platforms
- Improved artifact upload with proper paths
- Enhanced release notes with platform-specific installation instructions

### 🔧 Changed
- Updated README.md with multi-platform installation instructions
- Updated CONTRIBUTING.md with platform-specific build requirements
- Renamed workflow from "Release Windows" to "Release Multi-Platform"

### 📚 Documentation
- Added platform-specific prerequisites for development
- Added build instructions for all supported platforms
- Added universal binary build instructions for macOS

---

## [0.2.1] - 2025-01-XX

### ✨ Added

#### Dynamic Parameters System
- **6 Conversation Types** with specialized parameters:
  - General: Basic chat with tone, language, style controls
  - Coding: Programming assistance with language, framework, level parameters
  - Learning: Educational conversations with subject, level, format options
  - Writing: Content creation with type, style, audience parameters
  - Brainstorm: Creative ideation with depth, approach, output format
  - Analysis: Deep analysis with depth, scope, format controls
- **26 Total Parameters** distributed across conversation types
- **Dynamic UI**: Parameter selection adapts to conversation type
- **Model Filtering**: Only compatible models shown per conversation type

#### AI Models (10 Total)
- **Light Tier** (3-4GB RAM):
  - Qwen2.5 Coder 1.5B Instruct (1GB, Q8 quantization)
  - Llama 3.2 3B Instruct (2GB, Q5_K_M quantization)
- **Balanced Tier** (6GB RAM):
  - Mistral 7B Instruct v0.2 (Q5_K_M)
  - Qwen2.5 Coder 7B Instruct (Q4_K_M)
  - OpenHermes 2.5 Mistral 7B (Q4_K_M)
  - Nous Hermes 2 Mistral 7B (Q4_K_M)
- **Heavy Tier** (8-12GB RAM):
  - Llama 3.1 8B Instruct (Q5_K_M)
  - Qwen2.5 Coder 14B Instruct (Q4_K_M)
  - WizardLM 2 7B (Q8_0)
  - Dolphin 2.9.2 Llama 3.1 8B (Q5_K_M)

#### Internationalization
- **8 Languages**: French (FR), English (EN), Spanish (ES), German (DE), Italian (IT), Portuguese (PT), Dutch (NL), Polish (PL)
- Complete UI translations for all features
- Dynamic language switching without restart

#### Developer Experience
- **GitHub Actions CI/CD**: Automated builds on version tags
- **Automated Releases**: Windows executables and MSI installers
- **Build Optimization**: Code splitting and compression
- Comprehensive documentation (README, deployment guides)

### 🐛 Fixed

- **Critical**: "Brainstorm" and "Analysis" conversation types had 0 models assigned
  - Added 3 models to each type
  - Llama 3.2 3B, Nous Hermes, Dolphin now support brainstorm
  - Mistral, Llama 3.1 8B, WizardLM now support analysis
- Model selection not filtering by conversation type
- Parameter UI not updating when switching conversation types
- Translation keys missing for new parameters

### 🔧 Changed

- **Architecture**: Migrated from static to dynamic parameter system
- **UX**: Parameter selection now contextual to conversation type
- **Performance**: Lazy loading for model downloads
- **Build**: Optimized bundle size with code splitting

### 📚 Documentation

- Complete README.md rewrite with feature showcase
- New DEPLOY_GUIDE.md for GitHub deployment
- New CHECKLIST_DEPLOYMENT.md with step-by-step instructions
- Updated build guides with Rust/Node.js prerequisites
- Added troubleshooting section

### 🚧 Technical Debt

- Hardcoded parameter values (will be user-customizable in v0.3.0)
- No parameter persistence across sessions
- Model downloads not resumable on error

---

## [0.2.0] - 2025-01-XX (Initial Version)

### ✨ Added

#### Core Features
- **Llama.cpp Integration**: Local AI model execution
- **6 Conversation Types**: General, Coding, Learning, Writing, Brainstorm, Analysis
- **Local-First**: All data stored in SQLite database
- **Privacy**: No cloud services, 100% offline
- **Multilingual**: French and English UI

#### Models
- Initial support for 4 models:
  - Mistral 7B Instruct
  - Llama 3.1 8B Instruct
  - Qwen2.5 Coder 7B
  - Phi-3 Mini 3.8B

#### UI/UX
- Dark/Light theme toggle
- Conversation history sidebar
- Markdown rendering for responses
- Code syntax highlighting
- Copy code button
- Regenerate response functionality

#### Technical
- **Tauri v2**: Rust + React architecture
- **TypeScript**: Type-safe frontend
- **Vite**: Fast HMR and builds
- **SQLite**: Embedded database
- **i18next**: Internationalization framework

### 🔧 Configuration
- Customizable server port
- Model path configuration
- Context window settings
- Temperature and top_p controls

---

## Roadmap

### [0.3.0] - Q2 2025 (Planned)

- [ ] **RAG (Retrieval-Augmented Generation)**: Document upload and context injection
- [ ] **Plugin System**: Extensible architecture for custom tools
- [ ] **User-Customizable Parameters**: Save and manage parameter presets
- [ ] **Conversation Export**: Markdown, PDF, HTML formats
- [ ] **Model Hub**: In-app model discovery and download
- [ ] **Performance Metrics**: Token/s, response time, memory usage
- [ ] **Conversation Search**: Full-text search across all messages
- [ ] **Themes**: Customizable color schemes

### [0.4.0] - Q3 2025 (Planned)

- [ ] **Voice Input/Output**: Speech-to-text and TTS
- [ ] **Multi-Model Conversations**: Compare responses from different models
- [ ] **Fine-Tuning Support**: Custom model training
- [ ] **API Mode**: REST API for external integrations
- [ ] **Mobile Apps**: iOS and Android versions
- [ ] **Cloud Sync**: Optional encrypted backup
- [ ] **Collaborative Conversations**: Multi-user sessions

---

## Version Support

| Version | Release Date | Support Status | Download Link |
|---------|-------------|----------------|---------------|
| 0.2.1   | 2025-01-XX  | ✅ Current     | [Latest](https://github.com/WhytcardAI/WhytChat02/releases/latest) |
| 0.2.0   | 2025-01-XX  | ⚠️ Deprecated  | [v0.2.0](https://github.com/WhytcardAI/WhytChat02/releases/tag/v0.2.0) |

---

## Migration Guides

### From v0.2.0 to v0.2.1

**Breaking Changes:**
- None (fully backward compatible)

**Data Migration:**
- Existing conversations will work without changes
- New conversation types (brainstorm, analysis) available immediately
- Models will re-download with updated configurations

**Steps:**
1. Download WhytChat v0.2.1
2. Install (will upgrade existing installation)
3. Launch app
4. Previous conversations will appear in sidebar
5. New conversation types available in "New Conversation"

**What to Expect:**
- All data preserved in `data/whytchat.db`
- Model files reused from `models/` directory
- Settings preserved
- New parameter options in conversation creation

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:
- Reporting bugs
- Suggesting features
- Submitting pull requests
- Development setup

---

## License

WhytChat is licensed under the [MIT License](LICENSE).

Copyright (c) 2025 Whytcard

---

## Acknowledgments

- [Llama.cpp](https://github.com/ggerganov/llama.cpp) - Local LLM inference
- [Tauri](https://tauri.app/) - Desktop app framework
- [React](https://react.dev/) - UI library
- [Hugging Face](https://huggingface.co/) - Model hosting
- All contributors and testers

---

**For the full release notes, visit [GitHub Releases](https://github.com/WhytcardAI/WhytChat02/releases).**
