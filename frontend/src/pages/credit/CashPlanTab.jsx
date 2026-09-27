import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { creditApi } from '../../lib/modules.js';
import { Modal } from '../../components/ui/index.js';
import Icon from '../../components/Icon.jsx';
import Spinner from '../../components/Spinner.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useT } from '../../lib/i18n.jsx';
import { projectLabel } from './shared.jsx';
import { formatThaiDate } from '../../lib/ememo.js';
import TbarSection from './TbarSection.jsx';
import {
  MAX_PERIODS, PERIOD_TYPE_CHOICES, PLAN_EXCLUDE, defaultDeductions, defaultIncome,
  monthOptions, projectTotals, pnSoldThisMonth, thisMonth,
} from './tbar.js';

/**
 * แผนการเงิน (T-bar) · หักค่างานตามจริง
 *
 * จอเดียวทำสองฉบับ ต่างกันที่ prop `kind` ('plan' | 'actual') เหมือนระบบจริงที่ใช้
 * planTable() ตัวเดียวกับสองแท็บ ผังหน้าจอตาม index.html ของเขา:
 *
 *   แถบเดือน 13 เดือน (พ.ศ.) · ＋ เพิ่มโครงการ · Export T-bar
 *   การ์ดต่อโครงการ: ช่องเปลี่ยนโครงการ · ＋ เพิ่มส่วน · คัดลอกจากเดือนก่อน · ลบ T-bar
 *     แถบ รับ · Cash in | จ่าย · Cash out | สุทธิ · Net
 *     ส่วนที่ 1..5 (TbarSection) คั่นด้วยเส้นประ
 *     ท้ายการ์ด: รวมรับ · รวมจ่าย · คงเหลือ
 *   ปิดท้ายทั้งหน้า: รวมทุก T-bar (Total all)
 *
 * การบันทึก: พิมพ์แล้วยอดขยับทันที (คิดที่ tbar.js) ส่วนการเขียนลงฐานรวบเป็นชุด
 * หลังหยุดพิมพ์ 400ms ต่อหนึ่งส่วน — เหมือน planScheduleSave ของเขา ปุ่มที่เปลี่ยน
 * โครงสร้าง (เพิ่ม/ลบ/ย้าย) บันทึกทันทีไม่รอ
 */

const money = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const baht = (n) => `฿${money(n)}`;

/** แถบ รับ · จ่าย · สุทธิ ที่หัวการ์ดและในการ์ดตัวอย่าง */
function Band() {
  const t = useT();
  return (
    <div className="tbar-grid text-[12px] font-bold tracking-wide">
      <div className="border-slate-200 bg-emerald-50 px-3 py-1 text-center text-emerald-800 md:border-r dark:border-slate-800 dark:bg-emerald-950/30 dark:text-emerald-300">
        {t('รับ · Cash in')}
      </div>
      <div className="bg-red-50 px-3 py-1 text-center text-red-800 dark:bg-red-950/30 dark:text-red-300">
        {t('จ่าย · Cash out')}
      </div>
      <div className="border-slate-200 bg-slate-100 px-3 py-1 text-center text-brand md:border-l dark:border-slate-800 dark:bg-slate-800">
        {t('สุทธิ · Net')}
      </div>
    </div>
  );
}

/**
 * การ์ด "① เริ่มต้น" — จอว่างของเขาไม่ใช่ข้อความว่าง แต่เป็นโครงสร้างจริงที่ยัง
 * กรอกไม่ได้ พร้อมช่องเลือกโครงการเป็นตัวเดียวที่กดได้ คนเปิดหน้าครั้งแรกจึงเห็น
 * ว่ากำลังจะกรอกอะไร
 */
function StartCard({ projects, onPick, busy }) {
  const t = useT();
  if (!projects.length) {
    return <div className="card py-10 text-center text-sm text-slate-500">{t('ทุกโครงการมีแผนในเดือนนี้แล้ว')}</div>;
  }
  const previewRow = (label, right) => (
    <div key={label} className="flex items-center justify-between border-b border-slate-100 px-2 py-[3px] text-[12px] text-slate-400 dark:border-slate-800">
      <span>{label}</span><span className="tabular-nums">{right}</span>
    </div>
  );
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-2.5 bg-slate-900 px-3 py-1.5 text-white">
        <b className="text-sm">{t('① เริ่มต้น')}</b>
        <select defaultValue="" disabled={busy} title={t('เลือกโครงการ')}
          onChange={(e) => { if (e.target.value) onPick(e.target.value); }}
          className="min-w-[220px] rounded-md border border-slate-600 bg-white px-2 py-1 text-[13px] text-slate-800">
          <option value="">{t('— เลือกโครงการ —')}</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
        </select>
        <span className="text-[12px] opacity-85">
          {t('เลือกโครงการเพื่อสร้างแผน 3 ส่วน พร้อม B/E + P/N ที่ครบกำหนดเดือนนี้')}
        </span>
        {busy && <Spinner label={t('กำลังเพิ่มโครงการ')} />}
      </div>
      <Band />
      <div className="tbar-grid">
        <div className="border-slate-200 px-2 py-1 md:border-r dark:border-slate-800">
          {previewRow(t('รับเงินค่างานสุทธิ'), '฿0')}
          {defaultDeductions().map((d) => previewRow(t(d.label), '฿0'))}
          {previewRow(t('คงเหลือ'), '฿0')}
        </div>
        <div className="px-2 py-3 text-center text-[11px] italic text-slate-400">
          {t('— เลือกโครงการเพื่อโหลดรายการ —')}
        </div>
        <div className="flex flex-col items-end justify-center border-slate-200 bg-slate-50 px-2 py-1.5 md:border-l dark:border-slate-800 dark:bg-slate-800/40">
          <span className="text-[10px] text-slate-400">{t('สุทธิงวดนี้ / Net')}</span>
          <b className="text-[15px] text-slate-400">฿0</b>
        </div>
      </div>
    </div>
  );
}

/** จอเลือกประเภทงวด (＋ เพิ่มส่วน) */
function TypePicker({ projectName, onPick, onClose }) {
  const t = useT();
  return (
    <Modal title={`${t('เลือกประเภทงวดสำหรับ')} ${projectName}`} onClose={onClose} size="md">
      <div className="space-y-2">
        {PERIOD_TYPE_CHOICES.map((o) => (
          <button key={o.value} type="button" onClick={() => onPick(o.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-left transition hover:border-brand hover:bg-brand-tint dark:border-slate-700">
            <b className="text-sm">{t(o.label)}</b>
            <div className="text-[11px] text-slate-500">{t(o.hint)}</div>
          </button>
        ))}
      </div>
    </Modal>
  );
}

/** จอเลือกตั๋วที่จะเพิ่มเข้าส่วนนี้ — แยกครบกำหนดเดือนนี้ / ล่วงหน้า */
function ItemPicker({ current, future, onPick, onClose }) {
  const t = useT();
  const btn = (it) => (
    <button key={it.id} type="button" onClick={() => onPick(it.id)}
      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-left transition hover:border-brand hover:bg-brand-tint dark:border-slate-700">
      <div className="text-sm"><b>{it.ref || '—'}</b> · {it.kind_short} · {baht(it.amount)}</div>
      <div className="text-[11px] text-slate-500">{t('ครบ', null, 'tbar')} {it.due ? formatThaiDate(it.due) : '—'} · {it.desc || ''}</div>
    </button>
  );
  return (
    <Modal title={t('เลือกรายการที่จะเพิ่มเข้าส่วนนี้')} onClose={onClose} size="lg">
      <div className="space-y-2">
        {current.length > 0 && (
          <div className="pt-1 text-[11px] font-bold text-slate-500">{t('ครบกำหนดเดือนนี้')}</div>
        )}
        {current.map(btn)}
        {future.length > 0 && (
          <div className="pt-3 text-[11px] font-bold text-slate-500">{t('ล่วงหน้า (ยังไม่ครบ — ชำระก่อน)')}</div>
        )}
        {future.map(btn)}
      </div>
    </Modal>
  );
}

export default function CashPlanTab({ projects: allProjects = [], onChanged, kind = 'plan', canEdit = true }) {
  const t = useT();
  // โครงการที่ไม่เคยทำ T-bar (ส่วนกลาง / โครงการที่ใช้เงินนอกรูปแบบค่างาน + B/E + P/N)
  // ถูกตัดออกจากทุกช่องเลือกของแท็บนี้ เหมือน PLAN_EXCLUDE ของระบบจริง
  const projects = useMemo(() => allProjects.filter((p) => !PLAN_EXCLUDE[p.code]), [allProjects]);
  const toast = useToast();
  const confirm = useConfirm();
  const [month, setMonth] = useState(thisMonth);
  const [rows, setRows] = useState([]);           // ส่วนทั้งหมดของเดือนนี้
  const [outstanding, setOutstanding] = useState([]);
  const [prevPn, setPrevPn] = useState({});
  const [prevProjects, setPrevProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(0);
  const [error, setError] = useState(null);
  const [typePicker, setTypePicker] = useState(null);   // projectId
  const [itemPicker, setItemPicker] = useState(null);   // period
  const [adding, setAdding] = useState(null);           // projectId ที่กำลังเพิ่ม
  const [exporting, setExporting] = useState(false);
  const timers = useRef({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // เปิดฉบับ "จริง" ครั้งแรกของเดือนไหน ให้ตั้งต้นจากฉบับแผนของเดือนนั้นก่อน
      // (planMirrorFromPlan ของระบบจริง) — โครงการที่มีฉบับจริงแล้วไม่ถูกแตะ
      // คนที่ได้สิทธิ์ดูอย่างเดียวเขียนไม่ได้ จึงข้ามไปเงียบ ๆ ไม่ขึ้นข้อความผิดพลาด
      if (kind === 'actual' && canEdit) {
        await creditApi.mirrorTbarActual({ month }).catch(() => {});
      }
      const r = await creditApi.tbar({ month, kind });
      setRows(r.data?.periods || []);
      setOutstanding(r.data?.outstanding || []);
      setPrevPn(r.data?.prev_pn || {});
      setPrevProjects(r.data?.prev_projects || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [month, kind, canEdit]);
  useEffect(() => { load(); }, [load]);

  // งานบันทึกที่ค้างในคิวต้องถูกส่งก่อนออกจากจอ ไม่ใช่หายไปกับ timer
  useEffect(() => () => {
    Object.values(timers.current).forEach((x) => { clearTimeout(x.id); x.run(); });
    timers.current = {};
  }, []);

  const amountById = useMemo(() => {
    const m = new Map();
    for (const o of outstanding) m.set(o.id, o.amount);
    return m;
  }, [outstanding]);

  const byProject = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      if (!m.has(r.project_id)) m.set(r.project_id, []);
      m.get(r.project_id).push(r);
    }
    for (const list of m.values()) list.sort((a, b) => a.period_idx - b.period_idx);
    return m;
  }, [rows]);

  const projectById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);
  const addable = projects.filter((p) => !byProject.has(p.id));

  /** ส่งหนึ่งส่วนขึ้นเซิร์ฟเวอร์ */
  const push = useCallback(async (p) => {
    setSaving((n) => n + 1);
    try {
      await creditApi.saveTbarPeriod({
        id: p.id, projectId: p.project_id, month: p.month, kind: p.kind || kind,
        periodIdx: p.period_idx, periodType: p.period_type,
        periodLabel: String(p.period_label || ''), periodDate: p.period_date || null,
        income: Number(p.income) || 0,
        paidIds: Array.isArray(p.paid_ids) ? p.paid_ids : [],
        deductions: Array.isArray(p.deductions) ? p.deductions : [],
        incomeBreak: (p.income_break && !Array.isArray(p.income_break)) ? p.income_break : undefined,
        extraRows: Array.isArray(p.extra_rows) ? p.extra_rows : [],
        avalAmount: Number(p.aval_amount) || 0,
        pnRate: p.pn_rate == null ? undefined : Number(p.pn_rate),
        note: p.note || null,
      });
      onChanged?.();
    } catch (e) {
      toast.error(`${t('บันทึกไม่สำเร็จ')}: ${e.message}`);
    } finally {
      setSaving((n) => Math.max(0, n - 1));
    }
  }, [kind, onChanged, t, toast]);

  /** รวบการพิมพ์เป็นชุดเดียวต่อหนึ่งส่วน */
  const pushSoon = useCallback((p, delay = 400) => {
    const key = p.id;
    if (timers.current[key]) clearTimeout(timers.current[key].id);
    const run = () => { delete timers.current[key]; push(p); };
    timers.current[key] = { id: setTimeout(run, delay), run };
  }, [push]);

  /**
   * แก้ค่าในส่วนหนึ่ง — อัปเดตบนจอทันที แล้วค่อยบันทึก
   * opts.allPeriods: ค่าที่ตั้งทั้งโครงการ (อัตราดอกเบี้ย P/N)
   * opts.now: บันทึกทันทีไม่ต้องรอหยุดพิมพ์ (ปุ่มที่เปลี่ยนโครงสร้าง)
   */
  const patch = useCallback((period, changes, opts = {}) => {
    if (!canEdit) return;
    const hit = (r) => (opts.allPeriods ? r.project_id === period.project_id : r.id === period.id);
    // คำนวณแถวที่จะถูกแก้ก่อน แล้วค่อยสั่ง setRows — ห้ามยิงงานบันทึกจากใน updater
    // เพราะ React เรียก updater ซ้ำได้ (StrictMode) แล้วจะกลายเป็นบันทึกสองครั้ง
    const touched = rows.filter(hit).map((r) => ({ ...r, ...changes }));
    setRows((prev) => prev.map((r) => (hit(r) ? { ...r, ...changes } : r)));
    touched.forEach((p) => (opts.now ? push(p) : pushSoon(p)));
  }, [canEdit, push, pushSoon, rows]);

  /**
   * เลข "งวดที่" ของส่วนแรกกระจายต่อให้ส่วนอื่น: ส่วนที่ 1-2 เป็นงวดเดียวกัน
   * ส่วนที่ 3 ขึ้นไปเป็นงวดถัดไป (planEditPeriodLabel ของเขา)
   */
  const patchLabel = useCallback((period, value) => {
    if (!canEdit) return;
    const list = (byProject.get(period.project_id) || []);
    const isFirst = list.length > 0 && list[0].id === period.id;
    const n = parseInt(String(value).replace(/\D/g, ''), 10);
    if (!isFirst || Number.isNaN(n)) { patch(period, { period_label: value }); return; }
    const want = new Map(list.map((s, i) => [s.id, String(i <= 1 ? n : n + (i - 1))]));
    const changed = (r) => want.has(r.id) && String(r.period_label || '') !== want.get(r.id);
    const touched = rows.filter(changed).map((r) => ({ ...r, period_label: want.get(r.id) }));
    setRows((prev) => prev.map((r) => (changed(r) ? { ...r, period_label: want.get(r.id) } : r)));
    touched.forEach((p) => pushSoon(p));
  }, [byProject, canEdit, patch, pushSoon, rows]);

  const addProject = async (projectId) => {
    setAdding(projectId);
    try {
      await creditApi.addTbarProject({ projectId, month, kind });
      toast.success(t('เพิ่มโครงการ {p} แล้ว', { p: projectById[projectId]?.code || '' }));
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(`${t('เพิ่มไม่สำเร็จ')}: ${e.message}`);
    } finally {
      setAdding(null);
    }
  };

  const addSection = async (projectId, type) => {
    setTypePicker(null);
    const list = byProject.get(projectId) || [];
    const next = list.reduce((m, p) => Math.max(m, p.period_idx), 0) + 1;
    if (next > MAX_PERIODS) { toast.error(t('ใส่ได้สูงสุด 5 ส่วนต่อเดือน')); return; }
    // งวดที่ N นับเฉพาะส่วน income — ส่วนหักหนี้/Aval ไม่ใช่งวดงาน
    const ordinal = type === 'income' ? list.filter((p) => p.period_type === 'income').length + 1 : 0;
    setSaving((n) => n + 1);
    try {
      await creditApi.saveTbarPeriod({
        projectId, month, kind, periodIdx: next, periodType: type,
        periodLabel: ordinal ? String(ordinal) : '',
        deductions: type === 'deduction' ? defaultDeductions().map((d) => (
          d.label === 'หัก PN' && (prevPn[projectId] || 0) > 0 ? { ...d, amount: prevPn[projectId] } : d
        )) : [],
        incomeBreak: type === 'income' ? defaultIncome(ordinal >= 2 ? 'progress' : 'work') : undefined,
        paidIds: [],
      });
      toast.success(t('เพิ่มส่วนแล้ว'));
      await load();
    } catch (e) {
      toast.error(`${t('เพิ่มไม่สำเร็จ')}: ${e.message}`);
    } finally {
      setSaving((n) => Math.max(0, n - 1));
    }
  };

  const copyPrev = async (projectId) => {
    try {
      await creditApi.copyTbarMonth({ projectId, month, kind });
      toast.success(t('คัดลอกจากเดือนก่อนแล้ว'));
      await load();
    } catch (e) {
      toast.error(`${t('คัดลอกไม่สำเร็จ')}: ${e.message}`);
    }
  };

  const delSection = async (period) => {
    if (!(await confirm({ title: t('ลบส่วนนี้?'), confirmLabel: t('ลบ'), danger: true }))) return;
    try {
      await creditApi.deleteTbarPeriod(period.id);
      setRows((prev) => prev.filter((r) => r.id !== period.id));
      onChanged?.();
    } catch (e) {
      toast.error(`${t('ลบไม่สำเร็จ')}: ${e.message}`);
    }
  };

  const delProject = async (projectId) => {
    const list = byProject.get(projectId) || [];
    const code = projectById[projectId]?.code || '';
    if (!(await confirm({
      title: t('ลบ T-bar ของโครงการนี้ทั้งหมด'),
      message: t('{code} · {n} ส่วน', { code, n: list.length }),
      confirmLabel: t('ลบ'), danger: true,
    }))) return;
    try {
      await creditApi.deleteTbarProject({ projectId, month, kind });
      setRows((prev) => prev.filter((r) => r.project_id !== projectId));
      onChanged?.();
    } catch (e) {
      toast.error(`${t('ลบไม่สำเร็จ')}: ${e.message}`);
    }
  };

  /** ย้ายตั๋วไปส่วนที่อยู่ติดกัน — ต้นทางเสียไป ปลายทางได้มา บันทึกทั้งสองส่วน */
  const moveItem = (period, txnId, targetIdx) => {
    const list = byProject.get(period.project_id) || [];
    const target = list.find((p) => p.period_idx === Number(targetIdx));
    if (!target) { toast.error(t('ไม่พบส่วนปลายทาง')); return; }
    patch(period, { paid_ids: (period.paid_ids || []).filter((x) => x !== txnId) }, { now: true });
    if (!(target.paid_ids || []).includes(txnId)) {
      patch(target, { paid_ids: [...(target.paid_ids || []), txnId] }, { now: true });
    }
  };

  /** เปลี่ยนโครงการของการ์ด — เก็บโครงสร้างและยอดที่กรอกไว้ ตั๋วเริ่มใหม่ */
  const changeProject = async (oldId, newId) => {
    if (!newId || oldId === newId) return;
    if (byProject.has(newId)) { toast.error(t('โครงการนี้มีอยู่ในแผนเดือนนี้แล้ว')); return; }
    const list = byProject.get(oldId) || [];
    const eligible = outstanding
      .filter((o) => o.project_id === newId && String(o.due || '').slice(0, 7) === month)
      .map((o) => o.id);
    setSaving((n) => n + 1);
    try {
      let firstIncome = true;
      for (const p of list) {
        const claim = p.period_type === 'income' && firstIncome;
        if (claim) firstIncome = false;
        // eslint-disable-next-line no-await-in-loop
        await creditApi.saveTbarPeriod({
          id: p.id, projectId: newId, month, kind, periodIdx: p.period_idx,
          periodType: p.period_type, periodLabel: String(p.period_label || ''),
          periodDate: p.period_date || null, income: Number(p.income) || 0,
          deductions: p.deductions || [], incomeBreak: p.income_break || undefined,
          extraRows: p.extra_rows || [], avalAmount: Number(p.aval_amount) || 0,
          pnRate: p.pn_rate == null ? undefined : Number(p.pn_rate),
          paidIds: claim ? eligible : [],
        });
      }
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(`${t('บันทึกไม่สำเร็จ')}: ${e.message}`);
    } finally {
      setSaving((n) => Math.max(0, n - 1));
    }
  };

  const doExport = async () => {
    setExporting(true);
    try {
      const url = await creditApi.tbarExportUrl({ month, kind });
      const a = document.createElement('a');
      a.href = url;
      a.download = `Tbar_${kind}_${month}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast.success(t('ดาวน์โหลดไฟล์ Excel แล้ว'));
    } catch (e) {
      toast.error(`${t('ส่งออกไม่สำเร็จ')}: ${e.message}`);
    } finally {
      setExporting(false);
    }
  };

  const grand = useMemo(() => {
    let cashIn = 0; let cashOut = 0;
    for (const list of byProject.values()) {
      const tt = projectTotals(list, { amountById });
      cashIn += tt.cashIn; cashOut += tt.cashOut;
    }
    return { cashIn, cashOut, net: cashIn - cashOut };
  }, [byProject, amountById]);

  const pickerItems = useMemo(() => {
    if (!itemPicker) return { current: [], future: [] };
    const list = byProject.get(itemPicker.project_id) || [];
    const own = new Set(itemPicker.paid_ids || []);
    const claimed = new Set();
    for (const p of list) if (p.id !== itemPicker.id) (p.paid_ids || []).forEach((id) => claimed.add(id));
    const pool = outstanding.filter((o) => o.project_id === itemPicker.project_id
      && !own.has(o.id) && !claimed.has(o.id));
    return {
      current: pool.filter((o) => String(o.due || '').slice(0, 7) === month),
      future: pool.filter((o) => String(o.due || '').slice(0, 7) !== month),
    };
  }, [itemPicker, byProject, outstanding, month]);

  const title = kind === 'actual' ? 'หักค่างานตามจริง' : 'แผนการเงิน';

  return (
    <div className="space-y-3">
      {/* แถบหัวจอ: ชื่อฉบับ · เดือน · เพิ่มโครงการ · ยอดรวม · ส่งออก */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {t(title)} · {t('เดือน')}
        </div>
        <select value={month} onChange={(e) => setMonth(e.target.value)} className="field !w-auto" title={t('เดือน')}>
          {monthOptions().map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {addable.length === 0 ? (
          <span className="text-xs text-slate-400">{t('ทุกโครงการมีแผนแล้ว')}</span>
        ) : byProject.size === 0 ? (
          // ก่อนจะมี T-bar แรก ให้เลือกจากการ์ด "เริ่มต้น" ข้างล่าง ไม่มีสองช่องแข่งกัน
          <span title={t('เลือกโครงการแรกจากการ์ด “เริ่มต้น” ด้านล่างก่อน')}
            className="cursor-not-allowed select-none rounded-md bg-slate-200 px-2.5 py-1.5 text-[13px] font-semibold text-slate-400">
            ＋ {t('เพิ่มโครงการ')} —
          </span>
        ) : (
          <select value="" disabled={!canEdit || Boolean(adding)} title={t('เพิ่มโครงการ')}
            onChange={(e) => { if (e.target.value) addProject(e.target.value); }}
            className="rounded-md border-0 bg-orange-500 px-2.5 py-1.5 text-[13px] font-semibold text-white">
            <option value="">＋ {t('เพิ่มโครงการ')} —</option>
            {addable.map((p) => <option key={p.id} value={p.id} className="text-slate-800">{projectLabel(p)}</option>)}
          </select>
        )}
        {(loading || saving > 0) && <Spinner label={loading ? t('กำลังโหลด') : t('กำลังบันทึก…')} />}
        <div className="ml-auto flex items-center gap-3">
          {byProject.size > 0 && (
            <div className="text-[13px] text-slate-600 dark:text-slate-300">
              {t('รวมทุกโครงการ')} · {t('รับ')} <b>{baht(grand.cashIn)}</b> · {t('จ่าย')} <b>{baht(grand.cashOut)}</b> · {t('คงเหลือ')}{' '}
              <b className={grand.net < 0 ? 'text-red-600' : 'text-emerald-600'}>{baht(grand.net)}</b>
            </div>
          )}
          <button type="button" onClick={doExport} disabled={exporting} className="btn-outline">
            <Icon name="download" className="h-4 w-4" /> {t('Export T-bar')}
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {byProject.size === 0 ? (
        <StartCard projects={addable} busy={Boolean(adding)} onPick={addProject} />
      ) : (
        <>
          {[...byProject.entries()].map(([projectId, list]) => {
            const tt = projectTotals(list, { amountById });
            const pnSold = pnSoldThisMonth(list);
            const projOutstanding = outstanding.filter((o) => o.project_id === projectId);
            const switchable = projects.filter((p) => p.id === projectId || !byProject.has(p.id));
            return (
              <div key={projectId}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center gap-2 bg-slate-900 px-3 py-1.5 text-white">
                  <select value={projectId} disabled={!canEdit}
                    title={t('เปลี่ยนโครงการ — เก็บโครงสร้าง 3 ส่วน แต่เปลี่ยนชื่อโครงการ')}
                    onChange={(e) => changeProject(projectId, e.target.value)}
                    className="rounded-md border border-slate-600 bg-white px-2 py-0.5 text-sm font-bold text-slate-800">
                    {switchable.map((p) => <option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
                  </select>
                  <div className="ml-auto flex items-center gap-1.5">
                    <button type="button" disabled={!canEdit} onClick={() => setTypePicker(projectId)}
                      className="rounded-md border border-slate-600 px-2 py-0.5 text-[12px] font-medium hover:bg-white/10">
                      ＋ {t('เพิ่มส่วน')}
                    </button>
                    <button type="button" disabled={!canEdit || !prevProjects.includes(projectId)}
                      onClick={() => copyPrev(projectId)}
                      className="rounded-md border border-slate-600 p-1 hover:bg-white/10 disabled:opacity-40"
                      title={t('คัดลอกจากเดือนก่อน')} aria-label={t('คัดลอกจากเดือนก่อน')}>
                      <Icon name="copy" className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" disabled={!canEdit} onClick={() => delProject(projectId)}
                      className="rounded-md border border-slate-600 p-1 hover:bg-red-500/30"
                      title={t('ลบ T-bar ของโครงการนี้ทั้งหมด')} aria-label={t('ลบ T-bar ของโครงการนี้ทั้งหมด')}>
                      <Icon name="trash" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <Band />
                {list.length === 0 ? (
                  <div className="py-3 text-center text-xs text-slate-400">{t('ยังไม่มีส่วน — กด ＋ เพิ่มส่วน เพื่อเริ่ม')}</div>
                ) : list.map((p) => (
                  <TbarSection
                    key={p.id} period={p} periods={list} outstanding={projOutstanding}
                    amountById={amountById} pnSold={pnSold} month={month} canEdit={canEdit}
                    onPatch={(changes, opts) => (
                      changes.period_label !== undefined
                        ? patchLabel(p, changes.period_label)
                        : patch(p, changes, opts)
                    )}
                    onDelete={delSection}
                    onMove={moveItem}
                    onRemovePaid={(period, txnId) => patch(period, {
                      paid_ids: (period.paid_ids || []).filter((x) => x !== txnId),
                    }, { now: true })}
                    onOpenPicker={setItemPicker}
                  />
                ))}
                <div className="flex flex-wrap justify-end gap-4 border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-[13px] dark:border-slate-800 dark:bg-slate-800/40">
                  <span className="text-slate-500">{t('รวมรับ')}</span><b className="tabular-nums">{baht(tt.cashIn)}</b>
                  <span className="text-slate-500">{t('รวมจ่าย')}</span><b className="tabular-nums">{baht(tt.cashOut)}</b>
                  <span className="text-slate-500">{t('คงเหลือ')}</span>
                  <b className={`tabular-nums ${tt.net < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{baht(tt.net)}</b>
                </div>
              </div>
            );
          })}

          {/* รวมทุก T-bar ของเดือนนี้ */}
          <div className="card-sm flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="mr-auto text-sm font-bold text-brand">{t('รวมทุก T-bar (Total all)')}</span>
            <span className="text-xs text-slate-500">{t('รวมรับ')}</span><b className="tabular-nums">{baht(grand.cashIn)}</b>
            <span className="text-xs text-slate-500">{t('รวมจ่าย')}</span><b className="tabular-nums">{baht(grand.cashOut)}</b>
            <span className="text-xs text-slate-500">{t('คงเหลือสุทธิ', null, 'tbar')}</span>
            <b className={`text-[17px] tabular-nums ${grand.net < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{baht(grand.net)}</b>
          </div>
        </>
      )}

      {typePicker && (
        <TypePicker projectName={projectById[typePicker]?.code || ''}
          onPick={(type) => addSection(typePicker, type)} onClose={() => setTypePicker(null)} />
      )}
      {itemPicker && (
        pickerItems.current.length + pickerItems.future.length === 0
          ? null
          : (
            <ItemPicker current={pickerItems.current} future={pickerItems.future}
              onClose={() => setItemPicker(null)}
              onPick={(txnId) => {
                patch(itemPicker, { paid_ids: [...(itemPicker.paid_ids || []), txnId] }, { now: true });
                setItemPicker(null);
              }} />
          )
      )}
    </div>
  );
}
