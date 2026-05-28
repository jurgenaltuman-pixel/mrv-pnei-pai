import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { initNativeShell } from '@/lib/native-init';
import { ThemeProvider } from '@/contexts/ThemeContext';

import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/AuthContext';
import { DataRefreshProvider } from '@/contexts/DataRefreshContext';
import Index from './pages/Index.tsx';
import NotFound from './pages/NotFound.tsx';
import { ImportDataPage } from './pages/ImportDataPage.tsx';

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

const App = () => {
  useEffect(() => {
    void initNativeShell();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
      <TooltipProvider>
        <DataRefreshProvider>
          <AuthProvider>
            <Toaster />
            <Sonner />
            <HashRouter>
              <div className="flex min-h-dvh w-full flex-1 flex-col">
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/admin/import-data" element={<ImportDataPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </div>
            </HashRouter>
          </AuthProvider>
        </DataRefreshProvider>
      </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
