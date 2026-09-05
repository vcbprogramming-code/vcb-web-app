import LeaveApprovers from './LeaveApprovers.jsx';
import { useState } from 'react';
import { perfApi, perfPrefs } from '../../lib/performance.js';
import { useToast } from '../../components/Toast.jsx';
import { BusyLabel } from '../../components/Spinner.jsx';
import { useT } from '../../lib/i18n.jsx';
import ImportEmployees from './ImportEmployees.jsx';
import OrgRegistry from './OrgRegistry.jsx';

/**
 * Module settings. Server-side: per-site back-date lock window (lock-days).
 * Client-side (localStorage): grid cell display (code vs name) + which sites are
 * hidden on the dashboard.
 */
export default function SettingsView({ sites, onSitesChange, onOpenSite, features = {} }) {
  const t = useT();
  const toast = useToast();
  const [prefs, setPrefs] = useState(perfPrefs.get());
  const [lockDraft, setLockDraft] = useState(() => Object.fromEntries(sites.map((s) => [s.key, s.lockDays ?? 3])));
  const [savingLock, setSavingLock] = useState(null);

  const savePref = (patch) => { const next = perfPrefs.set(patch); setPrefs(next); };
  const toggleHidden = (key) => {
    const hidden = new Set(prefs.hiddenSites);
    hidden.has(key) ? hidden.delete(key) : hidden.add(key);
    savePref({ hiddenSites: [...hidden] });
  };
  const saveLock = async (key) => {
    const v = Number(lockDraft[key]);
    if (!Number.isInteger(v) || v < 0 || v > 60) { toast.error(t('จำนวนวันต้องอยู่ระหว่าง 0–60')); return; }
    setSavingLock(key);
    try { await perfApi.updateSite(key, { lockDays: v }); onSitesChange?.(key, v); toast.success(t('บันทึกจำนวนวันล็อกแล้ว')); }
    catch (e) { toast.error(e.message); }
    finally { setSavingLock(null); }
  };

  return (
    <div className="space-y-5">
      {/* the two registries need room for two columns; the settings below stay
          narrow because they are single fields */}
      {/* ทะเบียนแผนก/ตำแหน่ง และการนำเข้าจาก Excel ไม่มีในระบบที่ลูกค้าใช้จริง
          — ระบบเดิมแก้รายชื่อในชีตโดยตรง และเอกสารของเขาระบุว่าไม่ทำตัวนำเข้า */}
      {features.orgRegistry && <OrgRegistry sites={sites} />}
      {features.employeeImport && <ImportEmployees onOpenSite={onOpenSite} />}
      <div className="max-w-2xl space-y-5">

      {/* display */}
      <section className="card space-y-3">
        <h3 className="font-bold text-slate-800">{t('การแสดงผล')}</h3>
        <div>
          <div className="mb-1.5 text-sm font-medium text-slate-600">{t('แสดงในตารางสัปดาห์เป็น')}</div>
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
            {[['code', 'รหัสงาน (A-1 / 5)'], ['name', 'ชื่อกิจกรรม']].map(([k, label]) => (
              <button key={k} onClick={() => savePref({ cellNames: k })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${prefs.cellNames === k ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{label}</button>
            ))}
          </div>
        </div>
      </section>

      {/* per-site lock window */}
      <section className="card space-y-3">
        <div>
          <h3 className="font-bold text-slate-800">{t('ล็อกการแก้ไขย้อนหลัง (ต่อไซต์)')}</h3>
          <p className="text-xs text-slate-400">{t('จำนวนวันที่ยังแก้ไขข้อมูลย้อนหลังได้ · เกินกว่านี้จะล็อกอัตโนมัติ (ผู้ดูแลระบบปลดล็อกได้)')}</p>
        </div>
        <div className="divide-y divide-slate-100">
          {sites.map((s) => (
            <div key={s.key} className="flex flex-wrap items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-700">{s.name}</div>
                {s.company && <div className="truncate text-[11px] text-slate-400">{s.company}</div>}
              </div>
              <div className="flex items-center gap-1.5">
                <input type="number" min={0} max={60} value={lockDraft[s.key]}
                  onChange={(e) => setLockDraft((p) => ({ ...p, [s.key]: e.target.value }))}
                  className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
                <span className="text-xs text-slate-400">{t('วัน')}</span>
                <button onClick={() => saveLock(s.key)} disabled={savingLock === s.key} className="btn-outline !py-1.5 !text-sm disabled:opacity-50">
                  <BusyLabel busy={savingLock === s.key} busyText="กำลังบันทึก…">{t('บันทึก')}</BusyLabel>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* hidden sites on dashboard */}
      <section className="card space-y-3">
        <div>
          <h3 className="font-bold text-slate-800">{t('ซ่อนไซต์บนแดชบอร์ด')}</h3>
          <p className="text-xs text-slate-400">{t('ติ๊กเพื่อซ่อนการ์ดไซต์นั้นในหน้าภาพรวม (เฉพาะเครื่องนี้)')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {sites.map((s) => {
            const hidden = prefs.hiddenSites.includes(s.key);
            return (
              <button key={s.key} onClick={() => toggleHidden(s.key)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${hidden ? 'border-slate-200 bg-slate-50 text-slate-400 line-through' : 'border-brand bg-brand text-white'}`}>
                {s.name}
              </button>
            );
          })}
        </div>
      </section>
      <div className="mt-6 border-t border-slate-200 pt-6">
        <LeaveApprovers />
      </div>
      </div>
    </div>
  );
}
