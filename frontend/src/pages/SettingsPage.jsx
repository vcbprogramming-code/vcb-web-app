import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { PageHeader } from '../components/ui/index.js';
import Icon from '../components/Icon.jsx';

import UsersTab from './admin/UsersTab.jsx';
import AnnouncementsTab from './admin/AnnouncementsTab.jsx';
import ProjectsTab from './admin/ProjectsTab.jsx';
import CompaniesTab from './admin/CompaniesTab.jsx';
import DocTypesTab from './admin/DocTypesTab.jsx';
import DocCodeApproversTab from './admin/DocCodeApproversTab.jsx';
import MySignatureTab from './settings/MySignatureTab.jsx';

/**
 * One settings page.
 *
 * Configuration used to be split across two screens — "ผู้ใช้และสิทธิ์" and
 * "ตั้งค่า E-Memo" — plus a third for your own signature, and each one carried a
 * signpost telling you the thing you wanted was somewhere else. The client asked
 * for one place.
 *
 * The split that remains is by SCOPE, not by page: settings that belong to the
 * whole system sit above settings that belong to E-Memo. That matters because
 * the next modules (วงเงินสินเชื่อ, รายงานการประชุม) will add their own groups
 * here, and a flat list would have to be reorganised again when they do.
 */
const GROUPS = [
  {
    key: 'me',
    label: 'ของฉัน',
    items: [
      { key: 'signature', label: 'โปรไฟล์และลายเซ็น', icon: 'signature', Comp: MySignatureTab, everyone: true },
    ],
  },
  {
    key: 'system',
    label: 'ระบบ',
    items: [
      { key: 'users', label: 'ผู้ใช้และสังกัดโครงการ', icon: 'people', Comp: UsersTab },
      { key: 'announcements', label: 'ประกาศ', icon: 'bell', Comp: AnnouncementsTab },
    ],
  },
  {
    key: 'ememo',
    label: 'E-Memo',
    items: [
      { key: 'projects', label: 'โครงการ / หัวจดหมาย', icon: 'building', Comp: ProjectsTab },
      { key: 'companies', label: 'บริษัท / ตรา', icon: 'layers', Comp: CompaniesTab },
      { key: 'doctypes', label: 'ประเภทเอกสาร', icon: 'document', Comp: DocTypesTab },
      { key: 'approvers', label: 'ผู้อนุมัติตามรหัสเอกสาร', icon: 'signature', Comp: DocCodeApproversTab },
    ],
  },
];

export default function SettingsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [sp, setSp] = useSearchParams();

  // everything except "ของฉัน" is admin-only, so a non-admin lands on their own
  // signature and never sees a menu of things they can't open
  const groups = useMemo(
    () => GROUPS
      .map((g) => ({ ...g, items: g.items.filter((i) => i.everyone || isAdmin) }))
      .filter((g) => g.items.length),
    [isAdmin]
  );
  const all = groups.flatMap((g) => g.items);
  // สิทธิ์การใช้งาน is no longer a menu of its own — it is a tab inside each user,
  // so an old ?s=permissions link belongs on the user list.
  const ALIASES = { permissions: 'users' };
  const wanted = ALIASES[sp.get('s')] || sp.get('s');
  const [fallback, setFallback] = useState(null);
  const activeKey = all.some((i) => i.key === wanted) ? wanted : (fallback || all[0]?.key);
  const active = all.find((i) => i.key === activeKey) || all[0];
  const Active = active?.Comp;

  const pick = (key) => { setFallback(key); setSp({ s: key }, { replace: true }); };

  return (
    <div className="space-y-5">
      <PageHeader
        title="ตั้งค่า"
        subtitle={isAdmin
          ? 'ตั้งค่าทั้งหมดของระบบและโมดูล E-Memo รวมอยู่ที่นี่ที่เดียว'
          : 'ตั้งค่าโปรไฟล์และลายเซ็นที่จะแสดงในเอกสารของท่าน'}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[240px_1fr] lg:items-start">
        {/* left menu — grouped by scope */}
        <nav className="card-sm !p-2 lg:sticky lg:top-20">
          {groups.map((g) => (
            <div key={g.key} className="mb-1 last:mb-0">
              <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {g.label}
              </div>
              {g.items.map((i) => (
                <button
                  key={i.key}
                  onClick={() => pick(i.key)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${
                    activeKey === i.key
                      ? 'bg-brand/10 font-semibold text-brand'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon name={i.icon} className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 truncate">{i.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="min-w-0">{Active ? <Active /> : null}</div>
      </div>
    </div>
  );
}
