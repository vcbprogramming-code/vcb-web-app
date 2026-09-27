import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sopApi, readDefaultView, writeDefaultView } from '../../lib/sop.js';
import Spinner from '../../components/Spinner.jsx';
import ScenariosView from './ScenariosView.jsx';
import FlowsView from './FlowsView.jsx';
import ReportsView from './ReportsView.jsx';
import VersionsView from './VersionsView.jsx';
import SopHeader from './SopHeader.jsx';
import SopSidebar from './SopSidebar.jsx';
import SopSettings from './SopSettings.jsx';
import MetaModal from './MetaModal.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * Module 5 — ระเบียบปฏิบัติงานมาตรฐาน (SOP)
 *
 * โครงหน้าจอสามคอลัมน์แบบเดียวกับหน้าเว็บที่ลูกค้าใช้อยู่จริง: ซ้ายเป็นเมนูหมวด
 * กลางเป็นรายการ ขวาเป็นรายละเอียด และมีแถบหัวสีน้ำเงินเข้มที่รวมช่องค้นหาไว้
 * ที่เดียวสำหรับทุกมุมมอง คำที่ใช้ก็เป็นคำของเขา — คนของเขาเรียก "กรณีเฉพาะ"
 * ไม่ใช่ "กรณีศึกษา" และเรียกตารางรายงานว่า "วิธีเรียก Report"
 *
 * ประวัติเวอร์ชันและการแก้ไขเนื้อหาในระบบเป็นส่วนที่ระบบเรามีเพิ่ม คงไว้ตามเดิม
 */

/** วิธีใช้สามขั้นบนหน้าแรก — ข้อความชุดเดียวกับที่ระบบจริงขึ้นให้ผู้ใช้ใหม่อ่าน */
const HOW_TO = [
  { n: 1, title: 'เลือกหมวด (ซ้าย)', desc: 'คลิกหมวดในแถบซ้าย เช่น PO, IC, AP หรือ "ทั้งหมด" เพื่อดูรายการกรณีในหมวดนั้น' },
  { n: 2, title: 'เลือกกรณี (กลาง)', desc: 'คลิกการ์ดของกรณีเฉพาะตรงกลาง เพื่อเปิดดูปัญหาและแนวทางปฏิบัติฉบับเต็ม' },
  { n: 3, title: 'อ่านรายละเอียด (ขวา)', desc: 'ปัญหา/สถานการณ์ และขั้นตอนปฏิบัติทั้งหมดจะแสดงในแถบนี้ พร้อมอ้างอิงคู่มือ' },
];

export default function Sop() {
  const t = useT();
  // A link can point straight at one item: ?case=12 or ?flow=AP-3. People quote
  // the manual at each other, and "ดูเคส AP-3" used to mean describing where to
  // click. The parameter also decides which view opens.
  const [sp, setSp] = useSearchParams();
  const sharedCase = sp.get('case');
  const sharedFlow = sp.get('flow');

  const [boot, setBoot] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(sharedFlow ? 'flows' : 'cases');
  // หน้าเริ่มต้นที่ผู้ใช้เลือกไว้ในการตั้งค่า — ลิงก์ตรงมีสิทธิ์เหนือกว่าเสมอ
  const [module, setModule] = useState(() => (sharedCase || sharedFlow ? '' : readDefaultView()));
  const [q, setQ] = useState('');          // ช่องค้นหาเดียว ใช้กับทุกมุมมอง
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);   // หน้าต่าง "แก้ไขหัวเอกสาร" แบบของเขา

  // Switching view by hand drops the deep link — it belongs to the item that was
  // shared, and carrying it into another view would reopen it unasked.
  const pick = (key, mod) => {
    setTab(key);
    if (mod !== undefined) setModule(mod);
    if (sharedCase || sharedFlow) setSp({}, { replace: true });
  };

  const load = () => {
    setError(null);
    return sopApi.bootstrap().then((r) => setBoot(r.data)).catch((e) => setError(e.message));
  };
  useEffect(() => { load(); }, []);

  // หมวดที่บันทึกไว้อาจถูกลบไปแล้ว หรือไม่มีกรณีเหลืออยู่ — อย่าเปิดหน้าว่างใส่หน้า
  const checkedDefault = useRef(false);
  useEffect(() => {
    if (!boot || checkedDefault.current) return;
    checkedDefault.current = true;
    if (module && !boot.counts.scenarios[module]) setModule('');
  }, [boot, module]);

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
        <button onClick={load} className="ml-2 font-semibold underline">{t('ลองใหม่')}</button>
      </div>
    );
  }
  if (!boot) return <div className="flex justify-center py-16"><Spinner label={t('กำลังโหลดคู่มือ…')} /></div>;

  const { modules, meta, counts, canEdit } = boot;

  return (
    <div className="space-y-4">
      <SopHeader q={q} onQ={setQ} onSettings={() => setSettingsOpen(true)}
        searchLabel={tab === 'reports' ? t('ค้นหารายงาน') : t('ค้นหากรณีเฉพาะ')} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,250px)_minmax(0,1fr)]">
        <SopSidebar modules={modules} counts={counts} meta={meta} tab={tab} module={module}
          canEdit={canEdit} onPick={pick} onEditMeta={() => setMetaOpen(true)} />

        <div className="min-w-0 space-y-4">
          {tab === 'cases' && (
            <ScenariosView modules={modules} module={module} q={q} canEdit={canEdit} onChanged={load}
              sharedNo={sharedCase} total={counts.scenarioTotal} onClearModule={() => setModule('')} />
          )}
          {tab === 'flows' && <FlowsView module={module} q={q} sharedId={sharedFlow} total={counts.flowTotal} />}
          {tab === 'reports' && <ReportsView canEdit={canEdit} q={q} onChanged={load} />}
          {tab === 'versions' && <VersionsView canEdit={canEdit} onRestored={load} />}

          {/* วิธีใช้สามขั้น — ขึ้นเฉพาะหน้าแรกของกรณีเฉพาะ (ยังไม่เลือกหมวด ไม่ได้ค้นหา) */}
          {tab === 'cases' && module === '' && !q && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {HOW_TO.map((h) => (
                <div key={h.n} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">{h.n}</span>
                  <div className="mt-2 text-sm font-semibold text-slate-800">{t(h.title)}</div>
                  <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{t(h.desc)}</p>
                </div>
              ))}
            </div>
          )}

          {tab === 'cases' && meta?.purpose && (
            <details className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                {t('วัตถุประสงค์และขอบเขต · Purpose & Scope')}
              </summary>
              <div className="mt-3 space-y-3 text-sm text-slate-600">
                <p className="whitespace-pre-line">{meta.purpose}</p>
                {meta.scope && <p><b>{t('ขอบเขต:')}</b> {meta.scope}</p>}
                {meta.manual && <p><b>{t('อ้างอิง (Reference)')}:</b> {meta.manual}</p>}
                {Array.isArray(meta.notes) && meta.notes.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('หมายเหตุ · Notes')}</p>
                    <ul className="list-disc space-y-1 pl-5">
                      {meta.notes.map((n, i) => <li key={i}>{n}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      </div>

      {metaOpen && <MetaModal meta={meta} onClose={() => setMetaOpen(false)} onSaved={load} />}

      {settingsOpen && (
        <SopSettings modules={modules} counts={counts.scenarios} onClose={() => setSettingsOpen(false)}
          onDefaultView={(code) => { writeDefaultView(code); }} />
      )}
    </div>
  );
}
