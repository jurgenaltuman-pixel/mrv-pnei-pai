import { useState, useCallback, useEffect, useMemo } from 'react';
import { dataService, type PersonaBase } from '@/services/dataService';
import { Search, Check, X, User, CreditCard } from 'lucide-react';
import { esCodigoTemporal, validarFormatoCodigoTemporal } from '@/lib/temp-code-rve';
import AddPadronPersonaForm from '@/components/mrv/AddPadronPersonaForm';
import { TIPOS_DOCUMENTO_MRV, tipoDocumentoSoloDigitos } from '@/lib/tipos-documento-mrv';
import { formatEdadPersona, parseHistorialSprDb, type HistorialSprCompleto } from '@/lib/padron-spr';
import { formatFechaPy } from '@/lib/format-fecha';
import { validarBusquedaPersonal } from '@/lib/busqueda-personal';
import { upperText } from '@/lib/text-uppercase';
import { resolveSexoPersona } from '@/lib/persona-sexo';
import { resolveFechaNacimientoPersona } from '@/lib/persona-fecha';
import PadronSprHistorial from '@/components/mrv/PadronSprHistorial';
import FechaInputPy from '@/components/mrv/FechaInputPy';
import CedulaOcrButtons from '@/components/mrv/CedulaOcrButtons';
import { useToast } from '@/hooks/use-toast';
import RegistroClipAdjuntosSection from '@/components/mrv/RegistroClipAdjuntos';
import {
  clipAdjuntosTienenDatos,
  clipStorageKey,
  REGISTRO_CLIP_ADJUNTOS_VACIO,
  type ClipNinoMeta,
  type RegistroClipAdjuntos,
} from '@/lib/registro-clip-adjuntos';
import { historialSprSinDatos } from '@/lib/historial-spr-vacio';
import {
  padronSearchBannerText,
  padronSearchBannerTone,
  type PadronSearchStatus,
} from '@/lib/padron-search-status';
import type { CedulaOcrFields, CedulaOcrTarget } from '@/lib/cedula-ocr-parse';

function personaToClipMeta(p: PersonaBase, tipoFallback: string): ClipNinoMeta {
  return {
    tipo: (p.tipo_documento || tipoFallback).trim().toUpperCase(),
    documento: p.documento.trim(),
    nombre: (p.nombre || '').trim(),
  };
}

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
  setNombreMadre?: (v: string) => void;
  setDocumentoMadre?: (v: string) => void;
  regionSanitaria?: string;
  distrito?: string;
  servicioSalud?: string;
  onClipAdjuntosChange: (a: RegistroClipAdjuntos) => void;
  isOnline?: boolean;
}

type SearchMode = 'documento' | 'personales';

/** Azul MSPBS (#0055A4): mismo tono en todos los navegadores (evita «morado» del tema). */
const BTN_MRV = 'bg-[#0055A4] hover:bg-[#003d7a] text-white shadow-md';

export default function ChildDataSection(props: Props) {
  const { toast } = useToast();
  const [sugerencias, setSugerencias] = useState<PersonaBase[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
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
  const [historialSpr, setHistorialSpr] = useState<HistorialSprCompleto | null>(null);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [mostrarAltaPadron, setMostrarAltaPadron] = useState(false);
  const [docNoEncontrado, setDocNoEncontrado] = useState('');
  const [clipPorNino, setClipPorNino] = useState<Record<string, RegistroClipAdjuntos>>({});
  const [clipActivoMeta, setClipActivoMeta] = useState<ClipNinoMeta | null>(null);
  const [padronSearchStatus, setPadronSearchStatus] = useState<PadronSearchStatus>({ kind: 'idle' });

  const tipoDocActual = props.sinDocumento ? 'DEX' : tipoDoc;

  const activarClipNino = useCallback(
    (meta: ClipNinoMeta) => {
      if (meta.documento.length < 4) return;
      const key = clipStorageKey(meta.tipo, meta.documento);
      setClipActivoMeta(meta);
      setClipPorNino((prev) => {
        const adj = prev[key] ?? REGISTRO_CLIP_ADJUNTOS_VACIO;
        props.onClipAdjuntosChange(adj);
        return prev;
      });
    },
    [props.onClipAdjuntosChange]
  );

  const actualizarClipActivo = useCallback(
    (adj: RegistroClipAdjuntos) => {
      if (!clipActivoMeta) return;
      const key = clipStorageKey(clipActivoMeta.tipo, clipActivoMeta.documento);
      setClipPorNino((prev) => ({ ...prev, [key]: adj }));
      props.onClipAdjuntosChange(adj);
    },
    [clipActivoMeta, props.onClipAdjuntosChange]
  );

  const cargarHistorialSpr = useCallback(async (p: PersonaBase) => {
    setHistorialLoading(true);
    setHistorialSpr(null);
    const h = await dataService.getHistorialSpr(p.documento, p.tipo_documento || tipoDoc);
    if (h && !h.padron && p.historial_spr) {
      const padronParsed = parseHistorialSprDb(p.historial_spr);
      setHistorialSpr({
        ...h,
        padron: padronParsed
          ? {
              ...padronParsed,
              edad_anos: p.edad_anos ?? padronParsed.edad_anos,
              edad_meses: p.edad_meses ?? padronParsed.edad_meses,
            }
          : null,
      });
    } else {
      setHistorialSpr(h);
    }
    setHistorialLoading(false);
  }, [tipoDoc]);

  const seleccionar = useCallback(
    (p: PersonaBase) => {
      props.setNombre(upperText(p.nombre));
      props.setDocumento(p.documento);
      const fn = resolveFechaNacimientoPersona(p);
      if (fn) props.setFechaNacimiento(fn);
      const sexoNorm = resolveSexoPersona(p);
      if (sexoNorm) {
        props.setSexo(sexoNorm);
      }
      if (p.documento_madre && props.setDocumentoMadre) props.setDocumentoMadre(p.documento_madre);
      props.onPersonaSeleccionada(p);
      setSugerencias([]);
      setMostrarAltaPadron(false);
      setDocNoEncontrado('');
      activarClipNino({
        ...personaToClipMeta(p, tipoDoc),
        nombre: upperText(p.nombre),
      });
      void cargarHistorialSpr(p);
    },
    [props, cargarHistorialSpr, activarClipNino, tipoDoc]
  );

  useEffect(() => {
    const doc = props.documento.trim();
    if (props.visitaSinDatosNino || doc.length < 4) {
      setHistorialSpr(null);
      return;
    }
    let cancelled = false;
    setHistorialLoading(true);
    void (async () => {
      const h = await dataService.getHistorialSpr(doc, tipoDoc);
      if (!cancelled) {
        setHistorialSpr(h);
        setHistorialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.documento, props.visitaSinDatosNino, tipoDoc]);

  useEffect(() => {
    if (!clipActivoMeta) return;
    if (props.documento.trim() !== clipActivoMeta.documento) return;
    const nombre = props.nombre.trim();
    if (nombre && nombre !== clipActivoMeta.nombre) {
      setClipActivoMeta((m) => (m ? { ...m, nombre } : m));
    }
  }, [props.nombre, props.documento, clipActivoMeta]);

  const clipActivoKey = clipActivoMeta
    ? clipStorageKey(clipActivoMeta.tipo, clipActivoMeta.documento)
    : null;
  const clipActivoAdjuntos = clipActivoKey
    ? clipPorNino[clipActivoKey] ?? REGISTRO_CLIP_ADJUNTOS_VACIO
    : REGISTRO_CLIP_ADJUNTOS_VACIO;

  const alternativasClip = useMemo(
    () => sugerencias.map((p) => personaToClipMeta(p, tipoDoc)),
    [sugerencias, tipoDoc]
  );

  const documentoClip = useMemo(
    () => (props.documento.trim() || docBusqueda.trim() || docNoEncontrado).trim(),
    [props.documento, docBusqueda, docNoEncontrado]
  );

  useEffect(() => {
    if (props.visitaSinDatosNino || documentoClip.length < 4) return;
    const key = clipStorageKey(tipoDocActual, documentoClip);
    if (clipActivoMeta && clipStorageKey(clipActivoMeta.tipo, clipActivoMeta.documento) === key) return;
    activarClipNino({ tipo: tipoDocActual, documento: documentoClip, nombre: props.nombre.trim() });
  }, [documentoClip, props.visitaSinDatosNino, props.nombre, tipoDocActual, clipActivoMeta, activarClipNino]);

  const clipSinHistorialSpr = useMemo(() => {
    if (historialLoading) return false;
    if (!clipActivoMeta) return false;
    if (props.documento.trim() !== clipActivoMeta.documento) return historialSprSinDatos(historialSpr);
    return historialSprSinDatos(historialSpr);
  }, [historialLoading, clipActivoMeta, props.documento, historialSpr]);

  const buscarPorDocumento = useCallback(async () => {
    if (props.visitaSinDatosNino) return;
    const raw = docBusqueda.trim();
    const soloDigitos = tipoDocumentoSoloDigitos(tipoDoc);
    const normalized = soloDigitos ? raw.replace(/\D/g, '') : raw.replace(/\s+/g, '').toUpperCase();
    const minLen = soloDigitos ? 4 : 3;
    if (normalized.length < minLen) {
      setSugerencias([]);
      setPadronSearchStatus({ kind: 'idle' });
      return;
    }
    setSearching(true);
    setMostrarAltaPadron(false);
    setPadronSearchStatus({ kind: 'searching', modo: 'documento' });
    const t0 = performance.now();
    try {
      const results = await dataService.buscarPersonasPorDocumento(raw, tipoDoc, 25);
      const ms = Math.round(performance.now() - t0);
      setSugerencias(results);
      if (results.length === 1) {
        setPadronSearchStatus({ kind: 'found', count: 1, modo: 'documento', ms });
        toast({
          title: 'Encontrado en el padrón',
          description: `${results[0].nombre} · ${tipoDoc} ${results[0].documento}`,
        });
        seleccionar(results[0]);
      } else if (results.length === 0) {
        setHistorialSpr(null);
        setDocNoEncontrado(normalized);
        setMostrarAltaPadron(true);
        setPadronSearchStatus({ kind: 'not_found', modo: 'documento', ms });
        activarClipNino({
          tipo: tipoDoc,
          documento: normalized,
          nombre: props.nombre.trim(),
        });
        toast({
          title: 'No encontrado en el padrón',
          description: 'No hay coincidencia con ese documento. Podés dar de alta o usar adjuntos opcionales.',
          variant: 'destructive',
        });
      } else {
        setDocNoEncontrado('');
        setPadronSearchStatus({ kind: 'found', count: results.length, modo: 'documento', ms });
        activarClipNino(personaToClipMeta(results[0], tipoDoc));
        toast({
          title: 'Varias coincidencias',
          description: `Se encontraron ${results.length} niños/as. Elegí uno de la lista.`,
        });
      }
    } catch (e) {
      const ms = Math.round(performance.now() - t0);
      const msg = e instanceof Error ? e.message : 'Error de búsqueda';
      setPadronSearchStatus({
        kind: 'error',
        message: `${msg} (padrón no disponible o sin conexión).`,
        modo: 'documento',
        ms,
      });
      toast({ title: 'Error al buscar', description: msg, variant: 'destructive' });
    }
    setSearching(false);
  }, [
    docBusqueda,
    tipoDoc,
    props.visitaSinDatosNino,
    props.nombre,
    seleccionar,
    toast,
    activarClipNino,
  ]);

  const buscarDatosPersonales = useCallback(async () => {
    if (props.visitaSinDatosNino) return;
    const val = validarBusquedaPersonal({
      nombre1,
      nombre2,
      apellido1,
      apellido2,
      documentoMadrePadre: ciMadrePadre,
      fechaNacimiento: fechaNacBusqueda,
      sexo: sexoBusqueda || undefined,
    });
    if (!val.ok || !val.filtros) {
      setSearchError(val.error || 'Criterios inválidos');
      setSugerencias([]);
      setPadronSearchStatus({ kind: 'idle' });
      return;
    }
    setSearchError(null);
    setSearching(true);
    setPadronSearchStatus({ kind: 'searching', modo: 'personales' });
    const t0 = performance.now();
    try {
      const results = await dataService.buscarPersonasDatosPersonales(val.filtros, 25);
      const ms = Math.round(performance.now() - t0);
      setSugerencias(results);
      if (results.length === 1) {
        setPadronSearchStatus({ kind: 'found', count: 1, modo: 'personales', ms });
        toast({
          title: 'Encontrado en el padrón',
          description: `${results[0].nombre} · ${results[0].documento}`,
        });
        seleccionar(results[0]);
      } else if (results.length === 0) {
        setMostrarAltaPadron(true);
        setClipActivoMeta(null);
        setPadronSearchStatus({ kind: 'not_found', modo: 'personales', ms });
        toast({
          title: 'No encontrado en el padrón',
          description: 'Ningún niño/a coincide con esos datos. Podés completar el alta manual.',
          variant: 'destructive',
        });
      } else {
        setMostrarAltaPadron(false);
        setPadronSearchStatus({ kind: 'found', count: results.length, modo: 'personales', ms });
        activarClipNino(personaToClipMeta(results[0], tipoDoc));
        toast({
          title: 'Varias coincidencias',
          description: `Se encontraron ${results.length} resultados. Elegí uno de la lista.`,
        });
      }
    } catch (e) {
      const ms = Math.round(performance.now() - t0);
      const msg = e instanceof Error ? e.message : 'Error de búsqueda';
      setPadronSearchStatus({ kind: 'error', message: msg, modo: 'personales', ms });
      toast({ title: 'Error al buscar', description: msg, variant: 'destructive' });
    }
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
    toast,
    seleccionar,
    activarClipNino,
    tipoDoc,
  ]);

  const handleDocChange = (raw: string) => {
    if (props.sinDocumento || esCodigoTemporal(raw)) {
      props.setDocumento(raw.toUpperCase());
      return;
    }
    props.setDocumento(raw.replace(/\D/g, ''));
  };

  const codigoTmpValido = !props.sinDocumento || validarFormatoCodigoTemporal(props.documento);

  const aplicarOcr = useCallback(
    (target: CedulaOcrTarget, fields: CedulaOcrFields) => {
      if (target === 'nino') {
        if (fields.documento) {
          props.setDocumento(fields.documento);
          setDocBusqueda(fields.documento);
          props.setSinDocumento(false);
        }
        if (fields.nombre) props.setNombre(upperText(fields.nombre));
        if (fields.fechaNacimiento) props.setFechaNacimiento(fields.fechaNacimiento);
        if (fields.sexo) props.setSexo(fields.sexo);
        if (fields.documentoMadre && props.setDocumentoMadre) {
          props.setDocumentoMadre(fields.documentoMadre);
        }
      } else {
        if (fields.documentoMadre && props.setDocumentoMadre) {
          props.setDocumentoMadre(fields.documentoMadre);
        }
        if (fields.nombre && props.setNombreMadre) {
          props.setNombreMadre(upperText(fields.nombre));
        }
      }
      const hint = [
        target === 'nino' ? fields.documento : fields.documentoMadre,
        fields.nombre,
      ]
        .filter(Boolean)
        .join(' · ');
      toast({
        title: 'Cédula leída (offline)',
        description: hint || 'Revisá y corregí los campos si hace falta.',
      });
      if (fields.warnings.length) {
        toast({
          title: 'Completá o corregí',
          description: fields.warnings.slice(0, 2).join(' '),
          variant: 'destructive',
        });
      }
    },
    [props, toast]
  );

  const listaSugerencias =
    sugerencias.length > 0 || searching ? (
      <div className="mt-2 bg-card border rounded-lg shadow-lg max-h-44 overflow-y-auto z-20 relative">
        {searching && <p className="px-3 py-2 text-xs text-muted-foreground">Buscando...</p>}
        {sugerencias.map((p, idx) => {
          const clipKey = clipStorageKey(p.tipo_documento || tipoDoc, p.documento);
          const tieneClip = clipAdjuntosTienenDatos(clipPorNino[clipKey]);
          return (
          <button
            key={p.id ?? `${p.documento}-${idx}`}
            type="button"
            onClick={() => seleccionar(p)}
            className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent border-b last:border-0"
          >
            <span className="font-medium">{p.nombre}</span>
            {tieneClip && (
              <span className="ml-1.5 text-[9px] font-bold uppercase text-amber-700 dark:text-amber-300">
                · clip
              </span>
            )}
            <span className="text-muted-foreground ml-2">
              {p.tipo_documento || 'CI'} {p.documento}
            </span>
            {p.fecha_nacimiento && (
              <span className="block text-[10px] text-muted-foreground">
                FN: {formatFechaPy(p.fecha_nacimiento)}
              </span>
            )}
            {(() => {
              const edad = formatEdadPersona(p, p.fecha_nacimiento ?? undefined);
              return edad ? (
                <span className="block text-[10px] text-primary/90 font-medium">{edad}</span>
              ) : null;
            })()}
            {p.historial_spr?.dosis?.length ? (
              <span className="block text-[10px] text-muted-foreground">
                SPR: {p.historial_spr.dosis.length} dosis en nómina
              </span>
            ) : null}
          </button>
        );
        })}
      </div>
    ) : null;

  const bannerText = padronSearchBannerText(padronSearchStatus);
  const bannerTone = padronSearchBannerTone(padronSearchStatus);
  const bannerClass =
    bannerTone === 'success'
      ? 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
      : bannerTone === 'warning'
        ? 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
        : bannerTone === 'error'
          ? 'bg-destructive/10 border-destructive/40 text-destructive'
          : 'bg-muted/50 border-border text-muted-foreground';

  const panelClipOpcional = !props.visitaSinDatosNino ? (
    <details className="rounded-lg border-2 border-[#0055A4]/25 bg-[#0055A4]/5 group">
      <summary className="cursor-pointer px-3 py-2.5 text-sm font-bold text-[#0055A4] list-none flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
        <span>Subir imágenes a Drive (opcional · máx. 2)</span>
        <span className="text-[10px] font-normal text-muted-foreground group-open:hidden">Tocá para abrir</span>
        <span className="text-[10px] font-normal text-muted-foreground hidden group-open:inline">Tocá para cerrar</span>
      </summary>
      <div className="px-2 pb-2">
        <RegistroClipAdjuntosSection
          meta={{
            tipo: tipoDocActual,
            documento: props.documento.trim() || documentoClip,
            nombre: props.nombre.trim(),
          }}
          adjuntos={clipActivoAdjuntos}
          onAdjuntosChange={actualizarClipActivo}
          alternativas={alternativasClip.length > 1 ? alternativasClip : undefined}
          onElegirAlternativa={(m) => {
            const p = sugerencias.find(
              (s) =>
                clipStorageKey(s.tipo_documento || tipoDoc, s.documento) ===
                clipStorageKey(m.tipo, m.documento)
            );
            if (p) seleccionar(p);
            else activarClipNino(m);
          }}
          sinHistorialSpr={clipSinHistorialSpr}
          opcional
          soloFotos
          embedded
          isOnline={props.isOnline ?? true}
        />
      </div>
    </details>
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
              {bannerText && (
                <div
                  role="status"
                  className={`rounded-lg border px-3 py-2 text-xs font-medium ${bannerClass}`}
                >
                  {bannerText}
                </div>
              )}
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
                        onChange={(e) => setNombre1(upperText(e.target.value))}
                        className="w-full h-10 px-2 rounded-lg border bg-background text-sm mrv-field-text"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                        Segundo nombre
                      </label>
                      <input
                        value={nombre2}
                        onChange={(e) => setNombre2(upperText(e.target.value))}
                        className="w-full h-10 px-2 rounded-lg border bg-background text-sm mrv-field-text"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                        Primer apellido
                      </label>
                      <input
                        value={apellido1}
                        onChange={(e) => setApellido1(upperText(e.target.value))}
                        className="w-full h-10 px-2 rounded-lg border bg-background text-sm mrv-field-text"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                        Segundo apellido
                      </label>
                      <input
                        value={apellido2}
                        onChange={(e) => setApellido2(upperText(e.target.value))}
                        className="w-full h-10 px-2 rounded-lg border bg-background text-sm mrv-field-text"
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
                        Fecha nac. (dd/mm/aaaa o DDMMAAAA)
                      </label>
                      <FechaInputPy
                        value={fechaNacBusqueda}
                        onChange={setFechaNacBusqueda}
                        className="w-full h-10 px-2 rounded-lg border bg-background text-sm"
                        placeholder="15/03/2015 o 15032015"
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
                  {searchError && (
                    <p className="text-[11px] text-destructive font-medium">{searchError}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    Basta con un criterio válido: un nombre, dos nombres, solo apellido, solo fecha de nacimiento (dd/mm/aaaa o
                    DDMMAAAA), solo CI de la madre/padre, o sexo. Si completa varios, todos deben coincidir en el padrón.
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
          <CedulaOcrButtons
            disabled={searching}
            onResult={aplicarOcr}
            onError={(msg) =>
              toast({ title: 'No se pudo leer la cédula', description: msg, variant: 'destructive' })
            }
          />
        )}

        {!props.visitaSinDatosNino && mostrarAltaPadron && (
          <AddPadronPersonaForm
            documentoSugerido={docNoEncontrado || docBusqueda}
            regionSanitaria={props.regionSanitaria}
            distrito={props.distrito}
            servicioSalud={props.servicioSalud}
            onGuardada={(p) => seleccionar(p)}
            onCancelar={() => setMostrarAltaPadron(false)}
          />
        )}

        {!props.visitaSinDatosNino && props.documento.length >= 4 && (
          <PadronSprHistorial historial={historialSpr} loading={historialLoading} />
        )}

        {!props.visitaSinDatosNino && (
          <div>
            <label className="field-label flex items-center gap-1">
              Nombre completo del niño/a <span className="text-destructive font-bold">*</span>
            </label>
            <input
              type="text"
              value={props.nombre}
              onChange={(e) => props.setNombre(upperText(e.target.value))}
              className="w-full h-11 px-3 rounded-lg border bg-background text-sm mrv-field-text"
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
            placeholder={props.sinDocumento ? 'Iniciales + DDMMAAAA (ej. MEG15032015)' : 'Número de CI'}
            inputMode={props.sinDocumento ? 'text' : 'numeric'}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={props.sinDocumento}
                onChange={(e) => props.setSinDocumento(e.target.checked)}
              />
              Sin CI — iniciales + fecha de nacimiento
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
              Código: iniciales del nombre + fecha de nacimiento (DDMMAAAA). Complete nombre y fecha antes de generar.
            </p>
          )}
        </div>

        <div>
          <label className="field-label flex items-center gap-1">
            Fecha de Nacimiento {!props.visitaSinDatosNino && <span className="text-destructive font-bold">*</span>}
          </label>
          <FechaInputPy value={props.fechaNacimiento} onChange={props.setFechaNacimiento} />
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
                className={`flex-1 h-10 rounded-lg font-semibold text-sm border transition-colors ${
                  props.sexo === s
                    ? 'bg-primary text-primary-foreground border-primary shadow-md ring-2 ring-primary/40'
                    : 'bg-secondary text-secondary-foreground border-border hover:bg-muted'
                }`}
                aria-pressed={props.sexo === s}
              >
                {s === 'M' ? 'Masculino' : 'Femenino'}
              </button>
            ))}
          </div>
        </div>

        {!props.visitaSinDatosNino && (
          <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
            <p className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
              <User className="w-3.5 h-3.5" /> Madre (RVe) <span className="text-destructive">*</span>
            </p>
            <input
              value={props.documentoMadre}
              onChange={(e) => props.setDocumentoMadre?.(e.target.value.replace(/\D/g, ''))}
              className="w-full h-9 px-2 rounded-lg border bg-background text-sm"
              placeholder="CI de la madre (6–8 dígitos) *"
              inputMode="numeric"
            />
            <input
              value={props.nombreMadre}
              onChange={(e) => props.setNombreMadre?.(e.target.value)}
              className="w-full h-9 px-2 rounded-lg border bg-background text-sm"
              placeholder="Nombre completo de la madre *"
            />
          </div>
        )}

        {panelClipOpcional}

      </div>
    </div>
  );
}
