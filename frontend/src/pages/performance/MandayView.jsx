import { useCallback, useEffect, useMemo, useState } from 'react';
import { perfApi } from '../../lib/performance.js';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import Spinner from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';
import { enqueue, flush, onReconnect, pendingCount } from '../../lib/offlineQueue.js';

/**
 * แรงงาน-วัน — the measure the acceptance criteria are written in.
 *
 * The diary grid answers "what did this person do"; this screen answers "how
 * much labour did this project spend, on what". They sit side by side on
 * purpose: the diary is what the site already fills in every day, and forcing
 * man-days into the same cell would have made both harder to key.
 */
const STATUSES = ['ปกติ', 'ล่วงเวลา', 'Standby', 'ลา', 'ขาดงาน'];
const STATE_CHIP = {
  editable: 'bg-emerald-50 text-emerald-700',
  'due-soon': 'bg-amber-50 text-amber-700',
  locked: 'bg-slate-100 text-slate-500',
  closed: 'bg-rose-50 text-rose-700',
};
const STATE_TH = { editable: 'แก้ไขได้', 'due-soon': 'ใกล้ครบกำหนด', locked: 'ล็อกแล้ว', closed: 'ปิดงวดแล้ว' };

/**
 * The file column. A count with nothing behind it told a user a file existed and
 * then gave them no way to look at it — the number opens the list, and each row
 * in it opens or removes the file it names.
 */
function FileCell({ files, canEdit, open, onToggle, onAttach, onOpen, onDownload, onRemove, tall }) {
  const t = useT();
  return (
    <div className="relative">
      <div className={`flex items-center gap-1 ${tall ? 'h-11' : ''}`}>
        {files.length > 0 && (
          <button type="button" onClick={onToggle}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-sm text-brand hover:bg-slate-50">
            <Icon name="paperclip" className="h-4 w-4" /> {files.length}
          </button>
        )}
        {canEdit && (
          <label className="cursor-pointer rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-500 hover:bg-slate-50"
            title={t('แนบไฟล์เพิ่ม')}>
            <input type="file" className="hidden" onChange={(ev) => onAttach(ev.target.files?.[0])} />
            {files.length ? '+' : t('แนบ')}
          </label>
        )}
        {!files.length && !canEdit && <span className="text-sm text-slate-300">—</span>}
      </div>
      {open && files.length > 0 && (
        <div className="absolute right-0 z-20 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
              <button type="button" onClick={() => onOpen(f)}
                className="min-w-0 flex-1 truncate text-left text-sm text-brand hover:underline" title={f.file_name}>
                {f.file_name}
              </button>
              <button type="button" onClick={() => onDownload(f)} title={t('ดาวน์โหลด')}
                className="shrink-0 text-slate-400 hover:text-brand">
                <Icon name="download" className="h-4 w-4" />
              </button>
              {canEdit && (
                <button type="button" onClick={() => onRemove(f)} className="text-sm text-red-500 hover:underline">
                  {t('ลบ')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MandayView({ site, month, canEdit, isAdmin }) {
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState('');
  const [closes, setCloses] = useState([]);
  const [picked, setPicked] = useState(() => new Set());
  const [bulkMd, setBulkMd] = useState('1');
  const [bulkStatus, setBulkStatus] = useState('ปกติ');
  const [queued, setQueued] = useState(() => pendingCount());
  const [online, setOnline] = useState(() => navigator.onLine);
  const [files, setFiles] = useState([]);
  const [fileFor, setFileFor] = useState(null); // แถวที่กำลังเปิดรายการไฟล์อยู่

  const load = useCallback(() => {
    if (!site) return;
    const [Y, M] = month.split('-').map(Number);
    perfApi.siteMonth(site, Y, M).then(setData).catch((e) => toast.error(e.message));
    perfApi.periodCloses(site).then((r) => setCloses(r.data || [])).catch(() => setCloses([]));
  }, [site, month, toast]);
  useEffect(load, [load]);

  // §11 evidence for the day in view
  const loadFiles = useCallback(() => {
    if (!site) { setFiles([]); return; }
    perfApi.attachments({ site, date }).then((r) => setFiles(r.data || [])).catch(() => setFiles([]));
  }, [site, date]);
  useEffect(loadFiles, [loadFiles]);

  // §3 whatever was keyed while the signal was gone goes up when it returns
  const drain = useCallback(async () => {
    if (!pendingCount()) return;
    const r = await flush((item) => perfApi.saveDay(item.body));
    setQueued(pendingCount());
    if (r.sent) { toast.success(t('ส่งข้อมูลที่ค้างไว้แล้ว {n} รายการ', { n: r.sent })); load(); }
    if (r.dropped) toast.error(t('มี {n} รายการที่ส่งไม่ได้เพราะวันนั้นถูกล็อกหรือยืนยันแล้ว', { n: r.dropped }));
  }, [toast, t, load]);
  useEffect(() => {
    const on = () => { setOnline(true); drain(); };
    const off = () => setOnline(false);
    window.addEventListener('offline', off);
    const stop = onReconnect(on);
    if (navigator.onLine) drain();
    return () => { window.removeEventListener('offline', off); stop(); };
  }, [drain]);

  const dayState = useMemo(() => {
    const d = (data?.days || []).find((x) => x.date === date);
    return d?.state || 'editable';
  }, [data, date]);
  const locked = dayState === 'locked' || dayState === 'closed';
  const rows = data?.employees || [];
  // site-month returns rows shaped {eid, name, emp_id} — not the employees
  // table's own column names — so read them as they arrive
  const entriesFor = (eid) => data?.entries?.[eid]?.[date] || {};
  const idOf = (e) => e.eid || e.id;

  const save = async (eid, patch) => {
    const cur = entriesFor(eid);
    const body = { site, eid, date, manDay: patch.manDay ?? cur.manDay ?? null, workStatus: patch.workStatus ?? cur.workStatus ?? null };
    if (locked) {
      const reason = window.prompt(t('วันนี้ล็อกแล้ว — ระบุเหตุผลในการแก้ไขย้อนหลัง'));
      if (!reason) return;
      body.adminUnlock = true; body.reason = reason;
    }
    setBusy(eid);
    try { await perfApi.saveDay(body); toast.success(t('บันทึกแล้ว')); load(); }
    catch (e) {
      // §3 a network failure must not lose what was typed
      if (e?.network || e?.timeout || !navigator.onLine) {
        setQueued(enqueue({ key: `day:${eid}:${date}`, body }));
        toast.info(t('ออฟไลน์อยู่ — เก็บไว้ส่งเมื่อกลับมาออนไลน์'));
      } else toast.error(e.message);
    }
    finally { setBusy(''); }
  };

  // §3 the whole team in one press
  const saveBulk = async () => {
    if (!picked.size) return;
    const body = {
      site, date, employeeIds: [...picked],
      manDay: bulkMd === '' ? null : Number(bulkMd),
      workStatus: bulkStatus || null,
      batchId: `${date}-${Date.now()}`,
    };
    if (locked) {
      const reason = window.prompt(t('วันนี้ล็อกแล้ว — ระบุเหตุผลในการแก้ไขย้อนหลัง'));
      if (!reason) return;
      body.adminUnlock = true; body.reason = reason;
    }
    setBusy('bulk');
    try {
      const r = await perfApi.bulkSave(body);
      toast.success(t('บันทึกทั้งทีมแล้ว {n} คน', { n: r.data?.saved ?? 0 }));
      const skipped = r.data?.skipped || [];
      if (skipped.length) toast.info(t('ข้าม {n} คน ({why})', { n: skipped.length, why: skipped[0].reason }));
      setPicked(new Set());
      load();
    } catch (e) {
      if (e?.network || e?.timeout || !navigator.onLine) {
        setQueued(enqueue({ key: `bulk:${date}:${[...picked].join(',')}`, body }));
        toast.info(t('ออฟไลน์อยู่ — เก็บไว้ส่งเมื่อกลับมาออนไลน์'));
      } else toast.error(e.message);
    } finally { setBusy(''); }
  };

  const openFile = async (f) => {
    try {
      const url = await perfApi.attachmentUrl(f.id);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { toast.error(e.message); }
  };
  const downloadFile = async (f) => {
    try {
      const url = await perfApi.attachmentUrl(f.id);
      const a = document.createElement('a');
      a.href = url; a.download = f.file_name || 'attachment';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { toast.error(e.message); }
  };
  const removeFile = async (f) => {
    const ok = await confirm({ title: t('ลบไฟล์แนบ'), message: f.file_name, confirmLabel: t('ลบ'), danger: true });
    if (!ok) return;
    try { await perfApi.deleteAttachment(f.id); toast.success(t('ลบไฟล์แล้ว')); loadFiles(); }
    catch (e) { toast.error(e.message); }
  };

  const attach = async (eid, file) => {
    if (!file) return;
    setBusy(eid);
    try { await perfApi.uploadAttachment(site, eid, date, file); toast.success(t('แนบไฟล์แล้ว')); loadFiles(); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(''); }
  };

  const verify = async (undo) => {
    try {
      const r = await perfApi.verify(site, date, date, undo);
      const n = r.data?.verified ?? 0;
      const own = r.data?.skippedOwn ?? 0;
      toast.success(undo ? t('ยกเลิกการยืนยันแล้ว') : t('ยืนยันข้อมูลแล้ว {n} รายการ', { n }));
      if (own) toast.info(t('ข้าม {n} รายการที่ท่านเป็นผู้บันทึกเอง — ผู้บันทึกยืนยันงานตัวเองไม่ได้', { n: own }));
      load();
    } catch (e) { toast.error(e.message); }
  };

  const closePeriod = async () => {
    const ym = date.slice(0, 7);
    const ok = await confirm({
      title: t('ปิดงวด {ym}', { ym }),
      message: t('เมื่อปิดงวดแล้ว ข้อมูลของเดือนนี้จะแก้ไขไม่ได้อีก'),
      // Closing a period is not destructive — an admin can reopen it with a
      // reason — so this one gets the green "go ahead", not the red one the
      // provider hands out by default.
      confirmLabel: t('ปิดงวด'), danger: false,
    });
    if (!ok) return;
    try { await perfApi.closePeriod(site, ym); toast.success(t('ปิดงวดแล้ว')); load(); }
    catch (e) { toast.error(e.message); }
  };
  const openPeriod = async (ym) => {
    const reason = window.prompt(t('การเปิดงวดที่ปิดแล้วต้องระบุเหตุผล'));
    if (!reason) return;
    try { await perfApi.openPeriod(site, ym, reason); toast.success(t('เปิดงวดแล้ว')); load(); }
    catch (e) { toast.error(e.message); }
  };

  if (!site) return <div className="card py-10 text-center text-sm text-slate-500">{t('เลือกไซต์งานด้านบนก่อน')}</div>;
  if (!data) return <div className="flex justify-center py-16"><Spinner label={t('กำลังโหลด…')} /></div>;

  const closedThis = closes.find((c) => c.ym === date.slice(0, 7));
  const total = rows.reduce((a, e) => a + Number(entriesFor(idOf(e)).manDay || 0), 0);

  return (
    <div className="space-y-4">
      <div className="card-sm flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-600">{t('วันที่ปฏิบัติงาน')}</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field !w-auto" />
        <span className={`chip ${STATE_CHIP[dayState]}`}>{t(STATE_TH[dayState] || dayState)}</span>
        <span className="text-sm text-slate-500">{t('รวมวันนี้')} <b className="tabular-nums text-slate-800">{total.toFixed(2)}</b> {t('แรงงาน-วัน')}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button onClick={() => verify(false)} className="btn-outline">
            <Icon name="check" className="h-4 w-4" /> {t('ยืนยันข้อมูลของวันนี้')}
          </button>
          <button onClick={() => verify(true)} className="btn-outline">{t('ยกเลิกการยืนยัน')}</button>
          {isAdmin && (closedThis
            ? <button onClick={() => openPeriod(closedThis.ym)} className="btn-outline">{t('เปิดงวด')} {closedThis.ym}</button>
            : <button onClick={closePeriod} className="btn-outline">{t('ปิดงวด')} {date.slice(0, 7)}</button>)}
        </div>
      </div>

      {(queued > 0 || !online) && (
        <div className="card-sm flex items-center gap-2 border-l-4 border-amber-400 text-sm text-slate-700">
          <Icon name="clock" className="h-4 w-4 text-amber-500" />
          {!online && <span>{t('ขณะนี้ออฟไลน์ — ข้อมูลที่บันทึกจะถูกเก็บไว้และส่งให้อัตโนมัติเมื่อกลับมาออนไลน์')}</span>}
          {queued > 0 && <span>{t('มี {n} รายการรอส่ง', { n: queued })}</span>}
        </div>
      )}

      {locked && (
        <div className="card-sm border-l-4 border-rose-400 text-sm text-slate-700">
          {dayState === 'closed'
            ? t('เดือนนี้ปิดงวดแล้ว — แก้ไขข้อมูลไม่ได้ ต้องเปิดงวดคืนก่อน')
            : t('วันที่นี้เลยกำหนดแก้ไขแล้ว — ผู้ดูแลระบบปลดล็อกได้โดยระบุเหตุผล')}
        </div>
      )}

      {canEdit && (
        <div className="card-sm flex flex-wrap items-end gap-3">
          <div className="text-sm font-medium text-slate-600">
            {t('บันทึกทั้งทีม')} <span className="text-slate-400">({t('เลือกแล้ว {n} คน', { n: picked.size })})</span>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">{t('แรงงาน-วัน')}</label>
            <input type="number" step="0.25" min="0" max="1" value={bulkMd}
              onChange={(e) => setBulkMd(e.target.value)} className="field !w-24 tabular-nums" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">{t('สถานะการทำงาน')}</label>
            <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="field !w-40">
              {STATUSES.map((s2) => <option key={s2} value={s2}>{t(s2)}</option>)}
            </select>
          </div>
          <button onClick={saveBulk} disabled={!picked.size || locked || busy === 'bulk'} className="btn-primary disabled:opacity-40">
            <Icon name="check" className="h-4 w-4" /> {t('บันทึกให้ทุกคนที่เลือก')}
          </button>
          <button onClick={() => setPicked(new Set(rows.map(idOf)))} className="btn-outline">{t('เลือกทั้งหมด')}</button>
          <button onClick={() => setPicked(new Set())} className="btn-outline">{t('ล้างที่เลือก')}</button>
        </div>
      )}

      {/* §13 the recorder keys this standing on a site, on a phone. A table 490px
          wider than the screen put the man-day box out of reach entirely, so the
          small screen gets a card per person and the table starts at sm. */}
      <div className="space-y-2 sm:hidden">
        {rows.length === 0 && (
          <div className="card py-10 text-center text-sm text-slate-400">{t('ยังไม่มีพนักงานในไซต์นี้')}</div>
        )}
        {rows.map((e) => {
          const eid = idOf(e);
          const cur = entriesFor(eid);
          return (
            <div key={eid} className="card-sm space-y-3">
              <div className="flex items-start gap-1">
                {/* the tick itself is 24px, but the tappable area around it is
                    44 — a fingertip on a site does not aim well */}
                <label className="-m-1 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
                  <input type="checkbox" aria-label={e.name || e.full_name} checked={picked.has(eid)}
                    className="h-6 w-6"
                    onChange={(ev) => setPicked((prev) => {
                      const n = new Set(prev);
                      if (ev.target.checked) n.add(eid); else n.delete(eid);
                      return n;
                    })} />
                </label>
                <div className="min-w-0 flex-1 pt-2">
                  <div className="font-medium text-slate-800">{e.name || e.full_name}</div>
                  <div className="text-xs text-slate-400">{e.emp_id || e.employee_code || '—'}</div>
                </div>
                {cur.verifiedAt
                  ? <span className="chip bg-emerald-50 text-emerald-700">{t('ยืนยันแล้ว')}</span>
                  : <span className="chip bg-slate-100 text-slate-500">{t('บันทึกแล้ว')}</span>}
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">{t('แรงงาน-วัน')}</label>
                  <input type="number" step="0.25" min="0" max="1" inputMode="decimal"
                    key={`${eid}-${date}-${cur.manDay ?? ''}`}
                    defaultValue={cur.manDay ?? ''} disabled={!canEdit || locked || busy === eid}
                    onBlur={(ev) => {
                      const v = ev.target.value === '' ? null : Number(ev.target.value);
                      if (v !== (cur.manDay ?? null)) save(eid, { manDay: v });
                    }}
                    className="field !h-11 !w-24 tabular-nums" />
                </div>
                <div className="min-w-0 flex-1">
                  <label className="mb-1 block text-xs text-slate-500">{t('สถานะการทำงาน')}</label>
                  <select value={cur.workStatus || ''} disabled={!canEdit || locked || busy === eid}
                    onChange={(ev) => save(eid, { workStatus: ev.target.value || null })}
                    className="field !h-11 w-full disabled:bg-slate-50">
                    <option value="">{t('— ไม่ระบุ —')}</option>
                    {STATUSES.map((st) => <option key={st} value={st}>{t(st)}</option>)}
                  </select>
                </div>
                <FileCell eid={eid} files={files.filter((f) => f.employee_id === eid)}
                  canEdit={canEdit && !locked} open={fileFor === eid} onToggle={() => setFileFor(fileFor === eid ? null : eid)}
                  onAttach={(file) => attach(eid, file)} onOpen={openFile} onDownload={downloadFile} onRemove={removeFile} tall />
              </div>
              {cur.entryAt && (
                <p className="text-[11px] text-slate-400">
                  {t('บันทึกเมื่อ')} {new Date(cur.entryAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="card hidden overflow-x-auto !p-0 sm:block">
        <table className="tbl">
          <thead>
            <tr>
              <th className="tbl-th w-10">
                <input type="checkbox" aria-label={t('เลือกทั้งหมด')}
                  checked={rows.length > 0 && picked.size === rows.length}
                  onChange={(e) => setPicked(e.target.checked ? new Set(rows.map(idOf)) : new Set())} />
              </th>
              <th className="tbl-th">{t('รหัสพนักงาน')}</th>
              <th className="tbl-th">{t('ชื่อ-สกุล')}</th>
              <th className="tbl-th w-40">{t('แรงงาน-วัน')}</th>
              <th className="tbl-th w-48">{t('สถานะการทำงาน')}</th>
              <th className="tbl-th">{t('บันทึกเมื่อ')}</th>
              <th className="tbl-th">{t('การยืนยัน')}</th>
              <th className="tbl-th">{t('ไฟล์ประกอบ')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-400">{t('ยังไม่มีพนักงานในไซต์นี้')}</td></tr>
            )}
            {rows.map((e) => {
              const eid = idOf(e);
              const cur = entriesFor(eid);
              return (
                <tr key={eid} className="tbl-row">
                  <td className="tbl-td">
                    <input type="checkbox" aria-label={e.name || e.full_name} checked={picked.has(eid)}
                      onChange={(ev) => setPicked((prev) => {
                        const n = new Set(prev);
                        if (ev.target.checked) n.add(eid); else n.delete(eid);
                        return n;
                      })} />
                  </td>
                  <td className="tbl-td text-slate-500">{e.emp_id || e.employee_code || '—'}</td>
                  <td className="tbl-td font-medium text-slate-800">{e.name || e.full_name}</td>
                  <td className="tbl-td">
                    <input
                      type="number" step="0.25" min="0" max="1"
                      key={`${eid}-${date}-${cur.manDay ?? ''}`}
                      defaultValue={cur.manDay ?? ''}
                      disabled={!canEdit || locked || busy === eid}
                      onBlur={(ev) => {
                        const v = ev.target.value === '' ? null : Number(ev.target.value);
                        if (v !== (cur.manDay ?? null)) save(eid, { manDay: v });
                      }}
                      className="field !w-28 tabular-nums" />
                  </td>
                  <td className="tbl-td">
                    <select value={cur.workStatus || ''} disabled={!canEdit || locked || busy === eid}
                      onChange={(ev) => save(eid, { workStatus: ev.target.value || null })} className="field !w-40 disabled:bg-slate-50">
                      <option value="">{t('— ไม่ระบุ —')}</option>
                      {STATUSES.map((s) => <option key={s} value={s}>{t(s)}</option>)}
                    </select>
                  </td>
                  <td className="tbl-td text-xs text-slate-400">
                    {cur.entryAt ? new Date(cur.entryAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : '—'}
                  </td>
                  <td className="tbl-td">
                    {cur.verifiedAt
                      ? <span className="chip bg-emerald-50 text-emerald-700">{t('ยืนยันแล้ว')}</span>
                      : <span className="chip bg-slate-100 text-slate-500">{t('บันทึกแล้ว')}</span>}
                  </td>
                  <td className="tbl-td">
                    <FileCell eid={eid} files={files.filter((f) => f.employee_id === eid)}
                      canEdit={canEdit && !locked} open={fileFor === eid} onToggle={() => setFileFor(fileFor === eid ? null : eid)}
                      onAttach={(file) => attach(eid, file)} onOpen={openFile} onDownload={downloadFile} onRemove={removeFile} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">
        {t('แรงงาน-วันต่อคนต่อวันสูงสุด 1 · ระบบคำนวณชั่วโมงให้จากแรงงาน-วัน (8 ชั่วโมง = 1) · ผู้บันทึกยืนยันงานของตนเองไม่ได้')}
      </p>
    </div>
  );
}
