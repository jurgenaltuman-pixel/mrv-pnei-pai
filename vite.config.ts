import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Plugin para ordenar los modulepreload en el HTML correcto
function fixModulePreloadOrder() {
  const dependencyOrder = [
    'vendor',
    'vendor-charts',
    'vendor-maps',
    'components',
    'pages',
  ];

  return {
    name: 'fix-module-preload-order',
    transformIndexHtml(html) {
      // Extraer todos los links de modulepreload con sus rutas completas
      const preloadRegex = /<link rel="modulepreload"[^>]*href="([^"]*)"[^>]*>/g;
      const preloads = [];
      let match;

      while ((match = preloadRegex.exec(html)) !== null) {
        preloads.push({
          full: match[0],
          href: match[1]
        });
      }

      if (preloads.length === 0) return html;

      // Función para obtener el nombre del chunk de la ruta
      const getChunkNameFromHref = (href) => {
        // De "/assets/vendor-react-BFExtH27.js" extraer "vendor-react"
        // De "/assets/main-Q7ij9sTT.js" extraer "main"
        const filename = href.split('/').pop(); // "vendor-react-BFExtH27.js"
        
        // Remover el hash final (patrones como -BFExtH27.js o -Q7ij9sTT.js o -B_K4lMmS.js)
        // El hash es un patrón entre guión y .js que contiene letras/números/guión bajo
        const withoutHash = filename.replace(/-[a-zA-Z0-9_]+\.js$/, '');
        return withoutHash;
      };

      // Ordenar preloads basándose en dependencyOrder
      preloads.sort((a, b) => {
        const nameA = getChunkNameFromHref(a.href);
        const nameB = getChunkNameFromHref(b.href);

        const indexA = dependencyOrder.indexOf(nameA);
        const indexB = dependencyOrder.indexOf(nameB);

        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      });

      // Eliminar todos los preloads del HTML
      let result = html.replace(/<link rel="modulepreload"[^>]*>\s*/g, '');

      // Encontrar dónde insertar los preloads (antes del script principal)
      const mainScriptRegex = /<script type="module"[^>]*src="\/assets\/main[^"]*\.js"[^>]*><\/script>/;
      
      // Crear el string de preloads ordenados
      const preloadString = preloads.map(p => p.full).join('\n    ');

      // Insertar antes del script principal
      return result.replace(mainScriptRegex, (match) => {
        return preloadString + '\n    ' + match;
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "/",
  define: {
    // Inyectar variables de entorno en el build
    __SUPABASE_URL__: JSON.stringify(process.env.VITE_SUPABASE_URL || 'https://fqdddcineslaxdkyiksf.supabase.co'),
    __SUPABASE_KEY__: JSON.stringify(process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_uxi5fOL6TkY5sMf5o9CZUg_8Lb8iOgK'),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), fixModulePreloadOrder(), mode === "development" && componentTagger()].filter(Boolean),
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
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('chart.js') || id.includes('react-chartjs')) return 'vendor-charts';
          if (id.includes('leaflet') || id.includes('react-leaflet')) return 'vendor-maps';
          if (id.includes('xlsx')) return 'vendor-xlsx';
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (id.includes('react-dom') || id.includes('react-router')) return 'vendor-react';
          return 'vendor';
        },
      },
    },
    worker: {
      format: 'es',
    },
    chunkSizeWarningLimit: 1500,
  },
}));
