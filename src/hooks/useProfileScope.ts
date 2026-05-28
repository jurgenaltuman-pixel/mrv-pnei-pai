import { useQuery } from '@tanstack/react-query';
import { USE_MRV_API, mrvApiFetch } from '@/lib/api-config';
import type { ProfileScope } from '@/lib/registro-scope';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useProfileScope() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['profile-scope-full', user?.id, USE_MRV_API],
    queryFn: async (): Promise<ProfileScope | null> => {
      if (!user?.id) return null;
      if (USE_MRV_API) {
        const { data } = await mrvApiFetch<{ data: ProfileScope | null }>('/api/profiles/scope');
        return data?.data ?? null;
      }
      const { data } = await supabase
        .from('profiles')
        .select('assigned_region, assigned_distrito, assigned_servicio, assigned_barrio, scope_locked')
        .eq('user_id', user.id)
        .maybeSingle();
      return data as ProfileScope | null;
    },
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });
}
