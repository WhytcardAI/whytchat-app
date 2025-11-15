import type { ReactNode } from "react";
import { createContext, useContext, useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

type ServerStatus = "checking" | "starting" | "ready" | "stopped" | "error";

interface ServerContextType {
  status: ServerStatus;
  error: string | null;
  isReady: boolean;
  startServer: (modelPath?: string) => Promise<void>;
  startForConversation: (conversationId: number) => Promise<void>;
  stopServer: () => Promise<void>;
}

const ServerContext = createContext<ServerContextType | undefined>(undefined);

export function ServerProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ServerStatus>("checking");
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const isClosingRef = useRef(false);
  const lastStartRef = useRef<number>(0);

  console.log("[ServerProvider] Initialized with status:", status);

  // Reusable health check function
  const performHealthCheck = async (): Promise<boolean> => {
    console.log("[ServerContext] Starting health checks (max 30 attempts)...");
    const maxAttempts = 30;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const isHealthy = await invoke<boolean>("health_check_llama_server");
        console.log(
<<<<<<< HEAD
          `[ServerContext] Health check ${i + 1}/${maxAttempts}: ${isHealthy}`
=======
          console.log(`[ServerContext] Health check ${i + 1}/${maxAttempts}: ${String(isHealthy)}`);
>>>>>>> f1d3a2dd6f5a94e4a34ac0cc814a923dee7644e7
        );
        if (isHealthy) {
          console.log("[ServerContext] ✓ Server is healthy!");
          return true;
        }
      } catch (healthErr) {
        console.error(
          `[ServerContext] Health check ${i + 1} error:`,
          healthErr
        );
      }

      // Don't wait after last attempt
      if (i < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return false;
  };

  const startServer = async (modelPath?: string) => {
    // Prevent concurrent starts
    const now = Date.now();
    if (
      isStarting ||
      now - lastStartRef.current < 3000 ||
      status === "starting" ||
      status === "ready"
    ) {
      console.warn("[ServerContext] Start already in progress, ignoring");
      return;
    }
    lastStartRef.current = now;

    setIsStarting(true);
    console.log("[ServerContext] ====== START SERVER REQUESTED ======");
    console.log("[ServerContext] ModelPath:", modelPath);

    try {
      try {
        const alreadyHealthy = await invoke<boolean>(
          "health_check_llama_server"
        );
        if (alreadyHealthy) {
          setStatus("ready");
          setError(null);
          setIsStarting(false);
          return;
        }
      } catch (e) {
        console.debug("[ServerContext] Pre-flight health check failed:", e);
      }

      setStatus("starting");
      setError(null);

      // Prefer explicit modelPath if provided (advanced/manual)
      if (modelPath) {
        console.log("[ServerContext] Invoking start_llama_server with:", {
          modelPath,
          ctxSize: 2048,
        });
        try {
          await invoke("start_llama_server", {
            modelPath,
            ctxSize: 2048,
          });
          console.log("[ServerContext] start_llama_server command completed");
        } catch (startErr) {
          console.error("[ServerContext] start_llama_server failed:", startErr);
          setStatus("error");
          setError(`Failed to start: ${String(startErr)}`);
          setIsStarting(false);
          return;
        }
      } else {
        // Otherwise, pick the first installed preset and start by preset id
        console.log(
          "[ServerContext] No model path specified, selecting first installed preset..."
        );
        try {
          const pack = await invoke<{
            id: string;
            url: string;
            filename: string;
          } | null>("get_first_installed_preset");
          if (!pack) {
            setStatus("error");
            setError(
              "No installed models found. Please download a model first."
            );
            setIsStarting(false);
            return;
          }
          console.log("[ServerContext] Starting with preset:", pack.id);
          await invoke("start_llama_with_preset", { presetId: pack.id });
          console.log("[ServerContext] start_llama_with_preset completed");
        } catch (err) {
          console.error("[ServerContext] Failed to start by preset:", err);
          setStatus("error");
          setError(`Failed to start by preset: ${String(err)}`);
          setIsStarting(false);
          return;
        }
      }

      // Wait initial time for server to initialize
      console.log("[ServerContext] Waiting 2s for server initialization...");
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Perform health check
      const ready = await performHealthCheck();

      if (ready) {
        console.log("[ServerContext] ====== SERVER READY ======");
        setStatus("ready");
      } else {
        console.error("[ServerContext] ====== SERVER NOT RESPONDING ======");
        setStatus("error");
        setError("Server not responding after 30s. Check console for details.");
      }
    } catch (err) {
      console.error("[ServerContext] FATAL ERROR in startServer:", err);
      setStatus("error");
      setError(`Fatal error: ${String(err)}`);
    } finally {
      setIsStarting(false);
      console.log("[ServerContext] ====== START SERVER COMPLETE ======");
    }
  };

  const startForConversation = async (conversationId: number) => {
    // Prevent concurrent starts
    const now = Date.now();
    if (
      isStarting ||
      now - lastStartRef.current < 3000 ||
      status === "starting" ||
      status === "ready"
    ) {
      console.warn("[ServerContext] Start already in progress, ignoring");
      return;
    }
    lastStartRef.current = now;

    setIsStarting(true);
    console.log("[ServerContext] ====== START FOR CONVERSATION ======");
    console.log("[ServerContext] ConversationId:", conversationId);

    try {
      // Pre-flight: if server is already healthy (external or previous run), don't spawn a new one
      try {
        const alreadyHealthy = await invoke<boolean>(
          "health_check_llama_server"
        );
        if (alreadyHealthy) {
          setStatus("ready");
          setError(null);
          setIsStarting(false);
          return;
        }
      } catch (e) {
        console.debug(
          "[ServerContext] Pre-flight health check (conversation) failed:",
          e
        );
      }

      setStatus("starting");
      setError(null);

      // Try to start the server
      console.log("[ServerContext] Invoking start_llama_for_conversation...");
      try {
        await invoke("start_llama_for_conversation", {
          conversationId,
        });
        console.log("[ServerContext] start_llama_for_conversation completed");
      } catch (startErr) {
        console.error(
          "[ServerContext] start_llama_for_conversation failed:",
          startErr
        );
        setStatus("error");
        setError(`Failed to start: ${String(startErr)}`);
        setIsStarting(false);
        return;
      }

      // Wait longer initially for server to fully start
      console.log("[ServerContext] Waiting 2s for server initialization...");
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Perform health check
      const ready = await performHealthCheck();

      if (ready) {
        console.log("[ServerContext] ====== SERVER READY ======");
        setStatus("ready");
      } else {
        console.error("[ServerContext] ====== SERVER NOT RESPONDING ======");
        setStatus("error");
        setError("Server not responding after 30s. Check console.");
      }
    } catch (err) {
      console.error(
        "[ServerContext] FATAL ERROR in startForConversation:",
        err
      );
      setStatus("error");
      setError(`Fatal error: ${String(err)}`);
    } finally {
      setIsStarting(false);
      console.log(
        "[ServerContext] ====== START FOR CONVERSATION COMPLETE ======"
      );
    }
  };

  const stopServer = async () => {
    console.log("[ServerContext] ====== STOP SERVER REQUESTED ======");
    try {
      await invoke("stop_llama_server");
      console.log("[ServerContext] stop_llama_server completed");
      setStatus("stopped");
      setError(null);
      console.log("[ServerContext] ====== SERVER STOPPED ======");
    } catch (err) {
      console.error("[ServerContext] Failed to stop server:", err);
      setError(`Failed to stop: ${String(err)}`);
    }
  };

  // Check server status on mount (no auto-start to avoid crashes)
  useEffect(() => {
    console.log("[ServerContext] ====== INITIALIZING ======");
    let cleanupWindowListener: (() => void) | undefined;
    let cleanupModelInstalled: (() => void) | undefined;
    let cleanupPackInstalled: (() => void) | undefined;

    (async () => {
      try {
        setStatus("checking");
        console.log("[ServerContext] Checking llama-server status...");

        const serverStatus = await invoke<{
          installed: boolean;
          running: boolean;
        }>("check_llama_server");

        console.log("[ServerContext] Server status:", serverStatus);

        if (!serverStatus.installed) {
          console.warn("[ServerContext] llama-server not installed");
          setStatus("stopped");
          setError("llama-server not installed");
          return;
        }

        if (serverStatus.running) {
          console.log(
            "[ServerContext] Server already running from previous session, stopping it..."
          );
          try {
            await invoke("stop_server_process");
            console.log(
              "[ServerContext] Previous server instance stopped successfully"
            );
          } catch (stopErr) {
            console.error(
              "[ServerContext] Failed to stop previous server:",
              stopErr
            );
          }
          setStatus("stopped");
        }

        // Check for models but DON'T auto-start
        console.log("[ServerContext] Checking for installed models...");
        try {
          const pack = await invoke<{
            id: string;
            url: string;
            filename: string;
          } | null>("get_first_installed_preset");
          if (pack) {
            console.log(
              "[ServerContext] Model available (" +
                pack.id +
                "), ready to start manually."
            );
            setStatus("stopped");
            setError(null);
          } else {
            console.log(
              "[ServerContext] No models installed. Please download a model first."
            );
            setStatus("stopped");
            setError(
              "No models installed. Please download a model from Settings."
            );
          }
        } catch (checkErr) {
          console.error("[ServerContext] Model check failed:", checkErr);
          setStatus("stopped");
          setError(
            "No models installed. Please download a model from Settings."
          );
        }
      } catch (err) {
        console.error("[ServerContext] FATAL ERROR during init:", err);
        setStatus("error");
        setError(`Init error: ${String(err)}`);
      }
      console.log("[ServerContext] ====== INITIALIZATION COMPLETE ======");
    })();

    // Add window close listener for auto-stop
    (async () => {
      try {
        const window = getCurrentWindow();
        cleanupWindowListener = await window.onCloseRequested(async (event) => {
          if (isClosingRef.current) {
            console.log(
              "[ServerContext] Close already in progress; ignoring duplicate event"
            );
            event.preventDefault();
            return;
          }
          isClosingRef.current = true;
          console.log(
            "[ServerContext] Window close requested, stopping server..."
          );
          // Prevent the default close so we can stop gracefully, then close programmatically
          event.preventDefault();
          try {
            await stopServer();
            console.log(
              "[ServerContext] Server stopped successfully before app close"
            );
          } catch (stopErr) {
            console.error(
              "[ServerContext] Failed to stop server on close:",
              stopErr
            );
          } finally {
            // Force-destroy the window to avoid being blocked by this handler
            try {
              await window.destroy();
            } catch {
              // Fallback in case destroy is not available
              await window.close();
            }
          }
        });
      } catch (listenerErr) {
        console.error(
          "[ServerContext] Failed to setup window close listener:",
          listenerErr
        );
      }
    })();

    // Model installation listeners removed - server starts only when entering a conversation
    // No auto-start after download to save resources

    return () => {
      if (cleanupWindowListener) {
        cleanupWindowListener();
      }
      if (cleanupModelInstalled) {
        cleanupModelInstalled();
      }
      if (cleanupPackInstalled) {
        cleanupPackInstalled();
      }
    };
  }, []);

  return (
    <ServerContext.Provider
      value={{
        status,
        error,
        isReady: status === "ready",
        startServer,
        startForConversation,
        stopServer,
      }}
    >
      {children}
    </ServerContext.Provider>
  );
}

export function useServer() {
  const context = useContext(ServerContext);
  if (!context) {
    throw new Error("useServer must be used within ServerProvider");
  }
  return context;
}
