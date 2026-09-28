import { useEffect, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';
import { formatAmount } from '../../lib/modules.js';
import { formatThaiDate } from '../../lib/ememo.js';
import { TYPE_CHIP } from './shared.jsx';
import {
  DEFAULT_PN_RATE, deductionRows, guadNo, incomeCalc, incomeObj,
  interestRows, sectionTitle, sectionTotals,
} from './tbar.js';

/**
 * หนึ่ง "ส่วน" (period) ของการ์ด T-bar
 *
 * ซ้าย = รับ (Cash in) · กลาง = จ่าย (Cash out) · ขวา = สุทธิงวดนี้
 * วางตามระบบจริงของลูกค้า (renderPlanPeriodCard) ทั้งลำดับแถว คำในป้าย และ
 * คอลัมน์ รายการ / จำนวน / คำนวณ / % — คนที่ย้ายมาจากของเขาอ่านได้ตำแหน่งเดิม
 *
 * ทุกยอดคิดที่ tbar.js ไม่คิดในไฟล์นี้ เพื่อให้ตรงกับที่เซิร์ฟเวอร์บันทึกไว้
 */

// ตัวเลขทั้งผังนี้ถือว่าช่องว่าง = ศูนย์จริง (แผนที่ยังไม่ลงเงิน) จึงใช้ formatAmount
// ไม่ใช่ formatMoney ที่คืนขีดเมื่อไม่มีค่า — กฎการคั่นหลักพันอยู่ที่เดียวใน lib
const money = formatAmount;
const baht = (n) => `฿${formatAmount(n)}`;

/**
 * ช่องกรอกเงินที่ใส่ลูกน้ำให้ระหว่างพิมพ์
 *
 * เก็บข้อความที่พิมพ์ไว้ในตัวเอง (ไม่ใช่ใน state ของทั้งหน้า) เพื่อไม่ให้ cursor
 * กระโดดตอนหน้าคำนวณยอดใหม่ — ค่าที่ส่งออกไปเป็นตัวเลขล้วนทุกครั้งที่พิมพ์
 */
export function MoneyInput({ value, onChange, readOnly, className = '', title, id }) {
  const fmt = (v) => (Number(v) ? Number(v).toLocaleString('en-US') : '');
  const [text, setText] = useState(() => fmt(value));
  const [typing, setTyping] = useState(false);
  // ค่าที่มาจากภายนอก (auto 15% / โหลดใหม่) ต้องอัปเดตช่อง แต่ห้ามทับสิ่งที่กำลังพิมพ์
  useEffect(() => { if (!typing) setText(fmt(value)); }, [value, typing]);
  return (
    <input
      id={id} type="text" inputMode="decimal" title={title}
      value={text} readOnly={readOnly}
      onFocus={() => setTyping(true)}
      onBlur={() => { setTyping(false); setText(fmt(value)); }}
      onChange={(e) => {
        const raw = e.target.value;
        const n = parseFloat(String(raw).replace(/,/g, '')) || 0;
        const neg = /^-/.test(raw.trim());
        const keep = raw.replace(/[^\d.,-]/g, '');
        setText(keep);
        onChange(neg ? -Math.abs(n) : n);
      }}
      className={`tbar-inp ${className}`}
    />
  );
}

/** ตารางตั๋วที่ส่วนนี้จ่าย — ย่อ/ขยายได้โดยกดที่หัวตาราง */
function DueTable({ items, count, prevIdx, nextIdx, onMove, onRemove, removeTitle, canEdit }) {
  const t = useT();
  const [open, setOpen] = useState(true);
  return (
    <table className="tbar-tbl">
      <colgroup>
        <col style={{ width: '74px' }} /><col style={{ width: '52px' }} /><col style={{ width: '96px' }} />
        <col /><col style={{ width: '92px' }} /><col style={{ width: '84px' }} />
      </colgroup>
      <thead>
        <tr className="cursor-pointer select-none bg-slate-50 dark:bg-slate-800"
          onClick={() => setOpen((o) => !o)} title={t('กดเพื่อย่อ/ขยายรายการ')}>
          <th>
            <Icon name="chevronDown" className={`mr-0.5 inline h-3 w-3 text-brand transition ${open ? '' : '-rotate-90'}`} />
            {t('ครบ', null, 'tbar')}
          </th>
          <th>{t('ประเภท')}</th>
          <th>{t('เลขที่')}</th>
          <th>{t('รายละเอียด')} <span className="font-normal text-slate-400">({count} {t('รายการ')})</span></th>
          <th className="text-right">{t('จำนวน', null, 'tbar')}</th>
          <th aria-label={t('จัดการ')} />
        </tr>
      </thead>
      {open && (
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-t border-slate-100 dark:border-slate-800">
              {/* วันที่ทั้งโมดูลนี้เป็น วว/ดด/พ.ศ. — คอลัมน์นี้ต้องอ่านแบบเดียวกับตารางรายการสินเชื่อ */}
              <td className="whitespace-nowrap text-slate-500">{it.due ? formatThaiDate(it.due) : '—'}</td>
              <td>
                <span className={`chip !px-1.5 !py-0 !text-[10px] ${TYPE_CHIP[it.kind_short] || 'bg-slate-100 text-slate-600'}`}>
                  {it.kind_short || '-'}
                </span>
              </td>
              <td className="truncate text-slate-600">{it.ref || '—'}</td>
              <td className="truncate" title={it.desc || ''}>{it.desc || '—'}</td>
              <td className="text-right tabular-nums">{money(it.amount)}</td>
              <td>
                <div className="flex items-center gap-1">
                  {prevIdx ? (
                    <button type="button" disabled={!canEdit} className="tbar-iconbtn"
                      title={t('ย้ายไปส่วน {n}', { n: prevIdx })} aria-label={t('ย้ายไปส่วน {n}', { n: prevIdx })}
                      onClick={() => onMove(it.id, prevIdx)}>
                      <Icon name="arrowUp" className="h-3.5 w-3.5" />
                    </button>
                  ) : <span className="inline-block h-6 w-6" />}
                  {nextIdx ? (
                    <button type="button" disabled={!canEdit} className="tbar-iconbtn"
                      title={t('ย้ายไปส่วน {n}', { n: nextIdx })} aria-label={t('ย้ายไปส่วน {n}', { n: nextIdx })}
                      onClick={() => onMove(it.id, nextIdx)}>
                      <Icon name="arrowDown" className="h-3.5 w-3.5" />
                    </button>
                  ) : <span className="inline-block h-6 w-6" />}
                  <button type="button" disabled={!canEdit}
                    className="tbar-iconbtn hover:!border-red-300 hover:!text-red-600"
                    title={t(removeTitle)} aria-label={t(removeTitle)}
                    onClick={() => onRemove(it.id)}>
                    <Icon name="trash" className="h-3.5 w-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      )}
    </table>
  );
}

/** ตารางดอกเบี้ย P/N ที่ต้องจ่าย — ยอด × วัน × อัตรา ÷ 365 (แสดงอย่างเดียว) */
function InterestTable({ period, rate, onDays, onRate, canEdit }) {
  const t = useT();
  const { rows, total } = interestRows(period, rate);
  if (!rows.length) return null;
  return (
    <div className="mb-1.5 rounded-lg border border-orange-200 bg-orange-50/40 dark:border-orange-900/50 dark:bg-orange-950/20">
      <table className="tbar-tbl">
        <thead>
          <tr>
            <th className="!text-red-800">
              {t('ดอกเบี้ย P/N ที่ต้องจ่าย')}
              <span className="ml-1 font-normal text-[10px] text-slate-500">· {t('อัตรา')}</span>
              <input type="number" step="0.01" min="0" value={Number((rate * 100).toFixed(4))}
                disabled={!canEdit}
                title={t('อัตราดอกเบี้ยต่อปี (ตั้งได้ต่อโครงการ)')}
                aria-label={t('อัตราดอกเบี้ยต่อปี (ตั้งได้ต่อโครงการ)')}
                onChange={(e) => onRate(Number(e.target.value))}
                className="tbar-inp ml-1 !w-14 !py-0" />
              <span className="ml-0.5 font-normal text-[10px] text-slate-500">{t('%/ปี')}</span>
            </th>
            <th className="text-right">{t('ยอด P/N')}</th>
            <th className="text-right">{t('วัน')}</th>
            <th className="text-right">{t('ดอกเบี้ย')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((it) => (
            <tr key={it.field}>
              <td className="truncate">{t(it.label)}</td>
              <td className="text-right tabular-nums">{money(it.amount)}</td>
              <td className="text-right">
                <input type="number" min="0" value={it.days} disabled={!canEdit}
                  aria-label={t('วัน')}
                  onChange={(e) => onDays(it.field, Number(e.target.value) || 0)}
                  className="tbar-inp !w-14" />
              </td>
              <td className="text-right tabular-nums">{money(it.interest)}</td>
            </tr>
          ))}
          <tr className="bg-orange-100/70 dark:bg-orange-900/30">
            <td className="font-semibold">{t('รวมที่ต้องจ่าย')}</td><td /><td />
            <td className="text-right font-semibold tabular-nums">{baht(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** รายรับจากแหล่งอื่น — กรอกชื่อแหล่งกับยอดเองได้ ทุกส่วนมีได้ */
function ExtraRows({ period, onPatch, canEdit }) {
  const t = useT();
  const rows = Array.isArray(period.extra_rows) ? period.extra_rows : [];
  const set = (next) => onPatch({ extra_rows: next });
  return (
    <>
      {rows.length > 0 && (
        <table className="tbar-tbl">
          <colgroup><col /><col style={{ width: '104px' }} /><col style={{ width: '104px' }} /><col style={{ width: '48px' }} /></colgroup>
          <tbody>
            {rows.map((r, i) => (
              // แถวถูกอ้างด้วยลำดับ ไม่มี id ของตัวเอง — key จึงเป็นลำดับโดยเจตนา
              // eslint-disable-next-line react/no-array-index-key
              <tr key={`extra-${i}`}>
                <td>
                  <input value={r.label || ''} disabled={!canEdit} placeholder={t('แหล่งที่มา…')}
                    aria-label={t('แหล่งที่มา…')}
                    onChange={(e) => set(rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                    className="tbar-inp !text-left" />
                </td>
                <td />
                <td>
                  <MoneyInput value={r.amount} readOnly={!canEdit} className="!text-emerald-700 font-semibold"
                    title={t('จำนวน', null, 'tbar')}
                    onChange={(v) => set(rows.map((x, j) => (j === i ? { ...x, amount: v } : x)))} />
                </td>
                <td className="text-right">
                  <button type="button" disabled={!canEdit} className="tbar-iconbtn hover:!border-red-300 hover:!text-red-600"
                    title={t('ลบแถวนี้')} aria-label={t('ลบแถวนี้')}
                    onClick={() => set(rows.filter((x, j) => j !== i))}>
                    <Icon name="trash" className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="px-1 py-1">
        <button type="button" disabled={!canEdit}
          onClick={() => set([...rows, { label: '', amount: 0 }])}
          className="rounded border border-dashed border-emerald-400 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-400">
          ＋ {t('เพิ่มรายรับจากแหล่งอื่น')}
        </button>
      </div>
    </>
  );
}

/** หัวตารางซ้าย รายการ / จำนวน / คำนวณ / % — ทุกส่วนใช้ชุดเดียวกัน */
function HeadRow() {
  const t = useT();
  return (
    <thead>
      <tr>
        <th>{t('รายการ')}</th>
        <th className="text-right">{t('จำนวน', null, 'tbar')}</th>
        <th className="text-right">{t('คำนวณ')}</th>
        <th className="text-right">%</th>
      </tr>
    </thead>
  );
}
const LEFT_COLS = (
  <colgroup><col /><col style={{ width: '104px' }} /><col style={{ width: '104px' }} /><col style={{ width: '48px' }} /></colgroup>
);

/** ตารางซ้ายของส่วน "ขอเบิก P/N" — โหมดค่างาน (เต็มสูตร) และโหมด Workdone (50%) */
function IncomeTable({ period, periods, onInc, canEdit }) {
  const t = useT();
  const c = incomeCalc(period);
  const n = guadNo(period, periods);
  const pct = 'text-[11px] text-slate-400';
  if (c.kind === 'progress') {
    return (
      <table className="tbar-tbl">
        {LEFT_COLS}<HeadRow />
        <tbody>
          <tr>
            <td>
              {t('ผลงานที่ทำได้ งวด {n} (Workdone)', { n })}
              <div className="text-[10px] font-normal text-slate-400">
                {t('ยังไม่ถึงงวดเบิกกับกรมทางหลวง · ธนาคารสนับสนุนล่วงหน้า · จากรายงานความก้าวหน้า/ใบวิทยุ')}
              </div>
            </td>
            <td><MoneyInput value={c.work} readOnly={!canEdit} onChange={(v) => onInc('work', v)}
              className="!border-orange-400 font-semibold" title={t('ผลงานที่ทำได้')} /></td>
            <td className="text-right tabular-nums">{baht(c.totalPN)}</td>
            <td className={`text-right ${pct}`}>50%</td>
          </tr>
          <tr className="bg-slate-100 dark:bg-slate-800">
            <td className="font-semibold">{t('รวม P/N ที่ขาย')}</td><td />
            <td className="text-right font-semibold tabular-nums">{baht(c.totalPN)}</td><td />
          </tr>
        </tbody>
      </table>
    );
  }
  return (
    <table className="tbar-tbl">
      {LEFT_COLS}<HeadRow />
      <tbody>
        <tr>
          <td>{t('ส่งงานงวด {n} (ค่างานที่ส่ง)', { n })}</td>
          <td><MoneyInput value={c.work} readOnly={!canEdit} onChange={(v) => onInc('work', v)}
            className="!border-orange-400 font-semibold" title={t('ค่างานที่ส่ง')} /></td>
          <td className="text-right tabular-nums">{money(c.ceil1)}</td>
          <td className={`text-right ${pct}`}>80%</td>
        </tr>
        <tr>
          <td className="text-red-800 dark:text-red-400">{t('หัก ค่า segment CVE')}</td>
          <td><MoneyInput value={c.seg} readOnly={!canEdit} onChange={(v) => onInc('segment', v)}
            className="!text-red-800 font-semibold" title={t('ค่า segment CVE')} /></td>
          <td className="text-right tabular-nums text-red-800 dark:text-red-400">{money(c.seg60)}</td>
          <td className={`text-right ${pct}`}>60%</td>
        </tr>
        <tr className="bg-amber-50 dark:bg-amber-950/30">
          <td className="font-semibold">
            {t('เหลือค่างวด {n}', { n })}
            <span className="ml-1 text-[10px] font-normal text-slate-400">{t('(ค่างาน − 60% seg)')}</span>
          </td><td />
          <td className="text-right font-semibold tabular-nums">{baht(c.remain)}</td><td />
        </tr>
        <tr>
          <td className="text-red-800 dark:text-red-400">{t('หัก PN ที่ขายไว้ (เดือนก่อน)')}</td><td />
          <td><MoneyInput value={c.pnSold} readOnly={!canEdit} onChange={(v) => onInc('pnSold', v)}
            className="!text-red-800 font-semibold" title={t('PN ที่ขายไว้')} /></td><td />
        </tr>
        <tr className="bg-sky-50 dark:bg-sky-950/30">
          <td className="font-semibold">
            {t('จะคงเหลือ P/N ที่ขายได้')}
            <span className="ml-1 text-[10px] font-normal text-slate-400">{t('(min − PN ขายไว้)')}</span>
          </td><td />
          <td className="text-right font-semibold tabular-nums text-brand">{baht(c.newPN)}</td><td />
        </tr>
        <tr>
          <td>{t('ขาย PN RT งวด {n} (เงินประกัน)', { n })}</td>
          <td><MoneyInput value={c.rt} readOnly={!canEdit} onChange={(v) => onInc('rt', v)}
            className="!border-orange-400 font-semibold" title={t('เงินประกันผลงาน')} /></td>
          <td className="text-right tabular-nums">{money(c.rtPN)}</td>
          <td className={`text-right ${pct}`}>80%</td>
        </tr>
        <tr className="bg-slate-100 dark:bg-slate-800">
          <td className="font-semibold">{t('รวม P/N ที่ขาย')}</td><td />
          <td className="text-right font-semibold tabular-nums">{baht(c.totalPN)}</td><td />
        </tr>
      </tbody>
    </table>
  );
}

const DED_HINT = {
  TL: '(auto 15%)',
  ML: '(auto 1.5%)',
  PNNEW: '(PN ต่อค่างานงวดนี้ · auto จาก P/N ที่ขาย)',
  PN: '(PN Work Done ของงวดก่อน)',
};
/** ตารางซ้ายของส่วน "รับเงินค่างาน + หักหนี้" — ห้าแถวหัก + คงเหลือ */
function DeductionTable({ period, pnSold, onPatch, canEdit }) {
  const t = useT();
  const rows = deductionRows(period, pnSold);
  const dedSum = rows.reduce((s, d) => s + Number(d.amount || 0), 0);
  const bal = Number(period.income || 0) - dedSum;
  const hintOf = (label) => {
    if (label.indexOf('TL') >= 0) return DED_HINT.TL;
    if (label.indexOf('ML') >= 0) return DED_HINT.ML;
    if (label.indexOf('ขอเบิกใหม่') >= 0) return DED_HINT.PNNEW;
    if (label.indexOf('PN') >= 0) return DED_HINT.PN;
    return '';
  };
  return (
    <table className="tbar-tbl">
      {LEFT_COLS}
      <tbody>
        <tr>
          <td className="font-semibold">{t('รับเงินค่างานสุทธิ')}</td><td />
          <td><MoneyInput value={period.income} readOnly={!canEdit} className="font-semibold"
            title={t('รับเงินค่างานสุทธิ')} onChange={(v) => onPatch({ income: v })} /></td><td />
        </tr>
        {rows.map((d, i) => (
          <tr key={d.label}>
            <td className="text-red-800 dark:text-red-400">
              {t(d.label)}
              {hintOf(d.label) && <span className="ml-1 text-[10px] text-slate-400">{t(hintOf(d.label))}</span>}
            </td>
            <td />
            <td>
              <MoneyInput value={d.amount} readOnly={d.auto || !canEdit} className="!text-red-800"
                title={t(d.label)}
                onChange={(v) => onPatch({
                  deductions: rows.map((x, j) => ({ label: x.label, amount: j === i ? v : x.amount })),
                })} />
            </td>
            <td />
          </tr>
        ))}
        <tr>
          <td className="font-semibold">{t('คงเหลือ')}</td><td />
          <td className={`text-right font-semibold tabular-nums ${bal < 0 ? 'text-red-600' : 'text-brand'}`}>{baht(bal)}</td>
          <td />
        </tr>
      </tbody>
    </table>
  );
}

export default function TbarSection({
  period, periods, outstanding, amountById, pnSold, month,
  onPatch, onDelete, onMove, onRemovePaid, onOpenPicker, canEdit = true,
}) {
  const t = useT();
  const type = period.period_type || 'mixed';
  const totals = sectionTotals(period, { amountById, pnSold });
  const rate = period.pn_rate == null ? DEFAULT_PN_RATE : Number(period.pn_rate);
  const sibs = periods.slice().sort((a, b) => a.period_idx - b.period_idx);
  const mi = sibs.findIndex((p) => p.id === period.id);
  const prevIdx = mi > 0 ? sibs[mi - 1].period_idx : 0;
  const nextIdx = mi >= 0 && mi < sibs.length - 1 ? sibs[mi + 1].period_idx : 0;

  const own = new Set(Array.isArray(period.paid_ids) ? period.paid_ids : []);
  const items = outstanding.filter((o) => own.has(o.id));
  // ตั๋วที่ยังไม่มีส่วนไหนรับไป และครบกำหนดเดือนนี้ — จำนวนที่ขึ้นบนปุ่ม ＋ เพิ่ม
  const claimed = new Set();
  for (const p of periods) if (p.id !== period.id) (p.paid_ids || []).forEach((id) => claimed.add(id));
  const canAdd = outstanding.filter((o) => !own.has(o.id) && !claimed.has(o.id)
    && String(o.due || '').slice(0, 7) === month);

  // เติมค่าตั้งต้นให้ครบก่อนแก้ทีละช่อง — ไม่งั้น kind (ค่างาน/Workdone) หายตอนบันทึก
  const onInc = (field, v) => onPatch({ income_break: { ...incomeObj(period), [field]: v } });

  return (
    <div className="border-t border-dashed border-slate-300 first:border-t-0 dark:border-slate-700">
      {/* หัวส่วน: เลขส่วน · ประเภท · วันที่ส่งงาน · งวดที่ · ลบส่วนนี้ */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-2.5 py-1 dark:border-slate-800 dark:bg-slate-800/60">
        <b className="rounded bg-brand px-2 text-[12px] text-white">{period.period_idx}</b>
        <span className="rounded-full bg-brand-tint px-2 py-0.5 text-[11px] font-semibold text-brand">
          {t(sectionTitle(period))}
        </span>
        {type !== 'deduction' && <span className="text-[11px] text-slate-400">{t('วันที่ส่งงาน')}</span>}
        <input type="date" value={period.period_date || ''} disabled={!canEdit}
          aria-label={t('วันที่ส่งงาน')}
          onChange={(e) => onPatch({ period_date: e.target.value })}
          className="rounded border border-slate-300 px-1 py-[1px] text-[11px] dark:border-slate-700 dark:bg-slate-900" />
        <span className="text-[11px] text-slate-400">{t('งวดที่')}</span>
        <input type="text" inputMode="numeric" disabled={!canEdit}
          value={String(period.period_label || '').replace(/\D/g, '')}
          placeholder={String(period.period_idx)}
          aria-label={t('งวดที่')}
          onChange={(e) => onPatch({ period_label: e.target.value.replace(/\D/g, '') })}
          className="w-12 rounded border border-slate-300 px-1 py-[1px] text-center text-[11px] dark:border-slate-700 dark:bg-slate-900" />
        <button type="button" disabled={!canEdit}
          className="ml-auto tbar-iconbtn hover:!border-red-300 hover:!text-red-600"
          title={t('ลบส่วนนี้')} aria-label={t('ลบส่วนนี้')} onClick={() => onDelete(period)}>
          <Icon name="trash" className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="tbar-grid">
        {/* ซ้าย — รับ */}
        <div className="tbar-cell border-slate-200 px-2 py-1 md:border-r dark:border-slate-800">
          {type === 'income' && <IncomeTable period={period} periods={periods} onInc={onInc} canEdit={canEdit} />}
          {type === 'deduction' && <DeductionTable period={period} pnSold={pnSold} onPatch={onPatch} canEdit={canEdit} />}
          {type === 'aval' && (
            <table className="tbar-tbl">
              {LEFT_COLS}
              <tbody>
                <tr>
                  <td className="font-semibold">{t('ขอออก Aval จัดสรร')}</td><td />
                  <td><MoneyInput value={period.aval_amount} readOnly={!canEdit} className="font-semibold"
                    title={t('ขอออก Aval จัดสรร')} onChange={(v) => onPatch({ aval_amount: v })} /></td><td />
                </tr>
              </tbody>
            </table>
          )}
          <ExtraRows period={period} onPatch={onPatch} canEdit={canEdit} />
        </div>

        {/* กลาง — จ่าย */}
        <div className="tbar-cell flex flex-col px-2 py-1">
          {type === 'income' && (
            <InterestTable period={period} rate={rate} canEdit={canEdit}
              onDays={(field, v) => onInc(field, v)}
              onRate={(pct) => onPatch({ pn_rate: (Number(pct) || 0) / 100 }, { allPeriods: true })} />
          )}
          {canAdd.length > 0 && (
            <div className="mb-1 text-right">
              <button type="button" disabled={!canEdit} onClick={() => onOpenPicker(period)}
                className="rounded border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-300">
                ＋ {t('เพิ่ม')} ({canAdd.length})
              </button>
            </div>
          )}
          {items.length > 0 ? (
            <DueTable
              items={items} count={items.length}
              prevIdx={prevIdx} nextIdx={nextIdx} canEdit={canEdit}
              onMove={(txnId, target) => onMove(period, txnId, target)}
              onRemove={(txnId) => onRemovePaid(period, txnId)}
              removeTitle={type === 'deduction' ? 'ไม่ชำระงวดนี้' : 'ตัดออกจากส่วนนี้'}
            />
          ) : (
            <div className="py-2 text-center text-[11px] italic text-slate-400">
              {type === 'deduction'
                ? t('ไม่มีรายการครบกำหนดในเดือนนี้')
                : `${t('ไม่มีรายการในส่วนนี้')}${canAdd.length ? ` — ${t('กด ＋ เพิ่ม')}` : ''}`}
            </div>
          )}
        </div>

        {/* ขวา — สุทธิงวดนี้ */}
        <div className="flex flex-col items-end justify-center border-slate-200 bg-slate-50/70 px-2 py-1.5 text-right md:border-l dark:border-slate-800 dark:bg-slate-800/40">
          <span className="whitespace-nowrap text-[10px] text-slate-400">{t('สุทธิงวดนี้ / Net')}</span>
          <b className={`text-[15px] tabular-nums ${totals.net < 0 ? 'text-red-600' : 'text-brand'}`}>{baht(totals.net)}</b>
        </div>
      </div>

      {/* แถบสรุปของส่วน — รับใต้คอลัมน์รับ จ่ายใต้คอลัมน์จ่าย */}
      <div className="tbar-grid border-t border-slate-200 bg-slate-100 text-[11.5px] dark:border-slate-800 dark:bg-slate-800/70">
        <div className="px-3 py-1 text-right">
          <span className="text-slate-500">{t('รวมรับ')} </span>
          <b className="tabular-nums text-emerald-700 dark:text-emerald-400">{baht(totals.cashIn)}</b>
        </div>
        <div className="border-slate-200 px-3 py-1 text-right md:border-l dark:border-slate-800">
          <span className="text-slate-500">{t('รวมจ่าย')} </span>
          <b className="tabular-nums text-red-700 dark:text-red-400">{baht(totals.cashOut)}</b>
        </div>
        <div className="hidden border-slate-200 md:block md:border-l dark:border-slate-800" />
      </div>
    </div>
  );
}
