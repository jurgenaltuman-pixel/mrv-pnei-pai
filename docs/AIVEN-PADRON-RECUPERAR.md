# Recuperar padrón Aiven (disco lleno)

## 1. Consola Aiven — obligatorio

1. Servicio **pg-mrv-pai-mrv-pai-2026** (operativa, puerto 21502): estado **Running**. Si está *Paused* → **Resume**.
2. Servicio **mrv-pai-mrvpai** (1 GB, puerto 11822): **Running**. Si el disco está al 99% → **Upgrade plan** a **4 GB** mínimo o **Power off → Power on** tras vaciar.
3. Esperá 2–3 minutos hasta que el puerto responda.

## 2. En tu PC (con el CSV)

```bash
npm run aiven:padron-shard-split
```

Esto hace automáticamente:

- **TRUNCATE** `base_personas` en operativa (libera espacio de las ~721k filas viejas).
- **COPY** mitad B (~415k) → operativa (`PADRON_DATABASE_URL_2`).
- **COPY** mitad A (~415k) → dedicada (`PADRON_DATABASE_URL`).

Log en vivo: `scripts/padron-shard-split.log`

## 3. Variables Vercel (ya sincronizadas)

- `PADRON_DATABASE_URL` → dedicada 11822  
- `PADRON_DATABASE_URL_2` → operativa 21502  
- `DATABASE_URL` → operativa (auth/registros)

## 4. Verificar

```bash
node scripts/aiven-ping-url.mjs "<PADRON_DATABASE_URL_2>"
node scripts/aiven-ping-url.mjs "<PADRON_DATABASE_URL>"
```

https://rapid-vaccinator-main.vercel.app/api/health → `padronCount` ≈ 800000, `padronShards`: 2
