import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { X, Download, AlertCircle } from "lucide-react";
import { i18n } from "../i18n";

export default function UpdateNotification() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [newVersion, setNewVersion] = useState("");
  const [currentVersion, setCurrentVersion] = useState("0.3.0");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const devDisabled = (
    import.meta as unknown as { env?: { DEV?: boolean } } | undefined
  )?.env?.DEV;

  // Translation helper (fallback to English if missing)
  const t = {
    available: i18n.t("update.available", "Update available"),
    currentVersion: i18n.t("update.currentVersion", "Current version"),
    newVersion: i18n.t("update.newVersion", "New version"),
    downloading: i18n.t("update.downloading", "Downloading update..."),
    download: i18n.t("update.download", "Update now"),
    later: i18n.t("update.later", "Later"),
  };

  useEffect(() => {
    if (devDisabled ?? false) return;
    getVersion()
      .then((v) => setCurrentVersion(v))
      .catch(() => {});
  }, [devDisabled]);

  const checkForUpdates = useCallback(async () => {
    if (devDisabled ?? false) return;
    try {
      const lastCheck = localStorage.getItem("lastUpdateCheck");
      const now = Date.now();

      // Check at most once per day
      if (
        lastCheck != null &&
        now - parseInt(lastCheck) < 24 * 60 * 60 * 1000
      ) {
        return;
      }

      const version = await invoke<string | null>("check_update");
      localStorage.setItem("lastUpdateCheck", now.toString());

      if (version) {
        setNewVersion(version);
        setUpdateAvailable(true);
      }
    } catch {
      // Fail silently in production auto-check to avoid distracting users
      setUpdateAvailable(false);
      setError("");
      setDismissed(true);
    }
  }, [devDisabled]);

  useEffect(() => {
    if (devDisabled ?? false) return;
    void checkForUpdates();
    // Check for updates once per day
    const interval = setInterval(checkForUpdates, 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkForUpdates, devDisabled]);

  const handleUpdateNow = async () => {
    setDownloading(true);
    setError("");
    try {
      await invoke("install_update");
      // Update will trigger restart automatically
    } catch (err) {
      setError(err as string);
      setDownloading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  if ((devDisabled ?? false) || !updateAvailable || dismissed) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <Download className="w-6 h-6 text-blue-500" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
            {t.available || "Update available"}
          </h3>

          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1 mb-3">
            <p>
              {t.currentVersion || "Current version"}:{" "}
              <span className="font-medium">{currentVersion}</span>
            </p>
            <p>
              {t.newVersion || "New version"}:{" "}
              <span className="font-medium text-blue-600 dark:text-blue-400">
                {newVersion}
              </span>
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 mb-3">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          {downloading ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {t.downloading || "Downloading update..."}
              </p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300 animate-pulse"
                  style={{ width: "100%" }}
                />
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleUpdateNow}
                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
              >
                {t.download || "Update now"}
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                {t.later || "Later"}
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
