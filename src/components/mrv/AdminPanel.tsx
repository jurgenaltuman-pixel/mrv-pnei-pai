import { useState, useRef, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgStructure } from '@/hooks/useOrgStructure';
import { dataService } from '@/services/dataService';
import { Upload, FileSpreadsheet, Trash2, Loader2, CheckCircle, AlertTriangle, Users, Search, Download, X } from 'lucide-react';
import * as XLSX from 'xlsx';

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
  estado_vacuna: string;
  motivo: string | null;
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
  fecha_nacimiento: string;
  nombre_usuario: string;
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
}

interface UserRoleRow {
  user_id: string;
  role: 'super_admin' | 'admin' | 'moderator' | 'user';
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

export default function AdminPanel({ isSuperAdmin = false, isAdmin = false }: { isSuperAdmin?: boolean; isAdmin?: boolean }) {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const { regiones, getDistritosByRegion, getServiciosByDistrito, getBarriosByDistrito } = useOrgStructure();
  const fileRef = useRef<HTMLInputElement>(null);
  const orgFileRef = useRef<HTMLInputElement>(null);
  const userFileRef = useRef<HTMLInputElement>(null);
  const ciSearchDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [orgRows, setOrgRows] = useState<OrgRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadingOrg, setUploadingOrg] = useState(false);
  const [status, setStatus] = useState<'idle' | 'parsed' | 'uploading' | 'done' | 'error'>('idle');
  const [orgStatus, setOrgStatus] = useState<'idle' | 'parsed' | 'uploading' | 'done' | 'error'>('idle');
  const [stats, setStats] = useState({ total: 0, inserted: 0, errors: 0 });
  const [nominal, setNominal] = useState<NominalRow[]>([]);
  const [loadingNominal, setLoadingNominal] = useState(false);
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
  const [uploadingUsers, setUploadingUsers] = useState(false);
  const [statusImportUsers, setStatusImportUsers] = useState<'idle' | 'parsed' | 'uploading' | 'done' | 'error'>('idle');

  const loadUsersAndRoles = async () => {
    setLoadingUsers(true);
    try {
      const selectCols =
        'user_id, display_name, email, username, is_active, is_approved, approved_at, assigned_region, assigned_distrito, assigned_servicio, assigned_barrio, scope_locked';
      const pageSize = 1000;
      let from = 0;
      let profilesData: ProfileRow[] = [];
      let queryError: { message: string } | null = null;

      while (true) {
        const { data, error } = await supabase
          .from('profiles')
          .select(selectCols)
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) {
          queryError = error;
          break;
        }
        if (!data?.length) break;
        profilesData = profilesData.concat(data as ProfileRow[]);
        if (data.length < pageSize) break;
        from += pageSize;
        if (from > 100_000) break;
      }

      if (queryError && profilesData.length === 0) {
        const fallback = await supabase
          .from('profiles')
          .select('user_id, display_name, email, username, is_active, is_approved, approved_at')
          .order('created_at', { ascending: false })
          .range(0, pageSize - 1);
        if (!fallback.error && fallback.data?.length) {
          profilesData = fallback.data as ProfileRow[];
        }
      }

      let rolesAcc: UserRoleRow[] = [];
      from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .range(from, from + pageSize - 1);
        if (error || !data?.length) break;
        rolesAcc = rolesAcc.concat(data as UserRoleRow[]);
        if (data.length < pageSize) break;
        from += pageSize;
        if (from > 100_000) break;
      }

      setLoadingUsers(false);

      if (!profilesData.length) {
        setProfiles([]);
      } else {
        setProfiles(profilesData);

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

      setRoles(rolesAcc);
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
      const order = { super_admin: 4, admin: 3, moderator: 2, user: 1 };
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

  const setPrimaryRole = async (userId: string, role: UserRoleRow['role']) => {
    if (!isSuperAdmin && role === 'super_admin') {
      toast({ title: 'Solo super admin puede asignar ese rol', variant: 'destructive' });
      return;
    }
    setSavingRoleFor(userId);
    const { error: delErr } = await supabase.from('user_roles').delete().eq('user_id', userId);
    if (delErr) {
      setSavingRoleFor(null);
      toast({ title: 'No se pudo actualizar el rol', variant: 'destructive' });
      return;
    }
    const { error: insErr } = await supabase.from('user_roles').insert({ user_id: userId, role });
    setSavingRoleFor(null);
    if (insErr) {
      toast({ title: 'No se pudo asignar el rol', variant: 'destructive' });
      return;
    }
    toast({ title: 'Rol actualizado' });
    await loadUsersAndRoles();
  };

  const setUserApproval = async (userId: string, approved: boolean) => {
    if (!isAdmin && !isSuperAdmin) return;
    setSavingScopeFor(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ is_approved: approved })
      .eq('user_id', userId);
    setSavingScopeFor(null);
    if (error) {
      toast({ title: 'No se pudo actualizar aprobación', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: approved ? 'Usuario aprobado' : 'Aprobación revocada' });
    await loadUsersAndRoles();
  };

  const setUserActive = async (userId: string, active: boolean) => {
    if (!isAdmin && !isSuperAdmin) return;
    setSavingScopeFor(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: active })
      .eq('user_id', userId);
    setSavingScopeFor(null);
    if (error) {
      toast({ title: 'No se pudo actualizar estado', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: active ? 'Usuario activado' : 'Usuario inactivado' });
    await loadUsersAndRoles();
  };

  const resetPasswordByDefault = async (targetUserId: string) => {
    if (!isAdmin && !isSuperAdmin) return;
    setResettingPasswordFor(targetUserId);
    const { data, error } = await supabase.rpc('admin_reset_password', {
      target_user_id: targetUserId,
      temp_password: 'Cambio2026!',
    });
    if (error) {
      setResettingPasswordFor(null);
      toast({
        title: 'No se pudo resetear contraseña',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }
    setResettingPasswordFor(null);
    const password = (typeof data === 'string' && data) ? data : 'Cambio2026!';
    toast({
      title: 'Contraseña reseteada',
      description: `Clave temporal: ${password}. Se exigirá cambio al ingresar.`,
    });
  };

  const syncProfilesIdentity = async () => {
    if (!isAdmin && !isSuperAdmin) return;
    setSyncingProfiles(true);
    const { error } = await supabase.rpc('sync_profiles_identity');
    setSyncingProfiles(false);
    if (error) {
      toast({ title: 'No se pudo sincronizar perfiles', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Perfiles sincronizados', description: 'Se actualizaron email/username desde auth.users.' });
    await loadUsersAndRoles();
  };

  const deleteNominal = async (id: string, nombre: string) => {
    if (!isAdmin && !isSuperAdmin) return;
    if (!window.confirm(`¿Eliminar el registro de ${nombre}? Esta acción no se puede deshacer.`)) return;
    setDeletingNominalId(id);
    const { error } = await supabase
      .from('registros_vacunacion')
      .delete()
      .eq('id', id);
    setDeletingNominalId(null);
    if (error) {
      toast({ title: 'No se pudo eliminar el registro', description: error.message, variant: 'destructive' });
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

    const tryUpdate = async (payload: Record<string, any>) =>
      await supabase.from('profiles').update(payload as any).eq('user_id', userId);

    let { error } = await tryUpdate(basePayload);

    // Si faltan columnas en DB (migración no aplicada / cache), reintentamos sin esas llaves
    // para permitir guardar al menos lo disponible y mostrar guía clara.
    if (error) {
      const msg = String(error.message || '').toLowerCase();
      const missingCols: string[] = [];
      for (const col of ['assigned_region', 'assigned_distrito', 'assigned_servicio', 'assigned_barrio', 'scope_locked']) {
        if (msg.includes(col.toLowerCase())) missingCols.push(col);
      }

      if (msg.includes('could not find') || msg.includes('schema cache') || missingCols.length > 0) {
        const payload = { ...basePayload };
        missingCols.forEach((c) => { delete payload[c]; });
        // Si no detectamos la columna exacta, empezamos por la más común del error reportado.
        if (!missingCols.length && msg.includes('assigned_barrio')) delete payload.assigned_barrio;
        ({ error } = await tryUpdate(payload));

        if (!error) {
          setSavingScopeFor(null);
          toast({
            title: 'Alcance guardado parcialmente',
            description: 'Faltan columnas en Supabase. Ejecutá la migración de alcance (assigned_* / scope_locked) para habilitar todo.',
            variant: 'default',
          });
          await loadUsersAndRoles();
          return;
        }
      }
    }

    setSavingScopeFor(null);
    if (error) {
      toast({
        title: 'No se pudo guardar alcance del usuario',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'Alcance de usuario actualizado' });
    await loadUsersAndRoles();
  };

  const loadNominal = async () => {
    setLoadingNominal(true);
    const query = supabase
      .from('registros_vacunacion')
      .select('id, fecha_hora, region, distrito, servicio, barrio, responsable, nombre, documento, fecha_nacimiento, sexo, estado_vacunacion, motivo, tipo_vivienda, esquema_completo')
      .order('fecha_hora', { ascending: false })
      .limit(10000);

    let { data, error } = await query;
    if (error) {
      const message = String(error.message || '').toLowerCase();
      console.warn('Nominal report query failed, retrying without tipo_vivienda/esquema_completo:', error.message);

      if (message.includes('tipo_vivienda') || message.includes('esquema_completo') || message.includes('column')) {
        const fallback = await supabase
          .from('registros_vacunacion')
          .select('id, fecha_hora, region, distrito, servicio, barrio, responsable, nombre, documento, fecha_nacimiento, sexo, estado_vacunacion, motivo')
          .order('fecha_hora', { ascending: false })
          .limit(10000);
        data = fallback.data;
        error = fallback.error;
      }
    }

    setLoadingNominal(false);
    if (error) {
      console.error('Error cargando reporte nominal:', error);
      toast({ title: 'Error al cargar reporte nominal', description: error.message, variant: 'destructive' });
      return;
    }

    setNominal(((data || []) as NominalRow[]).map((row) => ({
      ...row,
      tipo_vivienda: (row as any).tipo_vivienda ?? null,
      esquema_completo: (row as any).esquema_completo ?? null,
    })));
  };

  const exportNominalExcel = () => {
    const rowsToExport = filteredNominal.map((r) => ({
      Fecha: r.fecha_hora ? new Date(r.fecha_hora).toLocaleString('es-PY') : '',
      Region: r.region || '',
      Distrito: r.distrito || '',
      Servicio: r.servicio || '',
      Barrio: r.barrio || '',
      Responsable: r.responsable || '',
      Nombre: r.nombre || '',
      Documento: r.documento || '',
      Fecha_Nacimiento: r.fecha_nacimiento || '',
      Sexo: r.sexo || '',
      Estado: r.estado_vacunacion || '',
      Motivo: r.motivo || '',
      Tipo_Vivienda: r.tipo_vivienda || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rowsToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ReporteNominal');
    XLSX.writeFile(wb, `Reporte_Nominal_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
      await supabase.from('registros_vacunacion').delete().eq('responsable_id', userId);
      await supabase.from('user_roles').delete().eq('user_id', userId);
      const { error } = await supabase.from('profiles').delete().eq('user_id', userId);
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

          const keyCI = map.get('ci') || keys[0];
          const keyNombres = map.get('nombres_completos') || map.get('nombre') || keys[1];
          const keyFechaNac = map.get('fecha_nacimiento') || keys[2];
          const keyUsuario = map.get('nombre_usuario') || map.get('nombre_de_usuario') || map.get('usuario') || keys[3];

          const ci = String(row[keyCI] || '').trim();
          const nombres = String(row[keyNombres] || '').trim();
          const fecha = parseDate(row[keyFechaNac]);

          return {
            ci,
            nombres_completos: nombres,
            fecha_nacimiento: fecha || '',
            nombre_usuario: String(row[keyUsuario] || ci).trim(),
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
      fecha_nacimiento: String(user.fecha_nacimiento || '').trim(),
      nombre_usuario: String(user.nombre_usuario || user.ci || '').trim(),
    }));

    try {
      const { data, error } = await supabase.functions.invoke('import-users', {
        body: JSON.stringify({ users: payload }),
        headers: { 'Content-Type': 'application/json' },
      });

      setUploadingUsers(false);
      setImportedUsers([]);

      if (error) {
        console.error('Import function error:', error);
        setStatusImportUsers('error');
        toast({
          title: 'Error en importación de usuarios',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      const result = (data as any) || {};
      setStatusImportUsers(result.errors === 0 && result.created > 0 ? 'done' : 'error');
      toast({
        title: result.errors === 0 ? 'Usuarios importados exitosamente' : 'Importación con errores',
        description: `Creados: ${result.created || 0}, omitidos: ${result.skipped || 0}, errores: ${result.errors || 0}`,
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
        
        const parsed: ParsedRow[] = nonEmptyRows.map(row => {
          const keys = Object.keys(row);
          const map = new Map(keys.map((k) => [normalizeHeader(k), k]));

          const keyNombre = map.get('nombre') || map.get('nombre_y_apellido') || map.get('nombres_y_apellidos') || keys[0];
          const keyTipoDoc = map.get('tipo_documento') || map.get('tipo_de_documento') || keys[1];
          const keyDocumento = map.get('documento') || map.get('cedula') || map.get('cedula_de_identidad') || keys[2];
          const keyFechaNac = map.get('fecha_nacimiento') || map.get('fecha_de_nacimiento') || keys[3];
          const keySexo = map.get('sexo') || keys[4];
          const keyRegion = map.get('region_sanitaria') || map.get('region') || map.get('region_sanitarias') || keys[5];
          const keyDistrito = map.get('distrito') || keys[6];
          const keyServicio = map.get('servicio_salud') || map.get('servicio_de_salud') || map.get('servicio') || keys[7];
          const keyDocMadre = map.get('documento_madre') || map.get('cedula_madre') || keys[8];
          const keyNomMadre = map.get('nombre_madre') || map.get('madre') || keys[9];

          return {
            nombre: String(row[keyNombre] || '').trim(),
            tipo_documento: String(row[keyTipoDoc] || 'CI').trim(),
            documento: String(row[keyDocumento] || '').trim(),
            fecha_nacimiento: parseDate(row[keyFechaNac]),
            sexo: String(row[keySexo] || '').trim() || null,
            region_sanitaria: String(row[keyRegion] || '').trim() || null,
            distrito: String(row[keyDistrito] || '').trim() || null,
            servicio_salud: String(row[keyServicio] || '').trim() || null,
            documento_madre: String(row[keyDocMadre] || '').trim() || null,
            nombre_madre: String(row[keyNomMadre] || '').trim() || null,
          };
        }).filter(r => r.nombre && r.documento);
        
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
      // Reemplazo total para limpiar mezclas previas.
      await supabase.from('barrios').delete().gt('id', 0);
      await supabase.from('servicios_salud').delete().gt('id', 0);
      await supabase.from('distritos').delete().gt('id', 0);
      await supabase.from('regiones_sanitarias').delete().gt('id', 0);

      const uniqueRegions = Array.from(new Set(orgRows.map((r) => r.region.trim())))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      const regionMap = new Map<string, number>();
      for (const regionName of uniqueRegions) {
        const { data: inserted } = await supabase
          .from('regiones_sanitarias')
          .insert({ nombre: regionName })
          .select('id, nombre')
          .single();
        if (inserted) regionMap.set(normalizeKey(inserted.nombre), inserted.id);
      }

      const distritoMap = new Map<string, number>();
      const uniqueDistritos = Array.from(
        new Set(
          orgRows.map((r) => `${normalizeKey(r.region)}||${r.distrito.trim()}`)
        )
      ).map((raw) => {
        const [regionKey, distritoName] = raw.split('||');
        return { regionKey, distritoName: distritoName.trim() };
      }).filter((x) => x.regionKey && x.distritoName);

      for (const item of uniqueDistritos) {
        const regionId = regionMap.get(item.regionKey);
        if (!regionId) continue;
        const { data: inserted } = await supabase
          .from('distritos')
          .insert({ nombre: item.distritoName, region_id: regionId })
          .select('id, nombre, region_id')
          .single();
        if (inserted) distritoMap.set(`${inserted.region_id}:${normalizeKey(inserted.nombre)}`, inserted.id);
      }

      const uniqueServicios = Array.from(
        new Set(
          orgRows.map((r) => `${normalizeKey(r.region)}||${normalizeKey(r.distrito)}||${r.servicio.trim()}`)
        )
      ).map((raw) => {
        const [regionKey, distritoKey, servicioName] = raw.split('||');
        return { regionKey, distritoKey, servicioName: servicioName.trim() };
      }).filter((x) => x.regionKey && x.distritoKey && x.servicioName);

      for (const item of uniqueServicios) {
        const regionId = regionMap.get(item.regionKey);
        if (!regionId) continue;
        const distritoId = distritoMap.get(`${regionId}:${item.distritoKey}`);
        if (!distritoId) continue;
        await supabase.from('servicios_salud').insert({ nombre: item.servicioName, distrito_id: distritoId });
      }

      const uniqueBarrios = Array.from(
        new Set(
          orgRows
            .filter((r) => Boolean(r.barrio))
            .map((r) => `${normalizeKey(r.region)}||${normalizeKey(r.distrito)}||${(r.barrio || '').trim()}`)
        )
      ).map((raw) => {
        const [regionKey, distritoKey, barrioName] = raw.split('||');
        return { regionKey, distritoKey, barrioName: barrioName.trim() };
      }).filter((x) => x.regionKey && x.distritoKey && x.barrioName);

      for (const item of uniqueBarrios) {
        const regionId = regionMap.get(item.regionKey);
        if (!regionId) continue;
        const distritoId = distritoMap.get(`${regionId}:${item.distritoKey}`);
        if (!distritoId) continue;
        await supabase.from('barrios').insert({ nombre: item.barrioName, distrito_id: distritoId });
      }

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
      const { error } = await supabase.from('base_personas').insert(
        batch.map(r => ({ nombre: r.nombre, tipo_documento: r.tipo_documento, documento: r.documento, fecha_nacimiento: r.fecha_nacimiento, sexo: r.sexo, region_sanitaria: r.region_sanitaria, distrito: r.distrito, servicio_salud: r.servicio_salud, documento_madre: r.documento_madre, nombre_madre: r.nombre_madre }))
      );
      if (error) { console.error(error); errors += batch.length; } else inserted += batch.length;
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

  const [adminTab, setAdminTab] = useState<'users' | 'import' | 'nominal' | 'search'>('users');

  const handleClear = async () => {
    if (!window.confirm('Esto eliminará todos los registros de la base de personas. ¿Continuar?')) return;
    setUploading(true);
    const { error } = await supabase.from('base_personas').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    setUploading(false);
    if (error) toast({ title: 'Error al limpiar', variant: 'destructive' });
    else toast({ title: 'Base de personas limpiada' });
  };

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4">
      <h2 className="text-xl font-black flex items-center gap-2">
        <Users className="w-6 h-6 text-primary" />
        Administración MRV
      </h2>
      <p className="text-xs text-muted-foreground -mt-2">{profiles.length} usuarios · {nominal.length} registros</p>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(['users', 'import', 'nominal', 'search'] as const).map((id) => (
          <button key={id} type="button" onClick={() => setAdminTab(id)}
            className={`shrink-0 h-9 px-4 rounded-xl text-xs font-bold ${adminTab === id ? 'bg-primary text-primary-foreground shadow' : 'bg-secondary'}`}>
            {id === 'users' ? 'Usuarios' : id === 'import' ? 'Importar' : id === 'nominal' ? 'Registros' : 'Buscar'}
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
                    <select
                      value={roleByUser.get(p.user_id) || 'user'}
                      onChange={(e) => setPrimaryRole(p.user_id, e.target.value as UserRoleRow['role'])}
                      disabled={savingRoleFor === p.user_id}
                      className="h-8 px-2 rounded border bg-background text-xs"
                      title="Asignar rol"
                    >
                      <option value="user">user</option>
                      <option value="moderator">moderator</option>
                      <option value="admin">admin</option>
                      <option value="super_admin">super_admin</option>
                    </select>
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
                        title="Resetear contraseña por defecto"
                      >
                        {resettingPasswordFor === p.user_id ? 'Reseteando...' : 'Reset clave'}
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
            <span>No hay registros - Disponible para crear nuevo usuario</span>
          </div>
        )}
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
          Suba un archivo Excel con columnas: CI, Nombres Completos, Fecha de Nacimiento, Nombre de Usuario.
          Se crearán nuevos usuarios automáticamente con contraseña temporal.
        </p>
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
          Suba un archivo Excel con columnas de Región, Distrito, Servicio y opcionalmente Barrio/Localidad
          (ej.: region, distrito, servicio_salud, barrio). Esta acción reemplaza el catálogo para dejarlo limpio y ordenado.
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
          Suba un archivo Excel con las columnas: Nombre, Tipo Documento, Documento, Fecha Nacimiento, Sexo, Región Sanitaria, Distrito, Servicio de Salud, Documento Madre, Nombre Madre.
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

      {adminTab === 'nominal' && (
      <div className="section-card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-primary uppercase tracking-wide flex items-center gap-2">
            <Users className="w-4 h-4" />
            Reporte Nominal (Personas Registradas)
          </h3>
          <div className="flex gap-2">
            <button onClick={loadNominal} disabled={loadingNominal}
              className="h-9 px-3 rounded-lg bg-secondary text-secondary-foreground text-xs font-bold disabled:opacity-50">
              {loadingNominal ? 'Cargando...' : 'Actualizar'}
            </button>
            <button onClick={exportNominalExcel} disabled={!filteredNominal.length}
              className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1 disabled:opacity-50">
              <Download className="w-3.5 h-3.5" /> Excel
            </button>
          </div>
        </div>
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
            <p className="text-xs text-muted-foreground p-3">Sin datos. Presione "Actualizar".</p>
          ) : (
            <div className="divide-y">
              {filteredNominal.slice(0, 300).map((r) => (
                <div key={r.id} className="p-2.5 text-xs">
                  <p className="font-semibold text-foreground">{r.nombre} - CI: {r.documento}</p>
                  <p className="text-muted-foreground">{r.region} / {r.distrito} / {r.servicio || 'Sin servicio'}</p>
                  <p className="text-muted-foreground">{r.estado_vacunacion} | {r.fecha_hora ? new Date(r.fecha_hora).toLocaleString('es-PY') : 'Sin fecha'}</p>
                  {(isAdmin || isSuperAdmin) && (
                    <div className="mt-1.5 flex justify-end">
                      <button
                        type="button"
                        onClick={() => deleteNominal(r.id, r.nombre)}
                        disabled={deletingNominalId === r.id}
                        className="h-7 px-2 rounded bg-destructive/10 text-destructive text-[11px] font-semibold disabled:opacity-50"
                        title="Eliminar registro nominal"
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
    </div>
  );
}