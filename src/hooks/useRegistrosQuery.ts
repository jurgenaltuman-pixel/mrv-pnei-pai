import { useQuery } from '@tanstack/react-query';
import { dataService, type RegistroMRV } from '@/services/dataService';
import { useDataRefresh } from '@/contexts/DataRefreshContext';

export function useRegistrosQuery(limit = 2500, enabled = true) {
  const { refreshKey } = useDataRefresh();

  return useQuery<RegistroMRV[]>({
    queryKey: ['registros-mrv', limit, refreshKey],
    queryFn: () => dataService.getRegistros(limit),
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    enabled,
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
