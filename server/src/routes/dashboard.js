import { Router } from 'express';
import { getDb } from '../config/db.js';

const router = Router();

function getDbOrFail() {
  try {
    return getDb();
  } catch {
    throw new Error('Database not initialized');
  }
}

// GET /api/dashboard/stats - dashboard statistics
router.get('/stats', async (_req, res, next) => {
  try {
    const db = getDbOrFail();

    const totalAssets = (await db.prepare('SELECT COUNT(*) AS n FROM Assets').get())?.n ?? 0;
    const activeRepairs = (await db
      .prepare("SELECT COUNT(*) AS n FROM Repairs WHERE Status != 'Completed'")
      .get())?.n ?? 0;

    const statusStmt = db.prepare(
      'SELECT Status, COUNT(*) AS count FROM Assets GROUP BY Status'
    );
    const assetsByStatus = { 'In Service': 0, Spare: 0, Maintenance: 0, Decommissioned: 0 };
    while (await statusStmt.step()) {
      const row = statusStmt.getAsObject();
      assetsByStatus[row.Status] = row.count;
    }
    statusStmt.free();

    // Asset warranty expirations: from Assets.WarrantyExpiry (current month + next month for visibility)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const startOfTwoMonths = new Date(now.getFullYear(), now.getMonth() + 2, 1)
      .toISOString()
      .slice(0, 10);
    const assetWarrantyStmt = db.prepare(`
      SELECT Id, Name, SerialNumber, Vendor, WarrantyExpiry AS ExpiryDate
      FROM Assets
      WHERE WarrantyExpiry IS NOT NULL AND WarrantyExpiry >= ? AND WarrantyExpiry < ?
      ORDER BY WarrantyExpiry ASC
      LIMIT 20
    `);
    assetWarrantyStmt.bind([startOfMonth, startOfTwoMonths]);
    const upcomingWarranties = [];
    while (await assetWarrantyStmt.step()) upcomingWarranties.push(assetWarrantyStmt.getAsObject());
    assetWarrantyStmt.free();

    const recentStmt = db.prepare(`
      SELECT r.Id, r.AssetId, r.IssueDescription, r.Status, r.StartDate, a.Name AS AssetName, a.SerialNumber AS AssetSerial
      FROM Repairs r
      JOIN Assets a ON a.Id = r.AssetId
      ORDER BY r.StartDate DESC
      LIMIT 5
    `);
    const recentActivity = [];
    while (await recentStmt.step()) recentActivity.push(recentStmt.getAsObject());
    recentStmt.free();

    res.json({
      data: {
        totalAssets,
        activeRepairs,
        assetsByStatus,
        upcomingWarranties,
        recentActivity,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
