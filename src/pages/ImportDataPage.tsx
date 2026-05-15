import React from 'react';
import { ImportDataPanel } from '@/components/mrv/ImportDataPanel';

/**
 * Página de Importación de Datos
 * 
 * Agregaa esta página a tu aplicación para permitir importación de datos desde Excel
 * 
 * Ruta sugerida: /admin/import-data o /import
 * 
 * Ejemplo de integración en tu router:
 * 
 * ```tsx
 * import { ImportDataPage } from '@/pages/ImportDataPage';
 * 
 * // En tu router configuration:
 * {
 *   path: '/admin/import-data',
 *   element: <ImportDataPage />,
 *   requiresAuth: true,
 *   requiredRoles: ['admin', 'superadmin']
 * }
 * ```
 */

export function ImportDataPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        <ImportDataPanel />
      </div>
    </div>
  );
}

export default ImportDataPage;
