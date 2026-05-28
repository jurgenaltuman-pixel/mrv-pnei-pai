import { useState, useEffect } from 'react';
import { supabase, isSupabaseEnabled } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { USE_MRV_API, mrvApiFetch } from '@/lib/api-config';

export function useRole() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }

    if (USE_MRV_API) {
      void mrvApiFetch<{ data: { role: string }[] }>(`/api/user-roles?user_id=${user.id}`).then(
        ({ data, error }) => {
          if (error || !data) {
            setLoading(false);
            return;
          }
          const roles = data.data?.map((r) => r.role) || [];
          const superAdmin = roles.includes('super_admin');
          setIsSuperAdmin(superAdmin);
          setIsAdmin(superAdmin || roles.includes('admin'));
          setLoading(false);
        }
      );
      return;
    }

    if (!isSupabaseEnabled) {
      setLoading(false);
      return;
    }

    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .then(({ data }) => {
        const roles = data?.map((r: { role: string }) => r.role) || [];
        const superAdmin = roles.includes('super_admin');
        setIsSuperAdmin(superAdmin);
        setIsAdmin(superAdmin || roles.includes('admin'));
        setLoading(false);
      });
  }, [user]);

  return { isAdmin, isSuperAdmin, loading };
}
