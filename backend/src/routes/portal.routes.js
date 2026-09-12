import { Router } from 'express';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * สิ่งที่เกิดขึ้น "วันนี้" บนหน้าหลัก
 *
 * พอร์ทัลที่บริษัทใช้อยู่มีสองกล่องนี้ข้างปฏิทินวันหยุด — ใครลาวันนี้ และวันเกิด
 * ที่ใกล้ถึง ทั้งคู่เป็นข้อมูลที่คนทั้งบริษัทเห็นได้ ไม่ใช่ข้อมูลลับรายบุคคล
 * (เหตุผลการลาไม่ถูกส่งออกไป ส่งแค่ประเภทการลา)
 */
const router = Router();
router.use(requireAuth);

router.get('/today', asyncHandler(async (req, res) => {
  const onLeave = (await query(
    `select e.full_name, e.employee_code, u.name unit_name,
            l.leave_type, l.day_part, l.from_date, l.to_date
       from leave_requests l
       join employees e on e.id = l.employee_id
       left join units u on u.id = l.unit_id
      where l.status = 'อนุมัติ'
        and current_date between l.from_date and l.to_date
      order by e.full_name`)).rows;

  // วันเกิดใน 30 วันข้างหน้า — เทียบเฉพาะวัน-เดือน ข้ามปีได้
  const birthdays = (await query(
    `select full_name, employee_code, birth_date,
            (date_part('doy', make_date(date_part('year', current_date)::int,
                                        date_part('month', birth_date)::int,
                                        date_part('day', birth_date)::int))
             - date_part('doy', current_date))::int raw_days
       from employees
      where birth_date is not null and is_active
      order by 4`)).rows
    .map((r) => ({ ...r, days: r.raw_days < 0 ? r.raw_days + 365 : r.raw_days }))
    .filter((r) => r.days <= 30)
    .sort((a, b) => a.days - b.days)
    .slice(0, 8);

  res.json({ data: { onLeave, birthdays } });
}));

export default router;
