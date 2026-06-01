/**
 * Express app MRV → PostgreSQL Aiven
 */
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { query, padronQuery, getPoolConfig } from './db.mjs';
import { loginRateLimit, padronPageRateLimit, padronSearchRateLimit } from './rateLimit.mjs';
import { authMiddleware, getJwtSecret, getUserRoles, requireAdmin, canAssignRole } from './authUtils.mjs';
import { validateStrongPassword } from './passwordPolicy.mjs';
import { filterRowsByProfileScope, hasProfileScopeAssignment } from './registroScope.mjs';
import { listRegistrosMerged } from './registrosMerge.mjs';
import { countRegistrosInSupabase } from './supabaseRegistros.mjs';
import { fetchBarriosByDistritoFromSupabase } from './supabaseOrg.mjs';
import { mapExcelRowToRegistro, upsertRegistroRow } from './importRegistrosExcel.mjs';
import { handleAuthSignup } from './authSignup.mjs';
import { mergeRoundPayload } from './roundMerge.mjs';

async function loadProfileScope(userId) {
  const { rows } = await query(
    `SELECT assigned_region, assigned_distrito, assigned_servicio, assigned_barrio
     FROM profiles WHERE user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

function resolveProfileEmail(profile) {
  const em = String(profile?.email || '').trim().toLowerCase();
  if (em.includes('@')) return em;
  const un = String(profile?.username || '').trim().toLowerCase();
  if (!un) return null;
  return `${un.replace(/[^a-z0-9._-]/g, '') || 'user'}@mrv.import`;
}

async function upsertAuthForProfile(userId, email, passwordHash) {
  const em = String(email || '').trim().toLowerCase();
  if (!em.includes('@')) {
    throw new Error('Email inválido en perfil');
  }
  const { rows: byEmail } = await query(
    `SELECT user_id FROM auth_credentials WHERE lower(trim(email)) = $1 LIMIT 1`,
    [em]
  );
  if (byEmail[0] && byEmail[0].user_id !== userId) {
    await query(`DELETE FROM auth_credentials WHERE user_id = $1`, [byEmail[0].user_id]);
  }
  const { rows: cred } = await query(`SELECT user_id FROM auth_credentials WHERE user_id = $1 LIMIT 1`, [userId]);
  if (cred[0]) {
    await query('UPDATE auth_credentials SET password_hash = $1, email = $2 WHERE user_id = $3', [
      passwordHash,
      em,
      userId,
    ]);
  } else {
    await query(`INSERT INTO auth_credentials (user_id, email, password_hash) VALUES ($1,$2,$3)`, [
      userId,
      em,
      passwordHash,
    ]);
  }
  const { rows: pRow } = await query(`SELECT email FROM profiles WHERE user_id = $1`, [userId]);
  if (!String(pRow[0]?.email || '').trim().includes('@')) {
    await query(`UPDATE profiles SET email = $1, updated_at = now() WHERE user_id = $2`, [em, userId]);
  }
}

let roundHistoryTableReady = false;
async function ensureRoundHistoryTable() {
  if (roundHistoryTableReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS round_monitoring_history (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      round_local_id text,
      round_codigo text,
      modulo_label text NOT NULL,
      assigned_region text,
      assigned_distrito text,
      assigned_servicio text,
      efectivas int NOT NULL DEFAULT 0,
      no_efectivas int NOT NULL DEFAULT 0,
      fallidas int NOT NULL DEFAULT 0,
      renuentes int NOT NULL DEFAULT 0,
      total_ninos int NOT NULL DEFAULT 0,
      vacunados int NOT NULL DEFAULT 0,
      visitadas int NOT NULL DEFAULT 0,
      total_casas int NOT NULL DEFAULT 20,
      cobertura_vacunacion double precision,
      aprobado boolean NOT NULL DEFAULT false,
      completada_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS round_history_user_idx ON round_monitoring_history (user_id, completada_at DESC)`
  );
  await query(`ALTER TABLE round_monitoring_history ADD COLUMN IF NOT EXISTS round_codigo text`);
  await query(`ALTER TABLE round_monitoring_history ADD COLUMN IF NOT EXISTS barrio text`);
  await query(`ALTER TABLE round_monitoring_history ADD COLUMN IF NOT EXISTS responsable text`);
  await query(`ALTER TABLE round_monitoring_history ADD COLUMN IF NOT EXISTS entrevistador text`);
  await query(`ALTER TABLE round_monitoring_history ADD COLUMN IF NOT EXISTS colaboradores_json jsonb`);
  roundHistoryTableReady = true;
}

let roundDraftsTableReady = false;
async function ensureRoundDraftsTable() {
  if (roundDraftsTableReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS round_monitoring_drafts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_user_id uuid NOT NULL,
      round_local_id text NOT NULL,
      round_codigo text,
      modulo_label text,
      payload jsonb NOT NULL,
      participant_user_ids uuid[] NOT NULL DEFAULT '{}',
      efectivas_count int NOT NULL DEFAULT 0,
      total_casas int NOT NULL DEFAULT 20,
      fase text,
      is_active boolean NOT NULL DEFAULT true,
      updated_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (owner_user_id, round_local_id)
    )
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS round_drafts_participant_idx ON round_monitoring_drafts USING gin (participant_user_ids)`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS round_drafts_active_idx ON round_monitoring_drafts (is_active, updated_at DESC)`
  );
  roundDraftsTableReady = true;
}

function countEfectivasInRound(round) {
  const casas = round?.casas || [];
  return casas.filter((c) => c.guardada && c.estado === 'E').length;
}

const META_CASAS_EFECTIVAS = 20;

function isRoundPayloadActive(round) {
  if (!round || round.fase === 'start') return false;
  return countEfectivasInRound(round) < META_CASAS_EFECTIVAS;
}

function participantIdsForRound(ownerId, round) {
  const ids = new Set([String(ownerId)]);
  const extra = round?.colaboradorUserIds;
  if (Array.isArray(extra)) {
    for (const id of extra) {
      if (id) ids.add(String(id));
    }
  }
  return [...ids];
}

function mapRoundHistoryRow(row) {
  const completada = row.completada_at ? new Date(row.completada_at).getTime() : Date.now();
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    round_local_id: row.round_local_id,
    round_codigo: row.round_codigo,
    barrio: row.barrio,
    responsable: row.responsable,
    entrevistador: row.entrevistador,
    colaboradores: (() => {
      const raw = row.colaboradores_json;
      if (Array.isArray(raw)) return raw;
      if (raw && typeof raw === 'object') return raw;
      if (!raw) return [];
      try {
        return JSON.parse(String(raw));
      } catch {
        return [];
      }
    })(),
    display_name: row.display_name,
    email: row.email,
    assigned_region: row.assigned_region,
    assigned_distrito: row.assigned_distrito,
    assigned_servicio: row.assigned_servicio,
    nombre: row.modulo_label,
    coberturaVacunacion: row.cobertura_vacunacion != null ? Number(row.cobertura_vacunacion) : null,
    aprobado: Boolean(row.aprobado),
    efectivas: Number(row.efectivas) || 0,
    noEfectivas: Number(row.no_efectivas) || 0,
    fallidas: Number(row.fallidas) || 0,
    renuentes: Number(row.renuentes) || 0,
    totalNinos: Number(row.total_ninos) || 0,
    vacunados: Number(row.vacunados) || 0,
    visitadas: Number(row.visitadas) || 0,
    totalCasas: Number(row.total_casas) || 20,
    completadaAt: completada,
  };
}

const JWT_EXPIRES_IN = '7d';

const CORS_DEFAULT_ORIGINS = [
  'https://mrvpai.web.app',
  'https://mrvpai.firebaseapp.com',
  'https://rapid-vaccinator-main.vercel.app',
  'http://localhost:8080',
  'http://localhost:5173',
];

function corsOriginCallback(origin, callback) {
  if (!origin) {
    callback(null, true);
    return;
  }
  const allowed = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
    : CORS_DEFAULT_ORIGINS;
  if (allowed.includes('*') || allowed.includes(origin)) {
    callback(null, true);
    return;
  }
  callback(null, true);
}

export function createApp() {
  const app = express();
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN === '*' ? true : corsOriginCallback,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '8mb' }));

  app.get('/api/health', async (_req, res) => {
    try {
      await query('SELECT 1');
      let padronCount = null;
      let padronErr = null;
      try {
        const { rows } = await padronQuery('SELECT count(*)::int AS n FROM base_personas');
        padronCount = rows[0]?.n ?? 0;
      } catch (e) {
        padronErr = e.message;
      }
      res.json({
        ok: true,
        db: 'aiven',
        padronSplit: Boolean(process.env.PADRON_DATABASE_URL),
        padronCount,
        padronErr,
        capacity: {
          ...getPoolConfig(),
          targetConcurrentSessions: 800,
        },
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  function mapNominaRow(row) {
    const doc =
      String(row.nomina_documento || '')
        .replace(/\D/g, '')
        .trim() ||
      String(row.username || '')
        .replace(/\D/g, '')
        .trim();
    const rawName = String(row.display_name || '').trim();
    const esPlaceholder =
      !rawName ||
      /\@system\.vaccinator|@mrv\.import/i.test(rawName) ||
      /^CI\s*[\d.\s-]+$/i.test(rawName) ||
      (doc && rawName.replace(/\D/g, '') === doc);
    const nombre = rawName && !esPlaceholder ? rawName : '';
    const email = String(row.email || '').trim().toLowerCase();
    const emailOk =
      email.includes('@') &&
      !email.endsWith('@system.vaccinator.local') &&
      !email.endsWith('@mrv.import');
    const un = String(row.username || '').trim();
    const username = un.includes('@') ? doc || un : un;
    return {
      documento: doc,
      nombre,
      username,
      email: emailOk ? email : null,
      fecha_nacimiento: null,
      assigned_region: row.assigned_region,
      assigned_distrito: row.assigned_distrito,
      assigned_servicio: row.assigned_servicio,
    };
  }

  /** Búsqueda pública de brigadistas en nómina (registro, sin token). */
  app.get('/api/public/nomina-search', async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      const digits = q.replace(/\D/g, '');
      const hasLetter = /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(q);
      const tokens = q
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3);

      if (!hasLetter && digits.length < 4) {
        res.json({ data: [] });
        return;
      }
      if (hasLetter && tokens.length === 0 && q.length < 3) {
        res.json({ data: [] });
        return;
      }

      let rows;
      const docDigitsSql = `regexp_replace(COALESCE(username, ''), '[^0-9]', '', 'g')`;
      const baseFilter = `COALESCE(is_active, true) = true
        AND (
          nomina_documento IS NOT NULL
          OR length(${docDigitsSql}) >= 4
          OR length(trim(COALESCE(display_name, ''))) >= 3
        )`;

      const nominaCols = `nomina_documento, username, display_name, email, assigned_region, assigned_distrito, assigned_servicio`;

      if (!hasLetter && digits.length >= 4) {
        const exactOnly = digits.length >= 7;
        const { rows: r } = await query(
          exactOnly
            ? `SELECT ${nominaCols} FROM profiles
               WHERE ${baseFilter}
                 AND (nomina_documento = $1 OR ${docDigitsSql} = $1)
               ORDER BY display_name
               LIMIT 8`
            : `SELECT ${nominaCols} FROM profiles
               WHERE ${baseFilter}
                 AND (
                   nomina_documento = $1
                   OR nomina_documento LIKE $1 || '%'
                   OR ${docDigitsSql} = $1
                   OR ${docDigitsSql} LIKE $1 || '%'
                 )
               ORDER BY
                 CASE WHEN nomina_documento = $1 OR ${docDigitsSql} = $1 THEN 0 ELSE 1 END,
                 display_name
               LIMIT 15`,
          [digits]
        );
        rows = r;
      } else if (tokens.length >= 2) {
        const conds = tokens.map((_, i) => `lower(display_name) LIKE $${i + 1}`);
        const params = tokens.map((t) => `%${t}%`);
        const { rows: r } = await query(
          `SELECT ${nominaCols} FROM profiles
           WHERE ${baseFilter} AND (${conds.join(' AND ')})
           ORDER BY display_name
           LIMIT 15`,
          params
        );
        rows = r;
      } else {
        const term = `%${(tokens[0] || q).toLowerCase()}%`;
        const docLike = digits.length >= 4 ? `${digits}%` : null;
        const { rows: r } = await query(
          `SELECT ${nominaCols} FROM profiles
           WHERE ${baseFilter}
             AND (
               lower(display_name) LIKE $1
               OR lower(username) LIKE $1
               OR ($2::text IS NOT NULL AND (nomina_documento LIKE $2 OR ${docDigitsSql} LIKE $2))
             )
           ORDER BY
             CASE WHEN lower(display_name) LIKE $3 THEN 0 ELSE 1 END,
             display_name
           LIMIT 15`,
          [term, docLike, `${(tokens[0] || q).toLowerCase()}%`]
        );
        rows = r;
      }

      res.json({ data: rows.map(mapNominaRow) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/auth/login', loginRateLimit, async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        res.status(400).json({ error: 'Email y contraseña requeridos' });
        return;
      }
      const id = String(email).trim().toLowerCase();
      const { rows } = await query(
        `SELECT ac.user_id, ac.email, ac.password_hash, p.display_name, p.username, p.is_active, p.is_approved, p.must_change_password
         FROM auth_credentials ac
         JOIN profiles p ON p.user_id = ac.user_id
         WHERE lower(trim(ac.email)) = $1 OR lower(trim(p.username)) = $1
         LIMIT 1`,
        [id]
      );
      let row = rows[0];
      // Compatibilidad con migraciones: perfil activo con username pero sin fila en auth_credentials.
      // Si existe otra credencial con el mismo email, reutiliza hash y deja entrar con su propio perfil.
      if (!row && !id.includes('@')) {
        const { rows: profileRows } = await query(
          `SELECT user_id, email, display_name, username, is_active, is_approved, must_change_password
           FROM profiles
           WHERE lower(trim(username)) = $1
           LIMIT 1`,
          [id]
        );
        const profile = profileRows[0];
        const profileEmail = String(profile?.email || '').trim().toLowerCase();
        if (profile && profileEmail.includes('@')) {
          const { rows: authRows } = await query(
            `SELECT password_hash, email FROM auth_credentials
             WHERE lower(trim(email)) = $1
             LIMIT 1`,
            [profileEmail]
          );
          const auth = authRows[0];
          if (auth?.password_hash) {
            row = {
              ...profile,
              password_hash: auth.password_hash,
              email: auth.email || profileEmail,
            };
          }
        }
      }
      if (!row || !(await bcrypt.compare(password, row.password_hash))) {
        res.status(401).json({ error: 'Credenciales inválidas' });
        return;
      }
      const em = String(row.email || id).trim().toLowerCase();
      if (!row.is_active) {
        res.status(403).json({ error: 'Cuenta inactiva' });
        return;
      }
      if (!row.is_approved) {
        res.status(403).json({ error: 'Cuenta pendiente de aprobación' });
        return;
      }
      const token = jwt.sign({ sub: row.user_id, email: em }, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
      res.json({
        token,
        user: {
          id: row.user_id,
          email: em,
          nombre: row.display_name || em,
          username: row.username,
          is_approved: row.is_approved,
          must_change_password: row.must_change_password,
        },
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/auth/resolve-email', async (req, res) => {
    try {
      const username = String(req.query.username || '').trim().toLowerCase();
      if (!username) {
        res.json({ email: null });
        return;
      }
      const { rows: rpc } = await query('SELECT resolve_email_by_username($1) AS email', [username]);
      let email = rpc[0]?.email;
      if (!email) {
        const { rows } = await query(
          `SELECT lower(trim(email)) AS email FROM profiles WHERE lower(trim(username)) = $1 LIMIT 1`,
          [username]
        );
        email = rows[0]?.email;
      }
      res.json({ email: email || null });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/auth/signup', async (req, res) => {
    try {
      const result = await handleAuthSignup(req.body);
      res.status(result.status).json(result.body);
    } catch (e) {
      if (e.code === '23505') {
        res.status(409).json({ error: 'Correo o usuario ya registrado' });
        return;
      }
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/auth/me', authMiddleware, async (req, res) => {
    try {
      const { rows } = await query(
        `SELECT p.*, COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles
         FROM profiles p LEFT JOIN user_roles ur ON ur.user_id = p.user_id
         WHERE p.user_id = $1 GROUP BY p.id`,
        [req.user.sub]
      );
      const p = rows[0];
      if (!p) {
        res.status(404).json({ error: 'Perfil no encontrado' });
        return;
      }
      res.json({
        user: {
          id: p.user_id,
          email: p.email,
          nombre: p.display_name,
          username: p.username,
          is_active: p.is_active,
          is_approved: p.is_approved,
          must_change_password: p.must_change_password,
          roles: p.roles || [],
        },
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
    try {
      const { password } = req.body || {};
      const pwErr = validateStrongPassword(password);
      if (pwErr) {
        res.status(400).json({ error: pwErr });
        return;
      }
      const hash = await bcrypt.hash(password, 10);
      await query(`UPDATE auth_credentials SET password_hash = $1 WHERE user_id = $2`, [hash, req.user.sub]);
      await query(`UPDATE profiles SET must_change_password = false, updated_at = now() WHERE user_id = $1`, [
        req.user.sub,
      ]);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  async function loadOrgStructurePayload() {
    const [regiones, distritos, servicios, barrios] = await Promise.all([
      query('SELECT id, nombre, codigo FROM regiones_sanitarias ORDER BY nombre'),
      query('SELECT id, nombre, region_id FROM distritos ORDER BY nombre'),
      query('SELECT id, nombre, distrito_id FROM servicios_salud ORDER BY nombre'),
      query('SELECT id, nombre, distrito_id FROM barrios ORDER BY nombre'),
    ]);
    return {
      regiones: regiones.rows,
      distritos: distritos.rows,
      servicios: servicios.rows,
      barrios: barrios.rows,
    };
  }

  /** Catálogo territorial para registro (sin login). */
  app.get('/api/public/org-structure', async (_req, res) => {
    try {
      res.json(await loadOrgStructurePayload());
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/org/structure', authMiddleware, async (_req, res) => {
    try {
      res.json(await loadOrgStructurePayload());
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/org/barrios', authMiddleware, async (req, res) => {
    try {
      const distritoId = Number(req.query.distrito_id);
      if (!Number.isFinite(distritoId) || distritoId < 1) {
        res.status(400).json({ error: 'distrito_id requerido' });
        return;
      }
      let rows = [];
      try {
        const result = await query(
          'SELECT id, nombre, distrito_id FROM barrios WHERE distrito_id = $1 ORDER BY nombre',
          [distritoId]
        );
        rows = result.rows || [];
      } catch (dbErr) {
        console.warn('[org/barrios] Aiven:', dbErr.message);
      }
      if (rows.length === 0) {
        rows = await fetchBarriosByDistritoFromSupabase(distritoId);
      }
      res.json({
        barrios: rows.map((r) => ({
          id: Number(r.id),
          nombre: String(r.nombre),
          distrito_id: Number(r.distrito_id),
        })),
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/padron/documento', authMiddleware, padronSearchRateLimit, async (req, res) => {
    try {
      const doc = String(req.query.doc || '').trim();
      const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
      const { rows } = await padronQuery('SELECT * FROM buscar_padron_documento($1, $2)', [doc, limit]);
      res.json({ data: rows });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/padron/search', authMiddleware, padronSearchRateLimit, async (req, res) => {
    try {
      const term = String(req.query.term || '').trim();
      const { rows } = await padronQuery('SELECT * FROM search_personas_mejorada($1)', [term]);
      res.json({ data: rows });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  const PADRON_SELECT = `id, nombre, tipo_documento, documento, fecha_nacimiento, sexo, region_sanitaria, distrito, servicio_salud, documento_madre, nombre_madre, edad_anos, edad_meses, historial_spr`;

  app.get('/api/padron/historial-spr', authMiddleware, async (req, res) => {
    try {
      const doc = String(req.query.doc || '').trim();
      const tipo = String(req.query.tipo || 'CI').trim();
      if (!doc) {
        res.json({ data: null });
        return;
      }
      let padronSql = `SELECT nombre, documento, edad_anos, edad_meses, historial_spr FROM base_personas WHERE documento = $1`;
      const padronParams = [doc];
      if (tipo) {
        padronSql += ` AND upper(tipo_documento) = upper($2)`;
        padronParams.push(tipo);
      }
      padronSql += ' LIMIT 1';
      let { rows: padronRows } = await padronQuery(padronSql, padronParams);
      if (!padronRows[0] && tipo) {
        const { rows: fallback } = await padronQuery(
          `SELECT nombre, documento, edad_anos, edad_meses, historial_spr FROM base_personas WHERE documento = $1 LIMIT 1`,
          [doc]
        );
        padronRows = fallback;
      }
      const p0 = padronRows[0];
      const { rows: visitas } = await query(
        `SELECT id, fecha_hora, estado_vacuna, dosis_spr, fecha_dosis_spr, esquema_completo, tiene_cvs,
                region, distrito, servicio, motivo, responsable
         FROM registros_vacunacion
         WHERE documento = $1
         ORDER BY fecha_hora DESC
         LIMIT 30`,
        [doc]
      );
      res.json({
        data: {
          documento: doc,
          nombre: p0?.nombre ?? null,
          padron: p0?.historial_spr
            ? {
                ...(typeof p0.historial_spr === 'object' ? p0.historial_spr : JSON.parse(p0.historial_spr)),
                edad_anos: p0.edad_anos ?? undefined,
                edad_meses: p0.edad_meses ?? undefined,
              }
            : p0?.edad_anos != null || p0?.edad_meses != null
              ? { edad_anos: p0.edad_anos, edad_meses: p0.edad_meses, dosis: [] }
              : null,
          visitas_mrv: visitas || [],
        },
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/padron/by-documento', authMiddleware, async (req, res) => {
    try {
      const doc = String(req.query.doc || '').trim();
      const tipo = String(req.query.tipo || '').trim();
      let sql = `SELECT ${PADRON_SELECT}
        FROM base_personas WHERE documento = $1`;
      const params = [doc];
      if (tipo) {
        sql += ` AND upper(tipo_documento) = upper($2)`;
        params.push(tipo);
      }
      sql += ' LIMIT 1';
      let { rows } = await padronQuery(sql, params);
      if (!rows[0] && tipo) {
        const fb = await padronQuery(
          `SELECT ${PADRON_SELECT} FROM base_personas WHERE documento = $1 LIMIT 1`,
          [doc]
        );
        rows = fb.rows;
      }
      res.json({ data: rows[0] || null });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/padron/count', authMiddleware, async (_req, res) => {
    try {
      const { rows } = await padronQuery('SELECT count(*)::int AS count FROM base_personas');
      res.json({ count: rows[0]?.count ?? 0 });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/padron/page', authMiddleware, padronPageRateLimit, async (req, res) => {
    try {
      const offset = Math.max(0, Number(req.query.offset) || 0);
      const limit = Math.min(2000, Math.max(1, Number(req.query.limit) || 500));
      const { rows } = await padronQuery(
        `SELECT ${PADRON_SELECT}
         FROM base_personas ORDER BY documento OFFSET $1 LIMIT $2`,
        [offset, limit]
      );
      res.json({ data: rows });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/padron/query', authMiddleware, padronSearchRateLimit, async (req, res) => {
    try {
      const { normalized, isNumeric, tokens = [], limit = 80 } = req.body || {};
      const lim = Math.min(200, Math.max(1, Number(limit) || 80));
      if (!normalized || String(normalized).trim().length < 1) {
        res.json({ data: [] });
        return;
      }
      const term = String(normalized).trim();
      if (isNumeric) {
        const { rows } = await padronQuery(
          `SELECT ${PADRON_SELECT}
           FROM base_personas WHERE documento = $1 OR documento LIKE $1 || '%' LIMIT $2`,
          [term, lim]
        );
        res.json({ data: rows });
        return;
      }
      const toks = (tokens || []).filter((t) => String(t).length >= 1).slice(0, 6);
      if (toks.length === 0) {
        res.json({ data: [] });
        return;
      }
      let sql = `SELECT ${PADRON_SELECT} FROM base_personas WHERE `;
      const params = [];
      const parts = toks.map((t, i) => {
        params.push(`%${String(t).trim()}%`);
        return `nombre ILIKE $${i + 1}`;
      });
      sql += parts.join(' AND ') + ` LIMIT $${params.length + 1}`;
      params.push(lim);
      const { rows } = await padronQuery(sql, params);
      res.json({ data: rows });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/padron/busqueda-adjuntos', authMiddleware, async (req, res) => {
    try {
      const { uploadBufferToGoogleDrive, isGoogleDriveConfigured } = await import('./googleDrive.mjs');
      if (!isGoogleDriveConfigured()) {
        res.status(503).json({
          error:
            'Google Drive no configurado. Ver docs/GOOGLE-DRIVE-ADJUNTOS.md (GOOGLE_DRIVE_CLIENT_ID, SECRET, REFRESH_TOKEN).',
        });
        return;
      }
      const body = req.body || {};
      const documento = String(body.documento || '').trim();
      if (documento.length < 4) {
        res.status(400).json({ error: 'documento inválido' });
        return;
      }
      const images = Array.isArray(body.images) ? body.images : [];
      if (images.length === 0 || images.length > 2) {
        res.status(400).json({ error: 'Enviá entre 1 y 2 imágenes' });
        return;
      }
      const urls = [];
      for (const img of images) {
        const b64 = String(img.dataBase64 || '').replace(/^data:[^;]+;base64,/, '');
        if (!b64) {
          res.status(400).json({ error: 'dataBase64 vacío' });
          return;
        }
        const buf = Buffer.from(b64, 'base64');
        if (buf.length > 5_000_000) {
          res.status(400).json({ error: 'Imagen demasiado grande (máx. ~5 MB)' });
          return;
        }
        const mimeType = String(img.mimeType || 'image/jpeg');
        const filename = String(img.filename || 'imagen.jpg').slice(0, 80);
        const up = await uploadBufferToGoogleDrive({ buffer: buf, mimeType, filename, documento });
        urls.push(up);
      }
      res.json({ urls });
    } catch (e) {
      console.error('[busqueda-adjuntos]', e);
      res.status(500).json({ error: e.message || 'Error al subir a Drive' });
    }
  });

  app.post('/api/padron/datos-personales', authMiddleware, async (req, res) => {
    try {
      const body = req.body || {};
      const lim = Math.min(50, Math.max(1, Number(body.limit) || 25));
      const madre = String(body.documentoMadrePadre || '').replace(/\D/g, '');
      const fecha = String(body.fechaNacimiento || '').trim().slice(0, 10);
      const sexo = String(body.sexo || '').trim().toUpperCase();
      const tokens = [body.nombre1, body.nombre2, body.apellido1, body.apellido2]
        .map((t) =>
          String(t || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase()
        )
        .filter((t) => t.length >= 2);

      let sql = `SELECT ${PADRON_SELECT} FROM base_personas WHERE 1=1`;
      const params = [];
      let i = 1;

      if (madre.length >= 6) {
        sql += ` AND documento_madre = $${i++}`;
        params.push(madre);
      }
      if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        sql += ` AND fecha_nacimiento = $${i++}`;
        params.push(fecha);
      }
      if (sexo === 'M' || sexo === 'F') {
        sql += ` AND sexo = $${i++}`;
        params.push(sexo);
      }
      for (const t of tokens) {
        params.push(`%${t}%`);
        sql += ` AND nombre ILIKE $${i++}`;
      }

      sql += ` ORDER BY nombre LIMIT $${i}`;
      params.push(Math.min(200, lim * 4));

      const { rows } = await padronQuery(sql, params);
      res.json({ data: (rows || []).slice(0, lim) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /** Alta de una persona en padrón (brigadista en terreno, sin CI o no encontrada). */
  app.post('/api/padron/persona', authMiddleware, async (req, res) => {
    try {
      const body = req.body || {};
      const nombre = String(body.nombre || '').trim();
      const documento = String(body.documento || '').trim();
      const tipo_documento = String(body.tipo_documento || 'CI').trim().toUpperCase() || 'CI';
      const fecha_nacimiento = String(body.fecha_nacimiento || '').trim().slice(0, 10) || null;
      const sexo = String(body.sexo || '').trim().toUpperCase() || null;
      if (!nombre || nombre.length < 3) {
        res.status(400).json({ error: 'Ingresá el nombre completo del niño/a.' });
        return;
      }
      if (!documento || documento.length < 4) {
        res.status(400).json({ error: 'Ingresá CI o código temporal (iniciales + fecha de nacimiento).' });
        return;
      }
      const { rows: dup } = await padronQuery(`SELECT id FROM base_personas WHERE documento = $1 LIMIT 1`, [
        documento,
      ]);
      if (dup[0]) {
        res.status(409).json({ error: 'Ya existe una persona con ese documento/código en el padrón.' });
        return;
      }
      const { rows } = await padronQuery(
        `INSERT INTO base_personas (
          nombre, tipo_documento, documento, fecha_nacimiento, sexo,
          region_sanitaria, distrito, servicio_salud, documento_madre, nombre_madre
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING ${PADRON_SELECT}`,
        [
          nombre,
          tipo_documento,
          documento,
          fecha_nacimiento,
          sexo === 'M' || sexo === 'F' ? sexo : null,
          body.region_sanitaria || null,
          body.distrito || null,
          body.servicio_salud || null,
          body.documento_madre || null,
          body.nombre_madre || null,
        ]
      );
      res.json({ data: rows[0] || null });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/registros', authMiddleware, async (req, res) => {
    try {
      const r = req.body || {};
      const cols = [
        'user_id', 'region', 'distrito', 'servicio', 'barrio', 'responsable', 'nombre', 'documento',
        'fecha_nacimiento', 'edad', 'sexo', 'libreta', 'estado_vacuna', 'motivo', 'latitud', 'longitud',
        'tipo_vivienda', 'esquema_completo', 'fuente_verificacion', 'accion_tomada', 'observaciones',
        'fecha_dosis_spr', 'dosis_spr', 'estado_intervencion', 'tiene_cvs', 'tipo_documento', 'responsable_id',
        'transcripcion_clip', 'enlace_imagen_1', 'enlace_imagen_2',
      ];
      const vals = cols.map((c) => (c === 'user_id' ? req.user.sub : r[c] ?? null));
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
      const { rows } = await query(
        `INSERT INTO registros_vacunacion (${cols.join(',')}) VALUES (${placeholders}) RETURNING id, fecha_hora`,
        vals
      );
      const id = rows[0]?.id;
      if (!id) {
        res.status(500).json({ error: 'No se pudo confirmar el guardado en la base de datos.' });
        return;
      }
      res.json({
        ok: true,
        id,
        persisted: true,
        storage: 'aiven',
        fecha_hora: rows[0]?.fecha_hora,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  function countFridayAlertasFromRows(rows) {
    let pendientesTranscripcion = 0;
    let cambiosResidencia = 0;
    for (const r of rows) {
      const tieneImg = Boolean(
        String(r.enlace_imagen_1 || '').trim() || String(r.enlace_imagen_2 || '').trim()
      );
      if (tieneImg && !String(r.transcripcion_clip || '').trim()) pendientesTranscripcion += 1;
      if (String(r.observaciones || '').includes('[Cambio de residencia]')) {
        cambiosResidencia += 1;
      }
    }
    return { pendientesTranscripcion, cambiosResidencia };
  }

  app.get('/api/registros/alertas-viernes', authMiddleware, async (req, res) => {
    try {
      const roles = await getUserRoles(req.user.sub);
      const scope = await loadProfileScope(req.user.sub);
      const reportScope = resolveReportScope(scope, roles);
      let rows;
      if (reportScope.mode === 'own') {
        ({ rows } = await query(
          `SELECT enlace_imagen_1, enlace_imagen_2, transcripcion_clip, observaciones
           FROM registros_vacunacion
           WHERE user_id = $1 AND fecha_hora >= NOW() - INTERVAL '7 days'`,
          [req.user.sub]
        ));
      } else {
        ({ rows } = await query(
          `SELECT enlace_imagen_1, enlace_imagen_2, transcripcion_clip, observaciones, region, distrito, servicio, barrio
           FROM registros_vacunacion
           WHERE fecha_hora >= NOW() - INTERVAL '7 days'
           ORDER BY fecha_hora DESC
           LIMIT 20000`
        ));
        rows = filterRowsByReportScope(rows, reportScope);
      }
      res.json(countFridayAlertasFromRows(rows));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/registros', authMiddleware, async (req, res) => {
    try {
      const limit = Math.min(10000, Math.max(1, Number(req.query.limit) || 2500));
      const roles = await getUserRoles(req.user.sub);
      const privileged = roles.includes('admin') || roles.includes('super_admin');
      const scope = await loadProfileScope(req.user.sub);
      let rows;
      if (privileged) {
        const fetchLimit = hasProfileScopeAssignment(scope)
          ? Math.min(10000, limit * 4)
          : Math.max(limit, 10000);
        ({ rows } = await query(
          `SELECT * FROM registros_vacunacion ORDER BY fecha_hora DESC LIMIT $1`,
          [fetchLimit]
        ));
        const merged = await listRegistrosMerged({
          aivenRows: rows,
          scope,
          limit,
          forceNational: !hasProfileScopeAssignment(scope),
        });
        res.json({ data: merged.data, sources: merged.sources });
        return;
      }
      ({ rows } = await query(
        `SELECT * FROM registros_vacunacion WHERE user_id = $1 ORDER BY fecha_hora DESC LIMIT $2`,
        [req.user.sub, limit]
      ));
      res.json({ data: rows });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /** Listado para panel admin: nacional sin asignación; zonal si tiene región+distrito. */
  app.get('/api/admin/registros', authMiddleware, requireAdmin, async (req, res) => {
    try {
      const limit = Math.min(10000, Math.max(1, Number(req.query.limit) || 10000));
      const scope = await loadProfileScope(req.user.sub);
      const national = req.query.national === '1' || req.query.national === 'true';
      const { rows: countRows } = await query(`SELECT count(*)::int AS n FROM registros_vacunacion`);
      const aivenTotal = countRows[0]?.n ?? 0;
      const supaTotal = await countRegistrosInSupabase();
      const fetchLimit = Math.max(limit, 10000);
      const { rows } = await query(
        `SELECT * FROM registros_vacunacion ORDER BY fecha_hora DESC LIMIT $1`,
        [fetchLimit]
      );
      const merged = await listRegistrosMerged({
        aivenRows: rows,
        scope,
        limit,
        forceNational: national,
      });
      const totalNational = Math.max(aivenTotal, aivenTotal + supaTotal);
      res.json({
        data: merged.data,
        total: merged.data.length > 0 ? merged.sources.merged : totalNational,
        totalAiven: aivenTotal,
        totalSupabase: supaTotal,
        sources: merged.sources,
        scope: scope || null,
        nationalView: national || !hasProfileScopeAssignment(scope),
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /** Importar / actualizar registros desde Excel MRV_Registros (export de la app). */
  app.post('/api/admin/registros/import', authMiddleware, requireAdmin, async (req, res) => {
    try {
      const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
      if (!rows.length) {
        res.status(400).json({ error: 'Enviá al menos una fila en rows.' });
        return;
      }
      let inserted = 0;
      let skipped = 0;
      for (const raw of rows) {
        const r = mapExcelRowToRegistro(raw, req.user.sub);
        if (!r) {
          skipped++;
          continue;
        }
        await upsertRegistroRow(query, r);
        inserted++;
      }
      const { rows: countRows } = await query(`SELECT count(*)::int AS n FROM registros_vacunacion`);
      res.json({ ok: true, inserted, skipped, total: countRows[0]?.n ?? inserted });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  function buildRegistroPatch(body) {
    const allowed = [
      'nombre',
      'documento',
      'region',
      'distrito',
      'servicio',
      'barrio',
      'estado_vacuna',
      'motivo',
      'observaciones',
      'responsable',
      'tipo_vivienda',
      'latitud',
      'longitud',
    ];
    const sets = [];
    const vals = [];
    let i = 1;
    for (const key of allowed) {
      if (body[key] !== undefined) {
        sets.push(`${key} = $${i++}`);
        vals.push(body[key]);
      }
    }
    if (body.estado_vacunacion !== undefined && body.estado_vacuna === undefined) {
      sets.push(`estado_vacuna = $${i++}`);
      vals.push(body.estado_vacunacion);
    }
    return { sets, vals, nextIndex: i };
  }

  app.patch('/api/registros/:id', authMiddleware, async (req, res) => {
    try {
      const id = req.params.id;
      const { rows: own } = await query(`SELECT user_id FROM registros_vacunacion WHERE id = $1`, [id]);
      if (!own[0]) {
        res.status(404).json({ error: 'Registro no encontrado' });
        return;
      }
      const roles = await getUserRoles(req.user.sub);
      const privileged = roles.includes('admin') || roles.includes('super_admin');
      if (!privileged && String(own[0].user_id) !== String(req.user.sub)) {
        res.status(403).json({ error: 'No podés editar este registro' });
        return;
      }
      const { sets, vals, nextIndex } = buildRegistroPatch(req.body || {});
      if (!sets.length) {
        res.status(400).json({ error: 'Sin campos para actualizar' });
        return;
      }
      vals.push(id);
      await query(`UPDATE registros_vacunacion SET ${sets.join(', ')} WHERE id = $${nextIndex}`, vals);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch('/api/admin/registros/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
      const id = req.params.id;
      const { sets, vals, nextIndex } = buildRegistroPatch(req.body || {});
      if (!sets.length) {
        res.status(400).json({ error: 'Sin campos para actualizar' });
        return;
      }
      vals.push(id);
      await query(`UPDATE registros_vacunacion SET ${sets.join(', ')} WHERE id = $${nextIndex}`, vals);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/registros/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
      await query('DELETE FROM registros_vacunacion WHERE id = $1', [req.params.id]);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/rounds/history', authMiddleware, async (req, res) => {
    try {
      await ensureRoundHistoryTable();
      const b = req.body || {};
      const scope = await loadProfileScope(req.user.sub);
      const { rows } = await query(
        `INSERT INTO round_monitoring_history (
          user_id, round_local_id, round_codigo, modulo_label, assigned_region, assigned_distrito, assigned_servicio,
          barrio, responsable, entrevistador, colaboradores_json,
          efectivas, no_efectivas, fallidas, renuentes, total_ninos, vacunados, visitadas, total_casas,
          cobertura_vacunacion, aprobado, completada_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
        RETURNING id`,
        [
          req.user.sub,
          b.round_local_id || null,
          b.round_codigo || null,
          String(b.modulo_label || 'Ronda').trim(),
          b.assigned_region || scope?.assigned_region || null,
          b.assigned_distrito || scope?.assigned_distrito || null,
          b.assigned_servicio || scope?.assigned_servicio || null,
          b.barrio || String(b.modulo_label || '').trim() || null,
          b.responsable || scope?.display_name || null,
          b.entrevistador || b.responsable || scope?.display_name || null,
          JSON.stringify(Array.isArray(b.colaboradores) ? b.colaboradores : []),
          Number(b.efectivas) || 0,
          Number(b.no_efectivas) || 0,
          Number(b.fallidas) || 0,
          Number(b.renuentes) || 0,
          Number(b.total_ninos) || 0,
          Number(b.vacunados) || 0,
          Number(b.visitadas) || 0,
          Number(b.total_casas) || 20,
          b.cobertura_vacunacion != null ? Number(b.cobertura_vacunacion) : null,
          Boolean(b.aprobado),
          b.completada_at ? new Date(Number(b.completada_at)) : new Date(),
        ]
      );
      res.json({ ok: true, id: rows[0]?.id });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  const MAX_ACTIVE_ROUNDS = 2;

  app.put('/api/rounds/draft', authMiddleware, async (req, res) => {
    try {
      await ensureRoundDraftsTable();
      const round = req.body?.round;
      if (!round?.id) {
        res.status(400).json({ error: 'round.id requerido' });
        return;
      }
      const roundLocalId = String(round.id);
      const { rows: prev } = await query(
        `SELECT owner_user_id, participant_user_ids, payload FROM round_monitoring_drafts WHERE round_local_id = $1`,
        [roundLocalId]
      );
      let ownerId = String(round.userId || req.user.sub);
      if (prev.length) {
        ownerId = String(prev[0].owner_user_id);
        const parts = (prev[0].participant_user_ids || []).map(String);
        if (ownerId !== req.user.sub && !parts.includes(req.user.sub)) {
          res.status(403).json({ error: 'No tenés permiso para actualizar esta ronda.' });
          return;
        }
      } else if (ownerId !== req.user.sub) {
        res.status(403).json({ error: 'Solo el titular puede iniciar la ronda en el servidor.' });
        return;
      }
      let payload = round;
      if (prev.length && prev[0].payload) {
        const existing =
          typeof prev[0].payload === 'object' ? prev[0].payload : JSON.parse(String(prev[0].payload));
        payload = mergeRoundPayload(existing, round);
      }
      payload.totalCasas = META_CASAS_EFECTIVAS;
      const active = isRoundPayloadActive(payload);
      const participants = participantIdsForRound(ownerId, payload);
      const efectivas = countEfectivasInRound(payload);
      const totalCasas = META_CASAS_EFECTIVAS;

      if (active) {
        const { rows: existing } = await query(
          `SELECT round_local_id FROM round_monitoring_drafts
           WHERE owner_user_id = $1 AND round_local_id = $2`,
          [ownerId, roundLocalId]
        );
        if (!existing.length) {
          const { rows: cnt } = await query(
            `SELECT count(*)::int AS n FROM round_monitoring_drafts
             WHERE is_active = true
               AND $1::uuid = ANY(participant_user_ids)
               AND NOT (owner_user_id = $2 AND round_local_id = $3)`,
            [req.user.sub, ownerId, roundLocalId]
          );
          if ((cnt[0]?.n || 0) >= MAX_ACTIVE_ROUNDS) {
            res.status(409).json({
              error: `Ya tenés ${MAX_ACTIVE_ROUNDS} rondas activas. Concluí o descartá una antes de abrir otra.`,
            });
            return;
          }
        }
      }

      const { rows } = await query(
        `INSERT INTO round_monitoring_drafts (
          owner_user_id, round_local_id, round_codigo, modulo_label, payload,
          participant_user_ids, efectivas_count, total_casas, fase, is_active, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
        ON CONFLICT (owner_user_id, round_local_id) DO UPDATE SET
          round_codigo = EXCLUDED.round_codigo,
          modulo_label = EXCLUDED.modulo_label,
          payload = EXCLUDED.payload,
          participant_user_ids = EXCLUDED.participant_user_ids,
          efectivas_count = EXCLUDED.efectivas_count,
          total_casas = EXCLUDED.total_casas,
          fase = EXCLUDED.fase,
          is_active = EXCLUDED.is_active,
          updated_at = now()
        RETURNING id`,
        [
          ownerId,
          roundLocalId,
          payload.codigo || null,
          String(payload.moduloLabel || 'Ronda').trim(),
          JSON.stringify(payload),
          participants,
          efectivas,
          totalCasas,
          payload.fase || null,
          active,
        ]
      );
      res.json({ ok: true, id: rows[0]?.id });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/rounds/drafts', authMiddleware, async (req, res) => {
    try {
      await ensureRoundDraftsTable();
      const { rows } = await query(
        `SELECT payload, updated_at FROM round_monitoring_drafts
         WHERE is_active = true AND $1::uuid = ANY(participant_user_ids)
         ORDER BY updated_at DESC
         LIMIT $2`,
        [req.user.sub, MAX_ACTIVE_ROUNDS]
      );
      const data = rows.map((r) => {
        const p = typeof r.payload === 'object' ? r.payload : JSON.parse(String(r.payload));
        return { ...p, updatedAt: new Date(r.updated_at).getTime() };
      });
      res.json({ data });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/rounds/draft/:localId', authMiddleware, async (req, res) => {
    try {
      await ensureRoundDraftsTable();
      const localId = String(req.params.localId || '').trim();
      if (!localId) {
        res.status(400).json({ error: 'localId requerido' });
        return;
      }
      await query(
        `DELETE FROM round_monitoring_drafts
         WHERE round_local_id = $1
           AND (owner_user_id = $2 OR $2::uuid = ANY(participant_user_ids))`,
        [localId, req.user.sub]
      );
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/rounds/history', authMiddleware, async (req, res) => {
    try {
      await ensureRoundHistoryTable();
      const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
      const { rows } = await query(
        `SELECT h.*, p.display_name, p.email
         FROM round_monitoring_history h
         LEFT JOIN profiles p ON p.user_id = h.user_id
         WHERE h.user_id = $1
         ORDER BY h.completada_at DESC
         LIMIT $2`,
        [req.user.sub, limit]
      );
      res.json({ data: rows.map(mapRoundHistoryRow) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/admin/rounds/history', authMiddleware, requireAdmin, async (req, res) => {
    try {
      await ensureRoundHistoryTable();
      const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
      const clauses = [];
      const params = [];
      let idx = 1;
      const region = String(req.query.region || '').trim();
      const distrito = String(req.query.distrito || '').trim();
      const servicio = String(req.query.servicio || '').trim();
      const responsable = String(req.query.responsable || '').trim();
      const roundCodigo = String(req.query.round_codigo || '').trim();
      if (region) {
        clauses.push(`COALESCE(h.assigned_region, p.assigned_region) ILIKE $${idx++}`);
        params.push(`%${region}%`);
      }
      if (distrito) {
        clauses.push(`COALESCE(h.assigned_distrito, p.assigned_distrito) ILIKE $${idx++}`);
        params.push(`%${distrito}%`);
      }
      if (servicio) {
        clauses.push(`COALESCE(h.assigned_servicio, p.assigned_servicio) ILIKE $${idx++}`);
        params.push(`%${servicio}%`);
      }
      if (responsable) {
        clauses.push(
          `(h.responsable ILIKE $${idx} OR h.entrevistador ILIKE $${idx} OR p.display_name ILIKE $${idx})`
        );
        params.push(`%${responsable}%`);
        idx++;
      }
      if (roundCodigo) {
        clauses.push(`h.round_codigo ILIKE $${idx++}`);
        params.push(`%${roundCodigo}%`);
      }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      params.push(limit);
      const { rows } = await query(
        `SELECT h.*, p.display_name, p.email,
                p.assigned_region AS profile_region,
                p.assigned_distrito AS profile_distrito,
                p.assigned_servicio AS profile_servicio
         FROM round_monitoring_history h
         LEFT JOIN profiles p ON p.user_id = h.user_id
         ${where}
         ORDER BY h.completada_at DESC
         LIMIT $${idx}`,
        params
      );
      res.json({
        data: rows.map((r) =>
          mapRoundHistoryRow({
            ...r,
            assigned_region: r.assigned_region || r.profile_region,
            assigned_distrito: r.assigned_distrito || r.profile_distrito,
            assigned_servicio: r.assigned_servicio || r.profile_servicio,
          })
        ),
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/profiles/scope', authMiddleware, async (req, res) => {
    try {
      const { rows } = await query(
        `SELECT assigned_region, assigned_distrito, assigned_servicio, assigned_barrio, scope_locked FROM profiles WHERE user_id = $1`,
        [req.user.sub]
      );
      res.json({ data: rows[0] || null });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch('/api/profiles/scope', authMiddleware, async (req, res) => {
    try {
      const { rows: cur } = await query(`SELECT scope_locked FROM profiles WHERE user_id = $1`, [req.user.sub]);
      if (!cur[0]) {
        res.status(404).json({ error: 'Perfil no encontrado' });
        return;
      }
      const body = req.body || {};
      const region = String(body.assigned_region ?? '').trim() || null;
      const distrito = String(body.assigned_distrito ?? '').trim() || null;
      const servicio = String(body.assigned_servicio ?? '').trim() || null;
      const roles = await getUserRoles(req.user.sub);
      const privileged = roles.includes('admin') || roles.includes('super_admin');
      if (!region || !distrito) {
        if (!privileged) {
          res.status(400).json({ error: 'Región y distrito son obligatorios.' });
          return;
        }
        await query(
          `UPDATE profiles SET assigned_region = NULL, assigned_distrito = NULL, assigned_servicio = NULL,
           updated_at = now() WHERE user_id = $1`,
          [req.user.sub]
        );
        res.json({
          data: {
            assigned_region: null,
            assigned_distrito: null,
            assigned_servicio: null,
            scope_locked: false,
          },
        });
        return;
      }
      await query(
        `UPDATE profiles SET assigned_region = $1, assigned_distrito = $2, assigned_servicio = $3,
         scope_locked = false, updated_at = now()
         WHERE user_id = $4`,
        [region, distrito, servicio, req.user.sub]
      );
      res.json({
        data: {
          assigned_region: region,
          assigned_distrito: distrito,
          assigned_servicio: servicio,
          scope_locked: false,
        },
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/user-roles', authMiddleware, async (req, res) => {
    try {
      const userId = req.query.user_id || req.user.sub;
      const { rows } = await query(`SELECT role FROM user_roles WHERE user_id = $1`, [userId]);
      res.json({ data: rows });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /** Usuarios aprobados con la misma asignación territorial (para añadir a la ronda). */
  app.get('/api/equipo/misma-asignacion', authMiddleware, async (req, res) => {
    try {
      const scope = await loadProfileScope(req.user.sub);
      const region = String(req.query.region || scope?.assigned_region || '').trim();
      const distrito = String(req.query.distrito || scope?.assigned_distrito || '').trim();
      const servicio = String(req.query.servicio || scope?.assigned_servicio || '').trim();
      if (!region || !distrito) {
        res.json({ data: [] });
        return;
      }
      const params = [req.user.sub, region, distrito];
      let servicioSql = '';
      if (servicio) {
        servicioSql = ` AND lower(trim(coalesce(assigned_servicio, ''))) = lower(trim($${params.length + 1}))`;
        params.push(servicio);
      }
      const { rows } = await query(
        `SELECT user_id, display_name
         FROM profiles
         WHERE is_active = true AND is_approved = true
           AND user_id != $1
           AND lower(trim(coalesce(assigned_region, ''))) = lower(trim($2))
           AND lower(trim(coalesce(assigned_distrito, ''))) = lower(trim($3))
           ${servicioSql}
           AND display_name IS NOT NULL AND trim(display_name) <> ''
         ORDER BY display_name
         LIMIT 40`,
        params
      );
      res.json({
        data: rows.map((r) => ({
          user_id: String(r.user_id),
          display_name: String(r.display_name).trim(),
        })),
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Admin ---
  app.get('/api/admin/profiles-roles', authMiddleware, requireAdmin, async (_req, res) => {
    try {
      const { rows: profiles } = await query(
        `SELECT p.user_id, p.display_name, p.email, p.username, p.is_active, p.is_approved, p.approved_at,
                p.assigned_region, p.assigned_distrito, p.assigned_servicio, p.assigned_barrio, p.scope_locked,
                p.created_at, (ac.user_id IS NOT NULL) AS has_credentials
         FROM profiles p
         LEFT JOIN auth_credentials ac ON ac.user_id = p.user_id
         ORDER BY p.created_at DESC LIMIT 5000`
      );
      const { rows: roles } = await query(`SELECT user_id, role FROM user_roles`);
      res.json({ profiles, roles });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch('/api/admin/profiles/:userId', authMiddleware, requireAdmin, async (req, res) => {
    try {
      const allowed = [
        'is_active', 'is_approved', 'assigned_region', 'assigned_distrito',
        'assigned_servicio', 'assigned_barrio', 'scope_locked', 'display_name', 'username',
      ];
      const patch = req.body || {};
      const sets = [];
      const vals = [];
      let i = 1;
      for (const k of allowed) {
        if (k in patch) {
          sets.push(`${k} = $${i++}`);
          vals.push(patch[k]);
        }
      }
      if (sets.length === 0) {
        res.status(400).json({ error: 'Sin campos' });
        return;
      }
      sets.push(`updated_at = now()`);
      vals.push(req.params.userId);
      await query(`UPDATE profiles SET ${sets.join(', ')} WHERE user_id = $${i}`, vals);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/admin/profiles/:userId/role', authMiddleware, requireAdmin, async (req, res) => {
    try {
      const { role } = req.body || {};
      if (!role) {
        res.status(400).json({ error: 'Rol requerido' });
        return;
      }
      const targetRoles = await getUserRoles(req.params.userId);
      const check = canAssignRole(req.userRoles, role, targetRoles);
      if (!check.ok) {
        res.status(403).json({ error: check.error });
        return;
      }
      await query('DELETE FROM user_roles WHERE user_id = $1', [req.params.userId]);
      await query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2::app_role)', [
        req.params.userId,
        role,
      ]);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/profiles/:userId/reset-password', authMiddleware, requireAdmin, async (req, res) => {
    try {
      const uid = req.params.userId;
      const temp = String(req.body?.temp_password || 'Cambio2026!');
      const hash = await bcrypt.hash(temp, 10);
      const { rows: prof } = await query(
        `SELECT user_id, email, username FROM profiles WHERE user_id = $1 LIMIT 1`,
        [uid]
      );
      if (!prof[0]) {
        res.status(404).json({ error: 'Usuario no encontrado' });
        return;
      }
      const em = resolveProfileEmail(prof[0]);
      if (!em) {
        res.status(400).json({ error: 'El perfil no tiene email ni usuario válido' });
        return;
      }
      await upsertAuthForProfile(uid, em, hash);
      const { rows: roleRows } = await query(`SELECT 1 FROM user_roles WHERE user_id = $1 LIMIT 1`, [uid]);
      if (!roleRows[0]) {
        await query(`INSERT INTO user_roles (user_id, role) VALUES ($1,'user')`, [uid]);
      }
      await query('UPDATE profiles SET must_change_password = true, updated_at = now() WHERE user_id = $1', [uid]);
      res.json({ ok: true, password: temp, email: em });
    } catch (e) {
      if (e.code === '23505') {
        res.status(409).json({ error: 'Conflicto de email con otro usuario. Contacte soporte.' });
        return;
      }
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/admin/users/:userId', authMiddleware, requireAdmin, async (req, res) => {
    try {
      const uid = req.params.userId;
      await query('DELETE FROM registros_vacunacion WHERE user_id = $1 OR responsable_id = $1', [uid]);
      await query('DELETE FROM user_roles WHERE user_id = $1', [uid]);
      await query('DELETE FROM auth_credentials WHERE user_id = $1', [uid]);
      await query('DELETE FROM profiles WHERE user_id = $1', [uid]);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/admin/pending-approvals', authMiddleware, requireAdmin, async (_req, res) => {
    try {
      const { rows } = await query(
        `SELECT p.user_id, p.email, p.display_name, p.username, p.created_at,
                (SELECT ur.role FROM user_roles ur WHERE ur.user_id = p.user_id LIMIT 1) AS rol
         FROM profiles p WHERE p.is_approved = false AND p.is_active = true ORDER BY p.created_at DESC`
      );
      res.json({ data: rows });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/users/:userId/approve', authMiddleware, requireAdmin, async (req, res) => {
    try {
      await query(
        `UPDATE profiles SET is_approved = true, approved_at = now(), approved_by = $2, updated_at = now() WHERE user_id = $1`,
        [req.params.userId, req.user.sub]
      );
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/users/:userId/reject', authMiddleware, requireAdmin, async (req, res) => {
    try {
      await query(
        `UPDATE profiles SET is_approved = false, is_active = false, updated_at = now() WHERE user_id = $1`,
        [req.params.userId]
      );
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/users/create', authMiddleware, requireAdmin, async (req, res) => {
    try {
      const {
        email,
        password,
        displayName,
        username,
        role = 'user',
        is_approved = true,
        assigned_region,
        assigned_distrito,
        assigned_servicio,
        assigned_barrio,
      } = req.body || {};
      const emReq = String(email || '').trim().toLowerCase();
      const un = String(username || '').trim().toLowerCase();
      const pwd = password || 'Cambio2026!';
      if (!emReq.includes('@') || !un) {
        res.status(400).json({ error: 'Email y username requeridos' });
        return;
      }
      const { rows: existingProf } = await query(
        `SELECT user_id, email, username FROM profiles
         WHERE lower(trim(username)) = $1 OR lower(trim(email)) = $2
         LIMIT 1`,
        [un, emReq]
      );
      const hash = await bcrypt.hash(pwd, 10);
      const now = new Date().toISOString();

      if (existingProf[0]) {
        const userId = existingProf[0].user_id;
        const loginEmail = resolveProfileEmail(existingProf[0]) || emReq;
        const { rows: hasCred } = await query(
          `SELECT user_id FROM auth_credentials WHERE user_id = $1 LIMIT 1`,
          [userId]
        );
        if (hasCred[0]) {
          res.status(409).json({
            error: 'Usuario ya existe en la lista. Usá «Reset clave» para generar una contraseña nueva.',
          });
          return;
        }
        await query(
          `UPDATE profiles SET
             display_name = COALESCE(NULLIF($2,''), display_name),
             is_active = true, is_approved = $3, must_change_password = true,
             assigned_region = COALESCE($4, assigned_region),
             assigned_distrito = COALESCE($5, assigned_distrito),
             assigned_servicio = COALESCE($6, assigned_servicio),
             assigned_barrio = COALESCE($7, assigned_barrio),
             updated_at = $8
           WHERE user_id = $1`,
          [
            userId,
            displayName || un,
            Boolean(is_approved),
            assigned_region || null,
            assigned_distrito || null,
            assigned_servicio || null,
            assigned_barrio || null,
            now,
          ]
        );
        await upsertAuthForProfile(userId, loginEmail, hash);
        const { rows: roleRows } = await query(`SELECT 1 FROM user_roles WHERE user_id = $1 LIMIT 1`, [userId]);
        if (!roleRows[0]) {
          await query(`INSERT INTO user_roles (user_id, role) VALUES ($1,$2)`, [userId, role]);
        }
        res.json({ ok: true, user_id: userId, password: pwd, activated: true, email: loginEmail });
        return;
      }

      const userId = randomUUID();
      await query(
        `INSERT INTO profiles (
           user_id, email, username, display_name, is_active, is_approved, must_change_password,
           assigned_region, assigned_distrito, assigned_servicio, assigned_barrio, scope_locked,
           created_at, updated_at
         ) VALUES ($1,$2,$3,$4,true,$5,true,$6,$7,$8,$9,false,$10,$10)`,
        [
          userId,
          emReq,
          un,
          displayName || un,
          Boolean(is_approved),
          assigned_region || null,
          assigned_distrito || null,
          assigned_servicio || null,
          assigned_barrio || null,
          now,
        ]
      );
      await upsertAuthForProfile(userId, emReq, hash);
      await query(`INSERT INTO user_roles (user_id, role) VALUES ($1,$2)`, [userId, role]);
      res.json({ ok: true, user_id: userId, password: pwd });
    } catch (e) {
      if (e.code === '23505') {
        res.status(409).json({ error: 'Usuario ya existe' });
        return;
      }
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/org/import', authMiddleware, requireAdmin, async (req, res) => {
    try {
      const { rows: orgRows } = req.body || {};
      if (!Array.isArray(orgRows) || orgRows.length === 0) {
        res.status(400).json({ error: 'Sin filas' });
        return;
      }
      await query('DELETE FROM barrios');
      await query('DELETE FROM servicios_salud');
      await query('DELETE FROM distritos');
      await query('DELETE FROM regiones_sanitarias');
      const regionMap = new Map();
      const distritoMap = new Map();
      for (const item of orgRows) {
        const reg = String(item.region || '').trim();
        const dis = String(item.distrito || '').trim();
        const serv = String(item.servicio || '').trim();
        const bar = String(item.barrio || '').trim();
        if (!reg || !dis) continue;
        let regionId = regionMap.get(reg);
        if (!regionId) {
          const ins = await query('INSERT INTO regiones_sanitarias (nombre) VALUES ($1) RETURNING id', [reg]);
          regionId = ins.rows[0].id;
          regionMap.set(reg, regionId);
        }
        const dKey = `${reg}|${dis}`;
        let distritoId = distritoMap.get(dKey);
        if (!distritoId) {
          const ins = await query('INSERT INTO distritos (nombre, region_id) VALUES ($1,$2) RETURNING id', [dis, regionId]);
          distritoId = ins.rows[0].id;
          distritoMap.set(dKey, distritoId);
        }
        if (serv) {
          const exists = await query('SELECT id FROM servicios_salud WHERE nombre = $1 AND distrito_id = $2 LIMIT 1', [
            serv,
            distritoId,
          ]);
          if (!exists.rows.length) {
            await query('INSERT INTO servicios_salud (nombre, distrito_id) VALUES ($1,$2)', [serv, distritoId]);
          }
        }
        if (bar) {
          const exists = await query('SELECT id FROM barrios WHERE nombre = $1 AND distrito_id = $2 LIMIT 1', [bar, distritoId]);
          if (!exists.rows.length) {
            await query('INSERT INTO barrios (nombre, distrito_id) VALUES ($1,$2)', [bar, distritoId]);
          }
        }
      }
      res.json({ ok: true, regiones: regionMap.size, distritos: distritoMap.size });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/padron/batch', authMiddleware, requireAdmin, async (req, res) => {
    try {
      const { rows: batch } = req.body || {};
      if (!Array.isArray(batch) || !batch.length) {
        res.status(400).json({ error: 'Batch vacío' });
        return;
      }
      let inserted = 0;
      for (const r of batch) {
        await padronQuery(
          `INSERT INTO base_personas (nombre, tipo_documento, documento, fecha_nacimiento, sexo, region_sanitaria, distrito, servicio_salud, documento_madre, nombre_madre)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (documento) DO UPDATE SET
             nombre = EXCLUDED.nombre, tipo_documento = EXCLUDED.tipo_documento, fecha_nacimiento = EXCLUDED.fecha_nacimiento,
             sexo = EXCLUDED.sexo, region_sanitaria = EXCLUDED.region_sanitaria, distrito = EXCLUDED.distrito,
             servicio_salud = EXCLUDED.servicio_salud, documento_madre = EXCLUDED.documento_madre, nombre_madre = EXCLUDED.nombre_madre`,
          [
            r.nombre, r.tipo_documento || 'CI', r.documento, r.fecha_nacimiento || null, r.sexo || null,
            r.region_sanitaria || null, r.distrito || null, r.servicio_salud || null,
            r.documento_madre || null, r.nombre_madre || null,
          ]
        );
        inserted++;
      }
      res.json({ ok: true, inserted });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/admin/padron/all', authMiddleware, requireAdmin, async (_req, res) => {
    try {
      await padronQuery('DELETE FROM base_personas');
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/sync-profiles', authMiddleware, requireAdmin, async (_req, res) => {
    res.json({ ok: true, message: 'No requerido en Aiven (auth en auth_credentials)' });
  });

  app.post('/api/admin/users/import', authMiddleware, requireAdmin, async (req, res) => {
    try {
      const { users = [], replace = false } = req.body || {};
      if (!Array.isArray(users) || !users.length) {
        res.status(400).json({ error: 'Sin usuarios' });
        return;
      }
      let created = 0;
      let updated = 0;
      let skipped = 0;
      let errors = 0;
      let deactivated = 0;
      const now = new Date().toISOString();
      const usernamesInFile = new Set();

      for (const u of users) {
        const ci = String(u.ci || '').trim();
        const nombres = String(u.nombres_completos || '').trim();
        const username = String(u.nombre_usuario || ci).trim().toLowerCase();
        const region = String(u.assigned_region || '').trim() || null;
        const distrito = String(u.assigned_distrito || '').trim() || null;
        const servicio = String(u.assigned_servicio || '').trim() || null;
        if (!ci || !nombres || !username) {
          errors++;
          continue;
        }
        usernamesInFile.add(username);
        const email = `${username.replace(/[^a-z0-9._-]/g, '') || ci}@mrv.import`;
        const { rows: existing } = await query(
          `SELECT user_id FROM profiles WHERE lower(username) = $1 OR lower(email) = $2 LIMIT 1`,
          [username, email.toLowerCase()]
        );
        if (existing.length) {
          try {
            const userId = existing[0].user_id;
            await query(
              `UPDATE profiles SET display_name = $1, assigned_region = $2, assigned_distrito = $3,
               assigned_servicio = $4, is_active = true, is_approved = true, updated_at = $5
               WHERE user_id = $6`,
              [nombres, region, distrito, servicio, now, userId]
            );
            const { rows: hasCred } = await query(
              `SELECT user_id FROM auth_credentials WHERE user_id = $1 LIMIT 1`,
              [userId]
            );
            if (!hasCred[0]) {
              const pwd = `Mrv${ci.replace(/\D/g, '').slice(-4).padStart(4, '0')}!`;
              const hash = await bcrypt.hash(pwd, 10);
              await upsertAuthForProfile(userId, email, hash);
              const { rows: roleRows } = await query(`SELECT 1 FROM user_roles WHERE user_id = $1 LIMIT 1`, [
                userId,
              ]);
              if (!roleRows[0]) {
                await query(`INSERT INTO user_roles (user_id, role) VALUES ($1,'user')`, [userId]);
              }
            }
            updated++;
          } catch {
            errors++;
          }
          continue;
        }
        try {
          const userId = randomUUID();
          const pwd = `Mrv${ci.replace(/\D/g, '').slice(-4).padStart(4, '0')}!`;
          const hash = await bcrypt.hash(pwd, 10);
          await query(
            `INSERT INTO profiles (
               user_id, email, username, display_name, is_active, is_approved, must_change_password,
               assigned_region, assigned_distrito, assigned_servicio, scope_locked, created_at, updated_at
             ) VALUES ($1,$2,$3,$4,true,true,true,$5,$6,$7,false,$8,$8)`,
            [userId, email, username, nombres, region, distrito, servicio, now]
          );
          await query(`INSERT INTO auth_credentials (user_id, email, password_hash) VALUES ($1,$2,$3)`, [
            userId,
            email,
            hash,
          ]);
          await query(`INSERT INTO user_roles (user_id, role) VALUES ($1,'user')`, [userId]);
          created++;
        } catch {
          errors++;
        }
      }

      if (replace && usernamesInFile.size > 0) {
        const names = [...usernamesInFile];
        const placeholders = names.map((_, i) => `$${i + 1}`).join(',');
        const { rowCount } = await query(
          `UPDATE profiles p SET is_active = false, updated_at = now()
           FROM user_roles ur
           WHERE ur.user_id = p.user_id AND ur.role = 'user'
             AND lower(p.username) NOT IN (${placeholders})
             AND p.is_active = true`,
          names
        );
        deactivated = rowCount || 0;
      }

      res.json({ created, updated, skipped, errors, deactivated });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return app;
}
