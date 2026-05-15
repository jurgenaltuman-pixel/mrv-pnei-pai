# 🚨 SOLUCIÓN: Usuario No Encontrado (CI 6823848)

## Problema:
El usuario con CI **6823848** no se encuentra en la base de datos Supabase.

## Causa Probable:
**La tabla `base_personas` está VACÍA** - Los datos nunca fueron importados o fueron borrados.

---

## ✅ SOLUCIÓN RÁPIDA (15 minutos)

### Paso 1: Verificar estado de los datos
1. Abre: https://supabase.com/dashboard
2. Ve a **SQL Editor**
3. Copia TODO el contenido de: `DIAGNOSTICAR_DATOS.sql`
4. Pégalo y haz clic en **"Run"**
5. **REPORTA LOS RESULTADOS** (screenshot o texto)

---

## Posibles Resultados:

### ❌ Resultado 1: "0 registros"
```
total_registros | 0
```
**SOLUCIÓN:** Necesitas IMPORTAR los datos. Ve a [Opción A](#opción-a-importar-csv).

### ✅ Resultado 2: "Miles de registros"
```
total_registros | 4827
```
Pero el usuario 6823848 no aparece.
**SOLUCIÓN:** El usuario NO existe en los datos. Ve a [Opción B](#opción-b-crear-usuario-nuevo).

---

## Opción A: Importar CSV / Excel

### Si tienes un archivo Excel/CSV con los datos:
1. Abre la app: https://mrvpai.web.app
2. Inicia sesión como **admin**
3. Ve a **"Importar Datos"**
4. Sube tu archivo Excel
5. La app importará automáticamente a `base_personas`

**O manualmente en SQL:**
```sql
-- Si tienes un CSV, puedes usar COPY
COPY base_personas(documento, nombre, fecha_nacimiento) 
FROM '/ruta/archivo.csv' 
WITH (FORMAT csv, HEADER true);
```

---

## Opción B: Crear Usuario Nuevo

Si el usuario **no existe** en los registros, tienes 3 opciones:

### Opción B1: Crear en la App (Recomendado)
1. Abre: https://mrvpai.web.app
2. Click en **"Registrarse"**
3. Busca el usuario por CI **6823848**
4. Si no aparece, ingresa manualmente:
   - CI: 6823848
   - Nombre: [El nombre del usuario]
   - Email: [email válido]
   - Contraseña: [contraseña segura]
5. Click "Crear cuenta"

### Opción B2: Crear con Script (Para Admins)
```bash
node admin-create-user.js create \
  usuario@ejemplo.com \
  "Contraseña123!" \
  "Nombre del Usuario" \
  "6823848"
```

### Opción B3: SQL directo
```sql
-- 1. Crear auth user
SELECT auth.create_user(
  email := 'usuario@ejemplo.com',
  password := 'Contraseña123!',
  email_confirm := true
);

-- 2. Insertar en base_personas
INSERT INTO base_personas(documento, nombre, fecha_nacimiento)
VALUES ('6823848', 'Nombre Usuario', '1990-01-01');

-- 3. Asignar rol
INSERT INTO user_roles(user_id, role_name)
VALUES ((SELECT id FROM auth.users WHERE email = 'usuario@ejemplo.com'), 'user');
```

---

## 📋 Checklist de Solución

- [ ] Ejecuté `DIAGNOSTICAR_DATOS.sql` en Supabase
- [ ] Reporté si hay 0 registros o si el usuario existe
- [ ] **Si hay 0 registros:** Importé datos desde Excel/CSV
- [ ] **Si el usuario no existe:** Lo creé nuevo
- [ ] Intenté buscar de nuevo en la app
- [ ] ✅ ¡Funciona!

---

## 🆘 Si aún no funciona:

1. **Abre DevTools (F12) en la app**
2. Ve a **Console**
3. Intenta buscar el usuario de nuevo
4. **Copia el error exacto** que aparece
5. **Reporta el error**

Esto nos dirá exactamente dónde falla:
- ❌ "RPC not found" → SQL no ejecutado
- ❌ "0 rows returned" → Datos no importados
- ❌ "Network error" → Problema de conexión

---

## 📞 Contacto rápido

Si necesitas ayuda, reporta:
1. Resultado de `DIAGNOSTICAR_DATOS.sql`
2. Si el usuario 6823848 existe o no en los registros
3. Error exacto en DevTools Console (F12)

**Vamos a resolver esto rápido.** 💪
