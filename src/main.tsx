import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./lib/service-worker-helper";
import { isNativeApp } from "./lib/capacitor-platform";

document.documentElement.lang = 'es';
// Evita traducción automática (Chrome/Google Translate)
// @ts-expect-error: propiedad no tipada en TS estándar
document.documentElement.translate = false;

// PWA / web: service worker. App nativa Capacitor usa assets embebidos + IndexedDB.
if (!isNativeApp()) {
  void registerServiceWorker();
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<App />);
}
