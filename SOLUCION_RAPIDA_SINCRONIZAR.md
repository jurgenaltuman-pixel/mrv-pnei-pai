# 🎯 SOLUCIÓN ENCONTRADA: 750K registros en tabla `usuarios`

## El Problema:
- ❌ `base_personas` está **VACÍA** (solo 1 registro)
- ✅ `usuarios` tiene **750,529 registros** ← LOS DATOS ESTÁN AQUÍ

## La Solución (2 minutos):

### PASO 1: Abre Supabase Dashboard
```
https://supabase.com/dashboard → mrv2026 → SQL Editor
```

### PASO 2: Copia TODO de `SINCRONIZAR_DATOS.sql`

**Este SQL hace:**
1. ✅ Identifica dónde están los 750K registros
2. ✅ **Copia todos a `base_personas`** (tabla que usa la app)
3. ✅ Verifica si 6823848 existe

### PASO 3: Pégalo y haz clic en **"Run"**

**ESPERA a que termine** (puede tardar 1-2 minutos)

---

## ¿Cuál es el resultado?

### ✅ Opción A: Usuario ENCONTRADO
```
| documento | nombre           | fecha_nacimiento |
|-----------|------------------|------------------|
| 6823848   | [Nombre Usuario] | [Fecha]          |
```
**LISTO.** Intenta buscar en la app de nuevo.

### ❌ Opción B: Usuario NO encontrado (0 rows)
Significa que 6823848 **realmente no existe** en los 750K registros.

---

## 📋 Próximos pasos después de sincronizar:

1. **Intenta buscar 6823848 en la app**
   - Si aparece → ✅ RESUELTO
   - Si no aparece → Necesitamos crear el usuario

2. **Si necesita crear usuario:**
   ```
   Click "Registrarse" → Ingresa datos → Click "Crear cuenta"
   ```

---

## ⚡ Ejecuta AHORA:

```sql
-- COPIA ESTO:
INSERT INTO base_personas(documento, nombre, fecha_nacimiento)
SELECT DISTINCT 
  COALESCE(documento, ''),
  COALESCE(nombre, ''),
  COALESCE(fecha_nacimiento::date, NULL)
FROM usuarios
WHERE documento IS NOT NULL 
  AND documento != ''
  AND NOT EXISTS (
    SELECT 1 FROM base_personas bp 
    WHERE bp.documento = usuarios.documento
  )
ON CONFLICT DO NOTHING;

-- Luego verifica:
SELECT COUNT(*) as total FROM base_personas;
```

**¿Cuántos registros hay ahora en `base_personas`?**
