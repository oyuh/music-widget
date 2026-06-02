/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LFM_KEY?: string;
  readonly VITE_LFM_CALLBACK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
