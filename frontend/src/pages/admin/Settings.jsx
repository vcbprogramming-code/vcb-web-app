import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UsersTab from './UsersTab.jsx';
import PermissionsTab from './PermissionsTab.jsx';
import { PageHeader } from '../../components/ui/index.js';
import Icon from '../../components/Icon.jsx';

// Central admin settings — only the cross-cutting concerns live here now:
// user accounts + action-level permissions. Module-specific config (E-Memo's
// projects / doc types / approvers) moved into each module's own settings page
// (backlog round 2 #3).
const TABS = [
  { key: 'users', label: 'จัดการผู้ใช้', Comp: UsersTab },
  { key: 'permissions', label: 'สิทธิ์การใช้งาน', Comp: PermissionsTab },
];

export default function Settings() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('users');
  const Active = TABS.find((t) => t.key === tab).Comp;

  return (
    <div className="space-y-5">
      <PageHeader title="ผู้ใช้และสิทธิ์" subtitle="จัดการบัญชีผู้ใช้และสิทธิ์การใช้งานแต่ละโมดูล" />

      {/* signpost — project/doc-code/company config lives in the E-Memo settings */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm text-slate-600">
        <span>การตั้งค่าโครงการ · ประเภทเอกสาร · รหัส/สายอนุมัติ · บริษัท อยู่ในเมนูตั้งค่าของ E-Memo</span>
        <button onClick={() => navigate('/memos-settings')} className="inline-flex items-center gap-1.5 font-medium text-brand hover:underline">
          ไปตั้งค่า E-Memo <Icon name="arrowRight" className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-brand text-brand'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Active />
    </div>
  );
}
