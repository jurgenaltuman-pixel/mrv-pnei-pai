import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useOrgStructure } from '@/hooks/useOrgStructure';
import { useDataRefresh } from '@/contexts/DataRefreshContext';
import { offlineCache } from '@/services/offlineCache';
import HeaderSection from '@/components/mrv/HeaderSection';
import ChildDataSection from '@/components/mrv/ChildDataSection';
import VaccinationSection from '@/components/mrv/VaccinationSection';
import HousingCounter from '@/components/mrv/HousingCounter';
import JornadaSummary from '@/components/mrv/JornadaSummary';
import WorkflowSteps from '@/components/mrv/WorkflowSteps';
import BottomNav from '@/components/mrv/BottomNav';
import { generarCodigoTemporalRve, validarFormatoCodigoTemporal } from '@/lib/temp-code-rve';
import { isFechaEnCampanaCvs } from '@/lib/mrv-constants';
import { isMrvCvsTerrenoCompleto } from '@/lib/mrv-cvs-flow';
import type { FuenteVerificacion, AccionTomada } from '@/lib/mrv-constants';
import { acumularJornada, getJornadaStats, type JornadaStats } from '@/lib/jornada-storage';
import { MrvAppLogo } from '@/components/branding/MrvAppLogo';
import { PageSkeleton, MapSkeleton } from '@/components/mrv/PageSkeleton';

const DashboardView = lazy(() => import('@/components/mrv/DashboardView'));
const MapView = lazy(() => import('@/components/mrv/MapView'));
const AdminPanel = lazy(() => import('@/components/mrv/AdminPanel'));
import type { ContadorViviendas } from '@/types/mrv';
import { dataService, type PersonaBase } from '@/services/dataService';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useToast } from '@/hooks/use-toast';
import { Save, Loader2, LogOut, WifiOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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
  const { user, logout } = useAuth();
  const { isAdmin, isSuperAdmin } = useRole();
  const isOnline = useOnlineStatus();
  const { triggerRefresh } = useDataRefresh();
  const geo = useGeolocation();
  const { toast } = useToast();
  const { regiones, distritos, servicios, getBarriosByDistrito } = useOrgStructure();
  const [tab, setTab] = useState('registro');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    void offlineCache.getPendingCount().then(setPendingCount);
  }, []);

  const [regionId, setRegionId] = useState<number | null>(null);
  const [distritoId, setDistritoId] = useState<number | null>(null);
  const [servicioId, setServicioId] = useState<number | null>(null);
  const [servicioManual, setServicioManual] = useState('');
  const [barrio, setBarrio] = useState('');
  const [responsable, setResponsable] = useState(user?.nombre || '');
  const [mapsLink, setMapsLink] = useState('');
  const [mapsResolvedLink, setMapsResolvedLink] = useState('');
  const [mapsResolving, setMapsResolving] = useState(false);
  const [scopeLocked, setScopeLocked] = useState(false);

  const [nombre, setNombre] = useState('');
  const [documento, setDocumento] = useState('');
  const [sinDocumento, setSinDocumento] = useState(false);
  const [fechaNacimiento, setFechaNacimiento] = useState('');
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
  const [rechazoVacunacion, setRechazoVacunacion] = useState(false);
  const [workflowStep, setWorkflowStep] = useState(1);
  const [jornadaStats, setJornadaStats] = useState<JornadaStats>({
    efectivas: 0, noEfectivas: 0, fallidas: 0, renuentes: 0, registrosGuardados: 0, ultimaActualizacion: 0,
  });

  const [contador, setContador] = useState<ContadorViviendas>({ efectivas: 0, noEfectivas: 0, fallidas: 0, renuentes: 0 });
  // Por defecto, tipo de casa 'efectiva'
  const [viviendaTipo, setViviendaTipo] = useState<'efectiva' | 'revisitada' | 'sin_adulto_responsable' | 'renuente'>('efectiva');
  const [saving, setSaving] = useState(false);

  const edad = useMemo(() => calcularEdad(fechaNacimiento), [fechaNacimiento]);

  const regionNombre = regiones.find(r => r.id === regionId)?.nombre || '';
  const distritoNombre = distritos.find(d => d.id === distritoId)?.nombre || '';
  const servicioNombre = servicios.find(s => s.id === servicioId)?.nombre || servicioManual.trim();

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
    if (!user) return;
    let active = true;
    async function loadScope() {
      const { data, error } = await supabase
        .from('profiles')
        .select('assigned_region, assigned_distrito, assigned_servicio, assigned_barrio, scope_locked')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error || !data || !active) return;

      const locked = Boolean((data as any).scope_locked);
      setScopeLocked(locked);

      const assignedRegion = (data as any).assigned_region as string | null;
      const assignedDistrito = (data as any).assigned_distrito as string | null;
      const assignedServicio = (data as any).assigned_servicio as string | null;
      const assignedBarrio = (data as any).assigned_barrio as string | null;

      const region = regiones.find((r) => normalizeText(r.nombre) === normalizeText(assignedRegion));
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
          if (assignedBarrio) {
            setBarrio((barrioCanonico?.nombre || assignedBarrio).trim());
          }
        }
      }
      if (assignedBarrio && !region) setBarrio(assignedBarrio.trim());
    }
    void loadScope();

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
  }, [user?.id, regiones.length, distritos.length, servicios.length]);

  const aplicarUbicacionDesdePersona = (persona: PersonaBase) => {
    setNombreMadre(persona.nombre_madre || '');
    setDocumentoMadre(persona.documento_madre || '');
    const region = regiones.find((r) => normalizeText(r.nombre) === normalizeText(persona.region_sanitaria));
    const distritoByText = region
      ? distritos.find((d) => d.region_id === region.id && normalizeText(d.nombre) === normalizeText(persona.distrito))
      : undefined;

    const servicioByText = distritoByText ? matchServicioFlexible(persona.servicio_salud, distritoByText.id) : undefined;

    const servicioByGlobal = !servicioByText && persona.servicio_salud
      ? matchServicioFlexible(persona.servicio_salud)
      : undefined;

    if (region) setRegionId(region.id);
    if (distritoByText) setDistritoId(distritoByText.id);

    if (servicioByText) {
      setServicioId(servicioByText.id);
      setServicioManual('');
      return;
    }

    if (distritoByText) {
      const serviciosDelDistrito = servicios.filter((s) => s.distrito_id === distritoByText.id);
      if (!persona.servicio_salud && serviciosDelDistrito.length === 1) {
        setServicioId(serviciosDelDistrito[0].id);
        setServicioManual('');
        return;
      }
    }

    // Fallback robusto: si región/distrito vienen mal en la base_personas,
    // inferimos ambos desde el servicio de salud importado.
    if (servicioByGlobal) {
      const distritoInferred = distritos.find((d) => d.id === servicioByGlobal.distrito_id);
      if (distritoInferred) {
        setDistritoId(distritoInferred.id);
        const regionInferred = regiones.find((r) => r.id === distritoInferred.region_id);
        if (regionInferred) setRegionId(regionInferred.id);
      }
      setServicioId(servicioByGlobal.id);
      setServicioManual('');
      return;
    }

    setServicioId(null);
    setServicioManual(persona.servicio_salud || '');
  };

  const generarDocumentoTemporal = () => {
    const reg = regiones.find((r) => r.id === regionId);
    const dis = distritos.find((d) => d.id === distritoId);
    setDocumento(generarCodigoTemporalRve(reg?.codigo ?? undefined, dis?.nombre));
  };

  useEffect(() => {
    if (user) setJornadaStats(getJornadaStats(user.id));
  }, [user?.id]);

  useEffect(() => {
    if (sinDocumento && !documento.startsWith('TMP-')) {
      generarDocumentoTemporal();
    }
    if (!sinDocumento && documento.startsWith('TMP-')) {
      setDocumento('');
    }
  }, [sinDocumento]);

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

  // Buscar persona por CI cuando se ingresa documento
  useEffect(() => {
    let active = true;
    async function buscarPersona() {
      if (!documento.trim() || documento.startsWith('TMP-') || sinDocumento) {
        return;
      }
      const { data, error } = await supabase
        .from('base_personas')
        .select('*')
        .eq('documento', documento.trim())
        .maybeSingle();
      if (error || !data || !active) return;

      // Auto-completar campos si se encuentra la persona
      setNombre(data.nombre || '');
      setFechaNacimiento(data.fecha_nacimiento || '');
      setSexo(data.sexo || '');
      setNombreMadre(data.nombre_madre || '');
      setDocumentoMadre(data.documento_madre || '');
      aplicarUbicacionDesdePersona(data);
      toast({ title: 'Persona encontrada', description: `Datos de ${data.nombre} completados automáticamente` });
    }
    void buscarPersona();
    return () => { active = false; };
  }, [documento, sinDocumento]);

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
  const cvsCompleto =
    isVisitaSinDatosNino ||
    isMrvCvsTerrenoCompleto({
      fuenteVerificacion,
      libreta,
      tieneCvs,
      rechazoVacunacion,
      motivo,
      accionTomada,
      dosisSpr,
      fechaSpr,
    });

  const canSubmit =
    regionNombre &&
    distritoNombre &&
    barrio.trim() &&
    totalViviendas > 0 &&
    estadoVacunaValido &&
    manualLocationOk &&
    (isVisitaSinDatosNino || (nombre && docValido && fechaNacimiento && edad.valida && sexo && cvsCompleto));

  const maxReachableStep = useMemo(() => {
    if (!regionNombre || !barrio.trim()) return 1;
    if (isVisitaSinDatosNino) return 6;
    if (!nombre || !docValido || !fechaNacimiento || !sexo) return 1;
    if (!fuenteVerificacion || libreta === null) return 2;
    if (tieneCvs === null) return 3;
    if (tieneCvs === true && (!dosisSpr || !fechaSpr.trim())) return 3;
    if (tieneCvs === false && !rechazoVacunacion && !motivo.trim()) return 4;
    if (tieneCvs === false && !accionTomada) return 5;
    if (totalViviendas < 1) return 6;
    return 7;
  }, [
    regionNombre, barrio, isVisitaSinDatosNino, nombre, docValido, fechaNacimiento, sexo,
    fuenteVerificacion, libreta, tieneCvs, dosisSpr, fechaSpr, rechazoVacunacion, motivo, accionTomada, totalViviendas,
  ]);

  useEffect(() => {
    if (workflowStep > maxReachableStep) setWorkflowStep(maxReachableStep);
  }, [maxReachableStep, workflowStep]);

  const vacunacionSubStep =
    workflowStep === 2 ? 'validacion' as const :
    workflowStep === 3 ? 'evaluacion' as const :
    workflowStep === 4 ? 'justificacion' as const :
    workflowStep === 5 ? 'intervencion' as const : 'validacion' as const;

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
    
    const tipoViviendaFinal =
      rechazoVacunacion && !visitaNfr ? 'efectiva' as const : viviendaTipo;

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
      libreta: visitaNfr ? false : (libreta ?? false),
      estado_vacuna: estadoVacunaFinal,
      motivo: visitaNfr ? visitaMotivo : (rechazoVacunacion ? 'Rechazo a la vacunación' : motivo.trim() || motivoCompuesto || null),
      latitud: latFinal,
      longitud: lngFinal,
      tipo_vivienda: tipoViviendaFinal,
      esquema_completo: visitaNfr ? false : (esquemaCompleto ?? false),
      fuente_verificacion: visitaNfr ? null : fuenteVerificacion || null,
      accion_tomada: visitaNfr ? null : accionTomada || null,
      observaciones: observaciones.trim() || null,
      fecha_dosis_spr: fechaSpr || null,
      dosis_spr: dosisSpr,
      estado_intervencion: rechazoVacunacion ? 'rechazo_vacunacion' : null,
      tiene_cvs: visitaNfr ? null : tieneCvs,
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

    if (isOnline) {
      const ok = await dataService.guardarRegistro(registroData);
      setSaving(false);
      if (ok) {
        console.log('Registro guardado exitosamente con estado:', registroData.estado_vacuna);
        toast({
          title: 'Registro guardado',
          description: visitaNfr
            ? 'Visita de vivienda registrada'
            : `${nombre} - ${estadoVacunaFinal === 'vacunado' ? 'Vacunado' : 'No vacunado'}`,
        });
        triggerRefresh();
        if (user) {
          const next = acumularJornada(user.id, contador, 1);
          setJornadaStats(next);
        }
      } else {
        try {
          await offlineCache.savePending(payloadRecord);
          void offlineCache.getPendingCount().then(setPendingCount);
          toast({ title: 'Guardado localmente', description: 'No se pudo enviar al servidor; se sincronizará cuando haya conexión' });
          if (user) setJornadaStats(acumularJornada(user.id, contador, 1));
        } catch (e) {
          console.error(e);
          toast({ title: 'No se pudo guardar', description: e instanceof Error ? e.message : 'Error desconocido', variant: 'destructive' });
          return;
        }
      }
    } else {
      try {
        await offlineCache.savePending(payloadRecord);
        void offlineCache.getPendingCount().then(setPendingCount);
        toast({
          title: 'Guardado sin conexión',
          description: visitaNfr ? 'Visita en cola; se enviará al volver online' : `${nombre || 'Registro'} — pendiente de sincronizar`,
        });
        if (user) setJornadaStats(acumularJornada(user.id, contador, 1));
      } catch (e) {
        console.error(e);
        toast({ title: 'No se pudo guardar offline', description: e instanceof Error ? e.message : 'Revise los datos', variant: 'destructive' });
        setSaving(false);
        return;
      } finally {
        setSaving(false);
      }
    }

    setNombre(''); setDocumento(''); setSinDocumento(false); setFechaNacimiento(''); setSexo('');
    setNombreMadre(''); setDocumentoMadre('');
    setLibreta(null); setEstadoVacuna(null); setDosisSpr(null); setFechaSpr('');
    setEsquemaCompleto(null); setMotivo('');
    setFuenteVerificacion(''); setTieneCvs(null); setAccionTomada('');
    setObservaciones(''); setRechazoVacunacion(false); setWorkflowStep(1);
    setContador({ efectivas: 0, noEfectivas: 0, fallidas: 0, renuentes: 0 });
    setViviendaTipo('efectiva');
    setMapsLink(''); setMapsResolvedLink(''); setMapsResolving(false);
  };

  return (
    <div className="min-h-dvh bg-background pb-app">
      <header className="bg-primary text-primary-foreground px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3 sticky top-0 z-40 shadow-lg safe-area-top">
        <div className="h-10 w-10 rounded-xl bg-white/95 shadow-sm flex items-center justify-center flex-shrink-0">
          <MrvAppLogo className="h-8 w-8 shrink-0" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold tracking-tight truncate">MRV — CVS Sarampión 2026</div>
          <div className="text-xs opacity-80 truncate flex items-center gap-1.5">
            {user?.nombre}
            {!isOnline && <WifiOff className="w-3 h-3 text-yellow-300" />}
            {pendingCount > 0 && <span className="bg-yellow-400/20 text-yellow-200 px-1.5 py-0.5 rounded text-[10px] font-bold">{pendingCount} pend.</span>}
          </div>
        </div>
        {!isOnline && (
          <div className="flex items-center gap-1 text-[10px] bg-yellow-500/20 text-yellow-200 px-2 py-1 rounded-lg font-medium flex-shrink-0">
            <WifiOff className="w-3 h-3" /> Sin conexión
          </div>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-xs bg-white/15 backdrop-blur-sm px-2.5 sm:px-3 py-2 rounded-lg font-semibold active:scale-95 transition-transform hover:bg-white/25 flex-shrink-0"
          aria-label="Cerrar sesión"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </header>

      <div className="max-w-6xl mx-auto">
        {tab === 'registro' && (
          <div className="p-3 lg:p-6">
            {user && <JornadaSummary stats={jornadaStats} />}
            <WorkflowSteps currentStep={workflowStep} maxReachable={maxReachableStep} onStepClick={setWorkflowStep} />
            <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start">
              <div>
                <ChildDataSection visitaSinDatosNino={isVisitaSinDatosNino}
                  nombre={nombre} setNombre={setNombre} documento={documento} setDocumento={setDocumento}
                  fechaNacimiento={fechaNacimiento} setFechaNacimiento={setFechaNacimiento}
                  sexo={sexo} setSexo={setSexo} edadTexto={edad.texto} edadValida={edad.valida}
                  sinDocumento={sinDocumento} setSinDocumento={setSinDocumento}
                  generarDocumentoTemporal={generarDocumentoTemporal}
                  onPersonaSeleccionada={aplicarUbicacionDesdePersona}
                  nombreMadre={nombreMadre}
                  documentoMadre={documentoMadre}
                  setDocumentoMadre={setDocumentoMadre}
                  regionNombre={regionNombre}
                  distritoNombre={distritoNombre}
                  servicioNombre={servicioNombre}
                  barrio={barrio} />

                <HeaderSection
                  geo={geo}
                  mapsLink={mapsLink}
                  setMapsLink={setMapsLink}
                  coordsFromLink={coordsFromLink}
                  mapsResolving={mapsResolving}
                  scopeLocked={scopeLocked}
                  regionId={regionId} setRegionId={setRegionId}
                  distritoId={distritoId} setDistritoId={setDistritoId}
                  servicioId={servicioId} setServicioId={setServicioId}
                  servicioManual={servicioManual} setServicioManual={setServicioManual}
                  barrio={barrio} setBarrio={setBarrio}
                  responsable={responsable} setResponsable={setResponsable}
                  regionNombre={regionNombre} distritoNombre={distritoNombre} servicioNombre={servicioNombre}
                />
              </div>

              <div>
                <VaccinationSection visible stepNumber={3} stepLabel="Evaluación CVS" subStep="all"
                  fuenteVerificacion={fuenteVerificacion} setFuenteVerificacion={setFuenteVerificacion}
                  libreta={libreta} setLibreta={setLibreta}
                  tieneCvs={tieneCvs} setTieneCvs={setTieneCvs}
                  estadoVacuna={estadoVacuna} setEstadoVacuna={setEstadoVacuna}
                  dosisSpr={dosisSpr} setDosisSpr={setDosisSpr}
                  fechaSpr={fechaSpr} setFechaSpr={setFechaSpr} fechaSprValida={fechaSprValida}
                  motivo={motivo} setMotivo={setMotivo}
                  esquemaCompleto={esquemaCompleto} setEsquemaCompleto={setEsquemaCompleto}
                  accionTomada={accionTomada} setAccionTomada={setAccionTomada}
                  rechazoVacunacion={rechazoVacunacion} setRechazoVacunacion={setRechazoVacunacion}
                />

                <HousingCounter contador={contador} setContador={setContador}
                  viviendaTipo={viviendaTipo} setViviendaTipo={setViviendaTipo}
                  estadoVacuna={estadoVacuna} setEstadoVacuna={setEstadoVacuna}
                  esquemaCompleto={esquemaCompleto} setEsquemaCompleto={setEsquemaCompleto}
                  libreta={libreta} registroRVe={libreta} rechazoVacunacion={rechazoVacunacion} />

                <div className="section-card">
                  <label className="field-label">Observaciones (opcional)</label>
                  <textarea
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value.slice(0, 500))}
                    rows={3}
                    placeholder="Antes de guardar: situaciones atípicas, barreras, negativas..."
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm resize-none"
                  />
                </div>

                <button onClick={handleSubmit} disabled={!canSubmit || saving}
                  className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-bold text-base shadow-lg active:scale-[0.98] transition-all disabled:opacity-40 disabled:scale-100 mb-4 flex items-center justify-center gap-2 hover:brightness-110">
                  {saving ? <><Loader2 className="w-5 h-5 animate-spin" /> Guardando...</> : <><Save className="w-5 h-5" /> Finalizar y Guardar Registro</>}
                </button>
              </div>
            </div>
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
      </div>

      <BottomNav active={tab} onChange={setTab} showAdmin={isAdmin} />
    </div>
  );
}