import { useEffect, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';
import { programApi, pick } from '../../lib/onboardingProgram.js';
import ObImage from './ObImage.jsx';
import Section from './Sections.jsx';

/**
 * เตรียมความพร้อมก่อนเริ่มงาน — หน้าแรกสุดของโปรแกรม 90 วัน
 *
 * ทุกประโยคในหน้านี้เป็นคำแปลไทยจาก TH_DICT ของพอร์ทัลที่บริษัทใช้อยู่ตรงตัว
 * ไม่ใช่ถ้อยคำที่เราแต่งขึ้นเอง — พนักงานใหม่ที่เคยเห็นพอร์ทัลเดิมต้องอ่านเจอ
 * ข้อความเดียวกัน รวมทั้งชื่อค่านิยมที่แปลไว้แล้ว ("ความซื่อสัตย์" ไม่ใช่
 * "ความซื่อตรง", "ความประณีต" ไม่ใช่ "ความเป็นเลิศ") ซึ่งเราเคยแปลเองผิดไป
 *
 * ข้อความอังกฤษอยู่ใน frontend/src/lib/en.js ตามกลไก i18n ของระบบ (พจนานุกรม
 * คีย์ด้วยข้อความไทย) ไม่ได้ฝังสองภาษาไว้ในไฟล์นี้
 *
 * ── สี่ section ที่มาจากฐานข้อมูล (migration 0084) ──────────────────────────
 * หน้าแรกของเขามีมากกว่าสารต้อนรับ + ค่านิยม: มีรูปหน้าปก คารูเซลผลงาน และ
 * ผังองค์กร/โครงสร้างกลุ่มบริษัทฝังอยู่ในหน้าเดียวกัน (ไม่ใช่หน้าแยก — เขาเอา
 * หน้า company-structure ออกโดยเจตนา "ฝังไว้ อย่าให้ต้องคลิกออกไป") เนื้อหา
 * ชุดนั้นอยู่ใน ob_sections จึงดึงมาวาดแทนของที่ฝังไว้ในไฟล์นี้เมื่อโหลดได้
 *
 * VALUES/สารต้อนรับที่ฝังไว้ข้างล่างยังอยู่ในฐานะ **ตัวสำรอง** ไม่ใช่ของตาย:
 * ฐานข้อมูลที่ยังไม่ได้นำเข้าเนื้อหา (หรือ API ล่ม) ต้องไม่ทำให้หน้าแรกของ
 * พนักงานใหม่กลายเป็นหน้าเปล่า — ค่านิยมบริษัทเป็นสิ่งที่ต้องอ่านได้เสมอ
 */
const VALUES = [
  {
    name: 'Discipline',
    th: 'วินัย',
    body: 'เราปฏิบัติตามระบบที่มีโครงสร้าง กระบวนการที่มีการบันทึกเป็นเอกสาร และลำดับขั้นการอนุมัติ',
    bullets: ['ไม่มีทางลัด', 'ไม่มีข้อผูกพันที่ไม่มีเอกสารรองรับ', 'ไม่มีการตัดสินใจที่ไม่มีการควบคุม'],
    footer: 'วินัยช่วยปกป้องสภาพคล่อง ชื่อเสียง และความมั่นคงในระยะยาวของเรา',
  },
  {
    name: 'Responsibility',
    th: 'ความรับผิดชอบ',
    body: 'ทุกการกระทำส่งผลกระทบต่อการดำเนินงานและการเงิน เรารับผิดชอบต่อ:',
    bullets: ['การตัดสินใจของเรา', 'เอกสารของเรา', 'กำหนดเวลาของเรา', 'ผลลัพธ์ของเรา'],
    footer: 'ความรับผิดชอบไม่ใช่สิ่งที่โอนต่อได้ — แต่ต้องยึดมั่นไว้',
  },
  {
    name: 'Integrity',
    th: 'ความซื่อสัตย์',
    body: 'เราดำเนินงานด้วยความโปร่งใส ความซื่อสัตย์ และการปฏิบัติตามกฎระเบียบ',
    bullets: ['การรายงานที่ถูกต้อง', 'การวัดผลอย่างตรงไปตรงมา', 'เอกสารที่ถูกต้องครบถ้วน', 'การเคารพความไว้วางใจของสาธารณะ'],
    footer: 'ความซื่อสัตย์คือหลักประกันความยั่งยืน',
  },
  {
    name: 'Excellence',
    th: 'ความประณีต',
    body: 'เราทำงานด้วยความแม่นยำ การประสานงาน และการพัฒนาอย่างต่อเนื่อง',
    bullets: ['ปริมาณงานที่ถูกต้อง', 'ต้นทุนที่ควบคุมได้', 'ส่งมอบงานตรงเวลา', 'ความตระหนักถึงความเสี่ยง'],
    footer: 'ความเป็นเลิศเกิดจากความสม่ำเสมอ ไม่ใช่ความบังเอิญ',
  },
];

export default function Preboarding({ onStart, lang = 'th', onNavigate }) {
  const t = useT();
  const [home, setHome] = useState(null);

  // เนื้อหาหน้าแรกจากฐานข้อมูล — โหลดไม่ได้ก็ไม่แสดง error ให้พนักงานใหม่เห็น
  // เพราะข้อความสำรองข้างล่างพูดเรื่องเดียวกันครบแล้ว แค่ไม่มีรูปกับผังองค์กร
  useEffect(() => {
    let alive = true;
    programApi.page('home').then((r) => { if (alive) setHome(r.data); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const sections = home?.sections || [];
  return (
    <div className="space-y-5">
      <div className="card space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">{t('เตรียมความพร้อมก่อนเริ่มงาน')}</p>
        <h2 className="text-xl font-bold text-slate-800">{t('พอร์ทัลปฐมนิเทศพนักงานใหม่ 90 วัน VCB')}</h2>
        <p className="text-sm text-slate-600">
          {t('พอร์ทัลนี้กำหนดความรู้ที่จำเป็น ความเชี่ยวชาญในระบบ มาตรฐานการปฏิบัติงาน และข้อกำหนดด้านธรรมาภิบาลสำหรับพนักงานใหม่ทุกคนในช่วง 90 วันแรก')}
        </p>
        <p className="text-sm text-slate-500">
          {t('การยืนยันการจ้างงานพิจารณาจากความสามารถ ความถูกต้องของเอกสาร วินัยในการใช้ระบบ และความตระหนักถึงความเสี่ยง')}
        </p>
        {home?.hero_image && (
          <ObImage imageKey={home.hero_image} alt={pick(lang, home.title, home.title_th)}
            ratio="aspect-[21/9]" eager />
        )}
      </div>

      {sections.length > 0
        ? sections.map((s) => (
          <Section key={`${s.type}-${s.sort_order}`} section={s} lang={lang}
            ctx={{ onNavigate }} />
        ))
        : (
          <>
            <div className="card">
              <h3 className="mb-3 flex items-center gap-2 font-bold text-slate-800">
                <Icon name="chat" className="h-4 w-4 text-brand" /> {t('สารต้อนรับจากท่านกรรมการผู้จัดการ')}
              </h3>
              <blockquote className="border-l-4 border-brand/30 pl-4 text-slate-700">
                <p className="italic">
                  {t('เรารู้สึกยินดีเป็นอย่างยิ่งที่คุณมาร่วมงานกับเรา เราเชื่อว่าทุกคนที่นี่มีส่วนร่วมต่อความสำเร็จของเรา และเรามุ่งมั่นที่จะช่วยให้คุณเติบโตก้าวหน้า มาร่วมกันสร้างสิ่งที่ยิ่งใหญ่ไปด้วยกัน')}
                </p>
                <footer className="mt-2 text-sm font-medium text-slate-500">— {t('นาย วรวิทย์ ชวนะนันท์')}</footer>
              </blockquote>
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="font-bold text-slate-800">{t('วัฒนธรรมและค่านิยมของ VCB')}</h3>
                <p className="text-sm text-slate-500">{t('สิ่งที่เรายึดถือ — โปรดซึมซับตั้งแต่วันแรก')}</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {VALUES.map((v) => (
                  <div key={v.name} className="card space-y-2">
                    <div className="flex items-baseline gap-2">
                      <h4 className="font-bold text-slate-800">{t(v.th)}</h4>
                      <span className="text-sm text-slate-400">{v.name}</span>
                    </div>
                    <p className="text-sm text-slate-600">{t(v.body)}</p>
                    <ul className="space-y-1">
                      {v.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2 text-sm text-slate-600">
                          <Icon name="check" className="mt-1 h-3 w-3 shrink-0 text-brand" /> {t(b)}
                        </li>
                      ))}
                    </ul>
                    <p className="border-t border-slate-100 pt-2 text-xs text-slate-500">{t(v.footer)}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

      <div className="flex justify-end">
        <button onClick={onStart} className="btn-primary">
          {t('ไปที่เอกสารที่จำเป็น')} <Icon name="arrowRight" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
