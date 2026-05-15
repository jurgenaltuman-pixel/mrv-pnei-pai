# 🎯 INSTRUCCIONES PASO A PASO: Resolver CI 6823848 No Encontrado

## PASO 1: Verificar los datos (2 minutos)

### A. Abre Supabase Dashboard
```
1. Ve a: https://supabase.com/dashboard
2. Selecciona proyecto: mrv2026
3. Click en SQL Editor (lado izquierdo)
```

### B. Verifica si hay datos
```sql
-- COPIA Y PEGA ESTO:
SELECT COUNT(*) as total_registros FROM base_personas;
```

**¿Resultado?**
- Si muestra **0** → **Los datos NO están importados** → Ve a PASO 2
- Si muestra **1000+** → **Los datos SÍ están** → Ve a PASO 3

---

## PASO 2: Importar datos (10 minutos)

### Si la tabla está VACÍA:

#### Opción 1: Importar desde la App
```
1. Abre: https://mrvpai.web.app
2. Login como admin (tu usuario)
3. Click en: "Importar Datos" (en el menú)
4. Arrastra y suelta tu archivo Excel/CSV
5. Click "Importar"
6. ¡Listo!
```

#### Opción 2: SQL directo
```sql
-- Si tienes datos en CSV, copia el contenido:
-- Documento,Nombre,Fecha Nacimiento
-- 6823848,Nombre del Usuario,1990-01-15

INSERT INTO base_personas(documento, nombre, fecha_nacimiento) 
VALUES ('6823848', 'Nombre del Usuario', '1990-01-15');

-- Repite para cada usuario que tengas
```

---

## PASO 3: Si los datos EXISTEN pero no encuentran al usuario

### A. Verifica si el CI es correcto
```sql
-- Ejecuta en SQL Editor:
SELECT * FROM base_personas WHERE documento LIKE '%6823848%';
```

**¿Qué ves?**
- ✅ Si aparece el usuario → **El CI está bien, es problema de búsqueda**
- ❌ Si no aparece nada → **El usuario NO existe en los datos**

### B. Si el usuario SÍ existe pero la búsqueda falla

```sql
-- Ejecuta el SQL de optimización:
-- Copia TODO de OPTIMIZAR_BUSQUEDA.sql
-- Pégalo en SQL Editor y ejecuta
-- Espera 1-2 minutos
```

---

## PASO 4: Crear el usuario si NO existe

### Opción 1: En la App (Recomendado)
```
1. Abre: https://mrvpai.web.app
2. Click "Registrarse"
3. En "Búsqueda de Usuario", escribe: 6823848
4. Si no aparece, ingresa datos:
   - Nombre: Tu nombre
   - Usuario: 6823848 (o tu usuario)
   - Email: tumail@gmail.com
   - Contraseña: MiContraseña123!
5. Click "Crear cuenta"
6. ✅ ¡Listo! Ya puedes iniciar sesión
```

### Opción 2: Script Node (para admin)
```bash
# Primero, establece tu clave de servicio:
export SUPABASE_SERVICE_ROLE_KEY="tu_clave_secreta"

# Luego ejecuta:
node admin-create-user.js create \
  email@mspbs.gov.py \
  "Contraseña123!" \
  "Nombre Completo" \
  "6823848"
```

---

## ✅ RESUMEN RÁPIDO

| Problema | Solución |
|----------|----------|
| Tabla `base_personas` vacía | Importar CSV/Excel |
| Usuario no existe en datos | Crear nuevo usuario |
| Usuario existe pero no encuentra | Ejecutar `OPTIMIZAR_BUSQUEDA.sql` |
| RPC falla | Ejecutar `OPTIMIZAR_BUSQUEDA.sql` |

---

## 🎬 Ahora mismo: 

**Ejecuta en Supabase SQL Editor:**
```sql
SELECT COUNT(*) as total FROM base_personas;
```

**¿Cuál es el resultado? Reporta el número.**

Una vez que reportes, te digo exactamente qué hacer.
