# WhytChat App - Architecture & Implementation Map

**Version**: 0.2.6  
**Framework**: Tauri v2 + React 18 + TypeScript  
**Backend**: Rust (SQLite, llama.cpp server management)  
**i18n**: Custom implementation (JSON files)  
**Canonical Locale**: English (`en`)

---

## 📁 File Structure & Responsibilities

### Root Configuration Files

```
package.json              # Frontend dependencies & scripts
tsconfig.json             # TypeScript configuration
vite.config.ts            # Vite build config for Tauri
postcss.config.cjs        # PostCSS for Tailwind
tailwind.config.cjs       # Tailwind theme (dark mode support)
eslint.config.js          # ESLint rules (TypeScript, React)
README.md                 # User documentation
LICENSE                   # Open source license
CHANGELOG.md              # Version history
CONTRIBUTING.md           # Contribution guidelines
SECURITY.md               # Security policy
installer.iss             # Inno Setup script (Windows installer)
```

### Source Directory (`src/`)

#### Entry Point & Main App

```
index.html                # Tauri app HTML template
main.tsx                  # ReactDOM root render
├── imports: React, ReactDOM, App, i18n
├── sets: document.title = i18n.t("app.title")
└── renders: <App /> in <React.StrictMode>

App.tsx                   # Main application component
├── imports: useState, i18n, all view components, contexts, ErrorBoundary
├── state:
│   ├── currentView: "home" | "chat" | "settings" | "newConversation" | "conversations"
│   ├── currentConversationId: string | null
│   ├── showShortcuts: boolean
├── structure:
│   ├── <ErrorBoundary>
│   ├── <ThemeProvider>
│   ├── <ServerProvider>
│   │   ├── <TitleBar /> (custom window controls)
│   │   ├── <ServerStatusIndicator /> (fixed top-right)
│   │   ├── Conditional view rendering (Home, Chat, Settings, etc.)
│   │   └── <ShortcutsHelp /> modal
├── navigation: handleNavigate(view, conversationId?)
└── keyboard shortcuts: Ctrl+H (home), Ctrl+N (new chat), Ctrl+L (list), Ctrl+/ (help), Esc (close modal)

index.css                 # Global Tailwind directives + dark mode styles
```

#### i18n System

```
i18n.ts                   # Custom i18n implementation
├── imports: ./locales/fr.json, en.json, de.json, es.json, it.json, pt.json, nl.json, pl.json
├── availableLocaleCodes: ["fr", "en", "de", "es", "it", "pt", "nl", "pl"]
├── currentLocale: from localStorage or "fr" default
├── i18n.t(key, fallback): Get nested translation (falls back to English)
├── i18n.getLocale(): Get current locale
├── i18n.setLocale(locale): Change locale + save to localStorage + emit "localechange" event
└── get(obj, path, fallback): Nested key accessor (e.g., "chat.sendButton")
```

#### Contexts (`src/contexts/`)

```
ServerContext.tsx         # Global llama-server state management
├── imports: createContext, useContext, useState, useEffect, useRef, invoke, listen (Tauri API)
├── state:
│   ├── status: "checking" | "starting" | "ready" | "stopped" | "error"
│   ├── error: string | null
│   ├── isReady: boolean (computed from status === "ready")
├── methods:
│   ├── startServer(modelPath?): Start llama-server with optional custom model path
│   │   ├── Pre-flight health check (avoid duplicate starts)
│   │   ├── Invoke "start_llama_server" or "start_llama_with_preset"
│   │   ├── Wait 2s for initialization
│   │   ├── Perform health check (max 30 attempts, 1s interval)
│   │   └── Update status to "ready" or "error"
│   ├── startForConversation(conversationId): Start server with conversation's preset
│   │   └── Similar flow to startServer(), uses conversation DB record
│   └── stopServer(): Invoke "stop_llama_server", set status to "stopped"
├── effects:
│   ├── On mount: Check server status, auto-start if model available
│   ├── Listen for window close → auto-stop server before exit
│   ├── Listen for "llama-server-status" event → auto-start after install
│   └── Listen for "model-installed" event → auto-start after download
└── provides: ServerContext.Provider with { status, error, isReady, startServer, startForConversation, stopServer }

ThemeContext.tsx          # Light/dark theme management
├── imports: createContext, useContext, useEffect, useState, getStorageItem, setStorageItem
├── state: theme: "light" | "dark"
├── initialization: From localStorage or system preference (window.matchMedia)
├── methods:
│   ├── setTheme(theme): Update state + localStorage
│   └── toggleTheme(): Switch between light/dark
├── effect: Apply/remove "dark" class on document.documentElement
└── provides: ThemeContext.Provider with { theme, toggleTheme, setTheme }
```

#### Hooks (`src/hooks/`)

```
useKeyboardShortcuts.ts   # Global keyboard shortcut manager
├── imports: useEffect
├── params: Array<{ key, ctrl?, alt?, shift?, handler, description }>
├── logic:
│   ├── Add window.addEventListener("keydown", ...)
│   ├── Match key + modifiers (ctrl, alt, shift)
│   ├── Prevent default if matched
│   └── Call handler()
└── cleanup: Remove event listener on unmount
```

#### Utils (`src/utils/`)

```
storage.ts                # LocalStorage abstraction
├── exports:
│   ├── getStorageItem(key): JSON.parse or null
│   └── setStorageItem(key, value): JSON.stringify + localStorage.setItem
└── purpose: Type-safe localStorage access

errors.ts                 # Error handling utilities
├── exports:
│   ├── AppError: Custom error class with code + message
│   └── handleError(error): Format error for UI display
└── purpose: Consistent error messaging
```

#### RAG System (`src/rag/`)

```
types.ts                  # TypeScript types for RAG
├── exports:
│   ├── Document: { id, content, metadata }
│   ├── Embedding: number[]
│   └── SearchResult: { document, score }
└── purpose: Type safety for vector search

api.ts                    # RAG API calls (Tauri commands)
├── imports: invoke (Tauri API), types
├── functions:
│   ├── indexDocument(document): Invoke "rag_index_document"
│   ├── searchDocuments(query, topK): Invoke "rag_search_documents"
│   └── deleteDocument(id): Invoke "rag_delete_document"
└── purpose: Frontend interface to Rust RAG backend
```

#### Components (`src/components/`)

**Main Views:**

```
Home/
├── index.tsx             # Export wrapper
└── Home.tsx              # Home screen
    ├── imports: i18n, useServer, lucide-react icons
    ├── props: onNavigate(view, conversationId?)
    ├── structure:
    │   ├── Welcome message
    │   ├── Server status indicator
    │   ├── Quick actions: New Chat, View Conversations, Settings
    │   └── Recent conversations list (from DB)
    └── uses: Tauri invoke("get_conversations") for recent chats

Chat/
├── index.tsx             # Export wrapper
├── Chat.tsx              # Chat interface
│   ├── imports: useState, useEffect, useServer, invoke, lucide-react, MessageBubble, MessageToolbar
│   ├── props: onNavigate, conversationId?
│   ├── state:
│   │   ├── messages: Array<{ role, content }>
│   │   ├── inputValue: string
│   │   ├── isStreaming: boolean
│   │   ├── currentConversation: { id, title, preset_id }
│   ├── methods:
│   │   ├── sendMessage(): Invoke "send_message_streaming" + handle stream
│   │   ├── stopGeneration(): Invoke "stop_generation"
│   │   ├── loadConversation(id): Invoke "get_conversation" + "get_messages"
│   │   └── saveConversation(): Auto-save on message send
│   └── uses: EventSource or Tauri streaming for real-time responses
└── components/
    ├── MessageBubble.tsx # Individual message display
    │   ├── imports: i18n, lucide-react, streamdown (markdown rendering)
    │   ├── props: message { role, content }, onCopy, onRegenerate
    │   ├── structure:
    │   │   ├── Avatar (user/assistant icon)
    │   │   ├── Message content (markdown-formatted)
    │   │   └── Toolbar (copy, regenerate buttons)
    │   └── uses: streamdown for markdown → HTML
    └── MessageToolbar.tsx # Message action buttons
        ├── props: onCopy, onRegenerate, onDelete
        └── structure: Icon buttons for message actions

ConversationsList/
├── index.tsx             # Conversations list view
    ├── imports: useState, useEffect, invoke, i18n, lucide-react
    ├── props: onNavigate
    ├── state: conversations: Array<{ id, title, created_at, preset_id }>
    ├── methods:
    │   ├── loadConversations(): Invoke "get_conversations"
    │   ├── deleteConversation(id): Invoke "delete_conversation"
    │   └── renameConversation(id, title): Invoke "update_conversation_title"
    └── structure:
        ├── Search/filter bar
        ├── Conversations list (grouped by date?)
        └── Empty state (no conversations)

NewConversation/
├── index.tsx             # New conversation setup
    ├── imports: useState, useEffect, invoke, i18n, useServer
    ├── props: onNavigate
    ├── state:
    │   ├── presets: Array<{ id, name, description }>
    │   ├── selectedPreset: string | null
    │   ├── title: string
    ├── methods:
    │   ├── loadPresets(): Invoke "list_presets"
    │   ├── createConversation(): Invoke "create_conversation" → navigate to Chat
    │   └── startServer() if not ready
    └── structure:
        ├── Preset selection (dropdown or cards)
        ├── Conversation title input
        └── Create button

Settings/
├── index.tsx             # Export wrapper
└── Settings.tsx          # Settings panel
    ├── imports: useState, useEffect, invoke, i18n, useTheme
    ├── props: onNavigate
    ├── tabs:
    │   ├── General: Language, theme, auto-start server
    │   ├── Models: Download, delete, manage presets
    │   ├── Advanced: Server port, context size, GPU settings
    │   └── About: Version, license, credits
    └── uses: Invoke various settings commands (get/set_config)
```

**UI Components:**

```
ErrorBoundary/
├── index.tsx             # React error boundary
    ├── state: hasError, error
    ├── static getDerivedStateFromError(error): Update state
    ├── componentDidCatch(error, errorInfo): Log to console/Sentry
    └── render: Error UI with retry button or fallback to children

ServerStatusIndicator/
├── index.tsx             # Server status badge
    ├── imports: useServer, i18n, lucide-react
    ├── displays: status (checking, starting, ready, stopped, error)
    ├── colors: gray (checking), yellow (starting), green (ready), red (error/stopped)
    └── onClick: Show detailed status modal (optional)

ShortcutsHelp/
├── index.tsx             # Keyboard shortcuts modal
    ├── imports: i18n, lucide-react
    ├── props: onClose
    ├── structure:
    │   ├── Modal overlay
    │   ├── Shortcuts list (key combos + descriptions)
    │   └── Close button (X or Esc)
    └── shortcuts:
        ├── Ctrl+H: Go to Home
        ├── Ctrl+N: New Conversation
        ├── Ctrl+L: List Conversations
        ├── Ctrl+/: Show Shortcuts
        └── Esc: Close Modal

TitleBar/
├── index.tsx             # Custom window title bar (Tauri)
    ├── imports: getCurrentWindow, i18n, lucide-react
    ├── structure:
    │   ├── App title + icon
    │   ├── Window controls: Minimize, Maximize/Restore, Close
    │   └── data-tauri-drag-region (for dragging window)
    └── methods:
        ├── minimize(): getCurrentWindow().minimize()
        ├── toggleMaximize(): getCurrentWindow().toggleMaximize()
        └── close(): getCurrentWindow().close()

InstallLlamaServer/
├── index.tsx             # llama-server installation wizard
    ├── imports: useState, invoke, listen, i18n
    ├── state:
    │   ├── downloadProgress: number (0-100)
    │   ├── installStatus: "idle" | "downloading" | "installing" | "done" | "error"
    │   ├── error: string | null
    ├── methods:
    │   ├── startDownload(): Invoke "download_llama_server"
    │   ├── listenProgress(): Listen for "download-progress" events
    │   └── installServer(): Invoke "install_llama_server"
    └── structure:
        ├── Installation steps (welcome, download, verify)
        ├── Progress bar
        └── Error handling + retry

RAG/
├── index.tsx             # RAG management UI
    ├── imports: useState, invoke, i18n, lucide-react
    ├── state:
    │   ├── documents: Array<Document>
    │   ├── searchQuery: string
    │   ├── searchResults: Array<SearchResult>
    ├── methods:
    │   ├── uploadDocument(): File picker → invoke "rag_index_document"
    │   ├── searchDocuments(): Invoke "rag_search_documents"
    │   └── deleteDocument(id): Invoke "rag_delete_document"
    └── structure:
        ├── Document list (indexed files)
        ├── Upload button
        ├── Search bar
        └── Search results display
```

### Locales (`src/locales/`)

```
en.json                   # Canonical English locale
fr.json                   # French translations
de.json                   # German translations
es.json                   # Spanish translations
it.json                   # Italian translations
pt.json                   # Portuguese translations
nl.json                   # Dutch translations
pl.json                   # Polish translations

Structure (nested JSON):
{
  "app": { "title": "WhytChat" },
  "home": { "welcome": "Welcome", ... },
  "chat": { "sendButton": "Send", ... },
  "settings": { "title": "Settings", ... },
  "shortcuts": { "goHome": "Go to Home", ... },
  ...
}
```

---

## 🦀 Rust Backend (`src-tauri/`)

### Configuration Files

```
Cargo.toml                # Rust dependencies
tauri.conf.json           # Tauri app configuration
build.rs                  # Tauri build script
pack-sources.json         # Model pack download sources
presets.json              # Llama model presets (context size, params)
```

### Rust Modules (`src-tauri/src/`)

```
main.rs                   # Tauri app entry point
├── modules: db, llama, llama_install, rag
├── state:
│   ├── OverlayState: Mutex<bool> (window overlay mode)
│   ├── DbState: Mutex<Connection> (SQLite database)
│   ├── DownloadManager: Mutex<HashMap<String, DownloadEntry>> (active downloads)
├── commands:
│   ├── Window management: set_click_through, apply_overlay_bounds, toggle_overlay, set_overlay_mode
│   ├── Downloads: download_model_pack, cancel_download, get_download_state, cleanup_downloads
│   ├── Database: Proxies to db.rs functions
│   ├── Llama server: Proxies to llama.rs functions
│   ├── RAG: Proxies to rag.rs functions
└── setup:
    ├── Initialize SQLite database (db::init_db)
    ├── Register Tauri commands
    └── Listen for window events (close, overlay mode)

db.rs                     # SQLite database operations
├── tables:
│   ├── conversations: (id, title, created_at, updated_at, preset_id)
│   ├── messages: (id, conversation_id, role, content, created_at)
│   └── settings: (key, value)
├── functions:
│   ├── init_db(app_handle): Create tables if not exist
│   ├── create_conversation(conn, title, preset_id): Insert conversation
│   ├── get_conversations(conn): List all conversations (ordered by updated_at DESC)
│   ├── get_conversation(conn, id): Get single conversation
│   ├── update_conversation_title(conn, id, title): Rename conversation
│   ├── delete_conversation(conn, id): Delete conversation + messages
│   ├── create_message(conn, conv_id, role, content): Insert message
│   ├── get_messages(conn, conv_id): List messages for conversation
│   ├── get_setting(conn, key): Get setting value
│   └── set_setting(conn, key, value): Update setting value
└── uses: rusqlite crate

llama.rs                  # llama-server lifecycle management
├── state: Static LLAMA_PROCESS: Mutex<Option<Child>> (server subprocess)
├── functions:
│   ├── check_llama_server(): Check if llama-server binary exists + is running
│   ├── start_llama_server(model_path, ctx_size): Spawn llama-server subprocess
│   │   ├── Args: --model, --ctx-size, --port 8080, --host 127.0.0.1
│   │   └── Store process handle in LLAMA_PROCESS
│   ├── start_llama_with_preset(preset_id): Load preset from presets.json → start_llama_server
│   ├── start_llama_for_conversation(conv_id): Load conversation's preset_id → start_llama_with_preset
│   ├── stop_llama_server(): Kill LLAMA_PROCESS subprocess
│   ├── health_check_llama_server(): HTTP GET http://127.0.0.1:8080/health
│   ├── send_message_streaming(prompt, system_prompt): HTTP POST /completion with streaming
│   ├── stop_generation(): Send interrupt signal to server
│   └── get_first_installed_preset(): Find first preset with existing model file
└── uses: std::process::Command, reqwest (HTTP client)

llama_install.rs          # llama-server installation & updates
├── functions:
│   ├── download_llama_server(app_handle): Download llama-server binary for current platform
│   │   ├── Emit "download-progress" events
│   │   └── Save to app_data_dir/llama-bin/
│   ├── install_llama_server(app_handle): Unzip/chmod +x downloaded binary
│   ├── check_llama_server_updates(): Check GitHub releases for new version
│   ├── download_model_pack(app_handle, pack_id): Download model from pack-sources.json
│   │   ├── Emit "download-progress" events
│   │   └── Save to app_data_dir/models/{pack_id}/
│   ├── get_installed_packs(): List downloaded model packs
│   └── delete_model_pack(pack_id): Remove model files
└── uses: reqwest (HTTP), tokio::fs (async file I/O), futures_util (stream)

rag.rs                    # RAG (Retrieval-Augmented Generation)
├── functions:
│   ├── rag_index_document(doc_path): Parse document, generate embeddings, store in vector DB
│   ├── rag_search_documents(query, top_k): Semantic search in vector DB
│   ├── rag_delete_document(doc_id): Remove document from index
│   └── rag_get_embeddings(text): Call llama-server /embeddings endpoint
└── uses: SQLite (vector storage), llama.cpp embeddings API
```

### Tauri Configuration (`tauri.conf.json`)

```json
{
  "identifier": "com.whytcard.whytchat",
  "productName": "WhytChat",
  "version": "0.2.6",
  "windows": [
    {
      "title": "WhytChat",
      "width": 1200,
      "height": 800,
      "resizable": true,
      "fullscreen": false,
      "decorations": false, // Custom title bar
      "transparent": false
    }
  ],
  "security": {
    "csp": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
  },
  "allowlist": {
    "all": false,
    "fs": { "all": true },
    "dialog": { "all": true },
    "http": { "all": true },
    "shell": { "all": true },
    "window": { "all": true }
  }
}
```

---

## 🔄 Data Flow & Component Relationships

### Application Bootstrap

```
1. main.tsx
   ├── Initialize i18n (load locale files)
   ├── Set document.title from i18n
   └── Render <App /> in StrictMode

2. App.tsx
   ├── Wrap in <ErrorBoundary>
   ├── Wrap in <ThemeProvider> (light/dark mode)
   ├── Wrap in <ServerProvider> (llama-server state)
   ├── Register global keyboard shortcuts
   └── Render current view (Home, Chat, Settings, etc.)

3. ServerContext initialization
   ├── Check llama-server status (invoke "check_llama_server")
   ├── If installed + not running: auto-start if model available
   ├── Listen for window close → auto-stop server
   └── Listen for model install events → auto-start server
```

### Component Dependencies Graph

```
App.tsx
├─── ThemeProvider (context)
├─── ServerProvider (context)
│    └─── Manages llama-server lifecycle
├─── TitleBar (custom window controls)
├─── ServerStatusIndicator (global status badge)
├─── Home (props: onNavigate)
│    └─── Lists recent conversations (invoke "get_conversations")
├─── Chat (props: onNavigate, conversationId?)
│    ├─── MessageBubble (message display + markdown)
│    ├─── MessageToolbar (copy, regenerate actions)
│    └─── Uses ServerContext for streaming
├─── ConversationsList (props: onNavigate)
│    └─── CRUD operations (invoke "get/delete/update_conversation")
├─── NewConversation (props: onNavigate)
│    └─── Preset selection + server start
├─── Settings (props: onNavigate)
│    ├─── Language, theme (useTheme)
│    └─── Model downloads (invoke "download_model_pack")
├─── RAG (optional feature)
│    └─── Document management (invoke "rag_*")
├─── InstallLlamaServer (first-run wizard)
│    └─── Download/install llama-server binary
└─── ShortcutsHelp (modal)
     └─── Keyboard shortcuts reference
```

### State Management

**Contexts:**

- **ServerContext**: Global llama-server status, start/stop methods
- **ThemeContext**: Light/dark mode, persisted in localStorage

**Local State:**

- **App.tsx**: currentView, currentConversationId, showShortcuts
- **Chat.tsx**: messages, inputValue, isStreaming
- **Settings.tsx**: presets, downloadProgress, settings values
- **ConversationsList.tsx**: conversations array

**Persistent State:**

- **SQLite**: Conversations, messages, settings
- **LocalStorage**: Theme, locale, user preferences
- **Filesystem**: Model files, llama-server binary

### Key Data Flows

#### 1. Chat Message Flow

```
User types message → Chat.tsx
├─ Update inputValue state
├─ onClick Send → sendMessage()
│  ├─ Save message to DB (invoke "create_message")
│  ├─ Call llama-server API (invoke "send_message_streaming")
│  ├─ Listen for streaming events (Server-Sent Events or Tauri stream)
│  ├─ Update messages state incrementally
│  └─ Save assistant response to DB
└─ Render MessageBubble for each message
```

#### 2. Server Lifecycle

```
App mounts → ServerContext.useEffect
├─ Check server status (invoke "check_llama_server")
├─ If not running + model available:
│  ├─ Auto-start server (invoke "start_llama_with_preset")
│  ├─ Wait 2s for initialization
│  ├─ Health check loop (30 attempts, 1s interval)
│  └─ Update status to "ready" or "error"
└─ Listen for events:
   ├─ "llama-server-status" → auto-start after install
   ├─ "model-installed" → auto-start after download
   └─ Window close → stop_llama_server()
```

#### 3. Conversation Creation

```
User → NewConversation
├─ Select preset (invoke "list_presets")
├─ Enter title
├─ Click Create
│  ├─ invoke "create_conversation" → returns conv_id
│  ├─ Start server if not ready (startForConversation(conv_id))
│  └─ Navigate to Chat view (onNavigate("chat", conv_id))
└─ Chat view loads conversation (invoke "get_conversation", "get_messages")
```

#### 4. Theme Toggle

```
User clicks theme button → Settings.tsx
├─ useTheme().toggleTheme()
├─ ThemeContext updates state ("light" → "dark")
├─ Save to localStorage ("whytchat-theme")
├─ ThemeContext.useEffect triggers
└─ Add/remove "dark" class on document.documentElement
```

---

## 📦 NPM Dependencies

### Production Dependencies

```json
{
  "@tauri-apps/api": "^2.0.0", // Tauri JS API (invoke, events, window)
  "@tauri-apps/plugin-dialog": "^2.0.0", // File picker dialogs
  "lucide-react": "^0.548.0", // Icon library
  "react": "^18.3.1", // React core
  "react-dom": "^18.3.1", // React DOM
  "streamdown": "^1.4.0" // Markdown rendering
}
```

### Dev Dependencies

```json
{
  "@eslint/js": "^9.38.0",
  "@tailwindcss/postcss": "^4.1.16",
  "@tauri-apps/cli": "^2.0.0", // Tauri CLI (dev, build)
  "@types/react": "^18.2.45",
  "@types/react-dom": "^18.2.18",
  "@typescript-eslint/eslint-plugin": "^8.46.2",
  "@typescript-eslint/parser": "^8.46.2",
  "@vitejs/plugin-react": "^4.3.1",
  "autoprefixer": "^10.4.21",
  "eslint": "^9.38.0",
  "eslint-plugin-react": "^7.37.5",
  "eslint-plugin-react-hooks": "^7.0.1",
  "eslint-plugin-unused-imports": "^4.3.0",
  "jscpd": "^4.0.5", // Duplicate code detection
  "postcss": "^8.5.6",
  "prettier": "^3.3.3",
  "tailwindcss": "^3.4.14",
  "typescript": "^5.6.3",
  "vite": "^5.4.0"
}
```

### Rust Dependencies (Cargo.toml)

```toml
[dependencies]
tauri = { version = "2.0", features = ["all"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
rusqlite = { version = "0.30", features = ["bundled"] }
reqwest = { version = "0.11", features = ["stream", "json"] }
tokio = { version = "1.35", features = ["full"] }
futures-util = "0.3"
```

---

## 🎯 Feature Completeness Checklist

### Core Features

- [x] **Multi-view navigation** (Home, Chat, Settings, Conversations, New Conversation)
- [x] **Custom i18n** (8 languages: en, fr, de, es, it, pt, nl, pl)
- [x] **Dark mode** (ThemeContext + Tailwind dark: classes)
- [x] **Custom title bar** (TitleBar component for frameless window)
- [x] **Global keyboard shortcuts** (useKeyboardShortcuts hook)
- [x] **Error boundary** (ErrorBoundary component)
- [x] **Server lifecycle** (ServerContext auto-start/stop)

### Chat Features

- [x] **Real-time streaming** (Server-Sent Events from llama-server)
- [x] **Markdown rendering** (streamdown library)
- [x] **Message persistence** (SQLite database)
- [x] **Conversation management** (CRUD operations)
- [x] **Message actions** (copy, regenerate, delete)
- [x] **Stop generation** (interrupt streaming)

### Model Management

- [x] **Preset system** (presets.json with context size, params)
- [x] **Model download** (llama_install.rs with progress events)
- [x] **Installation wizard** (InstallLlamaServer component)
- [x] **Auto-start server** (after model install)
- [x] **Health checks** (retry logic for server startup)

### Settings

- [x] **Language switcher** (i18n.setLocale + localechange event)
- [x] **Theme toggle** (ThemeContext)
- [x] **Model downloads** (pack-sources.json)
- [x] **Server configuration** (port, context size, GPU settings)
- [x] **About section** (version, license, credits)

### Advanced Features

- [x] **RAG system** (rag.rs for document indexing/search)
- [x] **Overlay mode** (always-on-top, compact window)
- [x] **Download manager** (DownloadManager state with cancel support)
- [x] **Server status indicator** (ServerStatusIndicator component)
- [x] **Keyboard shortcuts help** (ShortcutsHelp modal)

### Developer Experience

- [x] **TypeScript** (full type coverage)
- [x] **ESLint** (React, TypeScript, unused imports)
- [x] **Prettier** (code formatting)
- [x] **i18n parity check** (`scripts/check-i18n.cjs`)
- [x] **Version check** (`scripts/check-version.cjs`)
- [x] **Quality gates** (`check:quality` script)

### CI/CD Integration

- [x] **GitHub Actions release workflow** (`.github/workflows/release.yml`)
  - Triggered by `v*.*.*` tags
  - Windows-only build (tauri-action)
  - Outputs: .msi + .nsis.zip
  - Pre-build: i18n check
- [x] **Installer script** (`installer.iss` for Inno Setup)

---

## 🚀 Implementation Priorities

### Phase 1: Core Structure (MUST HAVE)

1. ✅ Tauri configuration (`tauri.conf.json`, `Cargo.toml`)
2. ✅ Entry point (`main.tsx`, `App.tsx`, `i18n.ts`)
3. ✅ Contexts (`ServerContext.tsx`, `ThemeContext.tsx`)
4. ✅ Utils (`storage.ts`, `errors.ts`)
5. ✅ Rust backend (`main.rs`, `db.rs`, `llama.rs`)

### Phase 2: UI Components (MUST HAVE)

6. ✅ Layout (`TitleBar`, `ServerStatusIndicator`, `ErrorBoundary`)
7. ✅ Views (`Home`, `Chat`, `Settings`, `ConversationsList`, `NewConversation`)
8. ✅ Chat sub-components (`MessageBubble`, `MessageToolbar`)

### Phase 3: Advanced Features (SHOULD HAVE)

9. ✅ RAG system (`rag.rs`, `RAG` component)
10. ✅ Model management (`llama_install.rs`, `InstallLlamaServer`)
11. ✅ Keyboard shortcuts (`useKeyboardShortcuts`, `ShortcutsHelp`)
12. ✅ Overlay mode (main.rs commands)

### Phase 4: Polish & Optimization (NICE TO HAVE)

13. ✅ Dark mode (Tailwind dark: variants)
14. ✅ Download manager (progress tracking, cancel)
15. ✅ Auto-updates (check_llama_server_updates)
16. ✅ Quality checks (ESLint, Prettier, i18n parity)

---

## 🔧 Migration Strategy

### Step 1: Setup & Configuration

- Copy `package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.cjs`, `postcss.config.cjs`
- Copy `src-tauri/Cargo.toml`, `tauri.conf.json`, `build.rs`
- Install dependencies: `npm install` + `cargo build` (Rust)

### Step 2: Rust Backend

- Copy `src-tauri/src/main.rs`, `db.rs`, `llama.rs`, `llama_install.rs`, `rag.rs`
- Copy `pack-sources.json`, `presets.json`
- Test Tauri commands: `npm run tauri dev`

### Step 3: Frontend Core

- Copy `src/main.tsx`, `App.tsx`, `index.css`, `i18n.ts`
- Copy `src/contexts/`, `src/hooks/`, `src/utils/`
- Copy `src/locales/` (all 8 JSON files)

### Step 4: UI Components

- Copy `src/components/Home/`, `Chat/`, `Settings/`, etc.
- Copy sub-components (`MessageBubble`, `MessageToolbar`, etc.)
- Verify all imports resolve correctly

### Step 5: Assets & Configuration

- Copy `src/index.html`, `src/favicon.svg`
- Copy `installer.iss` (Windows installer script)
- Copy CI/CD files (`.github/workflows/release.yml`, `scripts/`)

### Step 6: Testing & Validation

- Run `npm run check:i18n` (verify translation parity)
- Run `npm run check:version` (verify version consistency)
- Run `npm run check:lint` (ESLint)
- Run `npm run tauri build` (test production build)

---

## 🧪 Testing Checklist

### Functional Tests

- [ ] App launches successfully (Tauri window appears)
- [ ] Server auto-starts if model is installed
- [ ] Language switcher changes UI language
- [ ] Theme toggle switches light/dark mode
- [ ] Create new conversation → starts server → loads Chat view
- [ ] Send message → streams response → saves to DB
- [ ] Stop generation interrupts streaming
- [ ] List conversations → displays all saved chats
- [ ] Delete conversation → removes from DB
- [ ] Keyboard shortcuts work (Ctrl+H, Ctrl+N, Ctrl+L, Ctrl+/)

### Visual Tests

- [ ] Custom title bar displays correctly (minimize, maximize, close)
- [ ] Server status indicator shows correct colors (gray, yellow, green, red)
- [ ] Dark mode applies to all components
- [ ] Markdown renders correctly in chat messages (code blocks, lists, etc.)
- [ ] Icons display correctly (Lucide React)
- [ ] Responsive layout (min width 800px for desktop)

### Performance Tests

- [ ] App startup time < 2s
- [ ] Message streaming has no visible lag
- [ ] Server health check completes within 30s
- [ ] DB queries execute in < 100ms
- [ ] No memory leaks (server process properly stopped on exit)

### Integration Tests

- [ ] llama-server binary downloads successfully
- [ ] Model packs download with progress tracking
- [ ] Server starts with correct preset parameters
- [ ] RAG document indexing works
- [ ] Overlay mode positions window correctly

### i18n Tests

- [ ] `npm run check:i18n` passes (all 8 locales have same keys)
- [ ] All UI strings use `i18n.t()` (no hardcoded English)
- [ ] Language change persists after app restart

### CI/CD Tests

- [ ] GitHub Actions release workflow builds successfully
- [ ] Windows .msi installer works
- [ ] .nsis.zip portable version works
- [ ] i18n check runs in CI

---

## 📝 Notes

- **Custom i18n**: No react-i18next (lightweight custom implementation)
- **SQLite only**: No cloud sync (local-first architecture)
- **Windows-first**: macOS/Linux support paused (focus on single platform)
- **No auto-updates**: Manual download from GitHub Releases
- **Version synchronization**: `package.json` and `src-tauri/Cargo.toml` versions MUST match. Use `npm run check:version` to validate before releases. Current source shows 0.2.6 (package.json) vs 0.2.1 (Cargo.toml) - requires sync
- **Frameless window**: Custom title bar for consistent cross-platform UI
- **Streaming responses**: Server-Sent Events from llama-server /completion endpoint
- **RAG optional**: Feature flag in Settings (disabled by default)
- **Overlay mode**: Experimental feature for always-on-top mini-chat

---

## 🆘 Common Issues & Solutions

### Issue: Server fails to start

- **Cause**: llama-server binary not found or model file missing
- **Fix**: Run InstallLlamaServer wizard, verify model path in presets.json

### Issue: Streaming stops mid-response

- **Cause**: Server crashed or network timeout
- **Fix**: Check server logs (stderr), restart server, increase timeout

### Issue: Database locked error

- **Cause**: Concurrent writes to SQLite (rusqlite mutex issue)
- **Fix**: Use `DbState(Mutex<Connection>)` pattern, avoid long transactions

### Issue: Dark mode not applying

- **Cause**: Tailwind `darkMode: 'class'` not configured or missing `dark:` variants
- **Fix**: Verify `tailwind.config.cjs` has `darkMode: 'class'`, add `dark:bg-*` classes

### Issue: i18n keys not found

- **Cause**: Missing keys in locale files or nested key access failure
- **Fix**: Run `npm run check:i18n`, verify key paths match (e.g., `chat.sendButton`)

### Issue: Build fails with Rust error

- **Cause**: Missing Rust dependencies or incorrect target triple
- **Fix**: Run `cargo build` separately, check Cargo.toml, install toolchain

### Issue: Keyboard shortcuts not working

- **Cause**: Event listener not attached or preventDefault missing
- **Fix**: Check useKeyboardShortcuts hook, verify `window.addEventListener` runs

---

**Last Updated**: 2025-11-15  
**Maintained By**: WhytCard V2 Team  
**Status**: ✅ Ready for implementation
