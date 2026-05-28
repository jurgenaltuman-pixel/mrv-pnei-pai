import { Syringe, Calendar, MapPin, FileText, UserRound } from 'lucide-react';
import type { HistorialSprCompleto } from '@/lib/padron-spr';
import { formatFechaHoraPy, formatFechaPy } from '@/lib/format-fecha';
import { formatEdadPersona, labelDosisSpr, normalizePadronSprDosis } from '@/lib/padron-spr';

interface Props {
  historial: HistorialSprCompleto | null;
  loading?: boolean;
  compact?: boolean;
}

export default function PadronSprHistorial({ historial, loading, compact }: Props) {
  if (loading) {
    return (
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-3 text-sm text-muted-foreground">
        Cargando historial de vacunación SPR…
      </div>
    );
  }
  if (!historial) return null;

  const padron = historial.padron;
  const visitas = historial.visitas_mrv || [];
  const edadTxt = formatEdadPersona(
    { edad_anos: padron?.edad_anos, edad_meses: padron?.edad_meses },
    undefined
  );

  const sinDatos =
    !padron?.dosis?.length && !padron?.resumen && visitas.length === 0 && !edadTxt;

  if (sinDatos) {
    return (
      <div className="rounded-xl border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
        Sin historial SPR registrado en nómina ni en visitas MRV para este documento.
      </div>
    );
  }

  const dosisNorm = (padron?.dosis || []).map((d) => normalizePadronSprDosis(d));

  return (
    <div
      className={`rounded-xl border border-primary/25 bg-gradient-to-br from-primary/5 to-transparent space-y-3 ${
        compact ? 'px-3 py-2.5' : 'p-3'
      }`}
    >
      <div className="flex items-center gap-2">
        <Syringe className="w-4 h-4 text-primary shrink-0" />
        <p className="text-sm font-bold text-foreground">Historial de vacunación SPR</p>
      </div>

      {edadTxt && (
        <p className="text-xs text-muted-foreground">
          Edad en nómina: <span className="font-semibold text-foreground">{edadTxt}</span>
        </p>
      )}

      {padron && (dosisNorm.length > 0 || padron.resumen) && (
        <div className="rounded-lg border bg-card/80 p-2.5 space-y-2">
          <p className="text-[10px] font-bold uppercase text-primary tracking-wide">Padrón nominal</p>
          {padron.esquema_completo != null && (
            <p className="text-xs font-medium">
              Esquema: {padron.esquema_completo ? 'Completo' : 'Incompleto'}
              {padron.cantidad_dosis != null ? ` · ${padron.cantidad_dosis} dosis` : ''}
            </p>
          )}
          <ul className="space-y-2.5">
            {dosisNorm.map((d) => {
              const meta = normalizePadronSprDosis(d);
              return (
                <li
                  key={`${meta.numero ?? ''}-${meta.fecha ?? ''}-${meta.vacuna}`}
                  className="text-xs border-b border-dashed border-border/60 pb-2 last:border-0 last:pb-0"
                >
                  <p className="font-semibold text-foreground">{meta.vacuna || 'SPR'}</p>
                  {meta.fecha && (
                    <p className="text-muted-foreground inline-flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3 shrink-0" />
                      {formatFechaPy(meta.fecha)}
                    </p>
                  )}
                  {meta.lugar_vacunacion && (
                    <p className="text-muted-foreground inline-flex items-start gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>
                        <span className="font-semibold text-foreground/80">Lugar de vacunación:</span>{' '}
                        {meta.lugar_vacunacion}
                      </span>
                    </p>
                  )}
                  {meta.vacunador && (
                    <p className="text-muted-foreground inline-flex items-start gap-1 mt-0.5">
                      <UserRound className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>
                        <span className="font-semibold text-foreground/80">Vacunador:</span> {meta.vacunador}
                      </span>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          {padron.resumen && dosisNorm.length === 0 && (
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{padron.resumen}</p>
          )}
        </div>
      )}

      {visitas.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wide">
            Visitas MRV ({visitas.length})
          </p>
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {visitas.map((v) => (
              <li key={v.id ?? v.fecha_hora} className="rounded-lg border bg-card p-2.5 text-xs">
                <div className="flex flex-wrap items-center gap-2 font-semibold">
                  <span className={v.estado_vacuna === 'vacunado' ? 'text-success' : 'text-destructive'}>
                    {v.estado_vacuna === 'vacunado' ? 'Vacunado' : 'No vacunado'}
                  </span>
                  {v.dosis_spr && <span>· {labelDosisSpr(v.dosis_spr)}</span>}
                </div>
                <p className="text-muted-foreground mt-1 inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatFechaHoraPy(v.fecha_hora)}
                </p>
                {(v.region || v.distrito) && (
                  <p className="text-muted-foreground inline-flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />
                    {[v.region, v.distrito, v.servicio].filter(Boolean).join(' · ')}
                  </p>
                )}
                {v.fecha_dosis_spr && (
                  <p className="mt-0.5">Fecha dosis SPR: {formatFechaPy(v.fecha_dosis_spr)}</p>
                )}
                {v.motivo && (
                  <p className="mt-0.5 text-muted-foreground inline-flex items-start gap-1">
                    <FileText className="w-3 h-3 shrink-0 mt-0.5" />
                    {v.motivo}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
