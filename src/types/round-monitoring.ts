/** Códigos de estado de casa en croquis MRV */
export type CasaEstadoCode = 'E' | 'N' | 'F' | 'R';

export type CasaEstadoDb = 'efectiva' | 'revisitada' | 'sin_adulto_responsable' | 'renuente';

export type DosisSprOpcion = '1' | '2plus';

export interface NinoCasa {
  id: string;
  /** ID del registro en servidor (tras guardar la casa). */
  registroId?: string | null;
  nombre: string;
  tipo_documento: string;
  documento: string;
  fecha_nacimiento: string;
  sexo: string;
  edadTexto: string | null;
  dosisSpr: DosisSprOpcion;
  /** Derivado: 2+ dosis = vacunado */
  vacunado: boolean;
  motivo: string | null;
  rechazoVacunacion: boolean;
  accionTomada: string | null;
  /** Opcional: niño con cambio de residencia */
  cambioResidencia?: boolean;
  libreta?: boolean;
  fuenteVerificacion?: string;
  esquemaCompleto?: boolean;
  tieneCvs?: boolean;
}

export interface CasaMonitoreo {
  numero: number;
  estado: CasaEstadoCode | null;
  ninos: NinoCasa[];
  guardada: boolean;
  latitud: number | null;
  longitud: number | null;
  guardadaAt: number | null;
  /** Registro único de visita N/F/R sin niños. */
  visitaRegistroId?: string | null;
}

export interface RoundSummary {
  totalCasas: number;
  visitadas: number;
  efectivas: number;
  noEfectivas: number;
  fallidas: number;
  renuentes: number;
  totalNinos: number;
  vacunados: number;
  noVacunados: number;
}

export interface RoundMonitoring {
  id: string;
  /** Código legible (ej. R250527-A3F2) para historial y registros. */
  codigo: string;
  userId: string;
  moduloLabel: string;
  totalCasas: number;
  casas: CasaMonitoreo[];
  casaActiva: number;
  fase: 'start' | 'croquis' | 'house' | 'add-child' | 'summary' | 'edit-casa';
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  region: string;
  distrito: string;
  servicio: string | null;
  barrio: string;
  responsable: string | null;
  /** Entrevistador principal (brigadista que inicia la ronda). */
  entrevistador: string | null;
  /** Brigadistas adicionales en la misma ronda (misma región/distrito/servicio). */
  colaboradores: string[];
  ultimaCasaResumen: { numero: number; estado: CasaEstadoCode; ninos: number } | null;
}

export interface RoundConfig {
  casasPorModulo: number;
  adminPasswordHash?: string;
}
