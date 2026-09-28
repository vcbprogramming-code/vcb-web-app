import LeaveApprovers from './LeaveApprovers.jsx';
import { useState } from 'react';
import { perfApi, perfPrefs } from '../../lib/performance.js';
import { useToast } from '../../components/Toast.jsx';
import { BusyLabel } from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';
import ImportEmployees from './ImportEmployees.jsx';
import OrgRegistry from './OrgRegistry.jsx';
import ProjectsAdmin from './ProjectsAdmin.jsx';
import EditHistory from './EditHistory.jsx';
import HowTo from './HowTo.jsx';

/**
 * Module settings. Server-side: per-site back-date lock window (lock-days).
 * Client-side (localStorage): grid cell display, year format, the dashboard's
 * default view, and which sites are hidden on the dashboard.
 *
 * หัวข้อและคำอธิบายใช้คำเดียวกับหน้า ตั้งค่า ของระบบที่ลูกค้าใช้อยู่ และย้าย
 * ทางเข้า "ประวัติการแก้ไข" มาไว้ที่นี่ด้วย — เดิมตารางนั้นอยู่ในแท็บรายงานที่ปิด
 * ด้วยธงฟีเจอร์ตลอด จึงไม่มีใครเปิดดูได้เลย
 */

/** ปุ่มตัวเลือกแบบเม็ดยา (opt-pill ของเขา) */
function Pills({ value, options, onChange }) {
  const t = useT();
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-slate-200 p-0.5">
      {options.map(([k, label]) => (
        <button key={k} type="button" onClick={() => onChange(k)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            value === k ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
          {t(label)}
        </button>
      ))}
    </div>
  );
}

function Section({ title, desc, children }) {
  return (
    <section className="card space-y-3">
      <div>
        <h3 className="font-bold text-slate-800">{title}</h3>
        {desc && <p className="text-xs text-slate-400">{desc}</p>}
      </div>
      {children}
    </section>
  );
}

export default function SettingsView({ sites, onSitesChange, onSiteAdded, onOpenSite, onPrefsChanged, features = {}, boot = {} }) {
  const t = useT();
  const toast = useToast();
  const [prefs, setPrefs] = useState(perfPrefs.get());
  const [lockDraft, setLockDraft] = useState(() => Object.fromEntries(sites.map((s) => [s.key, s.lockDays ?? 3])));
  const [savingLock, setSavingLock] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);

  // แจ้งหน้าแม่ด้วย — ป้ายเดือนบนหัวหน้าอยู่นอกคอมโพเนนต์นี้ ถ้าไม่บอกให้วาดใหม่
  // คนที่สลับ พ.ศ./ค.ศ. จะเห็นป้ายเดิมค้างอยู่ แล้วคิดว่าตัวเลือกไม่ทำงาน
  const savePref = (patch) => { const next = perfPrefs.set(patch); setPrefs(next); onPrefsChanged?.(); };
  const toggleHidden = (key) => {
    const hidden = new Set(prefs.hiddenSites);
    hidden.has(key) ? hidden.delete(key) : hidden.add(key);
    savePref({ hiddenSites: [...hidden] });
  };
  const saveLock = async (key) => {
    const v = Number(lockDraft[key]);
    if (!Number.isInteger(v) || v < 0 || v > 60) { toast.error(t('จำนวนวันต้องอยู่ระหว่าง 0–60')); return; }
    setSavingLock(key);
    try { await perfApi.updateSite(key, { lockDays: v }); onSitesChange?.(key, { lockDays: v }); toast.success(t('บันทึกจำนวนวันล็อกแล้ว')); }
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
      {/**
       * สองคอลัมน์บนจอกว้าง — เดิมเป็นคอลัมน์เดียวกว้าง 672px วางชิดซ้ายบนจอ 1440
       * เหลือพื้นที่ว่างทางขวา 704px และหน้ายาว 3,821px ต้องเลื่อนสี่จอกว่าจะครบ
       *
       * ซ้ายคือค่าที่เก็บในเครื่องของแต่ละคน (สั้น ๆ ทั้งนั้น) ขวาคือทะเบียนที่ใช้
       * ร่วมกันทั้งบริษัทซึ่งเป็นรายการยาว — แยกตามความหมาย ไม่ได้แบ่งครึ่งตามจำนวน
       * และ items-start กันไม่ให้การ์ดฝั่งสั้นถูกยืดตามฝั่งยาว
       */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
      <div className="space-y-5">

      {/* หัวเรื่องของหน้า — สองภาษาเหมือนหัวป็อปอัปตั้งค่าของเขา */}
      <div className="card">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
          <Icon name="settings" className="h-5 w-5 text-slate-400" /> {t('การตั้งค่า')} · Settings
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">{t('การตั้งค่าจะถูกเก็บไว้ในเครื่อง (แต่ละเครื่องอาจไม่เหมือนกัน)')}</p>
        {/* คู่มือสั้น ๆ ของหน้าบันทึกงาน — อ่านก่อนเริ่มลงข้อมูลครั้งแรก */}
        <button onClick={() => setShowHowTo(true)} className="btn-outline mt-3 !py-1.5 !text-sm">
          <Icon name="book" className="h-4 w-4" /> {t('วิธีใช้งานหน้านี้ (อ่านก่อนเริ่ม)')}
        </button>
      </div>

      {/* การแสดงในตารางสัปดาห์ */}
      <Section title={t('การแสดงในตารางสัปดาห์')}
        desc={t('แสดงกิจกรรมเป็นรหัส (A-1) หรือชื่อเต็ม — หมวดงานยังคงเป็นตัวเลขเสมอ')}>
        <Pills value={prefs.cellNames} onChange={(v) => savePref({ cellNames: v })}
          options={[['code', 'รหัส (A-1 / 5)'], ['name', 'ชื่อกิจกรรม (เต็ม) / 5']]} />
      </Section>

      {/* รูปแบบปี — เปลี่ยนเฉพาะการแสดงผลในตัวเลือกเดือน ค่าที่ส่งไปเซิร์ฟเวอร์ยังเป็น ค.ศ. */}
      <Section title={t('รูปแบบปี')} desc={t('แสดงปีในเครื่องมือเลือกเดือนเป็น พ.ศ. หรือ ค.ศ.')}>
        <Pills value={prefs.yearFmt} onChange={(v) => savePref({ yearFmt: v })}
          options={[['be', 'พุทธศักราช (2569)'], ['ce', 'คริสต์ศักราช (2026)']]} />
      </Section>

      <Section title={t('มุมมองเริ่มต้นของแดชบอร์ด')} desc={t('เลือกว่าจะเปิดแดชบอร์ดด้วยมุมมองไหนเป็นค่าเริ่มต้น')}>
        <Pills value={prefs.dashView} onChange={(v) => savePref({ dashView: v })}
          options={[['progress', 'ความคืบหน้า'], ['topact', 'กิจกรรมหลัก'], ['topcost', 'หมวดงานหลัก']]} />
      </Section>

      {/* หน่วยงานที่แสดง (เฉพาะเครื่องนี้) */}
      <Section title={t('หน่วยงานที่แสดง')}
        desc={t('ปิดหน่วยงานที่จบแล้วเพื่อซ่อนจากแดชบอร์ดและรายการเลือก (เฉพาะเครื่องนี้)')}>
        {sites.length === 0 ? <p className="text-sm text-slate-400">{t('ไม่มีหน่วยงาน')}</p> : (
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
        )}
      </Section>

      {/* ประวัติการแก้ไข — ทางเข้าเดียวที่ไม่ผูกกับธงฟีเจอร์ใด ๆ */}
      <Section title={t('ประวัติการแก้ไข')} desc={t('ดูบันทึกว่าใครแก้ไขอะไร เมื่อไร พร้อมค้นหาและกรอง')}>
        <button onClick={() => setShowHistory(true)} className="btn-outline !py-1.5 !text-sm">
          {t('เปิดประวัติการแก้ไข')} →
        </button>
      </Section>

      <Section title={t('เกี่ยวกับระบบ')}>
        <dl className="divide-y divide-slate-100 text-sm">
          {[
            [t('เวอร์ชัน'), <code key="v" className="text-xs">2.0</code>],
            [t('อีเมล'), boot.email || '—'],
            [t('บทบาท'), <span key="r" className="chip bg-slate-100 text-slate-600">{boot.role || '—'}</span>],
            [t('หน่วยงานที่ดูแล'), boot.isAdmin ? t('(ทุกหน่วยงาน — admin)') : (sites.map((s) => s.name).join(', ') || '—')],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <dt className="font-medium text-slate-600">{k}</dt>
              <dd className="min-w-0 truncate text-slate-800">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <div className="mt-6 border-t border-slate-200 pt-6">
        <LeaveApprovers />
      </div>
      </div>

      {/* คอลัมน์ขวา — ทะเบียนที่ทุกคนในบริษัทใช้ร่วมกัน ไม่ใช่ค่าเฉพาะเครื่องนี้
          สองใบนี้เป็นรายการยาว (รวมกันเกือบ 2,000px) จึงกินคอลัมน์ของตัวเอง */}
      <div className="space-y-5">
      {/* เพิ่ม/เปิด/ปิดโครงการ — เหมือน "โครงการ / หน่วยงาน" ในหน้าตั้งค่าของระบบจริง */}
      <ProjectsAdmin onChanged={onSitesChange} onAdded={onSiteAdded} />

      {/* per-site lock window — ของเขาเป็นค่าเดียวทั้งระบบ ของเราละเอียดกว่าจึงคงไว้ */}
      <Section title={t('ล็อกการแก้ไขย้อนหลัง (ต่อไซต์)')}
        desc={t('จำนวนวันที่ยังแก้ไขข้อมูลย้อนหลังได้ · เกินกว่านี้จะล็อกอัตโนมัติ (ผู้ดูแลระบบปลดล็อกได้)')}>
        <div className="divide-y divide-slate-100">
          {sites.map((s) => (
            <div key={s.key} className="flex flex-wrap items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-700">{s.name}</div>
                {s.company && <div className="truncate text-[11px] text-slate-400">{s.company}</div>}
              </div>
              <div className="flex items-center gap-1.5">
                <input type="number" min={0} max={60} value={lockDraft[s.key]}
                  aria-label={`${t('ระยะเวลาแก้ย้อนหลัง')} ${s.name}`}
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
      </Section>
      </div>
      </div>

      {showHistory && <EditHistory sites={sites} onClose={() => setShowHistory(false)} />}
      {showHowTo && <HowTo onClose={() => setShowHowTo(false)} />}
    </div>
  );
}
