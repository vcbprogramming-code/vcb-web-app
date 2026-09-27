import { useEffect, useState, useCallback, useMemo } from 'react';
import { creditApi, formatMoney } from '../../lib/modules.js';
import { formatThaiDate } from '../../lib/ememo.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { Modal } from '../../components/ui/index.js';
import Icon from '../../components/Icon.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import { useT } from '../../lib/i18n.jsx';
import { CostCategoryCombo, projectLabel } from './shared.jsx';

const STATUS_CHIP = {
  'อยู่ระหว่างเสนออนุมัติ': 'bg-amber-50 text-amber-700',
  'อนุมัติ': 'bg-emerald-50 text-emerald-700',
  'ไม่อนุมัติ': 'bg-red-50 text-red-700',
};

/**
 * เหตุผลที่ไม่อนุมัติ — ต้องพิมพ์ได้มากกว่าหนึ่งบรรทัด
 *
 * เดิมใช้ window.prompt ซึ่งเป็นกล่องของเบราว์เซอร์: ไม่มีสไตล์ของระบบ กด Esc
 * แล้วแยกไม่ออกว่ายกเลิกหรือส่งค่าว่าง และบนมือถือบางรุ่นไม่ขึ้นเลย
 */
function RejectModal({ onClose, onSubmit }) {
  const t = useT();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={t('ไม่อนุมัติคำขอ')}
      onClose={onClose}
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn-outline">{t('ยกเลิก')}</button>
          <button
            onClick={async () => { setBusy(true); try { await onSubmit(note.trim() || null); } finally { setBusy(false); } }}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700">
            {busy ? t('กำลังบันทึก…') : t('ไม่อนุมัติ')}
          </button>
        </>
      }
    >
      <label className="mb-1 block text-sm font-medium text-slate-600">
        {t('เหตุผล')} <span className="text-xs font-normal text-slate-400">{t('— ไม่บังคับ')}</span>
      </label>
      <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className="field"
        placeholder={t('รายละเอียดเพิ่มเติม…')} />
    </Modal>
  );
}

export default function RequestsPanel({ projects, onClose, onChanged, openAdd = false }) {
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const { profile } = useAuth();
  const [requests, setRequests] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [error, setError] = useState(null);
  // เปิดมาจากปุ่ม "＋ เพิ่มคำขอสินเชื่อ" บนแถบตัวกรอง → กางฟอร์มให้เลย
  // ไม่ใช่เปิดมาเจอรายการแล้วต้องกดเพิ่มอีกที
  const [adding, setAdding] = useState(openAdd);
  const [rejecting, setRejecting] = useState(null);
  const [form, setForm] = useState({
    facilityId: '', amount: '', startDate: '', termDays: '', dueDate: '', note: '',
    beneficiary: '', costCategory: '', refDocNo: '', refDocFrom: '', refDocTo: '',
    attachSource: '', attachFrom: '', attachTo: '',
  });
  // หมวดค่าใช้จ่ายที่เลือกตรงนี้จะติดไปกับรายการตอนอนุมัติ แล้วไปโผล่ที่หน้าสรุปค่าใช้จ่าย
  const [costCategories, setCostCategories] = useState([]);
  // งบที่ตั้งไว้ + ยอดที่ใช้ไปแล้วรายหมวด — ใช้เตือนตอนกรอก ไม่ต้องไปเปิดอีกแท็บ
  const [caps, setCaps] = useState([]);
  const [spent, setSpent] = useState({});
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const load = useCallback(() => {
    creditApi.requests().then((r) => setRequests(r.data)).catch((e) => setError(e.message));
  }, []);
  const loadRefs = useCallback(() => {
    creditApi.facilities({}).then((r) => setFacilities(r.data || [])).catch(() => {});
    creditApi.categoryCaps().then((r) => setCaps(r.data || [])).catch(() => setCaps([]));
    creditApi.costSummary({}).then((r) => {
      const m = {};
      for (const g of r.data?.projects || []) for (const l of g.lines || []) m[`${g.project_id}|${l.cost_category}`] = l.spent;
      setSpent(m);
    }).catch(() => setSpent({}));
  }, []);
  useEffect(() => {
    load();
    loadRefs();
    creditApi.costCategories().then((r) => setCostCategories(r.data || [])).catch(() => setCostCategories([]));
  }, [load, loadRefs]);

  const projById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);
  const projName = (id) => (projById[id] ? (projById[id].name || projById[id].code) : '');
  const facById = useMemo(() => Object.fromEntries(facilities.map((f) => [f.id, f])), [facilities]);
  const facLabel = (id) => {
    const f = facById[id];
    return f ? `${projName(f.project_id)} · ${f.type}` : '—';
  };

  /**
   * บรรทัดเตือนใต้ช่องจำนวนเงิน — เตือน ไม่ห้าม
   *
   * คำขอที่เกินวงเงินคงเหลือยังยื่นได้จริง (ธนาคารขยายวงเงินให้ได้) การบล็อกจึง
   * ผิดกว่าการเตือน แต่คนกรอกต้องเห็นตัวเลขตรงนั้นเลย ไม่ใช่รู้ตอนถูกปฏิเสธ
   * — สองบรรทัด: วงเงินของวงเงินก้อนนั้น และงบของหมวดค่าใช้จ่าย
   */
  const hints = useMemo(() => {
    const out = [];
    const f = facById[form.facilityId];
    const amt = Number(String(form.amount).replace(/,/g, '')) || 0;
    if (form.facilityId) {
      if (!f || f.available == null) {
        out.push({ tone: 'plain', text: t('ไม่มีข้อมูลวงเงินคงเหลือสำหรับโครงการ/ประเภทนี้') });
      } else if (amt > Number(f.available)) {
        out.push({ tone: 'over',
          text: `${t('เกินวงเงินคงเหลือ')} ${formatMoney(amt - Number(f.available))} (${t('คงเหลือ')} ${formatMoney(f.available)}) — ${t('ยังยื่นคำขอได้')}` });
      } else {
        out.push({ tone: 'ok',
          text: `${t('คงเหลือใช้ได้')} ${formatMoney(f.available)}${amt > 0 ? ` · ${t('หลังคำขอนี้เหลือ')} ${formatMoney(Number(f.available) - amt)}` : ''}` });
      }
    }
    const cat = String(form.costCategory || '').trim();
    if (f && cat) {
      const cap = Number((caps.find((c) => c.project_id === f.project_id && c.cost_category === cat) || {}).cap || 0);
      if (cap > 0) {
        const used = Number(spent[`${f.project_id}|${cat}`] || 0);
        const after = used + amt;
        let text = `${t('หมวด')} "${cat}" — ${t('งบ')} ${formatMoney(cap)} · ${t('ใช้ไป')} ${formatMoney(used)}`;
        if (amt > 0) text += ` · ${t('หลังคำขอนี้')} ${formatMoney(after)} (${Math.round((after / cap) * 100)}%)`;
        if (after > cap) out.push({ tone: 'over', text: `${text} — ${t('เกินงบ')} ${formatMoney(after - cap)}` });
        else if (after >= cap * 0.8) out.push({ tone: 'over', text: `${text} — ${t('ใกล้เต็มงบ')}` });
        else out.push({ tone: 'ok', text });
      }
    }
    return out;
  }, [form.facilityId, form.amount, form.costCategory, facById, caps, spent, t]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await creditApi.addRequest({
        facilityId: form.facilityId,
        amount: Number(form.amount),
        startDate: form.startDate || null,
        termDays: form.termDays === '' ? null : Number(form.termDays),
        dueDate: form.dueDate || null,
        note: form.note || null,
        beneficiary: form.beneficiary || null,
        costCategory: form.costCategory || null,
        refDocNo: form.refDocNo || null,
        refDocFrom: form.refDocFrom || null,
        refDocTo: form.refDocTo || null,
        attachSource: form.attachSource || null,
        attachFrom: form.attachFrom || null,
        attachTo: form.attachTo || null,
      });
      setForm({ facilityId: '', amount: '', startDate: '', termDays: '', dueDate: '', note: '',
        beneficiary: '', costCategory: '', refDocNo: '', refDocFrom: '', refDocTo: '',
        attachSource: '', attachFrom: '', attachTo: '' });
      setAdding(false);
      toast.success(t('บันทึกคำขอแล้ว'));
      load();
      loadRefs();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    }
  };

  const send = async (id, decision, note) => {
    try {
      await creditApi.decideRequest(id, decision, note || undefined);
      toast.success(decision === 'อนุมัติ' ? t('อนุมัติแล้ว') : t('ไม่อนุมัติแล้ว'));
      setRejecting(null);
      load();
      loadRefs();
      onChanged?.();
    } catch (err) { toast.error(err.message); }
  };
  const approve = async (id) => {
    const ok = await confirm({
      title: t('อนุมัติคำขอ'),
      message: `${t('ยืนยัน')} "${t('อนุมัติ')}" ${t('คำขอนี้?')}`,
      confirmLabel: t('อนุมัติ'), danger: false,
    });
    if (ok) await send(id, 'อนุมัติ', null);
  };

  const canDecide = profile?.role === 'admin' || profile?.role === 'executive';

  return (
    <Modal
      title={t('คำขอใช้วงเงิน')}
      onClose={onClose}
      size="2xl"
      footer={<button onClick={onClose} className="btn-outline">{t('ปิด')}</button>}
    >
      {error && <div className="mb-3 bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      {!adding ? (
        <button onClick={() => setAdding(true)} className="btn-primary mb-3"><Icon name="plus" className="h-4 w-4" /> {t('ยื่นคำขอใหม่')}</button>
      ) : (
        <form onSubmit={submit} className="mb-4 space-y-3 rounded-xl border border-slate-200 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('วงเงิน')} <span className="text-red-500">*</span></label>
              <select value={form.facilityId} onChange={(e) => set('facilityId', e.target.value)} className="field" required title={t('ประเภทวงเงิน')}>
                <option value="">{t('เลือกวงเงิน')}</option>
                {facilities.map((f) => <option key={f.id} value={f.id}>{facLabel(f.id)} {t('(เหลือ')} {formatMoney(f.available)})</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('จำนวนเงิน')} <span className="text-red-500">*</span></label>
              <input type="number" value={form.amount} onChange={(e) => set('amount', e.target.value)} className="field" required />
            </div>
            {/* บรรทัดเตือนกินสองคอลัมน์ — ตัวเลขที่ต้องอ่านคู่กับช่องจำนวนเงิน */}
            {hints.length > 0 && (
              <div className="col-span-2 space-y-0.5 text-xs">
                {hints.map((h) => (
                  <div key={h.text} className={h.tone === 'over' ? 'font-medium text-red-600'
                    : h.tone === 'ok' ? 'text-emerald-600' : 'text-slate-500'}>
                    {h.tone === 'over' && <Icon name="warning" className="mr-1 inline h-3.5 w-3.5" />}
                    {h.text}
                  </div>
                ))}
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('วันที่เริ่ม')}</label>
              <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} className="field" />
            </div>
            <div>
              {/* ใส่จำนวนวันแล้วเว้นวันครบกำหนดไว้ ระบบคำนวณให้เอง */}
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('จำนวนวัน')}</label>
              <input type="number" value={form.termDays} onChange={(e) => set('termDays', e.target.value)} className="field" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('ครบกำหนด')}</label>
              <input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} className="field" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('ผู้รับผลประโยชน์')}</label>
              <input value={form.beneficiary} onChange={(e) => set('beneficiary', e.target.value)} className="field"
                placeholder={t('เช่น บริษัท สิริวัฒน์ ค้าเหล็ก จำกัด')} />
            </div>
            <div>
              {/* ทะเบียนหมวดยาวขึ้นทุกเดือน — เลือกได้ พิมพ์เองก็ได้ */}
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('หมวดค่าใช้จ่าย')}</label>
              <CostCategoryCombo value={form.costCategory} onChange={(v) => set('costCategory', v)} options={costCategories} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('เลขที่เอกสารอ้างอิง')}</label>
              <input value={form.refDocNo} onChange={(e) => set('refDocNo', e.target.value)} className="field"
                placeholder={t('เช่น PO:20260000170 / BT-001/69')} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('วันที่เอกสารอ้างอิง (ช่วง)')}</label>
              <div className="flex gap-2">
                <input type="date" value={form.refDocFrom} onChange={(e) => set('refDocFrom', e.target.value)} className="field" />
                <input type="date" value={form.refDocTo} onChange={(e) => set('refDocTo', e.target.value)} className="field" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('เอกสารแนบ (อีเมล / แหล่งที่มา)')}</label>
              <input value={form.attachSource} onChange={(e) => set('attachSource', e.target.value)} className="field"
                placeholder={t('เช่น อีเมล จาก คุณ… / แหล่งที่มา')} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('วันที่เอกสารแนบ (ช่วง)')}</label>
              <div className="flex gap-2">
                <input type="date" value={form.attachFrom} onChange={(e) => set('attachFrom', e.target.value)} className="field" />
                <input type="date" value={form.attachTo} onChange={(e) => set('attachTo', e.target.value)} className="field" />
              </div>
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('หมายเหตุ')}</label>
              <textarea rows={2} value={form.note} onChange={(e) => set('note', e.target.value)} className="field"
                placeholder={t('รายละเอียดเพิ่มเติม…')} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)} className="btn-outline">{t('ยกเลิก')}</button>
            <button type="submit" className="btn-primary">{t('ยื่นคำขอ')}</button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {requests.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">{t('ยังไม่มีคำขอสินเชื่อ')}</p>
        ) : requests.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">{formatMoney(r.amount)}</span>
                <span className={`chip ${STATUS_CHIP[r.status]}`}>{r.status}</span>
              </div>
              <div className="text-xs text-slate-400">
                {facLabel(r.facility_id)}{r.due_date ? ` · ${t('ครบกำหนด')} ${formatThaiDate(r.due_date)}` : ''}{r.note ? ` · ${r.note}` : ''}
              </div>
            </div>
            {r.status === 'อยู่ระหว่างเสนออนุมัติ' && canDecide && (
              <div className="flex shrink-0 gap-2">
                <button onClick={() => approve(r.id)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">{t('อนุมัติ')}</button>
                <button onClick={() => setRejecting(r.id)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">{t('ไม่อนุมัติ')}</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {rejecting && (
        <RejectModal onClose={() => setRejecting(null)} onSubmit={(note) => send(rejecting, 'ไม่อนุมัติ', note)} />
      )}
    </Modal>
  );
}
