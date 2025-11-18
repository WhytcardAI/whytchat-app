import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { X, Minus, Square, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { i18n } from "../../i18n";

interface TitleBarProps {
  title?: string;
  onNavigate?: (view: string) => void;
}

export function TitleBar({ title, onNavigate }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  const handleMinimize = async () => {
    const window = getCurrentWindow();
    await window.minimize();
  };

  const handleMaximize = async () => {
    const window = getCurrentWindow();
    const maximized = await window.isMaximized();
    if (maximized) {
      await window.unmaximize();
      setIsMaximized(false);
    } else {
      await window.maximize();
      setIsMaximized(true);
    }
  };

  const handleClose = async () => {
    const window = getCurrentWindow();
    await window.close();
  };

  // Keyboard toggle for overlay (works in both normal and overlay modes)
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      try {
        const key = (localStorage.getItem("overlayToggleKey") ?? "F10").trim();
        if (!key) return;
        if (e.key !== key) return;
        const current = localStorage.getItem("overlayEnabled") === "true";
        const next = !current;
        await invoke("set_overlay_mode", { enabled: next });
        localStorage.setItem("overlayEnabled", String(next));
        if (!next) {
          try {
            await invoke("set_click_through", { enabled: false });
          } catch (err) {
            console.debug("[TitleBar] set_click_through off err", err);
          }
        }
        window.dispatchEvent(
          new CustomEvent("overlaychange", { detail: { enabled: next } })
        );
      } catch (err) {
        console.error("[TitleBar] overlay toggle via key failed:", err);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      data-tauri-drag-region
      className="h-10 bg-gray-900 dark:bg-gray-950 flex items-center justify-between px-4 border-b border-gray-800 cursor-move"
      onMouseEnter={async () => {
        try {
          await invoke("set_click_through", { enabled: false });
        } catch (err) {
          console.debug("[TitleBar] onMouseEnter set_click_through err", err);
        }
      }}
      style={{ WebkitUserSelect: "none", userSelect: "none" }}
    >
      {/* Title */}
      <div
        data-tauri-drag-region
        className="flex items-center gap-2 flex-1 cursor-move"
      >
        <span className="text-white text-sm font-medium">
          {title ?? i18n.t("app.title")}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2" data-tauri-drag-region="false">
        {/* Settings */}
        {onNavigate && (
          <button
            data-tauri-drag-region="false"
            onClick={() => onNavigate("settings")}
            className="px-2 py-1.5 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors rounded"
            title={i18n.t("ui.settings")}
          >
            <Settings size={16} />
          </button>
        )}

        {/* Window Controls */}
        <div className="flex items-center gap-1 ml-2">
          {/* Minimize */}
          <button
            data-tauri-drag-region="false"
            onClick={handleMinimize}
            className="px-3 py-1.5 hover:bg-gray-800 text-gray-400 transition-colors rounded"
            title={i18n.t("ui.minimize")}
          >
            <Minus size={14} />
          </button>

          {/* Maximize/Restore */}
          <button
            data-tauri-drag-region="false"
            onClick={handleMaximize}
            className="px-3 py-1.5 hover:bg-gray-800 text-gray-400 transition-colors rounded"
            title={isMaximized ? i18n.t("ui.restore") : i18n.t("ui.maximize")}
          >
            <Square size={14} />
          </button>

          {/* Close */}
          <button
            data-tauri-drag-region="false"
            onClick={handleClose}
            className="px-3 py-1.5 hover:bg-red-600 text-gray-400 hover:text-white transition-colors rounded"
            title={i18n.t("ui.close")}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
