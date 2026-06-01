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
  const { loading: roleLoading, canViewNationalReports, canViewRegionalReports } = useRole();
  const useReportApi = canViewRegionalReports;
  const national = Boolean(opts?.national && canViewNationalReports);

  return useQuery<RegistroMRV[]>({
    queryKey: [
      'registros-mrv',
      limit,
      useReportApi ? (national ? 'national' : 'report') : 'scoped',
      refreshKey,
      roleLoading ? 'roles-pending' : 'roles-ready',
    ],
    queryFn: () => dataService.getRegistros(limit, { national, useReportApi }),
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
