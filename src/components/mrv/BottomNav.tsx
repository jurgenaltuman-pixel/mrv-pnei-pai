import { ClipboardList, BarChart3, MapPin, Shield } from 'lucide-react';

interface Props {
  active: string;
  onChange: (tab: string) => void;
  showAdmin?: boolean;
}

const TABS = [
  { id: 'registro', label: 'Monitoreo', Icon: ClipboardList },
  { id: 'dashboard', label: 'Dashboard', Icon: BarChart3 },
  { id: 'mapa', label: 'Mapa', Icon: MapPin },
];

export default function BottomNav({ active, onChange, showAdmin }: Props) {
  const tabs = showAdmin ? [...TABS, { id: 'admin', label: 'Admin', Icon: Shield }] : TABS;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t shadow-lg z-50 safe-area-bottom">
      <div className="w-full flex">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => onChange(tab.id)}
            className={`nav-tab ${active === tab.id ? 'nav-tab-active' : 'text-muted-foreground'}`}>
            <div className={`mx-auto mb-0.5 p-1.5 rounded-lg transition-colors ${active === tab.id ? 'bg-primary/10' : ''}`}>
              <tab.Icon className="w-5 h-5" />
            </div>
            <span className="text-[10px]">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}