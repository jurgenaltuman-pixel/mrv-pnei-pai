# Adjuntos clip → Google Drive (por registro)

**No uses contraseña de Gmail en el código.** La API de Drive usa OAuth.

## Carpeta destino (MRV)

Todas las imágenes de la app se suben a esta carpeta de Drive:

**[MRV — carpeta compartida](https://drive.google.com/drive/folders/1TVTxNvx2jNrDK1b0dAGmSeFpsJONWqP7?usp=sharing)**

ID de carpeta (ya viene por defecto en el código): `1TVTxNvx2jNrDK1b0dAGmSeFpsJONWqP7`

La cuenta de Google con la que generás el refresh token debe tener permiso de **Editor** sobre esa carpeta.

## Cuándo aparece en la app

Dentro de **Identificación del niño/a** → **Subir imágenes a Drive** (opcional, hasta 2 fotos por niño).

- Los archivos se nombran `MRV_{documento}_{timestamp}_{nombre}.jpg`
- Si el servidor no tiene OAuth, las fotos quedan guardadas en el dispositivo hasta sincronizar.

## 1. Google Cloud

1. Activar **Google Drive API**
2. Credencial OAuth **Aplicación de escritorio** → Client ID y secret

## 2. Variables (`.env.local` y Vercel)

```env
GOOGLE_DRIVE_CLIENT_ID=...
GOOGLE_DRIVE_CLIENT_SECRET=...
GOOGLE_DRIVE_REFRESH_TOKEN=...
GOOGLE_DRIVE_FOLDER_ID=1TVTxNvx2jNrDK1b0dAGmSeFpsJONWqP7
```

`GOOGLE_DRIVE_FOLDER_ID` es opcional en el código (ya está el ID de la carpeta MRV por defecto), pero conviene ponerlo también en Vercel para documentación.

## 3. Refresh token (una vez)

```bash
cd server && npm install
cd ..
npm install
node scripts/google-drive-oauth-setup.mjs
```

(El script usa `googleapis` desde la raíz del repo o desde `server/`; si falla `Cannot find package 'googleapis'`, ejecutá `npm install` en la raíz.)

Iniciá sesión con la cuenta de Google que tenga acceso de edición a la carpeta MRV.

Si ves `EADDRINUSE` (puerto 53682 en uso), cerrá otras terminales con el script o liberá el puerto; el script muestra el mensaje de ayuda. No hace falta para Drive/Aiven del log anterior.

## 4. Sincronizar a Vercel y redeploy

```bash
node scripts/sync-vercel-production.mjs --deploy
```

(O agregá las variables manualmente en el dashboard de Vercel y redeploy.)

## 5. Columnas en Aiven (operativa)

```bash
node scripts/aiven-registro-adjuntos-column.mjs
```

O ejecutá `sql/AIVEN_REGISTRO_ADJUNTOS.sql` en la consola Aiven.

## Error 403: access_denied («mrvpai no completó la verificación»)

La **pantalla de consentimiento OAuth** del proyecto está en modo **Prueba**. Solo pueden autorizar cuentas listadas como **usuarios de prueba**.

1. [Google Cloud Console](https://console.cloud.google.com/) → proyecto **MRV PAIMPSBS**
2. **APIs y servicios** → **Pantalla de consentimiento de OAuth**
3. En **Usuarios de prueba** → **+ Agregar usuarios**
4. Agregá el Gmail con el que vas a generar el token (p. ej. `jurgenaltuman@gmail.com`) y **Guardar**
5. Volvé a correr `node scripts/google-drive-oauth-setup.mjs` y abrí la URL de nuevo (misma cuenta que agregaste)

**Importante:** El refresh token queda ligado a **esa cuenta**. La subida a Drive la hace el servidor con ese usuario; debe tener **Editor** en la [carpeta MRV](https://drive.google.com/drive/folders/1TVTxNvx2jNrDK1b0dAGmSeFpsJONWqP7?usp=sharing).

### ¿Publicar la app en producción?

- Para **solo generar el token una vez** (cuenta del equipo): alcanza con **usuarios de prueba** (hasta 100).
- **Publicar** la app («En producción») puede pedir **verificación de Google** si usás scopes sensibles; para uso interno MRV suele bastar una cuenta de servicio del equipo en usuarios de prueba.
- Los brigadistas **no** inician sesión en Google: solo la API en Vercel sube archivos con el refresh token.
