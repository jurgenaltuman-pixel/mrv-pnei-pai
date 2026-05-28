import type { RegistroMRV } from '@/services/dataService';

export function registroMapLabelHtml(r: RegistroMRV): string {
  const vac = r.estado_vacuna === 'vacunado';
  const estado = vac ? 'Vacunado' : 'No vacunado';
  const estadoClass = vac ? 'mrv-label-ok' : 'mrv-label-bad';
  const doc = r.documento?.trim() || 'Sin doc.';
  const edad = r.edad != null && r.edad !== '' ? ` · ${r.edad} años` : '';
  const barrio = r.barrio?.trim() || '—';
  const distrito = r.distrito?.trim() || '—';
  const servicio = r.servicio?.trim();
  const responsable = r.responsable?.trim();
  const motivo =
    r.motivo && r.motivo.length > 60 ? `${r.motivo.slice(0, 57)}…` : r.motivo?.trim();

  const lines = [
    `<strong class="mrv-label-name">${escapeHtml(r.nombre || 'Sin nombre')}</strong>`,
    `<span class="${estadoClass}">${estado}</span>`,
    `<span class="mrv-label-meta">${escapeHtml(doc)}${escapeHtml(edad)}</span>`,
    `<span class="mrv-label-meta">${escapeHtml(distrito)} · ${escapeHtml(barrio)}</span>`,
  ];
  if (servicio) lines.push(`<span class="mrv-label-meta">${escapeHtml(servicio)}</span>`);
  if (responsable) lines.push(`<span class="mrv-label-meta">Responsable: ${escapeHtml(responsable)}</span>`);
  if (motivo) lines.push(`<span class="mrv-label-motivo">${escapeHtml(motivo)}</span>`);

  return `<div class="mrv-map-label-inner">${lines.join('')}</div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
