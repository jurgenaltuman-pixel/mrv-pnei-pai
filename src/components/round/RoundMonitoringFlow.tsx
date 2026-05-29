import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useGeolocation } from '@/hooks/useGeolocation';
import { parseCoordsFromMapsLink } from '@/lib/maps-coords';
import {
  casaPermiteReedicionVisita,
  computeRoundSummary,
  countCasasEfectivas,
  getEstadoConfig,
  requiereNinos,
} from '@/lib/croquis-housing';
import { requiereGpsEnVisita, usaUbicacionEncuestadorAsignada } from '@/lib/monitoreo-vacunacion';
import {
  acumularJornada,
  registrarRondaCompletada,
  setRondaActivaNombre,
  type JornadaStats,
} from '@/lib/jornada-storage';
import {
  deltaContadorPorEstadoCasa,
  evaluateRoundMonitoring,
} from '@/lib/round-evaluation';
import { dismissRound, rondaIncompleta, undismissRound } from '@/lib/round-resume';
import { crearRondaVacia, roundMonitoringStorage } from '@/services/roundMonitoringStorage';
import { applySyncIdsToCasa, syncCasaActualizada, syncCasaGuardada } from '@/services/roundMonitoringSync';
import { ensureRoundCodigo } from '@/lib/round-codigo';
import * as adminApi from '@/services/adminApi';
import CasaGuardadaEditor from './CasaGuardadaEditor';
import { downloadRoundReportExcel, downloadRoundReportPdf } from '@/lib/export-round-report';
import { saveRoundHistoryToServer } from '@/services/roundHistoryApi';
import {
  deleteRoundDraftOnServer,
  syncRoundDraftToServer,
} from '@/services/roundDraftApi';
import {
  countActiveRounds,
  MAX_ACTIVE_ROUNDS_PER_USER,
} from '@/lib/round-active-limit';
import type { EquipoMiembro } from '@/components/round/RoundEquipoUsuarios';
import type { CasaEstadoCode, CasaMonitoreo, NinoCasa, RoundMonitoring } from '@/types/round-monitoring';
import RoundStartScreen from './RoundStartScreen';
import CroquisMap from './CroquisMap';
import ActiveHouseScreen from './ActiveHouseScreen';
import RoundSummaryScreen from './RoundSummaryScreen';
import RoundProgressPanel from './RoundProgressPanel';

interface LocationContext {
  regionNombre: string;
  distritoNombre: string;
  servicioNombre: string;
  barrio: string;
  responsable: string | null;
}

interface Props {
  userId: string;
  entrevistadorNombre?: string | null;
  resumeRoundId?: string | null;
  onRoundsChanged?: () => void;
  onActiveRoundChange?: (roundId: string | null) => void;
  isOnline: boolean;
  isAdmin?: boolean;
  location: LocationContext;
  barrio: string;
  setBarrio: (v: string) => void;
  barriosDisponibles: string[];
  mapsLink: string;
  ubicacionCompleta: boolean;
  renderUbicacion: () => ReactNode;
  renderRegistroNino: () => ReactNode;
  renderVerificacion: () => ReactNode;
  renderVacunacion: () => ReactNode;
  canGuardarNino: boolean;
  onGuardarNinoEnCasa: () => NinoCasa | null;
  onPrepareEditNino?: (n: NinoCasa) => void;
  onCancelEditNino?: () => void;
  editingNinoId?: string | null;
  onPendingSync?: () => void;
  onJornadaUpdate?: (stats: JornadaStats) => void;
}

function equipoToRoundFields(equipo: EquipoMiembro[]) {
  return {
    colaboradores: equipo.map((e) => e.display_name.trim()).filter(Boolean),
    colaboradorUserIds: equipo.map((e) => e.user_id).filter(Boolean),
  };
}

function normalizarRondaParaMetaEfectivas(r: RoundMonitoring): RoundMonitoring {
  const efectivas = countCasasEfectivas(r.casas);
  if (efectivas >= r.totalCasas) return r;

  const siguienteSinGuardar = r.casas.find((c) => !c.guardada);
  if (siguienteSinGuardar) {
    if (r.fase === 'summary' || r.completedAt != null) {
      return { ...r, fase: 'croquis', completedAt: null, casaActiva: siguienteSinGuardar.numero };
    }
    return r;
  }

  const nuevaCasaNumero = r.casas.length + 1;
  return {
    ...r,
    casas: [
      ...r.casas,
      {
        numero: nuevaCasaNumero,
        estado: null,
        ninos: [],
        guardada: false,
        latitud: null,
        longitud: null,
        guardadaAt: null,
      },
    ],
    fase: 'croquis',
    completedAt: null,
    casaActiva: nuevaCasaNumero,
  };
}

export default function RoundMonitoringFlow({
  userId,
  entrevistadorNombre = null,
  resumeRoundId = null,
  onRoundsChanged,
  onActiveRoundChange,
  isOnline,
  isAdmin = false,
  location,
  barrio,
  setBarrio,
  barriosDisponibles,
  mapsLink,
  ubicacionCompleta,
  renderUbicacion,
  renderRegistroNino,
  renderVerificacion,
  renderVacunacion,
  canGuardarNino,
  onGuardarNinoEnCasa,
  onPrepareEditNino,
  onCancelEditNino,
  editingNinoId = null,
  onPendingSync,
  onJornadaUpdate,
}: Props) {
  const { toast } = useToast();
  const geo = useGeolocation();
  const [round, setRound] = useState<RoundMonitoring | null>(null);
  const [savedRound, setSavedRound] = useState<RoundMonitoring | null>(null);
  const [recoverableRounds, setRecoverableRounds] = useState<RoundMonitoring[]>([]);
  const [loadingResume, setLoadingResume] = useState(true);
  const [estadoDraft, setEstadoDraft] = useState<CasaEstadoCode | null>(null);
  const [saving, setSaving] = useState(false);
  const [rondaRegistrada, setRondaRegistrada] = useState(false);
  const [equipoUsuarios, setEquipoUsuarios] = useState<EquipoMiembro[]>([]);
  const [activeDrafts, setActiveDrafts] = useState<RoundMonitoring[]>([]);
  const childReturnFaseRef = useRef<RoundMonitoring['fase'] | null>(null);

  const applyEquipoFromRound = useCallback((r: RoundMonitoring) => {
    const ids = r.colaboradorUserIds || [];
    const names = r.colaboradores || [];
    const members: EquipoMiembro[] = names.map((display_name, i) => ({
      user_id: ids[i] || `legacy-${i}-${display_name}`,
      display_name,
    }));
    setEquipoUsuarios(members);
  }, []);

  const refreshActiveDrafts = useCallback(async () => {
    const drafts = await roundMonitoringStorage.listActiveDraftsForUser(userId);
    setActiveDrafts(drafts);
    const primary = drafts[0] ?? null;
    setSavedRound(primary);
    setRecoverableRounds(drafts.filter((r) => r.id !== primary?.id));
  }, [userId]);

  useEffect(() => {
    onActiveRoundChange?.(round?.id ?? null);
  }, [round?.id, onActiveRoundChange]);

  useEffect(() => {
    if (!resumeRoundId) return;
    void (async () => {
      const rows = await roundMonitoringStorage.listByUser(userId, 30);
      const target = rows.find((r) => r.id === resumeRoundId);
      if (!target) return;
      undismissRound(userId, target.id);
      const r = normalizarRondaParaMetaEfectivas(target);
      setRound(r);
      setBarrio(r.moduloLabel);
      applyEquipoFromRound(r);
      setSavedRound(null);
      setEstadoDraft(null);
      void roundMonitoringStorage.save(r);
      onRoundsChanged?.();
      toast({ title: 'Ronda reanudada', description: `${r.moduloLabel} · ID ${r.codigo}` });
    })();
  }, [resumeRoundId, userId, setBarrio, onRoundsChanged, toast]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingResume(true);
      try {
        await roundMonitoringStorage.syncDraftsFromServer(userId);
        const drafts = await roundMonitoringStorage.listActiveDraftsForUser(userId);
        if (!cancelled) {
          setActiveDrafts(drafts);
          const primary = drafts[0] ?? null;
          setSavedRound(primary);
          setRecoverableRounds(drafts.filter((r) => r.id !== primary?.id));
        }
      } finally {
        if (!cancelled) setLoadingResume(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, toast]);

  const coordsFromLink = useMemo(() => parseCoordsFromMapsLink(mapsLink), [mapsLink]);
  const latFinal = geo.lat ?? coordsFromLink?.lat ?? null;
  const lngFinal = geo.lng ?? coordsFromLink?.lng ?? null;

  const ubicacionAsignadaOk = Boolean(
    location.regionNombre.trim() &&
      location.distritoNombre.trim() &&
      location.barrio.trim()
  );

  const ubicacionEncuestador = useMemo(
    () => ({
      region: location.regionNombre,
      distrito: location.distritoNombre,
      servicio: location.servicioNombre || null,
      barrio: location.barrio.trim(),
      responsable: location.responsable,
    }),
    [location]
  );

  const aplicarUbicacionARonda = useCallback(
    (r: RoundMonitoring): RoundMonitoring => ({
      ...r,
      region: location.regionNombre || r.region,
      distrito: location.distritoNombre || r.distrito,
      servicio: location.servicioNombre || null,
      barrio: location.barrio.trim() || r.barrio,
      responsable: location.responsable,
    }),
    [location]
  );

  const canStart = barrio.trim().length >= 2;
  const casaActual =
    round?.casas.find((c) => c.numero === round.casaActiva) ?? round?.casas.find((c) => !c.guardada);

  useEffect(() => {
    if (!round) return;
    const sig = round.casas.find((c) => !c.guardada);
    if (sig?.estado && !estadoDraft) setEstadoDraft(sig.estado);
  }, [round?.id, round?.casas, estadoDraft]);

  const alertaContradiccion = useMemo(() => {
    if (!casaActual || !estadoDraft) return null;
    const hayNoVac = casaActual.ninos.some((n) => !n.vacunado);
    if (hayNoVac && estadoDraft !== 'E') {
      return 'Hay un niño no vacunado: la casa debe ser Efectiva (E). Cambiá el estado.';
    }
    return null;
  }, [casaActual, estadoDraft]);

  const persist = useCallback(
    async (r: RoundMonitoring) => {
      const normalized = ensureRoundCodigo({
        ...r,
        userId,
        ...equipoToRoundFields(equipoUsuarios),
      });
      setRound(normalized);
      await roundMonitoringStorage.save(normalized);
      const syncErr = await syncRoundDraftToServer(normalized);
      if (syncErr) {
        console.warn('round draft sync:', syncErr);
      }
      onRoundsChanged?.();
      await refreshActiveDrafts();
    },
    [userId, equipoUsuarios, onRoundsChanged, refreshActiveDrafts]
  );

  const notifyJornada = useCallback(
    (stats: JornadaStats) => {
      onJornadaUpdate?.(stats);
    },
    [onJornadaUpdate]
  );

  const handleRecoverRound = (r: RoundMonitoring) => {
    undismissRound(userId, r.id);
    setSavedRound(r);
    setRecoverableRounds((prev) => prev.filter((x) => x.id !== r.id));
    setBarrio(r.moduloLabel);
    applyEquipoFromRound(r);
    toast({
      title: 'Ronda lista para continuar',
      description: r.moduloLabel,
    });
  };

  const handleContinueRound = () => {
    if (!savedRound) return;
    undismissRound(userId, savedRound.id);
    const r = normalizarRondaParaMetaEfectivas(savedRound);
    setRound(r);
    setBarrio(r.moduloLabel);
    applyEquipoFromRound(r);
    setEstadoDraft(null);
    setRondaRegistrada(r.fase === 'summary' && countCasasEfectivas(r.casas) >= r.totalCasas);
    setSavedRound(null);
    void roundMonitoringStorage.save(r);
    notifyJornada(setRondaActivaNombre(userId, r.moduloLabel));
    const eff = r.casas.filter((c) => c.guardada && c.estado === 'E').length;
    toast({
      title: 'Ronda reanudada',
      description:
        eff < r.totalCasas
          ? `${r.moduloLabel} · ${eff}/${r.totalCasas} efectivas (E) · continuá la ronda`
          : `${r.moduloLabel} · ${eff}/${r.totalCasas} efectivas (E)`,
    });
  };

  const handleDiscardSavedRound = async () => {
    if (!savedRound) return;
    const ok = window.confirm(
      `¿Descartar la ronda «${savedRound.moduloLabel}»? Los datos guardados en este dispositivo no se podrán retomar.`
    );
    if (!ok) return;
    dismissRound(userId, savedRound.id);
    void deleteRoundDraftOnServer(savedRound.id);
    setSavedRound(null);
    void refreshActiveDrafts();
    toast({ title: 'Ronda descartada' });
  };

  const handleStart = async () => {
    if (!canStart) {
      toast({
        title: 'Elegí el barrio',
        description: 'El barrio es el nombre de la ronda.',
        variant: 'destructive',
      });
      return;
    }
    const drafts = await roundMonitoringStorage.listActiveDraftsForUser(userId);
    if (countActiveRounds(drafts) >= MAX_ACTIVE_ROUNDS_PER_USER) {
      if (savedRound && savedRound.completedAt == null) {
        const ok = window.confirm(
          `Ya tenés ${MAX_ACTIVE_ROUNDS_PER_USER} rondas activas. ¿Descartar «${savedRound.moduloLabel}» para abrir una nueva?`
        );
        if (!ok) return;
        dismissRound(userId, savedRound.id);
        void deleteRoundDraftOnServer(savedRound.id);
      } else {
        toast({
          title: `Máximo ${MAX_ACTIVE_ROUNDS_PER_USER} rondas activas`,
          description: 'Concluí o descartá una ronda antes de iniciar otra.',
          variant: 'destructive',
        });
        return;
      }
    } else if (savedRound && savedRound.completedAt == null) {
      const ok = window.confirm(
        `Tenés la ronda «${savedRound.moduloLabel}» sin terminar. ¿Iniciar una nueva? La anterior quedará descartada.`
      );
      if (!ok) return;
      dismissRound(userId, savedRound.id);
      void deleteRoundDraftOnServer(savedRound.id);
      setSavedRound(null);
      setRecoverableRounds([]);
    }
    const nombre = barrio.trim();
    const eq = equipoToRoundFields(equipoUsuarios);
    const r = crearRondaVacia({
      userId,
      moduloLabel: nombre,
      region: location.regionNombre || 'Sin región',
      distrito: location.distritoNombre || 'Sin distrito',
      servicio: location.servicioNombre || null,
      barrio: nombre,
      responsable: location.responsable,
      entrevistador: entrevistadorNombre || location.responsable,
      colaboradores: eq.colaboradores,
      colaboradorUserIds: eq.colaboradorUserIds,
    });
    r.fase = 'croquis';
    setRondaRegistrada(false);
    await persist(r);
    notifyJornada(setRondaActivaNombre(userId, nombre));
    toast({ title: 'Ronda iniciada', description: `${r.totalCasas} casas · ${nombre}` });
  };

  const goToCasa = async (numero: number, opts?: { reedit?: boolean }) => {
    if (!round) return;
    const casa = round.casas.find((c) => c.numero === numero);
    if (!casa) return;
    if (casa.guardada && !opts?.reedit) {
      toast({ title: 'Casa ya guardada', description: `Usá «Retroceder» en la lista de visitas para editar.` });
      return;
    }
    if (!opts?.reedit) {
      const siguiente = round.casas.find((c) => !c.guardada);
      if (siguiente && siguiente.numero !== numero) {
        toast({ title: 'Una casa a la vez', description: `Completá primero la casa ${siguiente.numero}` });
        return;
      }
    }
    setEstadoDraft(casa.estado ?? null);
    const next = { ...round, casaActiva: numero, fase: 'house' as const };
    await persist(next);
  };

  const handleEstadoChange = async (code: CasaEstadoCode) => {
    setEstadoDraft(code);
    if (!round || !casaActual) return;
    const casas = round.casas.map((c) => (c.numero === casaActual.numero ? { ...c, estado: code } : c));
    await persist({ ...round, casas, fase: 'house' });
  };

  const handleQuitarEstado = async () => {
    setEstadoDraft(null);
    if (!round || !casaActual) return;
    const casas = round.casas.map((c) => (c.numero === casaActual.numero ? { ...c, estado: null } : c));
    await persist({ ...round, casas, fase: 'house' });
  };

  const handleGuardarNino = async () => {
    if (!round || !casaActual) return;
    const nino = onGuardarNinoEnCasa();
    if (!nino) return;
    const yaExistia = casaActual.ninos.some((x) => x.id === nino.id);
    const casas = round.casas.map((c) => {
      if (c.numero !== casaActual.numero) return c;
      const ninos = yaExistia
        ? c.ninos.map((x) => (x.id === nino.id ? nino : x))
        : [...c.ninos, nino];
      return { ...c, ninos };
    });
    if (!nino.vacunado && estadoDraft && estadoDraft !== 'E') {
      setEstadoDraft('E');
      toast({ title: 'Casa Efectiva (E)', description: 'Niño no vacunado registrado' });
    }
    const returnFase = childReturnFaseRef.current ?? 'house';
    childReturnFaseRef.current = null;
    await persist({ ...aplicarUbicacionARonda(round), casas, fase: returnFase });
    toast({
      title: yaExistia ? 'Cambios guardados' : 'Niño/a agregado',
      description: nino.nombre,
    });
  };

  const abrirFormularioNino = async (
    n: NinoCasa,
    casaNumero: number,
    returnFase: RoundMonitoring['fase']
  ) => {
    if (!round) return;
    childReturnFaseRef.current = returnFase;
    onPrepareEditNino?.(n);
    await persist({ ...round, fase: 'add-child', casaActiva: casaNumero });
  };

  const handleEditNino = async (n: NinoCasa) => {
    if (!round || !casaActual) return;
    await abrirFormularioNino(n, casaActual.numero, 'house');
  };

  const handleEditNinoDesdeCasaGuardada = async (n: NinoCasa) => {
    if (!round || round.fase !== 'edit-casa' || round.casaActiva == null) return;
    const casa = round.casas.find((c) => c.numero === round.casaActiva && c.guardada);
    if (!casa) return;
    await abrirFormularioNino(n, casa.numero, 'edit-casa');
  };

  const volverDesdeFormularioNino = async () => {
    onCancelEditNino?.();
    if (!round) return;
    const returnFase = childReturnFaseRef.current ?? 'house';
    childReturnFaseRef.current = null;
    await persist({ ...round, fase: returnFase });
  };

  const handleSaveHouse = async () => {
    if (!round || !casaActual || !estadoDraft) return;

    if (casaActual.guardada) {
      setSaving(true);
      let updatedCasa: typeof casaActual = {
        ...casaActual,
        estado: estadoDraft,
        guardada: true,
        latitud: latFinal,
        longitud: lngFinal,
        guardadaAt: casaActual.guardadaAt ?? Date.now(),
      };
      const roundActualizado = aplicarUbicacionARonda(round);
      try {
        const sync = await syncCasaActualizada(roundActualizado, updatedCasa, isOnline, isAdmin);
        updatedCasa = applySyncIdsToCasa(updatedCasa, sync);
        onPendingSync?.();
      } catch (e) {
        console.error(e);
      }
      const casas = round.casas.map((c) => (c.numero === updatedCasa.numero ? updatedCasa : c));
      await persist({ ...roundActualizado, casas, fase: 'croquis' });
      setEstadoDraft(null);
      setSaving(false);
      toast({ title: `Casa ${updatedCasa.numero} actualizada` });
      return;
    }

    if (requiereNinos(estadoDraft) && casaActual.ninos.length < 1) {
      toast({
        title: 'Falta registrar niños',
        description: 'En casa efectiva (E) agregá al menos un niño/a.',
        variant: 'destructive',
      });
      return;
    }
    if (usaUbicacionEncuestadorAsignada(estadoDraft) && !ubicacionAsignadaOk) {
      toast({
        title: 'Ubicación incompleta',
        description: 'Completá región, distrito y barrio en tu perfil o asignación.',
        variant: 'destructive',
      });
      return;
    }
    if (requiereGpsEnVisita(estadoDraft) && !ubicacionCompleta) {
      toast({
        title: 'Falta GPS de la visita',
        description: 'En visitas no efectiva (N), fallida (F) o renuente (R) activá el GPS o indicá enlace de mapa en el punto de la casa.',
        variant: 'destructive',
      });
      return;
    }
    if (alertaContradiccion) {
      toast({ title: 'Revisá el estado', description: alertaContradiccion, variant: 'destructive' });
      return;
    }

    setSaving(true);
    let updatedCasa: typeof casaActual = {
      ...casaActual,
      estado: estadoDraft,
      guardada: true,
      latitud: latFinal,
      longitud: lngFinal,
      guardadaAt: Date.now(),
    };
    const roundActualizado = aplicarUbicacionARonda(round);
    try {
      const sync = await syncCasaGuardada(roundActualizado, updatedCasa, isOnline);
      updatedCasa = applySyncIdsToCasa(updatedCasa, sync);
      onPendingSync?.();
    } catch (e) {
      console.error(e);
    }
    const casas = round.casas.map((c) => (c.numero === updatedCasa.numero ? updatedCasa : c));

    const registrosDelta = estadoDraft === 'E' ? Math.max(1, updatedCasa.ninos.length) : 1;
    notifyJornada(acumularJornada(userId, deltaContadorPorEstadoCasa(estadoDraft), registrosDelta));

    const metaEfectivas = round.totalCasas;
    const efectivas = countCasasEfectivas(casas);
    const metaCumplida = efectivas >= metaEfectivas;
    const nextCasa = casas.find((c) => !c.guardada);
    const visitedAllCurrent = !nextCasa;
    const casasFinales =
      !metaCumplida && visitedAllCurrent
        ? [
            ...casas,
            {
              numero: casas.length + 1,
              estado: null,
              ninos: [],
              guardada: false,
              latitud: null,
              longitud: null,
              guardadaAt: null,
            },
          ]
        : casas;
    const siguienteCasa = casasFinales.find((c) => !c.guardada);
    await persist({
      ...roundActualizado,
      casas: casasFinales,
      ultimaCasaResumen: { numero: updatedCasa.numero, estado: estadoDraft, ninos: updatedCasa.ninos.length },
      fase: metaCumplida ? 'summary' : 'croquis',
      casaActiva: siguienteCasa?.numero ?? round.casaActiva,
      completedAt: metaCumplida ? Date.now() : null,
    });
    setEstadoDraft(null);
    setSaving(false);
    toast({ title: `Casa ${updatedCasa.numero} guardada` });
  };

  const summary = round ? computeRoundSummary(round.casas, round.totalCasas) : null;
  const evaluation = summary ? evaluateRoundMonitoring(summary) : null;

  const openEditCasaGuardada = (numero: number) => {
    if (!round) return;
    const casa = round.casas.find((c) => c.numero === numero && c.guardada);
    if (!casa?.estado) return;
    void persist({ ...round, casaActiva: numero, fase: 'edit-casa' });
  };

  const reabrirCasaGuardada = async (numero: number) => {
    if (!round) return;
    const casa = round.casas.find((c) => c.numero === numero && c.guardada);
    if (!casa?.estado) return;
    if (!casaPermiteReedicionVisita(casa.estado)) {
      openEditCasaGuardada(numero);
      return;
    }
    await goToCasa(numero, { reedit: true });
    toast({
      title: `Editando casa ${numero}`,
      description: 'Podés cambiar estado, GPS o datos y guardar de nuevo.',
    });
  };

  const handleSaveCasaEditada = async (casaEditada: CasaMonitoreo, nuevoEstado: CasaEstadoCode) => {
    if (!round) return;
    setSaving(true);
    let merged = { ...casaEditada, estado: nuevoEstado, guardada: true };
    try {
      const sync = await syncCasaActualizada(round, merged, isOnline, isAdmin);
      merged = applySyncIdsToCasa(merged, sync);
      onPendingSync?.();
    } catch (e) {
      console.error(e);
    }
    const casas = round.casas.map((c) => (c.numero === merged.numero ? merged : c));
    await persist({ ...round, casas, fase: 'croquis' });
    setSaving(false);
    toast({ title: `Casa ${merged.numero} actualizada` });
  };

  const patchRegistroEnRonda = async (registroId: string, patch: Record<string, unknown>) => {
    if (isAdmin) return adminApi.patchRegistro(registroId, patch);
    return adminApi.patchOwnRegistro(registroId, patch);
  };

  const casaEnEdicion =
    round?.fase === 'edit-casa' ? round.casas.find((c) => c.numero === round.casaActiva && c.guardada) : null;

  const handleExportExcel = () => {
    if (!round || !summary || !evaluation) return;
    downloadRoundReportExcel(round, summary, evaluation);
  };

  const handleExportPdf = () => {
    if (!round || !summary || !evaluation) return;
    downloadRoundReportPdf(round, summary, evaluation);
  };

  useEffect(() => {
    if (!round || round.fase !== 'summary' || !summary || !evaluation || rondaRegistrada) return;
    const item = {
      nombre: round.moduloLabel,
      coberturaVacunacion: evaluation.coberturaVacunacion,
      aprobado: evaluation.aprobado,
      efectivas: summary.efectivas,
      noEfectivas: summary.noEfectivas,
      fallidas: summary.fallidas,
      renuentes: summary.renuentes,
      totalNinos: summary.totalNinos,
      vacunados: summary.vacunados,
      visitadas: summary.visitadas,
      totalCasas: summary.totalCasas,
      completadaAt: round.completedAt ?? Date.now(),
    };
    const stats = registrarRondaCompletada(userId, item);
    void saveRoundHistoryToServer({
      roundLocalId: round.id,
      roundCodigo: round.codigo,
      moduloLabel: round.moduloLabel,
      region: round.region,
      distrito: round.distrito,
      servicio: round.servicio,
      barrio: round.barrio,
      responsable: round.responsable,
      entrevistador: round.entrevistador,
      colaboradores: round.colaboradores,
      item,
      snapshot: { round, summary, evaluation },
    });
    notifyJornada(stats);
    setRondaRegistrada(true);
  }, [round, summary, evaluation, rondaRegistrada, userId, notifyJornada]);

  const cerrarNuevaRonda = async () => {
    if (round) {
      const efectivas = countCasasEfectivas(round.casas);
      if (efectivas >= round.totalCasas) {
        dismissRound(userId, round.id);
        void deleteRoundDraftOnServer(round.id);
      }
    }
    setRound(null);
    setEstadoDraft(null);
    setRondaRegistrada(false);
    setSavedRound(null);
    try {
      const active = await roundMonitoringStorage.getActiveForUser(userId);
      const todas = await roundMonitoringStorage.listResumableForUser(userId, {
        includeDismissed: true,
      });
      setSavedRound(active);
      setRecoverableRounds(todas.filter((r) => r.id !== active?.id && rondaIncompleta(r)));
    } catch {
      /* ignore */
    }
  };

  if (!round || round.fase === 'start') {
    return (
      <div className="mrv-flow-container">
        <RoundStartScreen
          barrio={barrio}
          setBarrio={setBarrio}
          barriosDisponibles={barriosDisponibles}
          regionNombre={location.regionNombre}
          distritoNombre={location.distritoNombre}
          servicioNombre={location.servicioNombre}
          entrevistadorNombre={entrevistadorNombre || location.responsable}
          colaboradores={equipoUsuarios}
          maxActiveRounds={MAX_ACTIVE_ROUNDS_PER_USER}
          activeDrafts={activeDrafts}
          onToggleEquipo={(m) => {
            setEquipoUsuarios((prev) => {
              const on = prev.some((x) => x.user_id === m.user_id);
              if (on) return prev.filter((x) => x.user_id !== m.user_id);
              return [...prev, m];
            });
          }}
          onStart={() => void handleStart()}
          canStart={canStart}
          loadingResume={loadingResume}
          savedRound={savedRound}
          recoverableRounds={recoverableRounds}
          onRecoverRound={handleRecoverRound}
          onContinueRound={handleContinueRound}
          onDiscardSavedRound={() => void handleDiscardSavedRound()}
        />
      </div>
    );
  }

  const roundProgress =
    round && round.fase !== 'summary' ? (
      <RoundProgressPanel
        moduloLabel={round.moduloLabel}
        roundCodigo={round.codigo}
        casas={round.casas}
        totalCasas={round.totalCasas}
      />
    ) : null;

  if (round.fase === 'summary' && summary && evaluation) {
    return (
      <div className="mrv-flow-container">
        <RoundProgressPanel
          moduloLabel={round.moduloLabel}
          roundCodigo={round.codigo}
          casas={round.casas}
          totalCasas={round.totalCasas}
          compact
        />
        <RoundSummaryScreen
          summary={summary}
          evaluation={evaluation}
          moduloLabel={round.moduloLabel}
          roundCodigo={round.codigo}
          onExportExcel={handleExportExcel}
          onExportPdf={handleExportPdf}
          onNuevaRonda={cerrarNuevaRonda}
        />
      </div>
    );
  }

  if (round.fase === 'add-child' && casaActual) {
    const editandoNino = Boolean(editingNinoId);
    const estadoCasaLabel = casaActual.estado ? getEstadoConfig(casaActual.estado).titulo : 'Efectiva';
    return (
      <div className="mrv-flow-container flex flex-col gap-4">
        {roundProgress}
        <div className="mrv-panel">
          <span className="mrv-step-pill">
            Casa {casaActual.numero} · {estadoCasaLabel}
          </span>
          <h2 className="text-lg font-bold mt-2">
            {editandoNino ? 'Editar registro del niño/a' : 'Registro del niño/a'}
          </h2>
          {editandoNino && (
            <p className="text-xs text-muted-foreground mt-1">
              Mismo formulario que al añadir: identificación, verificación y vacunación.
            </p>
          )}
        </div>
        {renderRegistroNino()}
        {renderUbicacion()}
        {renderVerificacion()}
        {renderVacunacion()}
        <button
          type="button"
          disabled={!canGuardarNino}
          onClick={() => void handleGuardarNino()}
          className="mrv-btn-primary"
        >
          {editandoNino ? 'Guardar cambios' : 'Guardar niño/a en esta casa'}
        </button>
        <button type="button" onClick={() => void volverDesdeFormularioNino()} className="mrv-btn-ghost">
          {editandoNino ? 'Cancelar edición' : 'Volver a la casa'}
        </button>
      </div>
    );
  }

  if (round.fase === 'edit-casa' && casaEnEdicion) {
    return (
      <div className="mrv-flow-container flex flex-col gap-3">
        {roundProgress}
        <CasaGuardadaEditor
          round={round}
          casa={casaEnEdicion}
          canEditRegistros
          isAdmin={isAdmin}
          saving={saving}
          onCancel={() => void persist({ ...round, fase: 'croquis' })}
          onSave={(casa, estado) => void handleSaveCasaEditada(casa, estado)}
          onPatchRegistro={patchRegistroEnRonda}
          onEditNino={(n) => void handleEditNinoDesdeCasaGuardada(n)}
          onReabrirVisita={
            casaEnEdicion.estado && casaPermiteReedicionVisita(casaEnEdicion.estado)
              ? () => void reabrirCasaGuardada(casaEnEdicion.numero)
              : undefined
          }
        />
      </div>
    );
  }

  const modoReedicion = Boolean(casaActual?.guardada);

  const volverAlCroquis = () => {
    if (!round) return;
    setEstadoDraft(null);
    void persist({ ...round, fase: 'croquis' });
  };

  const houseScreenProps = {
    round,
    casa: casaActual!,
    modoReedicion,
    onCancelReedicion: modoReedicion ? volverAlCroquis : undefined,
    ultimaCasaResumen: round.ultimaCasaResumen,
    estadoSeleccionado: estadoDraft,
    onEstadoChange: (code: CasaEstadoCode) => void handleEstadoChange(code),
    onQuitarEstado: () => void handleQuitarEstado(),
    onAddChild: () => void persist({ ...round, fase: 'add-child' as const }),
    onEditNino: (n) => void handleEditNino(n),
    onSaveHouse: () => void handleSaveHouse(),
    saving,
    alertaContradiccion,
    ubicacionCompleta,
    ubicacionAsignadaOk,
    ubicacionEncuestador,
    renderUbicacion,
  };

  if (round.fase === 'house' && casaActual) {
    return (
      <div className="mrv-flow-container flex flex-col gap-3">
        {roundProgress}
        <ActiveHouseScreen {...houseScreenProps} />
      </div>
    );
  }

  if (round.fase === 'croquis') {
    const siguiente = round.casas.find((c) => !c.guardada);
    if (siguiente?.estado) {
      return (
        <div className="mrv-flow-container flex flex-col gap-3">
          {roundProgress}
          <ActiveHouseScreen
            {...houseScreenProps}
            casa={siguiente}
            estadoSeleccionado={estadoDraft ?? siguiente.estado}
            onAddChild={() =>
              void persist({ ...round, casaActiva: siguiente.numero, fase: 'add-child' })
            }
          />
        </div>
      );
    }
    return (
      <div className="mrv-flow-container flex flex-col gap-3">
        {roundProgress}
        <CroquisMap
          casas={round.casas}
          metaEfectivas={round.totalCasas}
          onContinuarCasa={(n) => void goToCasa(n)}
          canEditCasasGuardadas
          onEditCasaGuardada={openEditCasaGuardada}
          onReabrirCasa={(n) => void reabrirCasaGuardada(n)}
        />
      </div>
    );
  }

  return null;
}
