import { useEffect, useState } from 'react';
import { performanceApi } from '../../lib/modules.js';
import { formatThaiLongDate } from '../../lib/ememo.js';
import { PageHeader } from '../../components/ui/index.js';
import Icon from '../../components/Icon.jsx';
import PerformanceGrid from './PerformanceGrid.jsx';

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];
function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${THAI_MONTHS[m - 1]} ${y + 543}`;
}
function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function Ring({ pct, color }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(100, pct) / 100) * c;
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className="shrink-0">
      <circle cx="24" cy="24" r={r} fill="none" stroke="#e2e8f0" strokeWidth="5" />
      <circle cx="24" cy="24" r={r} fill="none" stroke={color || '#2563EB'} strokeWidth="5"
        strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" transform="rotate(-90 24 24)" />
      <text x="24" y="28" textAnchor="middle" className="fill-slate-700 text-[11px] font-bold">{pct}%</text>
    </svg>
  );
}

export default function Performance() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [openSite, setOpenSite] = useState(null); // {id, name, color}

  useEffect(() => {
    performanceApi.dashboard(month).then((r) => setData(r.data)).catch((e) => setError(e.message));
  }, [month]);

  if (openSite) {
    return (
      <PerformanceGrid
        site={openSite}
        month={month}
        onBack={() => {
          setOpenSite(null);
          performanceApi.dashboard(month).then((r) => setData(r.data)).catch(() => {});
        }}
      />
    );
  }

  const cards = data?.cards || [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="รายงานการปฏิบัติงาน"
        subtitle="ภาพรวมการบันทึกการทำงานรายหน่วยงาน · บันทึกงาน + OT"
        right={
          <div className="flex items-center gap-2">
            <button onClick={() => setMonth(shiftMonth(month, -1))} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"><Icon name="arrowLeft" className="h-4 w-4" /></button>
            <span className="chip bg-brand/10 text-brand min-w-[120px] justify-center">{monthLabel(month)}</span>
            <button onClick={() => setMonth(shiftMonth(month, 1))} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"><Icon name="arrowRight" className="h-4 w-4" /></button>
          </div>
        }
      />

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      {!data ? (
        <div className="text-slate-400">กำลังโหลด…</div>
      ) : cards.length === 0 ? (
        <div className="card text-center text-slate-400">ยังไม่มีหน่วยงานในขอบเขตของคุณ — เพิ่มหน่วยงานได้ที่ตั้งค่าระบบ</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((c) => {
            const color = c.color || '#2563EB';
            return (
              <div key={c.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="h-1.5" style={{ backgroundColor: color }} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-bold text-slate-800" style={{ color }}>{c.name}</h3>
                      <p className="truncate text-xs text-slate-500">{c.company || 'วิจิตรภัณฑ์ก่อสร้าง'}</p>
                    </div>
                    <Ring pct={c.pct} color={color} />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-lg font-bold text-slate-900">{c.employees}</div>
                      <div className="text-[11px] text-slate-400">พนักงาน</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-slate-900">{c.filled}</div>
                      <div className="text-[11px] text-slate-400">บันทึกแล้ว</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-slate-900">{c.pct}%</div>
                      <div className="text-[11px] text-slate-400">ครบถ้วน</div>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400">
                    {c.op_count} ปฏิบัติการ · {c.sup_count} สนับสนุน
                  </div>
                  <button
                    onClick={() => setOpenSite({ id: c.id, name: c.name, color })}
                    className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold text-white transition"
                    style={{ backgroundColor: color }}
                  >
                    เปิดบันทึก →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
