import { useQuery } from '@tanstack/react-query';
import { dataService, type RegistroMRV } from '@/services/dataService';
import { useDataRefresh } from '@/contexts/DataRefreshContext';
import { useRole } from '@/hooks/useRole';

export function useRegistrosQuery(
  limit = 2500,
  enabled = true,
  opts?: { national?: boolean }
) {
  const { refreshKey } = useDataRefresh();
  const { loading: roleLoading, isAdmin, isSuperAdmin } = useRole();
  const national = Boolean(opts?.national && (isAdmin || isSuperAdmin));

  return useQuery<RegistroMRV[]>({
    queryKey: [
      'registros-mrv',
      limit,
      national ? 'national' : 'scoped',
      refreshKey,
      roleLoading ? 'roles-pending' : 'roles-ready',
    ],
    queryFn: () => dataService.getRegistros(limit, { national }),
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    enabled: enabled && !roleLoading,
  });
}

export function useDashboardStatsQuery(enabled = true) {
  const { refreshKey } = useDataRefresh();

  return useQuery({
    queryKey: ['dashboard-stats', refreshKey],
    queryFn: () => dataService.getDashboard(),
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    enabled,
  });
}
