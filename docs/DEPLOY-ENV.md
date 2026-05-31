# Variables de entorno (NO van en Git con contraseñas)

**Nunca subas a Git** archivos con secretos: `.env`, `.env.local`, `.env.production` con contraseñas reales.

En el repositorio solo va **`.env.example`** (plantilla sin claves).

## Vercel (API + base de datos) — obligatorio

En [Vercel → proyecto → Settings → Environment Variables](https://vercel.com) (Production):

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL Aiven **login/registros**. Si la operativa **21502** está caída (disco lleno), usar **mrvpai2** (`…15143`) — mismo host que `PADRON_DEDICADO_URL`. |
| `PADRON_DATABASE_URL` | Padrón shard **0** (`mrvpai1…`, ~393k filas) |
| `PADRON_DEDICADO_URL` | Padrón shard **1** (`mrvpai2…`, ~422k filas). Sin esto la app solo encuentra la mitad del padrón. |

Si el login falla con `ECONNREFUSED` en health: comprobar que `DATABASE_URL` apunta a una instancia **Running** en [Aiven](https://console.aiven.io). Con 21502 caída, login temporal en **mrvpai2** (4117 usuarios migrados desde Supabase con mismas contraseñas).

### Usuarios (login / registro)

- **Sí:** altas y login van a **`DATABASE_URL`** → tablas `profiles`, `auth_credentials`, `user_roles` (~4117 usuarios, hashes bcrypt de Supabase).
- El padrón de niños **no** se guarda ahí; está en `mrvpai1` + `mrvpai2`.

### Disco operativa al 100% / `ECONNREFUSED 21502`

**Si ves `ECONNREFUSED`:** la operativa está **apagada** — ningún script desde la PC funciona hasta revivirla en Aiven.

Guía paso a paso: **[AIVEN-OPERATIVA-DISCO-LLENO.md](./AIVEN-OPERATIVA-DISCO-LLENO.md)** (ampliar disco → reiniciar → `TRUNCATE base_personas`).

Cuando `npm run aiven:ping-operational` diga **OK**:

```bash
npm run aiven:free-operational-disk -- --confirm
```

### Subir fotos / transcripción (Drive)

Visible en **Identificación del niño** → buscar por documento (≥4 dígitos) → bloque azul **«Subir transcripción y fotos (Drive)»**.  
En Vercel hace falta: `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN` (ver `docs/GOOGLE-DRIVE-ADJUNTOS.md`).
| `JWT_SECRET` | Clave larga aleatoria para tokens de sesión (misma en todos los deploys; si cambia, los APK viejos pierden sesión) |

Opcional:

| Variable | Descripción |
|----------|-------------|
| `CORS_ORIGIN` | Orígenes permitidos separados por coma (por defecto ya incluye `mrvpai.web.app` y Vercel) |
| `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN` | Adjuntos de búsqueda → Drive ([GOOGLE-DRIVE-ADJUNTOS.md](./GOOGLE-DRIVE-ADJUNTOS.md)) |
| `GOOGLE_DRIVE_FOLDER_ID` | (Opcional) Carpeta destino en Drive |

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
| `PADRON_DATABASE_URL` | Shard **0** (~50% niños) — `mrvpai1-mrvpai` (11822) |
| `PADRON_DEDICADO_URL` | Shard **1** (~50%) — segunda instancia padrón (`mrvpai2-mrv…` :15143) |
| `PADRON_DATABASE_URL_2` | (Legacy) solo si no usás `PADRON_DEDICADO_URL` |

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
