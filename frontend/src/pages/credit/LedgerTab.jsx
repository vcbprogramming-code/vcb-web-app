import { useEffect, useState, useCallback, useMemo } from 'react';
import { creditApi, formatMoney } from '../../lib/modules.js';
import { formatThaiDate } from '../../lib/ememo.js';
import { Modal } from '../../components/ui/index.js';
import Icon from '../../components/Icon.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import { useT } from '../../lib/i18n.jsx';
import { TYPE_CHIP, CostCategoryCombo, SortTh, useSort, projectLabel, typeParams } from './shared.jsx';

// สี่สถานะที่รายการหนึ่งเดินผ่าน เขียนแบบเดียวกับช่องเลือกในฟอร์มของระบบจริง
const EDIT_STATUSES = [
  { value: 'คำขอใหม่', label: 'คำขอใหม่' },
  { value: 'อยู่ระหว่างเสนออนุมัติ', label: 'อยู่ระหว่างเสนออนุมัติ' },
  { value: 'อนุมัติแล้ว', label: 'อนุมัติแล้ว' },
  { value: 'ชำระแล้ว', label: 'ชำระแล้ว (ปิดรายการ)' },
];
const STATUS_CHIP = {
  'คำขอใหม่': 'bg-slate-100 text-slate-600',
  'อยู่ระหว่างเสนออนุมัติ': 'bg-amber-50 text-amber-700',
  'อนุมัติแล้ว': 'bg-blue-50 text-blue-700',
  'ชำระแล้ว': 'bg-emerald-50 text-emerald-700',
  'void': 'bg-slate-100 text-slate-400',
};
const isVoid = (s) => String(s).toLowerCase() === 'void';
/** ป้ายสถานะที่คนอ่านได้ — 'void' เป็นคำในฐานข้อมูล ไม่ใช่คำที่ผู้ใช้พูด */
const statusLabel = (s) => (isVoid(s) ? 'ยกเลิก' : s);

const DUE_LABEL = {
  due7: 'ครบใน 7 วัน', thisMonth: 'ครบกำหนดเดือนนี้', nextMonth: 'ครบกำหนดเดือนหน้า', overdue: 'เกินกำหนด',
};

const dmy = (d) => (d ? formatThaiDate(d) : '—');

/**
 * รายละเอียดรายการสินเชื่อ — อ่านอย่างเดียว
 *
 * ตารางแสดงได้แค่สิบสองคอลัมน์ แต่รายการหนึ่งถือข้อมูลมากกว่านั้น (ช่วงวันของ
 * เอกสารอ้างอิง เอกสารแนบ หมวดค่าใช้จ่าย หมายเหตุ) — จอนี้คือที่ที่คนตรวจสอบ
 * ย้อนหลังเปิดดูว่าเงินก้อนนี้ออกไปด้วยเอกสารอะไร ลำดับแถวเดียวกับของเขา
 */
function LedgerDetail({ row, index, meta, onClose, onEdit, onDelete }) {
  const t = useT();
  const attach = [row.source, [row.ref_doc_from, row.ref_doc_to].filter(Boolean).length
    ? `${dmy(row.ref_doc_from)}${row.ref_doc_to ? ` ${t('ถึง')} ${dmy(row.ref_doc_to)}` : ''}` : ''].filter(Boolean).join(' | ');
  const rows = [
    [t('วันที่ขอ'), dmy(row.created_at)],
    [t('บริษัท'), meta.company || '—'],
    [t('โครงการ'), meta.projectName || '—'],
    [t('ประเภทสินเชื่อ'), <span className={`chip ${TYPE_CHIP[meta.type] || 'bg-slate-100 text-slate-600'}`}>{meta.type || '—'}</span>],
    [t('จำนวนเงิน'), `${formatMoney(row.amount)}`],
    [t('วันครบกำหนด'), dmy(row.due_date)],
    [t('ผู้รับผลประโยชน์'), row.beneficiary || '—'],
    [t('เลขที่เอกสารอ้างอิง'), row.ref || '—'],
    [t('วันที่เอกสารอ้างอิง'), (row.ref_doc_from || row.ref_doc_to)
      ? `${dmy(row.ref_doc_from)}${row.ref_doc_to ? ` ${t('ถึง')} ${dmy(row.ref_doc_to)}` : ''}` : '—'],
    [t('เอกสารแนบ'), attach || '—'],
    [t('หมวดค่าใช้จ่าย'), row.cost_category || '—'],
    [t('สถานะ'), <span className={`chip ${STATUS_CHIP[row.status] || 'bg-slate-100 text-slate-600'}`}>{t(statusLabel(row.status), null, 'status')}</span>],
    [t('หมายเหตุ'), row.note || row.counterparty || '—'],
  ];
  if (row.settled_date) rows.push([t('ชำระเมื่อ'), dmy(row.settled_date)]);

  return (
    <Modal
      title={t('รายละเอียดรายการสินเชื่อ')}
      onClose={onClose}
      size="xl"
      footer={
        <>
          <button onClick={onDelete} className="btn-outline !border-red-200 !text-red-600 hover:!bg-red-50">
            <Icon name="trash" className="h-4 w-4" /> {t('ลบ')}
          </button>
          <button onClick={onEdit} className="btn-primary"><Icon name="edit" className="h-4 w-4" /> {t('แก้ไข')}</button>
        </>
      }
    >
      <p className="text-sm font-semibold text-slate-500">
        {t('คำขอ')}{index ? ` #${index}` : ''} – {meta.type || '—'}
      </p>
      <dl className="divide-y divide-slate-100">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-3 gap-3 py-2 text-sm">
            <dt className="font-medium text-slate-500">{k}</dt>
            <dd className="col-span-2 break-words text-slate-800">{v}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}

/**
 * แก้ไขคำขอ — รวมการเปลี่ยนสถานะไว้ในฟอร์มเดียว
 *
 * ระบบจริงเลิกมีปุ่ม "อนุมัติ" ในแถวแล้ว เพราะการอนุมัติคือการเปลี่ยนสถานะ
 * เหมือนการเปลี่ยนอย่างอื่น ๆ — อยู่ที่เดียวกันทำให้คนเห็นว่าตอนนี้อยู่ขั้นไหน
 * ก่อนจะเลื่อนไปขั้นถัดไป ไม่ใช่กดปุ่มโดยไม่รู้ว่ากดจากสถานะอะไร
 *
 * โครงการกับประเภทวงเงินอ่านได้แต่แก้ไม่ได้: ย้ายรายการข้ามวงเงินคือการย้ายเงิน
 * ที่ธนาคารนับไว้แล้ว ต้องปลดที่ก้อนเดิมและเบิกที่ก้อนใหม่ ไม่ใช่แก้ช่องเดียว
 */
function LedgerEditModal({ row, meta, costCategories, onClose, onSaved }) {
  const t = useT();
  const toast = useToast();
  const [form, setForm] = useState({
    amount: String(Number(row.amount) || 0),
    status: isVoid(row.status) ? 'คำขอใหม่' : row.status,
    startDate: row.start_date ? String(row.start_date).slice(0, 10) : '',
    dueDate: row.due_date ? String(row.due_date).slice(0, 10) : '',
    termDays: row.term_days ?? '',
    ref: row.ref || '',
    beneficiary: row.beneficiary || '',
    counterparty: row.counterparty || '',
    costCategory: row.cost_category || '',
    note: row.note || '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const amount = Number(String(form.amount).replace(/,/g, ''));
    if (!amount || Number.isNaN(amount)) { toast.error(t('กรอกข้อมูลที่จำเป็น (*) ให้ครบ')); return; }
    setBusy(true);
    try {
      await creditApi.updateLedger(row.id, {
        amount,
        status: form.status,
        startDate: form.startDate || null,
        dueDate: form.dueDate || null,
        termDays: form.termDays === '' ? null : Number(form.termDays),
        ref: form.ref || null,
        beneficiary: form.beneficiary || null,
        counterparty: form.counterparty || null,
        costCategory: form.costCategory || null,
        note: form.note || null,
      });
      toast.success(t('แก้ไขคำขอแล้ว'));
      onSaved();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      title={t('แก้ไขคำขอ')}
      onClose={onClose}
      size="2xl"
      footer={
        <>
          <button onClick={onClose} className="btn-outline">{t('ยกเลิก')}</button>
          <button onClick={save} disabled={busy} className="btn-primary">{busy ? t('กำลังบันทึก…') : t('บันทึก')}</button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">{t('โครงการ')}</label>
          <input value={meta.projectName || ''} readOnly className="field bg-slate-50 text-slate-500" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">{t('ประเภทสินเชื่อ')}</label>
          <input value={meta.type || ''} readOnly className="field bg-slate-50 text-slate-500" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">{t('จำนวนเงิน (บาท)')} <span className="text-red-500">*</span></label>
          <input type="number" value={form.amount} onChange={(e) => set('amount', e.target.value)} className="field" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">{t('สถานะ')}</label>
          <select value={form.status} onChange={(e) => set('status', e.target.value)} className="field" title={t('สถานะ')}>
            {EDIT_STATUSES.map((s) => <option key={s.value} value={s.value}>{t(s.label)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">{t('วันที่เริ่ม')}</label>
          <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} className="field" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">{t('จำนวนวัน')}</label>
          <input type="number" value={form.termDays} onChange={(e) => set('termDays', e.target.value)} className="field" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">{t('วันครบกำหนด')}</label>
          <input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} className="field" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">{t('ผู้รับผลประโยชน์')}</label>
          <input value={form.beneficiary} onChange={(e) => set('beneficiary', e.target.value)} className="field" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">{t('เลขที่เอกสารอ้างอิง')}</label>
          <input value={form.ref} onChange={(e) => set('ref', e.target.value)} className="field" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">{t('รายละเอียด / คู่ค้า')}</label>
          <input value={form.counterparty} onChange={(e) => set('counterparty', e.target.value)} className="field" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">{t('หมวดค่าใช้จ่าย')}</label>
          <CostCategoryCombo value={form.costCategory} onChange={(v) => set('costCategory', v)} options={costCategories} />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600">{t('หมายเหตุ')}</label>
        <textarea rows={2} value={form.note} onChange={(e) => set('note', e.target.value)} className="field"
          placeholder={t('รายละเอียดเพิ่มเติม…')} />
      </div>
    </Modal>
  );
}

export default function LedgerTab({ projects, filters, types = [], costCategories = [], onChanged }) {
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [facilities, setFacilities] = useState([]);
  const [error, setError] = useState(null);
  const [view, setView] = useState(null);     // { row, index }
  const [edit, setEdit] = useState(null);
  const sort = useSort();

  // ตัวกรองมาจากแถบชุดเดียวบนหน้าหลัก — การ์ดบนแดชบอร์ดตั้งค่าที่นั่นแล้วพามาที่นี่
  const { projectId = '', company = '', search = '', type = '', status = '', due = '' } = filters || {};

  const loadRefs = useCallback(() => {
    creditApi.facilities({}).then((r) => setFacilities(r.data || [])).catch(() => setFacilities([]));
    // ยอดทั้งหมดไม่ขึ้นกับตัวกรอง — บรรทัด "แสดง N / M" ต้องเทียบกับทะเบียนทั้งเล่ม
    creditApi.ledger({}).then((r) => setTotal((r.data || []).length)).catch(() => setTotal(0));
  }, []);
  useEffect(loadRefs, [loadRefs]);

  const load = useCallback(() => {
    creditApi.ledger({ projectId, status, due, company, search, ...typeParams(type) })
      .then((r) => setRows(r.data)).catch((e) => setError(e.message));
  }, [projectId, status, due, company, search, type]);
  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);
  const projById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);
  const facById = useMemo(() => Object.fromEntries(facilities.map((f) => [f.id, f])), [facilities]);

  /** ข้อมูลที่แถวหนึ่งต้องเอามาจากวงเงินที่สังกัด — บริษัทและประเภทอยู่ที่วงเงิน */
  const metaOf = useCallback((l) => {
    const f = facById[l.facility_id] || {};
    const p = projById[l.project_id];
    return { company: f.company || '', type: f.type || '', available: f.available,
      projectName: p ? (p.name || p.code) : '', projectCode: p?.code || '' };
  }, [facById, projById]);

  const sorted = useMemo(() => sort.apply(rows, {
    date: (l) => new Date(l.created_at || 0).getTime(),
    company: (l) => metaOf(l).company,
    project: (l) => metaOf(l).projectName,
    type: (l) => metaOf(l).type,
    ref: (l) => l.ref || '',
    detail: (l) => [l.counterparty, l.beneficiary].filter(Boolean).join(' '),
    amount: (l) => Number(l.amount) || 0,
    start: (l) => new Date(l.start_date || 0).getTime(),
    due: (l) => new Date(l.due_date || 0).getTime(),
    status: (l) => statusLabel(l.status),
  }), [rows, sort, metaOf]);

  // ยอดรวมท้ายตาราง: นับเฉพาะรายการที่อนุมัติแล้วและเป็นยอดบวก — เงินที่ยังต้อง
  // จ่ายจริง รายการที่ปลดวงเงิน (ยอดลบ) กับที่ปิดแล้วไม่ใช่หนี้ค้าง
  const outstanding = useMemo(
    () => sorted.reduce((a, l) => (l.status === 'อนุมัติแล้ว' && Number(l.amount) > 0 ? a + Number(l.amount) : a), 0),
    [sorted]);

  const refresh = () => { load(); loadRefs(); onChanged?.(); };

  const settle = async (l) => {
    const ok = await confirm({
      title: t('ชำระ / ปิดรายการ'),
      message: t('ยืนยันชำระ/ปิดรายการนี้? วงเงินจะถูกปล่อยคืนและดอกเบี้ยจะหยุดเดิน'),
      confirmLabel: t('ชำระ'), danger: false,
    });
    if (!ok) return;
    try { await creditApi.settleLedger(l.id); toast.success(t('ปิดรายการแล้ว')); refresh(); }
    catch (e) { toast.error(e.message); }
  };
  const remove = async (l) => {
    const ok = await confirm({
      title: t('ลบรายการ'),
      message: t('ลบรายการนี้? วงเงินที่ใช้ไปจะถูกปล่อยคืน'),
      confirmLabel: t('ลบ'),
    });
    if (!ok) return;
    try { await creditApi.deleteLedger(l.id); toast.success(t('ลบรายการแล้ว')); setView(null); refresh(); }
    catch (e) { toast.error(e.message); }
  };

  const dueLabel = DUE_LABEL[due];
  const projLabelOf = (id) => (projById[id] ? projectLabel(projById[id]) : '');

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      {/* ป้ายบอกว่าตารางนี้ถูกกรองไว้ — คนที่กดมาจากการ์ดจะได้ไม่คิดว่านี่คือทั้งหมด */}
      {dueLabel && (
        <div className="text-sm font-semibold text-slate-700">
          {t('แสดงเฉพาะ:')} {t(dueLabel)}{projectId ? ` · ${projLabelOf(projectId)}` : ''}
        </div>
      )}
      <div className="text-xs text-slate-400">
        {t('แสดง')} {sorted.length} / {total} {t('รายการ')}
      </div>

      <div className="card !p-0 overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr className="tbl-head">
              <th className="tbl-th w-10">#</th>
              <SortTh sort={sort} colKey="date">{t('วันที่')}</SortTh>
              <SortTh sort={sort} colKey="company">{t('บริษัท')}</SortTh>
              <SortTh sort={sort} colKey="project">{t('โครงการ')}</SortTh>
              <SortTh sort={sort} colKey="type">{t('ประเภท')}</SortTh>
              <SortTh sort={sort} colKey="ref">{t('เลขที่เอกสาร')}</SortTh>
              <SortTh sort={sort} colKey="detail">{t('รายละเอียด / ผู้รับผลประโยชน์')}</SortTh>
              <SortTh sort={sort} colKey="amount" className="text-right">{t('จำนวนเงิน')}</SortTh>
              <SortTh sort={sort} colKey="start">{t('เริ่ม')}</SortTh>
              <SortTh sort={sort} colKey="due">{t('ครบ')}</SortTh>
              <SortTh sort={sort} colKey="status">{t('สถานะ')}</SortTh>
              <th className="tbl-th text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.length === 0 ? (
              <tr><td colSpan={12} className="px-5 py-10 text-center text-slate-400">{t('ไม่มีรายการเคลื่อนไหว')}</td></tr>
            ) : sorted.map((l, i) => {
              const m = metaOf(l);
              const paid = l.status === 'ชำระแล้ว';
              const detail = [l.counterparty, l.beneficiary].filter(Boolean).join(' | ') || '—';
              // เตือนว่าขอเกินคงเหลือ — เทียบได้เฉพาะรายการที่ยังไม่ถูกตัดวงเงิน
              // รายการที่อนุมัติแล้วถูกหักออกจากคงเหลือไปแล้ว เทียบอีกจะเตือนผิด
              const pendingApproval = l.status === 'คำขอใหม่' || l.status === 'อยู่ระหว่างเสนออนุมัติ';
              const over = pendingApproval && m.available != null && Number(l.amount) > Number(m.available);
              return (
                <tr key={l.id} className={`tbl-row ${paid ? 'opacity-60' : ''}`}>
                  <td className="tbl-td text-slate-400">{i + 1}</td>
                  <td className="tbl-td text-slate-500">{dmy(l.created_at)}</td>
                  <td className="tbl-td text-slate-600">{m.company || '—'}</td>
                  <td className="tbl-td text-slate-700">{m.projectName || '—'}</td>
                  <td className="tbl-td"><span className={`chip ${TYPE_CHIP[m.type] || 'bg-slate-100 text-slate-600'}`}>{m.type || '—'}</span></td>
                  <td className="tbl-td text-slate-500">{l.ref || '—'}</td>
                  <td className="tbl-td max-w-[220px] truncate text-slate-600" title={detail}>{detail}</td>
                  <td className={`tbl-td text-right tabular-nums font-medium ${Number(l.amount) < 0 ? 'text-emerald-600' : ''}`}>
                    {formatMoney(l.amount)}
                    {over && (
                      <span className="ml-1 whitespace-nowrap rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700"
                        title={`${t('คงเหลือ')} ${formatMoney(m.available)}`}>
                        {t('เกินวงเงิน')} {formatMoney(Number(l.amount) - Number(m.available))}
                      </span>
                    )}
                  </td>
                  <td className="tbl-td text-slate-500">{dmy(l.start_date)}</td>
                  <td className="tbl-td text-slate-500">{dmy(l.due_date)}</td>
                  <td className="tbl-td"><span className={`chip ${STATUS_CHIP[l.status] || 'bg-slate-100 text-slate-600'}`}>{t(statusLabel(l.status), null, 'status')}</span></td>
                  <td className="tbl-td text-right whitespace-nowrap">
                    {l.status === 'อนุมัติแล้ว' && (
                      <button onClick={() => settle(l)} className="mr-2 text-sm text-emerald-600 hover:underline">{t('ชำระ')}</button>
                    )}
                    <button onClick={() => setView({ row: l, index: i + 1 })} className="mr-1 text-slate-400 hover:text-slate-700"
                      title={t('ดู')} aria-label={t('ดู')}><Icon name="eye" className="inline h-4 w-4" /></button>
                    <button onClick={() => setEdit(l)} className="mr-1 text-slate-400 hover:text-slate-700"
                      title={t('แก้ไข')} aria-label={t('แก้ไข')}><Icon name="edit" className="inline h-4 w-4" /></button>
                    <button onClick={() => remove(l)} className="text-slate-400 hover:text-red-600"
                      title={t('ลบ')} aria-label={t('ลบ')}><Icon name="trash" className="inline h-4 w-4" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {sorted.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50/60">
                <th colSpan={7} className="px-5 py-2.5 text-right text-sm font-bold text-slate-700">
                  {t('รวมยอดค้างชำระ')}{dueLabel ? ` (${t(dueLabel)})` : ''}
                </th>
                <th className="px-5 py-2.5 text-right text-sm font-bold tabular-nums text-slate-900">{formatMoney(outstanding)}</th>
                <th colSpan={4} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {view && (
        <LedgerDetail
          row={view.row} index={view.index} meta={metaOf(view.row)}
          onClose={() => setView(null)}
          onEdit={() => { setEdit(view.row); setView(null); }}
          onDelete={() => remove(view.row)}
        />
      )}
      {edit && (
        <LedgerEditModal
          row={edit} meta={metaOf(edit)} costCategories={costCategories}
          onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); refresh(); }}
        />
      )}
    </div>
  );
}
