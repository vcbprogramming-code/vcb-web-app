import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * ก่อนเริ่มงาน — หน้าแรกสุดของโปรแกรม 90 วัน
 *
 * เนื้อหาตรงตามพอร์ทัลปฐมนิเทศที่บริษัทใช้อยู่: สารต้อนรับจากประธานเจ้าหน้าที่
 * บริหาร แล้วตามด้วยค่านิยมสี่ข้อ ไม่ใช่ถ้อยคำที่เราแต่งขึ้นเอง — พนักงานใหม่
 * ที่เคยเห็นพอร์ทัลเดิมมาแล้วต้องอ่านเจอข้อความเดียวกัน
 */
const VALUES = [
  {
    name: 'Discipline',
    th: 'วินัย',
    body: 'We follow structured systems, documented processes, and approval hierarchies.',
    bullets: ['No shortcuts', 'No undocumented commitments', 'No uncontrolled decisions'],
    footer: 'Discipline protects our liquidity, reputation, and long-term stability.',
  },
  {
    name: 'Responsibility',
    th: 'ความรับผิดชอบ',
    body: 'Every action has operational and financial impact. We take ownership of:',
    bullets: ['Our decisions', 'Our documentation', 'Our deadlines', 'Our results'],
    footer: 'Responsibility is not transferred — it is upheld.',
  },
  {
    name: 'Integrity',
    th: 'ความซื่อตรง',
    body: 'We operate with transparency, honesty, and regulatory compliance.',
    bullets: ['Accurate reporting', 'Honest measurement', 'Proper documentation', 'Respect for public trust'],
    footer: 'Integrity ensures sustainability.',
  },
  {
    name: 'Excellence',
    th: 'ความเป็นเลิศ',
    body: 'We execute with precision, coordination, and continuous improvement.',
    bullets: ['Accurate quantities', 'Controlled costs', 'Timely delivery', 'Risk awareness'],
    footer: 'Excellence is achieved through consistency, not chance.',
  },
];

export default function Preboarding({ onStart }) {
  const t = useT();
  return (
    <div className="space-y-5">
      <div className="card space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">{t('ก่อนเริ่มงาน')}</p>
        <h2 className="text-xl font-bold text-slate-800">VCB 90-Day Onboarding Portal</h2>
        <p className="text-sm text-slate-600">
          This portal defines the required knowledge, system mastery, execution standards,
          and governance expectations for all new employees during their first 90 days.
        </p>
        <p className="text-sm text-slate-500">
          Confirmation of employment is based on competency, documentation accuracy,
          system discipline, and risk awareness.
        </p>
      </div>

      <div className="card">
        <h3 className="mb-3 flex items-center gap-2 font-bold text-slate-800">
          <Icon name="chat" className="h-4 w-4 text-brand" /> {t('สารต้อนรับจากประธานเจ้าหน้าที่บริหาร')}
        </h3>
        <blockquote className="border-l-4 border-brand/30 pl-4 text-slate-700">
          <p className="italic">
            “We’re thrilled to have you onboard. We believe that every person here contributes
            to our success, and we’re committed to helping you thrive.
            Let’s build something great together.”
          </p>
          <footer className="mt-2 text-sm font-medium text-slate-500">— Mr. Voravith Chavananand</footer>
        </blockquote>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="font-bold text-slate-800">{t('ค่านิยมองค์กร')} · VCB Culture &amp; Values</h3>
          <p className="text-sm text-slate-500">{t('สิ่งที่เรายึดถือ — ทำความเข้าใจตั้งแต่วันแรก')}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {VALUES.map((v) => (
            <div key={v.name} className="card space-y-2">
              <div className="flex items-baseline gap-2">
                <h4 className="font-bold text-slate-800">{v.name}</h4>
                <span className="text-sm text-slate-500">{v.th}</span>
              </div>
              <p className="text-sm text-slate-600">{v.body}</p>
              <ul className="space-y-1">
                {v.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-slate-600">
                    <Icon name="check" className="mt-1 h-3 w-3 shrink-0 text-brand" /> {b}
                  </li>
                ))}
              </ul>
              <p className="border-t border-slate-100 pt-2 text-xs text-slate-500">{v.footer}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={onStart} className="btn-primary">
          {t('เริ่มจากเอกสารที่ต้องส่ง')} <Icon name="arrowRight" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
