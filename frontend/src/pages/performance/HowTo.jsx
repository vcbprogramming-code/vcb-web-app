import { Modal } from '../../components/ui/index.js';
import { useT } from '../../lib/i18n.jsx';

/**
 * วิธีใช้งานหน้าบันทึกงาน — ห้าขั้น ถ้อยคำเดียวกับระบบที่ลูกค้าใช้อยู่
 * (Code.gs · openHowTo) รวมข้อ 4 ที่อธิบายว่าสองงานในวันเดียวถูกถ่วงน้ำหนัก
 * ครึ่ง-ครึ่ง ซึ่งเป็นคำถามที่ถูกถามซ้ำที่สุดเวลาดูยอดวันทำงานบนแดชบอร์ด
 */
const STEPS = [
  ['เลือกหน่วยงานและสัปดาห์', 'แถบด้านบน: เลือกหน่วยงาน เดือน และสัปดาห์ที่ต้องการบันทึก'],
  ['คลิกช่องว่างของพนักงาน', 'คลิกช่องที่ขึ้น “+ เลือกงาน” แล้วเลือกกิจกรรม — ถ้าระบบถามหมวดงาน ให้เลือกต่ออีกหนึ่งครั้ง'],
  ['ไม่ต้องกดบันทึก', 'ระบบบันทึกให้อัตโนมัติ — ช่องจะแสดงรหัสงานเมื่อบันทึกเสร็จ'],
  ['ทำ 2 งานในวันเดียว', 'หลังกรอกงานแรกแล้ว ปุ่ม “+ งานที่ 2” จะปรากฏใต้ช่อง · ระบบถ่วงน้ำหนักให้อัตโนมัติงานละ 50% (0.5 วันทำงาน) รวมเป็น 1 วันทำงานต่อคนต่อวันเสมอ — บนแดชบอร์ดจึงแบ่งครึ่ง-ครึ่ง ไม่ใช่ 1 วันทำงานต่องาน เพื่อไม่ให้วันทำงานรวมเกินจำนวนพนักงาน'],
  ['แก้ไข & ดูภาพรวม', 'แก้ย้อนหลังได้ตามกำหนด และกรอกล่วงหน้าได้ถึงพรุ่งนี้ · แท็บ “ภาพรวม” = แผนที่สี: เขียว = ครบ, เหลือง = ยังแก้ได้, แดง = ขาด'],
];

export default function HowTo({ onClose }) {
  const t = useT();
  return (
    <Modal title={t('วิธีใช้งานหน้าบันทึกงาน')} onClose={onClose} size="2xl"
      footer={<button onClick={onClose} className="btn-primary">{t('ปิด')}</button>}>
      <ol className="space-y-3">
        {STEPS.map(([head, body], i) => (
          <li key={head} className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
              {i + 1}
            </span>
            <div className="min-w-0">
              <div className="font-semibold text-slate-800">{t(head)}</div>
              <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{t(body)}</p>
            </div>
          </li>
        ))}
      </ol>
    </Modal>
  );
}
