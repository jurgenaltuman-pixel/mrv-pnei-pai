import { useAuth } from '@/contexts/AuthContext';
import LoginPage from './LoginPage';
import MainApp from './MainApp';
import { Loader2 } from 'lucide-react';
import PendingApprovalPage from './PendingApprovalPage';
import ForcePasswordChangePage from './ForcePasswordChangePage';

export default function Index() {
  const { user, loading, approvalPending, mustChangePassword } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (user && approvalPending) return <PendingApprovalPage />;
  if (user && mustChangePassword) return <ForcePasswordChangePage />;
  return user ? <MainApp /> : <LoginPage />;
}
