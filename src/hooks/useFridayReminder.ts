import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  buildFridayAlertMessage,
  fridayAlertNeedsAttention,
  isFridayInParaguay,
  isFridayReminderProcessed,
  markFridayReminderProcessed,
  type FridayAlertas,
} from '@/lib/friday-reminder';
import { fetchAlertasViernes } from '@/services/registrosAlertasApi';

async function showSystemNotification(title: string, body: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  try {
    let perm = Notification.permission;
    if (perm === 'default') {
      perm = await Notification.requestPermission();
    }
    if (perm === 'granted') {
      new Notification(title, { body, tag: 'mrv-friday-alert' });
    }
  } catch {
    /* ignore */
  }
}

export function useFridayReminder(enabled: boolean) {
  const { toast } = useToast();
  const [alertas, setAlertas] = useState<FridayAlertas | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  /** Cerrar sin marcar «ya procesé» → volverá a notificar al reabrir la app el viernes. */
  const dismissTemporary = useCallback(() => {
    setVisible(false);
  }, []);

  const confirmProcessed = useCallback(() => {
    markFridayReminderProcessed();
    setVisible(false);
    toast({
      title: 'Listo',
      description: 'No te volveremos a recordar estos pendientes hoy (viernes).',
    });
  }, [toast]);

  const refresh = useCallback(async () => {
    if (!enabled || !isFridayInParaguay()) return;
    if (isFridayReminderProcessed()) return;
    setLoading(true);
    try {
      const data = await fetchAlertasViernes();
      if (!data) return;
      setAlertas(data);
      if (!fridayAlertNeedsAttention(data)) return;
      setVisible(true);
      const msg = buildFridayAlertMessage(data);
      toast({
        title: 'Recordatorio de viernes — MRV',
        description: msg,
        duration: 12_000,
      });
      await showSystemNotification('MRV — Recordatorio viernes', msg);
    } finally {
      setLoading(false);
    }
  }, [enabled, toast]);

  useEffect(() => {
    if (!enabled) return;
    if (!isFridayInParaguay()) return;
    void refresh();
  }, [enabled, refresh]);

  return {
    alertas,
    visible,
    loading,
    dismissTemporary,
    confirmProcessed,
    refresh,
    isFriday: isFridayInParaguay(),
    alreadyProcessed: isFridayReminderProcessed(),
  };
}
