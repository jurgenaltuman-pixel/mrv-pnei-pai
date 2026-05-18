# Modo offline — plan funcional e implementación

## Qué se garantiza hoy

1. **Sesión ya iniciada**  
   Con Capacitor `Preferences` / almacenamiento del SDK de Supabase, la sesión puede persistir. **No es posible** hacer el primer inicio de sesión contra Supabase Auth sin red: es un servicio en la nube. Con sesión válida, muchas pantallas siguen funcionando hasta que expire el *refresh token* (política del proyecto en Supabase).

2. **Cola de registros** (`offlineCache`, IndexedDB `mrv_offline`)  
   Si no hay red al guardar, el registro queda en cola y se intenta enviar al volver `online` (listener en `offlineCache.ts`).

3. **Padrón nominal completo en el dispositivo** (`mrv_padron`, IndexedDB) — *búsqueda offline en plenitud*  
   - Tras **«Descargar padrón»** en el banner (pantalla principal con conexión), la app descarga `base_personas` por páginas y la guarda localmente.  
   - **Sin señal**, `getBasePersonas`, `buscarPersonasPorDocumento` y `buscarPersonasDatosPersonales` leen ese almacén (misma lógica de filtro que en servidor en la medida posible en cliente).  
   - Límite práctico: la descarga está acotada (páginas de 800 filas; tope de seguridad ~4M filas en código). El tiempo y el espacio dependen del tamaño real del padrón en Supabase y de las políticas RLS (debe permitirse lectura al rol que usa la app).

4. **Metadatos y lecturas en caché** (`mrvAppCache`, IndexedDB `mrv_app_cache`)  
   - **Estructura territorial**: igual que antes (hidrata + guarda).  
   - **Últimas búsquedas** y **snapshot de registros** para dashboard: respaldo si el padrón aún no se descargó.

5. **Ubicación GPS**  
   El GPS del dispositivo no depende de Internet; el mapa puede degradarse sin teselas (Leaflet/OSM) si no hay red.

6. **Instalación PWA**  
   En **HTTPS** (o `localhost`), si el navegador ofrece el evento `beforeinstallprompt`, aparece **Instalar** en la cabecera. La PWA sigue las mismas reglas de seguridad del sitio (CSP en `index.html`).

## Qué no se garantiza (límites honestos)

- **Primer login sin señal**: requiere Supabase Auth en línea.  
- **Padrón desactualizado** hasta la próxima descarga con conexión (no hay sync incremental automático en segundo plano salvo que el usuario vuelva a pulsar descargar).  
- **Mapas**: teselas pueden no cargar sin red.  
- **“100% seguro” absoluto**: la seguridad depende de claves solo publicables en cliente, HTTPS en producción, RLS en Supabase y del dispositivo del usuario.

## Flujo recomendado en terreno

1. Con WiFi/datos: iniciar sesión, abrir **Registro** y pulsar **Descargar padrón** hasta que confirme éxito.  
2. Abrir **Dashboard** una vez (snapshot de registros).  
3. En zona sin señal: búsqueda de personas, formularios y cola de guardado.

## Archivos relevantes

| Archivo | Rol |
|---------|-----|
| `src/services/mrvPadronIndexed.ts` | IndexedDB del padrón + descarga paginada + búsqueda local |
| `src/components/mrv/PadronOfflineBanner.tsx` | UI de descarga y avisos offline |
| `src/services/mrvAppCache.ts` | Caché org / búsquedas recientes / registros |
| `src/services/offlineCache.ts` | Cola de registros pendientes de sync |
| `src/services/dataService.ts` | Orquesta red + padrón local + caché |
| `src/hooks/useOrgStructure.ts` | Hidrata org desde caché |
| `src/hooks/usePwaInstall.ts` | Prompt de instalación PWA |
