import { useState } from 'react';
import { Home, Pencil, Save, Undo2, X } from 'lucide-react';
import EstadoCasaButtons from './EstadoCasaButtons';
import RegistroEditDialog, { type RegistroEditFields } from '@/components/mrv/RegistroEditDialog';
import { getEstadoConfig } from '@/lib/croquis-housing';
import { ninoToRegistroEditFields, patchFromRegistroEdit } from '@/lib/nino-casa-registro';
import { formatRoundCodigoDisplay } from '@/lib/round-codigo';
import type { CasaEstadoCode, CasaMonitoreo, NinoCasa, RoundMonitoring } from '@/types/round-monitoring';

interface Props {
  round: RoundMonitoring;
  casa: CasaMonitoreo;
  canEditRegistros: boolean;
  isAdmin: boolean;
  saving: boolean;
  onCancel: () => void;
  onSave: (casa: CasaMonitoreo, estado: CasaEstadoCode) => void;
  onPatchRegistro: (registroId: string, patch: Record<string, unknown>) => Promise<string | null>;
  onReabrirVisita?: () => void;
}

export default function CasaGuardadaEditor({
  round,
  casa: initialCasa,
  canEditRegistros,
  isAdmin,
  saving,
  onCancel,
  onSave,
  onPatchRegistro,
  onReabrirVisita,
}: Props) {
  const [casa, setCasa] = useState(initialCasa);
  const [estado, setEstado] = useState<CasaEstadoCode>(initialCasa.estado!);
  const [registroEdit, setRegistroEdit] = useState<RegistroEditFields | null>(null);
  const [editingNinoId, setEditingNinoId] = useState<string | null>(null);
  const [savingRegistro, setSavingRegistro] = useState(false);

  const cfg = getEstadoConfig(estado);
  const codigo = formatRoundCodigoDisplay(round);

  const openNinoEdit = (n: NinoCasa) => {
    if (!n.registroId && !isAdmin) {
      return;
    }
    setRegistroEdit(ninoToRegistroEditFields(n, round, casa.numero));
    setEditingNinoId(n.id);
  };

  const saveRegistroEdit = async (patch: Record<string, unknown>) => {
    const nino = casa.ninos.find((n) => n.id === editingNinoId);
    if (!nino?.registroId) {
      setRegistroEdit(null);
      setEditingNinoId(null);
      return;
    }
    setSavingRegistro(true);
    const err = await onPatchRegistro(nino.registroId, patch);
    setSavingRegistro(false);
    if (err) return;
    const updated = patchFromRegistroEdit(patch, nino);
    setCasa({
      ...casa,
      ninos: casa.ninos.map((n) => (n.id === nino.id ? { ...n, ...updated } : n)),
    });
    setRegistroEdit(null);
    setEditingNinoId(null);
  };

  return (
    <div className="space-y-4">
      <div className="mrv-panel flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Home className="w-6 h-6 text-primary shrink-0" />
          <div>
            <p className="text-lg font-black">Editar casa #{casa.numero}</p>
            <p className="text-[10px] text-muted-foreground font-mono">Ronda {codigo}</p>
          </div>
          {cfg && (
            <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${cfg.colorClass}`}>{estado}</span>
          )}
        </div>
        <button type="button" onClick={onCancel} className="h-9 px-3 rounded-lg border text-xs font-bold flex items-center gap-1">
          <X className="w-4 h-4" /> Cerrar
        </button>
      </div>

      {onReabrirVisita && (
        <button
          type="button"
          onClick={onReabrirVisita}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 border-primary/40 bg-primary/5 text-primary text-sm font-bold"
        >
          <Undo2 className="w-4 h-4 shrink-0" />
          Retroceder al formulario de visita
        </button>
      )}

      {canEditRegistros && (
        <>
          <EstadoCasaButtons
            titulo={`Estado de la casa ${casa.numero}`}
            estadoSeleccionado={estado}
            onEstadoChange={setEstado}
          />

          {casa.ninos.length > 0 && (
            <div className="mrv-panel space-y-2">
              <p className="text-xs font-bold uppercase text-muted-foreground">Registros en esta casa</p>
              <ul className="space-y-2">
                {casa.ninos.map((n) => (
                  <li
                    key={n.id}
                    className="flex items-center justify-between gap-2 p-3 rounded-xl border bg-muted/30 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{n.nombre}</p>
                      <p className="text-[10px] text-muted-foreground">CI {n.documento}</p>
                    </div>
                    {(n.registroId || isAdmin) && (
                      <button
                        type="button"
                        onClick={() => openNinoEdit(n)}
                        className="shrink-0 h-8 px-2.5 rounded-lg bg-primary/10 text-primary text-[11px] font-bold flex items-center gap-1"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Editar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {casa.ninos.length === 0 && casa.visitaRegistroId && isAdmin && (
            <p className="text-xs text-muted-foreground">
              Visita {estado} — registro {casa.visitaRegistroId.slice(0, 8)}… (editá desde Administración → Registros).
            </p>
          )}

          <button
            type="button"
            disabled={saving || !estado}
            onClick={() => onSave({ ...casa, estado, guardada: true }, estado)}
            className="mrv-btn-success w-full"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Guardando cambios…' : 'Guardar cambios de la casa'}
          </button>
        </>
      )}

      {!canEditRegistros && (
        <p className="text-sm text-muted-foreground">Sin permiso para editar esta casa.</p>
      )}

      <RegistroEditDialog
        registro={registroEdit}
        saving={savingRegistro}
        onClose={() => {
          setRegistroEdit(null);
          setEditingNinoId(null);
        }}
        onSave={(patch) => void saveRegistroEdit(patch)}
      />
    </div>
  );
}
