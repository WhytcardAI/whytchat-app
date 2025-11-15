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
  Database,
  Link,
  X,
} from "lucide-react";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { MessageBubble } from "./components/MessageBubble";
import {
  listDatasets,
  listDatasetsForConversation,
  linkDatasetToConversation,
  unlinkDatasetFromConversation,
  createDataset,
  deleteDataset,
  ingestText,
} from "../../rag/api";

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

  // Dataset state
  const [linkedDatasets, setLinkedDatasets] = useState<string[]>([]);
  const [availableDatasets, setAvailableDatasets] = useState<
    Array<{ id: string; name: string; created_at: string }>
  >([]);
  const [showDatasetModal, setShowDatasetModal] = useState(false);
  const [newDatasetName, setNewDatasetName] = useState("");
  const [ingestTextContent, setIngestTextContent] = useState("");
  const [selectedDatasetForIngest, setSelectedDatasetForIngest] = useState("");
  const [isCreatingDataset, setIsCreatingDataset] = useState(false);
  const [isIngestingText, setIsIngestingText] = useState(false);

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
  useEffect(() => {
    if (!conversationId) return;

    (async () => {
      try {
        // Load all available datasets
        const datasets = await listDatasets();
        setAvailableDatasets(datasets);

        // Load datasets linked to this conversation
        const linked = await listDatasetsForConversation(
          parseInt(conversationId)
        );
        setLinkedDatasets(linked);
      } catch (err) {
        console.error("[RAG] Failed to load datasets:", err);
      }
    })();
  }, [conversationId]);

  // Dataset handlers
  const handleLinkDataset = async (datasetId: string) => {
    if (!conversationId) return;
    try {
      await linkDatasetToConversation(parseInt(conversationId), datasetId);
      setLinkedDatasets((prev) => [...prev, datasetId]);
    } catch (err) {
      console.error("[RAG] Failed to link dataset:", err);
      alert(`Failed to link dataset: ${err}`);
    }
  };

  const handleUnlinkDataset = async (datasetId: string) => {
    if (!conversationId) return;
    try {
      await unlinkDatasetFromConversation(parseInt(conversationId), datasetId);
      setLinkedDatasets((prev) => prev.filter((id) => id !== datasetId));
    } catch (err) {
      console.error("[RAG] Failed to unlink dataset:", err);
      alert(`Failed to unlink dataset: ${err}`);
    }
  };

  const handleCreateDataset = async () => {
    if (!newDatasetName.trim()) return;
    setIsCreatingDataset(true);
    try {
      const dataset = await createDataset(newDatasetName.trim());
      setAvailableDatasets((prev) => [...prev, dataset]);
      setNewDatasetName("");
      alert(`Dataset "${dataset.name}" created successfully!`);
    } catch (err) {
      console.error("[RAG] Failed to create dataset:", err);
      alert(`Failed to create dataset: ${err}`);
    } finally {
      setIsCreatingDataset(false);
    }
  };

  const handleDeleteDataset = async (datasetId: string) => {
    if (!confirm("Are you sure you want to delete this dataset?")) return;
    try {
      await deleteDataset(datasetId);
      setAvailableDatasets((prev) => prev.filter((d) => d.id !== datasetId));
      setLinkedDatasets((prev) => prev.filter((id) => id !== datasetId));
    } catch (err) {
      console.error("[RAG] Failed to delete dataset:", err);
      alert(`Failed to delete dataset: ${err}`);
    }
  };

  const handleIngestText = async () => {
    if (!selectedDatasetForIngest || !ingestTextContent.trim()) return;
    setIsIngestingText(true);
    try {
      const result = await ingestText(
        selectedDatasetForIngest,
        ingestTextContent.trim()
      );
      alert(`Ingested ${result.chunks} chunks successfully!`);
      setIngestTextContent("");
    } catch (err) {
      console.error("[RAG] Failed to ingest text:", err);
      alert(`Failed to ingest text: ${err}`);
    } finally {
      setIsIngestingText(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !conversationId || !serverReady) return;

    const userContent = input.trim();
    setInput("");
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

      // Save user message to DB
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

      // Listen for streaming chunks
      unlistenChunk = await listen<string>("generation-chunk", (event) => {
        const chunk = sanitizeLLM(event.payload || "");
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

      // Start generation
      await invoke("generate_text", {
        conversationId: parseInt(conversationId),
        userMessage: userContent,
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
                {linkedDatasets.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Database size={14} /> Datasets: {linkedDatasets.length}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDatasetModal(true)}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-800 shadow-sm hover:shadow-md transition-all flex items-center gap-2"
            >
              <Database size={14} /> Datasets
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
              onClick={isLoading ? stopGeneration : handleSend}
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
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center flex items-center justify-center gap-1">
            <Lightbulb size={12} /> {i18n.t("chat.model")}: {modelName} • 100%
            local • Aucune donnée envoyée
          </p>
        </div>
      </div>

      {/* Dataset Management Modal */}
      {showDatasetModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowDatasetModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Database size={24} /> Dataset Management
              </h2>
              <button
                onClick={() => setShowDatasetModal(false)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            {/* Create Dataset */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Create New Dataset
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newDatasetName}
                  onChange={(e) => setNewDatasetName(e.target.value)}
                  placeholder="Dataset name..."
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateDataset();
                  }}
                />
                <button
                  onClick={handleCreateDataset}
                  disabled={!newDatasetName.trim() || isCreatingDataset}
                  className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  {isCreatingDataset ? "Creating..." : "Create"}
                </button>
              </div>
            </div>

            {/* Ingest Text */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Ingest Text into Dataset
              </h3>
              <select
                value={selectedDatasetForIngest}
                onChange={(e) => setSelectedDatasetForIngest(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
              >
                <option value="">Select dataset...</option>
                {availableDatasets.map((dataset) => (
                  <option key={dataset.id} value={dataset.id}>
                    {dataset.name}
                  </option>
                ))}
              </select>
              <textarea
                value={ingestTextContent}
                onChange={(e) => setIngestTextContent(e.target.value)}
                placeholder="Paste your text here to ingest into the selected dataset..."
                rows={4}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-2"
              />
              <button
                onClick={handleIngestText}
                disabled={
                  !selectedDatasetForIngest ||
                  !ingestTextContent.trim() ||
                  isIngestingText
                }
                className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                {isIngestingText ? "Ingesting..." : "Ingest Text"}
              </button>
            </div>

            {/* Dataset List */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Available Datasets
              </h3>
              {availableDatasets.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  No datasets yet. Create one above to get started.
                </p>
              ) : (
                <div className="space-y-2">
                  {availableDatasets.map((dataset) => {
                    const isLinked = linkedDatasets.includes(dataset.id);
                    return (
                      <div
                        key={dataset.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                              {dataset.name}
                            </h4>
                            {isLinked && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 flex items-center gap-1">
                                <Link size={10} /> Linked
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Created: {new Date(dataset.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isLinked ? (
                            <button
                              onClick={() => handleUnlinkDataset(dataset.id)}
                              className="px-3 py-1.5 text-xs rounded-lg bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-800"
                            >
                              Unlink
                            </button>
                          ) : (
                            <button
                              onClick={() => handleLinkDataset(dataset.id)}
                              className="px-3 py-1.5 text-xs rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800"
                            >
                              Link
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteDataset(dataset.id)}
                            className="px-3 py-1.5 text-xs rounded-lg bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
