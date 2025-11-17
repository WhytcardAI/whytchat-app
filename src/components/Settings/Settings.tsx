import { i18n, availableLocaleCodes } from "../../i18n";
import { useTheme } from "../../contexts/ThemeContext";
import {
  Sun,
  Moon,
  Globe,
  Info,
  Database,
  Cpu,
  Gamepad2,
  Eye,
  MousePointer,
  Keyboard,
  GripVertical,
} from "lucide-react";
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { ServerDebugModal } from "../ServerStatusIndicator/ServerDebugModal";
import UpdateSection from "./UpdateSection";

type SettingsProps = {
  onNavigate: (view: string) => void;
};

export function Settings({ onNavigate }: SettingsProps) {
  const { theme, toggleTheme } = useTheme();
  const [locale, setLocale] = useState(i18n.getLocale());
  const [dbPath, setDbPath] = useState<string>(i18n.t("common.loading"));
  const [conversationsCount, setConversationsCount] = useState(0);
  const [debugOpen, setDebugOpen] = useState(false);
  // Overlay preferences
  const [overlayOpacity, setOverlayOpacity] = useState<number>(() => {
    try {
      return Math.max(
        0.5,
        Math.min(1, parseFloat(localStorage.getItem("overlayOpacity") || "1")),
      );
    } catch (err) {
      console.debug("[Settings] read overlayOpacity err", err);
      return 1;
    }
  });
  const [overlayAutoPassthrough, setOverlayAutoPassthrough] = useState<boolean>(
    () => {
      try {
        return (
          (localStorage.getItem("overlayAutoPassthrough") ?? "true") === "true"
        );
      } catch (err) {
        console.debug("[Settings] read overlayAutoPassthrough err", err);
        return true;
      }
    },
  );
  const [overlayControlsIdleSec, setOverlayControlsIdleSec] = useState<number>(
    () => {
      try {
        return Math.max(
          1,
          Math.min(
            5,
            parseInt(localStorage.getItem("overlayControlsIdleSec") || "2", 10),
          ),
        );
      } catch (err) {
        console.debug("[Settings] read overlayControlsIdleSec err", err);
        return 2;
      }
    },
  );
  const [overlayShowDragStrip, setOverlayShowDragStrip] = useState<boolean>(
    () => {
      try {
        return (
          (localStorage.getItem("overlayShowDragStrip") ?? "true") === "true"
        );
      } catch (err) {
        console.debug("[Settings] read overlayShowDragStrip err", err);
        return true;
      }
    },
  );
  const [overlayToggleKey, setOverlayToggleKey] = useState<string>(() => {
    try {
      return localStorage.getItem("overlayToggleKey") || "";
    } catch (err) {
      console.debug("[Settings] read overlayToggleKey err", err);
      return "";
    }
  });

  useEffect(() => {
    // Load stats
    (async () => {
      try {
        const conversations =
          await invoke<Array<{ id: number }>>("list_conversations");
        setConversationsCount(conversations.length);

        // Resolve DB path from backend (application folder)
        try {
          const p = await invoke<string>("get_db_path_string");
          setDbPath(p);
        } catch {
          setDbPath(i18n.t("settings.data.dbPath"));
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    })();
  }, []);

  const handleLocaleChange = (newLocale: string) => {
    i18n.setLocale(newLocale);
    setLocale(newLocale);
  };

  const dispatchOverlayPrefsChange = () => {
    window.dispatchEvent(new CustomEvent("overlayprefschange"));
  };

  const recordToggleKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const key = e.key;
    setOverlayToggleKey(key === "Escape" ? "" : key);
    try {
      localStorage.setItem("overlayToggleKey", key === "Escape" ? "" : key);
    } catch (err) {
      console.debug("[Settings] write overlayToggleKey err", err);
    }
    dispatchOverlayPrefsChange();
  };

  return (
    <div className="h-[calc(100vh-2.5rem)] bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors overflow-y-auto">
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold dark:text-white">
            {i18n.t("home.settings")}
          </h1>
          <button
            onClick={() => onNavigate("home")}
            className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium transition-colors"
          >
            ← {i18n.t("home.title")}
          </button>
        </div>

        <div className="space-y-6">
          {/* Debug Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              {/* Reuse Info icon for simplicity */}
              <Info size={20} /> {i18n.t("settings.debug.title")}
            </h2>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xl">
                {i18n.t("settings.debug.desc", "View llama server logs and technical details.")}
              </p>
              <button
                onClick={() => setDebugOpen(true)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                {i18n.t("settings.debug.open")}
              </button>
            </div>
          </div>
          {/* Overlay Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 md:p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Gamepad2 size={20} /> {i18n.t("settings.overlay.title")}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Controls (compact) */}
              <div className="space-y-3">
                {/* Default Opacity */}
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <label className="font-medium flex items-center gap-2">
                      <Eye size={16} />{" "}
                      {i18n.t("settings.overlay.opacityLabel")}
                    </label>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {i18n.t("settings.overlay.opacityDesc")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={50}
                      max={100}
                      step={5}
                      value={Math.round(overlayOpacity * 100)}
                      onChange={(e) => {
                        const v = Math.max(
                          50,
                          Math.min(100, parseInt(e.target.value || "100", 10)),
                        );
                        const f = v / 100;
                        setOverlayOpacity(f);
                        try {
                          localStorage.setItem("overlayOpacity", String(f));
                        } catch (err) {
                          console.debug(
                            "[Settings] write overlayOpacity err",
                            err,
                          );
                        }
                        dispatchOverlayPrefsChange();
                      }}
                      className="w-28"
                    />
                    <span className="w-10 text-right text-xs">
                      {Math.round(overlayOpacity * 100)}%
                    </span>
                  </div>
                </div>

                {/* Auto Passthrough */}
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <label className="font-medium flex items-center gap-2">
                      <MousePointer size={16} />{" "}
                      {i18n.t("settings.overlay.autoPassthroughLabel")}
                    </label>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {i18n.t("settings.overlay.autoPassthroughDesc")}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={overlayAutoPassthrough}
                    onChange={(e) => {
                      setOverlayAutoPassthrough(e.target.checked);
                      try {
                        localStorage.setItem(
                          "overlayAutoPassthrough",
                          e.target.checked ? "true" : "false",
                        );
                      } catch (err) {
                        console.debug(
                          "[Settings] write overlayAutoPassthrough err",
                          err,
                        );
                      }
                      dispatchOverlayPrefsChange();
                    }}
                  />
                </div>

                {/* Controls idle seconds */}
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <label className="font-medium flex items-center gap-2">
                      <Eye size={16} />{" "}
                      {i18n.t("settings.overlay.controlsIdleLabel")}
                    </label>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {i18n.t("settings.overlay.controlsIdleDesc")}
                    </p>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={overlayControlsIdleSec}
                    onChange={(e) => {
                      const v = Math.max(
                        1,
                        Math.min(5, parseInt(e.target.value || "2", 10)),
                      );
                      setOverlayControlsIdleSec(v);
                      try {
                        localStorage.setItem(
                          "overlayControlsIdleSec",
                          String(v),
                        );
                      } catch (err) {
                        console.debug(
                          "[Settings] write overlayControlsIdleSec err",
                          err,
                        );
                      }
                      dispatchOverlayPrefsChange();
                    }}
                    className="w-16 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                  />
                </div>

                {/* Show drag strip */}
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <label className="font-medium flex items-center gap-2">
                      <GripVertical size={16} />{" "}
                      {i18n.t("settings.overlay.dragStripLabel")}
                    </label>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {i18n.t("settings.overlay.dragStripDesc")}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={overlayShowDragStrip}
                    onChange={(e) => {
                      setOverlayShowDragStrip(e.target.checked);
                      try {
                        localStorage.setItem(
                          "overlayShowDragStrip",
                          e.target.checked ? "true" : "false",
                        );
                      } catch (err) {
                        console.debug(
                          "[Settings] write overlayShowDragStrip err",
                          err,
                        );
                      }
                      dispatchOverlayPrefsChange();
                    }}
                  />
                </div>

                {/* Overlay toggle keybind */}
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <label className="font-medium flex items-center gap-2">
                      <Keyboard size={16} />{" "}
                      {i18n.t("settings.overlay.toggleKeyLabel")}
                    </label>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {i18n.t("settings.overlay.toggleKeyDesc")}
                    </p>
                  </div>
                  <input
                    type="text"
                    readOnly
                    onKeyDown={recordToggleKey}
                    value={overlayToggleKey}
                    placeholder={i18n.t(
                      "settings.overlay.toggleKeyPlaceholder",
                    )}
                    className="w-36 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                    title={i18n.t("settings.overlay.toggleKeyHelp")}
                  />
                </div>
              </div>

              {/* Live Preview */}
              <div>
                <div
                  className="relative h-56 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-gradient-to-br from-gray-700 via-gray-900 to-black"
                  title={i18n.t("settings.overlay.title")}
                >
                  {/* Simulated game background pattern */}
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_30%,_white_2%,_transparent_20%),_radial-gradient(circle_at_80%_70%,_white_2%,_transparent_20%)]" />

                  {/* Simulated overlay (top-right) */}
                  <div className="absolute inset-0 flex items-start justify-end p-3">
                    <div
                      className={`w-64 rounded-lg ${overlayAutoPassthrough ? "backdrop-blur-sm" : ""} border ${overlayAutoPassthrough ? "border-transparent" : "border-gray-500/40"} ${"bg-gray-800/60 text-gray-100"}`}
                      style={{
                        opacity: Math.max(0.2, Math.min(1, overlayOpacity * 1)),
                      }}
                    >
                      {/* Bubble */}
                      <div className="p-3 text-xs leading-relaxed">•••</div>
                      {/* Input bar */}
                      <div className="px-3 pb-3">
                        <div className="h-8 rounded-md border border-gray-500/30 bg-gray-900/60" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Appearance Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Sun size={20} /> {i18n.t("settings.appearance.title")}
            </h2>

            <div className="space-y-4">
              {/* Theme Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium">
                    {i18n.t("settings.appearance.themeLabel")}
                  </label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {i18n.t("settings.appearance.themeDesc")}
                  </p>
                </div>
                <button
                  onClick={toggleTheme}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
                >
                  {theme === "light" ? (
                    <>
                      <Moon size={16} /> {i18n.t("settings.appearance.dark")}
                    </>
                  ) : (
                    <>
                      <Sun size={16} /> {i18n.t("settings.appearance.light")}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Language Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Globe size={20} /> {i18n.t("settings.language.title")}
            </h2>

            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium">
                  {i18n.t("settings.language.label")}
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {i18n.t("settings.language.desc")}
                </p>
              </div>
              <select
                value={locale}
                onChange={(e) => handleLocaleChange(e.target.value)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                {availableLocaleCodes.map((code) => (
                  <option key={code} value={code}>
                    {i18n.t(`locales.${code}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Data & Storage Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Database size={20} /> {i18n.t("settings.data.title")}
            </h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm font-medium">
                  {i18n.t("settings.data.conversations")}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {conversationsCount}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm font-medium">
                  {i18n.t("settings.data.dbLocation")}
                </span>
                <span
                  className="text-xs text-gray-600 dark:text-gray-400 max-w-xs truncate"
                  title={dbPath}
                >
                  {dbPath}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-medium">
                  {i18n.t("settings.data.storageMode")}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {i18n.t("settings.data.storageLocal")}
                </span>
              </div>
            </div>
          </div>

          {/* System Info Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Cpu size={20} /> {i18n.t("settings.system.title")}
            </h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm font-medium">
                  {i18n.t("settings.system.platformLabel")}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {i18n.t("settings.system.platformValue")}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm font-medium">
                  {i18n.t("settings.system.backendLabel")}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {i18n.t("settings.system.backendValue")}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-medium">
                  {i18n.t("settings.system.engineLabel")}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {i18n.t("settings.system.engineValue")}
                </span>
              </div>
            </div>
          </div>

          {/* Update Section */}
          <UpdateSection translations={i18n.translations[i18n.locale]} />

          {/* About Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Info size={20} /> {i18n.t("settings.about.title")}
            </h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm font-medium">
                  {i18n.t("settings.about.versionLabel")}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {i18n.t("settings.about.versionValue")}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm font-medium">
                  {i18n.t("settings.about.publisherLabel")}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {i18n.t("settings.about.publisherValue")}
                </span>
              </div>
              <div className="py-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {i18n.t("settings.about.description")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      {debugOpen && <ServerDebugModal onClose={() => setDebugOpen(false)} />}
    </div>
  );
}
