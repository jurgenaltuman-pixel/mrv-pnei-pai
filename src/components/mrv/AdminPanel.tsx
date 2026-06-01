import { useState, useRef, useMemo, useEffect } from 'react';
import type { Database } from '@/integrations/supabase/types';
import * as adminApi from '@/services/adminApi';
import * as mrvBackend from '@/services/mrvBackend';
import { upperText } from '@/lib/text-uppercase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgStructure } from '@/hooks/useOrgStructure';
import { dataService, type RegistroMRV } from '@/services/dataService';
import { downloadRegistrosExcel, mapApiRowToRegistroMRV } from '@/lib/export-registros-excel';
import {
  Upload,
  FileSpreadsheet,
  Trash2,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Users,
  Search,
  Download,
  X,
  LayoutGrid,
} from 'lucide-react';
import { mapExcelRowsToRegistros } from '@/lib/import-registros-excel';
import * as XLSX from 'xlsx';
import { mapPersonaImportRow } from '@/lib/import-excel-mrv';
import { clampCasasPorModulo, getRoundConfig, MAX_CASAS_POR_MODULO, setRoundConfig } from '@/lib/round-config';
import { formatFechaHoraPy } from '@/lib/format-fecha';
import { hasProfileScopeAssignment } from '@/lib/registro-scope';
import { useProfileScope } from '@/hooks/useProfileScope';
import RegistroEditDialog, { type RegistroEditFields } from '@/components/mrv/RegistroEditDialog';
import RoundHistoryPanel from '@/components/mrv/RoundHistoryPanel';
import {
  type AppRole,
  ROLE_LABELS,
  rolesAssignableBy,
  canManageUserRoles,
  canChangeTargetRole,
} from '@/lib/app-roles';

type PersonaRow = Database['public']['Tables']['base_personas']['Row'];

type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

interface ParsedRow {
  nombre: string;
  tipo_documento: string;
  documento: string;
  fecha_nacimiento: string | null;
  sexo: string | null;
  region_sanitaria: string | null;
  distrito: string | null;
  servicio_salud: string | null;
  documento_madre: string | null;
  nombre_madre: string | null;
}

interface NominalRow {
  id: string;
  fecha_hora: string | null;
  region: string;
  distrito: string;
  servicio: string | null;
  barrio: string | null;
  responsable: string | null;
  nombre: string;
  documento: string;
  fecha_nacimiento: string;
  sexo: string;
  estado_vacunacion: string;
  motivo: string | null;
  observaciones?: string | null;
  tipo_vivienda?: string | null;
  esquema_completo?: boolean | null;
}

interface OrgRow {
  region: string;
  distrito: string;
  servicio: string;
  barrio?: string;
}

interface ImportedUser {
  ci: string;
  nombres_completos: string;
  nombre_usuario: string;
  assigned_region: string;
  assigned_distrito: string;
  assigned_servicio: string;
  fecha_nacimiento?: string;
}

interface ProfileRow {
  user_id: string;
  display_name: string | null;
  email: string | null;
  username: string | null;
  is_active?: boolean | null;
  is_approved?: boolean | null;
  approved_at?: string | null;
  assigned_region?: string | null;
  assigned_distrito?: string | null;
  assigned_servicio?: string | null;
  assigned_barrio?: string | null;
  scope_locked?: boolean;
  has_credentials?: boolean;
}

interface UserRoleRow {
  user_id: string;
  role: AppRole;
}

function parseDate(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  if (typeof val === 'string') {
    const parts = val.split('/');
    if (parts.length === 3) {
      const [m, d] = parts;
      let y = parts[2];
      if (y.length === 2) y = (parseInt(y) > 50 ? '19' : '20') + y;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.substring(0, 10);
  }
  return null;
}

function normalizeHeader(value: string) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

/** Parte nombre completo para columnas tipo nómina (nombre1…apellido2). */
function splitNombreNomina(nombre: string): { n1: string; n2: string; a1: string; a2: string } {
  const p = nombre.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return { n1: '', n2: '', a1: '', a2: '' };
  if (p.length === 1) return { n1: p[0], n2: '', a1: '', a2: '' };
  if (p.length === 2) return { n1: p[0], n2: '', a1: p[1], a2: '' };
  if (p.length === 3) return { n1: p[0], n2: '', a1: p[1], a2: p[2] };
  return { n1: p[0], n2: p[1], a1: p[p.length - 2], a2: p[p.length - 1] };
}

function edadAniosMesesDesdeFn(fechaIso: string | null | undefined): { anos: number | ''; meses: number | '' } {
  if (!fechaIso) return { anos: '', meses: '' };
  const d = new Date(`${fechaIso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return { anos: '', meses: '' };
  const hoy = new Date();
  let meses = (hoy.getFullYear() - d.getFullYear()) * 12 + (hoy.getMonth() - d.getMonth());
  if (hoy.getDate() < d.getDate()) meses -= 1;
  if (meses < 0) return { anos: '', meses: '' };
  const anos = Math.floor(meses / 12);
  return { anos, meses: meses % 12 };
}

export default function AdminPanel({ isSuperAdmin = false, isAdmin = false }: { isSuperAdmin?: boolean; isAdmin?: boolean }) {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const { data: myScope } = useProfileScope();
  const { regiones, getDistritosByRegion, getServiciosByDistrito, getBarriosByDistrito } = useOrgStructure();
  const [nominalNationalView, setNominalNationalView] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const orgFileRef = useRef<HTMLInputElement>(null);
  const userFileRef = useRef<HTMLInputElement>(null);
  const registrosFileRef = useRef<HTMLInputElement>(null);
  const [importingRegistros, setImportingRegistros] = useState(false);
  const ciSearchDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [orgRows, setOrgRows] = useState<OrgRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadingOrg, setUploadingOrg] = useState(false);
  const [status, setStatus] = useState<'idle' | 'parsed' | 'uploading' | 'done' | 'error'>('idle');
  const [orgStatus, setOrgStatus] = useState<'idle' | 'parsed' | 'uploading' | 'done' | 'error'>('idle');
  const [stats, setStats] = useState({ total: 0, inserted: 0, errors: 0 });
  const [nominal, setNominal] = useState<NominalRow[]>([]);
  const [nominalTotal, setNominalTotal] = useState<number | null>(null);
  const [nominalSources, setNominalSources] = useState<{ aiven?: number; supabase?: number; merged?: number } | null>(
    null
  );
  const [nominalLoadError, setNominalLoadError] = useState<string | null>(null);
  const [loadingNominal, setLoadingNominal] = useState(false);
  const [exportingNominal, setExportingNominal] = useState(false);
  const [editingNominalId, setEditingNominalId] = useState<string | null>(null);
  const [registroEdit, setRegistroEdit] = useState<RegistroEditFields | null>(null);
  const [roundFilterRegion, setRoundFilterRegion] = useState('');
  const [roundFilterDistrito, setRoundFilterDistrito] = useState('');
  const [roundFilterServicio, setRoundFilterServicio] = useState('');
  const [roundFilterResponsable, setRoundFilterResponsable] = useState('');
  const [qNominal, setQNominal] = useState('');
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [roles, setRoles] = useState<UserRoleRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [savingRoleFor, setSavingRoleFor] = useState<string | null>(null);
  const [deletingNominalId, setDeletingNominalId] = useState<string | null>(null);
  const [savingScopeFor, setSavingScopeFor] = useState<string | null>(null);
  const [resettingPasswordFor, setResettingPasswordFor] = useState<string | null>(null);
  const [qUsers, setQUsers] = useState('');
  const [userListFilter, setUserListFilter] = useState<'all' | 'approved_active'>('all');
  const [syncingProfiles, setSyncingProfiles] = useState(false);
  const [scopeDraft, setScopeDraft] = useState<Record<string, {
    assigned_region: string;
    assigned_distrito: string;
    assigned_servicio: string;
    assigned_barrio: string;
    scope_locked: boolean;
  }>>({});
  const [showUserModal, setShowUserModal] = useState(false);
  const [ciSearch, setCiSearch] = useState('');
  const [ciResults, setCiResults] = useState<PersonaRow[]>([]);
  const [searchingCi, setSearchingCi] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [importedUsers, setImportedUsers] = useState<ImportedUser[]>([]);
  const [replaceUsersOnImport, setReplaceUsersOnImport] = useState(true);
  const [manualUser, setManualUser] = useState({
    ci: '',
    nombre: '',
    username: '',
    region: '',
    distrito: '',
    servicio: '',
  });
  const [creatingManualUser, setCreatingManualUser] = useState(false);
  const [uploadingUsers, setUploadingUsers] = useState(false);
  const [statusImportUsers, setStatusImportUsers] = useState<'idle' | 'parsed' | 'uploading' | 'done' | 'error'>('idle');

  const loadUsersAndRoles = async () => {
    setLoadingUsers(true);
    try {
      const { profiles: profilesData, roles: rolesAcc, error } = await adminApi.loadProfilesRoles();
      setLoadingUsers(false);
      if (error) {
        toast({ title: 'Error cargando usuarios', description: error, variant: 'destructive' });
        return;
      }
      if (!profilesData.length) {
        setProfiles([]);
      } else {
        setProfiles(profilesData as ProfileRow[]);
        const draft: Record<string, {
          assigned_region: string;
          assigned_distrito: string;
          assigned_servicio: string;
          assigned_barrio: string;
          scope_locked: boolean;
        }> = {};
        profilesData.forEach((p) => {
          draft[p.user_id] = {
            assigned_region: p.assigned_region || '',
            assigned_distrito: p.assigned_distrito || '',
            assigned_servicio: p.assigned_servicio || '',
            assigned_barrio: p.assigned_barrio || '',
            scope_locked: Boolean(p.scope_locked),
          };
        });
        setScopeDraft(draft);
      }
      setRoles(rolesAcc as UserRoleRow[]);
    } catch (err) {
      console.error('Error cargando usuarios y roles:', err);
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    void loadUsersAndRoles();
  }, []);

  const roleByUser = useMemo(() => {
    const map = new Map<string, UserRoleRow['role']>();
    roles.forEach((r) => {
      // Prioridad por jerarquía
      const current = map.get(r.user_id);
      const order = { super_admin: 6, admin: 5, supervisor: 4, regional: 3, moderator: 2, user: 1 };
      if (!current || order[r.role] > order[current]) map.set(r.user_id, r.role);
    });
    return map;
  }, [roles]);

  const filteredProfiles = useMemo(() => {
    let base =
      userListFilter === 'approved_active'
        ? profiles.filter((p) => Boolean(p.is_approved) && Boolean(p.is_active))
        : profiles;
    const q = qUsers.trim().toLowerCase();
    if (!q) return base;
    return base.filter((p) =>
      [p.display_name, p.username, p.email, p.assigned_region, p.assigned_distrito]
        .map((v) => (v || '').toLowerCase())
        .some((v) => v.includes(q))
    );
  }, [profiles, qUsers, userListFilter]);

  const assignableRoles = useMemo(
    () => rolesAssignableBy({ isSuperAdmin, isAdmin }),
    [isSuperAdmin, isAdmin]
  );

  const setPrimaryRole = async (userId: string, role: AppRole) => {
    if (!canManageUserRoles({ isSuperAdmin, isAdmin })) {
      toast({ title: 'Sin permiso para cambiar roles', variant: 'destructive' });
      return;
    }
    const targetCurrent = roleByUser.get(userId);
    if (!canChangeTargetRole({ isSuperAdmin, isAdmin }, targetCurrent)) {
      toast({
        title: 'Sin permiso',
        description: 'Solo un super administrador puede modificar otro super admin.',
        variant: 'destructive',
      });
      return;
    }
    if (!assignableRoles.includes(role)) {
      toast({
        title: 'Rol no permitido',
        description: isSuperAdmin
          ? 'Rol no válido.'
          : 'Como administrador podés asignar: brigadista, moderador, regional, supervisor, admin.',
        variant: 'destructive',
      });
      return;
    }
    setSavingRoleFor(userId);
    const errMsg = await adminApi.setPrimaryRole(userId, role);
    setSavingRoleFor(null);
    if (errMsg) {
      toast({ title: 'No se pudo asignar el rol', description: errMsg, variant: 'destructive' });
      return;
    }
    toast({ title: 'Rol actualizado', description: ROLE_LABELS[role] });
    await loadUsersAndRoles();
  };

  const setUserApproval = async (userId: string, approved: boolean) => {
    if (!isAdmin && !isSuperAdmin) return;
    setSavingScopeFor(userId);
    const errMsg = await adminApi.patchProfile(userId, { is_approved: approved });
    setSavingScopeFor(null);
    if (errMsg) {
      toast({ title: 'No se pudo actualizar aprobación', description: errMsg, variant: 'destructive' });
      return;
    }
    toast({ title: approved ? 'Usuario aprobado' : 'Aprobación revocada' });
    await loadUsersAndRoles();
  };

  const setUserActive = async (userId: string, active: boolean) => {
    if (!isAdmin && !isSuperAdmin) return;
    setSavingScopeFor(userId);
    const errMsg = await adminApi.patchProfile(userId, { is_active: active });
    setSavingScopeFor(null);
    if (errMsg) {
      toast({ title: 'No se pudo actualizar estado', description: errMsg, variant: 'destructive' });
      return;
    }
    toast({ title: active ? 'Usuario activado' : 'Usuario inactivado' });
    await loadUsersAndRoles();
  };

  const resetPasswordByDefault = async (targetUserId: string) => {
    if (!isAdmin && !isSuperAdmin) return;
    setResettingPasswordFor(targetUserId);
    const { password, error } = await adminApi.resetPassword(targetUserId);
    if (error) {
      setResettingPasswordFor(null);
      toast({
        title: 'No se pudo resetear contraseña',
        description: error,
        variant: 'destructive',
      });
      return;
    }
    setResettingPasswordFor(null);
    toast({
      title: 'Contraseña reseteada',
      description: `Clave temporal: ${password}. Ingresar con usuario o email mostrado. Se exigirá cambio al ingresar.`,
    });
  };

  const syncProfilesIdentity = async () => {
    if (!isAdmin && !isSuperAdmin) return;
    setSyncingProfiles(true);
    const errMsg = await adminApi.syncProfilesIdentity();
    setSyncingProfiles(false);
    if (errMsg) {
      toast({ title: 'No se pudo sincronizar perfiles', description: errMsg, variant: 'destructive' });
      return;
    }
    toast({ title: 'Perfiles sincronizados', description: 'Sincronización completada.' });
    await loadUsersAndRoles();
  };

  const deleteNominal = async (id: string, nombre: string) => {
    if (!isAdmin && !isSuperAdmin) return;
    if (!window.confirm(`¿Eliminar el registro de ${nombre}? Esta acción no se puede deshacer.`)) return;
    setDeletingNominalId(id);
    const errMsg = await adminApi.deleteRegistro(id);
    setDeletingNominalId(null);
    if (errMsg) {
      toast({ title: 'No se pudo eliminar el registro', description: errMsg, variant: 'destructive' });
      return;
    }
    toast({ title: 'Registro eliminado' });
    await loadNominal();
  };

  const updateScopeDraft = (userId: string, patch: Partial<{
    assigned_region: string;
    assigned_distrito: string;
    assigned_servicio: string;
    assigned_barrio: string;
    scope_locked: boolean;
  }>) => {
    setScopeDraft((prev) => ({
      ...prev,
      [userId]: {
        assigned_region: prev[userId]?.assigned_region || '',
        assigned_distrito: prev[userId]?.assigned_distrito || '',
        assigned_servicio: prev[userId]?.assigned_servicio || '',
        assigned_barrio: prev[userId]?.assigned_barrio || '',
        scope_locked: prev[userId]?.scope_locked || false,
        ...patch,
      },
    }));
  };

  const saveUserScope = async (userId: string) => {
    const draft = scopeDraft[userId];
    if (!draft) return;
    setSavingScopeFor(userId);
    const basePayload: Record<string, any> = {
      assigned_region: draft.assigned_region?.trim() || null,
      assigned_distrito: draft.assigned_distrito?.trim() || null,
      assigned_servicio: draft.assigned_servicio?.trim() || null,
      assigned_barrio: draft.assigned_barrio?.trim() || null,
      scope_locked: draft.scope_locked,
    };

    const errMsg = await adminApi.patchProfile(userId, basePayload);

    setSavingScopeFor(null);
    if (errMsg) {
      toast({
        title: 'No se pudo guardar alcance del usuario',
        description: errMsg,
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'Alcance de usuario actualizado' });
    await loadUsersAndRoles();
  };

  const loadNominal = async (forceNational = nominalNationalView) => {
    setLoadingNominal(true);
    setNominalLoadError(null);
    const { data, error, total, sources, totalAiven, totalSupabase } = await adminApi.loadNominalRows({
      national: forceNational,
    });
    setLoadingNominal(false);
    if (error) {
      console.error('Error cargando reporte nominal:', error);
      setNominalLoadError(error);
      toast({ title: 'Error al cargar registros', description: error, variant: 'destructive' });
      return;
    }
    setNominalTotal(total ?? data.length);
    setNominalSources(
      sources ?? {
        aiven: totalAiven,
        supabase: totalSupabase,
        merged: data.length,
      }
    );
    setNominal(
      (data || []).map((row) => ({
        id: String(row.id),
        fecha_hora: (row.fecha_hora as string) ?? null,
        region: String(row.region || ''),
        distrito: String(row.distrito || ''),
        servicio: (row.servicio as string) ?? null,
        barrio: (row.barrio as string) ?? null,
        responsable: (row.responsable as string) ?? null,
        nombre: String(row.nombre || ''),
        documento: String(row.documento || ''),
        fecha_nacimiento: String(row.fecha_nacimiento || ''),
        sexo: String(row.sexo || ''),
        estado_vacunacion: String(row.estado_vacunacion ?? row.estado_vacuna ?? ''),
        motivo: (row.motivo as string) ?? null,
        observaciones: (row.observaciones as string) ?? null,
        tipo_vivienda: (row.tipo_vivienda as string) ?? null,
        esquema_completo: (row.esquema_completo as boolean) ?? null,
      }))
    );
  };

  const openRegistroEdit = (r: NominalRow) => {
    if (!isAdmin && !isSuperAdmin) return;
    setRegistroEdit({
      id: r.id,
      nombre: r.nombre,
      documento: r.documento,
      region: r.region,
      distrito: r.distrito,
      servicio: r.servicio || '',
      barrio: r.barrio || '',
      estado_vacunacion: r.estado_vacunacion || 'no_vacunado',
      motivo: r.motivo || '',
      observaciones: r.observaciones || '',
      responsable: r.responsable || '',
    });
  };

  const saveRegistroEdit = async (patch: Record<string, unknown>) => {
    if (!registroEdit) return;
    setEditingNominalId(registroEdit.id);
    const errMsg = await adminApi.patchRegistro(registroEdit.id, patch);
    setEditingNominalId(null);
    if (errMsg) {
      toast({ title: 'No se pudo actualizar', description: errMsg, variant: 'destructive' });
      return;
    }
    toast({ title: 'Registro actualizado' });
    setRegistroEdit(null);
    await loadNominal();
  };

  const handleImportRegistrosExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      setImportingRegistros(true);
      try {
        const wb = XLSX.read(new Uint8Array(evt.target?.result as ArrayBuffer), { type: 'array', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[];
        const mapped = mapExcelRowsToRegistros(json, currentUser?.id || '');
        if (!mapped.length) {
          toast({
            title: 'Sin filas válidas',
            description: 'El Excel debe tener región, distrito y nombre o documento.',
            variant: 'destructive',
          });
          return;
        }
        const { inserted, skipped, error, total } = await adminApi.importRegistrosFromExcel(mapped);
        if (error) {
          toast({ title: 'Error al importar', description: error, variant: 'destructive' });
          return;
        }
        toast({
          title: 'Registros importados',
          description: `${inserted} guardados${skipped ? `, ${skipped} omitidos` : ''}${total != null ? ` · total en base: ${total}` : ''}`,
        });
        setNominalNationalView(true);
        await loadNominal(true);
      } catch (err) {
        toast({
          title: 'No se pudo leer el Excel',
          description: err instanceof Error ? err.message : String(err),
          variant: 'destructive',
        });
      } finally {
        setImportingRegistros(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const exportNominalExcel = async () => {
    setExportingNominal(true);
    try {
      const { data, error, total } = await adminApi.loadNominalRows({ national: true });
      if (error) {
        toast({ title: 'Error al exportar', description: error, variant: 'destructive' });
        return;
      }
      const registros = (data || []).map((row) =>
        mapApiRowToRegistroMRV(row as Record<string, unknown>)
      );
      if (!registros.length) {
        toast({
          title: 'Sin registros',
          description: 'No hay visitas en la base para exportar.',
          variant: 'destructive',
        });
        return;
      }
      downloadRegistrosExcel(registros, 'Nominal_MRV', {
        total: total ?? registros.length,
        nota: 'Exportación nacional completa desde Aiven. Coordenadas WGS84 (lat/long), coordenadas_wgs84 y enlace_google_maps para análisis y mapas.',
      });
      toast({
        title: 'Excel generado',
        description: `${registros.length} registros con GPS y campos de análisis.`,
      });
    } finally {
      setExportingNominal(false);
    }
  };

  const searchPersonaByCi = async (ci: string) => {
    const q = ci.trim();
    if (!q || q.length < 2) {
      setCiResults([]);
      return;
    }
    setSearchingCi(true);
    try {
      const rows = await dataService.getBasePersonas(q, { limit: 15 });
      setCiResults(
        rows.map(
          (p): PersonaRow => ({
            id: p.id ?? p.documento,
            created_at: '',
            distrito: p.distrito,
            documento: p.documento,
            documento_madre: p.documento_madre,
            fecha_nacimiento: p.fecha_nacimiento,
            nombre: p.nombre,
            nombre_madre: p.nombre_madre,
            region_sanitaria: p.region_sanitaria,
            servicio_salud: p.servicio_salud,
            sexo: p.sexo,
            tipo_documento: p.tipo_documento,
          })
        )
      );
    } catch (err) {
      console.error('Search error:', err);
      setCiResults([]);
    } finally {
      setSearchingCi(false);
    }
  };

  const exportUsersExcel = () => {
    const rowsToExport = profiles.map((p) => ({
      Nombre: p.display_name || '',
      Email: p.email || '',
      Usuario: p.username || '',
      Region: p.assigned_region || '',
      Distrito: p.assigned_distrito || '',
      Servicio: p.assigned_servicio || '',
      Barrio: p.assigned_barrio || '',
      Activo: p.is_active ? 'Sí' : 'No',
      Aprobado: p.is_approved ? 'Sí' : 'No',
      Alcance_Bloqueado: p.scope_locked ? 'Sí' : 'No',
    }));
    const ws = XLSX.utils.json_to_sheet(rowsToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Usuarios');
    XLSX.writeFile(wb, `Usuarios_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const deleteUser = async (userId: string, displayName: string) => {
    if (!isSuperAdmin) {
      toast({ title: 'Solo super admin puede eliminar usuarios', variant: 'destructive' });
      return;
    }
    if (currentUser?.id === userId) {
      toast({ title: 'No puedes eliminar tu propio usuario', variant: 'destructive' });
      return;
    }
    if (!window.confirm(`¿Eliminar usuario "${displayName}"? Esta acción no se puede deshacer y eliminará todos sus registros.`)) return;
    setDeletingUserId(userId);
    try {
      const errMsg = await adminApi.deleteUserCompletely(userId);
      const error = errMsg ? { message: errMsg } : null;
      setDeletingUserId(null);
      if (error) {
        toast({ title: 'Error al eliminar usuario', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Usuario eliminado exitosamente' });
        await loadUsersAndRoles();
      }
    } catch {
      setDeletingUserId(null);
      toast({ title: 'Error inesperado al eliminar usuario', variant: 'destructive' });
    }
  };

  const handleImportUsersFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(new Uint8Array(evt.target?.result as ArrayBuffer), { type: 'array', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' }) as any[];
        if (!json.length) throw new Error('Sin filas');

        // Filtrar filas completamente vacías ANTES de procesar
        const nonEmptyRows = json.filter((row) => {
          const values = Object.values(row).map(v => String(v).trim());
          return values.some(v => v.length > 0);
        });

        if (!nonEmptyRows.length) throw new Error('No hay datos en el archivo');

        const parsed: ImportedUser[] = nonEmptyRows.map(row => {
          const keys = Object.keys(row);
          const map = new Map(keys.map((k) => [normalizeHeader(k), k]));

          const keyCI = map.get('documento') || map.get('ci') || map.get('cedula') || keys[0];
          const keyNombres =
            map.get('nombre_completo') ||
            map.get('nombres_completos') ||
            map.get('nombre') ||
            keys[1];
          const keyUsuario =
            map.get('nombre_de_usuario') ||
            map.get('nombre_usuario') ||
            map.get('usuario') ||
            keys[2];
          const keyRegion = map.get('region_sanitaria') || map.get('region') || keys[3];
          const keyDistrito = map.get('distrito') || keys[4];
          const keyServicio =
            map.get('servicio_vacunatorio') ||
            map.get('servicio') ||
            map.get('servicio_salud') ||
            keys[5];
          const keyFechaNac = map.get('fecha_nacimiento');

          const ci = String(row[keyCI] || '').replace(/\D/g, '').trim() || String(row[keyCI] || '').trim();
          const nombres = String(row[keyNombres] || '').trim();
          const fecha = keyFechaNac ? parseDate(row[keyFechaNac]) : null;

          return {
            ci,
            nombres_completos: nombres,
            nombre_usuario: String(row[keyUsuario] || ci).trim().toLowerCase(),
            assigned_region: String(row[keyRegion] || '').trim(),
            assigned_distrito: String(row[keyDistrito] || '').trim(),
            assigned_servicio: String(row[keyServicio] || '').trim(),
            fecha_nacimiento: fecha || undefined,
          };
        }).filter(r => r.ci && r.nombres_completos);

        if (!parsed.length) throw new Error('No hay usuarios válidos con CI y nombre completo');

        setImportedUsers(parsed);
        setStatusImportUsers('parsed');
        toast({ title: `${parsed.length} usuarios detectados`, description: file.name });
      } catch (err) {
        toast({ title: 'Error al leer archivo de usuarios', description: err instanceof Error ? err.message : 'Error desconocido', variant: 'destructive' });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportUsers = async () => {
    if (!importedUsers.length) return;
    setUploadingUsers(true);
    setStatusImportUsers('uploading');

    const payload = importedUsers.map((user) => ({
      ci: String(user.ci || '').trim(),
      nombres_completos: String(user.nombres_completos || '').trim(),
      nombre_usuario: String(user.nombre_usuario || user.ci || '').trim().toLowerCase(),
      assigned_region: String(user.assigned_region || '').trim(),
      assigned_distrito: String(user.assigned_distrito || '').trim(),
      assigned_servicio: String(user.assigned_servicio || '').trim(),
      fecha_nacimiento: String(user.fecha_nacimiento || '').trim(),
    }));

    try {
      const result = await adminApi.importUsersBatch(payload, { replace: replaceUsersOnImport });
      setUploadingUsers(false);
      setImportedUsers([]);

      if (result.error) {
        console.error('Import users error:', result.error);
        setStatusImportUsers('error');
        toast({
          title: 'Error en importación de usuarios',
          description: result.error,
          variant: 'destructive',
        });
        return;
      }
      setStatusImportUsers(result.errors === 0 && result.created > 0 ? 'done' : 'error');
      toast({
        title: result.errors === 0 ? 'Usuarios importados exitosamente' : 'Importación con errores',
        description: `Creados: ${result.created || 0}, actualizados: ${result.updated || 0}, desactivados: ${result.deactivated || 0}, errores: ${result.errors || 0}`,
        variant: result.errors === 0 ? 'default' : 'destructive',
      });
    } catch (err) {
      console.error('Error invoking import function:', err);
      setUploadingUsers(false);
      setStatusImportUsers('error');
      toast({
        title: 'Error inesperado al importar usuarios',
        description: err instanceof Error ? err.message : 'Revise la consola',
        variant: 'destructive',
      });
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast({
        title: 'Archivo de nómina muy grande',
        description:
          'Para «Nómina de Niños para MRV.xlsx» (~130 MB) ejecute en la carpeta del proyecto: npm run import:mrv-nomina (requiere SUPABASE_SERVICE_ROLE_KEY en .env).',
        variant: 'destructive',
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(new Uint8Array(evt.target?.result as ArrayBuffer), { type: 'array', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' }) as any[];
        if (!json.length) throw new Error('Sin filas');
        
        // Filtrar filas completamente vacías ANTES de procesar
        const nonEmptyRows = json.filter((row) => {
          const values = Object.values(row).map(v => String(v).trim());
          return values.some(v => v.length > 0);
        });
        
        if (!nonEmptyRows.length) throw new Error('No hay datos en el archivo');
        
        const parsed: ParsedRow[] = nonEmptyRows
          .map((row) => {
            const p = mapPersonaImportRow(row as Record<string, unknown>);
            return {
              nombre: p.nombre,
              tipo_documento: p.tipo_documento,
              documento: p.documento,
              fecha_nacimiento: p.fecha_nacimiento,
              sexo: p.sexo || null,
              region_sanitaria: p.region_sanitaria || null,
              distrito: p.distrito || null,
              servicio_salud: p.servicio_salud || null,
              documento_madre: p.documento_madre || null,
              nombre_madre: p.nombre_madre || null,
            };
          })
          .filter((r) => r.nombre && r.documento);
        
        if (!parsed.length) throw new Error('No hay registros válidos con nombre y documento');
        
        setRows(parsed);
        setStatus('parsed');
        toast({ title: `${parsed.length} registros detectados`, description: file.name });
      } catch (err) {
        toast({ title: 'Error al leer archivo', description: err instanceof Error ? err.message : 'Error desconocido', variant: 'destructive' });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const normalizeKey = (v: string) =>
    (v || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

  const handleOrgFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(new Uint8Array(evt.target?.result as ArrayBuffer), { type: 'array', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' }) as any[];
        if (!json.length) throw new Error('Sin filas');

        // Filtrar filas completamente vacías ANTES de procesar
        const nonEmptyRows = json.filter((row) => {
          const values = Object.values(row).map(v => String(v).trim());
          return values.some(v => v.length > 0);
        });

        if (!nonEmptyRows.length) throw new Error('No hay datos en el archivo');

        const parsed: OrgRow[] = nonEmptyRows.map((row) => {
          const keys = Object.keys(row);
          const keyMap = new Map(keys.map((k) => [normalizeHeader(k), k]));
          const regionKey = keyMap.get('region') || keyMap.get('region_sanitaria');
          const distritoKey = keyMap.get('distrito');
          const servicioKey = keyMap.get('servicio_salud') || keyMap.get('servicio_de_salud') || keyMap.get('servicio');
          const barrioKey = keyMap.get('barrio') || keyMap.get('localidad');

          if (regionKey && distritoKey && servicioKey) {
            return {
              region: String(row[regionKey] || '').trim(),
              distrito: String(row[distritoKey] || '').trim(),
              servicio: String(row[servicioKey] || '').trim(),
              barrio: barrioKey ? String(row[barrioKey] || '').trim() : '',
            };
          }

          return {
            region: String(row[keys[0]] || '').trim(),
            distrito: String(row[keys[1]] || '').trim(),
            servicio: String(row[keys[2]] || '').trim(),
            barrio: String(row[keys[3]] || '').trim(),
          };
        }).filter((r) => r.region && r.distrito && r.servicio);

        if (!parsed.length) throw new Error('No hay filas válidas con región, distrito y servicio');

        setOrgRows(parsed);
        setOrgStatus('parsed');
        toast({ title: `${parsed.length} filas de unidades detectadas`, description: file.name });
      } catch (err) {
        setOrgStatus('error');
        toast({ title: 'Error al leer archivo de unidades', description: err instanceof Error ? err.message : 'Error desconocido', variant: 'destructive' });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleOrgUpload = async () => {
    if (!orgRows.length) return;
    if (!window.confirm('Se reemplazará la estructura completa (Región, Distrito y Servicio) con el archivo cargado. ¿Desea continuar?')) {
      return;
    }
    setUploadingOrg(true);
    setOrgStatus('uploading');
    try {
      const errMsg = await adminApi.importOrgRows(orgRows);
      if (errMsg) throw new Error(errMsg);
      setOrgStatus('done');
      toast({ title: 'Unidades organizativas cargadas y depuradas correctamente' });
      window.location.reload();
    } catch {
      setOrgStatus('error');
      toast({ title: 'Error al guardar unidades organizativas', variant: 'destructive' });
    } finally {
      setUploadingOrg(false);
    }
  };

  const handleUpload = async () => {
    if (!rows.length) return;
    setUploading(true);
    setStatus('uploading');
    let inserted = 0, errors = 0;
    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const errMsg = await adminApi.importPadronBatch(
        batch.map((r) => ({
          nombre: r.nombre,
          tipo_documento: r.tipo_documento,
          documento: r.documento,
          fecha_nacimiento: r.fecha_nacimiento,
          sexo: r.sexo,
          region_sanitaria: r.region_sanitaria,
          distrito: r.distrito,
          servicio_salud: r.servicio_salud,
          documento_madre: r.documento_madre,
          nombre_madre: r.nombre_madre,
        }))
      );
      if (errMsg) {
        console.error(errMsg);
        errors += batch.length;
      } else inserted += batch.length;
    }
    setStats({ total: rows.length, inserted, errors });
    setStatus(errors === 0 ? 'done' : 'error');
    setUploading(false);
    toast({ title: errors === 0 ? 'Importación exitosa' : 'Importación con errores', description: `${inserted} insertados, ${errors} con error`, variant: errors > 0 ? 'destructive' : 'default' });
  };

  const filteredNominal = useMemo(() => {
    const q = qNominal.trim().toLowerCase();
    if (!q) return nominal;
    return nominal.filter((r) =>
      [r.nombre, r.documento, r.region, r.distrito, r.servicio, r.responsable].some((v) =>
        (v || '').toLowerCase().includes(q)
      )
    );
  }, [nominal, qNominal]);

  const manualUserDistritos = useMemo(() => {
    const reg = regiones.find((r) => r.nombre === manualUser.region);
    return reg ? getDistritosByRegion(reg.id) : [];
  }, [regiones, manualUser.region, getDistritosByRegion]);

  const manualUserServicios = useMemo(() => {
    const dis = manualUserDistritos.find((d) => d.nombre === manualUser.distrito);
    return dis ? getServiciosByDistrito(dis.id) : [];
  }, [manualUserDistritos, manualUser.distrito, getServiciosByDistrito]);

  const [adminTab, setAdminTab] = useState<'users' | 'import' | 'nominal' | 'search' | 'monitoreo' | 'rondas'>('users');
  const [casasPorModulo, setCasasPorModulo] = useState(() => getRoundConfig().casasPorModulo);

  const nominalAutoLoadRef = useRef(false);
  useEffect(() => {
    if (adminTab !== 'nominal' || (!isAdmin && !isSuperAdmin)) return;
    if (nominalAutoLoadRef.current) return;
    nominalAutoLoadRef.current = true;
    void loadNominal();
  }, [adminTab, isAdmin, isSuperAdmin]);

  const handleClear = async () => {
    if (!window.confirm('Esto eliminará todos los registros de la base de personas. ¿Continuar?')) return;
    setUploading(true);
    const errMsg = await adminApi.clearPadron();
    setUploading(false);
    if (errMsg) toast({ title: 'Error al limpiar', description: errMsg, variant: 'destructive' });
    else toast({ title: 'Base de personas limpiada' });
  };

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4">
      <h2 className="text-xl font-black flex items-center gap-2">
        <Users className="w-6 h-6 text-primary" />
        Administración · M R V (PNEI / PAI)
      </h2>
      <p className="text-xs text-muted-foreground -mt-2">
        {profiles.length} usuarios ·{' '}
        {nominal.length > 0
          ? `${nominal.length} registros${
              nominalSources?.supabase
                ? ` (Aiven ${nominalSources.aiven ?? 0} + Supabase ${nominalSources.supabase})`
                : ''
            }`
          : nominalSources?.supabase
            ? `0 visibles · ${nominalSources.supabase} en Supabase (sincronizá la API)`
            : `${nominal.length} registros`}
      </p>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(['users', 'import', 'nominal', 'rondas', 'search', 'monitoreo'] as const)
          .filter((id) => id !== 'rondas' || isAdmin || isSuperAdmin)
          .map((id) => (
          <button key={id} type="button" onClick={() => setAdminTab(id)}
            className={`shrink-0 h-9 px-4 rounded-xl text-xs font-bold ${adminTab === id ? 'bg-primary text-primary-foreground shadow' : 'bg-secondary'}`}>
            {id === 'users'
              ? 'Usuarios'
              : id === 'import'
                ? 'Importar'
                : id === 'nominal'
                  ? 'Registros'
                  : id === 'rondas'
                    ? 'Rondas'
                    : id === 'search'
                      ? 'Buscar'
                      : 'Croquis'}
          </button>
        ))}
      </div>

      {(isAdmin || isSuperAdmin) && adminTab === 'users' && (
      <div className="section-card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-primary uppercase tracking-wide">Usuarios y Roles</h3>
          <div className="flex gap-2">
            <button onClick={exportUsersExcel} disabled={!profiles.length}
              className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50 flex items-center gap-1">
              <Download className="w-3.5 h-3.5" /> Excel
            </button>
            <button onClick={syncProfilesIdentity} disabled={syncingProfiles}
              className="h-8 px-3 rounded-lg bg-secondary text-secondary-foreground text-xs font-bold disabled:opacity-50">
              {syncingProfiles ? 'Sincronizando...' : 'Sincronizar usuarios'}
            </button>
            <button onClick={loadUsersAndRoles} disabled={loadingUsers}
              className="h-8 px-3 rounded-lg bg-secondary text-secondary-foreground text-xs font-bold disabled:opacity-50">
              {loadingUsers ? 'Cargando...' : 'Actualizar'}
            </button>
          </div>
        </div>
        {(isAdmin || isSuperAdmin) && (
          <p className="text-[11px] text-muted-foreground border-l-2 border-primary/40 pl-2">
            <span className="font-semibold text-foreground">Roles:</span>{' '}
            {isSuperAdmin
              ? 'Podés asignar todos los roles (brigadista, moderador, regional, supervisor nacional, admin, super admin).'
              : 'Podés asignar brigadista, moderador, supervisor regional, supervisor nacional y administrador.'}
          </p>
        )}
        <p className="text-[11px] text-muted-foreground leading-relaxed border-l-2 border-primary/40 pl-2">
          Los datos de esta grilla vienen de la tabla public.profiles. El listado de Authentication en Supabase
          es distinto: si alguien solo existe allí, no aparece acá hasta tener fila de perfil. Tras desplegar la app,
          un primer inicio de sesión en la web crea ese perfil automáticamente. Para cuentas creadas solo desde
          Authentication, podés ejecutar en SQL Editor el script PERFILES_DESDE_AUTH_USUARIOS.sql del proyecto.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={userListFilter}
            onChange={(e) => setUserListFilter(e.target.value as 'all' | 'approved_active')}
            className="h-9 px-2 rounded-lg border bg-background text-xs font-medium shrink-0"
            title="Qué usuarios listar"
          >
            <option value="all">Todos los perfiles cargados</option>
            <option value="approved_active">Solo aprobados y activos</option>
          </select>
          <p className="text-[11px] text-muted-foreground sm:ml-auto">
            {filteredProfiles.length} de {profiles.length} perfiles
          </p>
        </div>
        <input
          value={qUsers}
          onChange={(e) => setQUsers(e.target.value)}
          placeholder="Buscar por nombre, usuario, email, región o distrito..."
          className="w-full h-9 px-3 rounded-lg border bg-background text-xs"
        />
        <div className="max-h-72 overflow-y-auto border rounded-lg">
          {filteredProfiles.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3">Sin usuarios cargados.</p>
          ) : (
            <div className="divide-y">
              {filteredProfiles.map((p) => (
                <div key={p.user_id} className="p-2.5 text-xs flex items-center gap-2">
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-semibold text-foreground truncate">{p.display_name || p.username || p.email || 'Sin nombre'}</p>
                    {(p.username || p.email) ? (
                      <p className="text-muted-foreground truncate">
                        {p.username ? `@${p.username}` : ''}{p.username && p.email ? ' — ' : ''}{p.email || ''}
                      </p>
                    ) : (
                      <p className="text-muted-foreground truncate">Sin usuario/email (requiere sincronización de perfiles)</p>
                    )}
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.is_approved ? 'bg-success/10 text-success' : 'bg-warning/15 text-warning-foreground'}`}>
                        {p.is_approved ? 'Aprobado' : 'Pendiente'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.is_active ? 'bg-secondary text-secondary-foreground' : 'bg-destructive/10 text-destructive'}`}>
                        {p.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                      {p.has_credentials === false && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-warning/15 text-warning-foreground" title="Sin contraseña en el sistema — use Reset clave">
                          Sin clave
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {(() => {
                        const selectedRegion = regiones.find(
                          (r) => normalizeKey(r.nombre) === normalizeKey(scopeDraft[p.user_id]?.assigned_region || '')
                        );
                        const distritosOpciones = selectedRegion ? getDistritosByRegion(selectedRegion.id) : [];
                        const selectedDistrito = distritosOpciones.find(
                          (d) => normalizeKey(d.nombre) === normalizeKey(scopeDraft[p.user_id]?.assigned_distrito || '')
                        );
                        const serviciosOpciones = selectedDistrito ? getServiciosByDistrito(selectedDistrito.id) : [];
                        const barriosOpciones = selectedDistrito ? getBarriosByDistrito(selectedDistrito.id) : [];
                        const barriosDatalistId = `barrios-scope-${p.user_id}`;

                        return (
                          <>
                            <select
                              value={scopeDraft[p.user_id]?.assigned_region || ''}
                              onChange={(e) => {
                                updateScopeDraft(p.user_id, {
                                  assigned_region: e.target.value,
                                  assigned_distrito: '',
                                  assigned_servicio: '',
                                  assigned_barrio: '',
                                });
                              }}
                              className="h-7 px-2 rounded border bg-background text-[11px]"
                              title="Región fija"
                            >
                              <option value="">Región fija</option>
                              {regiones.map((r) => (
                                <option key={r.id} value={r.nombre}>{r.nombre}</option>
                              ))}
                            </select>

                            <select
                              value={scopeDraft[p.user_id]?.assigned_distrito || ''}
                              onChange={(e) => {
                                updateScopeDraft(p.user_id, {
                                  assigned_distrito: e.target.value,
                                  assigned_servicio: '',
                                  assigned_barrio: '',
                                });
                              }}
                              className="h-7 px-2 rounded border bg-background text-[11px]"
                              title="Distrito fijo"
                              disabled={!selectedRegion}
                            >
                              <option value="">Distrito fijo</option>
                              {distritosOpciones.map((d) => (
                                <option key={d.id} value={d.nombre}>{d.nombre}</option>
                              ))}
                            </select>

                            <select
                              value={scopeDraft[p.user_id]?.assigned_servicio || ''}
                              onChange={(e) => updateScopeDraft(p.user_id, { assigned_servicio: e.target.value })}
                              className="h-7 px-2 rounded border bg-background text-[11px]"
                              title="Servicio fijo"
                              disabled={!selectedDistrito}
                            >
                              <option value="">Servicio fijo</option>
                              {serviciosOpciones.map((s) => (
                                <option key={s.id} value={s.nombre}>{s.nombre}</option>
                              ))}
                            </select>

                            <input
                              value={scopeDraft[p.user_id]?.assigned_barrio || ''}
                              onChange={(e) => updateScopeDraft(p.user_id, { assigned_barrio: e.target.value })}
                              className="h-7 px-2 rounded border bg-background text-[11px]"
                              placeholder="Barrio fijo"
                              title="Barrio fijo (editable)"
                              disabled={!selectedDistrito}
                              list={barriosDatalistId}
                            />
                            {barriosOpciones.length > 0 && (
                              <datalist id={barriosDatalistId}>
                                {barriosOpciones.map((b) => (
                                  <option key={b.id} value={b.nombre} />
                                ))}
                              </datalist>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    <label className="inline-flex items-center gap-1 text-[11px]">
                      <input
                        type="checkbox"
                        checked={Boolean(scopeDraft[p.user_id]?.scope_locked)}
                        onChange={(e) => updateScopeDraft(p.user_id, { scope_locked: e.target.checked })}
                      />
                      Bloquear alcance (solo barrio/ubicación asignada)
                    </label>
                  </div>
                  <div className="flex flex-col gap-1">
                    {canManageUserRoles({ isSuperAdmin, isAdmin }) &&
                    canChangeTargetRole({ isSuperAdmin, isAdmin }, roleByUser.get(p.user_id)) ? (
                      <select
                        value={roleByUser.get(p.user_id) || 'user'}
                        onChange={(e) => setPrimaryRole(p.user_id, e.target.value as AppRole)}
                        disabled={savingRoleFor === p.user_id}
                        className="h-8 px-2 rounded border bg-background text-xs font-medium"
                        title="Asignar rol"
                      >
                        {assignableRoles.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className="h-8 px-2 flex items-center text-[11px] text-muted-foreground border rounded bg-muted/30"
                        title={
                          roleByUser.get(p.user_id) === 'super_admin' && !isSuperAdmin
                            ? 'Solo super admin puede editar este rol'
                            : undefined
                        }
                      >
                        {ROLE_LABELS[roleByUser.get(p.user_id) || 'user']}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => saveUserScope(p.user_id)}
                      disabled={savingScopeFor === p.user_id}
                      className="h-8 px-2 rounded bg-primary text-primary-foreground text-[11px] font-semibold disabled:opacity-50"
                    >
                      {savingScopeFor === p.user_id ? 'Guardando...' : 'Guardar alcance'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserApproval(p.user_id, !p.is_approved)}
                      disabled={savingScopeFor === p.user_id}
                      className="h-8 px-2 rounded bg-secondary text-secondary-foreground text-[11px] font-semibold disabled:opacity-50"
                      title="Aprobar o revocar aprobación"
                    >
                      {p.is_approved ? 'Revocar' : 'Aprobar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserActive(p.user_id, !p.is_active)}
                      disabled={savingScopeFor === p.user_id}
                      className="h-8 px-2 rounded bg-secondary text-secondary-foreground text-[11px] font-semibold disabled:opacity-50"
                      title="Activar/Inactivar usuario"
                    >
                      {p.is_active ? 'Inactivar' : 'Activar'}
                    </button>
                    {(isAdmin || isSuperAdmin) && (
                      <button
                        type="button"
                        onClick={() => resetPasswordByDefault(p.user_id)}
                        disabled={resettingPasswordFor === p.user_id}
                        className="h-8 px-2 rounded bg-secondary text-secondary-foreground text-[11px] font-semibold disabled:opacity-50"
                        title={p.has_credentials === false ? 'Crear contraseña de acceso (usuario sin clave)' : 'Resetear contraseña por defecto'}
                      >
                        {resettingPasswordFor === p.user_id
                          ? 'Reseteando...'
                          : p.has_credentials === false
                            ? 'Crear clave'
                            : 'Reset clave'}
                      </button>
                    )}
                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => deleteUser(p.user_id, p.display_name || p.username || p.email || 'Usuario')}
                        disabled={deletingUserId === p.user_id}
                        className="h-8 px-2 rounded bg-destructive text-destructive-foreground text-[11px] font-semibold disabled:opacity-50"
                        title="Eliminar usuario"
                      >
                        {deletingUserId === p.user_id ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {adminTab === 'search' && (
      <div className="section-card space-y-3">
        <h3 className="text-sm font-bold text-primary uppercase tracking-wide flex items-center gap-2">
          <Search className="w-4 h-4" />
          Buscar Personas (Cédula, Nombre o Apellido)
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Busque rápidamente en la base de personas por cédula, nombre completo, primer nombre o primer apellido. Útil para verificar duplicados y crear nuevos usuarios.
        </p>
        <div className="flex gap-2">
          <input
            value={ciSearch}
            onChange={(e) => {
              setCiSearch(e.target.value);
              
              if (ciSearchDebounceRef.current) clearTimeout(ciSearchDebounceRef.current);
              
              const value = e.target.value.trim();
              if (value.length < 2) {
                setCiResults([]);
                return;
              }
              
              // Debounce 250ms para búsqueda
              ciSearchDebounceRef.current = setTimeout(() => {
                searchPersonaByCi(value);
              }, 250);
            }}
            placeholder="Cédula, nombre, apellido..."
            className="flex-1 h-9 px-3 rounded-lg border bg-background text-xs"
          />
          <button
            onClick={() => ciSearch.trim() && searchPersonaByCi(ciSearch)}
            disabled={searchingCi || !ciSearch.trim()}
            className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50"
          >
            {searchingCi ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
        {ciResults.length > 0 && (
          <div className="border rounded-lg p-3 bg-accent/30 space-y-2 max-h-64 overflow-y-auto">
            <p className="text-xs font-semibold text-foreground flex items-center gap-2">
              ⚠️ {ciResults.length} resultado{ciResults.length === 1 ? '' : 's'} encontrado{ciResults.length === 1 ? '' : 's'}
              <span className="text-muted-foreground">(posibles duplicados)</span>
            </p>
            {ciResults.map((r) => (
              <div key={r.id} className="text-xs p-3 bg-background rounded border-l-4 border-warning space-y-1">
                <p className="font-bold text-foreground">{r.nombre}</p>
                <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                  <p><span className="font-semibold">Cédula:</span> {r.documento}</p>
                  <p><span className="font-semibold">Sexo:</span> {r.sexo || 'N/A'}</p>
                  <p className="col-span-2"><span className="font-semibold">F. Nac.:</span> {r.fecha_nacimiento || 'N/A'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {ciSearch.trim() && ciResults.length === 0 && !searchingCi && (
          <div className="text-xs text-success p-3 bg-success/10 rounded-lg flex items-center gap-2">
            <span>✓</span>
            <span>No está en el padrón de niños — puede registrar brigadista manual abajo</span>
          </div>
        )}

        <div className="rounded-xl border border-dashed p-3 space-y-2 bg-muted/20">
          <p className="text-xs font-bold text-primary">Registrar brigadista (no está en la nómina Excel)</p>
          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-2">
            <input
              value={manualUser.ci}
              onChange={(e) => setManualUser((s) => ({ ...s, ci: e.target.value.replace(/\D/g, '') }))}
              placeholder="Documento / CI"
              className="h-9 px-2 rounded-lg border bg-background text-xs"
            />
            <input
              value={manualUser.username}
              onChange={(e) => setManualUser((s) => ({ ...s, username: e.target.value.toLowerCase() }))}
              placeholder="Usuario (opcional, default CI)"
              className="h-9 px-2 rounded-lg border bg-background text-xs"
            />
            <input
              value={manualUser.nombre}
              onChange={(e) => setManualUser((s) => ({ ...s, nombre: upperText(e.target.value) }))}
              placeholder="Nombre completo"
              className="h-9 px-2 rounded-lg border bg-background text-xs mrv-field-text col-span-full"
            />
            <select
              value={manualUser.region}
              onChange={(e) => setManualUser((s) => ({ ...s, region: e.target.value, distrito: '', servicio: '' }))}
              className="h-9 px-2 rounded-lg border bg-background text-xs"
            >
              <option value="">Región…</option>
              {regiones.map((r) => (
                <option key={r.id} value={r.nombre}>
                  {r.nombre}
                </option>
              ))}
            </select>
            <select
              value={manualUser.distrito}
              onChange={(e) => setManualUser((s) => ({ ...s, distrito: e.target.value, servicio: '' }))}
              className="h-9 px-2 rounded-lg border bg-background text-xs"
              disabled={!manualUser.region}
            >
              <option value="">Distrito…</option>
              {manualUserDistritos.map((d) => (
                <option key={d.id} value={d.nombre}>
                  {d.nombre}
                </option>
              ))}
            </select>
            <select
              value={manualUser.servicio}
              onChange={(e) => setManualUser((s) => ({ ...s, servicio: e.target.value }))}
              className="h-9 px-2 rounded-lg border bg-background text-xs col-span-full"
              disabled={!manualUser.distrito}
            >
              <option value="">Servicio de salud…</option>
              {manualUserServicios.map((s) => (
                <option key={s.id} value={s.nombre}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={creatingManualUser || !manualUser.ci || !manualUser.nombre}
            onClick={async () => {
              const un = (manualUser.username || manualUser.ci).trim().toLowerCase();
              const email = `${un.replace(/[^a-z0-9._-]/g, '')}@mrv.import`;
              setCreatingManualUser(true);
              const { data, error } = await mrvBackend.createUser({
                email,
                username: un,
                displayName: manualUser.nombre,
                password: `Mrv${manualUser.ci.slice(-4).padStart(4, '0')}!`,
                assigned_region: manualUser.region || null,
                assigned_distrito: manualUser.distrito || null,
                assigned_servicio: manualUser.servicio || null,
                is_approved: true,
              });
              setCreatingManualUser(false);
              if (error) {
                toast({ title: 'No se pudo crear', description: error, variant: 'destructive' });
                return;
              }
              const payload = data as { password?: string; activated?: boolean; email?: string };
              toast({
                title: payload.activated ? 'Acceso activado' : 'Usuario creado',
                description: payload.activated
                  ? `Ya estaba en la lista; se generó clave: ${payload.password || '—'}. Login: ${payload.email || un}`
                  : `Clave temporal: ${payload.password || '—'}. Login: ${un} o ${email}`,
              });
              setManualUser({ ci: '', nombre: '', username: '', region: '', distrito: '', servicio: '' });
              await loadUsersAndRoles();
            }}
            className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50"
          >
            {creatingManualUser ? 'Creando…' : 'Crear usuario con asignación manual'}
          </button>
        </div>
      </div>
      )}

      {adminTab === 'import' && (
      <>
      <div className="section-card space-y-4">
        <h3 className="text-sm font-bold text-primary uppercase tracking-wide flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4" />
          Importar Usuarios (.xlsx)
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Excel «Listado de usuarios activos»: Documento, Nombre Completo, Nombre de Usuario (opcional), Región
          Sanitaria, Distrito, Servicio/Vacunatorio. Actualiza asignación de usuarios existentes y crea los nuevos con
          contraseña temporal. Opción reemplazar: desactiva brigadistas que no figuren en el archivo.
        </p>
        <label className="flex items-center gap-2 text-xs font-medium">
          <input
            type="checkbox"
            checked={replaceUsersOnImport}
            onChange={(e) => setReplaceUsersOnImport(e.target.checked)}
          />
          Reemplazar nómina (desactivar usuarios que no estén en el archivo)
        </label>
        <input ref={userFileRef} type="file" accept=".xlsx,.xls" onChange={handleImportUsersFile} className="hidden" title="Seleccionar archivo de usuarios" />
        <div className="flex gap-2">
          <button onClick={() => userFileRef.current?.click()} disabled={uploadingUsers}
            className="flex-1 h-11 rounded-xl bg-secondary text-secondary-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50">
            <Upload className="w-4 h-4" /> Seleccionar Archivo de Usuarios
          </button>
          <button onClick={handleImportUsers} disabled={uploadingUsers || importedUsers.length === 0}
            className="h-11 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50">
            {uploadingUsers ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          </button>
        </div>
        {statusImportUsers === 'parsed' && <p className="text-xs text-muted-foreground">{importedUsers.length} usuarios listos para importar.</p>}
        {statusImportUsers === 'done' && <p className="text-xs text-success font-medium">Usuarios importados correctamente.</p>}
        {statusImportUsers === 'uploading' && (
          <div className="flex items-center justify-center gap-2 py-3 text-primary">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs font-semibold">Importando usuarios...</span>
          </div>
        )}
      </div>

      <div className="section-card space-y-4">
        <h3 className="text-sm font-bold text-primary uppercase tracking-wide flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4" />
          Importar Regiones / Distritos / Servicios / Barrios
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Use «Unidad Organizativa para MRV.xlsx» (columnas: region, distrito, servicio_salud, barrio). Reemplaza todo el catálogo.
        </p>
        <input ref={orgFileRef} type="file" accept=".xlsx,.xls" onChange={handleOrgFile} className="hidden" title="Seleccionar archivo de unidades" />
        <div className="flex gap-2">
          <button onClick={() => orgFileRef.current?.click()} disabled={uploadingOrg}
            className="flex-1 h-11 rounded-xl bg-secondary text-secondary-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50">
            <Upload className="w-4 h-4" /> Seleccionar Archivo de Unidades
          </button>
          <button onClick={handleOrgUpload} disabled={uploadingOrg || orgRows.length === 0}
            className="h-11 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50">
            {uploadingOrg ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          </button>
        </div>
        {orgStatus === 'parsed' && <p className="text-xs text-muted-foreground">{orgRows.length} filas listas para cargar.</p>}
        {orgStatus === 'done' && <p className="text-xs text-success font-medium">Unidades organizativas cargadas correctamente.</p>}
      </div>

      <div className="section-card space-y-4">
        <h3 className="text-sm font-bold text-primary uppercase tracking-wide flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4" />
          Importar Base de Personas (.xlsx)
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Use «Nómina de Niños para MRV.xlsx» (nombre1/apellido1…, tipo_documento, documento, fecha_nacimiento, sexo, region_sanitaria, municipio o distrito, servicio_salud, madre_documento / madre_nombre…). Archivos &gt;25 MB: npm run import:mrv-nomina.
        </p>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" title="Seleccionar archivo Excel" />
        <div className="flex gap-2">
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50">
            <Upload className="w-4 h-4" /> Seleccionar Archivo
          </button>
          <button onClick={handleClear} disabled={uploading}
            className="h-12 px-4 rounded-xl bg-destructive text-destructive-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
            title="Limpiar base de personas">
            <Trash2 className="w-4 h-4" />
            <span className="sr-only">Limpiar base de personas</span>
          </button>
        </div>

        {status === 'parsed' && (
          <div className="space-y-3">
            <div className="bg-accent/50 rounded-lg p-3">
              <p className="text-sm font-semibold text-foreground">{rows.length} registros listos para importar</p>
              <div className="mt-2 max-h-40 overflow-y-auto text-xs space-y-1">
                {rows.slice(0, 5).map((r, i) => (
                  <div key={i} className="flex justify-between text-muted-foreground">
                    <span className="truncate flex-1">{r.nombre}</span>
                    <span className="ml-2">{r.documento}</span>
                  </div>
                ))}
                {rows.length > 5 && <p className="text-muted-foreground">... y {rows.length - 5} más</p>}
              </div>
            </div>
            <button onClick={handleUpload}
              className="w-full h-12 rounded-xl bg-success text-success-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform">
              <CheckCircle className="w-4 h-4" /> Confirmar Importación ({rows.length} registros)
            </button>
          </div>
        )}

        {status === 'uploading' && (
          <div className="flex items-center justify-center gap-2 py-4 text-primary">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-semibold">Importando datos...</span>
          </div>
        )}

        {(status === 'done' || status === 'error') && (
          <div className={`rounded-lg p-3 ${status === 'done' ? 'bg-success/10' : 'bg-destructive/10'}`}>
            <div className="flex items-center gap-2">
              {status === 'done' ? <CheckCircle className="w-5 h-5 text-success" /> : <AlertTriangle className="w-5 h-5 text-destructive" />}
              <span className="text-sm font-bold">
                {stats.inserted} registros importados{stats.errors > 0 && `, ${stats.errors} con error`}
              </span>
            </div>
          </div>
        )}
      </div>
      </>
      )}

      {adminTab === 'monitoreo' && (isAdmin || isSuperAdmin) && (
        <div className="section-card space-y-3">
          <h3 className="text-sm font-bold text-primary uppercase tracking-wide flex items-center gap-2">
            <LayoutGrid className="w-4 h-4" />
            Monitoreo por casas (croquis)
          </h3>
          <p className="text-xs text-muted-foreground">
            Cantidad de viviendas en el mapa tipo butacas. Los brigadistas registran niños por casa (sin evaluación CVS ni fechas de dosis).
          </p>
          <label className="field-label">Casas por módulo — valor por defecto al iniciar (máx. {MAX_CASAS_POR_MODULO})</label>
          <input
            type="number"
            min={4}
            max={MAX_CASAS_POR_MODULO}
            value={casasPorModulo}
            onChange={(e) => setCasasPorModulo(clampCasasPorModulo(Number(e.target.value) || 20))}
            className="w-full h-11 px-3 rounded-xl border bg-background text-base"
          />
          <button
            type="button"
            onClick={() => {
              setRoundConfig({ casasPorModulo });
              toast({ title: 'Configuración guardada', description: `${casasPorModulo} casas por módulo` });
            }}
            className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold"
          >
            Guardar configuración
          </button>
        </div>
      )}

      {adminTab === 'rondas' && (isAdmin || isSuperAdmin) && (
        <div className="section-card space-y-3">
          <h3 className="text-sm font-bold text-primary uppercase tracking-wide">Monitoreos · todo el país</h3>
          <p className="text-[10px] text-muted-foreground">
            Vista admin: todas las rondas cerradas. Filtrá por asignación o ID; los reportes se descargan por ronda.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Región"
              value={roundFilterRegion}
              onChange={(e) => setRoundFilterRegion(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border bg-background text-sm"
              aria-label="Filtrar rondas por región"
            />
            <input
              type="text"
              placeholder="Distrito"
              value={roundFilterDistrito}
              onChange={(e) => setRoundFilterDistrito(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border bg-background text-sm"
              aria-label="Filtrar rondas por distrito"
            />
            <input
              type="text"
              placeholder="Servicio de salud"
              value={roundFilterServicio}
              onChange={(e) => setRoundFilterServicio(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border bg-background text-sm"
              aria-label="Filtrar rondas por servicio"
            />
            <input
              type="text"
              placeholder="Responsable / encuestador"
              value={roundFilterResponsable}
              onChange={(e) => setRoundFilterResponsable(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border bg-background text-sm"
              aria-label="Filtrar rondas por responsable"
            />
          </div>
          <RoundHistoryPanel
            lazy={false}
            adminMode
            useAdminList
            groupByUser
            showIdSearch
            title="Historial de rondas (administración)"
            filters={{
              region: roundFilterRegion.trim() || undefined,
              distrito: roundFilterDistrito.trim() || undefined,
              servicio: roundFilterServicio.trim() || undefined,
              responsable: roundFilterResponsable.trim() || undefined,
              limit: 250,
            }}
          />
        </div>
      )}

      {adminTab === 'nominal' && (
      <div className="section-card space-y-3">
        {hasProfileScopeAssignment(myScope) && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs space-y-2">
            <p>
              <span className="font-bold text-primary">Vista zonal:</span>{' '}
              {myScope?.assigned_region} · {myScope?.assigned_distrito}
              {myScope?.assigned_servicio ? ` · ${myScope.assigned_servicio}` : ''}
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={nominalNationalView}
                onChange={(e) => {
                  setNominalNationalView(e.target.checked);
                  void loadNominal(e.target.checked);
                }}
              />
              Ver todo el país en este reporte
            </label>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-primary uppercase tracking-wide flex items-center gap-2">
            <Users className="w-4 h-4" />
            Reporte Nominal (Personas Registradas)
          </h3>
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              onClick={() => registrosFileRef.current?.click()}
              disabled={importingRegistros}
              className="h-9 px-3 rounded-lg border border-primary/40 text-primary text-xs font-bold flex items-center gap-1 disabled:opacity-50"
            >
              {importingRegistros ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Importar Excel
            </button>
            <button onClick={() => void loadNominal()} disabled={loadingNominal}
              className="h-9 px-3 rounded-lg bg-secondary text-secondary-foreground text-xs font-bold disabled:opacity-50">
              {loadingNominal ? 'Cargando...' : 'Actualizar'}
            </button>
            <button
              type="button"
              onClick={() => void exportNominalExcel()}
              disabled={exportingNominal || loadingNominal}
              className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1 disabled:opacity-50"
            >
              {exportingNominal ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}{' '}
              Excel completo
            </button>
          </div>
        </div>
        <input
          ref={registrosFileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleImportRegistrosExcel}
        />
        <p className="text-[10px] text-muted-foreground -mt-1">
          Usá el mismo formato que «MRV_Registros_*.xlsx» (export del panel). Tras importar se activa vista nacional para ver todos.
        </p>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={qNominal}
            onChange={(e) => setQNominal(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-lg border bg-background text-sm"
            placeholder="Buscar por nombre, CI, región, distrito..."
          />
        </div>
        <div className="max-h-80 overflow-y-auto border rounded-lg">
          {filteredNominal.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3">
              {nominalLoadError
                ? `Error: ${nominalLoadError}`
                : loadingNominal
                  ? 'Cargando registros...'
                  : hasProfileScopeAssignment(myScope) && !nominalNationalView
                    ? `Sin registros en ${myScope?.assigned_distrito || 'tu zona'}. Probá «Ver todo el país», otro período en el panel, o quitá la asignación en Región/distrito/servicio.`
                    : nominalSources?.supabase
                      ? `Hay ${nominalSources.supabase} registros en Supabase pero 0 en Aiven. En Vercel agregá SUPABASE_SERVICE_ROLE_KEY y redesplegá, o ejecutá: node scripts/sync-registros-supabase-to-aiven.mjs`
                      : 'Sin registros en la base. Verificá que los brigadistas hayan guardado con conexión o probá de nuevo.'}
            </p>
          ) : (
            <div className="divide-y">
              {filteredNominal.slice(0, 300).map((r) => (
                <div key={r.id} className="p-2.5 text-xs">
                  <p className="font-semibold text-foreground">{r.nombre} - CI: {r.documento}</p>
                  <p className="text-muted-foreground">{r.region} / {r.distrito} / {r.servicio || 'Sin servicio'}</p>
                  <p className="text-muted-foreground">{r.estado_vacunacion} | {r.fecha_hora ? formatFechaHoraPy(r.fecha_hora) : 'Sin fecha'}</p>
                  {r.observaciones?.includes('[Ronda ') && (
                    <p className="text-[10px] font-mono text-primary/80 mt-0.5">
                      {r.observaciones.match(/\[Ronda [^\]]+\]/)?.[0] ?? ''}
                    </p>
                  )}
                  {(isAdmin || isSuperAdmin) && (
                    <div className="mt-1.5 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openRegistroEdit(r)}
                        disabled={editingNominalId === r.id || deletingNominalId === r.id}
                        className="h-7 px-2 rounded bg-primary/10 text-primary text-[11px] font-semibold disabled:opacity-50"
                        title="Editar estado y motivo"
                      >
                        {editingNominalId === r.id ? 'Guardando...' : 'Editar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteNominal(r.id, r.nombre)}
                        disabled={deletingNominalId === r.id || editingNominalId === r.id}
                        className="h-7 px-2 rounded bg-destructive/10 text-destructive text-[11px] font-semibold disabled:opacity-50"
                        title="Eliminar registro"
                      >
                        {deletingNominalId === r.id ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      <RegistroEditDialog
        registro={registroEdit}
        saving={editingNominalId === registroEdit?.id}
        onClose={() => setRegistroEdit(null)}
        onSave={(patch) => void saveRegistroEdit(patch)}
      />
    </div>
  );
}