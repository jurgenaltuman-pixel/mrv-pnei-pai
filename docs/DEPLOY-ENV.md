# Variables de entorno (NO van en Git con contraseñas)

**Nunca subas a Git** archivos con secretos: `.env`, `.env.local`, `.env.production` con contraseñas reales.

En el repositorio solo va **`.env.example`** (plantilla sin claves).

## Vercel (API + base de datos) — obligatorio

En [Vercel → proyecto → Settings → Environment Variables](https://vercel.com) (Production):

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL Aiven **operativa** (usuarios, login, registros, nómina) |
| `PADRON_DATABASE_URL` | PostgreSQL Aiven **solo padrón** (niños, ~700k filas) |
| `JWT_SECRET` | Clave larga aleatoria para tokens de sesión |

Opcional:

| Variable | Descripción |
|----------|-------------|
| `CORS_ORIGIN` | Orígenes permitidos separados por coma (por defecto ya incluye `mrvpai.web.app` y Vercel) |

Después de cambiar variables: **Redeploy** en Vercel (Deployments → ⋮ → Redeploy).

Comprobar que la API responde:

```text
https://rapid-vaccinator-main.vercel.app/api/health
```

Debe devolver `"ok": true` y `"db": "aiven"`.

## Firebase Hosting (solo la PWA estática)

No necesita `DATABASE_URL`. La app en `https://mrvpai.web.app` llama a la API en Vercel.

Solo hace falta desplegar el build (`firebase deploy --only hosting:mrvpai`).

## Build del frontend (opcional en Vercel si buildás ahí)

| Variable | Valor típico |
|----------|----------------|
| `VITE_MRV_API_URL` | `https://rapid-vaccinator-main.vercel.app` |

Si no está, el código ya usa esa URL por defecto en producción.

## Qué NO soluciona subir cosas a Git

- Las contraseñas de Aiven **no** van en el código.
- Si falta `DATABASE_URL` en **Vercel**, la app en el celular mostrará error de red aunque el Git esté perfecto.
- Si el celular tiene **versión vieja** de la PWA: cerrar la app, borrar datos del sitio o reinstalar el acceso directo.

## Resumen para el administrador

1. Configurar `DATABASE_URL`, `PADRON_DATABASE_URL`, `JWT_SECRET` en **Vercel**.
2. Redeploy Vercel.
3. Verificar `/api/health`.
4. Redeploy Firebase Hosting (frontend).
5. En el teléfono: actualizar la PWA (cerrar + abrir, o borrar caché del sitio).
