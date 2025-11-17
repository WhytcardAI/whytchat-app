# WhytChat v0.3.1

**🔒 100% Private AI Chat Desktop Application**

WhytChat est une application de chat IA sécurisée et hors ligne, construite avec Tauri v2, React et llama.cpp. Toutes vos conversations restent sur votre machine-aucune donnée n'est jamais envoyée à des serveurs externes.

[![Download Latest Release](https://img.shields.io/badge/Download-Latest%20Release-blue?style=for-the-badge)](https://github.com/WhytcardAI/whytchat-app/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/YOUR_PROJECT_ID)](https://www.codacy.com/gh/WhytcardAI/whytchat-app)
[![Quality Gate](https://img.shields.io/badge/code%20quality-automated-brightgreen)](https://github.com/WhytcardAI/whytchat-app)

---

## ✨ Nouvelles Fonctionnalités v0.3.1

### 🔄 Système de Mise à Jour Automatique

- **Notifications de mise à jour intégrées** - Soyez informé lorsque de nouvelles versions sont disponibles
- **Mises à jour en un clic** - Téléchargez et installez les mises à jour directement depuis l'application
- **Notes de version multilingues** - Consultez les notes de version dans votre langue (8 langues supportées)
- **Option de vérification manuelle** - Vérifiez les mises à jour à tout moment depuis les Paramètres
- **Mises à jour sécurisées** - Versions signées cryptographiquement pour la sécurité

### 🛍️ Support & Donations (v0.2.9)

- **Boutique intégrée** avec 3 niveaux de don (Coffee ☕, Happiness 🌟, Hope 🚀)
- Support du projet via Stripe sécurisé
- Page dédiée accessible depuis le menu principal

## 🎯 Fonctionnalités v0.2.1

### 🎯 Système de Paramètres Dynamiques

- **6 types de conversation** avec paramètres personnalisés :
  - 💬 **General** - Discussion générale (Tone : 7 options)
  - 💻 **Coding** - Développement (Language : 10 langages + Style : 4 options)
  - 📚 **Learning** - Apprentissage (Level : 3 niveaux + Style : 4 options)
  - ✍️ **Writing** - Écriture (Type : 6 formats + Tone : 5 styles)
  - 💡 **Brainstorm** - Idéation (Type : 4 approches + Format : 4 structures)
  - 📊 **Analysis** - Analyse (Depth : 3 profondeurs + Format : 3 présentations)

### 🤖 10 Modèles IA Optimisés

- **Light** (3-4GB RAM) : Llama 3.2 3B, Qwen Coder 1.5B
- **Balanced** (6GB RAM) : Mistral 7B, Qwen Coder 7B, OpenHermes 7B, Nous Hermes 7B
- **Heavy** (8-12GB RAM) : Llama 3.1 8B, WizardLM 7B, Dolphin 7B, Qwen Coder 14B

### 🌍 Support Multilingue Complet

8 langues : **Français**, English, Español, Deutsch, Italiano, Português, Nederlands, Polski

---

## 🚀 Installation Rapide

### Télécharger l'Application

**Windows**

- **[EXE Installer](https://github.com/WhytcardAI/whytchat-app/releases/latest)** - Installation classique (NSIS)
- **[MSI Installer](https://github.com/WhytcardAI/whytchat-app/releases/latest)** - Déploiement entreprise (recommandé)

**Linux**

- **[AppImage](https://github.com/WhytcardAI/whytchat-app/releases/latest)** - Universal Linux package (recommandé)
- **[DEB Package](https://github.com/WhytcardAI/whytchat-app/releases/latest)** - Debian/Ubuntu

**macOS**

- **[DMG Installer](https://github.com/WhytcardAI/whytchat-app/releases/latest)** - macOS Disk Image (Universal Binary: Intel + Apple Silicon)

Ou visitez la [page des releases](https://github.com/WhytcardAI/whytchat-app/releases/latest) pour toutes les versions

### Build for Production

```bash
# Install dependencies
npm ci

# Build optimized frontend bundle
npm run build

# Build Tauri app for your platform
npm run tauri:build

# Build for specific platforms (requires appropriate OS):
# Windows: Builds .msi and .exe installers
# Linux: Builds .deb and .AppImage packages
# macOS: Builds universal .dmg (Intel + Apple Silicon)
```

## 📁 Project Structure

```
WhytChat/
├── .github/              # Workflows, KB, documentation
├── src/                  # React TypeScript source
│   ├── components/       # UI components (Chat, Settings, etc.)
│   ├── contexts/         # React contexts (Theme, Server)
│   ├── locales/          # i18n translations (8 languages)
│   └── utils/            # Storage, error handling
├── src-tauri/            # Rust backend
│   ├── src/
│   │   ├── main.rs       # Tauri commands
│   │   ├── db.rs         # SQLite operations
│   │   └── llama.rs      # llama-server management
│   └── capabilities/     # Tauri v2 permissions
├── models/               # GGUF model files
├── llama-bin/            # llama-server executable
├── data/                 # SQLite database
└── package.json
```

## 🎯 Usage

### Creating a Conversation

1. Click **New Conversation**
2. Name your conversation (optional group)
3. Select an AI model (or import `.gguf`)
4. Configure parameters:
   - **Temperature** (0.0-2.0): Creativity level
   - **Top-P** (0.0-1.0): Nucleus sampling
   - **Max Tokens**: Response length limit
   - **Repeat Penalty**: Avoid repetition
5. Add optional system prompt
6. Start chatting!

### Keyboard Shortcuts

- **Ctrl+K**: Clear conversation (with confirmation)
- **Ctrl+/**: Focus chat input
- **F10**: Toggle gaming overlay mode
- **F8**: Toggle click-through (overlay mode)
- **Escape**: Exit overlay mode

### Gaming Overlay Mode

Press **F10** to enable transparent overlay:

- Adjust opacity with slider
- Auto-passthrough on idle (configurable)
- Compact UI for minimal screen space
- Drag strip for repositioning

## 🔧 Configuration

### System Prompt Templates

Customize AI behavior with system prompts:

- **Code Expert**: Programming assistance
- **Translator**: Language translation
- **Writer**: Creative writing help
- **Custom**: Define your own

### Model Parameters

Fine-tune per conversation:

- **Temperature**: Higher = more creative, lower = more focused
- **Top-P**: Nucleus sampling threshold
- **Max Tokens**: Limit response length (default: 2048)
- **Repeat Penalty**: Penalize repeated phrases (default: 1.1)

## 🛠️ Development

### Scripts

```bash
npm run dev              # Vite dev server
npm run tauri            # Tauri dev (auto-reload)
npm run build            # Production build
npm run check:lint       # ESLint check
npm run lint:fix         # Auto-fix linting issues
npm run format           # Prettier formatting
```

### Database Schema

```sql
-- Conversations
CREATE TABLE conversations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  group_name TEXT,
  preset_id TEXT NOT NULL,
  system_prompt TEXT,
  temperature REAL DEFAULT 0.7,
  top_p REAL DEFAULT 0.9,
  max_tokens INTEGER DEFAULT 2048,
  repeat_penalty REAL DEFAULT 1.1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Messages
CREATE TABLE messages (
  id INTEGER PRIMARY KEY,
  conversation_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
```

## 🔒 Privacy & Security

- ✅ **No telemetry** - Streamdown library has zero tracking
- ✅ **Offline-first** - All processing happens locally
- ✅ **No API keys** - No external LLM services required
- ✅ **Tauri v2 permissions** - Explicit dialog, shell, event permissions
- ✅ **SQLite WAL mode** - Safe concurrent access

## 📝 License

MIT License - See [LICENSE](LICENSE)

## 📚 Documentation

Comprehensive guides for developers and contributors:

- **[Architecture](ARCHITECTURE.md)** - Technical architecture and design decisions
- **[Contributing Guide](CONTRIBUTING.md)** - How to contribute to WhytChat
- **[Security Policy](SECURITY.md)** - Security practices and reporting
- **[Changelog](CHANGELOG.md)** - Version history and release notes

## 🤝 Contributing

Contributions welcome! Please:

1. Read the [Contributing Guide](CONTRIBUTING.md) and [Architecture](ARCHITECTURE.md)
2. Fork the repository
3. Create a feature branch (`feat/...`, `fix/...`, `docs/...`)
4. Run `npm run check:lint` and `npm run check:i18n` before committing
5. Submit a pull request targeting `main`

### Code Quality

We use automated code quality tools:

- **Codacy**: Automated code review and quality analysis
- **Sourcery**: AI-powered code refactoring suggestions
- **ESLint**: JavaScript/TypeScript linting
- **Prettier**: Code formatting

## 🙏 Acknowledgments

- [llama.cpp](https://github.com/ggerganov/llama.cpp) - Local LLM inference
- [Tauri](https://tauri.app/) - Rust desktop framework
- [Streamdown](https://github.com/vercel/streamdown) - AI markdown streaming

---

**Made with ❤️ for privacy-conscious AI enthusiasts**

# WhytChat
