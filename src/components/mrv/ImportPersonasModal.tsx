import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle, Upload, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { importarPersonas, validarPersona } from '@/services/importService';
import { mapPersonaRows } from '@/lib/import-excel-mrv';

interface ImportPersonasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportPersonasModal({ open, onOpenChange }: ImportPersonasModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [resultado, setResultado] = useState<any>(null);
  const [erroresPreview, setErroresPreview] = useState<Array<{ fila: number; errores: string[] }>>([]);
  const [validasPreview, setValidasPreview] = useState(0);
  const [archivoGrande, setArchivoGrande] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setErroresPreview([]);
      setValidasPreview(0);
      setArchivoGrande(selectedFile.size > 20 * 1024 * 1024);
      if (selectedFile.size <= 20 * 1024 * 1024) previewFile(selectedFile);
    }
  };

  const previewFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = mapPersonaRows(XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet));

        const errores: Array<{ fila: number; errores: string[] }> = [];
        let ok = 0;
        rows.slice(0, 5000).forEach((row, index) => {
          const validacion = validarPersona(row);
          if (!validacion.valido) {
            if (errores.length < 50) {
              errores.push({ fila: index + 2, errores: validacion.errores });
            }
          } else ok++;
        });

        setErroresPreview(errores);
        setValidasPreview(ok);
      } catch (error) {
        console.error('Error al leer archivo:', error);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    setProgress(0);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = event.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const personas = mapPersonaRows(XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet));

          const result = await importarPersonas(personas, {
            reemplazar: true,
            onProgress: (pct, label) => {
              setProgress(pct);
              setProgressLabel(label);
            },
          });
          setProgress(100);
          setResultado(result);
        } catch (error) {
          console.error('Error:', error);
        } finally {
          setLoading(false);
        }
      };
      reader.readAsBinaryString(file);
    } catch (error) {
      console.error('Error:', error);
      setLoading(false);
    }
  };

  const descargarPlantilla = () => {
    const plantilla = [
      {
        nombre: 'Juan Pérez García',
        tipo_documento: 'CI',
        documento: '1234567',
        fecha_nacimiento: '1990-05-15',
        sexo: 'M',
        region_sanitaria: 'Capital',
        distrito: 'Asunción',
        servicio_salud: 'Hospital Central',
        documento_madre: '2345678',
        nombre_madre: 'Rosa García López'
      },
      {
        nombre: 'María López García',
        tipo_documento: 'CI',
        documento: '7654321',
        fecha_nacimiento: '2005-08-20',
        sexo: 'F',
        region_sanitaria: 'Central',
        distrito: 'San Juan Bautista',
        servicio_salud: 'Centro de Salud San Juan',
        documento_madre: '3456789',
        nombre_madre: 'Carmen García García'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(plantilla);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Personas');
    XLSX.writeFile(wb, 'plantilla_personas.xlsx');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Importar Base de Personas
          </DialogTitle>
          <DialogDescription>
            Suba «Nómina de Niños para MRV.xlsx» (nombre1/apellido1… o nombre completo; municipio = distrito).
            Archivos muy grandes (&gt;20 MB): use{' '}
            <code className="text-xs">npm run import:mrv-data</code> en el proyecto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Botón descargar plantilla */}
          <Button
            variant="outline"
            size="sm"
            onClick={descargarPlantilla}
            className="w-full"
          >
            <Download className="w-4 h-4 mr-2" />
            Descargar Plantilla
          </Button>

          {/* Input archivo */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="w-full"
              disabled={loading}
            />
          </div>

          {archivoGrande && (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-900 text-sm">
                Este archivo es muy grande para el navegador. Ejecute en la carpeta del proyecto:{' '}
                <strong>npm run import:mrv-data</strong> (importa catálogo y nómina a Supabase).
              </AlertDescription>
            </Alert>
          )}

          {/* Vista previa de errores de validación */}
          {erroresPreview.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-2">
                  Se encontraron {erroresPreview.length} filas con errores:
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {erroresPreview.map((error, idx) => (
                    <div key={idx} className="text-sm">
                      <strong>Fila {error.fila}:</strong> {error.errores.join(', ')}
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Barra de progreso */}
          {loading && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">{progressLabel || 'Importando personas�'}</p>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {/* Resultado de importación */}
          {resultado && (
            <Alert className={resultado.exitosos > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
              <CheckCircle className={`h-4 w-4 ${resultado.exitosos > 0 ? 'text-green-600' : 'text-red-600'}`} />
              <AlertDescription>
                <div className="space-y-3">
                  <div className="font-semibold">
                    ✅ {resultado.exitosos} personas importadas | ❌ {resultado.fallidos} fallidas
                  </div>

                  {/* Errores */}
                  {resultado.errores.length > 0 && (
                    <div className="bg-white p-3 rounded border border-red-200">
                      <div className="font-semibold text-sm mb-2">Errores:</div>
                      <div className="space-y-1 text-xs max-h-40 overflow-y-auto">
                        {resultado.errores.map((error: any, idx: number) => (
                          <div key={idx} className="text-red-700">
                            <strong>Fila {error.fila}:</strong> {error.mensaje}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {resultado.exitosos > 0 && (
                    <div className="bg-white p-3 rounded border border-green-200 text-sm text-green-800">
                      ✅ Base de personas importada exitosamente. Se agregaron {resultado.exitosos} registros.
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Botones de acción */}
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                setFile(null);
                setResultado(null);
                setErroresPreview([]);
              }}
            >
              Cerrar
            </Button>
            <Button
              onClick={handleImport}
              disabled={!file || loading || archivoGrande || validasPreview === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? 'Importando...' : 'Importar Personas'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
