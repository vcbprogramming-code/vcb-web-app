import { useState } from 'react';
import { PageHeader } from '../../components/ui/index.js';
import NewHiresTab from './NewHiresTab.jsx';
import ResourcesTab from './ResourcesTab.jsx';
import PlanTemplatesTab from './PlanTemplatesTab.jsx';

const TABS = [
  { key: 'newhires', label: 'พนักงานใหม่', Comp: NewHiresTab },
  { key: 'resources', label: 'คลังข้อมูล', Comp: ResourcesTab },
  { key: 'templates', label: 'แผน 30-60-90', Comp: PlanTemplatesTab },
];

export default function Onboarding() {
  const [tab, setTab] = useState('newhires');
  const Active = TABS.find((t) => t.key === tab).Comp;

  return (
    <div className="space-y-5">
      <PageHeader title="แนะแนวและติดตามพนักงานใหม่ 90 วัน" subtitle="คลังข้อมูล · แผนแนะแนว 30-60-90 วัน · แบบประเมินทดลองงาน" />

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-800'
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
