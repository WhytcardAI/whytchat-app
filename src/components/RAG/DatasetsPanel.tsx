import { useEffect, useState } from "react";
import { i18n } from "../../i18n";
import {
  createDataset,
  ingestText,
  listDatasets,
} from "../../rag/api";
import type { DatasetInfo } from "../../rag/types";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Database,
  FileText,
  Type,
  HelpCircle,
  CheckCircle,
  XCircle,
} from "lucide-react";

export default function DatasetsPanel() {
  const t = (key: string, params?: Record<string, any>) => {
    const translation = i18n.t(key);
    if (!params) return translation;
    return Object.entries(params).reduce(
      (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
      translation
    );
  };
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<"success" | "error" | null>(null);
  const [ingestMode, setIngestMode] = useState<"text" | "file">("text");
  const [showHelp, setShowHelp] = useState(false);

  const reload = async () => {
    try {
      setDatasets(await listDatasets());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const onCreate = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setMsg(null);
    setMsgType(null);
    try {
      const ds = await createDataset(name.trim());
      setName("");
      setDatasets((d) => [...d, ds]);
      setSelected(ds.id);
      setMsg(t("rag.createDataset.success"));
      setMsgType("success");
    } catch (e: any) {
      setMsg(String(e));
      setMsgType("error");
    } finally {
      setBusy(false);
    }
  };

  const onIngest = async () => {
    if (!selected || !text.trim()) return;
    setBusy(true);
    setMsg(null);
    setMsgType(null);
    try {
      const res = await ingestText(selected, text);
      setMsg(t("rag.ingest.success", { count: res.chunks }));
      setMsgType("success");
      setText("");
    } catch (e: any) {
      setMsg(String(e));
      setMsgType("error");
    } finally {
      setBusy(false);
    }
  };

  const onIngestFile = async () => {
    if (!selected) return;
    setBusy(true);
    setMsg(null);
    setMsgType(null);
    try {
      const files = await open({
        multiple: false,
        filters: [
          {
            name: "Text Files",
            extensions: ["txt", "md", "json", "csv", "log"],
          },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (!files) return;

      const filePath = Array.isArray(files) ? files[0] : files;
      // Read file content using fetch API with file:// protocol
      // Works for local files in Tauri without needing fs plugin
      const content = await fetch(`file://${filePath}`).then((r) => r.text());
      const res = await ingestText(selected, content);
      setMsg(t("rag.ingest.success", { count: res.chunks }));
      setMsgType("success");
    } catch (e: any) {
      setMsg(String(e));
      setMsgType("error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Help Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
            <Database size={24} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t("rag.title")}
          </h2>
        </div>
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          title={t("rag.help.title")}
        >
          <HelpCircle size={20} className="text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Help Section */}
      {showHelp && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
            <HelpCircle size={18} />
            {t("rag.help.title")}
          </h3>
          <div className="text-sm text-blue-800 dark:text-blue-300 space-y-2">
            <p>{t("rag.help.description")}</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>{t("rag.help.step1")}</li>
              <li>{t("rag.help.step2")}</li>
              <li>{t("rag.help.step3")}</li>
            </ul>
          </div>
        </div>
      )}

      {/* Create Dataset Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Database size={20} />
          {t("rag.createDataset.title")}
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder={t("rag.datasetName.placeholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            onKeyDown={(e) => e.key === "Enter" && onCreate()}
          />
          <button
            onClick={onCreate}
            disabled={busy || !name.trim()}
            className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Database size={18} />
            {t("rag.createDataset.label")}
          </button>
        </div>
      </div>

      {/* Select Dataset Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("rag.select.label")}
        </label>
        <select
          value={selected ?? ""}
          onChange={(e) => setSelected(e.target.value || null)}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t("rag.select.none")}</option>
          {datasets.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        {datasets.length === 0 && !busy && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {t("rag.list.empty")}
          </p>
        )}
      </div>

      {/* Ingest Content Section */}
      {selected && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t("rag.ingest.pasteText")}
          </h3>

          {/* Mode Selector */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <button
              onClick={() => setIngestMode("text")}
              disabled={busy}
              className={`px-3 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-sm ${
                ingestMode === "text"
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Type size={16} />
              {t("rag.ingest.mode.text")}
            </button>
            <button
              onClick={() => setIngestMode("file")}
              disabled={busy}
              className={`px-3 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-sm ${
                ingestMode === "file"
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <FileText size={16} />
              {t("rag.ingest.mode.file")}
            </button>
          </div>

          {/* Text Mode */}
          {ingestMode === "text" && (
            <div className="space-y-3">
              <textarea
                rows={8}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t("rag.ingest.placeholder")}
                disabled={busy}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
              />
              <button
                onClick={onIngest}
                disabled={busy || !text.trim()}
                className="w-full px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 dark:disabled:from-gray-600 dark:disabled:to-gray-600 text-white font-medium transition-all disabled:cursor-not-allowed shadow-md hover:shadow-lg"
              >
                {busy ? t("rag.ingest.loading") : t("rag.ingest.ingestButton")}
              </button>
            </div>
          )}

          {/* File Mode */}
          {ingestMode === "file" && (
            <div className="space-y-3">
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                <FileText
                  size={48}
                  className="mx-auto text-gray-400 dark:text-gray-500 mb-3"
                />
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {t("rag.ingest.fileDescription")}
                </p>
                <button
                  onClick={onIngestFile}
                  disabled={busy}
                  className="px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 dark:disabled:from-gray-600 dark:disabled:to-gray-600 text-white font-medium transition-all disabled:cursor-not-allowed shadow-md hover:shadow-lg inline-flex items-center gap-2"
                >
                  <FileText size={18} />
                  {busy ? t("rag.ingest.loading") : t("rag.ingest.chooseFile")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Message Display */}
      {msg && (
        <div
          className={`flex items-start gap-3 p-4 rounded-lg border ${
            msgType === "success"
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
              : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
          }`}
        >
          {msgType === "success" ? (
            <CheckCircle
              size={20}
              className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5"
            />
          ) : (
            <XCircle
              size={20}
              className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
            />
          )}
          <p
            className={`text-sm ${
              msgType === "success"
                ? "text-green-800 dark:text-green-200"
                : "text-red-800 dark:text-red-200"
            }`}
          >
            {msg}
          </p>
        </div>
      )}
    </div>
  );
}
