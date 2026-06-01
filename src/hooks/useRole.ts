import { useState, useEffect } from 'react';
import { supabase, isSupabaseEnabled } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { USE_MRV_API, mrvApiFetch } from '@/lib/api-config';
import type { AppRole } from '@/lib/app-roles';
import {
  roleFlagsFromList,
  canViewNationalReports,
  canViewRegionalReports,
  canAccessDashboardReports,
  type RoleFlags,
} from '@/lib/report-scope';

export function useRole() {
  const { user } = useAuth();
  const [flags, setFlags] = useState<RoleFlags>({
    roles: [],
    isSuperAdmin: false,
    isAdmin: false,
    isSupervisor: false,
    isRegional: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setFlags({
        roles: [],
        isSuperAdmin: false,
        isAdmin: false,
        isSupervisor: false,
        isRegional: false,
      });
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
          const roles = (data.data?.map((r) => r.role) || []) as AppRole[];
          setFlags(roleFlagsFromList(roles));
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
        const roles = (data?.map((r: { role: string }) => r.role) || []) as AppRole[];
        setFlags(roleFlagsFromList(roles));
        setLoading(false);
      });
  }, [user]);

  return {
    loading,
    roles: flags.roles,
    isAdmin: flags.isAdmin,
    isSuperAdmin: flags.isSuperAdmin,
    isSupervisor: flags.isSupervisor,
    isRegional: flags.isRegional,
    canViewNationalReports: canViewNationalReports(flags),
    canViewRegionalReports: canViewRegionalReports(flags),
    canAccessDashboardReports: canAccessDashboardReports(flags),
  };
}
