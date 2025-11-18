import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { formatError } from "../../utils/errors";

interface DownloadProgress {
  downloaded: number;
  total: number | null;
  percentage: number;
}

interface InstallLlamaServerProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function InstallLlamaServer({
  onComplete,
  onCancel,
}: InstallLlamaServerProps) {
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unlistenProgress: UnlistenFn | null = null;
    let unlistenStatus: UnlistenFn | null = null;

    const setupListeners = async () => {
      unlistenProgress = await listen<DownloadProgress>(
        "llama-download-progress",
        (event) => {
          setProgress(Math.round(event.payload.percentage));
        },
      );

      unlistenStatus = await listen<string>("llama-server-status", (event) => {
        setStatus(event.payload);
      });
    };

    void setupListeners();

    return () => {
      if (unlistenProgress) unlistenProgress();
      if (unlistenStatus) unlistenStatus();
    };
  }, []);

  const handleInstall = async () => {
    setInstalling(true);
    setError(null);
    setProgress(0);

    try {
      await invoke("download_llama_server");
      onComplete();
    } catch (err) {
      console.error("Installation failed:", err);
      setError(formatError(err));
      setInstalling(false);
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "downloading":
        return "Downloading llama-server...";
      case "extracting":
        return "Extracting files...";
      case "installed":
        return "Installation complete!";
      default:
        return "Ready to install";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-blue-600 dark:text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Install AI Engine
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Required for local AI generation
            </p>
          </div>
        </div>

        {/* Description */}
        {!installing && !error && (
          <div className="mb-6">
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">
              WhytChat needs to download the llama-server engine to generate AI
              responses locally on your computer.
            </p>
            <div className="bg-gray-50 dark:bg-gray-900 rounded p-3 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-gray-600 dark:text-gray-400">
                  Download size:
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  ~14 MB
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  Platform:
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  Windows x64
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Progress */}
        {installing && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {getStatusText()}
              </span>
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                {progress}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 dark:bg-blue-500 h-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            {status === "downloading" && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Please wait, this may take a few minutes...
              </p>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                  Installation failed
                </h3>
                <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {!installing && (
            <>
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleInstall}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors"
              >
                {error ? "Retry" : "Install"}
              </button>
            </>
          )}
          {installing && (
            <button
              disabled
              className="w-full px-4 py-2 text-sm font-medium text-white bg-gray-400 dark:bg-gray-600 rounded-lg cursor-not-allowed"
            >
              Installing...
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
