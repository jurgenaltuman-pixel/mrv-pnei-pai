import { useEffect, useMemo, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { useOrgStructure } from '@/hooks/useOrgStructure';

import { useToast } from '@/hooks/use-toast';

import { useRole } from '@/hooks/useRole';

import { USE_MRV_API, mrvApiFetch } from '@/lib/api-config';

import { supabase, isSupabaseEnabled } from '@/integrations/supabase/client';

import { MapPinned, Save, Loader2, Globe, ChevronDown, ChevronUp } from 'lucide-react';



interface Props {

  userId: string;

  initial: {

    region: string;

    distrito: string;

    servicio: string;

  };

  scopeLocked: boolean;

  onSaved: (next: { region: string; distrito: string; servicio: string }) => void;

}



export default function ProfileScopeEditor({ userId, initial, scopeLocked, onSaved }: Props) {

  const { toast } = useToast();

  const queryClient = useQueryClient();

  const { isAdmin, isSuperAdmin } = useRole();

  const { regiones, getDistritosByRegion, getServiciosByDistrito } = useOrgStructure();

  const puedeVistaNacional = isAdmin || isSuperAdmin;

  const [region, setRegion] = useState(initial.region);

  const [distrito, setDistrito] = useState(initial.distrito);

  const [servicio, setServicio] = useState(initial.servicio);

  const [saving, setSaving] = useState(false);



  const needsAssignment = !initial.region.trim() || !initial.distrito.trim();

  const [expanded, setExpanded] = useState(false);



  useEffect(() => {

    setRegion(initial.region);

    setDistrito(initial.distrito);

    setServicio(initial.servicio);

  }, [initial.region, initial.distrito, initial.servicio]);



  const regionId = useMemo(

    () => regiones.find((r) => r.nombre === region)?.id ?? null,

    [regiones, region]

  );

  const distritos = regionId ? getDistritosByRegion(regionId) : [];

  const distritoId = useMemo(

    () => distritos.find((d) => d.nombre === distrito)?.id ?? null,

    [distritos, distrito]

  );

  const servicios = distritoId ? getServiciosByDistrito(distritoId) : [];



  const resumenAsignacion = [region, distrito, servicio].filter(Boolean).join(' · ') || 'Sin asignación';



  const save = async () => {

    if (!region.trim() || !distrito.trim()) {

      toast({ title: 'Completá región y distrito', variant: 'destructive' });

      return;

    }

    setSaving(true);

    try {

      if (USE_MRV_API) {

        const { error } = await mrvApiFetch('/api/profiles/scope', {

          method: 'PATCH',

          body: JSON.stringify({

            assigned_region: region.trim(),

            assigned_distrito: distrito.trim(),

            assigned_servicio: servicio.trim() || null,

          }),

        });

        if (error) {

          toast({ title: 'No se guardó', description: error, variant: 'destructive' });

          return;

        }

      } else if (isSupabaseEnabled) {

        const { error } = await supabase

          .from('profiles')

          .update({

            assigned_region: region.trim(),

            assigned_distrito: distrito.trim(),

            assigned_servicio: servicio.trim() || null,

            scope_locked: false,

            updated_at: new Date().toISOString(),

          })

          .eq('user_id', userId);

        if (error) {

          toast({ title: 'No se guardó', description: error.message, variant: 'destructive' });

          return;

        }

      }

      onSaved({ region: region.trim(), distrito: distrito.trim(), servicio: servicio.trim() });

      void queryClient.invalidateQueries({ queryKey: ['registros-mrv'] });

      void queryClient.invalidateQueries({ queryKey: ['profile-scope-full'] });

      toast({ title: 'Asignación guardada' });

      setExpanded(false);

    } finally {

      setSaving(false);

    }

  };



  const quitarAsignacion = async () => {

    if (!puedeVistaNacional) return;

    setSaving(true);

    try {

      if (USE_MRV_API) {

        const { error } = await mrvApiFetch('/api/profiles/scope', {

          method: 'PATCH',

          body: JSON.stringify({

            assigned_region: '',

            assigned_distrito: '',

            assigned_servicio: '',

          }),

        });

        if (error) {

          toast({ title: 'No se pudo quitar la asignación', description: error, variant: 'destructive' });

          return;

        }

      } else if (isSupabaseEnabled) {

        const { error } = await supabase

          .from('profiles')

          .update({

            assigned_region: null,

            assigned_distrito: null,

            assigned_servicio: null,

            updated_at: new Date().toISOString(),

          })

          .eq('user_id', userId);

        if (error) {

          toast({ title: 'No se pudo quitar', description: error.message, variant: 'destructive' });

          return;

        }

      }

      setRegion('');

      setDistrito('');

      setServicio('');

      onSaved({ region: '', distrito: '', servicio: '' });

      void queryClient.invalidateQueries({ queryKey: ['registros-mrv'] });

      void queryClient.invalidateQueries({ queryKey: ['profile-scope-full'] });

      toast({ title: 'Vista nacional activada', description: 'Verás registros de todo el país en el panel y reportes.' });

      setExpanded(false);

    } finally {

      setSaving(false);

    }

  };



  if (!expanded) {

    return (

      <button

        type="button"

        onClick={() => setExpanded(true)}

        className={`mx-2.5 sm:mx-4 mt-2 w-[calc(100%-1.25rem)] sm:w-[calc(100%-2rem)] flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left ${

          needsAssignment ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/40'

        }`}

      >

        <span className="flex items-center gap-1.5 min-w-0 text-xs font-semibold text-primary">

          <MapPinned className="w-3.5 h-3.5 shrink-0" />

          <span className="truncate">{resumenAsignacion}</span>

        </span>

        <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden />

      </button>

    );

  }



  return (

    <div

      className={`mx-2.5 sm:mx-4 mt-2 rounded-xl border px-3 py-3 space-y-2 ${

        needsAssignment ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'

      }`}

    >

      <button

        type="button"

        onClick={() => setExpanded(false)}

        className="w-full flex items-center justify-between gap-2 text-left"

      >

        <p className="text-xs font-bold text-primary flex items-center gap-1.5 min-w-0">

          <MapPinned className="w-3.5 h-3.5 shrink-0" />

          <span className="truncate">
            {needsAssignment
              ? 'Definí tu zona de trabajo'
              : scopeLocked
                ? 'Tu asignación'
                : 'Región, distrito y servicio'}
          </span>

        </p>

        <ChevronUp className="w-4 h-4 shrink-0 text-muted-foreground" aria-label="Minimizar" />

      </button>

      <p className="text-[10px] text-muted-foreground leading-snug">
        {puedeVistaNacional
          ? 'Sin asignación: ves todo el país. Con asignación: solo tu zona en panel y reportes.'
          : scopeLocked
            ? 'Actualizá región, distrito y servicio. En cada visita E también podés ajustar barrio y GPS.'
            : 'Valores por defecto en cada registro de terreno.'}
      </p>

      <div className="grid grid-cols-1 min-[400px]:grid-cols-3 gap-2">

        <select

          value={region}

          onChange={(e) => {

            setRegion(e.target.value);

            setDistrito('');

            setServicio('');

          }}

          className="h-9 px-2 rounded-lg border bg-background text-xs"

          title="Región sanitaria"

        >

          <option value="">Región…</option>

          {regiones.map((r) => (

            <option key={r.id} value={r.nombre}>

              {r.nombre}

            </option>

          ))}

        </select>

        <select

          value={distrito}

          onChange={(e) => {

            setDistrito(e.target.value);

            setServicio('');

          }}

          disabled={!region}

          className="h-9 px-2 rounded-lg border bg-background text-xs disabled:opacity-50"

          title="Distrito"

        >

          <option value="">Distrito…</option>

          {distritos.map((d) => (

            <option key={d.id} value={d.nombre}>

              {d.nombre}

            </option>

          ))}

        </select>

        <select

          value={servicio}

          onChange={(e) => setServicio(e.target.value)}

          disabled={!distrito}

          className="h-9 px-2 rounded-lg border bg-background text-xs disabled:opacity-50"

          title="Servicio"

        >

          <option value="">Servicio…</option>

          {servicios.map((s) => (

            <option key={s.id} value={s.nombre}>

              {s.nombre}

            </option>

          ))}

        </select>

      </div>

      <div className="flex flex-col gap-2">

        <button

          type="button"

          onClick={() => void save()}

          disabled={saving || !region || !distrito}

          className="w-full h-9 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"

        >

          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}

          Guardar mi asignación

        </button>

        {puedeVistaNacional && (region || distrito) && (

          <button

            type="button"

            onClick={() => void quitarAsignacion()}

            disabled={saving}

            className="w-full h-9 rounded-lg border border-primary/40 text-primary text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"

          >

            <Globe className="w-3.5 h-3.5" />

            Ver todo el país (quitar asignación)

          </button>

        )}

      </div>

    </div>

  );

}


