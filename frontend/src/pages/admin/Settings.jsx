import { useState } from 'react';
import UsersTab from './UsersTab.jsx';
import ProjectsTab from './ProjectsTab.jsx';
import DocTypesTab from './DocTypesTab.jsx';
import LetterheadTab from './LetterheadTab.jsx';

const TABS = [
  { key: 'users', label: 'จัดการผู้ใช้', Comp: UsersTab },
  { key: 'projects', label: 'โครงการ', Comp: ProjectsTab },
  { key: 'doctypes', label: 'ประเภทเอกสาร', Comp: DocTypesTab },
  { key: 'letterhead', label: 'หัวจดหมาย (Letterhead)', Comp: LetterheadTab },
];

export default function Settings() {
  const [tab, setTab] = useState('users');
  const Active = TABS.find((t) => t.key === tab).Comp;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ตั้งค่าระบบ</h1>
        <p className="text-slate-500 mt-1">จัดการผู้ใช้และข้อมูลพื้นฐานของระบบ</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-slate-900 text-slate-900'
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
