import { memo } from 'react';
import { AlertTriangle, Baby, Home, MapPin, Pencil, Plus, Save } from 'lucide-react';
import { formatRoundCodigoDisplay } from '@/lib/round-codigo';
import type { RoundMonitoring } from '@/types/round-monitoring';
import { ACCIONES_TOMADAS } from '@/lib/mrv-constants';
import {
  esVisitaNfr,
  etiquetaGuardarVisitaCasa,
  etiquetaVacunacionMonitoreo,
  requiereGpsEnVisita,
} from '@/lib/monitoreo-vacunacion';
import { getEstadoConfig, puedeGuardarSinNinos, requiereNinos } from '@/lib/croquis-housing';
import type { CasaEstadoCode, CasaMonitoreo, NinoCasa } from '@/types/round-monitoring';
import EstadoCasaButtons from './EstadoCasaButtons';
import UbicacionEncuestadorPanel from './UbicacionEncuestadorPanel';
import type { ReactNode } from 'react';

interface LocationAssign {
  region: string;
  distrito: string;
  servicio: string | null;
  barrio: string;
  responsable: string | null;
}

interface Props {
  round?: Pick<RoundMonitoring, 'codigo' | 'id'>;
  casa: CasaMonitoreo;
  estadoSeleccionado: CasaEstadoCode | null;
  ultimaCasaResumen: { numero: number; estado: CasaEstadoCode; ninos: number } | null;
  onEstadoChange: (code: CasaEstadoCode) => void;
  onQuitarEstado?: () => void;
  onAddChild: () => void;
  onEditNino?: (nino: NinoCasa) => void;
  onSaveHouse: () => void;
  saving: boolean;
  alertaContradiccion: string | null;
  ubicacionCompleta: boolean;
  ubicacionAsignadaOk: boolean;
  ubicacionEncuestador: LocationAssign;
  renderUbicacion: () => ReactNode;
}

function resumenNino(n: NinoCasa) {
  const vac = etiquetaVacunacionMonitoreo(n.vacunado, n.dosisSpr);
  const motivoTxt =
    !n.vacunado && n.motivo
      ? n.rechazoVacunacion
        ? `Rechazo: ${n.motivo}`
        : n.motivo
      : '';
  const accionLabel = n.accionTomada
    ? ACCIONES_TOMADAS.find((a) => a.id === n.accionTomada)?.label ?? n.accionTomada
    : '';
  return [n.edadTexto, vac, motivoTxt, accionLabel].filter(Boolean).join(' · ');
}

function ActiveHouseScreen({
  round,
  casa,
  estadoSeleccionado,
  ultimaCasaResumen,
  onEstadoChange,
  onQuitarEstado,
  onAddChild,
  onEditNino,
  onSaveHouse,
  saving,
  alertaContradiccion,
  ubicacionCompleta,
  ubicacionAsignadaOk,
  ubicacionEncuestador,
  renderUbicacion,
}: Props) {
  const cfg = estadoSeleccionado ? getEstadoConfig(estadoSeleccionado) : null;
  const necesitaNinos = requiereNinos(estadoSeleccionado);
  const puedeSinNinos = puedeGuardarSinNinos(estadoSeleccionado);
  const visitaNfr = esVisitaNfr(estadoSeleccionado);
  const necesitaGpsVisita = requiereGpsEnVisita(estadoSeleccionado);
  const ubicacionOk = visitaNfr ? ubicacionAsignadaOk && ubicacionCompleta : true;
  const puedeGuardar =
    estadoSeleccionado &&
    ubicacionOk &&
    (puedeSinNinos || visitaNfr || (necesitaNinos && casa.ninos.length >= 1));
  const estadoYaMarcado = Boolean(estadoSeleccionado);

  return (
    <div className="space-y-4">
      <div className="mrv-panel">
        <div className="flex flex-wrap items-center gap-2">
          <Home className="w-6 h-6 text-primary shrink-0" />
          <span className="text-2xl font-black">Casa #{casa.numero}</span>
          {round && (
            <span className="text-[10px] font-mono text-muted-foreground w-full">
              Ronda {formatRoundCodigoDisplay(round)}
            </span>
          )}
          {cfg && (
            <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${cfg.colorClass}`}>
              {estadoSeleccionado}
            </span>
          )}
        </div>
      </div>

      {!estadoYaMarcado ? (
        <EstadoCasaButtons
          titulo={
            ultimaCasaResumen && ultimaCasaResumen.numero < casa.numero
              ? `Casa ${ultimaCasaResumen.numero} lista — casa ${casa.numero}`
              : `Casa ${casa.numero}`
          }
          estadoSeleccionado={estadoSeleccionado}
          onEstadoChange={onEstadoChange}
        />
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onQuitarEstado}
            className="text-xs text-muted-foreground underline"
          >
            Cambiar estado
          </button>
        </div>
      )}

      {alertaContradiccion && (
        <div className="p-4 rounded-xl border border-warning bg-warning/10 flex gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <p>{alertaContradiccion}</p>
        </div>
      )}

      {visitaNfr && estadoSeleccionado && (
        <UbicacionEncuestadorPanel {...ubicacionEncuestador} />
      )}

      {necesitaGpsVisita && estadoSeleccionado && (
        <div className="mrv-panel mrv-panel-accent">
          <div className="mrv-panel-header mb-2">
            <MapPin className="w-5 h-5 text-primary shrink-0" />
            <h3 className="mrv-panel-title">GPS en el punto de la visita</h3>
          </div>
          {renderUbicacion()}
          {!ubicacionCompleta && (
            <p className="text-sm text-destructive font-medium mt-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Activá el GPS o pegá el enlace de Google Maps de esta casa (obligatorio).
            </p>
          )}
        </div>
      )}

      {estadoSeleccionado === 'E' && (
        <>
          <button
            type="button"
            onClick={onAddChild}
            className="mrv-btn-primary"
          >
            <Plus className="w-6 h-6" />
            Añadir niños
          </button>

          {casa.ninos.length > 0 && (
            <div className="mrv-panel">
              <p className="field-label mb-3 flex items-center gap-2">
                <Baby className="w-4 h-4" />
                Niños ({casa.ninos.length})
              </p>
              <ul className="space-y-2">
                {casa.ninos.map((n) => (
                  <li
                    key={n.id}
                    className="p-3.5 rounded-xl border bg-muted/30 text-sm min-h-[52px] flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-foreground block truncate">{n.nombre}</span>
                      <span className="text-muted-foreground text-xs mt-0.5">CI {n.documento}</span>
                      <span className="text-muted-foreground text-xs">{resumenNino(n)}</span>
                    </div>
                    {onEditNino && !casa.guardada && (
                      <button
                        type="button"
                        onClick={() => onEditNino(n)}
                        className="shrink-0 h-8 w-8 rounded-md text-muted-foreground/70 hover:text-primary hover:bg-muted/60 flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
                        title="Editar datos del niño/a"
                        aria-label="Editar datos del niño/a"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <button type="button" disabled={!puedeGuardar || saving} onClick={onSaveHouse} className="mrv-btn-success">
        <Save className="w-5 h-5" />
        {saving ? 'Guardando…' : etiquetaGuardarVisitaCasa(estadoSeleccionado)}
      </button>
    </div>
  );
}

export default memo(ActiveHouseScreen);
