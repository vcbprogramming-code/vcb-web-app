import { useCallback, useEffect, useMemo, useState } from 'react';
import { perfApi } from '../../lib/performance.js';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import Spinner from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * ระบบลางาน — ask, wait, be told.
 *
 * Three views of the same queue, because three different people come here: the
 * person who filed it wants to know where it got to, the supervisor wants the
 * ones still waiting on them, and both want to look back at what was decided.
 *
 * แถวหนึ่งคือหนึ่งคำขอ วางเป็นกริดคอลัมน์เดียวกับหัวตาราง (แบบ .lv-ticket ของเขา)
 * บนจอกว้าง และยุบเป็นกองซ้อนบนจอแคบ — หัวตารางจึงซ่อนบนจอแคบด้วย เพราะหัว
 * คอลัมน์ที่ไม่ตรงกับคอลัมน์ไหนเลยอ่านไม่รู้เรื่อง
 */
const STATUS = {
  pending:   { label: 'รออนุมัติ',  chip: 'bg-amber-50 text-amber-700',     bar: '#e8b500' },
  approved:  { label: 'อนุมัติแล้ว', chip: 'bg-emerald-50 text-emerald-700', bar: '#1f9d55' },
  rejected:  { label: 'ไม่อนุมัติ',  chip: 'bg-rose-50 text-rose-700',       bar: '#e0533a' },
  cancelled: { label: 'ยกเลิกแล้ว',  chip: 'bg-slate-100 text-slate-500',    bar: '#cbd5e1' },
};
const DAY_PART_TH = { first_half: 'ครึ่งวันเช้า', second_half: 'ครึ่งวันบ่าย' };
const thDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear() + 543}`;
};

/** คอลัมน์ชุดเดียวกันทั้งหัวตารางและแถว จะได้ตรงกันแน่นอน */
const GRID = 'md:grid md:grid-cols-[minmax(8rem,1.1fr)_minmax(5.5rem,.8fr)_minmax(8.5rem,1fr)_3.5rem_minmax(5rem,.7fr)_minmax(7rem,1.1fr)_auto] md:items-start md:gap-x-3';

function HeadRow() {
  const t = useT();
  return (
    <div className={`hidden border-b border-slate-200 bg-slate-50/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 ${GRID}`}>
      <div>{t('ชื่อพนักงาน')}</div>
      <div>{t('หน่วยงาน')}</div>
      <div>{t('ช่วงวันที่ลา')}</div>
      <div>{t('วัน')}</div>
      <div>{t('ประเภทการลา')}</div>
      <div>{t('เหตุผล')}</div>
      <div className="text-right">{t('สถานะ')}</div>
    </div>
  );
}

function Row({ r, children, onOpenFile, onDownloadFile }) {
  const t = useT();
  const st = STATUS[r.status] || STATUS.pending;
  return (
    <div className={`border-b border-slate-100 px-4 py-3 last:border-0 ${GRID}`}
      style={{ borderLeft: `4px solid ${st.bar}` }}>
      {/* ชื่อพนักงานขึ้นทุกแท็บ รวมแท็บ "คำขอของฉัน" — ของเขาซ่อนได้เพราะแท็บนั้น
          คือคำขอของตัวเองจริง ๆ ส่วนของเราฝ่ายบุคคลยื่นแทนคนอื่น ไม่มีชื่อแล้ว
          อ่านไม่ออกว่าแถวนี้ของใคร */}
      <div className="min-w-0">
        <div className="truncate font-medium text-slate-800">{r.employee_name}</div>
        {r.employee_code && <div className="truncate text-[11px] text-slate-400 md:hidden">{r.employee_code}</div>}
      </div>
      <div className="min-w-0 text-xs text-slate-500">
        <span className="truncate">{r.site_name || '—'}</span>
      </div>

      <div className="min-w-0 text-sm text-slate-800">
        {thDate(r.from_date)} – {thDate(r.to_date)}
        {/* A certificate that can be attached and never opened again is a filing
            cabinet with no handle — the name is the button. */}
        {r.has_attachment && (
          <div className="mt-1 flex items-center gap-1">
            <button onClick={() => onOpenFile?.(r)} title={t('เปิดไฟล์แนบ')}
              className="inline-flex min-w-0 items-center gap-1 text-xs text-brand hover:underline">
              <Icon name="paperclip" className="h-3.5 w-3.5 shrink-0" />
              <span className="max-w-[130px] truncate">{r.attachment_name || t('ไฟล์แนบ')}</span>
            </button>
            <button onClick={() => onDownloadFile?.(r)} title={t('ดาวน์โหลดไฟล์แนบ')}
              className="text-slate-400 hover:text-brand">
              <Icon name="download" className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      <div className="text-sm tabular-nums text-slate-600">{r.days} {t('วัน')}</div>
      <div className="min-w-0 text-xs text-slate-600">
        {r.leave_type_th}
        {DAY_PART_TH[r.day_part] ? <div className="text-slate-400">{t(DAY_PART_TH[r.day_part])}</div> : null}
      </div>
      <div className="min-w-0">
        {r.reason
          ? <div className="truncate text-sm text-slate-600" title={r.reason}>{r.reason}</div>
          : <div className="text-sm text-slate-400">{t('— ไม่ได้ระบุเหตุผล')}</div>}
        {r.decided_by_name ? (
          <div className="mt-0.5 text-[11px] text-slate-500">
            {t(st.label, null, 'status')}{t('โดย')} {r.decided_by_name} · {thDate(r.decided_at)}
            {r.decide_note ? ` — ${r.decide_note}` : ''}
          </div>
        ) : r.status === 'pending' && r.approver_names ? (
          // Waiting is easier to accept when you know who you are waiting for.
          <div className="mt-0.5 text-[11px] text-slate-500">{t('รอ')} {r.approver_names} {t('อนุมัติ')}</div>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-end gap-2 md:mt-0">
        <span className={`chip ${st.chip}`}>{t(st.label, null, 'status')}</span>
        {children}
      </div>
    </div>
  );
}

export default function LeaveView({ employees, canEntry, onChanged, features = {} }) {
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const [types, setTypes] = useState([]);
  const [mine, setMine] = useState(null);
  const [pending, setPending] = useState(null);
  const [decided, setDecided] = useState(null);
  const [decidedTotal, setDecidedTotal] = useState(0);
  const [canDecide, setCanDecide] = useState(false);
  const [tab, setTab] = useState('mine');
  const [histFilter, setHistFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ employeeId: '', leaveType: 'sick', from: '', to: '', reason: '', dayPart: 'full', file: null });
  const [error, setError] = useState(null);

  const load = useCallback(() => Promise.all([
    perfApi.leaveTypes(), perfApi.myLeave(), perfApi.pendingLeave(), perfApi.decidedLeave(),
  // ห้ามตั้งชื่อตัวแปรว่า t นอกจากฟังก์ชันแปล — ตัวแรกคือรายการประเภทการลา
  ]).then(([lt, m, p, d]) => {
    setTypes(lt.types || []);
    setMine(m.rows || []);
    setPending(p.rows || []);
    setCanDecide(Boolean(p.canDecide));
    setDecided(d.rows || []);
    setDecidedTotal(d.total ?? (d.rows || []).length);
  }).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const days = useMemo(() => {
    if (!form.from || !form.to) return 0;
    const a = new Date(form.from); const b = new Date(form.to);
    return b < a ? 0 : Math.round((b - a) / 86400000) + 1;
  }, [form.from, form.to]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.employeeId) { setError(t('กรุณาเลือกชื่อพนักงาน')); return; }
    if (!form.from || !form.to) { setError(t('กรุณาระบุช่วงวันที่ลา')); return; }
    if (form.to < form.from) { setError(t('วันสิ้นสุดต้องไม่ก่อนวันเริ่มลา')); return; }
    if (form.dayPart !== 'full' && form.from !== form.to) { setError(t('ลาครึ่งวันเลือกได้เฉพาะวันเดียว')); return; }
    setBusy(true);
    try {
      const r = await perfApi.requestLeave(form);
      toast.success(t('ส่งคำขอลาแล้ว รอการอนุมัติ'));
      // §6 เตือนเมื่อวันที่ขอลาชนกับวันที่บันทึกงานไว้แล้ว
      const clash = r.warnWorkedDays || r.data?.warnWorkedDays || [];
      if (clash.length) toast.info(t('วันที่ขอลามีบันทึกงานอยู่แล้ว {n} วัน — ตรวจสอบอีกครั้ง', { n: clash.length }));
      setForm({ employeeId: '', leaveType: 'sick', from: '', to: '', reason: '', dayPart: 'full', file: null });
      await load();
      setTab('mine');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const decide = async (r, approve) => {
    // ถ้อยคำเดียวกับระบบจริง — ข้อความอนุมัติบอกด้วยว่ามันจะเขียนลงตารางงานให้
    const ok = await confirm({
      title: approve ? t('อนุมัติ') : t('ไม่อนุมัติ'),
      message: `${r.employee_name} · ${thDate(r.from_date)} – ${thDate(r.to_date)} (${r.days} ${t('วัน')})\n`
        + (approve ? t('อนุมัติคำขอลานี้และบันทึกลงตารางงานหรือไม่?') : t('ไม่อนุมัติคำขอลานี้หรือไม่?')),
      confirmLabel: approve ? t('อนุมัติ') : t('ไม่อนุมัติ'), danger: !approve,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await perfApi.decideLeave(r.id, approve);
      toast.success(approve ? t('อนุมัติแล้ว') : t('ไม่อนุมัติแล้ว'));
      await load();
      onChanged?.();
    } catch (err) { toast.error(err.message || t('ดำเนินการไม่สำเร็จ')); }
    finally { setBusy(false); }
  };

  const cancel = async (r) => {
    const ok = await confirm({
      title: t('ยกเลิกคำขอ'),
      message: t('ยกเลิกคำขอลานี้หรือไม่? การกระทำนี้ย้อนกลับไม่ได้'),
      confirmLabel: t('ยกเลิกคำขอ'), danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try { await perfApi.cancelLeave(r.id); toast.success(t('ยกเลิกคำขอแล้ว')); await load(); }
    catch (err) {
      // 409 = มีคนพิจารณาไปแล้ว แถวไม่ได้เสีย แต่ไม่ใช่ของเราให้ยกเลิกอีกต่อไป
      toast.error(/ALREADY_DECIDED|พิจารณา/.test(err.message || '')
        ? t('คำขอนี้ถูกพิจารณาแล้ว ยกเลิกไม่ได้') : (err.message || t('ยกเลิกไม่สำเร็จ')));
      await load();
    }
    finally { setBusy(false); }
  };

  // A site office still keeps a paper file, and the person approving often wants
  // something to hold. Open it in a tab rather than downloading: people read it
  // and print from there, and a forced download makes that two steps.
  const openAttachment = async (r) => {
    try {
      const url = await perfApi.leaveAttachmentUrl(r.id);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { toast.error(e.message); }
  };
  const downloadAttachment = async (r) => {
    try {
      const url = await perfApi.leaveAttachmentUrl(r.id);
      const a = document.createElement('a');
      a.href = url; a.download = r.attachment_name || 'leave-attachment';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { toast.error(e.message); }
  };

  const openSlip = async (r) => {
    try {
      const url = await perfApi.leaveSlipUrl(r.id);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { toast.error(e.message); }
  };

  if (!mine || !pending || !decided) return <div className="flex justify-center py-12"><Spinner label={t('กำลังโหลดคำขอลา…')} /></div>;

  const TABS = [
    { key: 'mine', label: t('คำขอของฉัน'), n: mine.length },
    ...(canDecide ? [{ key: 'pending', label: t('รออนุมัติ'), n: pending.length, hot: pending.length > 0 }] : []),
    ...(canDecide ? [{ key: 'decided', label: t('ประวัติการพิจารณา'), n: decided.length }] : []),
  ];
  const histRows = histFilter === 'all' ? decided : decided.filter((r) => r.status === histFilter);
  const list = tab === 'mine' ? mine : tab === 'pending' ? pending : histRows;

  // นับสรุปบนหัวรายการ — เห็นภาพรวมก่อนไล่อ่านทีละแถว (ตามระบบจริง)
  const n = (rows, s) => rows.filter((r) => r.status === s).length;

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="text-lg font-bold text-slate-800">{t('คำขอ')}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{t('ขอลาและติดตามสถานะคำขอของคุณ')}</p>
      </div>

      {canEntry && (
        <form onSubmit={submit} className="card space-y-3">
          <h3 className="text-sm font-bold text-slate-800">{t('ขอลาใหม่')}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">{t('ชื่อพนักงาน')} <span className="text-red-500">*</span></label>
              <select value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} className="field">
                <option value="">{t('— เลือกชื่อ —')}</option>
                {employees.map((e) => <option key={e.eid} value={e.eid}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">{t('ประเภทการลา')}</label>
              <select value={form.leaveType} onChange={(e) => setForm((f) => ({ ...f, leaveType: e.target.value }))} className="field">
                {types.map((lt) => <option key={lt.code} value={lt.code}>{lt.th}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">{t('วันที่เริ่มลา')} <span className="text-red-500">*</span></label>
              <input type="date" value={form.from} onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))} className="field" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">{t('วันที่สิ้นสุด')} <span className="text-red-500">*</span></label>
              <input type="date" value={form.to} onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))} className="field" />
            </div>
          </div>
          {/* ระบบจริงของลูกค้ารับเฉพาะลาเต็มวันและไม่มีไฟล์แนบ ทั้งสองช่องจึงขึ้น
              กับสวิตช์ — ฝั่งเซิร์ฟเวอร์ก็ปฏิเสธค่าเหล่านี้เมื่อยังไม่เปิด */}
          <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${features.leaveHalfDay || features.leaveAttachment ? '' : 'hidden'}`}>
            <div className={features.leaveHalfDay ? '' : 'hidden'}>
              {/* §6 ครึ่งวันนับเป็น 0.5 — ถ้านับเป็น 1 ยอดแรงงาน-วันจะเพี้ยน */}
              <label className="mb-1 block text-sm font-medium text-slate-600">{t('ช่วงเวลาที่ลา')}</label>
              <select value={form.dayPart} onChange={(e) => setForm((f) => ({ ...f, dayPart: e.target.value }))} className="field">
                <option value="full">{t('ลาเต็มวัน')}</option>
                <option value="first_half">{t('ลาครึ่งวันเช้า')}</option>
                <option value="second_half">{t('ลาครึ่งวันบ่าย')}</option>
              </select>
              {form.dayPart !== 'full' && (
                <p className="mt-1 text-xs text-slate-400">{t('ลาครึ่งวันเลือกได้เฉพาะวันเดียว นับเป็น 0.5 วัน')}</p>
              )}
            </div>
            <div className={features.leaveAttachment ? '' : 'hidden'}>
              <label className="mb-1 block text-sm font-medium text-slate-600">{t('ไฟล์แนบ เช่น ใบรับรองแพทย์')}</label>
              <input type="file" onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] || null }))}
                className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-200 file:bg-white file:px-3 file:py-1.5 file:text-sm" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('เหตุผล (ถ้ามี)')}</label>
            <input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              maxLength={300} placeholder={t('เช่น ลาป่วย ลากิจ ลาพักผ่อน')} className="field" />
          </div>
          {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy} className="btn-primary">{busy ? t('กำลังส่ง…') : t('ส่งคำขอลา')}</button>
            {days > 0 && <span className="text-sm text-slate-500">{t('รวม')} {days} {t('วัน')}</span>}
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200">
        {TABS.map((it) => (
          <button key={it.key} onClick={() => setTab(it.key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === it.key ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {it.label}
            <span className={`ml-1.5 rounded-full px-1.5 text-xs ${it.hot ? 'bg-amber-400 font-bold text-[#0f172a]' : 'text-slate-400'}`}>{it.n}</span>
          </button>
        ))}
      </div>

      {/* สรุปจำนวนและคำอธิบายขอบเขตของแต่ละแท็บ */}
      {tab === 'mine' && mine.length > 0 && (
        <p className="text-xs text-slate-500">
          {t('รอดำเนินการ')} {n(mine, 'pending')} · {t('อนุมัติแล้ว')} {n(mine, 'approved')} · {t('ไม่อนุมัติ')} {n(mine, 'rejected')}
        </p>
      )}
      {tab === 'pending' && <p className="text-xs text-slate-500">{t('ทุกหน่วยงานในสิทธิ์ของคุณ')}</p>}
      {tab === 'decided' && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            {[['all', 'ทั้งหมด'], ['approved', 'อนุมัติแล้ว'], ['rejected', 'ไม่อนุมัติ']].map(([k, label]) => (
              <button key={k} onClick={() => setHistFilter(k)}
                className={`rounded-md px-3 py-1 text-sm font-medium transition ${histFilter === k ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                {t(label, null, 'status')}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            {t('อนุมัติแล้ว')} {n(decided, 'approved')} · {t('ไม่อนุมัติ')} {n(decided, 'rejected')}
            {/* บอกตรง ๆ เมื่อเซิร์ฟเวอร์ตัดรายการ ไม่ให้ประวัติบางส่วนอ่านเหมือนทั้งหมด */}
            {decidedTotal > decided.length && <b> · {t('แสดง')} {decided.length}/{decidedTotal}</b>}
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {list.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            {tab === 'mine' ? t('ยังไม่มีคำขอลา')
              : tab === 'pending' ? t('ไม่มีคำขอลาที่รอดำเนินการ') : t('ยังไม่มีประวัติการพิจารณา')}
          </p>
        ) : (
          <>
            <HeadRow />
            {list.map((r) => (
              <Row key={r.id} r={r} onOpenFile={openAttachment} onDownloadFile={downloadAttachment}>
                {tab === 'pending' && (
                  <>
                    <button onClick={() => decide(r, true)} disabled={busy}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{t('อนุมัติ')}</button>
                    <button onClick={() => decide(r, false)} disabled={busy}
                      className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50">{t('ไม่อนุมัติ')}</button>
                  </>
                )}
                <button onClick={() => openSlip(r)} title={t('เปิดใบลาเพื่อพิมพ์')}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  <Icon name="file" className="h-4 w-4" /> {t('ใบลา')}
                </button>
                {tab === 'mine' && r.status === 'pending' && (
                  <button onClick={() => cancel(r)} disabled={busy}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">{t('ยกเลิกคำขอ')}</button>
                )}
              </Row>
            ))}
          </>
        )}
      </div>

      {!canDecide && (
        <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <Icon name="clock" className="h-3.5 w-3.5" />
          {t('คำขอของท่านจะถูกส่งไปยังหัวหน้าที่ผู้ดูแลระบบกำหนดไว้')}
          {' '}{t('ชื่อผู้อนุมัติแสดงอยู่ในแต่ละรายการ')}
        </p>
      )}
    </div>
  );
}
