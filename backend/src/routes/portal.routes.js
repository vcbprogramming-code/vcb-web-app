import { Router } from 'express';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * สิ่งที่เกิดขึ้น "วันนี้" บนหน้าหลัก
 *
 * พอร์ทัลที่บริษัทใช้อยู่มีสองกล่องนี้ข้างปฏิทินวันหยุด — ลาวันนี้ และวันเกิด
 * ที่กำลังจะถึง ทั้งคู่เป็นข้อมูลที่คนทั้งบริษัทเห็นได้ ไม่ใช่ข้อมูลลับรายบุคคล
 * (เหตุผลการลาไม่ถูกส่งออกไป ส่งแค่ประเภทการลา)
 */
const router = Router();
router.use(requireAuth);

router.get('/today', asyncHandler(async (req, res) => {
  const onLeave = (await query(
    // ทะเบียนพนักงานจริงของลูกค้ามีสองแถวที่ต้นทางไม่มีชื่อ กล่องนี้แสดงชื่อล้วน ๆ
    // ถ้าส่งค่าว่างออกไปจะกลายเป็นบรรทัดเปล่า จึงแสดงรหัสพนักงานแทน (แสดงผลเท่านั้น
    // ไม่แตะข้อมูล) · employee_code ยังส่งค่าที่เก็บไว้ตามเดิม เพราะหน้าจอใช้เป็น
    // กุญแจของแถว — รหัสจริงซ้ำกันได้ ใช้เป็นกุญแจแล้วจะชนกัน
    `select coalesce(nullif(btrim(e.full_name), ''), e.employee_code, '') as full_name,
            e.employee_code, u.name unit_name,
            l.leave_type, l.day_part, l.from_date, l.to_date
       from leave_requests l
       join employees e on e.id = l.employee_id
       left join units u on u.id = l.unit_id
      -- สถานะที่โมดูลบันทึกงานเขียนจริงคือ 'approved' (เคยเทียบคำไทยไว้ กล่องนี้จึงว่างเสมอ)
      where l.status in ('approved', 'อนุมัติ')
        and current_date between l.from_date and l.to_date
      order by e.full_name`)).rows;

  // สามคนที่วันเกิดใกล้ที่สุดจากทะเบียนพนักงาน — เท่าที่ระบบจริงแสดง และไม่จำกัด
  // ช่วงวัน จึงข้ามปีได้เอง (วันนี้ 27 ก.ย. → ธ.ค. → ม.ค.)
  //
  // คิดวันครบรอบด้วยการบวก "ปี" เข้ากับวันเกิดจริง ไม่ใช่ make_date(ปีนี้, เดือน, วัน)
  // เพราะคนที่เกิด 29 ก.พ. จะทำให้ make_date ของปีที่ไม่ใช่ปีอธิกสุรทินพังทั้ง
  // คำสั่ง (Postgres บวก interval แล้วถอยให้เป็นวันสุดท้ายของเดือนให้เอง)
  //
  // ส่งออกแค่ชื่อ แผนก และจำนวนวันที่เหลือ — ไม่ส่ง birth_date ออกไป เพราะปีเกิด
  // (= อายุ) ไม่ใช่สิ่งที่กล่องนี้ต้องใช้
  const birthdays = (await query(
    `with b as (
       select coalesce(nullif(btrim(e.full_name), ''), e.employee_code, '') as full_name,
              e.employee_code, d.name dept,
              (e.birth_date + make_interval(years => (extract(year from current_date)::int
                                                      - extract(year from e.birth_date)::int)))::date anniv
         from employees e
         left join departments d on d.id = e.department_id
        where e.birth_date is not null and e.is_active
     )
     select full_name, employee_code, dept,
            ((case when anniv >= current_date then anniv
                   else (anniv + interval '1 year')::date end) - current_date)::int days
       from b
      order by days, full_name
      limit 3`)).rows;

  res.json({ data: { onLeave, birthdays } });
}));

export default router;
