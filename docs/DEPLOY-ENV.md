# Variables de entorno (NO van en Git con contraseñas)

**Nunca subas a Git** archivos con secretos: `.env`, `.env.local`, `.env.production` con contraseñas reales.

En el repositorio solo va **`.env.example`** (plantilla sin claves).

## Vercel (API + base de datos) — obligatorio

En [Vercel → proyecto → Settings → Environment Variables](https://vercel.com) (Production):

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL Aiven **operativa** (usuarios, login, registros, nómina) |
| `PADRON_DATABASE_URL` | PostgreSQL Aiven **solo padrón** (`mrv-pai-mrvpai`, ~830k filas en `base_personas`). Las búsquedas de personas usan **solo** esta URL. |
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

## Roles nuevos (Supervisor / Regional)

Ejecutar una vez en la base **operativa** Aiven:

```text
sql/AIVEN_ROLES_SUPERVISOR_REGIONAL.sql
```

| Rol | Monitoreo | Reportes |
|-----|-----------|----------|
| **supervisor** | Sí | Vista **país** (todos los registros) |
| **regional** | Sí | Vista **regional** (su región asignada en el perfil) |

Asignación desde **Admin → Usuarios y roles** (admin / super admin).

## Padrón en 2 shards (disco lleno en 1 GB)

| Variable | Contenido |
|----------|-----------|
| `PADRON_DATABASE_URL` | Shard **0** (~50% niños) — instancia 1 GB `mrv-pai-mrvpai` |
| `PADRON_DATABASE_URL_2` | Shard **1** (~50%) — misma URL que `DATABASE_URL` (operativa) |

La API consulta **ambos** shards y une resultados. Importación:

```bash
npm run aiven:padron-shard-split
```

Requiere espacio: en operativa se hace `TRUNCATE base_personas` y COPY de ~415k filas; en dedicada igual con la otra mitad. Si el plan es 1 GB y está al 99%, **ampliá almacenamiento** en Aiven o reiniciá el servicio antes de importar.

## Migrar padrón a instancia dedicada

1. En `.env.local`: `PADRON_DATABASE_URL` → servicio Aiven **mrv-pai-mrvpai** (puerto 11822).
2. `npm run aiven:bootstrap-padron-only`
3. `npm run aiven:import-padron-csv -- "ruta\Listado de niños para MRV.csv"`
4. En Vercel: misma `PADRON_DATABASE_URL` y redeploy.
5. Cuando el conteo coincida (~95%): `npm run aiven:drop-padron-operational` (libera espacio en la BD operativa).

## Resumen para el administrador

1. Configurar `DATABASE_URL`, `PADRON_DATABASE_URL`, `JWT_SECRET` en **Vercel**.
2. Ejecutar `sql/AIVEN_ROLES_SUPERVISOR_REGIONAL.sql` en Aiven si aún no está.
3. Redeploy Vercel.
4. Verificar `/api/health`.
5. Redeploy Firebase Hosting (frontend).
6. En el teléfono: actualizar la PWA (cerrar + abrir, o borrar caché del sitio).
