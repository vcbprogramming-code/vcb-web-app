import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { meetingDateText, meetingTimeText, thaiDateTime } from '../../lib/meetings.js';
import Icon from '../../components/Icon.jsx';
import Spinner from '../../components/Spinner.jsx';
import { useLang, useT } from '../../lib/i18n.jsx';

/**
 * หน้าตรวจสอบความแท้ของรายงานการประชุมที่พิมพ์ออกมา — สาธารณะ ไม่ต้องลงชื่อเข้าใช้
 *
 * เข้าถึงโดยการสแกน QR บนกระดาษ คนที่เปิดหน้านี้จึงอาจไม่ใช่พนักงาน (ผู้รับเหมา
 * ที่ปรึกษา ผู้สอบบัญชี) — หน้านี้จะต้องตอบได้ว่า "กระดาษในมือออกจากระบบนี้จริง
 * และยังเป็นฉบับปัจจุบันหรือไม่" โดยไม่แสดงเนื้อหาบันทึกแม้แต่บรรทัดเดียว
 *
 * ตัวเลข "แก้ไขเนื้อหามาแล้ว N ครั้ง" เป็นสาระของหน้านี้ ไม่ใช่ของประดับ: กระดาษ
 * ที่พิมพ์ไว้เมื่อเดือนก่อนอาจเป็นฉบับที่ถูกแก้ไปแล้ว ผู้ถือกระดาษต้องรู้ว่าควร
 * ขอฉบับใหม่ไหม
 */
export default function VerifyMeeting() {
  const t = useT();
  const { lang } = useLang();
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // auth:false โดยเจตนา — หน้านี้เป็นหน้าสาธารณะ ไม่ควรส่งโทเค็นของใครไปด้วย
    // และถ้าคนในองค์กรที่โทเค็นหมดอายุเปิดหน้านี้ ต้องไม่ถูกลากไปหน้าล็อกอิน
    api(`/mtg/${encodeURIComponent(token)}`, { auth: false })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.message));
  }, [token]);

  const row = (label, value) => (
    <div className="flex flex-wrap justify-between gap-2 border-b border-slate-100 py-2 last:border-0">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-slate-800">{value || '—'}</dd>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="mb-5 flex items-center justify-center gap-2.5 text-slate-800">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Icon name="calendar" className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold">{t('VCB รายงานการประชุม · ตรวจสอบเอกสาร')}</span>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-white p-8 text-center">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
              <Icon name="x" className="h-6 w-6" />
            </span>
            <h2 className="text-lg font-bold text-slate-800">{t('ตรวจสอบไม่สำเร็จ')}</h2>
            <p className="mt-1 text-sm text-slate-500">{error}</p>
            <p className="mt-2 text-xs text-slate-400">
              {t('QR หรือลิงก์อาจไม่ถูกต้อง หรือรายงานฉบับนี้ถูกลบออกจากระบบแล้ว')}
            </p>
          </div>
        ) : !data ? (
          <div className="flex justify-center py-16"><Spinner label={t('กำลังตรวจสอบ…')} /></div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-5 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <Icon name="check" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="font-bold text-emerald-800">{t('เอกสารนี้ออกจากระบบจริง')}</p>
                <p className="text-xs text-emerald-700">
                  {t('ข้อมูลด้านล่างอ่านจากฐานข้อมูลของบริษัทโดยตรง ณ เวลาที่เปิดหน้านี้')}
                </p>
              </div>
            </div>
            <dl className="px-5 py-3">
              {row(t('ชื่อเรื่อง'), data.title)}
              {row(t('โครงการ'), data.group_name)}
              {row(t('วันประชุม'),
                `${meetingDateText(data, lang, t('ภาพรวม'))}${meetingTimeText(data) ? ` · ${meetingTimeText(data)}` : ''}`)}
              {row(t('บันทึกเมื่อ'),
                `${thaiDateTime(data.created_at)}${data.created_by_name ? ` · ${data.created_by_name}` : ''}`)}
              {row(t('ปรับปรุงล่าสุด'),
                `${thaiDateTime(data.updated_at)}${data.updated_by_name ? ` · ${data.updated_by_name}` : ''}`)}
              {row(t('แก้ไขเนื้อหามาแล้ว'),
                data.revisions ? `${data.revisions} ${t('ครั้ง')}` : t('ยังไม่เคยแก้ไข'))}
            </dl>
            {/* เตือนตรง ๆ เมื่อฉบับถูกแก้มาแล้ว กระดาษที่ถืออยู่อาจไม่ใช่ฉบับล่าสุด */}
            {data.revisions > 0 && (
              <p className="flex items-start gap-2 border-t border-amber-100 bg-amber-50 px-5 py-3 text-xs leading-relaxed text-amber-800">
                <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{t('เนื้อหาฉบับนี้ถูกแก้ไขหลังสร้าง หากกระดาษที่ท่านถืออยู่พิมพ์ไว้ก่อนวันที่ปรับปรุงล่าสุด โปรดขอฉบับปัจจุบันจากผู้บันทึก')}</span>
              </p>
            )}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          {t('หน้านี้แสดงเฉพาะข้อมูลที่ใช้ยืนยันความถูกต้องของเอกสาร ไม่แสดงเนื้อหาการประชุม')}
        </p>
      </div>
    </div>
  );
}
