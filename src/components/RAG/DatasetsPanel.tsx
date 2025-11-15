import { useEffect, useState } from "react";
import { i18n } from "../../i18n";
import { createDataset, ingestText, ingestFile, ingestUrl, listDatasets } from "../../rag/api";
import type { DatasetInfo } from "../../rag/types";
import { open } from "@tauri-apps/plugin-dialog";

export default function DatasetsPanel() {
  const t = (key: string, params?: Record<string, any>) => {
    const translation = i18n.t(key);
    if (!params) return translation;
    return Object.entries(params).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), translation);
  };
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ingestMode, setIngestMode] = useState<"text" | "file" | "url">("text");

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
    try {
      const ds = await createDataset(name.trim());
      setName("");
      setDatasets((d) => [...d, ds]);
      setSelected(ds.id);
    } catch (e: any) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  };

  const onIngest = async () => {
    if (!selected || !text.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await ingestText(selected, text);
      setMsg(t("rag.ingest.success", { count: res.chunks }));
      setText("");
    } catch (e: any) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  };

  const onIngestFile = async () => {
    if (!selected) return;
    setBusy(true);
    setMsg(null);
    try {
      const files = await open({
        multiple: false,
        filters: [
          { name: "Documents", extensions: ["txt", "md", "pdf", "html", "htm", "json", "csv", "log", "docx"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });
      
      if (!files) return;
      
      const filePath = Array.isArray(files) ? files[0] : files;
      const res = await ingestFile(selected, filePath);
      setMsg(t("rag.ingest.success", { count: res.chunks }));
    } catch (e: any) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  };

  const onIngestUrl = async () => {
    if (!selected || !url.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await ingestUrl(selected, url.trim());
      setMsg(t("rag.ingest.success", { count: res.chunks }));
      setUrl("");
    } catch (e: any) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: 16, display: "grid", gap: 12 }}>
      <h2>{t("rag.title")}</h2>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          placeholder={t("rag.datasetName.placeholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
          style={{ flex: 1 }}
        />
        <button onClick={onCreate} disabled={busy || !name.trim()}>
          {t("rag.createDataset.label")}
        </button>
      </div>

      <div>
        <label>{t("rag.select.label")}</label>
        <select
          value={selected ?? ""}
          onChange={(e) => setSelected(e.target.value || null)}
        >
          <option value="">{t("rag.select.none")}</option>
          {datasets.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <label>{t("rag.ingest.pasteText")}</label>
        
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button
            onClick={() => setIngestMode("text")}
            style={{
              padding: "6px 12px",
              background: ingestMode === "text" ? "#2563eb" : "#e5e7eb",
              color: ingestMode === "text" ? "white" : "#1f2937",
              border: "none",
              borderRadius: 4,
              cursor: busy ? "not-allowed" : "pointer",
            }}
            disabled={busy}
          >
            {t("rag.ingest.mode.text")}
          </button>
          <button
            onClick={() => setIngestMode("file")}
            style={{
              padding: "6px 12px",
              background: ingestMode === "file" ? "#2563eb" : "#e5e7eb",
              color: ingestMode === "file" ? "white" : "#1f2937",
              border: "none",
              borderRadius: 4,
              cursor: busy ? "not-allowed" : "pointer",
            }}
            disabled={busy}
          >
            {t("rag.ingest.mode.file")}
          </button>
          <button
            onClick={() => setIngestMode("url")}
            style={{
              padding: "6px 12px",
              background: ingestMode === "url" ? "#2563eb" : "#e5e7eb",
              color: ingestMode === "url" ? "white" : "#1f2937",
              border: "none",
              borderRadius: 4,
              cursor: busy ? "not-allowed" : "pointer",
            }}
            disabled={busy}
          >
            {t("rag.ingest.mode.url")}
          </button>
        </div>

        {ingestMode === "text" && (
          <textarea
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("rag.ingest.placeholder")}
            disabled={busy || !selected}
          />
        )}

        {ingestMode === "url" && (
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t("rag.ingest.urlPlaceholder")}
            disabled={busy || !selected}
            style={{ padding: 8 }}
          />
        )}

        {ingestMode === "text" && (
          <button onClick={onIngest} disabled={busy || !selected || !text.trim()}>
            {busy ? t("rag.ingest.loading") : t("rag.ingest.ingestButton")}
          </button>
        )}
        {ingestMode === "file" && (
          <button onClick={onIngestFile} disabled={busy || !selected}>
            {busy ? t("rag.ingest.loading") : t("rag.ingest.chooseFile")}
          </button>
        )}
        {ingestMode === "url" && (
          <button onClick={onIngestUrl} disabled={busy || !selected || !url.trim()}>
            {busy ? t("rag.ingest.loading") : t("rag.ingest.fetchUrl")}
          </button>
        )}
      </div>

      {msg && <div>{msg}</div>}

      {datasets.length === 0 && !busy && <div>{t("rag.list.empty")}</div>}
    </div>
  );
}
