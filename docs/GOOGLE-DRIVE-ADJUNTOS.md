# Adjuntos clip → Google Drive (por registro)

**No uses contraseña de Gmail en el código.** La API de Drive usa OAuth.

## Cuándo aparece en la app

Dentro de **Busca Persona**, tras cada búsqueda aparece una sección **Clip de esta búsqueda** (también si no hay historial SPR o no está en padrón):

- **Un clip por niño** (por documento): si la búsqueda devuelve varios, elegís con los botones del niño.
- Nota / **transcripción** y hasta **2 fotos** → Google Drive.
- Los resultados con clip muestran la etiqueta **· clip** en la lista.
- Al **guardar la visita**, se guardan los datos del niño **seleccionado** en `registros_vacunacion`.
- El **Excel del dashboard** trae `transcripcion_clip`, `enlace_imagen_1`, `enlace_imagen_2` **por registro**.

## 1. Google Cloud

1. Activar **Google Drive API**
2. Credencial OAuth **Aplicación de escritorio** → Client ID y secret

## 2. Variables (`.env.local` y Vercel)

```env
GOOGLE_DRIVE_CLIENT_ID=...
GOOGLE_DRIVE_CLIENT_SECRET=...
GOOGLE_DRIVE_REFRESH_TOKEN=...
GOOGLE_DRIVE_FOLDER_ID=   # opcional
```

## 3. Refresh token (una vez)

```bash
cd server && npm install
node ../scripts/google-drive-oauth-setup.mjs
```

Iniciá sesión con la cuenta de Drive del proyecto (ej. jurgenaltuman@gmail.com).

## 4. Columnas en Aiven (operativa)

```bash
node scripts/aiven-registro-adjuntos-column.mjs
```

O ejecutá `sql/AIVEN_REGISTRO_ADJUNTOS.sql` en la consola Aiven.

## 5. Redeploy Vercel

Tras agregar variables y columnas, redeploy para `POST /api/padron/busqueda-adjuntos` y guardado de registros con enlaces.
