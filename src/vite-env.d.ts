/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly BASE_URL: string;
  readonly MODE: string;
  // add custom env vars here with `VITE_` prefix if needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
