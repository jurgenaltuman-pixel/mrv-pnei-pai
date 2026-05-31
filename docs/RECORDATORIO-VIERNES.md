# Recordatorio de viernes (web + APK)

Cada **viernes** (hora Paraguay), al abrir la app con sesión iniciada:

1. **Banner** morado con el resumen de la semana (últimos 7 días).
2. **Toast** con el mismo texto.
3. **Notificación del sistema** (navegador / PWA / WebView Android) si el usuario aceptó permisos.

## Qué cuenta

| Concepto | Criterio |
|----------|----------|
| Pendientes de transcripción | Registro con `enlace_imagen_1` o `enlace_imagen_2` y `transcripcion_clip` vacío |
| Cambios de residencia | `observaciones` contiene `[Cambio de residencia]` |

Brigadista: solo sus registros. Supervisor/admin/regional: según alcance del dashboard.

## ¿Ya procesaste?

El banner pregunta **«¿Ya procesaste estos pendientes?»**

| Acción | Efecto |
|--------|--------|
| **Sí, ya procesé** | No más recordatorios ese viernes (guardado en el dispositivo). |
| **Ahora no** o cerrar (X) | Solo oculta por ahora; al **volver a abrir la app el mismo viernes** vuelve el banner, toast y notificación. |

## API

`GET /api/registros/alertas-viernes` (autenticado) → `{ pendientesTranscripcion, cambiosResidencia }`

## Importar padrón 50/50

Con Aiven en **Running** y `.env.local` con `PADRON_DATABASE_URL` (11822) y `PADRON_DEDICADO_URL` (15143):

```bash
npm run aiven:padron-shard-split
```

O:

```bash
node scripts/padron-shard-split-run.mjs "C:\Users\usuario\Documents\Listado de niños para MRV.csv"
```

Verificar: `node scripts/aiven-ping-url.mjs "<PADRON_DATABASE_URL>"` y lo mismo para `PADRON_DEDICADO_URL`.
