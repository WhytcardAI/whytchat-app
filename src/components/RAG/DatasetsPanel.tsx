import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { createDataset, ingestText, listDatasets } from "../../rag/api";
import type { DatasetInfo } from "../../rag/types";

export default function DatasetsPanel() {
  const { t } = useTranslation();
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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
        <textarea
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("rag.ingest.placeholder")}
          disabled={busy || !selected}
        />
        <button onClick={onIngest} disabled={busy || !selected || !text.trim()}>
          {t("rag.ingest.ingestButton")}
        </button>
      </div>

      {msg && <div>{msg}</div>}

      {datasets.length === 0 && !busy && <div>{t("rag.list.empty")}</div>}
    </div>
  );
}
