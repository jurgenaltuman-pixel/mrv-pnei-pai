# 📊 OPTIMIZAR BÚSQUEDA DE USUARIOS - Instrucciones

## Problema identificado:
- Búsqueda lenta (sin índices)
- La RPC `search_personas_mejorada` tarda demasiado
- La página se cuelga al buscar

## Solución implementada:

### 1️⃣ En la Base de Datos (Supabase SQL Editor)
**Pasos:**
1. Abre https://supabase.com/dashboard
2. Selecciona tu proyecto `mrv2026`
3. Ve a **SQL Editor**
4. Copia y pega TODO el contenido de: `OPTIMIZAR_BUSQUEDA.sql`
5. Haz clic en **"Run"** (Ejecutar)
6. ¡Espera a que termine! (puede tomar 1-2 minutos para crear índices)

**¿Qué hace?**
- ✅ Crea extensión `pg_trgm` para búsqueda trigram
- ✅ Crea índices GIST en `documento` y `nombre`
- ✅ Crea función RPC `search_personas_mejorada` (optimizada)
- ✅ Crea función RPC `search_persona_by_documento` (búsqueda exacta rápida)
- ✅ Analiza tabla para optimizar planner

### 2️⃣ En el Front-end (Ya hecho ✅)
**Cambios en `LoginPage.tsx`:**
- ✅ Búsqueda exacta por documento primero (más rápida)
- ✅ Debounce reducido de 400ms a 150ms (para documentos)
- ✅ Validación: mínimo 2 caracteres (antes era 3)
- ✅ Límite de 20 resultados (antes 15)
- ✅ Fallback mejorado con ILIKE

### 3️⃣ Beneficios esperados:
| Métrica | Antes | Después |
|---------|-------|---------|
| Búsqueda por CI | 800-1500ms | 50-150ms |
| Búsqueda por nombre | 2000-4000ms | 300-800ms |
| Debounce | 400ms | 150ms (CI) / 300ms (nombre) |
| Resultados | Sin límite | Máx 20 (más rápido) |
| Freezes | Frecuentes | Raros |

---

## ⚡ Rápido Start

```sql
-- Copiar TODO de OPTIMIZAR_BUSQUEDA.sql
-- Ir a: Dashboard Supabase → SQL Editor
-- Pegar y ejecutar
-- ✅ Listo
```

---

## 🔍 Si algo falla:

### Error: "Extension not found"
```sql
-- Ya no necesitas, pero si lo necesitas:
CREATE EXTENSION pg_trgm;
```

### Error: "Function already exists"
```sql
-- Las funciones tienen DROP IF EXISTS, debería funcionar
-- Si no, borra primero:
DROP FUNCTION IF EXISTS search_personas_mejorada(text);
DROP FUNCTION IF EXISTS search_persona_by_documento(text);
```

### Búsqueda sigue lenta
```sql
-- Ejecuta esto para reanalizar índices:
ANALYZE base_personas;
VACUUM base_personas;
```

---

## 📋 Checklist:

- [ ] Ejecuté el SQL en Supabase Dashboard
- [ ] Esperé a que terminara (1-2 minutos)
- [ ] Probé buscar por CI (ej: "1234567")
- [ ] Probé buscar por nombre (ej: "Juan")
- [ ] La búsqueda es rápida (< 1 segundo)
- [ ] No se cuelga
- [ ] Deploy a Firebase hecho ✅

---

## 📝 Notas técnicas:

- **pg_trgm**: Extensión de PostgreSQL para búsqueda trigram (palabras difusas)
- **GIST**: Índice tipo "Generalized Search Tree" optimizado para texto
- **RPC**: Función almacenada en la base de datos (más rápida que queries desde front)
- **LIMIT 20**: Suficiente para autocomplete, más rápido que devolver todo
- **Debounce**: Evita hacer queries en cada keystroke

---

## 🎯 Siguiente paso después de optimizar:

Build y deploy a Firebase:
```bash
npm run build
firebase deploy --only hosting:mrvpai
```

