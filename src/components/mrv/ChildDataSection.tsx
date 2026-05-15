import { useState, useCallback, useEffect, useRef } from 'react';
import { dataService, type PersonaBase } from '@/services/dataService';
import { Search, Check, X, Filter, User } from 'lucide-react';
import { esCodigoTemporal, validarFormatoCodigoTemporal } from '@/lib/temp-code-rve';

interface Props {
  visitaSinDatosNino?: boolean;
  nombre: string;
  setNombre: (v: string) => void;
  documento: string;
  setDocumento: (v: string) => void;
  fechaNacimiento: string;
  setFechaNacimiento: (v: string) => void;
  sexo: string;
  setSexo: (v: string) => void;
  edadTexto: string;
  edadValida: boolean;
  sinDocumento: boolean;
  setSinDocumento: (v: boolean) => void;
  generarDocumentoTemporal: () => void;
  onPersonaSeleccionada: (p: PersonaBase) => void;
  nombreMadre: string;
  documentoMadre: string;
  setDocumentoMadre?: (v: string) => void;
  regionNombre: string;
  distritoNombre: string;
  servicioNombre: string;
  barrio: string;
  regionCodigo?: string;
  distritoCodigo?: string;
}

export default function ChildDataSection(props: Props) {
  const [sugerencias, setSugerencias] = useState<PersonaBase[]>([]);
  const [searching, setSearching] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [iniNombre, setIniNombre] = useState('');
  const [iniApellido, setIniApellido] = useState('');
  const [fechaBusqueda, setFechaBusqueda] = useState('');
  const [ciMadre, setCiMadre] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  const buscar = useCallback(async (query: string) => {
    if (props.visitaSinDatosNino) {
      setSugerencias([]);
      return;
    }
    if (query.length < 1) {
      setSugerencias([]);
      return;
    }
    setSearching(true);
    const results = await dataService.getBasePersonas(query);
    setSugerencias(results);
    setSearching(false);
  }, [props.visitaSinDatosNino]);

  const buscarAvanzada = useCallback(async () => {
    if (props.visitaSinDatosNino) return;
    setSearching(true);
    const results = await dataService.buscarPersonasAvanzada({
      inicialesNombre: iniNombre,
      inicialesApellido: iniApellido,
      fechaNacimiento: fechaBusqueda || props.fechaNacimiento,
      documentoMadre: ciMadre || props.documentoMadre,
    });
    setSugerencias(results);
    setSearching(false);
  }, [iniNombre, iniApellido, fechaBusqueda, ciMadre, props]);

  const handleNombreChange = useCallback((value: string) => {
    props.setNombre(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => buscar(value), 280);
  }, [buscar, props]);

  useEffect(() => () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
  }, []);

  const seleccionar = (p: PersonaBase) => {
    props.setNombre(p.nombre);
    props.setDocumento(p.documento);
    if (p.fecha_nacimiento) props.setFechaNacimiento(p.fecha_nacimiento);
    if (p.sexo) props.setSexo(p.sexo);
    props.onPersonaSeleccionada(p);
    setSugerencias([]);
  };

  const handleDocChange = (raw: string) => {
    if (props.sinDocumento || esCodigoTemporal(raw)) {
      props.setDocumento(raw.toUpperCase());
      return;
    }
    props.setDocumento(raw.replace(/\D/g, ''));
  };

  const codigoTmpValido = !props.sinDocumento || validarFormatoCodigoTemporal(props.documento);

  const listaSugerencias =
    sugerencias.length > 0 || searching ? (
      <div className="mt-1 bg-card border rounded-lg shadow-lg max-h-44 overflow-y-auto z-20 relative">
        {searching && <p className="px-3 py-2 text-xs text-muted-foreground">Buscando...</p>}
        {sugerencias.map((p) => (
          <button
            key={p.documento}
            type="button"
            onClick={() => seleccionar(p)}
            className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent border-b last:border-0"
          >
            <span className="font-medium">{p.nombre}</span>
            <span className="text-muted-foreground ml-2">CI: {p.documento}</span>
            {p.fecha_nacimiento && (
              <span className="block text-[10px] text-muted-foreground">FN: {p.fecha_nacimiento}</span>
            )}
          </button>
        ))}
      </div>
    ) : null;

  return (
    <div className="section-card">
      <div className="section-title">
        <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">1</span>
        Identificación del niño/a
      </div>

      <div className="space-y-3">
        {props.visitaSinDatosNino && (
          <div className="rounded-lg border border-amber-300/80 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
            <p className="font-semibold">Visita sin encuesta de niño (N / F / R)</p>
            <p className="mt-0.5 opacity-90">Complete ubicación, viviendas y guarde.</p>
          </div>
        )}

        {!props.visitaSinDatosNino && (
          <>
            <div className="relative">
              <label className="field-label">Buscar por nombre o CI</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <input
                  type="text"
                  placeholder="Nombre, apellido o documento..."
                  className="w-full h-11 pl-9 pr-3 rounded-lg border bg-background text-sm"
                  onChange={(e) => handleNombreChange(e.target.value)}
                  value={props.nombre}
                />
              </div>
              {listaSugerencias}
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-center gap-2 h-9 rounded-lg border border-dashed text-xs font-bold text-primary hover:bg-primary/5"
            >
              <Filter className="w-3.5 h-3.5" />
              {showAdvanced ? 'Ocultar búsqueda avanzada' : 'Búsqueda avanzada (iniciales + FN / CI madre)'}
            </button>

            {showAdvanced && (
              <div className="p-3 rounded-xl border bg-accent/20 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="field-label">Iniciales nombre</label>
                    <input
                      value={iniNombre}
                      onChange={(e) => setIniNombre(e.target.value)}
                      className="w-full h-9 px-2 rounded-lg border bg-background text-sm uppercase"
                      placeholder="Ej: JM"
                      maxLength={8}
                    />
                  </div>
                  <div>
                    <label className="field-label">Iniciales apellido</label>
                    <input
                      value={iniApellido}
                      onChange={(e) => setIniApellido(e.target.value)}
                      className="w-full h-9 px-2 rounded-lg border bg-background text-sm uppercase"
                      placeholder="Ej: PR"
                      maxLength={8}
                    />
                  </div>
                </div>
                <div>
                  <label className="field-label">Fecha de nacimiento</label>
                  <input
                    type="date"
                    value={fechaBusqueda}
                    onChange={(e) => setFechaBusqueda(e.target.value)}
                    className="w-full h-9 px-2 rounded-lg border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="field-label">CI de la madre</label>
                  <input
                    value={ciMadre}
                    onChange={(e) => setCiMadre(e.target.value.replace(/\D/g, ''))}
                    className="w-full h-9 px-2 rounded-lg border bg-background text-sm"
                    inputMode="numeric"
                    placeholder="6-8 dígitos"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void buscarAvanzada()}
                  className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-bold"
                >
                  Buscar en RVe
                </button>
                {listaSugerencias}
              </div>
            )}
          </>
        )}

        <div>
          <label className="field-label flex items-center gap-1">
            Cédula de Identidad {!props.visitaSinDatosNino && <span className="text-destructive font-bold">*</span>}
          </label>
          <input
            value={props.documento}
            onChange={(e) => handleDocChange(e.target.value)}
            className={`w-full h-10 px-3 rounded-lg border bg-background text-sm font-mono ${
              props.sinDocumento && !codigoTmpValido ? 'border-destructive' : ''
            }`}
            placeholder={props.sinDocumento ? 'TMP-XXX00-XXXXX (editable)' : 'Número de CI'}
            inputMode={props.sinDocumento ? 'text' : 'numeric'}
            disabled={!props.sinDocumento && false}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={props.sinDocumento}
                onChange={(e) => props.setSinDocumento(e.target.checked)}
              />
              Sin CI — código temporal RVe
            </label>
            {props.sinDocumento && (
              <button
                type="button"
                onClick={props.generarDocumentoTemporal}
                className="h-8 px-2 rounded-md bg-secondary text-xs font-semibold"
              >
                Generar código
              </button>
            )}
          </div>
          {props.sinDocumento && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Puede editar el código según lineamientos oficiales del RVe.
            </p>
          )}
        </div>

        <div>
          <label className="field-label flex items-center gap-1">
            Fecha de Nacimiento {!props.visitaSinDatosNino && <span className="text-destructive font-bold">*</span>}
          </label>
          <input
            type="date"
            value={props.fechaNacimiento}
            onChange={(e) => props.setFechaNacimiento(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border bg-background text-sm"
          />
        </div>

        {props.fechaNacimiento && (
          <div className={`px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 ${
            props.edadValida ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
          }`}>
            {props.edadValida ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />} {props.edadTexto}
          </div>
        )}

        <div>
          <label className="field-label flex items-center gap-1">
            Sexo {!props.visitaSinDatosNino && <span className="text-destructive font-bold">*</span>}
          </label>
          <div className="flex gap-2">
            {['M', 'F'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => props.setSexo(s)}
                className={`flex-1 h-10 rounded-lg font-semibold text-sm ${
                  props.sexo === s ? 'bg-primary text-primary-foreground' : 'bg-secondary'
                }`}
              >
                {s === 'M' ? 'Masculino' : 'Femenino'}
              </button>
            ))}
          </div>
        </div>

        {!props.visitaSinDatosNino && (
          <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
            <p className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
              <User className="w-3.5 h-3.5" /> Madre (RVe)
            </p>
            <input
              value={props.documentoMadre}
              onChange={(e) => props.setDocumentoMadre?.(e.target.value.replace(/\D/g, ''))}
              className="w-full h-9 px-2 rounded-lg border bg-background text-sm"
              placeholder="CI de la madre"
              inputMode="numeric"
            />
            {props.nombreMadre && (
              <p className="text-xs text-muted-foreground">Nombre: {props.nombreMadre}</p>
            )}
          </div>
        )}

        {(props.regionNombre || props.barrio) && (
          <div className="rounded-lg border bg-primary/5 p-3 text-xs space-y-1">
            <p className="font-semibold">Ubicación</p>
            <p className="text-muted-foreground"><b>Región:</b> {props.regionNombre || '—'}</p>
            <p className="text-muted-foreground"><b>Distrito:</b> {props.distritoNombre || '—'}</p>
            <p className="text-muted-foreground"><b>Servicio:</b> {props.servicioNombre || '—'}</p>
            <p className="text-muted-foreground"><b>Barrio:</b> {props.barrio || '—'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
