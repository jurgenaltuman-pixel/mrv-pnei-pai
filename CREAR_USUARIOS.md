# 🔐 Cómo Crear Usuarios en MRV

## Opción 1: Admin Script (Recomendado)

### Paso 1: Obtener la SERVICE_ROLE_KEY
1. Ve a [Supabase Console](https://app.supabase.com/projects)
2. Selecciona el proyecto `mrv2026`
3. Ve a **Settings** → **API**
4. Busca la sección **Service Role** y copia la **secret key** (que comienza con `sbpvt_...`)

### Paso 2: Crear el usuario
```bash
# Establecer la variable de entorno (Windows PowerShell)
$env:SUPABASE_SERVICE_ROLE_KEY = "paste_tu_service_role_key_aqui"

# O (Windows CMD)
set SUPABASE_SERVICE_ROLE_KEY=paste_tu_service_role_key_aqui

# Crear usuario
node admin-create-user.js create subsistema.pai@mspbs.gov.py Contraseña123 "Subsistema PAI" subsistema.pai
```

### Paso 3: Listar usuarios creados
```bash
node admin-create-user.js list
```

---

## Opción 2: Dashboard de Supabase

1. Ve a [Supabase Console](https://app.supabase.com) → `mrv2026`
2. **Authentication** → **Users**
3. Click en **Add user**
4. Ingresa:
   - Email: `subsistema.pai@mspbs.gov.py`
   - Password: (una contraseña fuerte)
5. Click **Create user**
6. Ve a **SQL Editor** y ejecuta:
   ```sql
   INSERT INTO public.profiles (user_id, email, display_name, username, is_active, is_approved)
   SELECT id, email, 'Subsistema PAI', 'subsistema.pai', true, false
   FROM auth.users
   WHERE email = 'subsistema.pai@mspbs.gov.py'
   ON CONFLICT DO NOTHING;

   INSERT INTO public.user_roles (user_id, role)
   SELECT id, 'user'
   FROM auth.users
   WHERE email = 'subsistema.pai@mspbs.gov.py'
   ON CONFLICT DO NOTHING;
   ```

---

## Opción 3: Desde la App (Si está habilitado)

1. Abre https://mrvpai.web.app
2. Click en **"Cree nuevo usuario"**
3. Rellena:
   - Correo: `subsistema.pai@mspbs.gov.py`
   - Contraseña: (mínimo 6 caracteres)
   - Nombre: `Subsistema PAI`
   - Usuario: `subsistema.pai`
4. Click **Crear cuenta**
5. **⚠️ IMPORTANTE**: Tu cuenta estará pendiente de aprobación.
   - Un admin debe aprobarla antes de poder iniciar sesión
   - Ve a la panel de admin y aprueba la cuenta

---

## ⚠️ Importante

- **Usuarios nuevos están DESAPROBADOS por defecto**
- Un admin debe ir a **Panel Admin** → **Users** → **Approve**
- Después de aprobación, el usuario puede iniciar sesión
- Si tienes rol `admin` o `super_admin`, acceso inmediato

---

## Troubleshooting

### "Credenciales inválidas"
- Verifica que el usuario existe:
  ```bash
  node admin-create-user.js list
  ```
- Revisa la contraseña (sensible a mayúsculas/minúsculas)

### Script no funciona
- Asegúrate de tener `SUPABASE_SERVICE_ROLE_KEY` correcta
- Verifica que no haya espacios extra
- Intenta: `echo $env:SUPABASE_SERVICE_ROLE_KEY` (PowerShell)

### Usuario creado pero no puede iniciar sesión
- Probablemente necesita aprobación
- Admin debe aprobar en el dashboard
- O el usuario está marcado como `is_active = false`

---

**¿Necesitas ayuda?** Contacta al administrador del sistema.
