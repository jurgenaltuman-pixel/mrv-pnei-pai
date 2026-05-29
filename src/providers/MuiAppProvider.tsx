import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { m3Theme } from '@/theme/m3-theme';
import type { ReactNode } from 'react';

export function MuiAppProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={m3Theme}>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
}
