import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { FileText, Upload, X, Check, AlertCircle } from "lucide-react";
import { i18n } from "../../../i18n";

interface ImportedFile {
  name: string;
  content: string;
  size: number;
}

interface FileImportProps {
  onFileImported: (file: ImportedFile) => void;
  onClose: () => void;
}

export function FileImport({ onFileImported, onClose }: FileImportProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleImportFile = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const files = await open({
        multiple: false,
        filters: [
          {
            name: "Documents",
            extensions: [
              "txt",
              "md",
              "json",
              "csv",
              "log",
              "js",
              "ts",
              "tsx",
              "jsx",
              "py",
              "html",
              "css",
              "xml",
            ],
          },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (!files) {
        setLoading(false);
        return;
      }

      const filePath = Array.isArray(files) ? files[0] : files;
      const fileName = filePath.split(/[\\/]/).pop() || "file";

      // Read file content using Tauri command
      const content = await invoke<string>("read_file_content", { path: filePath });
      const sizeKB = Math.round(content.length / 1024);

      onFileImported({
        name: fileName,
        content,
        size: sizeKB,
      });

      setSuccess(true);
      setTimeout(() => onClose(), 1500);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleImportURL = async () => {
    const url = prompt("Enter documentation URL:");
    if (!url) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const content = await response.text();
      const sizeKB = Math.round(content.length / 1024);

      onFileImported({
        name: url.split("/").pop() || "webpage",
        content,
        size: sizeKB,
      });

      setSuccess(true);
      setTimeout(() => onClose(), 1500);
    } catch (e: unknown) {
      setError(`Failed to fetch URL: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500 rounded-lg">
              <FileText size={24} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {i18n.t("chat.importFile.title")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {i18n.t("chat.importFile.description")}
        </p>

        {/* Import Options */}
        <div className="space-y-3">
          <button
            onClick={handleImportFile}
            disabled={loading}
            className="w-full p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center justify-center gap-3">
              <Upload size={24} className="text-blue-500" />
              <div className="text-left">
                <p className="font-medium text-gray-900 dark:text-white">
                  {i18n.t("chat.importFile.local")}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  TXT, MD, JSON, code files...
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={handleImportURL}
            disabled={loading}
            className="w-full p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center justify-center gap-3">
              <FileText size={24} className="text-purple-500" />
              <div className="text-left">
                <p className="font-medium text-gray-900 dark:text-white">
                  {i18n.t("chat.importFile.url")}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Documentation, webpage, API docs...
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Status Messages */}
        {loading && (
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm">
            <div className="animate-spin">⏳</div>
            <span>{i18n.t("chat.importFile.loading")}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
            <Check size={16} />
            <span>{i18n.t("chat.importFile.success")}</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
