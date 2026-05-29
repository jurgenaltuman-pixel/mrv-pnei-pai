import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const mrvApiUrl =
    process.env.VITE_MRV_API_URL?.trim() ||
    (mode === "production" ? "https://rapid-vaccinator-main.vercel.app" : "");

  return {
  base: "/",
  define: {
    __SUPABASE_URL__: JSON.stringify(process.env.VITE_SUPABASE_URL || 'https://fqdddcineslaxdkyiksf.supabase.co'),
    __SUPABASE_KEY__: JSON.stringify(process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_uxi5fOL6TkY5sMf5o9CZUg_8Lb8iOgK'),
    "import.meta.env.VITE_MRV_API_URL": JSON.stringify(mrvApiUrl),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      '/api': {
        target: process.env.VITE_MRV_API_PROXY || 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    outDir: 'dist-vite',
    target: 'ES2020',
    minify: 'esbuild',
    sourcemap: false,
    reportCompressedSize: false,
    rollupOptions: {
      input: {
        main: 'index.html',
        'service-worker': 'src/service-worker.ts',
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'service-worker') {
            return 'service-worker.js';
          }
          return 'assets/[name]-[hash].js';
        },
        /**
         * NO forzar vendor-react / vendor-maps / vendor-charts: rompe el enlace con React
         * (createContext undefined, __SECRET_INTERNALS, etc.).
         * Solo partimos librerías muy pesadas y sin UI.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('node_modules/xlsx')) return 'vendor-xlsx';
          if (id.includes('node_modules/@supabase')) return 'vendor-supabase';
        },
      },
    },
    worker: {
      format: 'es',
    },
    chunkSizeWarningLimit: 1500,
  },
};
});
