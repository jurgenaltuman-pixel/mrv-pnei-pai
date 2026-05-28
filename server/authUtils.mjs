import jwt from 'jsonwebtoken';
import { query } from './db.mjs';

export function getJwtSecret() {
  return process.env.JWT_SECRET || 'cambiar-en-produccion-mrv-2026';
}

export function authMiddleware(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'No autorizado' });
    return;
  }
  try {
    req.user = jwt.verify(token, getJwtSecret());
    next();
  } catch {
    res.status(401).json({ error: 'Sesión inválida' });
  }
}

export async function getUserRoles(userId) {
  const { rows } = await query(`SELECT role FROM user_roles WHERE user_id = $1`, [userId]);
  return rows.map((r) => r.role);
}

export async function requireAdmin(req, res, next) {
  try {
    const roles = await getUserRoles(req.user.sub);
    if (!roles.includes('admin') && !roles.includes('super_admin')) {
      res.status(403).json({ error: 'Requiere rol admin' });
      return;
    }
    req.userRoles = roles;
    next();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
