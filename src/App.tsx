import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Route, Routes } from "react-router-dom";
import { initNativeShell } from "@/lib/native-init";

/** Evita importar @capacitor/core en el bundle web (puede romper el navegador). En nativo, el runtime define window.Capacitor. */
function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  if (/Capacitor/i.test(navigator.userAgent || "")) return true;
  const c = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  try {
    return Boolean(c?.isNativePlatform?.());
  } catch {
    return false;
  }
}
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DataRefreshProvider } from "@/contexts/DataRefreshContext";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import { ImportDataPage } from "./pages/ImportDataPage.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 90_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const Router = isCapacitorNative() ? HashRouter : BrowserRouter;

const App = () => {
  useEffect(() => {
    void initNativeShell();
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <DataRefreshProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <Router>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/admin/import-data" element={<ImportDataPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Router>
        </AuthProvider>
      </DataRefreshProvider>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
