import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { perfApi, downloadAs, siteWorkLogName } from '../../lib/performance.js';
import { useToast } from '../../components/Toast.jsx';
import { PageHeader } from '../../components/ui/index.js';
import Spinner, { BusyLabel } from '../../components/Spinner.jsx';
import MandayView from './MandayView.jsx';
import ReportsView from './ReportsView.jsx';
import Icon from '../../components/Icon.jsx';
import EntryView from './EntryView.jsx';
import Dashboard from './Dashboard.jsx';
import WorkIndex from './WorkIndex.jsx';
import SettingsView from './SettingsView.jsx';
import LeaveView from './LeaveView.jsx';
import LeaveApprovers from './LeaveApprovers.jsx';
import MonthPicker from './MonthPicker.jsx';
import { useT } from '../../lib/i18n.jsx';

/** A dead end with no way out reads as a broken page; say who can open it. */
function NoSites() {
  const t = useT();
  return (
    <div className="card flex flex-col items-center gap-2 py-10 text-center">
      <h3 className="font-bold text-slate-700">{t('ยังไม่มีไซต์งานในขอบเขตของคุณ')}</h3>
      <p className="max-w-md text-sm text-slate-500">
        {t('โมดูลนี้แสดงข้อมูลตามไซต์งานที่ท่านดูแล — ขอให้ผู้ดูแลระบบผูกไซต์งานให้ท่านที่ ตั้งค่า → ผู้ใช้และสังกัดโครงการ แล้วกลับมาที่หน้านี้อีกครั้ง')}
      </p>
    </div>
  );
}

export default function Performance() {
  const t = useT();
  const now = new Date();
  const toast = useToast();
  const [boot, setBoot] = useState(null);
  const [error, setError] = useState(null);
  // The tab lives in the URL so a link can point at one — "ดูหน้าการลา" was
  // impossible to send to anyone, unlike the deep links SOP already supports.
  const [sp, setSp] = useSearchParams();
  const rawView = sp.get('tab') || 'entry'; // entry | dashboard | leave | index | settings
  const setView = (v) => setSp((prev) => { const n = new URLSearchParams(prev); n.set('tab', v); return n; }, { replace: true });
  const [cur, setCur] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const [siteKey, setSiteKey] = useState('');
  // นับการเปลี่ยนค่าที่เก็บในเครื่อง (รูปแบบปี ฯลฯ) เพื่อให้หัวหน้าวาดใหม่ทันที
  const [prefsKey, setPrefsKey] = useState(0);
  const [roster, setRoster] = useState([]);
  const [rosterKey, setRosterKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  // จำนวนคำขอลาที่รออนุมัติ — ขึ้นเป็นตัวเลขบนแท็บ "การลา" เหมือนระบบจริง
  // ไม่งั้นคำขอค้างได้หลายวันโดยไม่มีใครรู้ว่ามีคนรออยู่
  const [pendingLeave, setPendingLeave] = useState(0);

  const downloadExcel = async () => {
    if (!siteKey) return;
    setExporting(true);
    try {
      const name = (boot?.sites || []).find((x) => x.key === siteKey)?.name || siteKey;
      await downloadAs(perfApi.exportUrl(siteKey, cur.y, cur.m), siteWorkLogName(name, cur.y, cur.m));
    } catch (e) { toast.error(e.message || 'ส่งออกไม่สำเร็จ'); }
    finally { setExporting(false); }
  };

  useEffect(() => {
    perfApi.pendingLeave()
      // เส้นทางนี้ตอบเป็น { ok, rows } ไม่ใช่ { data } — อ่านผิดคีย์แล้วป้ายจะเป็น 0 เสมอ
      .then((r) => setPendingLeave((r.rows || r.data || []).length))
      .catch(() => setPendingLeave(0));
  }, [rosterKey, rawView]);

  // The leave form picks a person, so it needs the roster of the site in view.
  useEffect(() => {
    if (!siteKey) { setRoster([]); return; }
    perfApi.employees(siteKey).then((r) => setRoster(r.data || [])).catch(() => setRoster([]));
  }, [siteKey, rosterKey]);

  useEffect(() => {
    perfApi.bootstrap()
      .then((r) => {
        setBoot(r);
        // ไม่เลือกหน่วยงานให้อัตโนมัติ — ตามระบบจริง ("do NOT auto-pick a site")
        // การเดาหน่วยงานให้เสียการโหลดหนึ่งรอบกับหน่วยงานที่เขาไม่ได้อยากดู และ
        // แย่กว่านั้นคือทำให้คนเผลอลงข้อมูลผิดหน่วยงานเพราะไม่ได้สังเกตว่าเลือกอะไรไว้
        if (!r.canEntry && !sp.get('tab')) setView('dashboard');
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  if (!boot) return <div className="flex justify-center py-16"><Spinner label={t('กำลังโหลด…')} /></div>;

  // ลิงก์เก่าที่ชี้ไปแท็บที่ปิดแล้วต้องไม่พาไปหน้าว่าง
  const hiddenView = (rawView === 'manday' && !boot.features?.mandayEntry)
    || (rawView === 'reports' && !boot.features?.reportsTab);
  const view = hiddenView ? 'dashboard' : rawView;

  // หน้าจอชุดเดียวกับระบบที่ลูกค้าใช้จริง — แดชบอร์ด · บันทึกงาน · ดัชนีงาน
  // · การลา · ตั้งค่า ส่วนหน้าแรงงาน-วัน (กรอกตัวเลข) เป็นส่วนเสริมที่มาจาก
  // เอกสารตรวจรับ ไม่ใช่ระบบเดิม จึงขึ้นกับสวิตช์ features.mandayEntry
  const f = boot.features || {};
  // ชื่อแท็บใช้คำเดียวกับหน้าจอที่ลูกค้าใช้อยู่ทุกวัน (แดชบอร์ด · บันทึกงาน · ดัชนีงาน · คำขอ)
  // คนที่ย้ายมาจากระบบเดิมจะได้ไม่ต้องเรียนรู้ชื่อใหม่ คีย์ของแท็บใน URL ยังเหมือนเดิม
  const tabs = [
    { key: 'dashboard', label: t('แดชบอร์ด'), show: true },
    { key: 'entry', label: t('บันทึกงาน'), show: boot.canEntry },
    { key: 'manday', label: t('แรงงาน-วัน'), show: Boolean(f.mandayEntry) },
    { key: 'reports', label: t('รายงาน'), show: Boolean(f.reportsTab) },
    { key: 'leave', label: t('คำขอ'), show: true, badge: pendingLeave },
    { key: 'index', label: t('ดัชนีงาน'), show: boot.isAdmin },
    { key: 'settings', label: t('ตั้งค่า'), show: boot.isAdmin },
  ].filter((x) => x.show);

  return (
    <div className="space-y-4">
      {/* The subtitle records what each person WORKED ON each day. This module is
          not a clock-in system and carries no OT — the old wording ("การลงเวลา …
          ตารางเวลาทำงาน") promised both. */}
      <PageHeader
        title={t('บันทึกงานฝ่ายบุคคล')}
        subtitle={t('บันทึกงานที่พนักงานแต่ละคนทำในแต่ละวัน แยกตามไซต์งาน')}
        right={
          // ตัวเลือกเดือนแบบระบบจริง: ลูกศรเดินทีละเดือน + ปุ่มกลางเปิดปฏิทินเลือกปี/เดือน
          <div>
            <div className="mb-0.5 text-[11px] font-medium text-slate-400">{t('เดือน')}</div>
            <MonthPicker key={prefsKey} cur={cur} onChange={setCur} />
          </div>
        }
      />

      {/* view tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setView(tab.key)}
            className={`relative rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${view === tab.key ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {tab.label}
            {tab.badge > 0 && (
              <span title={`${tab.badge} ${t('คำขอรออนุมัติ')}`}
                className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
          </button>
        ))}
        {/* Which site you are looking at matters to both views: the grid shows its
            month, and a leave request is filed for one of its people. Only the
            grid has anything to export. */}
        {(view === 'entry' || view === 'leave' || view === 'manday' || view === 'reports') && boot.sites.length > 0 && (
          <div className="ml-auto flex items-end gap-2">
            {/* ปุ่มส่งออกมีปุ่มเดียว — เดิมหน้าบันทึกงานมีสองปุ่มที่ทำงานคนละเส้นทาง
                (แถบนี้กับในตัวหน้า) คนกดสลับกันแล้วได้ไฟล์หน้าตาไม่เหมือนกัน
                ปุ่มที่เหลือคือตัวที่คงรูปแบบไฟล์เดิมของระบบจริงไว้ */}
            {view === 'entry' && (
              <button onClick={downloadExcel} disabled={exporting || !siteKey} className="btn-outline !py-1.5 !text-sm disabled:opacity-50"
                title={t('ส่งออกบันทึกทั้งหมดของหน่วยงานนี้เป็นไฟล์ Excel (.xlsx) โดยคงรูปแบบเดิมไว้')}>
                <BusyLabel busy={exporting} busyText="กำลังส่งออก…"><Icon name="download" className="h-4 w-4" /> {t('ส่งออก Excel')}</BusyLabel>
              </button>
            )}
            <div>
              <div className="mb-0.5 text-[11px] font-medium text-slate-400">{t('หน่วยงาน')}</div>
              {/* bg-white/text-slate-800 so the dark-mode remap can recolour BOTH —
                  with no bg class the control kept the browser's white default while
                  its text was lifted to near-white (unreadable). */}
              <select aria-label={t('เลือกไซต์งาน')} value={siteKey} onChange={(e) => setSiteKey(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20">
                {/* ไม่มีตัวไหนถูกเลือกไว้ล่วงหน้า — ต้องเลือกเองเสมอ */}
                <option value="">{t('— เลือกหน่วยงาน —')}</option>
                {/* โครงการที่ปิดแล้วไม่อยู่ในรายการ ยกเว้นตัวที่กำลังเปิดดูจากหน้าภาพรวม */}
                {boot.sites.filter((s) => s.active !== false || s.key === siteKey).map((s) => (
                  <option key={s.key} value={s.key}>{s.name}{s.active === false ? ` (${t('ปิดแล้ว')})` : ''}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {view === 'dashboard' && (
        <Dashboard cur={cur} canEntry={boot.canEntry} onOpenSite={(key) => { setSiteKey(key); setView('entry'); }} />
      )}

      {view === 'entry' && (
        boot.sites.length === 0
          ? <NoSites />
          : <EntryView siteKey={siteKey} siteName={boot.sites.find((s) => s.key === siteKey)?.name}
              siteColor={boot.sites.find((s) => s.key === siteKey)?.color} cur={cur}
              sites={boot.sites.filter((s) => s.active !== false)} onPickSite={setSiteKey}
              canEdit={boot.canEntry && boot.sites.find((s) => s.key === siteKey)?.active !== false} isAdmin={boot.isAdmin} />
      )}

      {view === 'manday' && f.mandayEntry && (
        boot.sites.length === 0
          ? <NoSites />
          : <MandayView site={siteKey} month={`${cur.y}-${String(cur.m).padStart(2, '0')}`} canEdit={boot.canEntry} isAdmin={boot.isAdmin} />
      )}

      {view === 'reports' && <ReportsView site={siteKey} features={f} />}

      {view === 'leave' && (
        <LeaveView employees={roster} canEntry={boot.canEntry} features={f} onChanged={() => setRosterKey((k) => k + 1)} />
      )}

      {view === 'index' && <WorkIndex />}

      {view === 'settings' && (
        <SettingsView
          features={f}
          boot={boot}
          onPrefsChanged={() => setPrefsKey((k) => k + 1)}
          sites={boot.sites}
          onOpenSite={(key) => { setSiteKey(key); setRosterKey((k) => k + 1); setView('entry'); }}
          onSitesChange={(key, patch) => setBoot((b) => ({ ...b, sites: b.sites.map((s) => (s.key === key ? { ...s, ...(typeof patch === 'object' ? patch : { lockDays: patch }) } : s)) }))}
          onSiteAdded={(site) => setBoot((b) => ({ ...b, sites: [...b.sites, site].sort((x, y) => x.name.localeCompare(y.name, 'th')) }))}
        />
      )}
    </div>
  );
}
