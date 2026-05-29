import { createTheme, alpha } from '@mui/material/styles';

/** Tema Material Design 3 (Google / Pixel) — MSPBS MRV */
export const m3Theme = createTheme({
  cssVariables: true,
  palette: {
    mode: 'light',
    primary: {
      main: '#1a73e8',
      dark: '#1557b0',
      light: '#4c8df6',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#5f6368',
      contrastText: '#ffffff',
    },
    success: { main: '#1e8e3e' },
    warning: { main: '#f9ab00' },
    error: { main: '#d93025' },
    background: {
      default: '#f8fafd',
      paper: '#ffffff',
    },
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily: '"Roboto", "Inter", system-ui, -apple-system, sans-serif',
    button: { textTransform: 'none', fontWeight: 600 },
  },
  transitions: {
    duration: {
      shortest: 120,
      shorter: 180,
      short: 220,
      standard: 280,
      complex: 360,
    },
    easing: {
      easeInOut: 'cubic-bezier(0.2, 0, 0, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          WebkitFontSmoothing: 'antialiased',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: false },
      styleOverrides: {
        root: {
          borderRadius: 20,
          paddingLeft: 20,
          paddingRight: 20,
          transition: 'all 0.28s cubic-bezier(0.2, 0, 0, 1)',
        },
        contained: {
          boxShadow: `0 1px 2px ${alpha('#000', 0.12)}, 0 2px 6px ${alpha('#1a73e8', 0.25)}`,
          '&:hover': {
            boxShadow: `0 2px 4px ${alpha('#000', 0.14)}, 0 4px 12px ${alpha('#1a73e8', 0.3)}`,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          boxShadow: `0 1px 3px ${alpha('#000', 0.08)}, 0 4px 12px ${alpha('#000', 0.06)}`,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: 20 },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined', size: 'medium' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 14,
            transition: 'box-shadow 0.28s cubic-bezier(0.2, 0, 0, 1)',
            '&.Mui-focused': {
              boxShadow: `0 0 0 3px ${alpha('#1a73e8', 0.2)}`,
            },
          },
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          borderRadius: '20px 20px 0 0',
          boxShadow: `0 -2px 12px ${alpha('#000', 0.08)}`,
        },
      },
    },
  },
});

export const m3LoginGradient =
  'linear-gradient(165deg, #0b57d0 0%, #1a73e8 42%, #4c8df6 100%)';
