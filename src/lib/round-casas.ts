import type { CasaMonitoreo, RoundMonitoring } from '@/types/round-monitoring';
import { aplicarMetaFija, MAX_CASAS_VISITADAS } from '@/lib/round-meta';

export function crearCasasVacias(total: number): CasaMonitoreo[] {
  return Array.from({ length: total }, (_, i) => ({
    numero: i + 1,
    estado: null,
    ninos: [],
    guardada: false,
    latitud: null,
    longitud: null,
    guardadaAt: null,
  }));
}

export function anadirCasaARonda(round: RoundMonitoring): RoundMonitoring | null {
  if (round.casas.length >= MAX_CASAS_VISITADAS) return null;
  const nuevoNumero = round.casas.length + 1;
  const nuevaCasa: CasaMonitoreo = {
    numero: nuevoNumero,
    estado: null,
    ninos: [],
    guardada: false,
    latitud: null,
    longitud: null,
    guardadaAt: null,
  };
  return aplicarMetaFija({
    ...round,
    casas: [...round.casas, nuevaCasa],
    casaActiva: nuevoNumero,
    fase: 'croquis',
    completedAt: null,
    ultimaCasaResumen: round.ultimaCasaResumen,
  });
}
