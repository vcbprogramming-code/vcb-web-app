import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * หน้าจบโปรแกรม — เปิดได้ต่อเมื่อติ๊กครบทุกเฟสตามระดับของคนนั้น
 * พิมพ์เป็นใบรับรองได้ จึงจัดหน้าให้พิมพ์ออกมาแล้วอ่านรู้เรื่องโดยไม่มีเมนูติดไป
 */
export default function Completion({ dept, status }) {
  const t = useT();
  if (!status.allComplete) {
    return (
      <div className="card py-12 text-center">
        <h3 className="font-bold text-slate-700">{t('ยังไม่ครบทุกเฟส')}</h3>
        <p className="mt-1 text-sm text-slate-500">{t('กลับไปทำรายการที่เหลือให้ครบก่อน')}</p>
      </div>
    );
  }
  const total = status.phases.reduce((a, p) => a + p.total, 0);
  return (
    <div className="card mx-auto max-w-2xl text-center print:border-0 print:shadow-none">
      <Icon name="check" className="mx-auto h-12 w-12 text-emerald-500" />
      <h2 className="mt-3 text-xl font-bold text-slate-900">{t('จบโปรแกรมปฐมนิเทศ 90 วัน')}</h2>
      <p className="mt-2 text-slate-600">
        {t('ทำรายการครบทั้ง {n} รายการของ{dept}', { n: total, dept: dept.name_th || dept.name })}
      </p>
      <p className="mt-1 text-sm text-slate-400">
        {t('ระดับ')} {status.track === 'senior' ? t('อาวุโส') : t('ต้น')}
        {status.startedAt ? ` · ${t('เริ่ม')} ${new Date(status.startedAt).toLocaleDateString('th-TH')}` : ''}
      </p>
      <button onClick={() => window.print()} className="btn-primary mt-5 print:hidden">
        <Icon name="download" className="h-4 w-4" /> {t('พิมพ์ใบรับรอง')}
      </button>
    </div>
  );
}
