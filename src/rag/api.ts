import { invoke } from "@tauri-apps/api/core";
import type { DatasetInfo, IngestResult, RagHit } from "./types";

export async function listDatasets(): Promise<DatasetInfo[]> {
  return invoke<DatasetInfo[]>("rag_list_datasets");
}

export async function createDataset(name: string): Promise<DatasetInfo> {
  return invoke<DatasetInfo>("rag_create_dataset", { name });
}

export async function deleteDataset(id: string): Promise<void> {
  return invoke("rag_delete_dataset", { id });
}

export async function ingestText(
  datasetId: string,
  text: string
): Promise<IngestResult> {
  return invoke<IngestResult>("rag_ingest_text", {
    args: { dataset_id: datasetId, text },
  });
}

export async function ingestFile(
  datasetId: string,
  filePath: string
): Promise<IngestResult> {
  return invoke<IngestResult>("rag_ingest_file", {
    args: { dataset_id: datasetId, file_path: filePath },
  });
}

export async function ingestUrl(
  datasetId: string,
  url: string
): Promise<IngestResult> {
  return invoke<IngestResult>("rag_ingest_url", {
    args: { dataset_id: datasetId, url },
  });
}

export async function ingestFolder(
  datasetId: string,
  folderPath: string
): Promise<IngestResult> {
  return invoke<IngestResult>("rag_ingest_folder", {
    args: { dataset_id: datasetId, folder_path: folderPath },
  });
}

export async function scrapeUrl(
  datasetId: string,
  baseUrl: string,
  maxDepth?: number
): Promise<IngestResult> {
  return invoke<IngestResult>("rag_scrape_url", {
    args: { dataset_id: datasetId, base_url: baseUrl, max_depth: maxDepth },
  });
}

export async function ragQuery(
  datasetId: string,
  query: string,
  k = 5
): Promise<RagHit[]> {
  return invoke<RagHit[]>("rag_query", {
    args: { dataset_id: datasetId, query, k },
  });
}
