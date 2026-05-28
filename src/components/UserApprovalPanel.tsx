import React, { useState, useEffect } from 'react';
import { Check, X, Clock, AlertCircle, CheckCircle2, User, Mail, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { USE_MRV_API } from '@/lib/api-config';
import * as backend from '@/services/mrvBackend';
import { supabase } from '@/integrations/supabase/client';

interface PendingUser {
  user_id: string;
  email: string;
  display_name: string;
  username?: string;
  created_at: string;
  rol?: string;
}

interface UserApprovalPanelProps {
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}

export function UserApprovalPanel({ isAdmin, isSuperAdmin }: UserApprovalPanelProps) {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const canManageApprovals = isSuperAdmin || isAdmin;

  useEffect(() => {
    if (!canManageApprovals) return;
    fetchPendingUsers();

    const interval = setInterval(fetchPendingUsers, 30000);
    return () => clearInterval(interval);
  }, [canManageApprovals]);

  const fetchPendingUsers = async () => {
    try {
      if (USE_MRV_API) {
        const { data, error } = await backend.fetchPendingApprovals();
        if (error) {
          setMessage({ type: 'error', text: `Error al cargar usuarios: ${error}` });
        } else {
          setPendingUsers((data?.data || []) as PendingUser[]);
        }
      } else {
        const { data, error } = await supabase.rpc('get_pending_approvals');
        if (error) {
          setMessage({ type: 'error', text: `Error al cargar usuarios: ${error.message}` });
        } else {
          setPendingUsers(data || []);
        }
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  const approveUser = async (userId: string, userName: string) => {
    setApproving(userId);
    try {
      if (USE_MRV_API) {
        const { error } = await backend.approveUser(userId);
        if (error) {
          setMessage({ type: 'error', text: `Error al aprobar: ${error}` });
        } else {
          setMessage({ type: 'success', text: `✅ ${userName} ha sido aprobado exitosamente` });
          setPendingUsers(pendingUsers.filter((u) => u.user_id !== userId));
        }
      } else {
        const { error } = await supabase.rpc('approve_user', { p_user_id: userId });
        if (error) {
          setMessage({ type: 'error', text: `Error al aprobar: ${error.message}` });
        } else {
          setMessage({ type: 'success', text: `✅ ${userName} ha sido aprobado exitosamente` });
          setPendingUsers(pendingUsers.filter((u) => u.user_id !== userId));
        }
      }
    } catch {
      setMessage({ type: 'error', text: 'Error inesperado al aprobar usuario' });
    } finally {
      setApproving(null);
    }
  };

  const rejectUser = async (userId: string, userName: string) => {
    setRejecting(userId);
    try {
      if (USE_MRV_API) {
        const { error } = await backend.rejectUser(userId);
        if (error) {
          setMessage({ type: 'error', text: `Error al rechazar: ${error}` });
        } else {
          setMessage({ type: 'success', text: `❌ ${userName} ha sido rechazado` });
          setPendingUsers(pendingUsers.filter((u) => u.user_id !== userId));
        }
      } else {
        const { error } = await supabase.rpc('reject_user', { p_user_id: userId, p_reason: 'Rechazado por administrador' });
        if (error) {
          setMessage({ type: 'error', text: `Error al rechazar: ${error.message}` });
        } else {
          setMessage({ type: 'success', text: `❌ ${userName} ha sido rechazado` });
          setPendingUsers(pendingUsers.filter((u) => u.user_id !== userId));
        }
      }
    } catch {
      setMessage({ type: 'error', text: 'Error inesperado al rechazar usuario' });
    } finally {
      setRejecting(null);
    }
  };

  if (!canManageApprovals) {
    return null;
  }

  if (loading) {
    return (
      <div className="p-6 bg-card rounded-lg border shadow-sm">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Cargando usuarios pendientes...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-600" />
          Aprobación de Usuarios
        </h2>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold">
          <div className="w-2 h-2 rounded-full bg-primary" />
          {pendingUsers.length} {pendingUsers.length === 1 ? 'pendiente' : 'pendientes'}
        </span>
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg border flex items-start gap-2 ${
            message.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
          )}
          <p className={`text-sm ${message.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>{message.text}</p>
        </div>
      )}

      {pendingUsers.length === 0 ? (
        <div className="p-8 bg-card rounded-lg border shadow-sm text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground">No hay usuarios pendientes</p>
          <p className="text-xs text-muted-foreground mt-1">Todos los usuarios han sido aprobados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingUsers.map((user) => (
            <div key={user.user_id} className="p-4 bg-card rounded-lg border shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground text-sm truncate">{user.display_name}</h3>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      <span className="truncate">{user.email}</span>
                    </div>
                    {user.username && (
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span>{user.username}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>Registrado hace {formatDistanceToNow(new Date(user.created_at), { locale: es })}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => approveUser(user.user_id, user.display_name)}
                    disabled={approving === user.user_id || rejecting === user.user_id}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-semibold"
                    title="Aprobar usuario"
                  >
                    {approving === user.user_id ? (
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Aprobar
                  </button>
                  <button
                    onClick={() => rejectUser(user.user_id, user.display_name)}
                    disabled={approving === user.user_id || rejecting === user.user_id}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-semibold"
                    title="Rechazar usuario"
                  >
                    {rejecting === user.user_id ? (
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                    Rechazar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
