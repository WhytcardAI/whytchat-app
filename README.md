# WhytChat v0.2.1

**🔒 100% Private AI Chat Desktop Application**

WhytChat est une application de chat IA sécurisée et hors ligne, construite avec Tauri v2, React et llama.cpp. Toutes vos conversations restent sur votre machine—aucune donnée n'est jamais envoyée à des serveurs externes.

[![Download Latest Release](https://img.shields.io/badge/Download-Latest%20Release-blue?style=for-the-badge)](https://github.com/WhytcardAI/WhytChat02/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## ✨ Nouvelles Fonctionnalités v0.2.1

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

**Option 1 : Téléchargement Direct**
```
https://github.com/WhytcardAI/WhytChat02/releases/latest
```

### Build for Production

```bash
# Build optimized bundle
npm run build

# Create installer (Inno Setup required)
iscc installer.iss
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

MIT License - See [LICENSE.txt](LICENSE.txt)

## 📚 Documentation

Comprehensive guides for developers and contributors:

- **[Branch Policy](docs/branch-policy.md)** - Branch management, CI triggers, and release process
- **[CI/CD Strategy](docs/ci-strategy.md)** - Workflow details, cost optimization, and troubleshooting
- **[Contributing Guide](CONTRIBUTING.md)** - How to contribute to WhytChat02
- **[Security Policy](SECURITY.md)** - Security practices and reporting

## 🤝 Contributing

Contributions welcome! Please:
1. Read the [Branch Policy](docs/branch-policy.md) and [Contributing Guide](CONTRIBUTING.md)
2. Fork the repository
3. Create a feature branch (see branch naming conventions)
4. Run `npm run check:lint` before committing
5. Submit a pull request targeting `main`

## 🙏 Acknowledgments

- [llama.cpp](https://github.com/ggerganov/llama.cpp) - Local LLM inference
- [Tauri](https://tauri.app/) - Rust desktop framework
- [Streamdown](https://github.com/vercel/streamdown) - AI markdown streaming

---

**Made with ❤️ for privacy-conscious AI enthusiasts**
# WhytChat
