import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './db.mjs';
import { validateStrongPassword } from './passwordPolicy.mjs';
import { getJwtSecret } from './authUtils.mjs';

const JWT_EXPIRES_IN = '7d';

function digitsOnly(v) {
  return String(v || '').replace(/\D/g, '');
}

async function hasCredentials(userId) {
  const { rows } = await query(`SELECT 1 FROM auth_credentials WHERE user_id = $1 LIMIT 1`, [userId]);
  return rows.length > 0;
}

/** Perfil precargado (nómina / import) por documento o usuario numérico. */
async function findNominaPreload(docDigits) {
  if (docDigits.length < 4) return null;
  const { rows } = await query(
    `SELECT user_id, email, username, display_name, assigned_region, assigned_distrito, assigned_servicio,
            nomina_documento, is_approved
     FROM profiles
     WHERE is_active = true
       AND (
         nomina_documento = $1
         OR regexp_replace(COALESCE(username, ''), '[^0-9]', '', 'g') = $1
       )
     ORDER BY (nomina_documento IS NOT NULL) DESC, updated_at DESC NULLS LAST
     LIMIT 1`,
    [docDigits]
  );
  return rows[0] || null;
}

async function findProfilesByEmailOrUsername(em, un) {
  const { rows } = await query(
    `SELECT user_id, email, username, display_name, nomina_documento, is_approved,
            assigned_region, assigned_distrito, assigned_servicio
     FROM profiles
     WHERE lower(trim(email)) = $1 OR lower(trim(username)) = $2
     ORDER BY is_active DESC, updated_at DESC NULLS LAST
     LIMIT 5`,
    [em, un]
  );
  return rows;
}

/** Cuenta activa = fila en auth_credentials (login posible). */
async function findActiveAccountUserId({ email, username, excludeUserId = null }) {
  const em = String(email || '').trim().toLowerCase();
  const un = String(username || '').trim().toLowerCase();
  const { rows } = await query(
    `SELECT ac.user_id
     FROM auth_credentials ac
     LEFT JOIN profiles p ON p.user_id = ac.user_id
     WHERE ($1::text <> '' AND lower(trim(ac.email)) = $1)
        OR ($2::text <> '' AND lower(trim(p.username)) = $2)
     LIMIT 1`,
    [em, un]
  );
  const found = rows[0]?.user_id || null;
  if (!found || !excludeUserId) return found;
  return found === excludeUserId ? null : found;
}

async function upsertSignupCredentials(userId, email, passwordHash) {
  const em = String(email || '').trim().toLowerCase();
  await query(`DELETE FROM auth_credentials WHERE lower(trim(email)) = $1 AND user_id <> $2`, [em, userId]);
  const { rows: cred } = await query(`SELECT user_id FROM auth_credentials WHERE user_id = $1 LIMIT 1`, [userId]);
  if (cred[0]) {
    await query('UPDATE auth_credentials SET email = $1, password_hash = $2 WHERE user_id = $3', [
      em,
      passwordHash,
      userId,
    ]);
  } else {
    await query(`INSERT INTO auth_credentials (user_id, email, password_hash) VALUES ($1,$2,$3)`, [
      userId,
      em,
      passwordHash,
    ]);
  }
}

async function resolveClaimProfile(em, un, docDigits, nominaPreload) {
  if (nominaPreload) return nominaPreload;
  const candidates = await findProfilesByEmailOrUsername(em, un);
  for (const p of candidates) {
    if (!(await hasCredentials(p.user_id))) return p;
  }
  return null;
}

export async function handleAuthSignup(body) {
  const {
    email,
    password,
    displayName,
    username,
    assigned_region,
    assigned_distrito,
    assigned_servicio,
    nomina_documento,
  } = body || {};

  const em = String(email || '').trim().toLowerCase();
  const un = String(username || '').trim().toLowerCase();
  if (!em.includes('@') || !password || !un) {
    return { status: 400, body: { error: 'Datos de registro incompletos' } };
  }
  const pwErr = validateStrongPassword(password);
  if (pwErr) return { status: 400, body: { error: pwErr } };

  const docDigits = digitsOnly(nomina_documento) || digitsOnly(un);
  const nominaPreload = await findNominaPreload(docDigits);
  const autoApprove = true;

  let assignedRegion = String(assigned_region || '').trim() || null;
  let assignedDistrito = String(assigned_distrito || '').trim() || null;
  let assignedServicio = String(assigned_servicio || '').trim() || null;

  if (nominaPreload) {
    if (!assignedRegion) assignedRegion = nominaPreload.assigned_region?.trim() || null;
    if (!assignedDistrito) assignedDistrito = nominaPreload.assigned_distrito?.trim() || null;
    if (!assignedServicio) assignedServicio = nominaPreload.assigned_servicio?.trim() || null;
  }

  const scopeLocked = Boolean(assignedRegion && assignedDistrito);
  const hash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  const nominaDocStored = docDigits.length >= 4 ? docDigits : null;

  const claim = await resolveClaimProfile(em, un, docDigits, nominaPreload);
  const claimUserId = claim?.user_id || null;

  const otherEmailAccount = await findActiveAccountUserId({ email: em, username: '', excludeUserId: claimUserId });
  if (otherEmailAccount) {
    return {
      status: 409,
      body: { error: 'Este correo ya tiene cuenta activa. Usá «Ingresar» o «Olvidé mi contraseña».' },
    };
  }
  const otherUserAccount = await findActiveAccountUserId({ email: '', username: un, excludeUserId: claimUserId });
  if (otherUserAccount) {
    return {
      status: 409,
      body: { error: 'Este usuario ya tiene cuenta activa. Usá «Ingresar» con tu usuario y contraseña.' },
    };
  }

  let userId;
  if (claim) {
    userId = claim.user_id;
    await query(
      `UPDATE profiles SET
         email = $2,
         username = $3,
         display_name = $4,
         is_active = true,
         is_approved = true,
         must_change_password = false,
         assigned_region = COALESCE($5, assigned_region),
         assigned_distrito = COALESCE($6, assigned_distrito),
         assigned_servicio = COALESCE($7, assigned_servicio),
         nomina_documento = COALESCE($8, nomina_documento),
         scope_locked = $9,
         approved_at = COALESCE(approved_at, now()),
         updated_at = $10
       WHERE user_id = $1`,
      [
        userId,
        em,
        un,
        displayName || un,
        assignedRegion,
        assignedDistrito,
        assignedServicio,
        nominaDocStored,
        scopeLocked,
        now,
      ]
    );
    await upsertSignupCredentials(userId, em, hash);
    await query(`INSERT INTO user_roles (user_id, role) VALUES ($1,'user') ON CONFLICT DO NOTHING`, [userId]);
  } else {
    userId = randomUUID();
    await query(
      `INSERT INTO profiles (
         user_id, email, username, display_name, is_active, is_approved, must_change_password,
         assigned_region, assigned_distrito, assigned_servicio, nomina_documento, scope_locked,
         approved_at, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,true,true,false,$5,$6,$7,$8,$9,now(),$10,$10)`,
      [
        userId,
        em,
        un,
        displayName || un,
        assignedRegion,
        assignedDistrito,
        assignedServicio,
        nominaDocStored,
        scopeLocked,
        now,
      ]
    );
    await upsertSignupCredentials(userId, em, hash);
    await query(`INSERT INTO user_roles (user_id, role) VALUES ($1,'user') ON CONFLICT DO NOTHING`, [userId]);
  }

  const token = jwt.sign({ sub: userId, email: em }, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
  return {
    status: 200,
    body: {
      token,
      user: {
        id: userId,
        email: em,
        nombre: displayName || un,
        username: un,
        is_approved: true,
        must_change_password: false,
      },
      auto_approved: autoApprove,
    },
  };
}
