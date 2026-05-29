import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Paper from '@mui/material/Paper';
import ClipboardListIcon from '@mui/icons-material/Assignment';
import BarChartIcon from '@mui/icons-material/BarChart';
import MapIcon from '@mui/icons-material/Map';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';

interface Props {
  active: string;
  onChange: (tab: string) => void;
  showAdmin?: boolean;
}

const TABS = [
  { id: 'registro', label: 'Monitoreo', Icon: ClipboardListIcon },
  { id: 'dashboard', label: 'Dashboard', Icon: BarChartIcon },
  { id: 'mapa', label: 'Mapa', Icon: MapIcon },
] as const;

export default function BottomNav({ active, onChange, showAdmin }: Props) {
  const tabs = showAdmin
    ? [...TABS, { id: 'admin' as const, label: 'Admin', Icon: AdminPanelSettingsIcon }]
    : TABS;

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        borderRadius: '20px 20px 0 0',
        pb: 'env(safe-area-inset-bottom)',
      }}
    >
      <BottomNavigation
        value={active}
        onChange={(_, v) => onChange(v)}
        showLabels
        sx={{
          maxWidth: 1152,
          mx: 'auto',
          height: 64,
          '& .MuiBottomNavigationAction-root': {
            minWidth: 64,
            transition: 'color 0.28s cubic-bezier(0.2, 0, 0, 1)',
          },
          '& .Mui-selected': {
            fontSize: '0.7rem',
          },
        }}
      >
        {tabs.map((tab) => (
          <BottomNavigationAction
            key={tab.id}
            value={tab.id}
            label={tab.label}
            icon={<tab.Icon sx={{ fontSize: 22 }} />}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
}
