export type DatasetInfo = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type RagHit = {
  text: string;
  score: number;
};

export type IngestResult = {
  chunks: number;
};
