import { useState, useMemo, useEffect, useCallback, Suspense, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { useProfileScope } from '@/hooks/useProfileScope';
import { ubicacionBloqueadaPorAsignacion } from '@/lib/assignment-lock';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useOrgStructure } from '@/hooks/useOrgStructure';
import { useDataRefresh } from '@/contexts/DataRefreshContext';
import { offlineCache } from '@/services/offlineCache';
import HeaderSection from '@/components/mrv/HeaderSection';
import ChildDataSection from '@/components/mrv/ChildDataSection';
import BottomNav from '@/components/mrv/BottomNav';
import {
  esCodigoTemporal,
  generarCodigoTemporalDesdePersona,
  validarFormatoCodigoTemporal,
} from '@/lib/temp-code-rve';
import { isFechaEnCampanaCvs } from '@/lib/mrv-constants';
import { isMrvTerrenoCompleto } from '@/lib/mrv-cvs-flow';
import { edadNominalDesdePersona, edadTotalEnMeses, esquemaFromDosisMonitoreo } from '@/lib/mrv-esquema';
import { upperText, upperTextOptional } from '@/lib/text-uppercase';
import {
  baselineDesdePersona,
  ubicacionSanitariaDifiereDeBaseline,
  type UbicacionSanitariaBaseline,
} from '@/lib/cambio-residencia';
import { resolveFechaNacimientoPersona } from '@/lib/persona-fecha';
import { resolveSexoPersona } from '@/lib/persona-sexo';
import { mapPadronApiPersona } from '@/services/dataService';
import type { FuenteVerificacion, AccionTomada } from '@/lib/mrv-constants';
import { acumularJornada } from '@/lib/jornada-storage';
import {
  loadVisitSession,
  saveVisitSession,
  deltaContadorPorTipo,
} from '@/lib/visit-session-storage';
import { CampaignAppHeader } from '@/components/branding/CampaignAppHeader';
import { PadronOfflineBanner } from '@/components/mrv/PadronOfflineBanner';
import ProfileScopeEditor from '@/components/mrv/ProfileScopeEditor';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { PageSkeleton, MapSkeleton } from '@/components/mrv/PageSkeleton';
import { clearChunkReloadFlag, lazyWithRetry } from '@/lib/lazy-with-retry';

const DashboardView = lazyWithRetry(() => import('@/components/mrv/DashboardView'), 'Dashboard');
const MapView = lazyWithRetry(() => import('@/components/mrv/MapView'), 'Mapa');
const AdminPanel = lazyWithRetry(() => import('@/components/mrv/AdminPanel'), 'Admin');
import type { ContadorViviendas } from '@/types/mrv';
import { dataService, type PersonaBase } from '@/services/dataService';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useToast } from '@/hooks/use-toast';
import { supabase, isSupabaseEnabled } from '@/integrations/supabase/client';
import { USE_MRV_API, USE_SUPABASE_PADRON, mrvApiFetch, useRegistrosApi } from '@/lib/api-config';
import RoundMonitoringFlow from '@/components/round/RoundMonitoringFlow';
import RecentRoundsDock from '@/components/round/RecentRoundsDock';
import type { RoundMonitoring } from '@/types/round-monitoring';
import VaccinationSectionMonitoreo from '@/components/mrv/VaccinationSectionMonitoreo';
import VerificacionSection from '@/components/mrv/VerificacionSection';
import type { NinoCasa } from '@/types/round-monitoring';
import { aplicarNinoCasaAlFormulario } from '@/lib/nino-casa-form';

function calcularEdad(fechaNac: string): { texto: string; valida: boolean } {
  if (!fechaNac) return { texto: '', valida: false };
  const nacimiento = new Date(fechaNac);
  const hoy = new Date();
  let años = hoy.getFullYear() - nacimiento.getFullYear();
  let meses = hoy.getMonth() - nacimiento.getMonth();
  if (meses < 0) { años--; meses += 12; }
  if (hoy.getDate() < nacimiento.getDate()) { meses--; if (meses < 0) { años--; meses += 12; } }
  const valida = años >= 1 && años <= 5;
  return { texto: `EDAD: ${años} años, ${meses} meses ${valida ? '(Apto 1-5 años)' : '(Fuera de rango)'}`, valida };
}

function parseCoordsFromMapsLink(link: string): { lat: number; lng: number } | null {
  if (!link) return null;
  const text = link.trim();

  const patterns = [
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, // .../@lat,lng,...
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, // ...!3dlat!4dlng...
    /[?&](?:q|ll)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, // ?q=lat,lng or ?ll=lat,lng
    /[?&]destination=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/, // generic "lat,lng"
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    return { lat, lng };
  }
  return null;
}

async function resolveShortMapsLink(link: string): Promise<string> {
  if (!/maps\.app\.goo\.gl/i.test(link)) return link;
  try {
    const res = await fetch(link, { method: 'HEAD', redirect: 'follow', mode: 'no-cors' });
    if (res.url) return res.url;
  } catch {
  }
  try {
    const res = await fetch(link, { method: 'GET', redirect: 'follow', mode: 'no-cors' });
    if (res.url) return res.url;
  } catch {
  }
  return link;
}

export default function MainApp() {
  useEffect(() => {
    clearChunkReloadFlag();
  }, []);

  const { user, logout } = useAuth();
  const { isAdmin, isSuperAdmin } = useRole();
  const { data: profileScope } = useProfileScope();
  const ubicacionAsignacionFija = ubicacionBloqueadaPorAsignacion(profileScope, {
    isAdmin,
    isSuperAdmin,
  });
  const isOnline = useOnlineStatus();
  const { triggerRefresh } = useDataRefresh();
  const geo = useGeolocation();
  const { toast } = useToast();
  const { canInstall, install } = usePwaInstall();
  const { regiones, distritos, servicios, getBarriosByDistrito } = useOrgStructure();
  const [tab, setTab] = useState('registro');
  const [pendingCount, setPendingCount] = useState(0);
  const [resumeRoundId, setResumeRoundId] = useState<string | null>(null);
  const [roundsDockKey, setRoundsDockKey] = useState(0);
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);
  const padronLookupRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!resumeRoundId) return;
    const t = setTimeout(() => setResumeRoundId(null), 400);
    return () => clearTimeout(t);
  }, [resumeRoundId]);

  useEffect(() => {
    void offlineCache.getPendingCount().then(setPendingCount);
  }, []);

  const [regionId, setRegionId] = useState<number | null>(null);
  const [distritoId, setDistritoId] = useState<number | null>(null);
  const [servicioId, setServicioId] = useState<number | null>(null);
  const [servicioManual, setServicioManual] = useState('');
  const [barrio, setBarrio] = useState('');
  const [responsable, setResponsable] = useState(upperTextOptional(user?.nombre));
  const [mapsLink, setMapsLink] = useState('');
  const [mapsResolvedLink, setMapsResolvedLink] = useState('');
  const [mapsResolving, setMapsResolving] = useState(false);
  const [scopeLocked, setScopeLocked] = useState(false);
  const [perfilAsignacion, setPerfilAsignacion] = useState<{
    region: string;
    distrito: string;
    servicio: string;
  } | null>(null);

  const [nombre, setNombre] = useState('');
  const [documento, setDocumento] = useState('');
  const [sinDocumento, setSinDocumento] = useState(false);
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [edadAnosPadron, setEdadAnosPadron] = useState<number | null>(null);
  const [edadMesesPadron, setEdadMesesPadron] = useState<number | null>(null);
  const [sexo, setSexo] = useState('');
  const [nombreMadre, setNombreMadre] = useState('');
  const [documentoMadre, setDocumentoMadre] = useState('');

  const [libreta, setLibreta] = useState<boolean | null>(null);
  const [estadoVacuna, setEstadoVacuna] = useState<'vacunado' | 'no_vacunado' | null>(null);
  const [dosisSpr, setDosisSpr] = useState<'primera' | 'segunda' | 'adicional' | null>(null);
  const [fechaSpr, setFechaSpr] = useState('');
  const [esquemaCompleto, setEsquemaCompleto] = useState<boolean | null>(null);
  const [motivo, setMotivo] = useState('');
  const [fuenteVerificacion, setFuenteVerificacion] = useState<FuenteVerificacion | ''>('');
  const [tieneCvs, setTieneCvs] = useState<boolean | null>(null);
  const [accionTomada, setAccionTomada] = useState<AccionTomada | ''>('');
  const [observaciones, setObservaciones] = useState('');
  const [cambioResidencia, setCambioResidencia] = useState(false);
  /** Línea base (padrón o al abrir edición) para marcar «Cambio de residencia» sin tocar otros campos. */
  const ubicacionPadronRef = useRef<UbicacionSanitariaBaseline | null>(null);
  const scopeInicialAplicadoRef = useRef(false);
  const [rechazoVacunacion, setRechazoVacunacion] = useState(false);
  const [workflowStep, setWorkflowStep] = useState(1);
  const [contador, setContador] = useState<ContadorViviendas>({ efectivas: 0, noEfectivas: 0, fallidas: 0, renuentes: 0 });
  // Por defecto, tipo de casa 'efectiva'
  const [viviendaTipo, setViviendaTipo] = useState<'efectiva' | 'revisitada' | 'sin_adulto_responsable' | 'renuente'>('efectiva');
  const [saving, setSaving] = useState(false);
  const [ninoEnEdicion, setNinoEnEdicion] = useState<NinoCasa | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const draft = loadVisitSession(user.id);
    if (!draft) return;
    if (draft.regionId != null) setRegionId(draft.regionId);
    if (draft.distritoId != null) setDistritoId(draft.distritoId);
    if (draft.servicioId != null) setServicioId(draft.servicioId);
    if (draft.servicioManual) setServicioManual(draft.servicioManual);
    if (draft.barrio) setBarrio(draft.barrio);
    if (draft.responsable) setResponsable(draft.responsable);
    if (draft.mapsLink) setMapsLink(draft.mapsLink);
    setContador(draft.contador);
    setViviendaTipo(draft.viviendaTipo);
    setWorkflowStep(draft.workflowStep);
    toast({
      title: 'Avance restaurado',
      description: 'Se recuperaron ubicación y conteo de casas de tu última visita.',
    });
  }, [user?.id, toast]);

  useEffect(() => {
    if (!user?.id) return;
    const t = window.setTimeout(() => {
      saveVisitSession(user.id, {
        regionId,
        distritoId,
        servicioId,
        servicioManual,
        barrio,
        responsable,
        mapsLink,
        contador,
        viviendaTipo,
        workflowStep,
      });
    }, 500);
    return () => window.clearTimeout(t);
  }, [
    user?.id,
    regionId,
    distritoId,
    servicioId,
    servicioManual,
    barrio,
    responsable,
    mapsLink,
    contador,
    viviendaTipo,
    workflowStep,
  ]);
  const [dosisMonitoreo, setDosisMonitoreo] = useState<'1' | '2plus' | null>(null);

  const edad = useMemo(() => calcularEdad(fechaNacimiento), [fechaNacimiento]);
  const edadTotalMeses = useMemo(
    () =>
      edadTotalEnMeses({
        fechaNacimiento,
        edad_anos: edadAnosPadron,
        edad_meses: edadMesesPadron,
      }),
    [fechaNacimiento, edadAnosPadron, edadMesesPadron]
  );

  const regionNombre = regiones.find(r => r.id === regionId)?.nombre || '';
  const distritoNombre = distritos.find(d => d.id === distritoId)?.nombre || '';
  const servicioNombre = servicios.find(s => s.id === servicioId)?.nombre || servicioManual.trim();
  const barriosDisponiblesRonda = useMemo(() => {
    if (!distritoId) return [];
    const rows = getBarriosByDistrito(distritoId) || [];
    const names = rows.map((b) => (b.nombre || '').trim()).filter(Boolean);
    return Array.from(new Set(names));
  }, [distritoId, getBarriosByDistrito]);

  const normalizeText = (value: string | null | undefined) =>
    (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

  const matchServicioFlexible = (targetRaw: string | null | undefined, distritoId?: number) => {
    const target = normalizeText(targetRaw);
    if (!target) return undefined;
    const pool = (distritoId ? servicios.filter((s) => s.distrito_id === distritoId) : servicios);
    if (!pool.length) return undefined;

    const exact = pool.find((s) => normalizeText(s.nombre) === target);
    if (exact) return exact;

    const contains = pool.find((s) => {
      const n = normalizeText(s.nombre);
      return n.includes(target) || target.includes(n);
    });
    if (contains) return contains;

    const tokens = target.split(/\s+/).filter(Boolean);
    return pool.find((s) => {
      const n = normalizeText(s.nombre);
      return tokens.every((t) => n.includes(t));
    });
  };

  useEffect(() => {
    if (!user || regiones.length === 0) return;
    if (scopeInicialAplicadoRef.current) return;
    let active = true;
    async function loadScope() {
      let data: Record<string, unknown> | null = null;
      if (USE_MRV_API) {
        const { data: res } = await mrvApiFetch<{ data: Record<string, unknown> | null }>('/api/profiles/scope');
        data = res?.data ?? null;
      } else if (isSupabaseEnabled) {
        const { data: row, error } = await supabase
          .from('profiles')
          .select('assigned_region, assigned_distrito, assigned_servicio, assigned_barrio, scope_locked')
          .eq('user_id', user.id)
          .maybeSingle();
        if (error || !row || !active) return;
        data = row as Record<string, unknown>;
      }
      if (!data || !active) return;
      scopeInicialAplicadoRef.current = true;

      const locked = Boolean((data as any).scope_locked);
      setScopeLocked(locked);

      const assignedRegion = (data as any).assigned_region as string | null;
      const assignedDistrito = (data as any).assigned_distrito as string | null;
      const assignedServicio = (data as any).assigned_servicio as string | null;
      const assignedBarrio = (data as any).assigned_barrio as string | null;

      const region = regiones.find((r) => normalizeText(r.nombre) === normalizeText(assignedRegion));
      setPerfilAsignacion({
        region: assignedRegion || '',
        distrito: assignedDistrito || '',
        servicio: assignedServicio || '',
      });

      if (region) {
        setRegionId(region.id);
        const distrito = distritos.find((d) =>
          d.region_id === region.id && normalizeText(d.nombre) === normalizeText(assignedDistrito)
        );
        if (distrito) {
          setDistritoId(distrito.id);
          const servicio = matchServicioFlexible(assignedServicio, distrito.id);
          const barrioCanonico = getBarriosByDistrito(distrito.id).find(
            (b) => normalizeText(b.nombre) === normalizeText(assignedBarrio)
          );
          if (servicio) {
            setServicioId(servicio.id);
            setServicioManual('');
          } else {
            setServicioId(null);
            setServicioManual(assignedServicio || '');
          }
          if (assignedBarrio && !locked) {
            setBarrio((prev) => prev.trim() || (barrioCanonico?.nombre || assignedBarrio).trim());
          }
        }
      }
      if (assignedBarrio && !region && !locked) {
        setBarrio((prev) => prev.trim() || assignedBarrio.trim());
      }
    }
    void loadScope();

    if (!USE_MRV_API && isSupabaseEnabled) {
      const channel = supabase
        .channel(`profiles-scope-${user.id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `user_id=eq.${user.id}` },
          () => { void loadScope(); }
        )
        .subscribe();
      return () => {
        active = false;
        supabase.removeChannel(channel);
      };
    }

    return () => {
      active = false;
    };
  }, [user?.id, regiones.length]);

  const resolverUbicacionPadron = useCallback(
    (persona: PersonaBase) => {
      const region = regiones.find((r) => normalizeText(r.nombre) === normalizeText(persona.region_sanitaria));
      const distritoByText = region
        ? distritos.find(
            (d) => d.region_id === region.id && normalizeText(d.nombre) === normalizeText(persona.distrito)
          )
        : undefined;
      const servicioByText = distritoByText
        ? matchServicioFlexible(persona.servicio_salud, distritoByText.id)
        : undefined;
      const servicioByGlobal =
        !servicioByText && persona.servicio_salud ? matchServicioFlexible(persona.servicio_salud) : undefined;

      let regionIdRes: number | null = region?.id ?? null;
      let distritoIdRes: number | null = distritoByText?.id ?? null;
      let servicioIdRes: number | null = null;
      let servicioManualRes = '';

      if (servicioByText) {
        servicioIdRes = servicioByText.id;
      } else if (servicioByGlobal) {
        const distritoInferred = distritos.find((d) => d.id === servicioByGlobal.distrito_id);
        if (distritoInferred) {
          distritoIdRes = distritoInferred.id;
          const regionInferred = regiones.find((r) => r.id === distritoInferred.region_id);
          if (regionInferred) regionIdRes = regionInferred.id;
        }
        servicioIdRes = servicioByGlobal.id;
      } else {
        servicioManualRes = upperText(persona.servicio_salud || '');
      }

      return {
        regionId: regionIdRes,
        distritoId: distritoIdRes,
        servicioId: servicioIdRes,
        servicioManual: servicioManualRes,
      };
    },
    [regiones, distritos, servicios]
  );

  const ubicacionSanitariaActual = useCallback(
    (override?: {
      regionId?: number | null;
      distritoId?: number | null;
      servicioId?: number | null;
      servicioManual?: string;
    }) => {
      const rId = override?.regionId !== undefined ? override.regionId : regionId;
      const dId = override?.distritoId !== undefined ? override.distritoId : distritoId;
      const sId = override?.servicioId !== undefined ? override.servicioId : servicioId;
      const sManual = override?.servicioManual !== undefined ? override.servicioManual : servicioManual;
      const region = regiones.find((r) => r.id === rId);
      const distrito = distritos.find((d) => d.id === dId);
      const servicio = servicios.find((s) => s.id === sId);
      return {
        regionId: rId,
        distritoId: dId,
        servicioId: sId,
        servicioManual: sManual,
        regionText: region?.nombre || '',
        distritoText: distrito?.nombre || '',
        servicioText: servicio?.nombre || sManual.trim(),
      };
    },
    [regionId, distritoId, servicioId, servicioManual, regiones, distritos, servicios]
  );

  const revisarCambioResidencia = useCallback(
    (override?: {
      regionId: number | null;
      distritoId: number | null;
      servicioId: number | null;
      servicioManual: string;
    }) => {
      const base = ubicacionPadronRef.current;
      if (!base) return;
      const actual = ubicacionSanitariaActual(override);
      if (ubicacionSanitariaDifiereDeBaseline(base, actual)) {
        setCambioResidencia(true);
      }
    },
    [ubicacionSanitariaActual]
  );

  const aplicarUbicacionDesdePadron = useCallback(
    (persona: PersonaBase) => {
      const u = resolverUbicacionPadron(persona);
      ubicacionPadronRef.current = baselineDesdePersona(persona, u);
      setCambioResidencia(false);

      if (u.regionId != null) setRegionId(u.regionId);
      if (u.distritoId != null) setDistritoId(u.distritoId);

      if (u.servicioId != null) {
        setServicioId(u.servicioId);
        setServicioManual('');
        return;
      }
      setServicioId(null);
      setServicioManual(u.servicioManual);
    },
    [resolverUbicacionPadron]
  );

  useEffect(() => {
    if (estadoVacuna === 'vacunado') {
      setEsquemaCompleto(esquemaFromDosisMonitoreo(dosisMonitoreo, edadTotalMeses));
    } else if (estadoVacuna === 'no_vacunado') {
      setEsquemaCompleto(false);
    } else {
      setEsquemaCompleto(null);
    }
  }, [estadoVacuna, dosisMonitoreo, edadTotalMeses]);

  const aplicarVacunacionDesdePadron = useCallback((persona: PersonaBase) => {
    const spr = persona.historial_spr;
    if (!spr) return;
    const n = spr.cantidad_dosis ?? spr.dosis?.length ?? 0;
    if (n >= 2 || spr.esquema_completo === true) {
      setEstadoVacuna('vacunado');
      setDosisMonitoreo('2plus');
      setEsquemaCompleto(true);
      setTieneCvs(true);
    } else if (n === 1 || spr.esquema_completo === false) {
      setEstadoVacuna('vacunado');
      setDosisMonitoreo('1');
      const nominal = edadNominalDesdePersona(persona);
      const meses = edadTotalEnMeses({
        fechaNacimiento: persona.fecha_nacimiento,
        edad_anos: nominal.edad_anos ?? spr.edad_anos,
        edad_meses: nominal.edad_meses ?? spr.edad_meses,
      });
      setEsquemaCompleto(esquemaFromDosisMonitoreo('1', meses));
      setTieneCvs(true);
    }
  }, []);

  const aplicarDatosDesdePersona = useCallback(
    (persona: PersonaBase) => {
      const nominal = edadNominalDesdePersona(persona);
      setEdadAnosPadron(nominal.edad_anos);
      setEdadMesesPadron(nominal.edad_meses);
      setNombreMadre(upperText(persona.nombre_madre || ''));
      setDocumentoMadre(persona.documento_madre || '');
      const sx = resolveSexoPersona(persona);
      if (sx) setSexo(sx);
      aplicarUbicacionDesdePadron(persona);
      aplicarVacunacionDesdePadron(persona);
    },
    [aplicarUbicacionDesdePadron, aplicarVacunacionDesdePadron]
  );

  const generarDocumentoTemporal = useCallback(() => {
    const codigo = generarCodigoTemporalDesdePersona(nombre, fechaNacimiento);
    if (!codigo) {
      toast({
        title: 'Complete nombre y fecha',
        description: 'El código temporal usa las iniciales del niño/a y su fecha de nacimiento (DDMMAAAA).',
        variant: 'destructive',
      });
      return;
    }
    setDocumento(codigo);
  }, [nombre, fechaNacimiento, toast]);

  useEffect(() => {
    if (!sinDocumento) {
      setDocumento((d) => (esCodigoTemporal(d) ? '' : d));
      return;
    }
    const codigo = generarCodigoTemporalDesdePersona(nombre, fechaNacimiento);
    if (codigo) setDocumento(codigo);
  }, [sinDocumento, nombre, fechaNacimiento]);

  const fechaSprValida = useMemo(() => isFechaEnCampanaCvs(fechaSpr), [fechaSpr]);

  const motivoCompuesto = estadoVacuna === 'no_vacunado' 
    ? motivo?.trim() || null  // Solo el motivo de rechazo para "no_vacunado"
    : [
        dosisSpr ? `SPR: ${dosisSpr}` : null,
        fechaSpr ? `Fecha: ${fechaSpr}` : null,
      ].filter(Boolean).join(' | ') || null;  // Datos de dosis para "vacunado"

  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      offlineCache.syncAll().then(({ synced }) => {
        if (synced > 0) {
          toast({ title: `${synced} registros sincronizados`, description: 'Datos pendientes enviados al servidor' });
        }
        void offlineCache.getPendingCount().then(setPendingCount);
      });
    }
  }, [isOnline]);

  useEffect(() => {
    let active = true;
    async function run() {
      if (!mapsLink.trim()) {
        setMapsResolvedLink('');
        setMapsResolving(false);
        return;
      }
      setMapsResolving(true);
      const resolved = await resolveShortMapsLink(mapsLink.trim());
      if (!active) return;
      setMapsResolvedLink(resolved);
      setMapsResolving(false);
    }
    void run();
    return () => { active = false; };
  }, [mapsLink]);

  // Buscar persona por CI (debounce — evita consultas en cada tecla)
  useEffect(() => {
    if (padronLookupRef.current) clearTimeout(padronLookupRef.current);
    const doc = documento.trim();
    if (!doc || doc.startsWith('TMP-') || sinDocumento) return;
    const soloDigitos = /^\d+$/.test(doc.replace(/\s/g, ''));
    if (soloDigitos && doc.replace(/\D/g, '').length < 5) return;

    let active = true;
    padronLookupRef.current = setTimeout(() => {
      void (async () => {
        let data: PersonaBase | null = null;
        if (USE_MRV_API && !USE_SUPABASE_PADRON) {
          const { data: res } = await mrvApiFetch<{ data: Record<string, unknown> | null }>(
            `/api/padron/by-documento?doc=${encodeURIComponent(doc)}`
          );
          data = mapPadronApiPersona(res?.data ?? null);
        } else if (isSupabaseEnabled) {
          const { data: row, error } = await supabase
            .from('base_personas')
            .select('*')
            .eq('documento', doc)
            .maybeSingle();
          if (error || !row || !active) return;
          data = mapPadronApiPersona(row) ?? (row as PersonaBase);
        }
        if (!data || !active) return;

        setNombre(upperText(data.nombre || ''));
        setFechaNacimiento(resolveFechaNacimientoPersona(data));
        const sx = resolveSexoPersona(data);
        if (sx) setSexo(sx);
        setNombreMadre(data.nombre_madre || '');
        setDocumentoMadre(data.documento_madre || '');
        aplicarDatosDesdePersona(data);
        toast({ title: 'Persona encontrada', description: `Datos de ${data.nombre} completados automáticamente` });
      })();
    }, 420);

    return () => {
      active = false;
      if (padronLookupRef.current) clearTimeout(padronLookupRef.current);
    };
  }, [documento, sinDocumento, aplicarDatosDesdePersona, toast]);

  const coordsFromLink = useMemo(
    () => parseCoordsFromMapsLink(mapsResolvedLink || mapsLink),
    [mapsResolvedLink, mapsLink]
  );
  const latFinal = geo.lat ?? coordsFromLink?.lat ?? null;
  const lngFinal = geo.lng ?? coordsFromLink?.lng ?? null;
  const requiresManualLocation = geo.status === 'denied' || geo.status === 'error';
  const manualLocationOk = !requiresManualLocation || Boolean(coordsFromLink);
  
  const totalViviendas = contador.efectivas + contador.noEfectivas + contador.fallidas + contador.renuentes;
  
  // Visitas solo vivienda (N / F / R): no requiere datos del niño
  const isVisitaSinDatosNino =
    viviendaTipo === 'revisitada' ||
    viviendaTipo === 'renuente' ||
    viviendaTipo === 'sin_adulto_responsable';

  // Si es visita N/F/R, forzamos estado consistente y evitamos que el usuario quede bloqueado por campos ocultos.
  useEffect(() => {
    if (!isVisitaSinDatosNino) return;
    setEstadoVacuna('no_vacunado');
    setEsquemaCompleto(false);
    setLibreta(false);
    setDosisSpr(null);
    setFechaSpr('');
    setMotivo('');
  }, [isVisitaSinDatosNino]);

  const estadoVacunaValido = isVisitaSinDatosNino ? true : estadoVacuna !== null;
  const docValido = isVisitaSinDatosNino || (sinDocumento ? validarFormatoCodigoTemporal(documento) : documento.length >= 6);
  const terrenoCompleto =
    isVisitaSinDatosNino ||
    isMrvTerrenoCompleto({
      fuenteVerificacion,
      estadoVacuna,
      dosisMonitoreo,
      rechazoVacunacion,
      motivo,
      accionTomada,
    });

  const madreValida =
    documentoMadre.replace(/\D/g, '').length >= 6 && nombreMadre.trim().length >= 3;

  const canSubmit =
    regionNombre &&
    distritoNombre &&
    barrio.trim() &&
    totalViviendas > 0 &&
    estadoVacunaValido &&
    manualLocationOk &&
    (isVisitaSinDatosNino ||
      (nombre && docValido && fechaNacimiento && edad.valida && sexo && madreValida && terrenoCompleto));

  const maxReachableStep = useMemo(() => {
    if (!regionNombre || !barrio.trim()) return 1;
    if (isVisitaSinDatosNino) return 6;
    if (!nombre || !docValido || !fechaNacimiento || !sexo) return 1;
    if (!fuenteVerificacion) return 2;
    if (!estadoVacuna) return 3;
    if (estadoVacuna === 'vacunado' && !dosisMonitoreo) return 3;
    if (estadoVacuna === 'no_vacunado' && !rechazoVacunacion && !motivo.trim() && !accionTomada) return 4;
    if (totalViviendas < 1) return 6;
    return 7;
  }, [
    regionNombre, barrio, isVisitaSinDatosNino, nombre, docValido, fechaNacimiento, sexo,
    fuenteVerificacion, estadoVacuna, dosisMonitoreo, rechazoVacunacion, motivo, accionTomada, totalViviendas,
  ]);

  useEffect(() => {
    if (workflowStep > maxReachableStep) setWorkflowStep(maxReachableStep);
  }, [maxReachableStep, workflowStep]);

  /** Si el usuario estaba en el último paso desbloqueado y se abre uno nuevo, avanzar el foco automáticamente. */
  const prevMaxReachableRef = useRef(1);
  useEffect(() => {
    if (maxReachableStep > prevMaxReachableRef.current) {
      setWorkflowStep((s) => (s === prevMaxReachableRef.current ? maxReachableStep : s));
    }
    prevMaxReachableRef.current = maxReachableStep;
  }, [maxReachableStep]);

  const vacunacionSubStep =
    workflowStep === 2 ? 'validacion' as const :
    workflowStep === 3 ? 'evaluacion' as const :
    workflowStep === 4 ? 'justificacion' as const :
    workflowStep === 5 ? 'intervencion' as const : 'validacion' as const;

  const resetFormularioNino = useCallback(() => {
    setNombre('');
    setDocumento('');
    setSinDocumento(false);
    setFechaNacimiento('');
    setEdadAnosPadron(null);
    setEdadMesesPadron(null);
    setSexo('');
    setNombreMadre('');
    setDocumentoMadre('');
    setEstadoVacuna(null);
    setDosisMonitoreo(null);
    setDosisSpr(null);
    setFechaSpr('');
    setEsquemaCompleto(null);
    setMotivo('');
    setFuenteVerificacion('');
    setTieneCvs(null);
    setAccionTomada('');
    setLibreta(null);
    setRechazoVacunacion(false);
    setCambioResidencia(false);
    ubicacionPadronRef.current = null;
    setNinoEnEdicion(null);
  }, []);

  const cancelarEdicionNinoCasa = useCallback(() => {
    resetFormularioNino();
  }, [resetFormularioNino]);

  const iniciarEdicionNinoCasa = useCallback(
    (n: NinoCasa) => {
      ubicacionPadronRef.current = ubicacionSanitariaActual();
      aplicarNinoCasaAlFormulario(n, {
        setNombre,
        setDocumento,
        setSinDocumento,
        setFechaNacimiento,
        setSexo,
        setEstadoVacuna,
        setDosisMonitoreo,
        setRechazoVacunacion,
        setMotivo,
        setAccionTomada,
        setFuenteVerificacion,
        setLibreta,
        setEsquemaCompleto,
        setCambioResidencia,
        setWorkflowStep,
      });
      setNinoEnEdicion(n);
    },
    [ubicacionSanitariaActual]
  );

  const docValidoMonitoreo =
    sinDocumento ? validarFormatoCodigoTemporal(documento) : documento.length >= 6;

  const motivoMonitoreoOk =
    estadoVacuna !== 'no_vacunado' || rechazoVacunacion || Boolean(motivo.trim());

  const accionMonitoreoOk =
    estadoVacuna !== 'no_vacunado' || rechazoVacunacion || Boolean(accionTomada);

  const dosisMonitoreoOk =
    estadoVacuna === 'vacunado' ? Boolean(dosisMonitoreo) : true;

  const ubicacionCompletaMonitoreo = Boolean(
    regionNombre && distritoNombre && barrio.trim() && manualLocationOk
  );

  const verificacionMonitoreoOk = fuenteVerificacion !== '';

  const canGuardarNinoMonitoreo = Boolean(
    regionNombre &&
      distritoNombre &&
      barrio.trim() &&
      manualLocationOk &&
      nombre &&
      docValidoMonitoreo &&
      fechaNacimiento &&
      sexo &&
      edad.valida &&
      madreValida &&
      verificacionMonitoreoOk &&
      estadoVacuna &&
      dosisMonitoreoOk &&
      motivoMonitoreoOk &&
      accionMonitoreoOk
  );

  const construirNinoCasa = useCallback((): NinoCasa | null => {
    if (!canGuardarNinoMonitoreo || !estadoVacuna) {
      toast({
        title: 'Datos incompletos',
        description: 'Completá identificación, ubicación de la visita, fuente de verificación y vacunación.',
        variant: 'destructive',
      });
      return null;
    }
    return {
      id: ninoEnEdicion?.id ?? crypto.randomUUID(),
      registroId: ninoEnEdicion?.registroId ?? null,
      nombre: nombre.trim(),
      tipo_documento: sinDocumento ? 'DEX' : 'CI',
      documento: documento.trim(),
      fecha_nacimiento: fechaNacimiento,
      sexo,
      edadTexto: edad.texto || null,
      dosisSpr: estadoVacuna === 'vacunado' && dosisMonitoreo ? dosisMonitoreo : '1',
      vacunado: estadoVacuna === 'vacunado',
      motivo: estadoVacuna === 'no_vacunado'
        ? rechazoVacunacion
          ? 'Rechazo a la vacunación'
          : motivo.trim() || null
        : null,
      rechazoVacunacion: estadoVacuna === 'no_vacunado' && rechazoVacunacion,
      accionTomada: estadoVacuna === 'no_vacunado' && !rechazoVacunacion ? accionTomada || null : null,
      cambioResidencia: cambioResidencia || undefined,
      libreta: fuenteVerificacion === 'libreta',
      fuenteVerificacion: fuenteVerificacion || undefined,
      esquemaCompleto: estadoVacuna === 'vacunado' ? (esquemaCompleto ?? false) : false,
      tieneCvs: estadoVacuna === 'vacunado',
    };
  }, [
    canGuardarNinoMonitoreo,
    estadoVacuna,
    dosisMonitoreo,
    esquemaCompleto,
    nombre,
    documento,
    sinDocumento,
    fechaNacimiento,
    sexo,
    edad.texto,
    motivo,
    rechazoVacunacion,
    accionTomada,
    cambioResidencia,
    fuenteVerificacion,
    ninoEnEdicion,
    toast,
  ]);

  const handleSubmit = async () => {
    if (!canSubmit || saving || !user) return;
    setSaving(true);

    const visitaNfr =
      viviendaTipo === 'revisitada' || viviendaTipo === 'renuente' || viviendaTipo === 'sin_adulto_responsable';
    const visitaMotivo =
      viviendaTipo === 'revisitada'
        ? 'Visita N: casa cerrada o sin niños elegibles'
        : viviendaTipo === 'sin_adulto_responsable'
          ? 'Visita F: niños elegibles sin adulto responsable'
          : 'Visita R: adulto renuente a informar';
    const visitaNombre =
      viviendaTipo === 'revisitada'
        ? 'Visita N — sin niño elegible / casa cerrada'
        : viviendaTipo === 'sin_adulto_responsable'
          ? 'Visita F — sin adulto responsable'
          : 'Visita R — renuente';
    const visitaDoc =
      viviendaTipo === 'revisitada' ? 'VISITA-N' : viviendaTipo === 'sin_adulto_responsable' ? 'VISITA-F' : 'VISITA-R';
    
    // VALIDACIÓN CRÍTICA: Respetar la selección del usuario
    // El estado_vacuna es la fuente de verdad cuando está seleccionado
    // esquema_completo solo se usa si NO hay estado explícito
    let estadoVacunaFinal: 'vacunado' | 'no_vacunado';
    
    if (visitaNfr) {
      estadoVacunaFinal = 'no_vacunado';
    } else if (estadoVacuna) {
      // PRIMERO: Respetar la selección explícita del usuario (NUNCA sobrescribir)
      estadoVacunaFinal = estadoVacuna;
      console.log('Estado explícito del usuario: ', estadoVacunaFinal);
    } else if (esquemaCompleto === true) {
      // Si no hay selección explícita pero esquema completo, es vacunado
      estadoVacunaFinal = 'vacunado';
      console.log('Inferido desde esquema completo: VACUNADO');
    } else if (esquemaCompleto === false) {
      // Si no hay selección explícita y esquema incompleto, es no_vacunado
      estadoVacunaFinal = 'no_vacunado';
      console.log('Inferido desde esquema incompleto: NO VACUNADO');
    } else {
      // NUNCA debería llegar aquí si la validación de formulario está correcta
      // Pero como fallback seguro: no_vacunado
      console.warn('FALLBACK: esquemaCompleto es null, asignando no_vacunado por defecto');
      estadoVacunaFinal = 'no_vacunado';
    }
    
    const tipoViviendaFinal: typeof viviendaTipo = visitaNfr
      ? viviendaTipo
      : rechazoVacunacion
        ? 'efectiva'
        : viviendaTipo;
    const deltaJornada = deltaContadorPorTipo(tipoViviendaFinal);

    const registroData = {
      user_id: user.id,
      region: regionNombre,
      distrito: distritoNombre,
      servicio: servicioNombre || null,
      barrio: barrio.trim(),
      responsable: responsable || null,
      nombre: nombre || (visitaNfr ? visitaNombre : ''),
      documento: documento || (visitaNfr ? visitaDoc : ''),
      fecha_nacimiento: fechaNacimiento || (visitaNfr ? '2020-01-01' : ''),
      edad: visitaNfr ? null : edad.texto || null,
      sexo: sexo || (visitaNfr ? 'M' : ''),
      libreta: visitaNfr ? false : fuenteVerificacion === 'libreta',
      estado_vacuna: estadoVacunaFinal,
      motivo: visitaNfr ? visitaMotivo : (rechazoVacunacion ? 'Rechazo a la vacunación' : motivo.trim() || motivoCompuesto || null),
      latitud: latFinal,
      longitud: lngFinal,
      tipo_vivienda: tipoViviendaFinal,
      esquema_completo: visitaNfr
        ? false
        : estadoVacuna === 'vacunado'
          ? (esquemaCompleto ?? esquemaFromDosisMonitoreo(dosisMonitoreo, edadTotalMeses) ?? false)
          : false,
      fuente_verificacion: visitaNfr ? null : fuenteVerificacion || null,
      accion_tomada: visitaNfr ? null : accionTomada || null,
      observaciones: [
        cambioResidencia ? '[Cambio de residencia]' : '',
        observaciones.trim(),
      ]
        .filter(Boolean)
        .join(' · ') || null,
      fecha_dosis_spr: fechaSpr || null,
      dosis_spr: dosisSpr,
      estado_intervencion: rechazoVacunacion ? 'rechazo_vacunacion' : null,
      tiene_cvs: visitaNfr ? null : estadoVacuna === 'vacunado',
    };

    // VALIDACIÓN CRÍTICA: Asegurar que estado_vacuna no sea null
    if (registroData.estado_vacuna === null) {
      console.error('CRÍTICO: estado_vacuna es null. No debería permitir guardar.', {
        estadoVacuna,
        esquemaCompleto,
        visitaNfr,
        canSubmit
      });
      setSaving(false);
      toast({
        title: 'Error crítico',
        description: 'Estado de vacunación no válido. Por favor, selecciona Vacunado o No Vacunado.',
        variant: 'destructive'
      });
      return;
    }

    console.log('Guardando registro:', {
      nombre: registroData.nombre,
      estado_vacuna: registroData.estado_vacuna,
      esquema_completo: registroData.esquema_completo,
      motivo: registroData.motivo,
      tipo_vivienda: registroData.tipo_vivienda,
      input_estadoVacuna: estadoVacuna,
      input_esquemaCompleto: esquemaCompleto,
      visitaNfr
    });

    const payloadRecord = registroData as Record<string, unknown>;
    let guardadoOk = false;

    if (isOnline) {
      const { ok, error: saveError } = await dataService.guardarRegistro(registroData);
      setSaving(false);
      if (ok) {
        guardadoOk = true;
        console.log('Registro guardado exitosamente con estado:', registroData.estado_vacuna);
        toast({
          title: 'Registro guardado',
          description: [
            visitaNfr
              ? 'Visita de vivienda registrada'
              : `${nombre} - ${estadoVacunaFinal === 'vacunado' ? 'Vacunado' : 'No vacunado'}`,
            useRegistrosApi() ? 'Guardado en servidor (Aiven)' : null,
          ]
            .filter(Boolean)
            .join(' · '),
        });
        triggerRefresh();
      } else {
        const sinRed =
          !saveError || /fetch|network|conexión|ECONNREFUSED|ETIMEDOUT|Failed to fetch/i.test(saveError);
        if (sinRed) {
          try {
            await offlineCache.savePending(payloadRecord);
            void offlineCache.getPendingCount().then(setPendingCount);
            guardadoOk = true;
            toast({
              title: 'Guardado en el teléfono',
              description: 'Sin conexión con la API. El registro quedó en cola para sincronizar.',
            });
          } catch (e) {
            console.error(e);
            toast({
              title: 'No se pudo guardar',
              description: e instanceof Error ? e.message : 'Error desconocido',
              variant: 'destructive',
            });
            return;
          }
        } else {
          toast({
            title: 'No se pudo guardar',
            description: saveError || 'El servidor rechazó el registro. Revisá los datos o volvé a iniciar sesión.',
            variant: 'destructive',
          });
          return;
        }
      }
    } else {
      try {
        await offlineCache.savePending(payloadRecord);
        void offlineCache.getPendingCount().then(setPendingCount);
        guardadoOk = true;
        toast({
          title: 'Guardado sin conexión',
          description: visitaNfr ? 'Visita en cola; se enviará al volver online' : `${nombre || 'Registro'} — pendiente de sincronizar`,
        });
      } catch (e) {
        console.error(e);
        toast({ title: 'No se pudo guardar offline', description: e instanceof Error ? e.message : 'Revise los datos', variant: 'destructive' });
        setSaving(false);
        return;
      } finally {
        setSaving(false);
      }
    }

    if (!guardadoOk) return;

    if (user) {
      acumularJornada(user.id, deltaJornada, 1);
    }

    setNombre(''); setDocumento(''); setSinDocumento(false); setFechaNacimiento(''); setSexo('');
    setEdadAnosPadron(null); setEdadMesesPadron(null);
    setNombreMadre(''); setDocumentoMadre('');
    setLibreta(null); setEstadoVacuna(null); setDosisSpr(null); setFechaSpr('');
    setEsquemaCompleto(null); setMotivo('');
    setFuenteVerificacion(''); setTieneCvs(null); setAccionTomada('');
    setObservaciones('');
    setCambioResidencia(false);
    ubicacionPadronRef.current = null;
    setRechazoVacunacion(false);
    setWorkflowStep(1);
    const keyMap = {
      efectiva: 'efectivas',
      revisitada: 'noEfectivas',
      sin_adulto_responsable: 'fallidas',
      renuente: 'renuentes',
    } as const;
    const k = keyMap[tipoViviendaFinal];
    setContador((prev) => ({
      ...prev,
      [k]: Math.max(0, prev[k] - 1),
    }));
    setViviendaTipo('efectiva');
    setMapsLink(''); setMapsResolvedLink(''); setMapsResolving(false);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 min-h-dvh w-full max-w-[100vw] bg-background overflow-x-hidden">
      <CampaignAppHeader
        user={user}
        isOnline={isOnline}
        pendingCount={pendingCount}
        onLogout={logout}
        asignacion={
          perfilAsignacion
            ? {
                region: perfilAsignacion.region,
                distrito: perfilAsignacion.distrito,
                servicio: perfilAsignacion.servicio,
              }
            : undefined
        }
        pwaInstall={canInstall ? { canInstall: true, onInstall: install } : undefined}
      />
      <PadronOfflineBanner isOnline={isOnline} />

      {user && (
        <ProfileScopeEditor
          userId={user.id}
          scopeLocked={scopeLocked}
          initial={{
            region: perfilAsignacion?.region ?? '',
            distrito: perfilAsignacion?.distrito ?? '',
            servicio: perfilAsignacion?.servicio ?? '',
          }}
          onSaved={(next) => {
            setPerfilAsignacion(next);
            const region = regiones.find((r) => normalizeText(r.nombre) === normalizeText(next.region));
            if (region) {
              setRegionId(region.id);
              const distrito = distritos.find(
                (d) => d.region_id === region.id && normalizeText(d.nombre) === normalizeText(next.distrito)
              );
              if (distrito) {
                setDistritoId(distrito.id);
                const servicio = matchServicioFlexible(next.servicio, distrito.id);
                if (servicio) {
                  setServicioId(servicio.id);
                  setServicioManual('');
                } else {
                  setServicioId(null);
                  setServicioManual(next.servicio || '');
                }
              }
            }
          }}
        />
      )}

      <main className="flex-1 min-h-0 w-full max-w-6xl mx-auto pb-app box-border">
        {tab === 'registro' && user && (
          <div className="p-2.5 sm:p-4 lg:p-6 pb-28 w-full max-w-6xl mx-auto box-border">
            <RoundMonitoringFlow
                userId={user.id}
                entrevistadorNombre={user.nombre || responsable}
                resumeRoundId={resumeRoundId}
                onRoundsChanged={() => setRoundsDockKey((k) => k + 1)}
                onActiveRoundChange={setActiveRoundId}
                isOnline={isOnline}
                isAdmin={isAdmin || isSuperAdmin}
                barrio={barrio}
                setBarrio={setBarrio}
                barriosDisponibles={barriosDisponiblesRonda}
                mapsLink={mapsLink}
                ubicacionCompleta={ubicacionCompletaMonitoreo}
                location={{
                  regionNombre,
                  distritoNombre,
                  servicioNombre,
                  barrio,
                  responsable: responsable || null,
                }}
                canGuardarNino={canGuardarNinoMonitoreo}
                onGuardarNinoEnCasa={() => {
                  const n = construirNinoCasa();
                  if (n) resetFormularioNino();
                  return n;
                }}
                onPrepareEditNino={iniciarEdicionNinoCasa}
                onCancelEditNino={cancelarEdicionNinoCasa}
                editingNinoId={ninoEnEdicion?.id ?? null}
                onPendingSync={() => void offlineCache.getPendingCount().then(setPendingCount)}
                renderUbicacion={() => (
                  <HeaderSection
                    geo={geo}
                    mapsLink={mapsLink}
                    setMapsLink={setMapsLink}
                    coordsFromLink={coordsFromLink}
                    mapsResolving={mapsResolving}
                    regionId={regionId}
                    setRegionId={setRegionId}
                    distritoId={distritoId}
                    setDistritoId={setDistritoId}
                    servicioId={servicioId}
                    setServicioId={setServicioId}
                    servicioManual={servicioManual}
                    setServicioManual={setServicioManual}
                    barrio={barrio}
                    setBarrio={setBarrio}
                    responsable={responsable}
                    setResponsable={setResponsable}
                    distritoNombre={distritoNombre}
                    regionNombre={regionNombre}
                    servicioNombre={servicioNombre}
                    ubicacionAsignacionFija={false}
                    modoMonitoreoRonda
                    cambioResidencia={cambioResidencia}
                    setCambioResidencia={setCambioResidencia}
                    onUbicacionSanitariaEdited={revisarCambioResidencia}
                  />
                )}
                renderRegistroNino={() => (
                  <ChildDataSection
                    visitaSinDatosNino={false}
                    nombre={nombre}
                    setNombre={setNombre}
                    documento={documento}
                    setDocumento={setDocumento}
                    fechaNacimiento={fechaNacimiento}
                    setFechaNacimiento={setFechaNacimiento}
                    sexo={sexo}
                    setSexo={setSexo}
                    edadTexto={edad.texto}
                    edadValida={edad.valida}
                    sinDocumento={sinDocumento}
                    setSinDocumento={setSinDocumento}
                    generarDocumentoTemporal={generarDocumentoTemporal}
                    onPersonaSeleccionada={aplicarDatosDesdePersona}
                    nombreMadre={nombreMadre}
                    documentoMadre={documentoMadre}
                    setNombreMadre={setNombreMadre}
                    setDocumentoMadre={setDocumentoMadre}
                    regionSanitaria={regionNombre}
                    distrito={distritoNombre}
                    servicioSalud={servicioNombre}
                  />
                )}
                renderVerificacion={() => (
                  <VerificacionSection
                    fuenteVerificacion={fuenteVerificacion}
                    setFuenteVerificacion={setFuenteVerificacion}
                  />
                )}
                renderVacunacion={() => (
                  <VaccinationSectionMonitoreo
                    estadoVacuna={estadoVacuna}
                    setEstadoVacuna={setEstadoVacuna}
                    dosisMonitoreo={dosisMonitoreo}
                    setDosisMonitoreo={setDosisMonitoreo}
                    edadTotalMeses={edadTotalMeses}
                    motivo={motivo}
                    setMotivo={setMotivo}
                    rechazoVacunacion={rechazoVacunacion}
                    setRechazoVacunacion={setRechazoVacunacion}
                    accionTomada={accionTomada}
                    setAccionTomada={setAccionTomada}
                  />
                )}
              />
          </div>
        )}

        {tab === 'dashboard' && (
          <Suspense fallback={<PageSkeleton rows={5} />}>
            <DashboardView />
          </Suspense>
        )}
        {tab === 'mapa' && (
          <Suspense fallback={<div className="p-3"><MapSkeleton /></div>}>
            <MapView />
          </Suspense>
        )}
        {tab === 'admin' && isAdmin && (
          <Suspense fallback={<PageSkeleton rows={6} />}>
            <AdminPanel isSuperAdmin={isSuperAdmin} isAdmin={isAdmin} />
          </Suspense>
        )}
      </main>

      {tab === 'registro' && user && (
        <RecentRoundsDock
          userId={user.id}
          activeRoundId={activeRoundId}
          refreshKey={roundsDockKey}
          onResume={(r: RoundMonitoring) => {
            setResumeRoundId(r.id);
            setTab('registro');
            setBarrio(r.moduloLabel);
          }}
        />
      )}

      <BottomNav active={tab} onChange={setTab} showAdmin={isAdmin} />
    </div>
  );
}