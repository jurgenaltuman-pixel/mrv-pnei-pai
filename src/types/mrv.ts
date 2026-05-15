export interface ContadorViviendas {
  efectivas: number;
  noEfectivas: number;
  fallidas: number;
  renuentes: number;
}

export interface RegionSanitaria {
  id: number;
  nombre: string;
  codigo: string | null;
}

export interface Distrito {
  id: number;
  nombre: string;
  region_id: number;
}

export interface ServicioSalud {
  id: number;
  nombre: string;
  distrito_id: number;
}

export interface Barrio {
  id: number;
  nombre: string;
  distrito_id: number;
}

export const MOTIVOS_NO_VACUNACION = [
  'No sabía que era necesario',
  'No sabe dónde acudir',
  'No tiene tiempo de acercarse al servicio de salud',
  'Los padres rechazaron la vacunación',
  'Niño/a enfermo',
  'Contraindicación médica',
  'Personal de salud rehusó vacunar',
  'Servicio de salud cerrado',
  'El horario de vacunación no coincide',
  'Esquema de vacunación mal indicado',
  'Falta de insumos (Vacunas)',
  'Motivos religiosos',
];
