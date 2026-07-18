import { useEffect, useState } from 'react';
import { ememoApi } from '../../lib/ememo.js';
import Spinner from '../../components/Spinner.jsx';

/**
 * Inline preview of an .xlsx attachment as a scrollable table. The workbook is
 * parsed server-side (exceljs) and returned as rows — the file itself never
 * leaves the system, so confidential spreadsheets aren't sent to any third-party
 * viewer. Falls back to a "please download" message if it can't be shown.
 */
export default function SheetPreview({ docId, attId, heightClass = 'h-[calc(100vh-220px)] min-h-[560px]' }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [truncated, setTruncated] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null); setSheets([]); setActive(0);
    ememoApi.attachmentSheet(docId, attId)
      .then((r) => {
        if (cancelled) return;
        setSheets(r.data?.sheets || []);
        setTruncated(Boolean(r.data?.truncated));
        setLoading(false);
      })
      .catch((e) => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [docId, attId]);

  if (loading) {
    return <div className={`flex ${heightClass} items-center justify-center rounded-xl border border-slate-200 bg-slate-50`}><Spinner label="กำลังเปิดตาราง…" /></div>;
  }
  if (error || sheets.length === 0) {
    return (
      <div className={`flex ${heightClass} flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500`}>
        <span>{error || 'ไม่มีข้อมูลในไฟล์นี้'}</span>
        <span className="text-xs text-slate-400">กรุณาดาวน์โหลดไฟล์เพื่อเปิดด้วยโปรแกรม</span>
      </div>
    );
  }

  const cur = sheets[active] || sheets[0];
  const rows = cur?.rows || [];

  return (
    <div className={`w-full overflow-auto rounded-xl border border-slate-200 bg-white ${heightClass}`}>
      {sheets.length > 1 && (
        <div className="sticky top-0 z-10 flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 p-2">
          {sheets.map((s, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${i === active ? 'bg-brand text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <table className="w-max border-collapse text-xs">
        <tbody>
          {rows.map((cells, ri) => (
            <tr key={ri}>
              {/* row number gutter */}
              <td className="sticky left-0 z-[1] border border-slate-200 bg-slate-50 px-2 py-1 text-center font-medium text-slate-400">{ri + 1}</td>
              {cells.map((c, ci) => (
                <td key={ci} className="max-w-[280px] truncate border border-slate-200 px-2 py-1 text-slate-700" title={c}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {truncated && (
        <div className="border-t border-slate-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
          แสดงเพียงบางส่วน (ไฟล์ขนาดใหญ่) — ดาวน์โหลดเพื่อดูข้อมูลทั้งหมด
        </div>
      )}
    </div>
  );
}
