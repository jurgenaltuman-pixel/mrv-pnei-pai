import { useState, useCallback } from 'react';
import { dataService, type PersonaBase } from '@/services/dataService';
import { Search, Check, X, User, CreditCard } from 'lucide-react';
import { esCodigoTemporal, validarFormatoCodigoTemporal } from '@/lib/temp-code-rve';
import { TIPOS_DOCUMENTO_MRV, tipoDocumentoSoloDigitos } from '@/lib/tipos-documento-mrv';

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
  /** Nombre de la madre (solo lectura si viene de la persona encontrada). */
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

type SearchMode = 'documento' | 'personales';

/** Azul MSPBS (#0055A4): mismo tono en todos los navegadores (evita «morado» del tema). */
const BTN_MRV = 'bg-[#0055A4] hover:bg-[#003d7a] text-white shadow-md';

export default function ChildDataSection(props: Props) {
  const [sugerencias, setSugerencias] = useState<PersonaBase[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode>('documento');

  const [tipoDoc, setTipoDoc] = useState('CI');
  const [docBusqueda, setDocBusqueda] = useState('');

  const [nombre1, setNombre1] = useState('');
  const [nombre2, setNombre2] = useState('');
  const [apellido1, setApellido1] = useState('');
  const [apellido2, setApellido2] = useState('');
  const [ciMadrePadre, setCiMadrePadre] = useState('');
  const [fechaNacBusqueda, setFechaNacBusqueda] = useState('');
  const [sexoBusqueda, setSexoBusqueda] = useState<'M' | 'F' | ''>('');

  const buscarPorDocumento = useCallback(async () => {
    if (props.visitaSinDatosNino) return;
    const raw = docBusqueda.trim();
    const soloDigitos = tipoDocumentoSoloDigitos(tipoDoc);
    const normalized = soloDigitos ? raw.replace(/\D/g, '') : raw.replace(/\s+/g, '').toUpperCase();
    const minLen = soloDigitos ? 4 : 3;
    if (normalized.length < minLen) {
      setSugerencias([]);
      return;
    }
    setSearching(true);
    const results = await dataService.buscarPersonasPorDocumento(raw, tipoDoc, 25);
    setSugerencias(results);
    setSearching(false);
  }, [docBusqueda, tipoDoc, props.visitaSinDatosNino]);

  const buscarDatosPersonales = useCallback(async () => {
    if (props.visitaSinDatosNino) return;
    setSearching(true);
    const results = await dataService.buscarPersonasDatosPersonales(
      {
        nombre1,
        nombre2,
        apellido1,
        apellido2,
        documentoMadrePadre: ciMadrePadre,
        fechaNacimiento: fechaNacBusqueda,
        sexo: sexoBusqueda || undefined,
      },
      25
    );
    setSugerencias(results);
    setSearching(false);
  }, [
    nombre1,
    nombre2,
    apellido1,
    apellido2,
    ciMadrePadre,
    fechaNacBusqueda,
    sexoBusqueda,
    props.visitaSinDatosNino,
  ]);

  const seleccionar = (p: PersonaBase) => {
    props.setNombre(p.nombre);
    props.setDocumento(p.documento);
    if (p.fecha_nacimiento) props.setFechaNacimiento(p.fecha_nacimiento);
    if (p.sexo) props.setSexo(p.sexo);
    if (p.documento_madre && props.setDocumentoMadre) props.setDocumentoMadre(p.documento_madre);
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
      <div className="mt-2 bg-card border rounded-lg shadow-lg max-h-44 overflow-y-auto z-20 relative">
        {searching && <p className="px-3 py-2 text-xs text-muted-foreground">Buscando...</p>}
        {sugerencias.map((p, idx) => (
          <button
            key={p.id ?? `${p.documento}-${idx}`}
            type="button"
            onClick={() => seleccionar(p)}
            className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent border-b last:border-0"
          >
            <span className="font-medium">{p.nombre}</span>
            <span className="text-muted-foreground ml-2">
              {p.tipo_documento || 'CI'} {p.documento}
            </span>
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
          <div className="rounded-xl border overflow-hidden shadow-sm">
            <div className="bg-slate-600 text-white px-3 py-2.5 flex items-center gap-2 font-bold text-sm">
              <Search className="w-4 h-4 shrink-0" aria-hidden />
              Busca Persona
            </div>
            <div className="p-3 sm:p-4 space-y-3 bg-card">
              {searchMode === 'documento' ? (
                <>
                  <div className="grid grid-cols-1 min-[400px]:grid-cols-[minmax(0,8.5rem)_1fr] gap-2 gap-y-1 items-end">
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                        Tipo
                      </label>
                      <div
                        className="flex rounded-lg border bg-background p-0.5 gap-0.5"
                        role="group"
                        aria-label="Tipo de documento"
                      >
                        {TIPOS_DOCUMENTO_MRV.map((t) => (
                          <button
                            key={t.value}
                            type="button"
                            title={t.descripcion}
                            onClick={() => {
                              setTipoDoc(t.value);
                              setDocBusqueda('');
                              setSugerencias([]);
                            }}
                            className={`flex-1 min-w-0 h-9 rounded-md text-xs font-black tracking-tight transition-colors ${
                              tipoDoc === t.value
                                ? 'bg-[#0055A4] text-white shadow-sm'
                                : 'text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                        Documento
                      </label>
                      <input
                        value={docBusqueda}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (tipoDocumentoSoloDigitos(tipoDoc)) {
                            setDocBusqueda(v.replace(/\D/g, ''));
                          } else {
                            setDocBusqueda(v.toUpperCase().replace(/[^A-Z0-9-]/g, ''));
                          }
                        }}
                        className="w-full h-10 px-3 rounded-lg border bg-background text-sm font-mono"
                        placeholder={
                          tipoDocumentoSoloDigitos(tipoDoc)
                            ? 'Número sin puntos'
                            : 'Número o código alfanumérico'
                        }
                        inputMode={tipoDocumentoSoloDigitos(tipoDoc) ? 'numeric' : 'text'}
                        title="Número de documento"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => void buscarPorDocumento()}
                      className={`h-10 px-4 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors ${BTN_MRV}`}
                    >
                      <Search className="w-4 h-4" />
                      Buscar
                    </button>
                  </div>
                  <hr className="border-t border-dotted border-muted-foreground/40" />
                  <button
                    type="button"
                    onClick={() => {
                      setSearchMode('personales');
                      setSugerencias([]);
                    }}
                    className={`w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors ${BTN_MRV}`}
                  >
                    <User className="w-5 h-5 shrink-0" />
                    Búsqueda por datos personales
                  </button>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                        Primer nombre
                      </label>
                      <input
                        value={nombre1}
                        onChange={(e) => setNombre1(e.target.value)}
                        className="w-full h-10 px-2 rounded-lg border bg-background text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                        Segundo nombre
                      </label>
                      <input
                        value={nombre2}
                        onChange={(e) => setNombre2(e.target.value)}
                        className="w-full h-10 px-2 rounded-lg border bg-background text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                        Primer apellido
                      </label>
                      <input
                        value={apellido1}
                        onChange={(e) => setApellido1(e.target.value)}
                        className="w-full h-10 px-2 rounded-lg border bg-background text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                        Segundo apellido
                      </label>
                      <input
                        value={apellido2}
                        onChange={(e) => setApellido2(e.target.value)}
                        className="w-full h-10 px-2 rounded-lg border bg-background text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-1">
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                        Cédula madre/padre
                      </label>
                      <input
                        value={ciMadrePadre}
                        onChange={(e) => setCiMadrePadre(e.target.value.replace(/\D/g, ''))}
                        className="w-full h-10 px-2 rounded-lg border bg-background text-sm"
                        inputMode="numeric"
                        placeholder="6–8 dígitos"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                        Fecha de nacimiento
                      </label>
                      <input
                        type="date"
                        value={fechaNacBusqueda}
                        onChange={(e) => setFechaNacBusqueda(e.target.value)}
                        className="w-full h-10 px-2 rounded-lg border bg-background text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                        Sexo
                      </label>
                      <select
                        value={sexoBusqueda}
                        onChange={(e) => setSexoBusqueda(e.target.value as 'M' | 'F' | '')}
                        className="w-full h-10 px-2 rounded-lg border bg-background text-sm"
                      >
                        <option value="">—</option>
                        <option value="M">M</option>
                        <option value="F">F</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => void buscarDatosPersonales()}
                      className={`h-10 px-4 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors ${BTN_MRV}`}
                    >
                      <Search className="w-4 h-4" />
                      Buscar
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Puede buscar con iniciales o fragmentos (p. ej. «Ju» y «P») sin completar todos los campos; cada valor debe
                    coincidir con el inicio de alguna palabra del nombre en padrón.
                  </p>
                  <hr className="border-t border-dotted border-muted-foreground/40" />
                  <button
                    type="button"
                    onClick={() => {
                      setSearchMode('documento');
                      setSugerencias([]);
                    }}
                    className={`w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors ${BTN_MRV}`}
                  >
                    <CreditCard className="w-5 h-5 shrink-0" />
                    Búsqueda por documento
                  </button>
                </>
              )}
              {listaSugerencias}
            </div>
          </div>
        )}

        {!props.visitaSinDatosNino && (
          <div>
            <label className="field-label flex items-center gap-1">
              Nombre completo del niño/a <span className="text-destructive font-bold">*</span>
            </label>
            <input
              type="text"
              value={props.nombre}
              onChange={(e) => props.setNombre(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border bg-background text-sm"
              placeholder="Apellidos y nombres según documento"
              title="Nombre completo"
            />
          </div>
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
          <div
            className={`px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 ${
              props.edadValida ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
            }`}
          >
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
            {props.nombreMadre && <p className="text-xs text-muted-foreground">Nombre: {props.nombreMadre}</p>}
          </div>
        )}

        {(props.regionNombre || props.barrio) && (
          <div className="rounded-lg border bg-primary/5 p-3 text-xs space-y-1">
            <p className="font-semibold">Ubicación</p>
            <p className="text-muted-foreground">
              <b>Región:</b> {props.regionNombre || '—'}
            </p>
            <p className="text-muted-foreground">
              <b>Distrito:</b> {props.distritoNombre || '—'}
            </p>
            <p className="text-muted-foreground">
              <b>Servicio:</b> {props.servicioNombre || '—'}
            </p>
            <p className="text-muted-foreground">
              <b>Barrio:</b> {props.barrio || '—'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
