import { useCallback, useEffect, useState } from 'react';
import { programApi } from '../../lib/onboardingProgram.js';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import Spinner from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * แก้เช็กลิสต์ (เฉพาะผู้ดูแลระบบ)
 *
 * API แก้ข้อรายการมีอยู่แล้วตั้งแต่รอบสร้างโมดูล แต่ไม่มีหน้าจอ — ผู้ดูแลจึงแก้
 * ข้อความเช็กลิสต์ไม่ได้เลยนอกจากยิง API เอง หน้านี้คือส่วนที่ขาดไป เลือกแผนก →
 * เฟส → บล็อก แบบเดียวกับ admin.html ของเขา
 *
 * ต่างจากของเขาหนึ่งข้อ: ของเขากั้นด้วยรหัสผ่านร่วมที่พิมพ์ในหน้าเว็บ ของเราใช้
 * สิทธิ์ admin ของระบบเดียวกับที่เหลือทั้งระบบ ไม่มีรหัสผ่านที่สองให้ลืมหรือหลุด
 *
 * "ปิดใช้งาน" ไม่ใช่ "ลบ" — id ของข้อคือสิ่งที่เครื่องหมายถูกของพนักงานผูกอยู่
 * ลบทิ้งแล้วความคืบหน้าของคนที่ติ๊กไว้จะหายไปด้วย ข้อที่ปิดยังแสดงในหน้านี้
 * (สีจาง) และเปิดกลับได้
 */
export default function ChecklistAdmin({ departments, onChanged }) {
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const [deptSlug, setDeptSlug] = useState(departments[0]?.slug || '');
  const dept = departments.find((d) => d.slug === deptSlug) || departments[0] || null;
  const [phaseId, setPhaseId] = useState(dept?.phases?.[0]?.id || '');
  const phase = dept?.phases?.find((p) => p.id === phaseId) || dept?.phases?.[0] || null;
  const [blockId, setBlockId] = useState(phase?.blocks?.[0]?.id ?? null);
  const block = phase?.blocks?.find((b) => b.id === blockId) || phase?.blocks?.[0] || null;

  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ text: '', textTh: '', level: 'junior' });

  const reload = useCallback(() => {
    if (!block) { setRows([]); return Promise.resolve(); }
    setRows(null);
    return programApi.blockItems(block.id)
      .then((r) => setRows(r.data || []))
      .catch((e) => { toast.error(e.message); setRows([]); });
  }, [block, toast]);
  useEffect(() => { reload(); }, [reload]);

  // เปลี่ยนแผนก/เฟสแล้วตัวเลือกชั้นล่างต้องตามไปด้วย ไม่ใช่ค้างอยู่ที่ id เดิม
  // ของโครงสร้างเดิมซึ่งไม่มีอยู่ในแผนกใหม่
  const switchDept = (slug) => {
    const d = departments.find((x) => x.slug === slug);
    setDeptSlug(slug);
    setPhaseId(d?.phases?.[0]?.id || '');
    setBlockId(d?.phases?.[0]?.blocks?.[0]?.id ?? null);
  };
  const switchPhase = (id) => {
    const p = dept?.phases?.find((x) => x.id === id);
    setPhaseId(id);
    setBlockId(p?.blocks?.[0]?.id ?? null);
  };

  const run = async (fn) => {
    setBusy(true);
    try { await fn(); await reload(); await onChanged?.(); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const save = (row, fields) => run(async () => {
    await programApi.updateItem(row.id, fields);
    toast.success(t('บันทึกแล้ว'));
  });

  const add = () => {
    if (!draft.text.trim() || !block) return;
    return run(async () => {
      await programApi.addItem({
        blockId: block.id, text: draft.text.trim(),
        textTh: draft.textTh.trim() || null, level: draft.level,
      });
      setDraft({ text: '', textTh: '', level: 'junior' });
      toast.success(t('เพิ่มข้อใหม่แล้ว'));
    });
  };

  if (!dept || !phase || !block) {
    return <div className="card py-12 text-center text-sm text-slate-500">{t('ยังไม่มีเนื้อหาให้แก้')}</div>;
  }

  const Tabs = ({ items, value, onPick }) => (
    <div className="flex flex-wrap gap-1.5">
      {items.map((x) => (
        <button key={x.key} onClick={() => onPick(x.key)}
          className={`chip ${value === x.key ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          {x.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="card-sm space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('แผนก')}</div>
        <Tabs value={dept.slug} onPick={switchDept}
          items={departments.map((d) => ({ key: d.slug, label: d.name_th || d.name }))} />
        <div className="pt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{t('ระยะ')}</div>
        <Tabs value={phase.id} onPick={switchPhase}
          items={dept.phases.map((p) => ({ key: p.id, label: `${t('วันที่')} ${p.day_range.replace('-', '–')}` }))} />
        <div className="pt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{t('บล็อก')}</div>
        <Tabs value={block.id} onPick={setBlockId}
          items={phase.blocks.map((b) => ({ key: b.id, label: b.heading_th || b.heading }))} />
      </div>

      {!rows ? (
        <div className="flex justify-center py-12"><Spinner label={t('กำลังโหลด…')} /></div>
      ) : (
        <div className="card space-y-2 !p-0">
          {rows.map((row, i) => (
            <ItemRow key={row.id} row={row} first={i === 0} last={i === rows.length - 1}
              busy={busy}
              onSave={(fields) => save(row, fields)}
              onMove={(dir) => run(() => programApi.moveItem(row.id, dir))}
              onToggleActive={async () => {
                if (row.is_active && !(await confirm({
                  title: t('ปิดใช้งานข้อนี้'),
                  message: t('ข้อนี้จะหายไปจากเช็กลิสต์ของพนักงาน แต่เครื่องหมายถูกที่มีคนติ๊กไว้แล้วยังอยู่ — เปิดกลับได้ตลอด'),
                  confirmLabel: t('ปิดใช้งาน', null, 'onboarding-item'), danger: false,
                }))) return;
                await save(row, { isActive: !row.is_active });
              }} />
          ))}
          {!rows.length && <div className="px-4 py-8 text-center text-sm text-slate-500">{t('บล็อกนี้ยังไม่มีข้อ')}</div>}
        </div>
      )}

      <div className="card space-y-2">
        <h3 className="font-bold text-slate-800">{t('เพิ่มข้อใหม่')}</h3>
        <input value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })}
          placeholder={t('ข้อความ (อังกฤษ)')} className="input" />
        <input value={draft.textTh} onChange={(e) => setDraft({ ...draft, textTh: e.target.value })}
          placeholder={t('ข้อความ (ไทย)')} className="input" />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={draft.level === 'senior'}
              onChange={(e) => setDraft({ ...draft, level: e.target.checked ? 'senior' : 'junior' })}
              className="h-4 w-4 accent-amber-600" />
            {t('เฉพาะซีเนียร์')}
          </label>
          <button onClick={add} disabled={busy || !draft.text.trim()} className="btn-primary ml-auto disabled:opacity-50">
            <Icon name="plus" className="h-4 w-4" /> {t('เพิ่มข้อใหม่')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ItemRow({ row, first, last, busy, onSave, onMove, onToggleActive }) {
  const t = useT();
  const [text, setText] = useState(row.text || '');
  const [textTh, setTextTh] = useState(row.text_th || '');
  const [senior, setSenior] = useState(row.level === 'senior');
  useEffect(() => { setText(row.text || ''); setTextTh(row.text_th || ''); setSenior(row.level === 'senior'); },
    [row.id, row.text, row.text_th, row.level]);

  const dirty = text !== (row.text || '') || textTh !== (row.text_th || '') || senior !== (row.level === 'senior');

  return (
    <div className={`space-y-2 border-b border-slate-100 px-4 py-3 last:border-0 ${row.is_active ? '' : 'bg-slate-50 opacity-60'}`}>
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{row.id}</code>
        {!row.is_active && <span className="chip bg-slate-200 text-slate-600">{t('ปิดใช้งาน', null, 'onboarding-item')}</span>}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => onMove('up')} disabled={busy || first} aria-label={t('เลื่อนขึ้น')}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30">
            <Icon name="chevronDown" className="h-4 w-4 rotate-180" />
          </button>
          <button onClick={() => onMove('down')} disabled={busy || last} aria-label={t('เลื่อนลง')}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30">
            <Icon name="chevronDown" className="h-4 w-4" />
          </button>
          <button onClick={onToggleActive} disabled={busy}
            className="rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40">
            {row.is_active
              ? t('ปิดใช้งาน', null, 'onboarding-item')
              : t('เปิดใช้งาน', null, 'onboarding-item')}
          </button>
        </div>
      </div>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('ข้อความ (อังกฤษ)')} className="input" />
      <input value={textTh} onChange={(e) => setTextTh(e.target.value)} placeholder={t('ข้อความ (ไทย)')} className="input" />
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={senior} onChange={(e) => setSenior(e.target.checked)}
            className="h-4 w-4 accent-amber-600" />
          {t('เฉพาะซีเนียร์')}
        </label>
        <button onClick={() => onSave({ text, textTh: textTh || null, level: senior ? 'senior' : 'junior' })}
          disabled={busy || !dirty || !text.trim()} className="btn-primary ml-auto disabled:opacity-40">
          {t('บันทึก')}
        </button>
      </div>
    </div>
  );
}
