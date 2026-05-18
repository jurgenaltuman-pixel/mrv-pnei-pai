import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle, Upload, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { importarCatalogo, validarUnidad } from '@/services/importService';
import { mapUnitRows } from '@/lib/import-excel-mrv';

interface ImportUnitsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportUnitsModal({ open, onOpenChange }: ImportUnitsModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [resultado, setResultado] = useState<any>(null);
  const [erroresPreview, setErroresPreview] = useState<Array<{ fila: number; errores: string[] }>>([]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setErroresPreview([]);
      previewFile(selectedFile);
    }
  };

  const previewFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = mapUnitRows(XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet));

        const errores: Array<{ fila: number; errores: string[] }> = [];
        rows.forEach((row, index) => {
          const validacion = validarUnidad(row);
          if (!validacion.valido) {
            errores.push({
              fila: index + 2,
              errores: validacion.errores
            });
          }
        });

        setErroresPreview(errores);
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
          const unidades = mapUnitRows(XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet));

          setProgress(5);
          const result = await importarCatalogo(unidades, (pct, label) => {
            setProgress(pct);
            setProgressLabel(label);
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
        region: 'Capital',
        distrito: 'Asunción',
        servicio_salud: 'Hospital Central',
        barrio: 'Centro'
      },
      {
        region: 'Central',
        distrito: 'San Juan Bautista',
        servicio_salud: 'Centro de Salud San Juan',
        barrio: 'Centro'
      },
      {
        region: 'Alto Paraná',
        distrito: 'Ciudad del Este',
        servicio_salud: 'Hospital Regional CDE',
        barrio: 'Centro'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(plantilla);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Unidades');
    XLSX.writeFile(wb, 'plantilla_unidades.xlsx');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Importar Catálogo (Regiones/Distritos/Servicios/Barrios)
          </DialogTitle>
          <DialogDescription>
            Suba «Unidad Organizativa para MRV.xlsx» (columnas: region, distrito, servicio_salud, barrio).
            Reemplaza el catálogo completo de regiones, distritos, servicios y barrios.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Advertencia */}
          <Alert className="bg-yellow-50 border-yellow-200">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              ⚠️ Esta operación reemplazará todo el catálogo existente. Los datos se limpiarán completamente.
            </AlertDescription>
          </Alert>

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
              <div className="text-sm text-gray-600">{progressLabel || 'Importando catálogo…'}</div>
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
                    ✅ {resultado.exitosos} filas procesadas | ❌ {resultado.fallidos} fallidas
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
                      {resultado.resumen
                        ? `Catálogo: ${resultado.resumen.regiones} regiones, ${resultado.resumen.distritos} distritos, ${resultado.resumen.servicios} servicios, ${resultado.resumen.barrios} barrios. `
                        : ''}
                      {resultado.exitosos.toLocaleString('es-PY')} filas del Excel procesadas.
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
              disabled={!file || loading || erroresPreview.length > 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? 'Importando...' : 'Importar Catálogo'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
