import { useState, useEffect, useRef, type KeyboardEvent } from "react";

// Sanitize LLM output: hide any explicit 'system prompt' labels the model might echo
function sanitizeLLM(text: string): string {
  if (!text) return text;
  try {
    // Remove lines like 'Prompt système:' / 'Prompt systeme:' / 'System prompt:' (case-insensitive)
    return text.replace(
      /(?:^|\n)\s*(?:prompt\s*(?:syst[eÃ¨]me|systeme)|system\s*prompt)\s*:/gi,
      "\n"
    );
  } catch {
    return text;
  }
}

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { i18n } from "../../i18n";
import { useServer } from "../../contexts/ServerContext";
import {
  getStorageBoolean,
  getStorageNumberWithClamp,
  setStorageItem,
} from "../../utils/storage";
import {
  Bot,
  Folder,
  Plus,
  Trash2,
  MessageSquare,
  Loader2,
  Send,
  Lightbulb,
  StopCircle,
  FileText,
  X,
} from "lucide-react";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { MessageBubble } from "./components/MessageBubble";
import { FileImport } from "./components/FileImport";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

type ChatProps = {
  conversationId?: string;
  onNavigate: (view: string) => void;
};

export function Chat({ conversationId, onNavigate }: ChatProps) {
  const {
    isReady: serverReady,
    startForConversation,
    stopServer,
  } = useServer();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [conversationName, setConversationName] = useState("");
  const [conversationGroup, setConversationGroup] = useState<string | null>(
    null
  );
  const [modelName, setModelName] = useState("");
  const [overlayEnabled, setOverlayEnabled] = useState<boolean>(() => {
    return getStorageBoolean("overlayEnabled", false);
  });
  const [overlayOpacity, setOverlayOpacity] = useState<number>(() => {
    return getStorageNumberWithClamp("overlayOpacity", 1, 0.5, 1);
  });
  const [overlayPassthrough, setOverlayPassthrough] = useState<boolean>(() => {
    return getStorageBoolean("overlayPassthrough", false);
  });
  const [overlayAutoPassthrough, setOverlayAutoPassthrough] = useState<boolean>(
    () => {
      return getStorageBoolean("overlayAutoPassthrough", true);
    }
  );
  const [overlayControlsIdleSec, setOverlayControlsIdleSec] = useState<number>(
    () => {
      return getStorageNumberWithClamp("overlayControlsIdleSec", 2, 1, 5);
    }
  );
  const [overlayToggleKey, setOverlayToggleKey] = useState<string>(() => {
    try {
      return localStorage.getItem("overlayToggleKey") || "";
    } catch {
      return "";
    }
  });
  const [overlayShowDragStrip, setOverlayShowDragStrip] = useState<boolean>(
    () => {
      return getStorageBoolean("overlayShowDragStrip", true);
    }
  );
  const [showOverlayControls, setShowOverlayControls] = useState<boolean>(true);
  const [isOverlayHover, setIsOverlayHover] = useState<boolean>(false);
  const hideControlsTimer = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isUserAtBottom, setIsUserAtBottom] = useState<boolean>(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const serverStartedRef = useRef<boolean>(false);
  const lastTempIdRef = useRef<string | null>(null);
  const lastGenContentRef = useRef<string>("");
  const [genStartAt, setGenStartAt] = useState<number | null>(null);
  const [lastStats, setLastStats] = useState<{
    words: number;
    tokens: number;
    durationSec: number;
    speedWps: number;
  } | null>(null);

  // File import state
  const [importedFiles, setImportedFiles] = useState<
    Array<{
      name: string;
      content: string;
      size: number;
    }>
  >([]);
  const [showFileImport, setShowFileImport] = useState(false);

  // Chat-specific keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: "k",
      ctrl: true,
      handler: () => {
        if (confirm(i18n.t("chat.clearChat") + "?")) {
          setMessages([]);
        }
      },
      description: "Clear chat",
    },
    {
      key: "/",
      ctrl: true,
      handler: () => inputRef.current?.focus(),
      description: "Focus input",
    },
  ]);

  const checkIfAtBottom = () => {
    if (!messagesContainerRef.current) return true;
    const container = messagesContainerRef.current;
    const threshold = 100; // pixels from bottom
    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      threshold;
    setIsUserAtBottom(isAtBottom);
    return isAtBottom;
  };

  useEffect(() => {
    if (isUserAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      checkIfAtBottom();
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    (async () => {
      try {
        // Charger info conversation
        const conv = await invoke<{
          id: number;
          name: string;
          group_name: string | null;
          preset_id: string;
          system_prompt: string | null;
          temperature: number;
          top_p: number;
          max_tokens: number;
          repeat_penalty: number;
        }>("get_conversation", { id: parseInt(conversationId) });

        setConversationName(conv.name);
        setConversationGroup(conv.group_name);
        setModelName(conv.preset_id);

        // Log du system prompt pour debugging
        // System prompt loaded silently

        // Charger messages
        const msgs = await invoke<
          Array<{
            id: number;
            role: string;
            content: string;
            created_at: string;
          }>
        >("list_messages", { conversationId: parseInt(conversationId) });

        setMessages(
          msgs.map((m) => ({
            id: String(m.id),
            role: m.role as "user" | "assistant",
            content:
              m.role === "assistant" ? sanitizeLLM(m.content) : m.content,
            timestamp: new Date(m.created_at),
          }))
        );
      } catch (err) {
        console.error("Failed to load conversation:", err);
      }
    })();
  }, [conversationId]);

  // Start server when entering conversation, stop when leaving
  useEffect(() => {
    if (!conversationId) return;

    // Start server for this conversation if not already started
    if (!serverStartedRef.current) {
      serverStartedRef.current = true;
      setIsInitializing(true);
      (async () => {
        try {
          await startForConversation(parseInt(conversationId));
        } catch (e) {
          console.error("[Chat] Failed to start server for conversation:", e);
          serverStartedRef.current = false;
          setIsInitializing(false);
        }
      })();
    }

    // Cleanup: stop server when leaving conversation (unmount only)
    return () => {
      if (serverStartedRef.current) {
        serverStartedRef.current = false;
        setIsInitializing(false);
        stopServer().catch((e) => {
          console.error(
            "[Chat] Failed to stop server on conversation exit:",
            e
          );
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Hide loading when server becomes ready
  useEffect(() => {
    if (serverReady) {
      setIsInitializing(false);
    }
  }, [serverReady]);

  // Load datasets when conversation changes
  // File import handler
  const handleFileImported = (file: {
    name: string;
    content: string;
    size: number;
  }) => {
    setImportedFiles((prev) => [...prev, file]);
    // Ajouter un message système pour indiquer le fichier importé
    const systemMessage: Message = {
      id: `file-${Date.now()}`,
      role: "assistant",
      content: `📎 **File imported:** ${file.name} (${file.size} KB)\n\nI can now answer questions about this document.`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, systemMessage]);
    setShowFileImport(false);
  };

  const handleRemoveFile = (fileName: string) => {
    setImportedFiles((prev) => prev.filter((f) => f.name !== fileName));
  };

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || isLoading || !conversationId || !serverReady) return;

    const userContent = text;
    if (!overrideText) setInput("");
    setIsLoading(true);

    // Create AbortController for this generation
    abortControllerRef.current = new AbortController();
    const currentAbortController = abortControllerRef.current;

    // Track listeners for cleanup
    let unlistenChunk: UnlistenFn | null = null;
    let unlistenComplete: UnlistenFn | null = null;
    let unlistenError: UnlistenFn | null = null;

    try {
      // Server is already started by useEffect

      // Prepare message with file context if files are imported
      let messageWithContext = userContent;
      if (importedFiles.length > 0) {
        const fileContext = importedFiles
          .map(
            (file) =>
              `[REFERENCE DOCUMENT: ${file.name}]\n${file.content}\n[END DOCUMENT]`
          )
          .join("\n\n");
        messageWithContext = `SYSTEM: The following documents are provided as reference context. Do not repeat or summarize their content unless explicitly asked. Use them to answer questions accurately.\n\n${fileContext}\n\n---\n\nUser: ${userContent}`;
      }

      // Save user message to DB (original message without file context for UI)
      const userMsgId = await invoke<number>("add_message", {
        conversationId: parseInt(conversationId),
        role: "user",
        content: userContent,
      });

      const userMessage: Message = {
        id: String(userMsgId),
        role: "user",
        content: userContent,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);

      // Create temporary assistant message for streaming
      const tempId = `temp-${Date.now()}`;
      const tempMessage: Message = {
        id: tempId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, tempMessage]);
      lastTempIdRef.current = tempId;
      lastGenContentRef.current = "";
      setGenStartAt(Date.now());

      // Listen for streaming chunks
      unlistenChunk = await listen<string>("generation-chunk", (event) => {
        const chunk = sanitizeLLM(event.payload || "");
        lastGenContentRef.current += chunk;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId ? { ...msg, content: msg.content + chunk } : msg
          )
        );
      });

      // Listen for completion
      unlistenComplete = await listen<string>("generation-complete", () => {
        if (!currentAbortController.signal.aborted) {
          setIsLoading(false);
        }
        if (genStartAt) {
          const durationSec = Math.max(0.01, (Date.now() - genStartAt) / 1000);
          const content = lastGenContentRef.current || "";
          const words = content.trim() ? content.trim().split(/\s+/).length : 0;
          const tokens = Math.ceil(content.length / 4);
          const speedWps = words > 0 ? words / durationSec : 0;
          setLastStats({ words, tokens, durationSec, speedWps });
        }
        // Cleanup listeners
        if (unlistenChunk) unlistenChunk();
        if (unlistenComplete) unlistenComplete();
        if (unlistenError) unlistenError();
        abortControllerRef.current = null;
      });

      // Listen for errors
      unlistenError = await listen<string>("generation-error", (event) => {
        console.error("Generation error:", event.payload);
        // Remove temporary message and show error
        setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `Error: ${event.payload}`,
            timestamp: new Date(),
          },
        ]);
        setIsLoading(false);
        // Cleanup listeners
        if (unlistenChunk) unlistenChunk();
        if (unlistenComplete) unlistenComplete();
        if (unlistenError) unlistenError();
        abortControllerRef.current = null;
      });

      // Start generation (use message with file context)
      await invoke("generate_text", {
        conversationId: parseInt(conversationId),
        userMessage: messageWithContext,
      });
    } catch (err) {
      console.error("Failed to send message:", err);
      setIsLoading(false);
      // Cleanup listeners if error
      if (unlistenChunk) unlistenChunk();
      if (unlistenComplete) unlistenComplete();
      if (unlistenError) unlistenError();
      abortControllerRef.current = null;
    }
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const getLastUserMessage = (): Message | undefined => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m && m.role === "user") return m;
    }
    return undefined;
  };

  const getLastAssistantMessage = (): Message | undefined => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m && m.role === "assistant") return m;
    }
    return undefined;
  };

  const handleEditLast = () => {
    const lastUser = getLastUserMessage();
    if (!lastUser) return;
    setInput(lastUser.content);
    inputRef.current?.focus();
  };

  const handleCopyLast = () => {
    const lastAssistant = getLastAssistantMessage();
    const lastUser = getLastUserMessage();
    const text = lastAssistant?.content || lastUser?.content || "";
    if (text) navigator.clipboard.writeText(text);
  };

  const handleRegenerateLast = () => {
    const lastUser = getLastUserMessage();
    if (!lastUser) return;
    handleSend(lastUser.content);
  };

  // No enter/exit helpers here: the TitleBar gamepad button is the single UI control for overlay mode.

  useEffect(() => {
    if (!overlayEnabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        (async () => {
          try {
            await invoke("set_overlay_mode", { enabled: false });
            setOverlayEnabled(false);
            setStorageItem("overlayEnabled", "false");
            try {
              await invoke("set_click_through", { enabled: false });
            } catch (err) {
              console.debug("[Overlay] disable click-through err", err);
            }
            window.dispatchEvent(
              new CustomEvent("overlaychange", { detail: { enabled: false } })
            );
          } catch (err) {
            console.error("Failed to disable overlay:", err);
          }
        })();
      }
      // Toggle click-through with F8 while in overlay
      if (e.key === "F8") {
        const next = !overlayPassthrough;
        setOverlayPassthrough(next);
        setStorageItem("overlayPassthrough", next ? "true" : "false");
      }
      // User-configured overlay toggle key (app focused)
      if (overlayToggleKey && e.key === overlayToggleKey) {
        (async () => {
          try {
            const next = !overlayEnabled;
            await invoke("set_overlay_mode", { enabled: next });
            setOverlayEnabled(next);
            setStorageItem("overlayEnabled", next ? "true" : "false");
            try {
              await invoke("set_click_through", { enabled: false });
            } catch (err) {
              console.debug("[Overlay] toggle set_click_through err", err);
            }
            window.dispatchEvent(
              new CustomEvent("overlaychange", { detail: { enabled: next } })
            );
          } catch (err) {
            console.error("Failed to toggle overlay via key:", err);
          }
        })();
      }
    };
    window.addEventListener("keydown", onKey as any);
    return () => window.removeEventListener("keydown", onKey as any);
  }, [
    overlayEnabled,
    overlayPassthrough,
    overlayToggleKey,
    overlayAutoPassthrough,
    overlayControlsIdleSec,
  ]);

  // Apply click-through when overlay + passthrough enabled
  useEffect(() => {
    (async () => {
      try {
        await invoke("set_click_through", {
          enabled: overlayEnabled && overlayPassthrough,
        });
      } catch (e) {
        console.error("Failed to set click-through:", e);
      }
    })();
  }, [overlayEnabled, overlayPassthrough]);

  // Listen to overlay changes (from TitleBar) to keep Chat UI in sync
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { enabled?: boolean }
        | undefined;
      if (detail && typeof detail.enabled === "boolean") {
        setOverlayEnabled(detail.enabled);
      } else {
        // Fallback: read from storage
        setOverlayEnabled(getStorageBoolean("overlayEnabled", false));
      }
    };
    window.addEventListener("overlaychange", handler as any);
    return () => window.removeEventListener("overlaychange", handler as any);
  }, []);

  // Listen to overlay preferences change (from Settings)
  useEffect(() => {
    const onPrefs = (_e: Event) => {
      try {
        setOverlayAutoPassthrough(
          getStorageBoolean("overlayAutoPassthrough", true)
        );
        setOverlayControlsIdleSec(
          getStorageNumberWithClamp("overlayControlsIdleSec", 2, 1, 5)
        );
        setOverlayToggleKey(localStorage.getItem("overlayToggleKey") || "");
        setOverlayShowDragStrip(
          getStorageBoolean("overlayShowDragStrip", true)
        );
      } catch (err) {
        console.debug("[Overlay] prefs update err", err);
      }
    };
    window.addEventListener("overlayprefschange", onPrefs as any);
    return () =>
      window.removeEventListener("overlayprefschange", onPrefs as any);
  }, []);

  // (Optional) Bounds persistence intentionally skipped for now to avoid adding Tauri v1-only APIs.

  // idle-based auto hide for overlay controls
  const bumpOverlayControls = () => {
    if (!overlayEnabled) return;
    setShowOverlayControls(true);
    if (hideControlsTimer.current)
      window.clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = window.setTimeout(
      () => setShowOverlayControls(false),
      Math.max(500, Math.min(5000, overlayControlsIdleSec * 1000)) as number
    );
  };

  const effectiveOpacity = overlayEnabled
    ? Math.max(0.2, Math.min(1, overlayOpacity * (isOverlayHover ? 1 : 0.85)))
    : 1;

  return (
    <div
      className={`flex flex-col ${overlayEnabled ? "h-screen" : "h-[calc(100vh-2.5rem)]"} ${overlayEnabled ? "bg-transparent" : "bg-gray-50 dark:bg-gray-900"} transition-colors relative ${overlayEnabled ? "text-[13px]" : ""}`}
      style={
        overlayEnabled
          ? { opacity: effectiveOpacity, backgroundColor: "transparent" }
          : undefined
      }
      onMouseMove={bumpOverlayControls}
      onMouseEnter={() => {
        if (overlayEnabled) {
          setIsOverlayHover(true);
          if (overlayAutoPassthrough) {
            setOverlayPassthrough(false);
            setStorageItem("overlayPassthrough", "false");
          }
          bumpOverlayControls();
        }
      }}
      onMouseLeave={() => {
        if (overlayEnabled) {
          setIsOverlayHover(false);
          if (overlayAutoPassthrough) {
            setOverlayPassthrough(true);
            setStorageItem("overlayPassthrough", "true");
          }
        }
      }}
    >
      {/* Extra drag strip for overlay (does not cover top-right controls) */}
      {overlayEnabled && overlayShowDragStrip && (
        <div
          className="absolute top-0 left-0 right-40 h-4 z-40"
          data-tauri-drag-region
        />
      )}

      {/* Header (hidden in overlay) */}
      {!overlayEnabled && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate("home")}
              className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors"
            >
              ← {i18n.t("home.title")}
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {conversationName}
              </h1>
              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <Bot size={14} /> {i18n.t("chat.model")}: {modelName}
                </span>
                {conversationGroup && (
                  <span className="flex items-center gap-1">
                    <Folder size={14} /> {i18n.t("chat.group")}:{" "}
                    {conversationGroup}
                  </span>
                )}
                {importedFiles.length > 0 && (
                  <span className="flex items-center gap-1">
                    <FileText size={14} /> Files: {importedFiles.length}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFileImport(true)}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-800 shadow-sm hover:shadow-md transition-all flex items-center gap-2"
              title={i18n.t("chat.importFile.button")}
            >
              <FileText size={14} /> {i18n.t("chat.importFile.button")}
            </button>
            <button
              onClick={() => onNavigate("newConversation")}
              className="px-4 py-2 text-sm rounded-lg bg-gray-800 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 shadow-sm hover:shadow-md transition-all flex items-center gap-2"
            >
              <Plus size={14} /> {i18n.t("chat.newChat")}
            </button>
            <button
              onClick={() => setMessages([])}
              className="px-4 py-2 text-sm rounded-lg bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 shadow-sm hover:shadow-md transition-all flex items-center gap-2 border border-gray-300 dark:border-gray-600"
            >
              <Trash2 size={14} /> {i18n.t("chat.clearChat")}
            </button>
            {/* Overlay toggle is controlled exclusively by the TitleBar gamepad button */}
          </div>
        </div>
      )}

      {/* Floating unpin when overlay */}
      {/* No floating unpin: the TitleBar gamepad button is the single overlay toggle control */}

      {/* Overlay opacity control */}
      {overlayEnabled && (
        <div
          className={`fixed top-1 left-2 z-50 flex items-center gap-2 bg-gray-800/80 text-white rounded-md px-2 py-1 text-xs transition-opacity ${showOverlayControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          data-tauri-drag-region="false"
        >
          <span>{i18n.t("ui.overlayOpacity")}</span>
          <input
            type="range"
            min={50}
            max={100}
            step={5}
            value={Math.round(overlayOpacity * 100)}
            onChange={(e) => {
              const v = Math.max(
                50,
                Math.min(100, parseInt(e.target.value || "100", 10))
              );
              const f = v / 100;
              setOverlayOpacity(f);
              setStorageItem("overlayOpacity", String(f));
            }}
          />
        </div>
      )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className={`flex-1 overflow-y-auto ${overlayEnabled ? "px-3 py-3 space-y-3" : "px-6 py-6 space-y-4"}`}
      >
        {isInitializing ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <div className="inline-block p-6 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                <Loader2 size={64} className="text-blue-500 animate-spin" />
              </div>
              <p className="text-lg font-medium">
                {i18n.t("chat.initializing")}
              </p>
              <p className="text-sm mt-2 text-gray-400">
                {i18n.t("chat.loadingModel")}
              </p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <div className="inline-block p-6 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                <MessageSquare size={64} className="text-gray-400" />
              </div>
              <p className="text-lg font-medium">{i18n.t("chat.emptyState")}</p>
              <p className="text-sm mt-2 text-gray-400">
                Start typing to begin your conversation
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              role={message.role}
              content={message.content}
              timestamp={message.timestamp}
              compact={overlayEnabled}
              showAvatars={!overlayEnabled}
              isStreaming={isLoading && message.id.startsWith("temp-")}
              onCopy={() => copyMessage(message.content)}
            />
          ))
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-3xl w-full">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center">
                  <Bot size={18} />
                </div>
                <div className="flex-1">
                  <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/50">
                    <Loader2
                      size={14}
                      className="animate-spin text-gray-500 dark:text-gray-400"
                    />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ...
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        className={`${overlayEnabled ? "bg-white/60 dark:bg-gray-800/50 backdrop-blur-md" : "bg-white dark:bg-gray-800"} border-t border-gray-200 dark:border-gray-700 px-6 py-5 shadow-sm`}
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {[
              i18n.t("chat.suggestions.summarize"),
              i18n.t("chat.suggestions.translate"),
              i18n.t("chat.suggestions.explain"),
              i18n.t("chat.suggestions.improve"),
            ].map((label) => (
              <button
                key={label}
                onClick={() => {
                  setInput(label + ": ");
                  inputRef.current?.focus();
                }}
                className="px-3 py-1.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={i18n.t("chat.placeholder")}
              rows={1}
              disabled={isLoading || !serverReady}
              className="flex-1 px-4 py-3 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent resize-none disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
              style={{ minHeight: "48px", maxHeight: "200px" }}
            />
            <button
              onClick={isLoading ? stopGeneration : () => handleSend()}
              disabled={(!input.trim() && !isLoading) || !serverReady}
              className={`rounded-lg ${overlayEnabled ? "px-3 py-2" : "px-8 py-3"} ${isLoading ? "bg-red-600 dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-800" : "bg-gray-800 dark:bg-gray-700 hover:bg-gray-700 dark:hover:bg-gray-600"} text-white font-semibold disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed shadow-sm hover:shadow-md transition-all flex items-center gap-2`}
              title={
                overlayEnabled
                  ? isLoading
                    ? i18n.t("chat.stop")
                    : i18n.t("chat.send")
                  : undefined
              }
            >
              {isLoading ? <StopCircle size={16} /> : <Send size={16} />}
              {!overlayEnabled && (
                <> {isLoading ? i18n.t("chat.stop") : i18n.t("chat.send")} </>
              )}
            </button>
            <button
              onClick={() => setShowFileImport(true)}
              disabled={isLoading || !serverReady}
              className="p-3 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed shadow-sm transition-all"
              title="Import file"
            >
              <FileText size={20} />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <div className="text-gray-500 dark:text-gray-400">
              {lastStats && (
                <span>
                  {lastStats.words} {i18n.t("chat.stats.words")} •{" "}
                  {lastStats.tokens} {i18n.t("chat.stats.tokensApprox")} •{" "}
                  {lastStats.durationSec.toFixed(1)}{" "}
                  {i18n.t("chat.stats.duration")} •{" "}
                  {lastStats.speedWps.toFixed(1)} {i18n.t("chat.stats.speed")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
              <button onClick={handleEditLast} className="hover:underline">
                {i18n.t("chat.actions.editLast")}
              </button>
              <button onClick={handleCopyLast} className="hover:underline">
                {i18n.t("chat.actions.copyLast")}
              </button>
              <button
                onClick={handleRegenerateLast}
                className="hover:underline"
              >
                {i18n.t("chat.actions.regenerateLast")}
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center flex items-center justify-center gap-1">
            <Lightbulb size={12} /> {i18n.t("chat.model")}: {modelName} • 100%
            local • Aucune donnée envoyée
          </p>
        </div>
      </div>

      {/* File Import Modal */}
      {showFileImport && (
        <FileImport
          onFileImported={handleFileImported}
          onClose={() => setShowFileImport(false)}
        />
      )}

      {/* Imported Files Display */}
      {importedFiles.length > 0 && (
        <div className="px-6 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 flex-wrap">
            <FileText size={16} className="text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
              {i18n.t("chat.importFile.attached")}:
            </span>
            {importedFiles.map((file) => (
              <div
                key={file.name}
                className="flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/40 rounded-full text-sm"
              >
                <span className="text-blue-900 dark:text-blue-100">
                  {file.name} ({file.size} KB)
                </span>
                <button
                  onClick={() => handleRemoveFile(file.name)}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
