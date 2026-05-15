/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Inyectado en CI (GitHub Actions) para comprobar que Hosting sirvió el último deploy. */
  readonly VITE_BUILD_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
