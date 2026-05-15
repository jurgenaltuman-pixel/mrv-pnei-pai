import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Database, FileText, Upload } from 'lucide-react';
import { ImportUsersModal } from './ImportUsersModal';
import { ImportUnitsModal } from './ImportUnitsModal';
import { ImportPersonasModal } from './ImportPersonasModal';

export function ImportDataPanel() {
  const [openUsers, setOpenUsers] = useState(false);
  const [openUnits, setOpenUnits] = useState(false);
  const [openPersonas, setOpenPersonas] = useState(false);

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Upload className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold">Centro de Importación de Datos</h1>
          <p className="text-gray-600 mt-1">Importa tus datos desde archivos Excel a la base de datos</p>
        </div>
      </div>

      {/* Grid de importaciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Importar Usuarios */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-blue-600" />
              <div>
                <CardTitle>Importar Usuarios</CardTitle>
                <CardDescription>Crear nuevos usuarios del sistema</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Cargue un archivo Excel con columnas: CI, Nombres Completos, Fecha de Nacimiento, Nombre de Usuario.
              Se crearán nuevos usuarios automáticamente con contraseña temporal.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
              <strong>Columnas requeridas:</strong>
              <ul className="list-disc list-inside text-gray-700 mt-1">
                <li>CI</li>
                <li>nombres_completos</li>
                <li>fecha_nacimiento</li>
                <li>nombre_usuario</li>
              </ul>
            </div>
            <Button
              onClick={() => setOpenUsers(true)}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <Upload className="w-4 h-4 mr-2" />
              Importar Usuarios
            </Button>
          </CardContent>
        </Card>

        {/* Importar Catálogo */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Database className="w-6 h-6 text-green-600" />
              <div>
                <CardTitle>Importar Catálogo</CardTitle>
                <CardDescription>Regiones, Distritos, Servicios, Barrios</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Cargue un archivo Excel con columnas: región, distrito, servicio_salud, barrio (opcional).
              Esta acción reemplazará el catálogo existente.
            </p>
            <div className="bg-green-50 border border-green-200 rounded p-3 text-sm">
              <strong>Columnas requeridas:</strong>
              <ul className="list-disc list-inside text-gray-700 mt-1">
                <li>region</li>
                <li>distrito</li>
                <li>servicio_salud</li>
                <li>barrio (opcional)</li>
              </ul>
            </div>
            <Button
              onClick={() => setOpenUnits(true)}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <Upload className="w-4 h-4 mr-2" />
              Importar Catálogo
            </Button>
          </CardContent>
        </Card>

        {/* Importar Personas */}
        <Card className="md:col-span-2 hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-purple-600" />
              <div>
                <CardTitle>Importar Base de Personas</CardTitle>
                <CardDescription>Datos de población para vacunación</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Cargue un archivo Excel con datos de personas a vacunar. Incluye información demográfica,
              ubicación geográfica y referencias de familiares.
            </p>
            <div className="bg-purple-50 border border-purple-200 rounded p-3 text-sm">
              <strong>Columnas requeridas:</strong>
              <ul className="list-disc list-inside text-gray-700 mt-1">
                <li>nombre</li>
                <li>tipo_documento</li>
                <li>documento</li>
                <li>fecha_nacimiento</li>
                <li>sexo</li>
                <li>region_sanitaria</li>
                <li>distrito</li>
                <li>servicio_salud</li>
                <li>documento_madre (opcional)</li>
                <li>nombre_madre (opcional)</li>
              </ul>
            </div>
            <Button
              onClick={() => setOpenPersonas(true)}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              <Upload className="w-4 h-4 mr-2" />
              Importar Base de Personas
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Información adicional */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base">Información Importante</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-gray-700">
          <p>
            <strong>✅ Validación automática:</strong> Se valida cada fila antes de importar. Se mostrarán errores si hay datos incompletos.
          </p>
          <p>
            <strong>🔐 Contraseñas:</strong> Los usuarios creados reciben una contraseña temporal que debe cambiar en el primer acceso.
          </p>
          <p>
            <strong>🗑️ Reemplazo de catálogo:</strong> Al importar el catálogo, se eliminan los datos anteriores completamente.
          </p>
          <p>
            <strong>📥 Guardado automático:</strong> Todos los datos se guardan automáticamente en Supabase.
          </p>
        </CardContent>
      </Card>

      {/* Modales */}
      <ImportUsersModal open={openUsers} onOpenChange={setOpenUsers} />
      <ImportUnitsModal open={openUnits} onOpenChange={setOpenUnits} />
      <ImportPersonasModal open={openPersonas} onOpenChange={setOpenPersonas} />
    </div>
  );
}
