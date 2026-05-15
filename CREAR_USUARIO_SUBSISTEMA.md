# 🎯 CREAR USUARIO: subsistema.pai@mspbs.gov.py

## El Problema:
El usuario **NO EXISTE** en Supabase. Por eso falla el login.

## ✅ SOLUCIÓN (2 opciones)

### OPCIÓN 1: SQL Directo (MÁS FÁCIL - 1 minuto)

1. Abre: https://supabase.com/dashboard → SQL Editor
2. Abre archivo: `CREAR_USUARIO_DIRECTO.sql`
3. **CAMBIA ESTOS VALORES:**
   - Email: `subsistema.pai@mspbs.gov.py` (ya está bien)
   - Contraseña: **Cambia** `TuContraseña123!` por tu contraseña
   - Nombre: **Cambia** `Sistema PAI` por el nombre real
   - CI: **Cambia** `6823848` por tu CI (ya está bien)

4. Copia TODO y pégalo en SQL Editor
5. Haz clic en **"Run"**

---

### OPCIÓN 2: Script Node.js (Si prefieres línea de comandos)

```bash
# 1. Establece tu clave de servicio
$env:SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxZGRkY2luZXNsYXhka3lpa3NmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxMTk4MjQ3MiwiZXhwIjoyMDI3NTU4NDcyfQ.0CiwGNwZ5nF4X_Ctz3kWLYXdLOPR4vQA_rOlCDjVUVM"

# 2. Ejecuta
node crear-usuario-rapido.mjs \
  subsistema.pai@mspbs.gov.py \
  "TuContraseña123!" \
  "Sistema PAI" \
  "6823848"
```

---

## ✅ Después de crear el usuario:

1. Abre la app: https://mrvpai.web.app
2. Intenta login con:
   - Email: `subsistema.pai@mspbs.gov.py`
   - Contraseña: **tu contraseña**

---

## 📋 Pasos resumidos:

```
1. Abre Supabase SQL Editor
2. Copia CREAR_USUARIO_DIRECTO.sql
3. Cambia email/contraseña/nombre
4. Ejecuta (Run)
5. Intenta login en la app
6. ✅ ¡Listo!
```

**¿Qué contraseña quieres usar?** (debe tener mínimo 8 caracteres)
