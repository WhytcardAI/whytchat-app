import { useEffect, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useServer } from "../../contexts/ServerContext";
import { i18n } from "../../i18n";

interface Diagnostics {
  status: {
    installed: boolean;
    version: string | null;
    path: string | null;
    running: boolean;
    pid: number | null;
  };
  bin_dir: string | null;
  env_path_head: string | null;
}

interface Props {
  onClose: () => void;
}

export function ServerDebugModal({ onClose }: Props) {
  const [logs, setLogs] = useState<string[]>([]);
  const [diag, setDiag] = useState<Diagnostics | null>(null);
  const { startServer, stopServer, status } = useServer();
  const [actionPending, setActionPending] = useState(false);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    (async () => {
      try {
        const initial = await invoke<string[]>("get_llama_logs");
        setLogs(initial);
      } catch {
        // Ignore errors when fetching initial logs
      }
      try {
        const d = await invoke<Diagnostics>("get_server_diagnostics");
        setDiag(d);
      } catch {
        // Ignore errors when fetching diagnostics
      }
      unlisten = await listen<string>("llama-log", (e) => {
        setLogs((prev) => [...prev, e.payload]);
      });
    })();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleClear = async () => {
    try {
      await invoke("clear_llama_logs");
      setLogs([]);
    } catch {
      // Ignore errors when clearing logs
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-3xl bg-white dark:bg-gray-900 rounded-lg shadow-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {i18n.t("settings.debug.title")} - {status}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (actionPending) return;
                setActionPending(true);
                try {
                  await startServer();
                } catch (e) {
                  console.error("[DebugModal] startServer failed", e);
                } finally {
                  setActionPending(false);
                }
              }}
              disabled={
                actionPending || status === "starting" || status === "ready"
              }
              className="px-3 py-1 text-xs bg-green-600 disabled:bg-green-900/40 text-white rounded hover:bg-green-700 disabled:cursor-not-allowed"
            >
              {i18n.t("ui.start")}
            </button>
            <button
              onClick={async () => {
                if (actionPending) return;
                setActionPending(true);
                try {
                  await stopServer();
                } catch (e) {
                  console.error("[DebugModal] stopServer failed", e);
                } finally {
                  setActionPending(false);
                }
              }}
              disabled={
                actionPending || status === "stopped" || status === "checking"
              }
              className="px-3 py-1 text-xs bg-red-600 disabled:bg-red-900/40 text-white rounded hover:bg-red-700 disabled:cursor-not-allowed"
            >
              {i18n.t("chat.stop")}
            </button>
            <button
              onClick={handleClear}
              className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              Clear
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
        <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="col-span-1 text-xs text-gray-700 dark:text-gray-300 space-y-1">
            <div>
              <span className="font-medium">Installed:</span>{" "}
              {diag?.status.installed ? "Yes" : "No"}
            </div>
            <div>
              <span className="font-medium">Running:</span>{" "}
              {diag?.status.running
                ? `Yes (PID ${diag?.status.pid ?? "?"})`
                : "No"}
            </div>
            <div>
              <span className="font-medium">Binary:</span>{" "}
              <span className="break-all">{diag?.status.path ?? "-"}</span>
            </div>
            <div>
              <span className="font-medium">Bin dir:</span>{" "}
              <span className="break-all">{diag?.bin_dir ?? "-"}</span>
            </div>
            <div>
              <span className="font-medium">PATH head:</span>{" "}
              <span className="break-all">{diag?.env_path_head ?? "-"}</span>
            </div>
          </div>
          <div className="col-span-1 md:col-span-2">
            <div className="h-72 md:h-96 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-800 overflow-auto p-2 text-xs font-mono leading-5 text-gray-800 dark:text-gray-100">
              {logs.length === 0 ? (
                <div className="text-gray-500 dark:text-gray-400">
                  No logs yet.
                </div>
              ) : (
                logs.map((l, i) => (
                  <div key={i} className="whitespace-pre-wrap">
                    {l}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
