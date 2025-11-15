import { invoke } from "@tauri-apps/api/core";
import type { DatasetInfo, IngestResult } from "./types";

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

// ===== Dataset-Conversation Linking (N-N) =====
<<<<<<< HEAD
// Note: Backend implementation pending - these functions will throw errors if called

// export async function linkDatasetToConversation(
//   conversationId: number,
//   datasetId: string
// ): Promise<void> {
//   return invoke("link_dataset_to_conversation", {
//     conversationId,
//     datasetId,
//   });
// }

// export async function unlinkDatasetFromConversation(
//   conversationId: number,
//   datasetId: string
// ): Promise<void> {
//   return invoke("unlink_dataset_from_conversation", {
//     conversationId,
//     datasetId,
//   });
// }

// export async function listDatasetsForConversation(
//   conversationId: number
// ): Promise<string[]> {
//   return invoke<string[]>("list_datasets_for_conversation", {
//     conversationId,
//   });
// }

// export async function listChunks(datasetId: string): Promise<string[]> {
//   return invoke<string[]>("rag_list_chunks", { datasetId });
// }
=======

export async function linkDatasetToConversation(
  conversationId: number,
  datasetId: string
): Promise<void> {
  return invoke("link_dataset_to_conversation", {
    conversationId,
    datasetId,
  });
}

export async function unlinkDatasetFromConversation(
  conversationId: number,
  datasetId: string
): Promise<void> {
  return invoke("unlink_dataset_from_conversation", {
    conversationId,
    datasetId,
  });
}

export async function listDatasetsForConversation(
  conversationId: number
): Promise<string[]> {
  return invoke<string[]>("list_datasets_for_conversation", {
    conversationId,
  });
}

export async function listChunks(datasetId: string): Promise<string[]> {
  return invoke<string[]>("rag_list_chunks", { datasetId });
}
>>>>>>> f1d3a2dd6f5a94e4a34ac0cc814a923dee7644e7
