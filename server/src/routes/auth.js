import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getDb } from '../config/db.js';
import { getPool } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function getDbOrFail() {
  try {
    return getDb();
  } catch {
    throw new Error('Database not initialized');
  }
}

/** GET /api/auth/need-setup - no auth, returns { needSetup: true } when no admins exist */
router.get('/need-setup', async (req, res, next) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query('SELECT COUNT(*) AS cnt FROM dbo.Admins');
    const count = r.recordset?.[0]?.cnt ?? 0;
    return res.json({
      data: { needSetup: count === 0 },
      error: null,
    });
  } catch (err) {
    console.error('[auth] need-setup error:', err.message);
    return res.json({ data: { needSetup: true }, error: null });
  }
});

/** POST /api/auth/setup - create first admin when table is empty (no auth) */
router.post('/setup', async (req, res, next) => {
  try {
    const username = (req.body?.username ?? req.body?.Username ?? '').toString().trim();
    const password = (req.body?.password ?? req.body?.Password ?? '').toString();
    if (!username || !password) {
      return res.status(400).json({ data: null, error: 'Username and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ data: null, error: 'Password must be at least 6 characters' });
    }

    const pool = await getPool();
    const r = await pool.request().query('SELECT COUNT(*) AS cnt FROM dbo.Admins');
    const count = r.recordset?.[0]?.cnt ?? 0;
    if (count > 0) {
      return res.status(403).json({ data: null, error: 'Admin already exists. Use the login form.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const created = await pool.request()
      .input('username', username)
      .input('hash', hash)
      .query("INSERT INTO dbo.Admins (Username, PasswordHash, Role) OUTPUT INSERTED.Id VALUES (@username, @hash, N'Admin')");
    console.log('[auth] First admin created:', username);

    const token = jwt.sign(
      { sub: created.recordset[0].Id, username, role: 'Admin' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    return res.json({
      data: { token, user: { username, role: 'Admin' } },
      error: null,
    });
  } catch (err) {
    console.error('[auth] setup error:', err.message);
    next(err);
  }
});

/** POST /api/auth/login - username, password -> { token, user: { username } } */
router.post('/login', async (req, res, next) => {
  try {
    const username = (req.body?.username ?? req.body?.Username ?? '').toString().trim();
    const password = (req.body?.password ?? req.body?.Password ?? '').toString();
    if (!username || !password) {
      return res.status(400).json({ data: null, error: 'Username and password are required' });
    }

    const db = getDbOrFail();
    const stmt = db.prepare('SELECT Id, Username, PasswordHash, Role FROM Admins WHERE Username = ?');
    stmt.bind([username]);
    const admin = (await stmt.step()) ? stmt.getAsObject() : null;
    stmt.free();

    if (!admin) {
      console.warn('[auth] Login failed: no user found for username:', username);
      return res.status(401).json({ data: null, error: 'Invalid username or password' });
    }

    const match = await bcrypt.compare(password, admin.PasswordHash);
    if (!match) {
      console.warn('[auth] Login failed: wrong password for username:', username);
      return res.status(401).json({ data: null, error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { sub: admin.Id, username: admin.Username, role: admin.Role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({
      data: { token, user: { username: admin.Username, role: admin.Role } },
      error: null,
    });
  } catch (err) {
    console.error('[auth] login error:', err.message);
    next(err);
  }
});

/** GET /api/auth/me - return the current account and role. */
router.get('/me', requireAuth, async (req, res) => {
  return res.json({ data: { user: { username: req.user.username, role: req.user.role } }, error: null });
});

router.get('/users', requireAuth, requireRole('Admin'), async (req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(
      'SELECT Id AS id, Username AS username, Role AS role, CreatedAt AS createdAt FROM dbo.Admins ORDER BY Username'
    );
    return res.json({ data: result.recordset, error: null });
  } catch (err) {
    next(err);
  }
});

router.post('/users', requireAuth, requireRole('Admin'), async (req, res, next) => {
  try {
    const username = (req.body?.username ?? '').toString().trim();
    const password = (req.body?.password ?? '').toString();
    const role = (req.body?.role ?? '').toString();
    if (!username || !password || !['Admin', 'Editor'].includes(role)) {
      return res.status(400).json({ data: null, error: 'Username, password, and a valid role are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ data: null, error: 'Password must be at least 6 characters' });
    }
    const pool = await getPool();
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.request()
      .input('username', username)
      .input('hash', hash)
      .input('role', role)
      .query('INSERT INTO dbo.Admins (Username, PasswordHash, Role) OUTPUT INSERTED.Id, INSERTED.Username, INSERTED.Role VALUES (@username, @hash, @role)');
    return res.status(201).json({ data: result.recordset[0], error: null });
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id/role', requireAuth, requireRole('Admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const role = (req.body?.role ?? '').toString();
    if (!Number.isInteger(id) || id < 1 || !['Admin', 'Editor'].includes(role)) {
      return res.status(400).json({ data: null, error: 'A valid user id and role are required' });
    }
    const pool = await getPool();
    const target = await pool.request().input('id', id)
      .query('SELECT Id, Role FROM dbo.Admins WHERE Id = @id');
    if (!target.recordset?.length) {
      return res.status(404).json({ data: null, error: 'User not found' });
    }
    if (target.recordset[0].Role === 'Admin' && role !== 'Admin') {
      const admins = await pool.request().query("SELECT COUNT(*) AS count FROM dbo.Admins WHERE Role = N'Admin'");
      if (admins.recordset[0].count <= 1) {
        return res.status(409).json({ data: null, error: 'At least one Admin account must remain' });
      }
    }
    const result = await pool.request().input('id', id).input('role', role)
      .query('UPDATE dbo.Admins SET Role = @role OUTPUT INSERTED.Id AS id, INSERTED.Username AS username, INSERTED.Role AS role WHERE Id = @id');
    return res.json({ data: result.recordset[0], error: null });
  } catch (err) {
    next(err);
  }
});

router.delete('/users/:id', requireAuth, requireRole('Admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ data: null, error: 'A valid user id is required' });
    }
    if (id === Number(req.user.id)) {
      return res.status(400).json({ data: null, error: 'You cannot delete your own account' });
    }
    const pool = await getPool();
    const target = await pool.request().input('id', id)
      .query('SELECT Id, Role FROM dbo.Admins WHERE Id = @id');
    if (!target.recordset?.length) {
      return res.status(404).json({ data: null, error: 'User not found' });
    }
    if (target.recordset[0].Role === 'Admin') {
      const admins = await pool.request().query("SELECT COUNT(*) AS count FROM dbo.Admins WHERE Role = N'Admin'");
      if (admins.recordset[0].count <= 1) {
        return res.status(409).json({ data: null, error: 'At least one Admin account must remain' });
      }
    }
    await pool.request().input('id', id).query('DELETE FROM dbo.Admins WHERE Id = @id');
    return res.json({ data: { deleted: true }, error: null });
  } catch (err) {
    next(err);
  }
});

/** Seed default admin if Admins table is empty and ADMIN_USERNAME/ADMIN_PASSWORD are set. Call from startup. */
export async function seedDefaultAdminIfNeeded() {
  const pool = await getPool();
  const r = await pool.request().query('SELECT COUNT(*) AS cnt FROM dbo.Admins');
  const count = r.recordset?.[0]?.cnt ?? 0;
  if (count > 0) return;

  const adminUser = process.env.ADMIN_USERNAME?.trim();
  const adminPass = process.env.ADMIN_PASSWORD;
  if (!adminUser || !adminPass) return;

  const hash = await bcrypt.hash(adminPass, 10);
  await pool.request()
    .input('username', adminUser)
    .input('hash', hash)
    .query(
      `INSERT INTO dbo.Admins (Username, PasswordHash) VALUES (@username, @hash)`
    );
  console.log('[auth] Seeded default admin:', adminUser);
}

export default router;
