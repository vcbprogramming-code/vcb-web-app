import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProjectsTab from '../admin/ProjectsTab.jsx';
import CompaniesTab from '../admin/CompaniesTab.jsx';
import DocTypesTab from '../admin/DocTypesTab.jsx';
import DocCodeApproversTab from '../admin/DocCodeApproversTab.jsx';
import { PageHeader } from '../../components/ui/index.js';
import Icon from '../../components/Icon.jsx';

// Per-module settings for E-Memo (backlog round 2 #3: settings live inside each
// module, not one global ตั้งค่าระบบ). Company-name/letterhead is edited inside
// each project (โครงการ tab). Users + Permissions stay central (admin page).
const TABS = [
  { key: 'projects', label: 'โครงการ', Comp: ProjectsTab },
  { key: 'companies', label: 'บริษัท / ตรา', Comp: CompaniesTab },
  { key: 'doctypes', label: 'ประเภทเอกสาร', Comp: DocTypesTab },
  { key: 'approvers', label: 'ผู้อนุมัติตามรหัส', Comp: DocCodeApproversTab },
];

export default function EmemoSettings() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('projects');
  const Active = TABS.find((t) => t.key === tab).Comp;

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/memos')} className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800">
        <Icon name="arrowLeft" className="h-4 w-4" /> กลับทะเบียนเอกสาร
      </button>

      <PageHeader title="ตั้งค่า E-Memo" subtitle="โครงการ ประเภทเอกสาร และสายอนุมัติของโมดูลบันทึกข้อความ" />

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
