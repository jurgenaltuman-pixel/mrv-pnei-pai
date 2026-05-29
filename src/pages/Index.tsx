import type { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import LoginPage from './LoginPage';
import MainApp from './MainApp';
import PendingApprovalPage from './PendingApprovalPage';
import ForcePasswordChangePage from './ForcePasswordChangePage';
import M3PageTransition from '@/components/m3/M3PageTransition';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';

export default function Index() {
  const { user, loading, approvalPending, mustChangePassword } = useAuth();

  if (loading) {
    return (
      <Box
        sx={{
          flex: 1,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={44} thickness={4} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Cargando…
          </Typography>
        </Box>
      </Box>
    );
  }

  const routeKey = !user
    ? 'login'
    : approvalPending
      ? 'pending'
      : mustChangePassword
        ? 'password'
        : 'app';

  let content: ReactNode;
  if (!user) content = <LoginPage />;
  else if (approvalPending) content = <PendingApprovalPage />;
  else if (mustChangePassword) content = <ForcePasswordChangePage />;
  else content = <MainApp />;

  return <M3PageTransition routeKey={routeKey}>{content}</M3PageTransition>;
}
