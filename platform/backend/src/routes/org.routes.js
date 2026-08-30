import { Router } from 'express';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);

/** GET /api/org/units — list business units (หน่วยงาน). */
router.get(
  '/units',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `select id, name, code from units order by name`
    );
    res.json({ data: rows });
  })
);

/**
 * GET /api/org/departments — list departments (แผนก), optionally by unit.
 * Query: ?unitId=<uuid>
 */
router.get(
  '/departments',
  asyncHandler(async (req, res) => {
    const { unitId } = req.query;
    const { rows } = unitId
      ? await query(
          `select id, name, unit_id from departments
            where unit_id = $1 order by name`,
          [unitId]
        )
      : await query(
          `select id, name, unit_id from departments order by name`
        );
    res.json({ data: rows });
  })
);

export default router;
