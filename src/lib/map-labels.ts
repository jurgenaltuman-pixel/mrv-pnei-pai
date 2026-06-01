import type { RegistroMRV } from '@/services/dataService';
import { getEstadoConfig } from '@/lib/croquis-housing';
import { getVisitaCode } from '@/lib/visita-filter';

export function registroMapEstadoLine(r: RegistroMRV): { text: string; className: string } {
  const code = getVisitaCode(r);
  if (code === 'N' || code === 'F' || code === 'R') {
    const cfg = getEstadoConfig(code);
    return { text: `${cfg.titulo} (${code})`, className: 'mrv-label-visita' };
  }
  if (code === 'E' || !code) {
    if (r.estado_vacuna === 'vacunado') {
      return { text: 'Vacunado', className: 'mrv-label-ok' };
    }
    if (code === 'E' && r.estado_vacuna === 'no_vacunado') {
      return { text: 'No vacunado', className: 'mrv-label-bad' };
    }
  }
  return { text: 'Registro', className: 'mrv-label-meta' };
}

export function registroMapLabelHtml(r: RegistroMRV): string {
  const { text: estado, className: estadoClass } = registroMapEstadoLine(r);
  const doc = r.documento?.trim() || 'Sin doc.';
  const edad = r.edad != null && r.edad !== '' ? ` · ${r.edad} años` : '';
  const barrio = r.barrio?.trim() || '—';
  const distrito = r.distrito?.trim() || '—';
  const servicio = r.servicio?.trim();
  const responsable = r.responsable?.trim();
  const code = getVisitaCode(r);
  const motivoRaw = r.motivo?.trim();
  const motivo =
    motivoRaw && motivoRaw.length > 60 ? `${motivoRaw.slice(0, 57)}…` : motivoRaw;

  const lines = [
    `<strong class="mrv-label-name">${escapeHtml(r.nombre || 'Sin nombre')}</strong>`,
    `<span class="${estadoClass}">${escapeHtml(estado)}</span>`,
    `<span class="mrv-label-meta">${escapeHtml(doc)}${escapeHtml(edad)}</span>`,
    `<span class="mrv-label-meta">${escapeHtml(distrito)} · ${escapeHtml(barrio)}</span>`,
  ];
  if (servicio) lines.push(`<span class="mrv-label-meta">${escapeHtml(servicio)}</span>`);
  if (responsable) lines.push(`<span class="mrv-label-meta">Responsable: ${escapeHtml(responsable)}</span>`);
  if (motivo && code !== 'N' && code !== 'F' && code !== 'R') {
    lines.push(`<span class="mrv-label-motivo">${escapeHtml(motivo)}</span>`);
  } else if (motivo && code === 'E' && r.estado_vacuna === 'no_vacunado') {
    lines.push(`<span class="mrv-label-motivo">${escapeHtml(motivo)}</span>`);
  }

  return `<div class="mrv-map-label-inner">${lines.join('')}</div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
