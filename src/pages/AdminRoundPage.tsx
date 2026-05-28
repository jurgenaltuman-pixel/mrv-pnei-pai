import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, FileSpreadsheet, FileText, Settings, LogOut } from 'lucide-react';
import {
  clampCasasPorModulo,
  getRoundConfig,
  MAX_CASAS_POR_MODULO,
  setRoundConfig,
  verifyAdminPassword,
  setAdminSession,
  hasAdminSession,
} from '@/lib/round-config';
import { computeRoundSummary } from '@/lib/croquis-housing';
import { evaluateRoundMonitoring } from '@/lib/round-evaluation';
import { downloadRoundReportExcel, downloadRoundReportPdf } from '@/lib/export-round-report';
import { roundMonitoringStorage } from '@/services/roundMonitoringStorage';
import type { RoundMonitoring } from '@/types/round-monitoring';

export default function AdminRoundPage() {
  const [authed, setAuthed] = useState(hasAdminSession());
  const [password, setPassword] = useState('');
  const [casas, setCasas] = useState(getRoundConfig().casasPorModulo);
  const [rounds, setRounds] = useState<RoundMonitoring[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authed) return;
    void roundMonitoringStorage.listAll(100).then(setRounds);
  }, [authed]);

  const handleLogin = () => {
    if (verifyAdminPassword(password)) {
      setAdminSession(true);
      setAuthed(true);
      setError('');
    } else {
      setError('Contraseña incorrecta');
    }
  };

  const handleSaveConfig = () => {
    const clamped = clampCasasPorModulo(casas);
    setCasas(clamped);
    setRoundConfig({ casasPorModulo: clamped });
    alert('Configuración guardada');
  };

  const exportRoundExcel = (r: RoundMonitoring) => {
    const s = computeRoundSummary(r.casas, r.totalCasas);
    downloadRoundReportExcel(r, s, evaluateRoundMonitoring(s));
  };

  const exportRoundPdf = (r: RoundMonitoring) => {
    const s = computeRoundSummary(r.casas, r.totalCasas);
    downloadRoundReportPdf(r, s, evaluateRoundMonitoring(s));
  };

  if (!authed) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4 bg-background">
        <div className="section-card max-w-sm w-full">
          <h1 className="text-xl font-bold flex items-center gap-2 mb-4">
            <Shield className="w-6 h-6 text-primary" />
            Admin MRV
          </h1>
          <label className="field-label">Contraseña</label>
          <input
            type="password"
            className="w-full rounded-xl border px-4 py-3 mb-3"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          {error && <p className="text-sm text-destructive mb-2">{error}</p>}
          <button
            type="button"
            onClick={handleLogin}
            className="w-full min-h-[48px] rounded-xl bg-primary text-primary-foreground font-bold"
          >
            Entrar
          </button>
          <Link to="/" className="block text-center text-sm text-primary mt-4">
            Volver a la app
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh p-4 max-w-2xl mx-auto bg-background">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6" />
          Panel de rondas
        </h1>
        <button
          type="button"
          onClick={() => {
            setAdminSession(false);
            setAuthed(false);
          }}
          className="text-sm flex items-center gap-1 text-muted-foreground"
        >
          <LogOut className="w-4 h-4" /> Salir
        </button>
      </div>

      <div className="section-card mb-4">
        <h2 className="section-title">
          <Settings className="w-4 h-4" /> Configuración
        </h2>
        <label className="field-label">Casas por módulo (default)</label>
        <input
          type="number"
          min={4}
          max={MAX_CASAS_POR_MODULO}
          className="w-full rounded-xl border px-4 py-3 mb-3"
          value={casas}
          onChange={(e) => setCasas(clampCasasPorModulo(Number(e.target.value) || 20))}
        />
        <button
          type="button"
          onClick={handleSaveConfig}
          className="min-h-[48px] px-4 rounded-xl bg-primary text-primary-foreground font-bold"
        >
          Guardar
        </button>
      </div>

      <div className="section-card">
        <h2 className="section-title">Rondas guardadas (local)</h2>
        {rounds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay rondas en este dispositivo.</p>
        ) : (
          <ul className="space-y-3">
            {rounds.map((r) => {
              const s = computeRoundSummary(r.casas, r.totalCasas);
              return (
                <li key={r.id} className="p-3 border rounded-xl text-sm">
                  <p className="font-semibold">{r.moduloLabel}</p>
                  <p className="text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString()} · {s.visitadas}/{s.totalCasas} casas · {s.totalNinos}{' '}
                    niños
                  </p>
                  <div className="mt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => exportRoundExcel(r)}
                      className="flex items-center gap-1 text-primary font-semibold text-sm"
                    >
                      <FileSpreadsheet className="w-4 h-4" /> Excel
                    </button>
                    <button
                      type="button"
                      onClick={() => exportRoundPdf(r)}
                      className="flex items-center gap-1 text-primary font-semibold text-sm"
                    >
                      <FileText className="w-4 h-4" /> PDF
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Link to="/" className="block text-center text-primary font-semibold mt-6">
        Volver a la app
      </Link>
    </div>
  );
}
