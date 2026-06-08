import { Router } from 'express';
import { Unit, Department } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);

const unitOut = (u) => ({ id: String(u._id), name: u.name, code: u.code ?? null });
const deptOut = (d) => ({ id: String(d._id), name: d.name, unit_id: String(d.unitId) });

/** GET /api/org/units — list business units (หน่วยงาน). */
router.get(
  '/units',
  asyncHandler(async (req, res) => {
    const rows = await Unit.find().sort({ name: 1 }).lean();
    res.json({ data: rows.map(unitOut) });
  })
);

/**
 * GET /api/org/departments — list departments (แผนก), optionally by unit.
 * Query: ?unitId=<id>
 */
router.get(
  '/departments',
  asyncHandler(async (req, res) => {
    const { unitId } = req.query;
    const filter = unitId ? { unitId } : {};
    const rows = await Department.find(filter).sort({ name: 1 }).lean();
    res.json({ data: rows.map(deptOut) });
  })
);

export default router;
