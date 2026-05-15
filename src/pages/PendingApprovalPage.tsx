import { useAuth } from '@/contexts/AuthContext';
import { Shield, LogOut, Clock, AlertCircle, Mail, User } from 'lucide-react';

export default function PendingApprovalPage() {
  const { logout, user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl border shadow-lg p-8">
          {/* Icon */}
          <div className="mx-auto h-20 w-20 rounded-full bg-amber-100 flex items-center justify-center mb-6">
            <Clock className="h-10 w-10 text-amber-600 animate-pulse" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-center text-gray-900">
            Cuenta Pendiente de Aprobación
          </h1>
          
          {/* Status Message */}
          <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-sm text-gray-700 leading-relaxed">
              Tu cuenta ha sido <strong>registrada exitosamente</strong>, pero requiere aprobación de un administrador del sistema para acceder.
            </p>
          </div>

          {/* User Info */}
          {user && (
            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Información de tu cuenta:</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <User className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Nombre</p>
                    <p className="font-semibold text-gray-900">{user.nombre || 'No disponible'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Mail className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Correo Electrónico</p>
                    <p className="font-semibold text-gray-900 break-all">{user.email}</p>
                  </div>
                </div>
                {user.username && (
                  <div className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Usuario/CI</p>
                      <p className="font-semibold text-gray-900">{user.username}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-900 leading-relaxed">
                <strong>¿Qué pasa ahora?</strong> Un administrador del sistema revisará tu solicitud de registro. 
                Una vez aprobada, podrás acceder a todas las funciones del sistema. 
                Recibirás una notificación cuando sea aprobada.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={logout}
              className="w-full h-11 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
            >
              <LogOut className="h-4 w-4" /> Cerrar Sesión
            </button>
            <p className="text-xs text-center text-gray-600 pt-2">
              ¿Preguntas? Contacta a: <span className="font-semibold">soporte@mspbs.gov.py</span>
            </p>
          </div>
        </div>

        {/* Approval Status Badge */}
        <div className="mt-6 p-4 bg-white rounded-lg border shadow-sm text-center">
          <div className="inline-flex items-center gap-2 text-xs font-semibold bg-amber-100 text-amber-800 px-3 py-2 rounded-full">
            <div className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
            Esperando aprobación del administrador
          </div>
        </div>
      </div>
    </div>
  );
}

