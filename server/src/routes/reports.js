import { Router } from 'express';
import { getDb } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { sendInventoryReport } from '../services/inventoryEmail.js';

const router = Router();

router.post('/inventory/email', requireAuth, requireRole('Admin'), async (req, res, next) => {
  try {
    const listType = req.body?.listType;
    if (listType !== 'assets' && listType !== 'licenses') {
      console.warn('[inventory-report] Email not sent: invalid list type.');
      return res.status(400).json({ data: null, error: 'listType must be assets or licenses' });
    }
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 1000
      || ids.some((id) => !Number.isInteger(id) || id < 1)
      || new Set(ids).size !== ids.length) {
      console.warn(`[inventory-report] ${listType} email not sent: invalid selection.`);
      return res.status(400).json({ data: null, error: 'Select between 1 and 1000 unique records' });
    }

    const db = getDb();
    const table = listType === 'assets' ? 'Assets' : 'SoftwareLicenses';
    const fields = listType === 'assets'
      ? 'Name, Type, SerialNumber, PurchaseDate'
      : 'Name, PurchaseDate';
    const query = `SELECT ${fields} FROM ${table} WHERE Id IN (${ids.map(() => '?').join(', ')}) ORDER BY Name`;
    const stmt = db.prepare(query);
    stmt.bind(ids);
    const records = [];
    while (await stmt.step()) records.push(stmt.getAsObject());
    stmt.free();
    if (records.length !== ids.length) {
      console.warn(`[inventory-report] ${listType} email not sent: selected records changed or no longer exist.`);
      return res.status(404).json({ data: null, error: 'One or more selected records no longer exist' });
    }

    const result = await sendInventoryReport(listType, records);
    console.info(`[inventory-report] ${listType} email sent: ${result.recordCount} selected record(s), ${result.reportDate}.`);
    res.json({ data: result, error: null });
  } catch (err) {
    console.error(`[inventory-report] ${req.body?.listType || 'inventory'} email not sent: ${err.message}`);
    next(err);
  }
});

export default router;
