/**
 * Sin `import from "react"` en nivel superior: evita duplicar React (chunk `main` vs `vendor-react`)
 * y el error __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.
 */
declare global {
  interface Window {
    __MRV_SET_BOOT_PROGRESS?: (pct: number, label?: string) => void;
  }
}

document.documentElement.lang = "es";
// @ts-expect-error: propiedad no tipada en TS estándar
document.documentElement.translate = false;

/** Bump al desplegar si hay que forzar otro barrido (chunks viejos, SW roto). */
const SW_SWEEP_KEY = "mrv-sw-sweep-2026-05-27-chunk-mapview";

function sweepMarkerIsSet(): boolean {
  try {
    if (localStorage.getItem(SW_SWEEP_KEY) === "1") return true;
  } catch {
    /* ignore */
  }
  try {
    if (sessionStorage.getItem(SW_SWEEP_KEY) === "1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** Devuelve false si no se pudo persistir ningún marcador (evita bucle reload + «Cargando…»). */
function setSweepMarker(): boolean {
  try {
    localStorage.setItem(SW_SWEEP_KEY, "1");
    return true;
  } catch {
    try {
      sessionStorage.setItem(SW_SWEEP_KEY, "1");
      return true;
    } catch {
      return false;
    }
  }
}

async function sweepStaleCachesOnce(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (sweepMarkerIsSet()) return false;

  let clearedSomething = false;
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      if (regs.length > 0) {
        await Promise.all(regs.map((r) => r.unregister()));
        clearedSomething = true;
      }
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      if (keys.length > 0) {
        await Promise.all(keys.map((k) => caches.delete(k)));
        clearedSomething = true;
      }
    }
  } catch (e) {
    console.warn("mrv sweep", e);
  }

  const marked = setSweepMarker();
  // Sin marcador persistido, no recargar: en modo privado u orígenes raros setItem falla y el reload anterior causaba bucle infinito.
  if (!marked || !clearedSomething) return false;

  window.location.reload();
  return true;
}

function setBootProgressUI(pct: number, label?: string): void {
  try {
    window.__MRV_SET_BOOT_PROGRESS?.(pct, label);
  } catch {
    /* ignore */
  }
}

async function boot(): Promise<void> {
  if (await sweepStaleCachesOnce()) return;

  try {
    const { initTheme } = await import("./contexts/ThemeContext.tsx");
    initTheme();
  } catch {
    /* ignore */
  }

  setBootProgressUI(6, "Descargando módulos…");
  const total = 5;
  let completed = 0;
  const wrap = (label: string, p: Promise<unknown>) =>
    p.finally(() => {
      completed += 1;
      const pct = 8 + Math.round((completed / total) * 88);
      setBootProgressUI(pct, label);
    });

  const [{ createElement }, { createRoot }, { default: App }, { AppErrorBoundary }] = await Promise.all([
    wrap("React", import("react")),
    wrap("Interfaz", import("react-dom/client")),
    wrap("Aplicación", import("./App.tsx")),
    wrap("Protección de errores", import("./components/AppErrorBoundary.tsx")),
  ]);
  await wrap("Estilos", import("./index.css"));

  setBootProgressUI(100, "Listo");

  const rootEl = document.getElementById("root");
  if (!rootEl) return;

  createRoot(rootEl).render(
    createElement(AppErrorBoundary, null, createElement(App))
  );
}

void boot().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("MRV boot error:", err);
  const el = document.getElementById("root");
  if (el) {
    el.innerHTML = `<div style="min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0055A4;color:#fff;font-family:system-ui,sans-serif;padding:1.5rem;text-align:center;max-width:28rem;margin:0 auto">
      <p style="font-weight:800;margin:0 0 0.5rem">Error al cargar la app</p>
      <p style="margin:0 0 1rem;font-size:0.875rem;opacity:0.95;word-break:break-word">${msg.replace(/</g, "&lt;")}</p>
      <button type="button" style="background:#fff;color:#0055A4;border:none;border-radius:12px;padding:10px 18px;font-weight:700;cursor:pointer" onclick="location.reload()">Reintentar</button>
    </div>`;
  }
});
