import jwt from 'jsonwebtoken';
import { getPool } from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return req.query?.token ?? null;
}

/**
 * Require valid JWT in Authorization: Bearer <token> or query.token (e.g. for invoice PDF link).
 * Loads the current account and role from the database for each valid token.
 */
export async function requireAuth(req, res, next) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ data: null, error: 'Authentication required' });
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ data: null, error: 'Invalid or expired token' });
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('username', payload.username)
      .query('SELECT Id, Username, Role FROM dbo.Admins WHERE Username = @username');
    const account = result.recordset?.[0];
    if (!account) {
      return res.status(401).json({ data: null, error: 'Account no longer exists' });
    }
    const roleValue = String(account.Role ?? '').trim().toLowerCase();
    const role = roleValue === 'admin' ? 'Admin' : roleValue === 'editor' ? 'Editor' : account.Role;
    req.user = { id: account.Id, username: account.Username, role };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ data: null, error: 'Insufficient permissions' });
    }
    next();
  };
}

export function authorizeApiAccess(req, res, next) {
  if (req.user?.role === 'Admin') return next();
  if (req.user?.role === 'Editor' && req.method !== 'DELETE') return next();
  return res.status(403).json({ data: null, error: 'Insufficient permissions' });
}
