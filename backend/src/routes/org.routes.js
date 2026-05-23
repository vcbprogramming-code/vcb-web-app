import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);

/** GET /api/org/units — list business units (หน่วยงาน). */
router.get(
  '/units',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('units')
      .select('id, name, code')
      .order('name');
    if (error) throw error;
    res.json({ data });
  })
);

/**
 * GET /api/org/departments — list departments (แผนก), optionally by unit.
 * Query: ?unitId=<uuid>
 */
router.get(
  '/departments',
  asyncHandler(async (req, res) => {
    let query = supabaseAdmin
      .from('departments')
      .select('id, name, unit_id')
      .order('name');
    if (req.query.unitId) query = query.eq('unit_id', req.query.unitId);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  })
);

export default router;
